import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { updateBand } from "@/lib/bands"
import { validateWebsiteUrl } from "@/utils/validation"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Only admins can edit band data
  if (session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can edit band data" },
      { status: 403 }
    )
  }

  const { slug } = await params

  try {
    const body = await request.json()

    // Validate websiteUrl if provided
    if (body.websiteUrl !== undefined) {
      if (body.websiteUrl === "" || body.websiteUrl === null) {
        body.websiteUrl = null // Allow clearing
      } else {
        const validatedUrl = validateWebsiteUrl(body.websiteUrl)
        if (!validatedUrl) {
          return NextResponse.json(
            {
              error:
                "Invalid website URL. Must be a valid http:// or https:// URL.",
            },
            { status: 400 }
          )
        }
        body.websiteUrl = validatedUrl
      }
    }

    // Validate imageUrl if provided
    if (body.imageUrl !== undefined) {
      if (body.imageUrl === "" || body.imageUrl === null) {
        body.imageUrl = null // Allow clearing
      } else {
        const validatedUrl = validateWebsiteUrl(body.imageUrl)
        if (!validatedUrl) {
          return NextResponse.json(
            {
              error:
                "Invalid image URL. Must be a valid http:// or https:// URL.",
            },
            { status: 400 }
          )
        }
        body.imageUrl = validatedUrl
      }
    }

    const updated = await updateBand(slug, {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.websiteUrl !== undefined && { websiteUrl: body.websiteUrl }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
      updatedById: session.user.id,
    })

    if (!updated) {
      return NextResponse.json({ error: "Band not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error: unknown) {
    console.error("Error updating band:", error)

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A band with this name already exists" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Failed to update band" },
      { status: 500 }
    )
  }
}
