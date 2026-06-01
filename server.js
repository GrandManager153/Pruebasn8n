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

// Inyecta el design system BOS en reportes HTML generados por n8n
function injectTheme(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') return htmlContent;

  // Eliminar estilos y script embebidos de n8n
  let output = htmlContent
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script>\s*function showTab[\s\S]*?<\/script>/gi, '');

  const headAssets = `
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/reports.css?v=4">
  `;

  const bodyScripts = `
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
    <script src="/js/reports.js?v=4"></script>`;

  const ambientBg = `
    <div class="report-ambient" aria-hidden="true">
      <div class="report-nebula report-nebula-a"></div>
      <div class="report-nebula report-nebula-b"></div>
    </div>
    <div class="report-waves" aria-hidden="true">
      <svg class="wave-a" viewBox="0 0 1440 320" preserveAspectRatio="none"><path d="M0,160 C180,220 360,100 540,160 C720,220 900,100 1080,160 C1260,220 1440,100 1440,160 L1440,320 L0,320 Z"/></svg>
      <svg class="wave-b" viewBox="0 0 1440 320" preserveAspectRatio="none"><path d="M0,200 C160,260 320,140 480,200 C640,260 800,140 960,200 C1120,260 1280,140 1440,200 L1440,320 L0,320 Z"/></svg>
    </div>
  `;

  if (output.includes('</head>')) {
    output = output.replace('</head>', `${headAssets}</head>`);
  }

  if (output.includes('<body>')) {
    output = output.replace(
      '<body>',
      `<body>${ambientBg}<div class="report-back-bar"><a class="report-back-btn" href="/">← Volver al BOS Panel</a></div>`
    );
  } else if (output.includes('<body ')) {
    output = output.replace(/<body([^>]*)>/, `<body$1>${ambientBg}<div class="report-back-bar"><a class="report-back-btn" href="/">← Volver al BOS Panel</a></div>`);
  }

  if (output.includes('</body>')) {
    output = output.replace('</body>', `${bodyScripts}</body>`);
  }

  return output;
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
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.send(injectTheme(htmlContent));
    } catch (err) {
      console.log(`⚠️ Error leyendo reporte ${audience} desde disco:`, err.message);
    }
  }

  if (activeReports[audience]) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
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
