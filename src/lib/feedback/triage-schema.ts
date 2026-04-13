import { z } from "zod"

export const feedbackStatusSchema = z.enum([
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "DONE",
  "DISCARDED",
])

export const feedbackPrioritySchema = z.enum(["P1", "P2", "P3", "P4", "P5"])

export const feedbackQueueModeSchema = z.enum(["active", "all"])

export const feedbackListQuerySchema = z.object({
  /** Default `active`: hide DONE/DISCARDED and GitHub-closed linked items. */
  queue: feedbackQueueModeSchema.default("active"),
  status: feedbackStatusSchema.optional(),
  category: z.enum(["BUG", "FEATURE", "GENERAL"]).optional(),
  priority: feedbackPrioritySchema.optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const feedbackTriagePatchSchema = z
  .object({
    triageStatus: feedbackStatusSchema.optional(),
    priority: feedbackPrioritySchema.optional(),
    ownerUserId: z.string().cuid().nullable().optional(),
    internalNotes: z.string().trim().max(10000).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  })
  .refine(
    (val) =>
      val.triageStatus !== undefined ||
      val.priority !== undefined ||
      val.ownerUserId !== undefined ||
      val.internalNotes !== undefined ||
      val.tags !== undefined,
    { message: "At least one field must be provided" }
  )

export const feedbackGithubCreateSchema = z.object({
  title: z.string().trim().min(5).max(200),
  body: z.string().trim().min(10).max(12000),
  labels: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
  includeOriginalMessage: z.boolean().default(false),
})

export type FeedbackListQuery = z.infer<typeof feedbackListQuerySchema>
export type FeedbackTriagePatch = z.infer<typeof feedbackTriagePatchSchema>
export type FeedbackGithubCreate = z.infer<typeof feedbackGithubCreateSchema>
