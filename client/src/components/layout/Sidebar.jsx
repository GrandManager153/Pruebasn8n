import { NavLink } from 'react-router-dom';

const navItems = [
  { label: 'Métricas y Resúmenes', type: 'header' },
  { path: '/', label: 'Resumen General', tab: 'dashboard' },
  { path: '/funnel', label: 'Funnel y Conversiones', tab: 'funnel' },
  { path: '/forecast', label: 'Pronósticos', tab: 'forecast' },
  { path: '/investment', label: 'Inversión y Campañas', tab: 'investment' },
  { path: '/operations', label: 'Operaciones Diarias', tab: 'operations' },
  { path: '/alerts', label: 'Alertas de Operación', tab: 'alerts' },
  { label: 'Informes Operativos', type: 'header' },
  { path: '/reports', label: 'Informes Corporativos', tab: 'reports' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-text">
          <h1>PulseMkt</h1>
          <p>Inteligencia de Marketing</p>
        </div>
      </div>

      <div className="sidebar-menu-wrapper">
        <div style={{ width: '100%' }}>
          {navItems.map((item, i) =>
            item.type === 'header' ? (
              <div
                className="menu-header"
                key={`header-${i}`}
                style={i > 0 ? { marginTop: 24 } : undefined}
              >
                {item.label}
              </div>
            ) : (
              <NavLink
                key={item.tab}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `nav-item${isActive ? ' active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            )
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <p>PulseMkt v7.2 — React</p>
        <a
          href="#"
          style={{
            fontSize: 10,
            opacity: 0.7,
            color: 'var(--text-muted)',
            textDecoration: 'none',
          }}
        >
          Términos y Privacidad
        </a>
      </div>
    </aside>
  );
}
