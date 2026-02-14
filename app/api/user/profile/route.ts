import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { username, isPublic, currency, hideLocationPublic, hideCostPublic } = body;

    // Validate currency if provided
    const VALID_CURRENCIES = [
      "EUR", "USD", "GBP", "SEK", "NOK", "DKK", "CHF", "PLN", "CZK", "HUF",
    ];
    if (currency && !VALID_CURRENCIES.includes(currency)) {
      return NextResponse.json(
        { error: "Invalid currency" },
        { status: 400 }
      );
    }

    // Validate username format
    if (username && !/^[a-z0-9-]+$/.test(username)) {
      return NextResponse.json(
        { error: "Username can only contain lowercase letters, numbers, and hyphens" },
        { status: 400 }
      );
    }

    // Check username uniqueness (if changed)
    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          id: { not: session.user.id },
        },
      });

      if (existingUser) {
        return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        username: username || null,
        isPublic: isPublic || false,
        hideLocationPublic: hideLocationPublic ?? true,
        hideCostPublic: hideCostPublic ?? true,
        ...(currency && { currency }),
      },
    });

    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      username: updatedUser.username,
      isPublic: updatedUser.isPublic,
      currency: updatedUser.currency,
      hideLocationPublic: updatedUser.hideLocationPublic,
      hideCostPublic: updatedUser.hideCostPublic,
    });
  } catch (error: any) {
    console.error("Error updating profile:", error);

    if (error.code === "P2002") {
      return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
