const PATHS = {
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <rect x="14" y="5" width="4" height="4" />
      <rect x="6" y="15" width="4" height="4" />
    </>
  ),
  more: (
    <>
      <rect x="4" y="10.5" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="10.5" y="10.5" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="17" y="10.5" width="3" height="3" fill="currentColor" stroke="none" />
    </>
  ),
} as const;

export function Icon({ name }: { name: keyof typeof PATHS | 'grid' }) {
  if (name === 'grid') {
    const ops = [1, 0.5, 1, 0.5, 1, 0.5, 1, 1, 0.5];
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {ops.map((o, i) => (
          <rect key={i} x={3 + (i % 3) * 7} y={3 + Math.floor(i / 3) * 7} width="4" height="4" opacity={o} />
        ))}
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
