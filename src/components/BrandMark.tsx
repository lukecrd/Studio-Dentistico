export function BrandMark({
  size = 'md',
  tone = 'teal',
}: {
  size?: 'sm' | 'md';
  tone?: 'teal' | 'dark';
}) {
  const dim = size === 'sm' ? 'w-8 h-8 rounded-lg' : 'w-9 h-9 rounded-[10px]';
  const surface =
    tone === 'dark'
      ? 'bg-gradient-to-br from-[#14b8a6] to-[#0f766e] text-white ring-1 ring-inset ring-white/20 shadow-[0_2px_10px_rgba(20,184,166,0.28)]'
      : 'bg-gradient-to-br from-[#0f766e] to-[#115e59] text-white ring-1 ring-inset ring-white/15 shadow-[0_2px_8px_rgba(15,118,110,0.24)]';

  return (
    <div
      className={`${dim} ${surface} flex items-center justify-center shrink-0`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none">
        <rect
          x="3.5"
          y="4.5"
          width="17"
          height="16"
          rx="3.5"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path d="M8 2.75V5.75M16 2.75V5.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M12 9.5v5.5M9.25 12.25h5.5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
