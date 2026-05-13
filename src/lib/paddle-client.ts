"use client"

import { getPaddleInstance, initializePaddle } from "@paddle/paddle-js"
import type { Paddle } from "@paddle/paddle-js"

export async function ensurePaddleJs(): Promise<Paddle | undefined> {
  const existing = getPaddleInstance("v1")
  if (existing?.Initialized) {
    return existing
  }

  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim()
  if (!token) {
    return undefined
  }

  const envRaw = process.env.NEXT_PUBLIC_PADDLE_ENV?.trim().toLowerCase()
  const environment = envRaw === "production" ? "production" : "sandbox"

  return initializePaddle({
    environment,
    token,
    version: "v1",
  })
}

export async function openPaddleCheckout(transactionId: string): Promise<void> {
  const paddle = await ensurePaddleJs()
  if (!paddle) {
    throw new Error("paddle_not_configured")
  }
  paddle.Checkout.open({ transactionId })
}
