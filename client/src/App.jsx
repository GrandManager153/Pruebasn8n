import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import useDashboardStore from './stores/useDashboardStore';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import StatusBar from './components/layout/StatusBar';
import DashboardPage from './pages/DashboardPage';
import FunnelPage from './pages/FunnelPage';
import ForecastPage from './pages/ForecastPage';
import InvestmentPage from './pages/InvestmentPage';
import OperationsPage from './pages/OperationsPage';
import AlertsPage from './pages/AlertsPage';
import ReportsPage from './pages/ReportsPage';

/** Map route paths to page titles */
const TITLES = {
  '/': 'Resumen General',
  '/funnel': 'Funnel y Conversiones',
  '/forecast': 'Pronósticos',
  '/investment': 'Inversión y Campañas',
  '/operations': 'Operaciones Diarias',
  '/alerts': 'Alertas de Operación',
  '/reports': 'Informes Corporativos',
};

function AppLayout() {
  const location = useLocation();
  const title = TITLES[location.pathname] || 'BOS Panel';
  const { fetchDashboard, theme, lastUpdate } = useDashboardStore();

  // Apply saved theme on mount
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    }
  }, []);

  // Fetch data on mount & set up auto-refresh
  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60_000); // auto-refresh every 60s
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  // Mouse flashlight effect
  useEffect(() => {
    const handleMouse = (e) => {
      document.documentElement.style.setProperty('--mouse-x', e.clientX + 'px');
      document.documentElement.style.setProperty('--mouse-y', e.clientY + 'px');
    };
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);

  return (
    <>
      {/* Ambient background */}
      <div className="ambient-nebula nebula-gold" />
      <div className="ambient-nebula nebula-crimson" />
      <div className="global-flashlight" />

      {/* Wave background */}
      <div className="wave-bg-container">
        <div className="wave-layer wave-1">
          <svg viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path d="M0,160 C180,220 360,100 540,160 C720,220 900,100 1080,160 C1260,220 1440,100 1440,160 L1440,320 L0,320 Z" />
          </svg>
        </div>
        <div className="wave-layer wave-2">
          <svg viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path d="M0,200 C160,260 320,140 480,200 C640,260 800,140 960,200 C1120,260 1280,140 1440,200 L1440,320 L0,320 Z" />
          </svg>
        </div>
        <div className="wave-layer wave-3">
          <svg viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path d="M0,180 C200,240 400,120 600,180 C800,240 1000,120 1200,180 C1400,240 1440,180 1440,180 L1440,320 L0,320 Z" />
          </svg>
        </div>
        <div className="wave-layer wave-4">
          <svg viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path d="M0,220 C140,280 280,160 420,220 C560,280 700,160 840,220 C980,280 1120,160 1260,220 C1400,280 1440,220 1440,220 L1440,320 L0,320 Z" />
          </svg>
        </div>
      </div>

      {/* App Shell */}
      <div className="app-container">
        <Sidebar />
        <main className="workspace">
          <Topbar title={title} />
          <StatusBar />

          {/* Last Update */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, marginRight: 8 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
              {lastUpdate
                ? `Última actualización: ${lastUpdate.toLocaleTimeString('es-MX')}`
                : 'Cargando...'}
            </div>
          </div>

          {/* Page Routes */}
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/funnel" element={<FunnelPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/investment" element={<InvestmentPage />} />
            <Route path="/operations" element={<OperationsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Routes>
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
