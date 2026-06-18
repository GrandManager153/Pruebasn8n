import useDashboardStore from '../../stores/useDashboardStore';

export default function Topbar({ title }) {
  const { syncing, theme, toggleTheme, fetchDashboard } = useDashboardStore();

  const handleSync = async () => {
    await fetchDashboard();
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h2>{title}</h2>
      </div>
      <div className="topbar-right">
        {/* Sync Button */}
        <button
          className="theme-toggle-btn"
          onClick={handleSync}
          title="Sincronizar Datos al Instante"
        >
          <svg
            viewBox="0 0 24 24"
            style={{
              width: 18,
              height: 18,
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 2,
              transition: 'transform 1s ease',
              transform: syncing ? 'rotate(360deg)' : 'rotate(0deg)',
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
        </button>

        {/* Theme Toggle */}
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title="Alternar Modo Claro / Oscuro"
        >
          <svg
            viewBox="0 0 24 24"
            style={{
              width: 18,
              height: 18,
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 2,
              transition: 'transform 0.5s ease',
              transform: theme === 'light' ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            {theme === 'dark' ? (
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            ) : (
              <circle cx="12" cy="12" r="5" />
            )}
          </svg>
        </button>

        {/* Status Pill */}
        <div className="status-pill">
          <div className="pulse-dot" />
          Manuel Solis
        </div>
      </div>
    </header>
  );
}
