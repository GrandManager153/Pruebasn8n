// =====================================================================
// ⚡ SleekAPI - Servidor API Local (Node.js/Express)
//    Versión 2.0 - Backend limpio, persistencia en disco, autenticación
// =====================================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// === API Key para proteger el webhook (opcional) ===
// Puedes establecer un token aquí o dejarlo vacío para desactivar la autenticación
const API_SECRET = process.env.API_SECRET || '';

// === Carpeta de datos persistentes ===
const DATA_DIR = path.join(__dirname, 'data');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');
const LOGS_FILE = path.join(DATA_DIR, 'request_logs.json');

// Crear directorios si no existen
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

// === Estado de la API en memoria ===
const stats = {
  startedAt: new Date(),
  totalRequests: 0,
  webhookCalls: 0,
  successRequests: 0,
  errorRequests: 0,
  reportsStored: 0
};

// Historial de peticiones entrantes
let requestLogs = [];
const MAX_LOGS = 50;

// Almacenamiento en memoria para los reportes HTML compilados
const activeReports = {
  executive: null,
  manager: null,
  analyst: null,
  operations: null
};

// === Cargar datos persistidos al iniciar ===
function loadPersistedData() {
  // Cargar logs guardados
  try {
    if (fs.existsSync(LOGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
      requestLogs = data.slice(0, MAX_LOGS);
      console.log(`  📋 ${requestLogs.length} logs restaurados desde disco`);
    }
  } catch (err) {
    console.log('  ⚠️ No se pudieron cargar logs previos:', err.message);
  }

  // Cargar reportes guardados
  const audiences = ['executive', 'manager', 'analyst', 'operations'];
  audiences.forEach(audience => {
    const reportPath = path.join(REPORTS_DIR, `reporte_${audience}.html`);
    try {
      if (fs.existsSync(reportPath)) {
        activeReports[audience] = fs.readFileSync(reportPath, 'utf-8');
        stats.reportsStored++;
        console.log(`  📊 Reporte "${audience}" restaurado desde disco`);
      }
    } catch (err) {
      console.log(`  ⚠️ No se pudo cargar reporte ${audience}:`, err.message);
    }
  });
}

// === Guardar logs a disco ===
function persistLogs() {
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(requestLogs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error guardando logs:', err.message);
  }
}

// === Guardar reporte a disco ===
function persistReport(audience, htmlContent) {
  try {
    const reportPath = path.join(REPORTS_DIR, `reporte_${audience}.html`);
    fs.writeFileSync(reportPath, htmlContent, 'utf-8');
    console.log(`  💾 Reporte "${audience}" guardado en disco: ${reportPath}`);
  } catch (err) {
    console.error(`Error guardando reporte ${audience}:`, err.message);
  }
}

// =====================================================================
//  MIDDLEWARE
// =====================================================================

// CORS y parseadores
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Servir archivos estáticos desde /public
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de logging (excluye rutas internas del dashboard)
app.use((req, res, next) => {
  const excludedPaths = ['/', '/api/logs', '/api/status', '/api/clear-logs'];
  if (excludedPaths.includes(req.path) || req.path.startsWith('/css') || req.path.startsWith('/js')) {
    return next();
  }

  stats.totalRequests++;

  const logEntry = {
    id: stats.totalRequests,
    timestamp: new Date().toLocaleTimeString(),
    fullTimestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    headers: req.headers,
    query: req.query,
    body: req.body,
    ip: req.ip || req.connection?.remoteAddress || 'unknown'
  };

  requestLogs.unshift(logEntry);
  if (requestLogs.length > MAX_LOGS) {
    requestLogs.pop();
  }

  // Persistir logs cada vez que llega una petición nueva
  persistLogs();

  console.log(`[${logEntry.timestamp}] 📥 Petición #${stats.totalRequests}: ${req.method} ${req.path}`);
  next();
});

// =====================================================================
//  API ENDPOINTS
// =====================================================================

// Estado de la API (JSON)
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    uptimeSeconds: Math.floor((new Date() - stats.startedAt) / 1000),
    stats: {
      ...stats,
      startedAt: stats.startedAt.toISOString()
    },
    config: {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      authEnabled: !!API_SECRET,
      persistenceEnabled: true
    }
  });
});

// Obtener logs en JSON
app.get('/api/logs', (req, res) => {
  res.json(requestLogs);
});

// Limpiar logs
app.post('/api/clear-logs', (req, res) => {
  requestLogs.length = 0;
  persistLogs();
  res.json({ success: true, message: 'Logs limpiados con éxito.' });
});

// Dynamic Theme injection script helper for served HTML reports
function injectTheme(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') return htmlContent;
  
  const themeScript = `
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const savedTheme = localStorage.getItem('theme') || 'dark';
      const style = document.createElement('style');
      if (savedTheme === 'dark') {
        style.innerHTML = \`
          :root {
            --bg: #080c14 !important;
            --c: linear-gradient(135deg, rgba(13, 20, 35, 0.8), rgba(7, 10, 17, 0.9)) !important;
            --t: #f8fafc !important;
            --m: #94a3b8 !important;
            --b: rgba(255, 255, 255, 0.05) !important;
            --p: #05080f !important;
            --a: #38bdf8 !important;
            --l: rgba(56, 189, 248, 0.1) !important;
            --s: inset 0 1px 1px rgba(255, 255, 255, 0.05), 0 8px 32px rgba(0, 0, 0, 0.5) !important;
            --sh: inset 0 1px 2px rgba(255, 255, 255, 0.1), 0 16px 36px rgba(0, 0, 0, 0.6) !important;
          }
          body {
            background-color: #080c14 !important;
            color: #f8fafc !important;
          }
          .hero {
            background: linear-gradient(135deg, rgba(13, 20, 35, 0.9), rgba(7, 10, 17, 0.95)) !important;
            border: 1px solid rgba(163, 230, 53, 0.2) !important;
          }
          .hero h1, .hero .sub, .hero-top {
            color: #fff !important;
          }
          .tabs {
            background: rgba(13, 20, 35, 0.8) !important;
            border: 1px solid rgba(255, 255, 255, 0.05) !important;
          }
          .tab {
            color: #94a3b8 !important;
          }
          .tab.active {
            background: #a3e635 !important;
            color: #080c14 !important;
          }
          .kpi {
            background: rgba(13, 20, 35, 0.8) !important;
            border: 1px solid rgba(255, 255, 255, 0.05) !important;
          }
          .kpi-value {
            color: #38bdf8 !important;
          }
          .content-block {
            background: rgba(13, 20, 35, 0.8) !important;
            border: 1px solid rgba(255, 255, 255, 0.05) !important;
            color: #f8fafc !important;
          }
          .content-block p, .content-block li, .content-block strong {
            color: #f8fafc !important;
          }
          .content-block strong {
            color: #a3e635 !important;
          }
          .content-block td {
            border-bottom: 1px solid rgba(255, 255, 255, 0.03) !important;
            color: #f8fafc !important;
          }
          .content-block tr:nth-child(even) td {
            background: rgba(255, 255, 255, 0.01) !important;
          }
          .action-card {
            background: rgba(13, 20, 35, 0.8) !important;
            border: 1px solid rgba(255, 255, 255, 0.05) !important;
            color: #f8fafc !important;
          }
          .action-text {
            color: #f8fafc !important;
          }
          .action-num {
            background: #38bdf8 !important;
          }
          .alert-card {
            border: 1px solid rgba(255, 255, 255, 0.05) !important;
          }
          .alert-title {
            color: #f8fafc !important;
          }
          .info-section {
            border: 1px solid rgba(255, 255, 255, 0.05) !important;
          }
          .info-header {
            background: rgba(13, 20, 35, 0.8) !important;
            color: #94a3b8 !important;
          }
          .info-header:hover {
            background: rgba(255, 255, 255, 0.03) !important;
          }
          .info-item {
            border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
            color: #f8fafc !important;
          }
        \`;
      } else {
        style.innerHTML = \`
          :root {
            --bg: #f8fafc !important;
            --c: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(241, 245, 249, 0.95)) !important;
            --t: #0f172a !important;
            --m: #475569 !important;
            --b: rgba(15, 23, 42, 0.08) !important;
            --p: #0284c7 !important;
            --a: #0284c7 !important;
            --l: rgba(2, 132, 199, 0.08) !important;
            --s: 0 8px 32px rgba(15, 23, 42, 0.05), inset 0 1px 1px rgba(255, 255, 255, 0.8) !important;
            --sh: 0 16px 36px rgba(15, 23, 42, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.8) !important;
          }
          body {
            background-color: #f8fafc !important;
            color: #0f172a !important;
          }
          .hero {
            background: linear-gradient(135deg, #0284c7, #84cc16) !important;
            border: 1px solid rgba(132, 204, 22, 0.22) !important;
            color: #fff !important;
          }
          .hero h1, .hero .sub, .hero-top {
            color: #fff !important;
          }
          .tabs {
            background: rgba(255, 255, 255, 0.85) !important;
            border: 1px solid rgba(15, 23, 42, 0.08) !important;
          }
          .tab {
            color: #475569 !important;
          }
          .tab.active {
            background: #0284c7 !important;
            color: #fff !important;
          }
          .kpi {
            background: rgba(255, 255, 255, 0.85) !important;
            border: 1px solid rgba(15, 23, 42, 0.08) !important;
          }
          .kpi-value {
            color: #0284c7 !important;
          }
          .content-block {
            background: rgba(255, 255, 255, 0.85) !important;
            border: 1px solid rgba(15, 23, 42, 0.08) !important;
            color: #0f172a !important;
          }
          .content-block p, .content-block li, .content-block strong {
            color: #0f172a !important;
          }
          .content-block strong {
            color: #0284c7 !important;
          }
          .content-block td {
            border-bottom: 1px solid rgba(15, 23, 42, 0.04) !important;
            color: #0f172a !important;
          }
          .content-block tr:nth-child(even) td {
            background: rgba(15, 23, 42, 0.01) !important;
          }
          .action-card {
            background: rgba(255, 255, 255, 0.85) !important;
            border: 1px solid rgba(15, 23, 42, 0.08) !important;
            color: #0f172a !important;
          }
          .action-text {
            color: #0f172a !important;
          }
          .action-num {
            background: #0284c7 !important;
          }
          .alert-card {
            border: 1px solid rgba(15, 23, 42, 0.08) !important;
          }
          .alert-title {
            color: #0f172a !important;
          }
          .info-section {
            border: 1px solid rgba(15, 23, 42, 0.08) !important;
          }
          .info-header {
            background: rgba(255, 255, 255, 0.85) !important;
            color: #475569 !important;
          }
          .info-header:hover {
            background: rgba(15, 23, 42, 0.02) !important;
          }
          .info-item {
            border-top: 1px solid rgba(15, 23, 42, 0.08) !important;
            color: #0f172a !important;
          }
        \`;
      }
      document.head.appendChild(style);
    });
  </script>
  `;
  return htmlContent.replace('</body>', `${themeScript}</body>`);
}

// Servir reportes HTML interactivos
app.get('/reports/:audience', (req, res) => {
  const audience = req.params.audience;
  const reportPath = path.join(REPORTS_DIR, `reporte_${audience}.html`);
  
  // Read dynamically from disk so manual modifications are instantly visible without restart
  if (fs.existsSync(reportPath)) {
    try {
      const htmlContent = fs.readFileSync(reportPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(injectTheme(htmlContent));
    } catch (err) {
      console.log(`⚠️ Error leyendo reporte ${audience} desde disco:`, err.message);
    }
  }

  if (activeReports[audience]) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(injectTheme(activeReports[audience]));
  } else {
    res.status(404).send(`
      <div style="font-family: 'Plus Jakarta Sans', 'Segoe UI', sans-serif; text-align: center; padding: 60px; background: #050409; color: #ffffff; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <h1 style="color: #ef4444; font-size: 32px; margin-bottom: 16px;">🔬 Reporte No Disponible</h1>
        <p style="color: #94a3b8; font-size: 16px; max-width: 500px; margin-bottom: 24px; line-height: 1.6;">
          El reporte interactivo para la audiencia <strong>"${audience}"</strong> aún no ha sido recibido desde n8n.
        </p>
        <p style="color: #64748b; font-size: 14px; margin-bottom: 30px;">
          Ejecuta el flujo de n8n primero para que las narrativas de IA se transfieran a este servidor.
        </p>
        <a href="/" style="background: linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);">
          Volver al Panel de Control
        </a>
      </div>
    `);
  }
});

// Listar reportes disponibles
app.get('/api/reports', (req, res) => {
  const available = {};
  for (const [audience, content] of Object.entries(activeReports)) {
    available[audience] = {
      available: !!content,
      url: content ? `/reports/${audience}` : null,
      savedToDisk: fs.existsSync(path.join(REPORTS_DIR, `reporte_${audience}.html`))
    };
  }
  res.json({ reports: available });
});

// Endpoint: Datos del Dashboard (JSON desde n8n)
app.get('/api/dashboard', (req, res) => {
  const payloadPath = path.join(DATA_DIR, 'dashboard_payload.json');
  try {
    if (fs.existsSync(payloadPath)) {
      const data = JSON.parse(fs.readFileSync(payloadPath, 'utf-8'));
      res.json({ success: true, data });
    } else {
      res.status(404).json({ success: false, message: 'No hay datos de dashboard disponibles aún. Ejecuta el workflow de n8n.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================================
//  WEBHOOK ENDPOINT (recibe datos de n8n)
// =====================================================================

app.post('/api/webhook', (req, res) => {
  // Autenticación opcional
  if (API_SECRET) {
    const token = req.headers['x-api-key'] || req.query.token;
    if (token !== API_SECRET) {
      stats.errorRequests++;
      return res.status(401).json({
        success: false,
        error: 'No autorizado. Incluye un header X-Api-Key válido.'
      });
    }
  }

  stats.webhookCalls++;
  stats.successRequests++;

  const receivedData = req.body;
  console.log(`[Webhook] 🔔 Evento #${stats.webhookCalls} recibido con éxito`);

  // Extraer y guardar reportes HTML de las narrativas en memoria + disco
  if (receivedData && Array.isArray(receivedData.tree)) {
    receivedData.tree.forEach(file => {
      if (file.path && file.content) {
        // Guardar dashboard_payload.json
        if (file.path.includes('dashboard_payload.json')) {
          try {
            const payloadPath = path.join(DATA_DIR, 'dashboard_payload.json');
            fs.writeFileSync(payloadPath, file.content, 'utf-8');
            console.log(`  📊 Dashboard payload guardado en disco (${file.content.length} bytes)`);
          } catch (err) {
            console.error('Error guardando dashboard payload:', err.message);
          }
        }

        // Guardar reportes HTML
        const reportMappings = {
          'reporte_executive.html': 'executive',
          'reporte_manager.html': 'manager',
          'reporte_analyst.html': 'analyst',
          'reporte_operations.html': 'operations'
        };

        for (const [filename, audience] of Object.entries(reportMappings)) {
          if (file.path.includes(filename)) {
            activeReports[audience] = file.content;
            persistReport(audience, file.content);
            stats.reportsStored = Object.values(activeReports).filter(r => r !== null).length;
            console.log(`  📊 Reporte "${audience}" guardado (memoria + disco)`);
          }
        }
      }
    });
  }

  // Respuesta estructurada
  res.status(200).json({
    success: true,
    message: 'Evento webhook procesado correctamente',
    timestamp: new Date().toISOString(),
    event_id: 'evt_' + Math.random().toString(36).substr(2, 9),
    data_received: typeof receivedData === 'object' ? { keys: Object.keys(receivedData), size: JSON.stringify(receivedData).length } : 'raw',
    server_stats: {
      total_handled: stats.totalRequests,
      webhook_calls: stats.webhookCalls,
      reports_stored: stats.reportsStored
    }
  });
});

// =====================================================================
//  ARRANQUE DEL SERVIDOR
// =====================================================================

app.listen(PORT, () => {
  console.log('');
  console.log('======================================================');
  console.log(' ⚡ SLEEKAPI v2.0 - SERVIDOR INICIADO');
  console.log('======================================================');
  console.log(`  🚀 Panel de Control: http://localhost:${PORT}`);
  console.log(`  📡 Endpoint Webhook: http://localhost:${PORT}/api/webhook`);
  console.log(`  📊 Reportes de IA:   http://localhost:${PORT}/reports/{audience}`);
  console.log(`  🔐 Autenticación:    ${API_SECRET ? 'ACTIVA' : 'DESACTIVADA'}`);
  console.log(`  💾 Persistencia:     ${DATA_DIR}`);
  console.log('------------------------------------------------------');

  // Cargar datos persistidos
  loadPersistedData();

  console.log('------------------------------------------------------');
  console.log('  ✅ Servidor listo para recibir peticiones');
  console.log('======================================================');
  console.log('');
});
