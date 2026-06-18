import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import AnimatedNumber from './AnimatedNumber';

/**
 * Animated health score ring with SVG gauge + liquid fill effect.
 */
export default function HealthHero({ score = 0, reasons = '' }) {
  const circumference = 2 * Math.PI * 58;
  const dashOffset = circumference - (score / 100) * circumference;

  const scoreColor =
    score >= 80
      ? 'var(--green)'
      : score >= 60
        ? 'var(--amber)'
        : 'var(--red)';

  const statusLabel =
    score >= 80
      ? 'Sistema Óptimo'
      : score >= 60
        ? 'Bajo Presión'
        : 'Estado Crítico';

  return (
    <motion.div
      className="health-hero"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Ring */}
      <div className="health-ring-container">
        <svg viewBox="0 0 128 128">
          <circle className="health-ring-bg" cx="64" cy="64" r="58" />
          <motion.circle
            className="health-ring-fg"
            cx="64"
            cy="64"
            r="58"
            stroke={scoreColor}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          />
        </svg>
        <div className="health-num">
          <AnimatedNumber
            value={score}
            duration={900}
            className="health-num-val"
            style={{ color: scoreColor }}
          />
          <span className="health-num-label">SHS</span>
        </div>
      </div>

      {/* Info */}
      <div className="health-info">
        <h3 style={{ color: scoreColor }}>{statusLabel}</h3>
        <p className="health-reasons">
          {reasons || 'Evaluando estado del sistema...'}
        </p>
      </div>
    </motion.div>
  );
}
