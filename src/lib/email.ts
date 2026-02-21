import { Resend } from "resend"

let resend: Resend

function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

export async function sendVerificationEmail(to: string, url: string) {
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev"
  await getResend().emails.send({
    from,
    to,
    subject: "Verify your email - Concerts",
    html: `
      <h2>Verify your email</h2>
      <p>Click the link below to verify your email address:</p>
      <p><a href="${url}">Verify Email</a></p>
      <p>If you didn't create an account, you can ignore this email.</p>
    `,
  })
}

export async function sendPasswordResetEmail(to: string, url: string) {
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev"
  await getResend().emails.send({
    from,
    to,
    subject: "Reset your password - Concerts",
    html: `
      <h2>Reset your password</h2>
      <p>Click the link below to reset your password:</p>
      <p><a href="${url}">Reset Password</a></p>
      <p>If you didn't request a password reset, you can ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
    `,
  })
}
