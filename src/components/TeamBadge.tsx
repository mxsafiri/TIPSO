export default function TeamBadge({
  code,
  color,
  size = 44,
}: {
  code: string;
  color: string;
  size?: number;
}) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold text-white shadow-inner"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, ${color}, ${color}cc 60%, #00000055)`,
        fontSize: size * 0.3,
        textShadow: "0 1px 2px rgba(0,0,0,0.6)",
      }}
    >
      {code}
    </div>
  );
}
