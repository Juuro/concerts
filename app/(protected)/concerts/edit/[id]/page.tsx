import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ConcertForm } from "@/components/ConcertForm";
import "./edit-concert.scss";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit Concert - My Concerts",
  description: "Edit concert details",
};

export default async function EditConcertPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  const concert = await prisma.concert.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
  });

  if (!concert) {
    notFound();
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currency: true },
  });

  return (
    <div className="edit-concert">
      <h1>Edit Concert</h1>
      <p className="edit-concert__subtitle">Update concert details</p>
      <ConcertForm
        mode="edit"
        currency={user?.currency || "EUR"}
        concert={{
          id: concert.id,
          date: concert.date.toISOString(),
          latitude: concert.latitude,
          longitude: concert.longitude,
          venue: concert.venue,
          cost: concert.cost?.toString() ?? null,
          isFestival: concert.isFestival,
          festivalId: concert.festivalId,
          festivalName: concert.festival?.name ?? null,
          bands: concert.bands.map((cb) => ({
            bandId: cb.band.id,
            name: cb.band.name,
            slug: cb.band.slug,
            isHeadliner: cb.isHeadliner,
          })),
        }}
      />
    </div>
  );
}
