"use client";

const CIRCUMFERENCE = 2 * Math.PI * 13; // r=13 → ~81.68

export default function ConfidenceBadge({ value }: { value: number }) {
  const arcColor =
    value >= 75 ? "#22c55e"
    : value >= 65 ? "#e0b23a"
    : "#8e97ad";

  const textColor =
    value >= 75 ? "text-win"
    : value >= 65 ? "text-gold"
    : "text-secondary";

  const fill = (value / 100) * CIRCUMFERENCE;

  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <svg
        className="absolute inset-0 -rotate-90"
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx="18" cy="18" r="13"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="2.5"
        />
        {/* Arc fill */}
        <circle
          cx="18" cy="18" r="13"
          stroke={arcColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${fill} ${CIRCUMFERENCE}`}
          className="arc-draw"
        />
      </svg>
      <span className={`relative text-[12px] font-extrabold tabular-nums leading-none ${textColor}`}>
        {value}%
      </span>
    </div>
  );
}
