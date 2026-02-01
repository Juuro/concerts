import { ConcertForm } from "@/components/ConcertForm";
import "./new-concert.scss";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Add Concert - My Concerts",
  description: "Add a new concert to your collection",
};

export default function NewConcertPage() {
  return (
    <div className="new-concert">
      <h1>Add Concert</h1>
      <p className="new-concert__subtitle">Record a concert you attended</p>
      <ConcertForm mode="create" />
    </div>
  );
}
