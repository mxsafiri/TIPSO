export default function Logo({ size = 44 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full border-2 border-gold-400 bg-navy-900"
      style={{ width: size, height: size }}
    >
      <span
        className="font-bold tracking-wide text-gold-400"
        style={{ fontSize: size * 0.3 }}
      >
        Betua
      </span>
    </div>
  );
}
