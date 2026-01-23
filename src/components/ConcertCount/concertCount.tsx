import React from "react";
import type { ConcertsFormatted } from "../../types/concert";

interface ConcertCountProps {
  concerts: ConcertsFormatted;
}

const ConcertCount: React.FC<ConcertCountProps> = ({ concerts }) => {
  const now = new Date();

  const concertsInPast = () =>
    concerts.edges.filter(({ node }) => new Date(node.date) < now);

  const concertsInFuture = () =>
    concerts.edges.filter(({ node }) => new Date(node.date) > now);

  return (
    <span
      className="badge rounded-pill"
      title={`${concertsInFuture().length} concerts planned`}
    >
      <span
        className="past badge bg-primary rounded-pill"
        title={`${concertsInPast().length} concerts visited`}
      >
        {concertsInPast().length}
      </span>
      {concertsInFuture().length}
    </span>
  );
};

export default ConcertCount;
