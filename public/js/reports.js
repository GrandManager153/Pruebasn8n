/* =====================================================================
   BOS Panel — Motor de Informes LaTeX (n8n)
   Optimized for High-Contrast Static Print & Academic PDF Layout
   ===================================================================== */

(function () {
    'use strict';

    let kpiChart = null;
    let alertsChart = null;

    // ── Standalone Theme Management ──
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
        }
    }

    function initTheme() {
        const cached = localStorage.getItem('theme') || 'dark';
        applyTheme(cached);
        if (window.parent !== window) {
            document.body.classList.add('embedded');
        }
        
        // Listen for parent messages if embedded inside iframe
        window.addEventListener('message', (e) => {
            if (e.data === 'theme-light' || e.data === 'theme-dark') {
                const targetTheme = e.data === 'theme-light' ? 'light' : 'dark';
                localStorage.setItem('theme', targetTheme);
                applyTheme(targetTheme);
                updateToggleIcon();
            }
        });
        
        // Handle standalone report theme toggle click if clicked
        const reportToggle = document.getElementById('report-theme-toggle');
        if (reportToggle) {
            reportToggle.addEventListener('click', (event) => {
                triggerRippleReveal(event);
            });
            updateToggleIcon();
        }
    }

    function triggerRippleReveal(event) {
        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;
        if (event && event.clientX !== undefined && event.clientY !== undefined) {
            x = event.clientX;
            y = event.clientY;
        }
        
        // Create academic wave transition
        const ripple = document.createElement('div');
        ripple.className = 'theme-ripple';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        ripple.style.backgroundColor = '#ffffff'; // Always white
        document.body.appendChild(ripple);
        
        setTimeout(() => {
            applyTheme('light');
            updateToggleIcon();
            if (window.parent !== window) {
                // Post message back to parent to sync parent dashboard theme too!
                const parentTheme = localStorage.getItem('theme') === 'light' ? 'dark' : 'light';
                localStorage.setItem('theme', parentTheme);
                window.parent.postMessage(parentTheme === 'light' ? 'theme-light' : 'theme-dark', '*');
            } else {
                const current = localStorage.getItem('theme') || 'dark';
                localStorage.setItem('theme', current === 'light' ? 'dark' : 'light');
            }
            renderAllCharts();
        }, 300);
        
        setTimeout(() => {
            ripple.remove();
        }, 700);
    }

    function updateToggleIcon() {
        const toggle = document.getElementById('report-theme-toggle');
        if (!toggle) return;
        const currentTheme = localStorage.getItem('theme') || 'dark';
        if (currentTheme === 'light') {
            toggle.innerHTML = `
                <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2;">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                </svg>
            `;
        } else {
            toggle.innerHTML = `
                <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2;">
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                </svg>
            `;
        }
    }

    // ── Academic Greyscale Chart Colors ──
    function chartColors() {
        return {
            text: '#111111',
            grid: '#e5e5e5',
            lineColor: '#000000',
            barBg: 'rgba(0, 0, 0, 0.08)',
            barBorder: '#000000',
            tooltipBg: '#ffffff',
            tooltipBorder: '#111111'
        };
    }

    // ── Contadores animados (Sincronizado y suave) ──
    function animateValue(element, start, end, duration, options = {}) {
        if (!element) return;
        const { prefix = '', suffix = '', decimals = 0, useSeparator = false, isTime = false } = options;
        let startTimestamp = null;

        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeProgress = progress * (2 - progress);
            const currentVal = easeProgress * (end - start) + start;

            if (isTime) {
                const totalMinutes = Math.floor(currentVal);
                const hrs = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
                const mins = (totalMinutes % 60).toString().padStart(2, '0');
                element.textContent = `${prefix}${hrs}:${mins}${suffix}`;
            } else {
                let formatted = currentVal.toFixed(decimals);
                if (useSeparator) {
                    const parts = formatted.split('.');
                    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                    formatted = parts.join('.');
                }
                element.textContent = `${prefix}${formatted}${suffix}`;
            }

            if (progress < 1) {
                requestAnimationFrame(step);
            } else if (isTime) {
                const totalMinutes = Math.floor(end);
                const hrs = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
                const mins = (totalMinutes % 60).toString().padStart(2, '0');
                element.textContent = `${prefix}${hrs}:${mins}${suffix}`;
            } else {
                let finalFormatted = end.toFixed(decimals);
                if (useSeparator) {
                    const parts = finalFormatted.split('.');
                    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                    finalFormatted = parts.join('.');
                }
                element.textContent = `${prefix}${finalFormatted}${suffix}`;
            }
        };
        requestAnimationFrame(step);
    }

    function parseAndAnimate(element, rawValue, duration = 650) {
        if (!element) return;
        const valueStr = String(rawValue).trim();

        if (valueStr.includes(':') && !valueStr.includes('$')) {
            const parts = valueStr.split(':');
            animateValue(element, 0, (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0), duration, { isTime: true });
            return;
        }

        const stripped = valueStr.replace(/[$\s%,~]/g, '');

        if (stripped.includes('/')) {
            const [cur, max] = stripped.split('/');
            animateValue(element, 0, parseFloat(cur) || 0, duration, { suffix: `/${max || 100}` });
            return;
        }

        const parsedNumber = parseFloat(stripped) || 0;
        const isCurrency = valueStr.includes('$');
        const isPercentage = valueStr.includes('%');
        const isApprox = valueStr.includes('~');
        let decimals = stripped.includes('.') ? Math.min(stripped.split('.')[1].length, 2) : 0;
        if (isCurrency && Math.abs(parsedNumber) >= 1000) decimals = 0;

        animateValue(element, 0, parsedNumber, duration, {
            prefix: isApprox ? '~' + (isCurrency ? '$' : '') : (isCurrency ? '$' : ''),
            suffix: isPercentage ? '%' : '',
            decimals,
            useSeparator: !isPercentage && (Math.abs(parsedNumber) >= 1000 || stripped.length > 4)
        });
    }

    function animateCountersIn(container) {
        if (!container) return;
        container.querySelectorAll('.kpi-value[data-value]').forEach(el => {
            parseAndAnimate(el, el.getAttribute('data-value'));
        });
    }

    // ── Tarjetas Estáticas LaTeX (Sin animaciones de rebote) ──
    function staggerCards(container) {
        if (!container) return;
        const cards = container.querySelectorAll('.card-animate');
        cards.forEach((card) => {
            card.style.opacity = '1';
            card.style.transform = 'none';
            card.classList.add('card-animate-run');
        });
    }

    // ── Dynamic LaTeX Abstract Injection (Tailored Content & n8n Data Scope) ──
    function injectLatexAbstract() {
        const hero = document.querySelector('.hero');
        if (!hero || document.querySelector('.latex-abstract')) return;
        
        const heading = hero.querySelector('h1');
        const titleText = heading ? heading.textContent.trim() : '';
        
        let targetRole = '';
        let scopeText = '';
        
        if (titleText.includes('Direccion') || titleText.includes('C-Level') || titleText.includes('Executive') || titleText.includes('Dirección')) {
            targetRole = 'Dirección Ejecutiva';
            scopeText = 'Este informe presenta un análisis financiero consolidado de alto nivel. Extrae del flujo n8n el Health Score consolidado, costo por lead (CPL implícito), volumen acumulado de leads e inversión total de campañas. Proporciona directrices estratégicas de optimización de pauta comercial y mitigación de fugas para la toma de decisiones ejecutivas.';
        } else if (titleText.includes('Supervisores') || titleText.includes('Managers') || titleText.includes('Manager') || titleText.includes('Gestión')) {
            targetRole = 'Gestión de Operaciones y Ventas';
            scopeText = 'Este documento está estructurado para la dirección de equipos y supervisores de embudo. Extrae métricas clave sobre el volumen diario de leads, tasas de avance en estados críticos (Feeders de PreClosed) y anomalías operativas. Provee un plan táctico para equilibrar la carga telefónica y optimizar la conversión semanal.';
        } else if (titleText.includes('Equipo BI') || titleText.includes('Data Science') || titleText.includes('Analyst') || titleText.includes('Estadístico')) {
            targetRole = 'Científicos de Datos y Analistas de Negocios';
            scopeText = 'Este reporte de auditoría científica detalla la robustez matemática del sistema. Contiene los coeficientes de regresión del volumen de leads ($R^2$, pendientes, interceptos), la distribución de concentración de pauta publicitaria (HHI de inversiones) y la precisión de los modelos predictivos implementados (MASE del modelo theta_lite).';
        } else {
            // Default to Operations
            targetRole = 'Operaciones y Capacidad';
            scopeText = 'Este informe técnico diagnostica la eficiencia del call center y los tiempos de respuesta. Recopila desde n8n las estadísticas detalladas de llamadas por lead, demoras promedio en intentos de contacto e índice de sobre-contacto. El fin es dotar de alertas inmediatas y acciones tácticas correctivas para evitar la saturación de leads.';
        }
        
        const abstractBlock = document.createElement('div');
        abstractBlock.className = 'latex-abstract';
        abstractBlock.innerHTML = `
            <h4>Resumen de Datos & Alcance (Abstract)</h4>
            <p>${scopeText}</p>
            <div class="meta-row">
                <span><strong>Destinatario:</strong> ${targetRole}</span>
                <span><strong>Origen de Datos:</strong> n8n Analytics Engine</span>
            </div>
        `;
        
        hero.insertAdjacentElement('afterend', abstractBlock);
    }

    // ── Preparar KPIs con data-value ──
    function prepareKpiValues() {
        document.querySelectorAll('.kpi-value').forEach(el => {
            if (!el.getAttribute('data-value')) {
                el.setAttribute('data-value', el.textContent.trim());
            }
        });
    }

    // ── Insertar contenedor de gráfica de KPI único (No Health Chart!) ──
    function injectChartContainers() {
        return; // Disabled: Pure typographic LaTeX report without charts
    }

    function injectAlertsChart() {
        return; // Disabled: Pure typographic LaTeX report without charts
    }

    function collectKpiChartData() {
        return [];
    }

    function countAlertsByType() {
        return { critical: 0, warning: 0, info: 0 };
    }

    function renderAllCharts() {
        return; // Disabled: Pure typographic LaTeX report without charts
    }

    // ── Navegación entre secciones (Tabs) ──
    window.showTab = function (id, btn) {
        const current = document.querySelector('.tc.active');
        const next = document.getElementById(id);
        if (!next || current === next) return;

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        if (btn) btn.classList.add('active');

        document.querySelectorAll('.tc').forEach(el => el.classList.remove('active', 'tc-leave', 'tc-enter'));
        next.classList.add('active');
        animateCountersIn(next);
        staggerCards(next);
        
        if (id === 'narrativa') renderAllCharts();
        if (id === 'alertas') {
            injectAlertsChart();
            renderAllCharts();
        }
    };

    // ── Dynamic Audience Filtering Helpers ──
    function getAudience() {
        const titleEl = document.querySelector('.hero h1');
        const titleText = titleEl ? titleEl.textContent.trim() : '';
        if (titleText.includes('Direccion') || titleText.includes('C-Level') || titleText.includes('Executive') || titleText.includes('Dirección')) {
            return 'executive';
        } else if (titleText.includes('Supervisores') || titleText.includes('Managers') || titleText.includes('Manager') || titleText.includes('Gestión')) {
            return 'manager';
        } else if (titleText.includes('Equipo BI') || titleText.includes('Data Science') || titleText.includes('Analyst') || titleText.includes('Estadístico')) {
            return 'analyst';
        }
        return 'operations';
    }

    function filterKpisByAudience(audience) {
        const kpis = document.querySelectorAll('.kpi-row .kpi');
        const kpiMap = {
            executive: ['SHS', 'SYSTEM HEALTH', 'HEALTH SCORE', 'TOTAL LEADS', 'LEADS TOTALES', 'WOW', 'WEEK OVER', 'CAMBIO SEMANAL', 'CPL', 'AD SPEND', 'GASTO TOTAL'],
            manager: ['TOTAL LEADS', 'LEADS TOTALES', 'DAILY AVG', 'PROMEDIO DIARIO', 'WOW', 'WEEK OVER', 'PEAK HOUR', 'HORA PICO', 'DAILY FORECAST', 'PREVISION'],
            analyst: ['TOTAL LEADS', 'LEADS TOTALES', 'DAILY AVG', 'PROMEDIO DIARIO', 'DAILY FORECAST', 'PREVISION', 'MASE', 'HHI', 'WOW', 'CPL', 'AD SPEND', 'GASTO TOTAL'],
            operations: ['SHS', 'SYSTEM HEALTH', 'HEALTH SCORE', 'DAILY AVG', 'PROMEDIO DIARIO', 'PEAK HOUR', 'HORA PICO', 'TOTAL LEADS', 'LEADS TOTALES']
        };
        const allowedKpis = kpiMap[audience] || [];
        kpis.forEach(kpi => {
            const label = kpi.querySelector('.kpi-label')?.textContent?.trim()?.toUpperCase() || '';
            const isAllowed = allowedKpis.some(allowed => label.includes(allowed));
            if (!isAllowed) {
                kpi.style.setProperty('display', 'none', 'important');
            } else {
                kpi.style.setProperty('display', 'block', 'important');
            }
        });
    }

    function filterContentByAudience(audience) {
        const contentBlock = document.querySelector('.content-block');
        if (!contentBlock) return;
        const children = Array.from(contentBlock.children);
        let hidingCurrentSection = false;
        
        const relevantSections = {
            executive: ['ESTADO GENERAL', 'QUE ESTA PASANDO', 'QUE ESTÁ PASANDO', 'DONDE SE PIERDE DINERO', 'DÓNDE SE PIERDE DINERO', 'DECISIONES RECOMENDADAS', 'CONCLUSION', 'CONCLUSIÓN'],
            manager: ['QUE CAMBIO HOY', 'LO QUE FUNCIONA BIEN', 'PROBLEMAS DEL FUNNEL', 'PLAN DEL DIA', 'PLAN DEL DÍA', 'KPIS A VIGILAR', 'ALERTA ESPECIAL'],
            analyst: ['RESUMEN DE FUENTES Y CALIDAD', 'HALLAZGOS CLAVE', 'SUPUESTOS Y LIMITACIONES', 'ALERTAS TECNICAS', 'ALERTAS TÉCNICAS', 'ANALISIS SUGERIDOS', 'ANÁLISIS SUGERIDOS', 'DATOS CLAVE EN TABLA', 'CONCLUSION', 'CONCLUSIÓN'],
            operations: ['PLAN DEL DIA', 'PLAN DEL DÍA', 'ALERTA ESPECIAL', 'PROBLEMAS DEL FUNNEL', 'ESTADO GENERAL']
        };
        const audienceSections = relevantSections[audience] || [];
        
        children.forEach(child => {
            const isHeading = child.classList?.contains('report-section-title')
                              || child.tagName === 'H2' || child.tagName === 'H3' 
                              || (child.tagName === 'P' && child.querySelector('strong:only-child'))
                              || (child.tagName === 'P' && (child.style.fontWeight === '800' || child.style.fontWeight === 'bold' || 
                               child.getAttribute('style')?.includes('font-weight:800') || child.getAttribute('style')?.includes('font-weight: 800')));
                               
            if (isHeading) {
                const headingText = child.textContent.trim().toUpperCase().replace(/[ÁÉÍÓÚ]/g, m => {
                    return {'Á':'A','É':'E','Í':'I','Ó':'O','Ú':'U'}[m];
                });
                const isRelevant = audienceSections.some(sec => headingText.includes(sec));
                hidingCurrentSection = !isRelevant;
            }
            if (hidingCurrentSection) {
                child.style.display = 'none';
            } else {
                child.style.display = '';
            }
        });
    }

    function filterAlertsAndActionsByAudience(audience) {
        const alerts = document.querySelectorAll('#alertas .alert-card');
        const actions = document.querySelectorAll('#acciones .action-card');
        const keywords = {
            executive: ['cpl', 'gasto', 'inversion', 'concentracion', 'hhi', 'sobre-contacto', 'mase', 'prevision', 'health score', 'regimen', 'cusum', 'volatilidad', 'volumen', 'saturacion', 'wip', 'capacidad', 'conversion'],
            manager: ['feeder', 'conversion', 'intentos', 'intervalo', 'llamadas', 'sobre-contacto', 'regimen', 'cusum', 'volatilidad', 'volumen', 'saturacion', 'wip', 'capacidad', 'caida'],
            analyst: ['mase', 'ensemble', 'theta_lite', 'hhi', 'regresion', 'prevision', 'sweet spot', 'diversificacion', 'cusum', 'volatilidad', 'sobre-contacto', 'cpl', 'wip'],
            operations: ['intentos', 'intervalo', 'demoras', 'sobre-contacto', 'marcacion', 'llamadas', 'saturacion', 'wip', 'capacidad', 'volatilidad', 'volumen']
        };
        const allowedKeywords = keywords[audience] || [];
        
        alerts.forEach(card => {
            const text = card.textContent.trim().toLowerCase().replace(/[áéíóú]/g, m => {
                return {'á':'a','é':'e','í':'i','ó':'o','ú':'u'}[m];
            });
            const isAllowed = allowedKeywords.some(kw => text.includes(kw));
            if (!isAllowed) {
                card.style.setProperty('display', 'none', 'important');
            } else {
                card.style.setProperty('display', 'block', 'important');
            }
        });
        actions.forEach(card => {
            const text = card.textContent.trim().toLowerCase().replace(/[áéíóú]/g, m => {
                return {'á':'a','é':'e','í':'i','ó':'o','ú':'u'}[m];
            });
            const isAllowed = allowedKeywords.some(kw => text.includes(kw));
            if (!isAllowed) {
                card.style.setProperty('display', 'none', 'important');
            } else {
                card.style.setProperty('display', 'block', 'important');
            }
        });
    }

    // ── Payload helpers: hydrate narrative gaps from dashboard_payload.json ──
    function getPayload() {
        return window.__BOS_PAYLOAD__ || null;
    }

    function escapeHtml(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normalizeText(text) {
        return String(text || '').toUpperCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function severityLabel(severity) {
        if (severity === 'critical') return 'CRITICAL';
        if (severity === 'warning') return 'WARNING';
        return 'INFO';
    }

    function severityClass(severity) {
        if (severity === 'critical') return 'sev-critical';
        if (severity === 'warning') return 'sev-warning';
        return 'sev-info';
    }

    function formatNumber(value, decimals = 2) {
        const num = Number(value);
        if (!Number.isFinite(num)) return null;
        return num.toLocaleString('es-MX', { maximumFractionDigits: decimals });
    }

    function computeDailyCV(dailyVolumes) {
        if (!Array.isArray(dailyVolumes) || dailyVolumes.length < 2) return null;
        const vals = dailyVolumes.map((row) => Number(row.leads)).filter((n) => Number.isFinite(n));
        if (vals.length < 2) return null;
        const mean = vals.reduce((sum, val) => sum + val, 0) / vals.length;
        if (!mean) return null;
        const variance = vals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / vals.length;
        return (Math.sqrt(variance) / mean) * 100;
    }

    function formatSupportValue(alert, payload) {
        if (alert.evidence) return alert.evidence;

        const ops = payload?.operations || {};
        const metric = alert.metric || '';

        if (metric === 'overcontact_pct') {
            const calls = ops.contact_distribution?.overcontact_calls;
            const pct = alert.actual ?? ops.contact_distribution?.overcontact_pct;
            if (calls != null && pct != null) {
                return `${formatNumber(calls, 0)} llamadas (${formatNumber(pct, 2)}%)`;
            }
        }

        if (metric === 'cusum_change' || metric === 'changepoint') {
            const cp = payload?.forecast?.changepoint;
            if (cp?.detected) {
                return `Media pre = ${cp.pre_mean}, post = ${cp.post_mean} leads/día (+${cp.shift_pct}%)`;
            }
        }

        if (metric === 'wow_change_pct') {
            if (ops.last_7d_avg != null && ops.prev_7d_avg != null) {
                return `Promedio 7 d = ${ops.last_7d_avg} vs ${ops.prev_7d_avg}`;
            }
        }

        if (metric === 'cv_pct') {
            return `Umbral = ${alert.threshold ?? 30}%`;
        }

        if (metric === 'call_rank_avg') {
            return `Umbral = ${alert.threshold ?? 7}`;
        }

        if (alert.actual != null && alert.threshold != null && alert.threshold !== 0) {
            return `${alert.actual} (umbral: ${alert.threshold})`;
        }

        if (alert.impact) return alert.impact;
        if (alert.actual != null) return String(alert.actual);
        return '—';
    }

    function isAlertsTable(table) {
        const header = table.querySelector('tr');
        if (!header) return false;
        const text = normalizeText(header.textContent);
        return text.includes('SEVERIDAD') && (text.includes('RPN') || text.includes('CODIGO'));
    }

    function isMetricsTable(table) {
        const header = table.querySelector('tr');
        if (!header) return false;
        const text = normalizeText(header.textContent);
        return text.includes('METRICA') && text.includes('VALOR');
    }

    function hydrateAlertsTable(payload) {
        const alerts = payload?.system?.alerts;
        if (!alerts?.length) return;

        document.querySelectorAll('.content-block table').forEach((table) => {
            if (!isAlertsTable(table)) return;

            const rows = Array.from(table.querySelectorAll('tr')).slice(1);
            if (rows.length === 0) {
                alerts.forEach((alert) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="${severityClass(alert.severity)}">${severityLabel(alert.severity)}</td>
                        <td>RPN ${alert.rpn_score ?? '—'}</td>
                        <td>${escapeHtml(alert.title || '')}</td>
                        <td>${escapeHtml(formatSupportValue(alert, payload))}</td>
                    `;
                    table.appendChild(tr);
                });
                return;
            }

            rows.forEach((row, index) => {
                const cells = row.querySelectorAll('td');
                if (!cells.length) return;
                const alert = alerts[index];
                if (!alert) return;

                const sevCell = cells[0];
                sevCell.classList.add(severityClass(alert.severity));
                sevCell.textContent = severityLabel(alert.severity);

                const supportCell = cells[cells.length - 1];
                const supportText = supportCell.textContent.trim();
                if (!supportText || supportText === '-' || supportText === '—') {
                    supportCell.textContent = formatSupportValue(alert, payload);
                }
            });
        });
    }

    function buildKeyMetrics(payload) {
        const forecast = payload.forecast || {};
        const ops = payload.operations || {};
        const inv = payload.investment || {};
        const bestModel = (forecast.backtest_models || []).find((m) => m.mase === forecast.mase)
            || (forecast.backtest_models || [])[0];
        const seasonal = (forecast.seasonal_indices || [])
            .map((row) => row.index)
            .join(', ');
        const cv = computeDailyCV(ops.daily_volumes)
            || payload.system?.alerts?.find((a) => a.metric === 'cv_pct')?.actual;

        const rows = [
            ['R²', forecast.r2],
            ['Pendiente', forecast.slope],
            ['MASE (ensemble_weighted)', forecast.mase],
            ['RMSE (trend_season)', bestModel?.rmse],
            ['MAE (trend_season)', bestModel?.mae],
            ['CV del volumen diario', cv != null ? `${formatNumber(cv, 2)} %` : null],
            ['Índices estacionales (Dom-Sáb)', seasonal || null],
            ['Health Score', payload.system?.health_score != null ? `${payload.system.health_score}/100` : null],
            ['HHI (inversión)', inv.hhi?.index ?? inv.mmm?.hhi_index],
            ['CPL implícito global', inv.cpl?.global_cpl != null ? `$${formatNumber(inv.cpl.global_cpl, 2)}` : null],
            ['Total leads', ops.total_leads != null ? formatNumber(ops.total_leads, 0) : null],
            ['Total gasto (USD)', inv.total_spend != null ? `$${formatNumber(inv.total_spend, 0)}` : null],
            ['Número de campañas (inversión)', inv.campaign_count],
            ['Cambio de régimen (Δ % leads/día)', forecast.changepoint?.detected
                ? `+${forecast.changepoint.shift_pct} % (${forecast.changepoint.pre_mean} → ${forecast.changepoint.post_mean})`
                : null],
            ['Registros de llamadas (originales)', ops.call_metrics?.total_records],
            ['Sobre-contacto (>7 intentos)', ops.contact_distribution
                ? `${formatNumber(ops.contact_distribution.overcontact_calls, 0)} (${formatNumber(ops.contact_distribution.overcontact_pct, 2)} %)`
                : null],
            ['Intentos promedio', ops.call_metrics?.call_rank?.avg],
            ['Intervalo medio entre intentos (min)', ops.call_metrics?.minutes_since_prev?.avg],
        ];

        return rows.filter(([, value]) => value != null && value !== '');
    }

    function buildMetricsTableHtml(rows) {
        const body = rows.map(([metric, value]) =>
            `<tr><td>${escapeHtml(metric)}</td><td>${escapeHtml(value)}</td></tr>`
        ).join('');
        return `<div class="tbl-wrap"><table>
            <tr><th>Métrica</th><th>Valor (precisión completa)</th></tr>
            ${body}
        </table></div>`;
    }

    function buildSuggestedAnalysesHtml(payload) {
        const inv = payload.investment || {};
        const ops = payload.operations || {};
        const blocks = [];

        if (inv.campaigns?.length) {
            blocks.push(`
                <p class="report-subsection-title"><strong>1. Eficiencia de CPL por campaña</strong></p>
                <p>Hipótesis: mayor gasto no implica menor CPL. Cruza <code>inversiones_campanas</code> (gasto) con <code>leads_por_campana</code> (volumen por fecha) para comparar ${inv.campaign_count} campañas activas y detectar saturación de pauta.</p>
            `);
        }

        if (ops.contact_distribution?.overcontact_pct != null) {
            blocks.push(`
                <p class="report-subsection-title"><strong>2. Impacto de intentos &gt; 7 en conversión</strong></p>
                <p>Hipótesis: leads con más de 7 intentos convierten peor. Segmenta <code>llamadas_agregadas</code> por rango de intentos usando el sobre-contacto actual (${formatNumber(ops.contact_distribution.overcontact_pct, 2)}%).</p>
            `);
        }

        if (payload.forecast?.seasonal_indices?.length && ops.daily_volumes?.length) {
            blocks.push(`
                <p class="report-subsection-title"><strong>3. Correlación estacional vs volumen diario</strong></p>
                <p>Hipótesis: días con índice &gt; 1.0 concentran más leads. Une <code>llegadas</code> con <code>indices_estacionales</code> por día de semana y valida con correlación de Pearson.</p>
            `);
        }

        if (!blocks.length) return '';
        return blocks.join('');
    }

    function buildSpecialAlertHtml(payload) {
        const alerts = (payload.system?.alerts || [])
            .filter((a) => a.severity === 'critical' || a.severity === 'warning');
        if (!alerts.length) return '';

        const items = alerts.map((alert) =>
            `<li>${escapeHtml(alert.title)}</li>`
        ).join('');
        return `<ol>${items}</ol>`;
    }

    function isEmptyOrBrokenNarrative(contentBlock) {
        if (!contentBlock) return true;
        const text = contentBlock.textContent.trim();
        if (!text || text.length < 120) return true;
        if (/\{\s*"output"\s*:\s*""\s*\}/.test(text)) return true;
        if (/^sin contenido disponible\.?$/i.test(text)) return true;
        return false;
    }

    function buildSourcesSummaryHtml(payload) {
        const meta = payload.meta || {};
        const ops = payload.operations || {};
        const generated = meta.generated_at
            ? new Date(meta.generated_at).toLocaleString('es-MX')
            : 'fecha no disponible';
        return `
            <p>Auditoría generada el <strong>${escapeHtml(generated)}</strong> con datos del motor <strong>n8n Analytics Engine</strong> (versión ${escapeHtml(meta.version || '7.0')}).</p>
            <ul>
                <li><strong>Leads:</strong> ${formatNumber(ops.total_leads, 0) || '—'} registros en ${ops.total_days || '—'} días.</li>
                <li><strong>Llamadas:</strong> ${formatNumber(ops.call_metrics?.total_records, 0) || '—'} registros agregados.</li>
                <li><strong>Campañas:</strong> ${payload.investment?.campaign_count || '—'} con gasto total de $${formatNumber(payload.investment?.total_spend, 0) || '—'}.</li>
                <li><strong>Forecast:</strong> método ${escapeHtml(payload.forecast?.method || 'N/A')} con MASE ${formatNumber(payload.forecast?.mase, 3) || 'N/A'}.</li>
            </ul>
        `;
    }

    function buildKeyFindingsHtml(payload) {
        const forecast = payload.forecast || {};
        const ops = payload.operations || {};
        const inv = payload.investment || {};
        const funnel = payload.funnel || {};
        const ll = ops.littles_law || {};
        const items = [];

        if (forecast.mase != null) {
            items.push(`MASE del ensemble: <strong>${formatNumber(forecast.mase, 3)}</strong> (${forecast.mase < 1 ? 'supera baseline' : 'no supera baseline'}).`);
        }
        if (forecast.r2 != null) {
            items.push(`R² de la regresión de volumen: <strong>${formatNumber(forecast.r2, 4)}</strong> (${forecast.r2 < 0.5 ? 'ajuste débil' : 'ajuste moderado'}).`);
        }
        if (forecast.changepoint?.detected) {
            const cp = forecast.changepoint;
            items.push(`Cambio de régimen (${cp.change_date || 'fecha N/D'}): volumen de ~${cp.pre_mean} a ~${cp.post_mean} leads/día (${cp.shift_pct >= 0 ? '+' : ''}${cp.shift_pct}%).`);
        }
        if (ops.contact_distribution?.overcontact_pct != null) {
            items.push(`Sobre-contacto: <strong>${formatNumber(ops.contact_distribution.overcontact_pct, 2)}%</strong> de llamadas superan 7 intentos.`);
        }
        if (ll.available && ll.saturated) {
            items.push(`Saturación operativa (Little's Law): WIP ${ll.L_wip}/${ll.max_capacity} (${formatNumber(ll.capacity_utilization_pct, 2)}% utilización).`);
        }
        if (funnel.conversion_pct != null) {
            items.push(`Conversión global del embudo: <strong>${formatNumber(funnel.conversion_pct, 2)}%</strong>.`);
        }
        if (inv.hhi?.index != null || inv.mmm?.hhi_index != null) {
            const hhi = inv.hhi?.index ?? inv.mmm?.hhi_index;
            items.push(`Concentración de inversión (HHI): <strong>${formatNumber(hhi, 4)}</strong> (${escapeHtml(inv.hhi?.label || inv.mmm?.hhi_label || 'moderada')}).`);
        }
        if (ops.wow_change_pct != null) {
            items.push(`Variación semanal de volumen: <strong>${ops.wow_change_pct >= 0 ? '+' : ''}${formatNumber(ops.wow_change_pct, 2)}%</strong>.`);
        }

        if (!items.length) return '';
        return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
    }

    function buildAssumptionsHtml(payload) {
        const forecast = payload.forecast || {};
        const r2 = forecast.r2;
        const mase = forecast.mase;
        const r2Note = r2 != null && r2 < 0.5
            ? 'El R² bajo indica que la tendencia lineal explica poca varianza; usar el forecast con precaución.'
            : 'El R² sugiere tendencia explicativa parcial; validar con backtest.';
        const maseNote = mase != null && mase < 1
            ? 'MASE < 1 confirma que el ensemble supera al baseline estacional.'
            : 'MASE ≥ 1 implica que el modelo no supera al baseline ingenuo.';

        return `
            <ul>
                <li>Ventana de análisis acotada a ${payload.operations?.total_days || 'N'} días; extrapolaciones largas aumentan incertidumbre.</li>
                <li>${r2Note}</li>
                <li>${maseNote}</li>
                <li>Los índices estacionales asumen patrón semanal estable; cambios de régimen recientes pueden invalidarlos.</li>
                <li>CPL implícito usa gasto total / leads totales; no atribuye conversión por campaña individual sin cruce adicional.</li>
            </ul>
        `;
    }

    function buildAlertsTechnicalTableHtml(payload) {
        const alerts = (payload.system?.alerts || []).filter((a) => a.severity !== 'info');
        if (!alerts.length) return '';

        const rows = alerts.map((alert) => `
            <tr>
                <td class="${severityClass(alert.severity)}">${severityLabel(alert.severity)}</td>
                <td>${alert.rpn_score ?? '—'}</td>
                <td>${escapeHtml(alert.title || '')}</td>
                <td>${escapeHtml(formatSupportValue(alert, payload))}</td>
            </tr>
        `).join('');

        return `<div class="tbl-wrap"><table>
            <tr><th>Severidad</th><th>RPN</th><th>Alerta</th><th>Evidencia / soporte</th></tr>
            ${rows}
        </table></div>`;
    }

    function buildConclusionHtml(payload) {
        const status = payload.system?.status || {};
        const health = payload.system?.health_score;
        const topAlerts = (payload.system?.alerts || [])
            .filter((a) => a.severity === 'critical' || a.severity === 'warning')
            .slice(0, 3)
            .map((a) => a.title);

        const alertList = topAlerts.length
            ? `<ul>${topAlerts.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`
            : '<p>No hay alertas críticas o de advertencia activas.</p>';

        return `
            <p>El sistema opera con Health Score <strong>${health ?? 'N/D'}/100</strong> (${escapeHtml(status.label || 'sin etiqueta')}).</p>
            <p>Prioridades técnicas inmediatas:</p>
            ${alertList}
            <p>Se recomienda monitorear MASE, HHI y sobre-contacto en el próximo ciclo de auditoría para validar si las acciones correctivas reducen la presión operativa.</p>
        `;
    }

    function rebuildAnalystNarrative(contentBlock, payload) {
        const sections = [
            { title: 'Resumen de fuentes y calidad', html: buildSourcesSummaryHtml(payload) },
            { title: 'Hallazgos clave', html: buildKeyFindingsHtml(payload) },
            { title: 'Supuestos y limitaciones', html: buildAssumptionsHtml(payload) },
            { title: 'Alertas técnicas', html: buildAlertsTechnicalTableHtml(payload) },
            { title: 'Análisis sugeridos', html: buildSuggestedAnalysesHtml(payload) },
            { title: 'Datos clave en tabla', html: (() => {
                const metrics = buildKeyMetrics(payload);
                return metrics.length ? buildMetricsTableHtml(metrics) : '';
            })() },
            { title: 'Conclusión', html: buildConclusionHtml(payload) },
        ].filter((section) => section.html);

        contentBlock.innerHTML = '';
        sections.forEach((section, index) => {
            appendReportSection(contentBlock, section.title, section.html, { isFirst: index === 0 });
        });
    }

    function sectionExists(contentBlock, keys) {
        const text = normalizeText(contentBlock.textContent);
        return keys.some((key) => text.includes(normalizeText(key)));
    }

    function appendReportSection(contentBlock, title, html, options = {}) {
        if (!html) return;

        const isFirst = options.isFirst || contentBlock.children.length === 0;

        if (!isFirst) {
            const hr = document.createElement('hr');
            hr.className = 'report-section-divider';
            contentBlock.appendChild(hr);
        }

        const heading = document.createElement('p');
        heading.className = 'report-section-title';
        heading.innerHTML = `<strong>${escapeHtml(title)}</strong>`;

        const container = document.createElement('div');
        container.innerHTML = html;

        contentBlock.appendChild(heading);
        Array.from(container.childNodes).forEach((node) => contentBlock.appendChild(node));
    }

    function hydrateMissingSections(audience, payload) {
        const contentBlock = document.querySelector('.content-block');
        if (!contentBlock) return;

        if (audience === 'analyst') {
            if (isEmptyOrBrokenNarrative(contentBlock)) {
                if (payload) {
                    rebuildAnalystNarrative(contentBlock, payload);
                } else {
                    contentBlock.innerHTML = `
                        <p class="report-section-title"><strong>Narrativa no disponible</strong></p>
                        <p>El motor de IA no entregó contenido para este informe. Vuelve a ejecutar el flujo n8n o verifica la conexión del payload.</p>
                    `;
                }
                return;
            }

            if (!sectionExists(contentBlock, ['DATOS CLAVE EN TABLA'])) {
                const metrics = buildKeyMetrics(payload);
                if (metrics.length) {
                    appendReportSection(contentBlock, 'Datos clave en tabla', buildMetricsTableHtml(metrics));
                }
            } else {
                document.querySelectorAll('.content-block table').forEach((table) => {
                    if (!isMetricsTable(table)) return;
                    const metricMap = Object.fromEntries(buildKeyMetrics(payload));
                    table.querySelectorAll('tr').forEach((row, index) => {
                        if (index === 0) return;
                        const cells = row.querySelectorAll('td');
                        if (cells.length < 2) return;
                        const label = normalizeText(cells[0].textContent);
                        const match = Object.entries(metricMap).find(([key]) =>
                            label.includes(normalizeText(key)) || normalizeText(key).includes(label)
                        );
                        if (!match) return;
                        const value = cells[1].textContent.trim();
                        if (!value || value === '-' || value === '—') {
                            cells[1].textContent = match[1];
                        }
                    });
                });
            }

            if (!sectionExists(contentBlock, ['ANALISIS SUGERIDOS', 'ANÁLISIS SUGERIDOS'])) {
                const analyses = buildSuggestedAnalysesHtml(payload);
                if (analyses) {
                    appendReportSection(contentBlock, 'Análisis sugeridos', analyses);
                }
            }
        }

        if (audience === 'manager' || audience === 'operations') {
            if (!sectionExists(contentBlock, ['ALERTA ESPECIAL'])) {
                const special = buildSpecialAlertHtml(payload);
                if (special) {
                    appendReportSection(contentBlock, 'Alerta especial', special);
                }
            }
        }
    }

    function colorizeSeverityCells() {
        document.querySelectorAll('.content-block table tr').forEach((row) => {
            const cells = row.querySelectorAll('td');
            if (!cells.length) return;
            const sevText = normalizeText(cells[0].textContent);
            if (sevText.includes('CRITICAL') || sevText.includes('CRITICO')) {
                cells[0].classList.add('sev-critical');
            } else if (sevText.includes('WARNING') || sevText.includes('ALERTA')) {
                cells[0].classList.add('sev-warning');
            } else if (sevText.includes('INFO')) {
                cells[0].classList.add('sev-info');
            }
        });
    }

    function normalizeKpis(kpis) {
        if (!kpis) return [];
        return Array.isArray(kpis) ? kpis : Object.values(kpis);
    }

    function kpiValueColorAttr(color) {
        if (color === 'red') return ' style="color:#e53e3e"';
        if (color === 'green') return ' style="color:#38a169"';
        if (color === 'blue') return ' style="color:#3182ce"';
        return '';
    }

    function buildKpiRowHtml(kpis) {
        return normalizeKpis(kpis).map((kpi) => `
            <div class="kpi">
                <div class="kpi-value"${kpiValueColorAttr(kpi.color)}>${escapeHtml(kpi.value ?? '—')}</div>
                <div class="kpi-label">${escapeHtml(kpi.label ?? '')}</div>
                <div class="kpi-sub">${escapeHtml(kpi.sub ?? '')}</div>
            </div>
        `).join('');
    }

    function syncKpisFromPayload(payload) {
        const row = document.querySelector('#narrativa .kpi-row');
        const kpis = normalizeKpis(payload?.kpis);
        if (!row || !kpis.length) return;
        row.innerHTML = buildKpiRowHtml(kpis);
    }

    function statusBarClass(color) {
        if (color === 'rojo' || color === 'red') return 'status-red';
        if (color === 'amarillo' || color === 'yellow') return 'status-yellow';
        return 'status-green';
    }

    function syncStatusBarFromPayload(payload) {
        const status = payload?.system?.status;
        const sbar = document.querySelector('.sbar');
        if (!sbar || !status) return;

        const reasons = (status.reasons || []).filter(Boolean).join(' — ')
            || status.label
            || 'Sin detalle adicional';
        const label = (status.label || 'ESTADO DEL SISTEMA').toUpperCase();

        sbar.className = `sbar ${statusBarClass(status.color)}`;
        sbar.innerHTML = `<span class="sdot"></span>ESTADO: ${escapeHtml(label)} &mdash; ${escapeHtml(reasons)}`;
    }

    function syncHeroDateFromPayload(payload) {
        const sub = document.querySelector('.hero .sub');
        if (!sub || !payload?.meta?.generated_at) return;
        const generated = new Date(payload.meta.generated_at);
        if (Number.isNaN(generated.getTime())) return;
        sub.textContent = generated.toLocaleString('es-MX', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function alertSeverityStyles(severity) {
        if (severity === 'critical') {
            return { badge: 'CRITICO', border: '#e53e3e', bg: '#fff5f5' };
        }
        if (severity === 'warning') {
            return { badge: 'ALERTA', border: '#dd6b20', bg: '#fffaf0' };
        }
        return { badge: 'INFO', border: '#3182ce', bg: '#f0f9ff' };
    }

    function buildAlertCardHtml(alert) {
        const styles = alertSeverityStyles(alert.severity);
        const detail = alert.evidence || alert.impact || '';
        return `
            <div class="alert-card" style="border-left:4px solid ${styles.border};background:${styles.bg}">
                <div class="alert-badge" style="background:${styles.border}">${styles.badge}</div>
                <div class="alert-title">${escapeHtml(alert.title || '')}</div>
                <div class="alert-detail">${escapeHtml(detail)}</div>
            </div>
        `;
    }

    function buildInfoItemHtml(alert) {
        const impact = alert.impact || alert.evidence || '';
        return `
            <div class="info-item">
                <strong>${escapeHtml(alert.title || '')}</strong>
                <span class="info-impact">${escapeHtml(impact)}</span>
            </div>
        `;
    }

    function syncAlertsFromPayload(payload) {
        const container = document.getElementById('alertas');
        const alerts = payload?.system?.alerts;
        if (!container || !Array.isArray(alerts)) return;

        const mainAlerts = alerts.filter((a) => a.severity === 'critical' || a.severity === 'warning');
        const infoAlerts = alerts.filter((a) => a.severity === 'info');

        let html = mainAlerts.map(buildAlertCardHtml).join('');
        if (infoAlerts.length) {
            html += `
                <div class="info-section open">
                    <div class="info-header">Información adicional (${infoAlerts.length}) <span class="chevron">+</span></div>
                    <div class="info-body">${infoAlerts.map(buildInfoItemHtml).join('')}</div>
                </div>
            `;
        }
        container.innerHTML = html;

        document.querySelectorAll('.tab').forEach((tab) => {
            if (!tab.textContent.includes('Alertas')) return;
            let badge = tab.querySelector('.tcount');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'tcount';
                tab.appendChild(badge);
            }
            badge.textContent = String(mainAlerts.length);
        });
    }

    function actionUrgencyStyles(urgency) {
        if (urgency === 'immediate') {
            return { label: 'INMEDIATO', color: '#e53e3e' };
        }
        return { label: 'ESTA SEMANA', color: '#dd6b20' };
    }

    function buildActionCardHtml(action, index) {
        const urgency = actionUrgencyStyles(action.urgency);
        return `
            <div class="action-card" style="border-left:4px solid ${urgency.color}">
                <div class="action-head">
                    <span class="action-num">${index + 1}</span>
                    <span class="action-badge" style="background:${urgency.color}">${urgency.label}</span>
                </div>
                <div class="action-text">${escapeHtml(action.action || '')}</div>
                <div class="action-meta"><span>Razón: ${escapeHtml(action.reason || '')}</span></div>
                <div class="action-meta">
                    <span>Responsable: ${escapeHtml(action.owner || '—')}</span>
                    <span>Plazo: ${escapeHtml(action.horizon || '—')}</span>
                </div>
            </div>
        `;
    }

    function syncActionsFromPayload(payload) {
        const container = document.getElementById('acciones');
        const actions = payload?.system?.actions;
        if (!container || !Array.isArray(actions) || !actions.length) return;

        container.innerHTML = actions.map(buildActionCardHtml).join('');

        document.querySelectorAll('.tab').forEach((tab) => {
            if (!tab.textContent.includes('Acciones')) return;
            let badge = tab.querySelector('.tcount');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'tcount';
                tab.appendChild(badge);
            }
            badge.textContent = String(actions.length);
        });
    }

    function syncFooterFromPayload(payload) {
        const footer = document.querySelector('.footer');
        if (!footer || !payload?.meta?.generated_at) return;
        const version = payload.meta.version || '7.0';
        const execId = payload.meta.execution_id ? ` · ${payload.meta.execution_id}` : '';
        footer.textContent = `Mkt_BI_IA v${version} · Datos sincronizados · ${payload.meta.generated_at}${execId}`;
    }

    function extractHtmlGeneratedAt() {
        const footer = document.querySelector('.footer');
        const match = footer?.textContent?.match(/(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/);
        return match?.[1] || window.__BOS_SYNC_META__?.htmlGeneratedAt || null;
    }

    function formatSyncTimestamp(iso) {
        if (!iso) return 'fecha desconocida';
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return iso;
        return date.toLocaleString('es-MX');
    }

    function injectStaleNarrativeBanner(audience, payload, htmlGeneratedAt) {
        const payloadAt = payload?.meta?.generated_at;
        if (!payloadAt || !htmlGeneratedAt || payloadAt === htmlGeneratedAt) return;
        if (audience === 'analyst') return;

        const contentBlock = document.querySelector('.content-block');
        if (!contentBlock || isEmptyOrBrokenNarrative(contentBlock)) return;

        if (document.querySelector('.report-stale-banner')) return;

        const banner = document.createElement('div');
        banner.className = 'report-stale-banner';
        banner.innerHTML = `
            <strong>Narrativa de ejecución anterior.</strong>
            Los KPIs, alertas y acciones ya reflejan datos del <em>${formatSyncTimestamp(payloadAt)}</em>,
            pero el texto narrativo proviene del informe generado el <em>${formatSyncTimestamp(htmlGeneratedAt)}</em>.
            Ejecuta de nuevo el flujo n8n para alinear la narrativa de IA.
        `;
        const anchor = document.querySelector('.latex-abstract') || document.querySelector('.sbar') || document.querySelector('.hero');
        anchor?.insertAdjacentElement('afterend', banner);
    }

    function syncReportFromPayload(audience, payload) {
        if (!payload) return;

        const htmlGeneratedAt = extractHtmlGeneratedAt();

        syncHeroDateFromPayload(payload);
        syncStatusBarFromPayload(payload);
        syncKpisFromPayload(payload);
        syncAlertsFromPayload(payload);
        syncActionsFromPayload(payload);
        syncFooterFromPayload(payload);
        injectStaleNarrativeBanner(audience, payload, htmlGeneratedAt);
    }

    function enrichFromPayload(audience) {
        const payload = getPayload();
        if (!payload) return;

        syncReportFromPayload(audience, payload);
        hydrateAlertsTable(payload);
        hydrateMissingSections(audience, payload);
        colorizeSeverityCells();
    }

    // ── Embedded preview: expand collapsible sections ──
    function expandInfoSections() {
        document.querySelectorAll('.info-section').forEach((section) => {
            section.classList.add('open');
        });
    }

    function setupEmbeddedPreview() {
        if (window.parent === window) return;
        expandInfoSections();
    }

    // ── KPI Tooltips Help Dictionary ──
    const kpiContext = {
        'HEALTH SCORE': {
            definition: 'Métrica que mide la salud general del flujo de leads y llamadas (SHS).',
            source: 'Calculado a partir de la tasa de sobre-contacto, demoras en intentos y volumen.',
            purpose: 'Monitorear la presión del sistema operativo y detectar saturación.'
        },
        'SYSTEM HEALTH': {
            definition: 'Métrica que mide la salud general del flujo de leads y llamadas (SHS).',
            source: 'Calculado a partir de la tasa de sobre-contacto, demoras en intentos y volumen.',
            purpose: 'Monitorear la presión del sistema operativo y detectar saturación.'
        },
        'LEADS TOTALES': {
            definition: 'El número acumulado de registros de clientes interesados (leads) ingresados al sistema.',
            source: 'Contador directo de la base de datos de leads procesada en n8n.',
            purpose: 'Conocer la escala del pipeline comercial e identificar la cantidad total de prospectos.'
        },
        'TOTAL LEADS': {
            definition: 'El número acumulado de registros de clientes interesados (leads) ingresados al sistema.',
            source: 'Contador directo de la base de datos de leads procesada en n8n.',
            purpose: 'Conocer la escala del pipeline comercial e identificar la cantidad total de prospectos.'
        },
        'CAMBIO SEMANAL': {
            definition: 'La variación porcentual del volumen de leads de la semana actual contra la semana previa (Week over Week).',
            source: 'Comparación histórica de leads del motor de analítica.',
            purpose: 'Detectar tendencias de crecimiento o caídas drásticas en el embudo comercial.'
        },
        'WEEK OVER': {
            definition: 'La variación porcentual del volumen de leads de la semana actual contra la semana previa (Week over Week).',
            source: 'Comparación histórica de leads del motor de analítica.',
            purpose: 'Detectar tendencias de crecimiento o caídas drásticas en el embudo comercial.'
        },
        'WOW': {
            definition: 'La variación porcentual del volumen de leads de la semana actual contra la semana previa (Week over Week).',
            source: 'Comparación histórica de leads del motor de analítica.',
            purpose: 'Detectar tendencias de crecimiento o caídas drásticas en el embudo comercial.'
        },
        'CPL IMPLICITO': {
            definition: 'Costo promedio invertido para adquirir un lead individual (Costo Por Lead).',
            source: 'División del gasto total invertido de campañas entre el número total de leads recibidos.',
            purpose: 'Evaluar la eficiencia financiera de la adquisición y optimizar el presupuesto publicitario.'
        },
        'CPL': {
            definition: 'Costo promedio invertido para adquirir un lead individual (Costo Por Lead).',
            source: 'División del gasto total invertido de campañas entre el número total de leads recibidos.',
            purpose: 'Evaluar la eficiencia financiera de la adquisición y optimizar el presupuesto publicitario.'
        },
        'GASTO TOTAL': {
            definition: 'La inversión publicitaria acumulada en las plataformas de anuncios para el periodo.',
            source: 'Integración de costos de pauta (Facebook/Google Ads, etc.) en n8n.',
            purpose: 'Controlar el presupuesto de marketing y monitorear la inversión publicitaria real.'
        },
        'AD SPEND': {
            definition: 'La inversión publicitaria acumulada en las plataformas de anuncios para el periodo.',
            source: 'Integración de costos de pauta (Facebook/Google Ads, etc.) en n8n.',
            purpose: 'Controlar el presupuesto de marketing y monitorear la inversión publicitaria real.'
        },
        'PROMEDIO DIARIO': {
            definition: 'La cantidad promedio de leads que ingresan al sistema cada día.',
            source: 'División de los leads totales entre los días del periodo analizado.',
            purpose: 'Planificar la capacidad del equipo de call center y dimensionar la carga operativa diaria.'
        },
        'DAILY AVG': {
            definition: 'La cantidad promedio de leads que ingresan al sistema cada día.',
            source: 'División de los leads totales entre los días del periodo analizado.',
            purpose: 'Planificar la capacidad del equipo de call center y dimensionar la carga operativa diaria.'
        },
        'PREVISION DIARIA': {
            definition: 'El volumen pronosticado de leads que ingresarán el día de mañana.',
            source: 'Modelos predictivos de series de tiempo (ej. ensemble_weighted) en la API de ML.',
            purpose: 'Anticipar picos o valles de leads y ajustar la asignación de agentes de venta con antelación.'
        },
        'DAILY FORECAST': {
            definition: 'El volumen pronosticado de leads que ingresarán el día de mañana.',
            source: 'Modelos predictivos de series de tiempo (ej. ensemble_weighted) en la API de ML.',
            purpose: 'Anticipar picos o valles de leads y ajustar la asignación de agentes de venta con antelación.'
        },
        'PREVISION': {
            definition: 'El volumen pronosticado de leads que ingresarán el día de mañana.',
            source: 'Modelos predictivos de series de tiempo (ej. ensemble_weighted) en la API de ML.',
            purpose: 'Anticipar picos o valles de leads y ajustar la asignación de agentes de venta con antelación.'
        },
        'MASE': {
            definition: 'Error Absoluto Escalado Medio (Mean Absolute Scaled Error) del forecast.',
            source: 'Comparación del error del modelo predictivo frente a un modelo ingenuo (naive baseline). Un valor < 1 supera al baseline.',
            purpose: 'Validar científicamente la precisión y confiabilidad del pronóstico de volumen diario.'
        },
        'HHI': {
            definition: 'Índice de Herfindahl-Hirschman, mide la concentración del presupuesto publicitario.',
            source: 'Suma del cuadrado de las participaciones porcentuales de gasto de cada campaña.',
            purpose: 'Evaluar la diversificación del presupuesto; un HHI alto indica dependencia crítica de pocas campañas.'
        },
        'HORA PICO': {
            definition: 'El intervalo horario del día con mayor volumen de registro de leads.',
            source: 'Análisis de frecuencia horaria de los leads entrantes.',
            purpose: 'Concentrar a los agentes en los horarios clave para asegurar una respuesta inmediata.'
        },
        'PEAK HOUR': {
            definition: 'El intervalo horario del día con mayor volumen de registro de leads.',
            source: 'Análisis de frecuencia horaria de los leads entrantes.',
            purpose: 'Concentrar a los agentes en los horarios clave para asegurar una respuesta inmediata.'
        }
    };

    function injectKpiHelpTooltips() {
        const kpis = document.querySelectorAll('.kpi');
        kpis.forEach(kpi => {
            const labelEl = kpi.querySelector('.kpi-label');
            if (!labelEl) return;
            const labelText = labelEl.textContent.trim().toUpperCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            let info = null;
            for (const [key, val] of Object.entries(kpiContext)) {
                if (labelText.includes(key)) {
                    info = val;
                    break;
                }
            }
            
            if (!info) return;
            
            // Create info icon trigger in the card
            const infoTrigger = document.createElement('span');
            infoTrigger.className = 'kpi-info-trigger';
            infoTrigger.innerHTML = '?';
            kpi.appendChild(infoTrigger);
            
            // Create tooltip container inside the card
            const tooltip = document.createElement('div');
            tooltip.className = 'kpi-tooltip';
            tooltip.innerHTML = `
                <div class="kpi-tooltip-section">
                    <strong>¿Qué es?:</strong> ${info.definition}
                </div>
                <div class="kpi-tooltip-section">
                    <strong>¿De dónde se obtiene?:</strong> ${info.source}
                </div>
                <div class="kpi-tooltip-section">
                    <strong>¿Para qué sirve?:</strong> ${info.purpose}
                </div>
            `;
            kpi.appendChild(tooltip);
        });
    }

<<<<<<< HEAD
=======
    function applyPageBreaks() {
        // Print layout uses CSS (#alertas / #acciones). Clear legacy classes if present.
        document.querySelectorAll('.print-page-break').forEach((el) => {
            el.classList.remove('print-page-break');
        });
    }

>>>>>>> Implementacion_Python
    // ── Inicialización ──
    function initReportAnimations() {
        initTheme();
        injectLatexAbstract();
        
        const audience = getAudience();
        document.body.classList.add(`theme-${audience}`);

        expandInfoSections();
        enrichFromPayload(audience);

        // Analyst report is the full data audit — show all KPIs, narrative, alerts and actions
        if (audience !== 'analyst') {
            filterKpisByAudience(audience);
            filterContentByAudience(audience);
            filterAlertsAndActionsByAudience(audience);
        }

        prepareKpiValues();
        setupEmbeddedPreview();
        injectKpiHelpTooltips();
        injectChartContainers();
        injectAlertsChart();

        const active = document.querySelector('.tc.active') || document.getElementById('narrativa');
        if (active) {
            active.classList.add('active');
            animateCountersIn(active);
            staggerCards(active);
        }

        renderAllCharts();

        window.__BOS_REPORT_READY__ = true;
        window.dispatchEvent(new Event('bos-report-ready'));

        if (window.parent !== window) {
            window.parent.postMessage('report-resize', '*');
            setTimeout(() => window.parent.postMessage('report-resize', '*'), 400);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initReportAnimations);
    } else {
        initReportAnimations();
    }
})();
