import { useEffect, useRef, useState } from 'react';
import { toneForLevel, toneForStatus } from '../lib/format.js';

const TONE_COLORS = {
  safe: '#34d399',
  warn: '#fbbf24',
  danger: '#f87171',
  critical: '#ff4d6d',
  neutral: '#22d3ee',
};

function useCountUp(target, duration = 900, enabled = true) {
  const [value, setValue] = useState(enabled ? 0 : target);
  const frame = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return undefined;
    }
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);

      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration, enabled]);

  return value;
}

export default function RiskGauge({
  score = 0,
  level = 'LOW',
  band,
  indicators = [],
  animated = true,
  disclaimer,
}) {
  const tone = toneForLevel(level);
  const color = TONE_COLORS[tone] ?? TONE_COLORS.neutral;
  const display = useCountUp(score, 950, animated);

  const SIZE = 232;
  const STROKE = 13;
  const R = (SIZE - STROKE) / 2 - 4;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const SWEEP = 270;
  const START = 135;

  const polar = (angleDeg) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return [CX + R * Math.cos(rad), CY + R * Math.sin(rad)];
  };

  const arcPath = (fromDeg, toDeg) => {
    const [x1, y1] = polar(fromDeg);
    const [x2, y2] = polar(toDeg);
    const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
  };

  const pct = Math.max(0, Math.min(100, score)) / 100;
  const endAngle = START + SWEEP * pct;

  const circumference = 2 * Math.PI * R * (SWEEP / 360);

  return (
    <div className="stack gap-14" style={{ alignItems: 'center' }}>
      <span className="mono-label" style={{ letterSpacing: '0.2em' }}>
        Threat Level
      </span>

      <div style={{ position: 'relative', width: SIZE, height: SIZE * 0.92 }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`Prototype risk score ${score} out of 100 — ${level} risk`}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <filter id="gauge-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="gauge-safe" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>

          {}
          {Array.from({ length: 37 }).map((_, i) => {
            const a = START + (SWEEP / 36) * i;
            const [x1, y1] = polar(a);
            const outer = R + STROKE / 2 + 3;
            const rad = ((a - 90) * Math.PI) / 180;
            const x2 = CX + outer * Math.cos(rad);
            const y2 = CY + outer * Math.sin(rad);
            const major = i % 9 === 0;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={major ? 'var(--line-strong)' : 'var(--line)'}
                strokeWidth={major ? 2 : 1}
                opacity={major ? 0.9 : 0.5}
              />
            );
          })}

          {}
          <path
            d={arcPath(START, START + SWEEP)}
            fill="none"
            stroke="var(--line)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />

          {}
          <path
            d={arcPath(START, Math.max(START + 0.01, endAngle))}
            fill="none"
            stroke={tone === 'safe' ? 'url(#gauge-safe)' : color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            filter="url(#gauge-glow)"
            style={{
              strokeDasharray: score === 0 ? undefined : circumference,
              transition: 'stroke 400ms ease',
            }}
          />
        </svg>

        <div
          className="stack gap-2"
          style={{
            position: 'absolute',
            inset: 0,
            alignItems: 'center',
            justifyContent: 'center',
            paddingBottom: 16,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 60,
              fontWeight: 700,
              lineHeight: 1,
              color: tone === 'safe' ? 'var(--green)' : color,
              textShadow: `0 0 26px ${color}44`,
              letterSpacing: '-0.03em',
            }}
          >
            {display}
          </div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            / 100
          </div>
          <div
            className="mono"
            style={{
              marginTop: 8,
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: tone === 'safe' ? 'var(--green)' : color,
            }}
          >
            {level === 'LOW' ? 'LOW RISK' : `${level} RISK`}
          </div>
          {band ? (
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 2 }}>
              band {band.min}–{band.max}
            </div>
          ) : null}
        </div>
      </div>

      {}
      {indicators.length ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(126px, 100%), 1fr))',
            gap: 6,
            width: '100%',
            marginTop: 4,
          }}
        >
          {indicators.map((ind) => {
            const t = ind.tone ?? toneForStatus(ind.status);
            const color2 = TONE_COLORS[t] ?? TONE_COLORS.neutral;
            return (
              <div
                key={ind.id}
                className="row gap-8"
                style={{
                  justifyContent: 'space-between',
                  padding: '5px 9px',
                  borderRadius: 6,
                  border: `1px solid ${color2}33`,
                  background: `${color2}0d`,
                  fontSize: 11,
                }}
                title={ind.title}
              >
                <span className="mono" style={{ color: 'var(--text-mute)', letterSpacing: '0.06em', fontSize: 10 }}>
                  {ind.label}
                </span>
                <span className="mono" style={{ color: color2, fontWeight: 700 }}>
                  {ind.mark}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {disclaimer ? (
        <p
          className="mono"
          style={{ fontSize: 10.5, color: 'var(--text-faint)', textAlign: 'center', lineHeight: 1.6, maxWidth: 380 }}
        >
          {disclaimer}
        </p>
      ) : null}
    </div>
  );
}
