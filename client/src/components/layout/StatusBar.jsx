import useDashboardStore from '../../stores/useDashboardStore';

export default function StatusBar() {
  const { data, loading, error } = useDashboardStore();

  let message = 'Auditoría del BOS en curso...';
  let color = 'var(--green)';

  if (error) {
    message = `Error de conexión: ${error}`;
    color = 'var(--red)';
  } else if (loading) {
    message = 'Cargando datos analíticos del BOS...';
  } else if (data?.system) {
    const score = data.system.health_score;
    if (score >= 80) message = `Sistema operando con salud óptima — Score: ${score}/100`;
    else if (score >= 60) message = `Sistema bajo presión — Score: ${score}/100`;
    else message = `Alerta: sistema en estado crítico — Score: ${score}/100`;
    color = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)';
  }

  return (
    <div
      className="sbar"
      style={{
        color,
      }}
    >
      <span
        className="sdot"
        style={{ background: color, boxShadow: `0 0 8px ${color}`, marginBottom: 12 }}
      />
      <span>{message}</span>
    </div>
  );
}
