export function TicketIcon() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #ff0666 0%, #ff6ba3 100%)",
        borderRadius: "22%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Shine overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          background:
            "radial-gradient(circle at 28% 18%, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0) 55%)",
        }}
      />

      {/* Border */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.18)",
          borderRadius: "22%",
        }}
      />

      {/* Ticket stub SVG */}
      <svg
        width="256"
        height="256"
        viewBox="0 0 256 256"
        style={{
          width: "70%",
          height: "70%",
        }}
      >
        {/* Ticket body with notched edge */}
        <path
          d="M32 56 C32 44 42 34 54 34 L180 34
             L180 50 C188 50 194 56 194 64 C194 72 188 78 180 78 L180 94
             L180 94 C188 94 194 100 194 108 C194 116 188 122 180 122 L180 138
             L180 138 C188 138 194 144 194 152 C194 160 188 166 180 166 L180 182
             L180 182 C188 182 194 188 194 196 C194 204 188 210 180 210 L180 222
             L54 222 C42 222 32 212 32 200 L32 56 Z"
          fill="rgba(255,255,255,0.14)"
          stroke="rgba(255,255,255,0.92)"
          strokeWidth="8"
          strokeLinejoin="round"
        />

        {/* Perforation line */}
        <line
          x1="156"
          y1="50"
          x2="156"
          y2="206"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="4"
          strokeDasharray="8 8"
        />

        {/* Three horizontal lines (ticket details) */}
        <rect
          x="52"
          y="70"
          width="80"
          height="12"
          rx="6"
          fill="rgba(255,255,255,0.9)"
        />
        <rect
          x="52"
          y="100"
          width="60"
          height="12"
          rx="6"
          fill="rgba(255,255,255,0.7)"
        />
        <rect
          x="52"
          y="130"
          width="70"
          height="12"
          rx="6"
          fill="rgba(255,255,255,0.7)"
        />

        {/* Small stub number area */}
        <rect
          x="52"
          y="170"
          width="40"
          height="30"
          rx="4"
          fill="rgba(255,255,255,0.2)"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="3"
        />
      </svg>
    </div>
  )
}
