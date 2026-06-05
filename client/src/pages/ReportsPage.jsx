import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import useDashboardStore from '../stores/useDashboardStore';

const reports = [
  {
    key: 'executive',
    title: 'Dirección / C-Level',
    audience: 'Executive / Directores Corporativos',
    code: 'EXEC',
    gradient: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
  },
  {
    key: 'manager',
    title: 'Supervisores / Managers',
    audience: 'Manager / Gestión de Conversiones',
    code: 'MGR',
    gradient: 'linear-gradient(135deg, #065f46, #10b981)',
  },
  {
    key: 'analyst',
    title: 'Equipo BI / Data Science',
    audience: 'Analyst / Analistas y Científicos de Datos',
    code: 'BI',
    gradient: 'linear-gradient(135deg, #581c87, #8b5cf6)',
  },
  {
    key: 'operations',
    title: 'Agentes / Operaciones',
    audience: 'Operations / Control de Capacidad Telefónica',
    code: 'OPS',
    gradient: 'linear-gradient(135deg, #7c2d12, #ea580c)',
  },
];

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState(null);
  const [iframeUrl, setIframeUrl] = useState('');
  const lastUpdate = useDashboardStore((state) => state.lastUpdate);
  const theme = useDashboardStore((state) => state.theme);

  // Sync iframe URL with active report and cache buster on data updates
  useEffect(() => {
    if (activeReport) {
      setIframeUrl(`/reports/${activeReport.key}?_=${Date.now()}`);
    }
  }, [lastUpdate, activeReport]);

  const openReport = (report) => {
    setActiveReport(report);
    setIframeUrl(`/reports/${report.key}?_=${Date.now()}`);
  };

  const closeViewer = () => {
    setActiveReport(null);
    setIframeUrl('');
  };

  // Sync theme to iframe when theme or iframe loads
  const handleIframeLoad = () => {
    const iframe = document.getElementById('report-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(theme === 'light' ? 'theme-light' : 'theme-dark', '*');
    }
  };

  const handlePrint = () => {
    const iframe = document.getElementById('report-iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        window.open(iframeUrl, '_blank');
      }
    } else {
      window.open(iframeUrl, '_blank');
    }
  };

  return (
    <>
      <div className="section-header">
        <div className="section-title">
          <span className="bar" />
          Informes Analíticos de Dirección
        </div>
        <div className="section-meta">Actualizados al momento de la auditoría</div>
      </div>

      <div className="grid-2">
        {reports.map((r, i) => (
          <motion.div
            key={r.key}
            className="report-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => openReport(r)}
          >
            <div
              className="icon-box"
              style={{ background: r.gradient }}
            >
              {r.code}
            </div>
            <div className="report-info">
              <h4>{r.title}</h4>
              <p>Dirigido a: {r.audience}</p>
            </div>
            <span className="arrow">→</span>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{ marginTop: 'var(--gap-bento)' }}
      >
        <div className="card card-no-hover" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            background: 'rgba(9, 15, 32, 0.85)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="pulse-dot"
              style={{
                background: activeReport ? 'var(--green)' : 'var(--gold)',
                animation: activeReport ? 'pulse 2s infinite' : 'none',
              }}
            />
            <h4 style={{ fontSize: 13.5, fontWeight: 800, color: 'white', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {activeReport ? activeReport.title : 'Visor de Informe Interactivo'}
            </h4>
          </div>
          {activeReport && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handlePrint}
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  borderRadius: 6,
                  background: 'var(--chartreuse)',
                  border: '1px solid var(--chartreuse)',
                  color: '#080c14',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Descargar PDF / Imprimir 📥
              </button>
              <a
                href={iframeUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  borderRadius: 6,
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                Pantalla Completa ↗
              </a>
              <button
                onClick={closeViewer}
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Cerrar Vista ×
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {activeReport ? (
          <iframe
            id="report-iframe"
            src={iframeUrl}
            onLoad={handleIframeLoad}
            style={{ width: '100%', height: 800, border: 'none', background: '#070d19' }}
            title={activeReport.title}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 420,
              textAlign: 'center',
              padding: 40,
              background: 'rgba(7, 13, 25, 0.45)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              style={{ width: 48, height: 48, stroke: 'var(--gold)', fill: 'none', marginBottom: 16 }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.2"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>
              Pantalla Integrada de Informes
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 440, lineHeight: 1.6, margin: 0 }}>
              Selecciona cualquiera de las tarjetas de arriba para cargar el informe analítico completo directamente dentro de esta pantalla.
            </p>
          </div>
        )}
        </div>
      </motion.div>
    </>
  );
}
