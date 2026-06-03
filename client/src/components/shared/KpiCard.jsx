import { motion } from 'framer-motion';
import AnimatedNumber from './AnimatedNumber';

/**
 * Reusable KPI Card component.
 * Props:
 *  - label: display label
 *  - value: numeric or string value
 *  - sub: subtitle text
 *  - color: accent color CSS var name (e.g. 'gold', 'blue', 'green', 'red')
 *  - onClick: handler (opens KPI modal)
 *  - delay: animation delay in seconds
 *  - prefix / suffix: for AnimatedNumber
 */
export default function KpiCard({
  label,
  value,
  sub,
  color = 'gold',
  onClick,
  delay = 0,
  prefix,
  suffix,
  decimals,
  animateValue = true,
}) {
  const colorVar = `var(--${color})`;
  const glowVar = `var(--${color}-glow)`;
  const numericValue = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  const isNumeric = !isNaN(numericValue) && animateValue;

  return (
    <motion.div
      className={`card stat-card-${color}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      whileHover={{ y: -3, transition: { duration: 0.25 } }}
    >
      <div className="card-stat-label">{label}</div>
      <div
        className="card-stat-value"
        style={{ color: colorVar, textShadow: `0 0 20px ${glowVar}` }}
      >
        {isNumeric ? (
          <AnimatedNumber
            value={numericValue}
            prefix={prefix}
            suffix={suffix}
            decimals={decimals || 0}
          />
        ) : (
          <>
            {prefix}
            {value}
            {suffix}
          </>
        )}
      </div>
      {sub && <div className="card-stat-sub">{sub}</div>}
    </motion.div>
  );
}
