import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ConcertForm } from "@/components/ConcertForm";
import "./new-concert.scss";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Add Concert - My Concerts",
  description: "Add a new concert to your collection",
};

export default async function NewConcertPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currency: true },
  });

  return (
    <div className="new-concert">
      <h1>Add Concert</h1>
      <p className="new-concert__subtitle">Record a concert you attended</p>
      <ConcertForm mode="create" currency={user?.currency || "EUR"} canEditBandName={session.user.role === "admin"} />
    </div>
  );
}
