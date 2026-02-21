import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Header from "@/components/Header/header";
import { getUserConcertCounts } from "@/lib/concerts";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const userCounts = await getUserConcertCounts(session.user.id);

  return (
    <>
      <Header siteTitle="My Concerts" concertCounts={userCounts} />
      <main className="container">{children}</main>
    </>
  );
}
