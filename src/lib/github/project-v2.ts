import { getGithubFeedbackToken } from "@/lib/github/github-token"

const GRAPHQL_URL = "https://api.github.com/graphql"

function getProjectToken(): string {
  return process.env.GITHUB_PROJECT_TOKEN || getGithubFeedbackToken()
}

interface GraphqlResponse<T> {
  data?: T
  errors?: { message: string }[]
}

async function githubGraphql<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const token = getProjectToken()
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({ query, variables }),
  })
  const body = (await res.json()) as GraphqlResponse<T>
  if (!res.ok) {
    throw new Error(`GitHub GraphQL HTTP ${res.status}`)
  }
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join("; "))
  }
  if (!body.data) {
    throw new Error("GitHub GraphQL returned no data")
  }
  return body.data
}

type SingleSelectField = {
  __typename: string
  id: string
  name: string
  options: { id: string; name: string }[]
}

type ProjectV2Payload = {
  id: string
  fields: {
    nodes: (
      | SingleSelectField
      | { __typename: string; id?: string; name?: string }
    )[]
  }
}

const PROJECT_FIELDS_FRAGMENT = `
  fragment ProjectFields on ProjectV2 {
    id
    fields(first: 50) {
      nodes {
        __typename
        ... on ProjectV2SingleSelectField {
          id
          name
          options {
            id
            name
          }
        }
      }
    }
  }
`

async function loadProjectByNodeId(nodeId: string): Promise<ProjectV2Payload> {
  const q = `
    query ($id: ID!) {
      node(id: $id) {
        ... on ProjectV2 {
          ...ProjectFields
        }
      }
    }
    ${PROJECT_FIELDS_FRAGMENT}
  `
  const data = await githubGraphql<{ node: ProjectV2Payload | null }>(q, {
    id: nodeId,
  })
  if (!data.node?.id) {
    throw new Error("GITHUB_PROJECT_NODE_ID is not a valid ProjectV2 node")
  }
  return data.node
}

async function loadProjectByOwnerAndNumber(
  owner: string,
  number: number
): Promise<ProjectV2Payload> {
  // Query user and organization separately. A single query that includes both
  // `organization(login: $owner)` and `user(login: $owner)` fails with a GraphQL
  // error when the login is a user (e.g. "Juuro") because org resolution errors
  // bubble to the whole response.
  const userQuery = `
    query ($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          ...ProjectFields
        }
      }
    }
    ${PROJECT_FIELDS_FRAGMENT}
  `
  const userData = await githubGraphql<{
    user: { projectV2: ProjectV2Payload | null } | null
  }>(userQuery, { owner, number })

  const fromUser = userData.user?.projectV2
  if (fromUser?.id) {
    return fromUser
  }

  const orgQuery = `
    query ($owner: String!, $number: Int!) {
      organization(login: $owner) {
        projectV2(number: $number) {
          ...ProjectFields
        }
      }
    }
    ${PROJECT_FIELDS_FRAGMENT}
  `
  const orgData = await githubGraphql<{
    organization: { projectV2: ProjectV2Payload | null } | null
  }>(orgQuery, { owner, number })

  const fromOrg = orgData.organization?.projectV2
  if (fromOrg?.id) {
    return fromOrg
  }

  throw new Error(
    `No Project V2 found for owner "${owner}" and number ${number} (checked user, then organization)`
  )
}

function findStatusField(
  project: ProjectV2Payload
): SingleSelectField | undefined {
  return project.fields.nodes.find(
    (n): n is SingleSelectField =>
      n.__typename === "ProjectV2SingleSelectField" &&
      typeof (n as SingleSelectField).name === "string" &&
      (n as SingleSelectField).name.toLowerCase() === "status"
  )
}

function pickStatusOption(
  field: SingleSelectField,
  preferredName: string | undefined
): string | undefined {
  const opts = field.options
  if (preferredName) {
    const exact = opts.find(
      (o) => o.name.toLowerCase() === preferredName.toLowerCase()
    )
    if (exact) return exact.id
  }
  const fallbacks = ["Todo", "To do", "New", "Backlog", "Triage", "Triaged"]
  for (const name of fallbacks) {
    const o = opts.find((x) => x.name.toLowerCase() === name.toLowerCase())
    if (o) return o.id
  }
  return opts[0]?.id
}

/**
 * Adds an issue (by GraphQL node id) to GitHub Project V2 and sets Status.
 * Requires classic PAT with `project` scope or fine-grained with Projects permission.
 */
export async function linkIssueToProjectV2(issueNodeId: string): Promise<{
  projectItemId: string
} | null> {
  const nodeIdOverride = process.env.GITHUB_PROJECT_NODE_ID?.trim()
  const owner = process.env.GITHUB_PROJECT_OWNER?.trim()
  const numberRaw = process.env.GITHUB_PROJECT_NUMBER?.trim()
  const statusName = process.env.GITHUB_PROJECT_STATUS_OPTION_NAME?.trim()

  if (!nodeIdOverride && (!owner || !numberRaw)) {
    return null
  }

  let projectNumber: number | undefined
  if (!nodeIdOverride && numberRaw) {
    projectNumber = parseInt(numberRaw, 10)
    if (!Number.isFinite(projectNumber)) {
      throw new Error(
        `GITHUB_PROJECT_NUMBER env var is misconfigured: "${numberRaw}" is not a valid integer`
      )
    }
  }

  const project = nodeIdOverride
    ? await loadProjectByNodeId(nodeIdOverride)
    : await loadProjectByOwnerAndNumber(owner!, projectNumber!)

  const addMutation = `
    mutation ($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item {
          id
        }
      }
    }
  `
  const added = await githubGraphql<{
    addProjectV2ItemById: { item: { id: string } | null } | null
  }>(addMutation, {
    projectId: project.id,
    contentId: issueNodeId,
  })

  const projectItemId = added.addProjectV2ItemById?.item?.id
  if (!projectItemId) {
    throw new Error("addProjectV2ItemById did not return an item id")
  }

  const statusField = findStatusField(project)
  if (statusField) {
    const optionId = pickStatusOption(statusField, statusName)
    if (optionId) {
      const updateMutation = `
        mutation (
          $projectId: ID!
          $itemId: ID!
          $fieldId: ID!
          $optionId: String!
        ) {
          updateProjectV2ItemFieldValue(
            input: {
              projectId: $projectId
              itemId: $itemId
              fieldId: $fieldId
              value: { singleSelectOptionId: $optionId }
            }
          ) {
            projectV2Item {
              id
            }
          }
        }
      `
      await githubGraphql(updateMutation, {
        projectId: project.id,
        itemId: projectItemId,
        fieldId: statusField.id,
        optionId,
      })
    }
  }

  return { projectItemId }
}
