import { ImageResponse } from "next/og"

import { TicketIcon } from "./_icons/TicketIcon"

export const contentType = "image/png"

export const size = {
  width: 180,
  height: 180,
}

export default function AppleIcon() {
  return new ImageResponse(<TicketIcon />, size)
}
