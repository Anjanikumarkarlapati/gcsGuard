// Project illustrations as inline SVG so they follow the theme tokens.
// Strokes use currentColor; fills use the olive accent and its wash.

const svgProps = (title) => ({
  viewBox: "0 0 320 200",
  role: "img",
  "aria-label": title,
  className: "illustration",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});

function Bucket({ x, y, w = 56, h = 64, on }) {
  const rx = w / 2;
  return (
    <g>
      <path
        d={`M${x} ${y} v${h} a${rx} 9 0 0 0 ${w} 0 v-${h}`}
        fill={on ? "var(--accent)" : "var(--accent-wash)"}
        fillOpacity={on ? 0.9 : 1}
      />
      <ellipse cx={x + rx} cy={y} rx={rx} ry={9} fill="var(--bg-surface)" />
      <path d={`M${x} ${y + h / 2} a${rx} 9 0 0 0 ${w} 0`} opacity="0.5" />
    </g>
  );
}

export function CloudBuckets() {
  return (
    <svg {...svgProps("Cloud Storage buckets protected by a shield")}>
      <path
        d="M92 78c-22 0-34-14-34-30s14-30 32-28c6-14 20-22 36-20 14 2 26 12 29 26 18-2 33 10 33 26s-13 26-30 26z"
        fill="var(--accent-wash)"
      />
      <path d="M120 82v26M160 80v34M200 82v26" strokeDasharray="3 5" opacity="0.6" />
      <Bucket x={92} y={116} on />
      <Bucket x={132} y={124} />
      <Bucket x={172} y={116} on />
      <path
        d="M262 86l30 11v24c0 20-13 34-30 40-17-6-30-20-30-40V97z"
        fill="var(--accent)"
        stroke="var(--accent)"
      />
      <path d="M249 123l9 9 17-19" stroke="var(--on-accent)" strokeWidth="3" />
      <circle cx="40" cy="150" r="4" fill="var(--accent)" stroke="none" />
      <circle cx="292" cy="40" r="3" fill="currentColor" stroke="none" opacity="0.4" />
    </svg>
  );
}

export function AclToIam() {
  return (
    <svg {...svgProps("Legacy ACL entries being migrated to IAM roles")}>
      <rect x="20" y="36" width="110" height="128" rx="14" fill="var(--bg-surface)" />
      <text x="36" y="62" fill="currentColor" stroke="none" fontSize="13" fontFamily="var(--font-mono)">ACL</text>
      {[80, 104, 128].map((y, i) => (
        <g key={y}>
          <circle cx="40" cy={y} r="6" fill={i === 2 ? "var(--status-critical)" : "var(--accent-wash)"} stroke={i === 2 ? "var(--status-critical)" : "currentColor"} />
          <path d={`M54 ${y}h56`} opacity="0.6" />
        </g>
      ))}
      <path d="M142 100h40" strokeWidth="3" stroke="var(--accent)" />
      <path d="M174 90l12 10-12 10" strokeWidth="3" stroke="var(--accent)" />
      <rect x="196" y="36" width="104" height="128" rx="14" fill="var(--accent-wash)" />
      <text x="212" y="62" fill="currentColor" stroke="none" fontSize="13" fontFamily="var(--font-mono)">IAM</text>
      <circle cx="226" cy="100" r="12" fill="var(--accent)" stroke="var(--accent)" />
      <path d="M238 100h40M266 100v10M276 100v7" strokeWidth="3" />
      <path d="M212 136h72M212 148h48" opacity="0.6" />
    </svg>
  );
}

export function LockedBucket() {
  return (
    <svg {...svgProps("A bucket locked to uniform bucket-level access, with a 90-day clock")}>
      <Bucket x={96} y={70} w={96} h={90} on />
      <rect x="126" y="112" width="36" height="30" rx="6" fill="var(--bg-surface)" />
      <path d="M134 112v-8a10 10 0 0 1 20 0v8" />
      <circle cx="144" cy="127" r="3" fill="currentColor" />
      <circle cx="244" cy="74" r="34" fill="var(--bg-surface)" />
      <path d="M244 52v22l14 10" strokeWidth="3" stroke="var(--accent)" />
      <text x="225" y="128" fill="currentColor" stroke="none" fontSize="13" fontFamily="var(--font-mono)">90 d</text>
      <path d="M40 160h240" opacity="0.3" />
    </svg>
  );
}

export function EvidenceReport() {
  return (
    <svg {...svgProps("A migration report with passed checks being downloaded")}>
      <path d="M92 28h96l32 32v112a8 8 0 0 1-8 8H92a8 8 0 0 1-8-8V36a8 8 0 0 1 8-8z" fill="var(--bg-surface)" />
      <path d="M188 28v32h32" />
      {[78, 106, 134].map((y) => (
        <g key={y}>
          <circle cx="108" cy={y} r="8" fill="var(--accent)" stroke="var(--accent)" />
          <path d={`M104 ${y}l3 3 6-6`} stroke="var(--on-accent)" />
          <path d={`M124 ${y}h68`} opacity="0.6" />
        </g>
      ))}
      <circle cx="244" cy="148" r="26" fill="var(--accent)" stroke="var(--accent)" />
      <path d="M244 134v24M234 150l10 10 10-10" stroke="var(--on-accent)" strokeWidth="3" />
    </svg>
  );
}
