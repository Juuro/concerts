import { z } from "zod"

/** Request body for POST /api/feedback (category matches Prisma enum). */
export const feedbackBodySchema = z.object({
  category: z.enum(["BUG", "FEATURE", "GENERAL"]),
  message: z
    .string()
    .trim()
    .min(10, "Please enter at least 10 characters.")
    .max(5000, "Message must be at most 5000 characters."),
  pagePath: z
    .string()
    .trim()
    .max(512)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
})

export type FeedbackBodyInput = z.infer<typeof feedbackBodySchema>
