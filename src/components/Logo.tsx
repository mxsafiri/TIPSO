export default function Logo({ size = 44 }: { size?: number }) {
  const r = size * 0.22;
  const w = size * 1.72; // wider pill for the "Betua" wordmark

  return (
    <div
      style={{
        width: w,
        height: size,
        borderRadius: r,
        background: 'linear-gradient(145deg, #131b2e 0%, #0a0e1a 100%)',
        boxShadow:
          'inset 0 0 0 1.5px rgba(224,178,58,0.28), inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 16px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Corner radiance */}
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          right: '-8%',
          width: size * 0.7,
          height: size * 0.7,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(224,178,58,0.13) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Wordmark */}
      <span
        style={{
          position: 'relative',
          fontWeight: 900,
          fontSize: size * 0.3,
          lineHeight: 1,
          letterSpacing: '0.06em',
          color: '#e0b23a',
          textShadow: '0 0 14px rgba(224,178,58,0.38)',
        }}
      >
        Betua
      </span>

      {/* Thin baseline accent */}
      <div
        style={{
          position: 'absolute',
          bottom: size * 0.16,
          left: '18%',
          right: '18%',
          height: 1.5,
          borderRadius: 2,
          background: 'linear-gradient(90deg, transparent, rgba(224,178,58,0.45), transparent)',
        }}
      />
    </div>
  );
}
