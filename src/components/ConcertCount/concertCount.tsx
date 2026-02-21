import React from "react";

interface ConcertCountProps {
  counts: {
    past: number;
    future: number;
  };
}

const ConcertCount: React.FC<ConcertCountProps> = ({ counts }) => {
  return (
    <span
      className="badge rounded-pill"
      title={`${counts.future} concerts planned`}
    >
      <span
        className="past badge bg-primary rounded-pill"
        title={`${counts.past} concerts visited`}
      >
        {counts.past}
      </span>
      {counts.future}
    </span>
  );
};

export default ConcertCount;
