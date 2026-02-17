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
    const userIsAdmin = session.user.role === "admin"

    // Non-admins cannot change band name
    if (body.name !== undefined && !userIsAdmin) {
      return NextResponse.json(
        { error: "Only admins can edit band names" },
        { status: 403 }
      )
    }

    const updated = await updateBand(slug, {
      ...(userIsAdmin && body.name !== undefined && { name: body.name }),
      ...(body.websiteUrl !== undefined && { websiteUrl: body.websiteUrl }),
      updatedById: session.user.id,
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
