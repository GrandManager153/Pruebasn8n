import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import useDashboardStore from '../../stores/useDashboardStore';
import KpiCard from '../shared/KpiCard';

const COLORS = ['#3b82f6', '#10b981', '#e0992a', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899', '#fbbf24'];

export default function InvestmentPage() {
  const { data, loading } = useDashboardStore();

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

  const pieData = useMemo(() => {
    return campaigns.map((c) => ({
      name: c.name || c.campaign || 'Sin nombre',
      value: parseFloat(c.spend || c.amount || 0),
    })).filter((d) => d.value > 0);
  }, [campaigns]);

  const tooltipStyle = {
    contentStyle: {
      background: 'rgba(13,20,35,0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      fontSize: 12,
      color: '#f8fafc',
    },
  };

  return (
    <>
      <div className="section-header">
        <div className="section-title">
          <span className="bar" />
          Presupuesto Publicitario y Distribución
        </div>
      </div>

      <div className="grid-2-1">
        {/* Pie Chart */}
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="chart-title">
            <span className="dot" style={{ background: 'var(--green)' }} />
            Distribución del Gasto por Campaña
          </div>
          <div className="chart-wrapper" style={{ height: 320 }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(val) => `$${val.toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 13 }}>
                Sin datos de campañas
              </div>
            )}
          </div>
        </motion.div>

        {/* KPI Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--gap-bento)' }}>
          <KpiCard
            label="Inversión Total Ejecutada"
            value={inv.total_spend || 0}
            sub="Registrado en bases financieras"
            color="gold"
            prefix="$"
            delay={0.05}
          />
          <KpiCard
            label="Campañas Activas Modeladas"
            value={inv.campaign_count || campaigns.length || 0}
            sub="Modeladas por el motor de atribución"
            color="blue"
            delay={0.1}
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
              Desglose Detallado de Campañas
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
    </>
  );
}
