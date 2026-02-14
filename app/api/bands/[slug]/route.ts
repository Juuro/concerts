import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { updateBand } from "@/lib/bands"

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

  const { slug } = await params

  try {
    const body = await request.json()

    const updated = await updateBand(slug, {
      name: body.name,
      imageUrl: body.imageUrl,
      websiteUrl: body.websiteUrl,
    })

    if (!updated) {
      return NextResponse.json({ error: "Band not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Error updating band:", error)

    if (error.code === "P2002") {
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
