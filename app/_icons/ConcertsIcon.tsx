type ConcertsIconProps = {
  /**
   * Percentage size (0-100) the glyph occupies within the tile.
   * Keep this slightly smaller for tiny icons like 32x32.
   */
  glyphSizePct?: number;
};

export function ConcertsIcon({ glyphSizePct = 74 }: ConcertsIconProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #7C3AED 0%, #2563EB 45%, #14B8A6 100%)',
        borderRadius: '22%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          background:
            'radial-gradient(circle at 28% 18%, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0) 55%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.18)',
          borderRadius: '22%',
        }}
      />

      <svg
        width="256"
        height="256"
        viewBox="0 0 256 256"
        style={{
          width: `${glyphSizePct}%`,
          height: `${glyphSizePct}%`,
        }}
      >
        {/* Location pin */}
        <path
          d="M128 20c-46.4 0-84 37.6-84 84 0 62.2 84 138 84 138s84-75.8 84-138c0-46.4-37.6-84-84-84Z"
          fill="rgba(255,255,255,0.14)"
          stroke="rgba(255,255,255,0.92)"
          strokeWidth="10"
          strokeLinejoin="round"
        />
        <circle
          cx="128"
          cy="104"
          r="38"
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="10"
        />

        {/* Music note (inside the pin) */}
        <g transform="translate(0 2)">
          <circle cx="116" cy="142" r="17" fill="rgba(255,255,255,0.95)" />
          <rect x="131" y="86" width="12" height="64" rx="6" fill="rgba(255,255,255,0.95)" />
          <path
            d="M143 88c20 2 34 8 46 18 4 3 2 9-3 10-16 3-30 1-43-6V88Z"
            fill="rgba(255,255,255,0.95)"
          />
        </g>
      </svg>
    </div>
  );
}

