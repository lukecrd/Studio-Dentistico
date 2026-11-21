export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-8 h-8 rounded-lg' : 'w-9 h-9 rounded-lg';
  return (
    <div
      className={`${dim} bg-[var(--color-clinical)] text-white flex items-center justify-center shrink-0`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none">
        <path
          d="M10.5 4h3v6.5H20v3h-6.5V20h-3v-6.5H4v-3h6.5V4z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
