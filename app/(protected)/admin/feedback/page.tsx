import type { Metadata } from "next"
import FeedbackWorkspace from "../components/FeedbackWorkspace"

export const metadata: Metadata = {
  title: "Feedback Operations | Admin",
  description: "Triage user feedback and escalate to GitHub issues",
}

export default function FeedbackAdminPage() {
  return <FeedbackWorkspace />
}
