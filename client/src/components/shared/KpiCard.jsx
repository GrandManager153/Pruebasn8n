import { motion } from 'framer-motion';
import AnimatedNumber from './AnimatedNumber';
import { resolveKpiShortHint } from '../../data/kpiExplanations';

/**
 * Reusable KPI Card component.
 * Props:
 *  - label: display label
 *  - value: numeric or string value
 *  - sub: subtitle text
 *  - hint: short inline description (overrides auto-resolve)
 *  - showHint: resolve hint from kpiExplanations when true
 *  - color: accent color CSS var name (e.g. 'gold', 'blue', 'green', 'red')
 *  - onClick: handler (opens KPI modal)
 *  - delay: animation delay in seconds
 *  - prefix / suffix: for AnimatedNumber
 */
export default function KpiCard({
  label,
  value,
  sub,
  hint,
  showHint = false,
  pending = false,
  color = 'gold',
  onClick,
  delay = 0,
  prefix,
  suffix,
  decimals,
  animateValue = true,
  deltaBadge,
}) {
  const hintText = hint ?? (showHint ? resolveKpiShortHint(label) : null);
  const displayHint = hintText || (showHint ? 'Indicador operativo del call center.' : null);
  const isPending = pending || value === null || value === undefined;
  const displayValue = isPending ? '—' : value;
  const numericValue = parseFloat(String(displayValue).replace(/[^0-9.\-]/g, ''));
  const isNumeric = !isPending && !isNaN(numericValue) && animateValue;

  return (
    <motion.div
      className={`card stat-card-${color}${isPending ? ' card-stat-pending' : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      title={onClick ? 'Clic para ver detalle' : undefined}
      whileHover={{ y: -3, transition: { duration: 0.25 } }}
    >
      <div className="card-stat-label">{label}</div>
      <div className="card-stat-value">
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
            {displayValue}
            {suffix}
          </>
        )}
      </div>
      {sub && <div className="card-stat-sub">{sub}</div>}
      {displayHint && <div className="card-stat-hint">{displayHint}</div>}
      {deltaBadge && (
        <div style={{
          marginTop: 6,
          fontSize: 10,
          fontWeight: 700,
          color: deltaBadge.color || 'var(--text-muted)',
        }}>
          {deltaBadge.text}
        </div>
      )}
    </motion.div>
  );
}
