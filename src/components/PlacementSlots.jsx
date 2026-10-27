export function PlacementSlots({ used, limit, decorative = false }) {
  const label = `${used} of ${limit} placement slots used`;
  return <span className="placement-slots" style={{ "--slot-columns": Math.min(limit, 4) }}
    role={decorative ? undefined : "img"} aria-label={decorative ? undefined : label}
    aria-hidden={decorative || undefined} title={label}>
    {Array.from({ length: limit }, (_, index) => <i key={index} className={`placement-led${index < used ? " is-active" : ""}`} />)}
  </span>;
}
