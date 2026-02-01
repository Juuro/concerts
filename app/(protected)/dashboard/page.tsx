import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserConcerts } from "@/lib/concerts";
import ConcertCard from "@/components/ConcertCard/concertCard";
import "./dashboard.scss";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard - My Concerts",
  description: "Manage your concert collection",
};

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const concerts = await getUserConcerts(session.user.id);

  // Calculate statistics
  const totalConcerts = concerts.length;
  const uniqueBands = new Set(concerts.flatMap((c) => c.bands.map((b) => b.slug))).size;
  const uniqueCities = new Set(concerts.map((c) => c.fields.geocoderAddressFields._normalized_city)).size;
  const years = new Set(concerts.map((c) => new Date(c.date).getFullYear()));

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div>
          <h1 className="dashboard__title">My Concerts</h1>
          <p className="dashboard__subtitle">Welcome back, {session.user.name || "friend"}!</p>
        </div>
        <Link href="/concerts/new" className="dashboard__add-btn">
          + Add Concert
        </Link>
      </div>

      <div className="dashboard__stats">
        <div className="stat-card">
          <span className="stat-card__value">{totalConcerts}</span>
          <span className="stat-card__label">Concerts</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">{uniqueBands}</span>
          <span className="stat-card__label">Bands</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">{uniqueCities}</span>
          <span className="stat-card__label">Cities</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">{years.size}</span>
          <span className="stat-card__label">Years</span>
        </div>
      </div>

      {concerts.length === 0 ? (
        <div className="dashboard__empty">
          <h2>No concerts yet</h2>
          <p>Start building your concert collection by adding your first concert.</p>
          <Link href="/concerts/new" className="dashboard__add-btn">
            Add Your First Concert
          </Link>
        </div>
      ) : (
        <div className="dashboard__concerts">
          <h2 className="dashboard__section-title">Recent Concerts</h2>
          <div className="dashboard__concert-list">
            {concerts.map((concert) => (
              <div key={concert.id} className="dashboard__concert-item">
                <ConcertCard
                  concert={{
                    id: concert.id,
                    date: concert.date,
                    city: concert.city,
                    club: concert.club,
                    bands: concert.bands.map((b) => ({
                      id: b.id,
                      name: b.name,
                      slug: b.slug,
                      url: b.url,
                    })),
                    isFestival: concert.isFestival,
                    festival: concert.festival,
                    fields: concert.fields,
                  }}
                />
                <div className="dashboard__concert-actions">
                  <Link href={`/concerts/edit/${concert.id}`} className="dashboard__edit-btn">
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
