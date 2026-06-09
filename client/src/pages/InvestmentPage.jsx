import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import useDashboardStore from '../stores/useDashboardStore';
import KpiCard from '../components/shared/KpiCard';
import KpiModal from '../components/shared/KpiModal';

const COLORS = [
  '#3b82f6', // Neon Blue
  '#10b981', // Emerald Green
  '#fbbf24', // Amber/Gold
  '#f43f5e', // Crimson/Red
  '#8b5cf6', // Violet/Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
];

export default function InvestmentPage() {
  const { data, loading } = useDashboardStore();
  const [activeIndex, setActiveIndex] = useState(-1);
  const [modal, setModal] = useState({ open: false, label: '', value: '' });

  if (loading || !data) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando datos de inversión...</p>
      </div>
    );
  }

  const inv = data.investment || {};
  const campaigns = inv.campaigns || [];

  const chartData = useMemo(() => {
    return campaigns.map((c) => ({
      name: c.name || c.campaign || 'Sin nombre',
      value: parseFloat(c.spend || c.amount || 0),
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  }, [campaigns]);

  const totalSpend = useMemo(() => {
    return chartData.reduce((sum, d) => sum + d.value, 0);
  }, [chartData]);

  return (
    <>
      <div className="section-header">
        <div className="section-title">
          <span className="bar" />
          Ad Spend & Budget (Presupuesto Publicitario y Distribución)
        </div>
      </div>

      <div className="grid-2-1">
        {/* Interactive Donut Chart */}
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="chart-title">
            <span className="dot" style={{ background: 'var(--green)' }} />
            Campaign Budget Share (Distribución del Gasto por Campaña)
          </div>

          {chartData.length > 0 ? (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 24,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 16,
            }}>
              {/* Left Column: Donut Chart */}
              <div style={{ flex: '1 1 240px', minWidth: 200, height: 260, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={96}
                      paddingAngle={3}
                      cornerRadius={6}
                      dataKey="value"
                      stroke="none"
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(-1)}
                    >
                      {chartData.map((entry, index) => {
                        const isHovered = activeIndex === index;
                        const isAnyHovered = activeIndex !== -1;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                            opacity={isHovered ? 1 : isAnyHovered ? 0.4 : 0.9}
                            style={{
                              transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                              outline: 'none',
                              cursor: 'pointer',
                            }}
                          />
                        );
                      })}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Hover/Summary Display */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 24px',
                }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: 'var(--text-dim)',
                    marginBottom: 4,
                    maxWidth: 160,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {activeIndex === -1 
                      ? 'Inversión Total' 
                      : (chartData[activeIndex].name.length > 20 
                          ? chartData[activeIndex].name.substring(0, 17) + '...' 
                          : chartData[activeIndex].name)}
                  </span>
                  <span style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: 'var(--text-main)',
                    textShadow: '0 0 12px rgba(255, 255, 255, 0.15)',
                  }}>
                    {activeIndex === -1
                      ? `$${Math.round(totalSpend).toLocaleString('es-MX')}`
                      : `$${Math.round(chartData[activeIndex].value).toLocaleString('es-MX')}`
                    }
                  </span>
                  {activeIndex !== -1 && (
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--green)',
                      marginTop: 2,
                    }}>
                      {((chartData[activeIndex].value / totalSpend) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Right Column: Custom Scrollable Legend List */}
              <div style={{
                flex: '1 1 200px',
                minWidth: 180,
                maxHeight: 260,
                overflowY: 'auto',
                paddingRight: 8,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {chartData.map((item, index) => {
                    const share = totalSpend > 0 ? ((item.value / totalSpend) * 100).toFixed(1) : 0;
                    const color = COLORS[index % COLORS.length];
                    const isHovered = activeIndex === index;
                    return (
                      <div
                        key={index}
                        onMouseEnter={() => setActiveIndex(index)}
                        onMouseLeave={() => setActiveIndex(-1)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: isHovered ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                          border: isHovered ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid transparent',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: color,
                              flexShrink: 0,
                              boxShadow: `0 0 8px ${color}`,
                            }}
                          />
                          <span
                            title={item.name}
                            style={{
                              fontSize: 12,
                              color: isHovered ? 'var(--text-main)' : 'var(--text-muted)',
                              fontWeight: isHovered ? 600 : 500,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.name}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: isHovered ? 'var(--green)' : 'var(--text-dim)',
                            marginLeft: 12,
                            flexShrink: 0,
                          }}
                        >
                          {share}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, color: 'var(--text-dim)', fontSize: 13 }}>
              Sin datos de campañas
            </div>
          )}
        </motion.div>

        {/* KPI Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--gap-bento)' }}>
          <KpiCard
            label="Ad Spend (Inversión Total Ejecutada)"
            value={inv.total_spend || 0}
            sub="Registrado en bases financieras"
            color="gold"
            prefix="$"
            delay={0.05}
            onClick={() => setModal({ open: true, label: 'Ad Spend (Inversión Total Ejecutada)', value: `$${(inv.total_spend || 0).toLocaleString()}` })}
          />
          <KpiCard
            label="Active Campaigns (Campañas Activas Modeladas)"
            value={inv.campaign_count || campaigns.length || 0}
            sub="Modeladas por el motor de atribución"
            color="blue"
            delay={0.1}
            onClick={() => setModal({ open: true, label: 'Active Campaigns (Campañas Activas Modeladas)', value: String(inv.campaign_count || campaigns.length || 0) })}
          />
        </div>
      </div>

      {/* Campaign Table */}
      {campaigns.length > 0 && (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{ marginTop: 'var(--gap-bento)' }}
        >
          <div className="section-header" style={{ marginBottom: 12 }}>
            <div className="section-title">
              <span className="bar" />
              Campaign Breakdown (Desglose Detallado de Campañas)
            </div>
          </div>
          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Campaña</th>
                  <th style={{ textAlign: 'right' }}>Presupuesto Invertido</th>
                  <th style={{ textAlign: 'right' }}>Participación en Gasto</th>
                  <th style={{ textAlign: 'right' }}>Total Leads</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{c.name || c.campaign || '—'}</td>
                    <td style={{ textAlign: 'right' }}>${parseFloat(c.spend || 0).toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{c.share_pct || c.share || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{c.leads || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Explanation Modal */}
      <KpiModal
        isOpen={modal.open}
        label={modal.label}
        value={modal.value}
        onClose={() => setModal({ open: false, label: '', value: '' })}
      />
    </>
  );
}
