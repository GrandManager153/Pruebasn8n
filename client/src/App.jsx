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

  // Listen to message events from report iframe to sync theme
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data === 'theme-light') {
        useDashboardStore.getState().setTheme('light');
      } else if (e.data === 'theme-dark') {
        useDashboardStore.getState().setTheme('dark');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Post theme updates to the iframe when the theme changes
  useEffect(() => {
    const iframe = document.getElementById('report-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(theme === 'light' ? 'theme-light' : 'theme-dark', '*');
    }
  }, [theme]);

  // Fetch data on mount & set up auto-refresh
  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60_000); // auto-refresh every 60s
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  return (
    <>
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
