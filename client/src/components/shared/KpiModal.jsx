import { motion, AnimatePresence } from 'framer-motion';
import { resolveKpiExplanation } from '../../data/kpiExplanations';

/**
 * KPI Explanation Modal.
 */
export default function KpiModal({
  isOpen,
  label,
  subtitle,
  value,
  definition,
  interpretation,
  source,
  onClose,
}) {
  const explain = resolveKpiExplanation(label);
  const defText = definition || explain?.definition;
  const interpText = interpretation || explain?.interpretation;
  const sourceText = source || explain?.source;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="kpi-modal-overlay open"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ pointerEvents: 'auto' }}
        >
          <motion.div
            className="kpi-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="kpi-modal-close" onClick={onClose}>
              &times;
            </button>
            <div className="kpi-modal-title">{label}</div>
            {subtitle ? (
              <div className="kpi-modal-subtitle">{subtitle}</div>
            ) : null}
            <div className="kpi-modal-value">{value}</div>

            {defText ? (
              <>
                <div className="kpi-modal-section">
                  <div className="kpi-modal-section-label">¿Qué significa?</div>
                  <div className="kpi-modal-section-text">{defText}</div>
                </div>
                {interpText ? (
                  <div className="kpi-modal-section">
                    <div className="kpi-modal-section-label">
                      ¿Cómo interpretar el valor actual?
                    </div>
                    <div className="kpi-modal-section-text">{interpText}</div>
                  </div>
                ) : null}
                {sourceText ? (
                  <>
                    <hr className="kpi-modal-divider" />
                    <div className="kpi-modal-source">
                      <div className="kpi-modal-source-dot" />
                      <span>{sourceText}</span>
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <div className="kpi-modal-section">
                <div className="kpi-modal-section-text" style={{ color: 'var(--text-dim)' }}>
                  No hay información detallada para este indicador.
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
