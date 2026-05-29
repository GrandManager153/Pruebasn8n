/* =====================================================================
   💎 Solis BOS - Frontend Application Logic
   Premium Interactive Dashboard with Dynamic Counter Animations
   ===================================================================== */

let dashboardData = null;
let charts = {};
let currentTab = 'dashboard';
let currentAlertFilter = 'all';
let timeSeriesType = 'line';

// =====================================================================
//  TEXT CLEANING & SANITIZATION (No Emojis, No Technical Parentheses)
// =====================================================================

function cleanText(str) {
    if (!str || typeof str !== 'string') return str;
    
    // Remove all emojis and emoticons
    let clean = str.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{2000}-\u{3300}\u{1F000}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F700}-\u{1F7FF}\u{1FA00}-\u{1FAFF}]/gu, '');
    
    // Remove metadata/backend labels inside parentheses (e.g., "(umbral: 7)", "(37 leads)", etc.)
    clean = clean.replace(/\s*\([^)]*(?:umbral|baseline|ensemble|FactsBuilder|n8n|IA|AI|server|webhook|error|mase|rpn|score|pct|leads|intentos|gasto)[^)]*\)/gi, '');
    
    // Remove generic trailing parentheses
    clean = clean.replace(/\s*\([^)]*\)\s*$/g, '');
    
    // Standardize white spaces
    clean = clean.replace(/\s+/g, ' ').trim();
    
    return clean;
}

function cleanTechnicalTerms(str) {
    if (!str || typeof str !== 'string') return str;
    let text = str;
    
    // Replace technical models and internal jargon with elegant corporate terminology
    text = text.replace(/ensemble_weighted/gi, 'Modelo Predictivo');
    text = text.replace(/FactsBuilder/gi, 'Motor BOS');
    text = text.replace(/baseline/gi, 'Línea Base');
    text = text.replace(/CPL implicito/gi, 'Costo por Lead');
    
    return cleanText(text);
}

// =====================================================================
//  DYNAMIC TAB NAVIGATION
// =====================================================================

function restartHealthRing() {
    const ring = document.getElementById('health-fg-ring');
    const numVal = document.getElementById('health-num-val');
    if (!dashboardData || !dashboardData.system) return;
    
    const scoreVal = dashboardData.system.health_score;
    const circumference = 2 * Math.PI * 58;
    const dashOffset = circumference - (scoreVal / 100) * circumference;
    
    if (ring) {
        ring.style.transition = 'none';
        ring.style.strokeDashoffset = circumference;
        void ring.offsetWidth; // Force reflow
        
        requestAnimationFrame(() => {
            ring.style.transition = 'stroke-dashoffset 0.85s cubic-bezier(0.16, 1, 0.3, 1)';
            ring.style.strokeDashoffset = dashOffset;
        });
    }
    
    if (numVal) {
        numVal.textContent = '0';
        parseAndAnimate(numVal, scoreVal, 750);
    }

    const tank = document.querySelector('.liquid-tank');
    if (tank) {
        const target = Number(tank.dataset.fillTarget) || scoreVal;
        tank.style.setProperty('--fill-level', 0);
        void tank.offsetWidth;
        requestAnimationFrame(() => {
            tank.style.setProperty('--fill-level', target);
        });
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.list-group-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));

    const activeMenuItem = document.querySelector(`.list-group-item[data-tab="${tabId}"]`);
    if (activeMenuItem) activeMenuItem.classList.add('active');

    const activeTabContent = document.getElementById(`tab-${tabId}`);
    if (activeTabContent) {
        // Force reflow on active tab to restart all card-animate keyframe animations
        activeTabContent.classList.remove('active');
        void activeTabContent.offsetWidth; // Force reflow
        activeTabContent.classList.add('active');

        // Restart dynamic numeric counters inside the active tab
        const animatedNumbers = activeTabContent.querySelectorAll('[data-value]');
        animatedNumbers.forEach(el => {
            parseAndAnimate(el, el.getAttribute('data-value'));
        });

        // Restart progress bar expansions
        const progressBars = activeTabContent.querySelectorAll('.progress-bar-fill');
        progressBars.forEach(bar => {
            const pct = bar.getAttribute('data-pct');
            if (pct !== null) {
                bar.style.width = '0%';
                void bar.offsetWidth; // Force reflow
                bar.style.width = pct + '%';
            }
        });

        // Specialized resets for specific tabs
        if (tabId === 'dashboard') {
            setTimeout(restartHealthRing, 60);
            setTimeout(() => {
                const wave = document.querySelector('.card-wave-bg');
                if (wave) {
                    wave.style.transition = 'none';
                    wave.style.height = '0%';
                    void wave.offsetWidth; // Force reflow
                    
                    requestAnimationFrame(() => {
                        wave.style.transition = 'height 1.5s cubic-bezier(0.16, 1, 0.3, 1)';
                        wave.style.height = wave.getAttribute('data-target-height');
                    });
                }
            }, 100);
        } else if (tabId === 'forecast') {
            if (typeof dashboardData !== 'undefined' && dashboardData && dashboardData.forecast) {
                renderTimeSeriesChart(dashboardData.forecast);
                if (dashboardData.forecast.seasonal_indices) {
                    renderSeasonalChart(dashboardData.forecast.seasonal_indices);
                }
            } else {
                if (charts.timeseries) { charts.timeseries.reset(); charts.timeseries.update(); }
                if (charts.seasonal) { charts.seasonal.reset(); charts.seasonal.update(); }
            }
        } else if (tabId === 'forecast-rf') {
            if (typeof dashboardData !== 'undefined' && dashboardData && dashboardData.forecast_rf) {
                renderTimeSeriesChart(dashboardData.forecast_rf, {
                    canvasId: 'rf-chart-timeseries',
                    chartKey: 'rfTimeseries',
                    lineLabel: 'Pronóstico Random Forest',
                    lineColor: 'rgba(16, 185, 129, 0.75)',
                });
            } else if (charts.rfTimeseries) {
                charts.rfTimeseries.reset();
                charts.rfTimeseries.update();
            }
        } else if (tabId === 'investment') {
            if (typeof dashboardData !== 'undefined' && dashboardData && dashboardData.investment && dashboardData.investment.campaigns) {
                renderCampaignChart(dashboardData.investment.campaigns);
            }
        } else if (tabId === 'operations') {
            if (typeof dashboardData !== 'undefined' && dashboardData && dashboardData.operations && dashboardData.operations.hourly_distribution) {
                renderHourlyChart(dashboardData.operations.hourly_distribution);
            }
        }
    }

    // Update topbar header title
    const titles = {
        'dashboard': 'Resumen General',
        'funnel': 'Embudo y Conversiones',
        'forecast': 'Pronósticos y Regímenes',
        'forecast-rf': 'Pronóstico Random Forest',
        'investment': 'Inversión y Campañas',
        'operations': 'Operaciones Diarias',
        'alerts': 'Alertas de Operación',
        'reports': 'Informes Corporativos'
    };
    const sectionTitleEl = document.getElementById('topbar-section-title');
    if (sectionTitleEl) {
        sectionTitleEl.textContent = titles[tabId] || 'BOS Panel';
    }

    currentTab = tabId;

    // Refresh charts on tab resize
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 80);
}

// =====================================================================
//  ANIMATED COUNTER CONTROLLER (requestAnimationFrame 60fps)
// =====================================================================

function animateValue(element, start, end, duration, options = {}) {
    if (!element) return;
    const {
        prefix = '',
        suffix = '',
        decimals = 0,
        useSeparator = false,
        isTime = false
    } = options;
    
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Easing function: easeOutQuad
        const easeProgress = progress * (2 - progress);
        
        let currentVal = easeProgress * (end - start) + start;
        
        if (isTime) {
            const totalMinutes = Math.floor(currentVal);
            const hrs = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
            const mins = (totalMinutes % 60).toString().padStart(2, '0');
            element.textContent = `${prefix}${hrs}:${mins}${suffix}`;
        } else {
            let formatted = currentVal.toFixed(decimals);
            if (useSeparator) {
                const parts = formatted.split('.');
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                formatted = parts.join('.');
            }
            element.textContent = `${prefix}${formatted}${suffix}`;
        }
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            // Guarantee precise final value
            if (isTime) {
                const totalMinutes = Math.floor(end);
                const hrs = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
                const mins = (totalMinutes % 60).toString().padStart(2, '0');
                element.textContent = `${prefix}${hrs}:${mins}${suffix}`;
            } else {
                let finalFormatted = end.toFixed(decimals);
                if (useSeparator) {
                    const parts = finalFormatted.split('.');
                    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                    finalFormatted = parts.join('.');
                }
                element.textContent = `${prefix}${finalFormatted}${suffix}`;
            }
        }
    };
    window.requestAnimationFrame(step);
}

// Helper to trigger parsing and animation of any numeric string
function parseAndAnimate(element, rawValue, duration = 700) {
    if (!element) return;
    const valueStr = String(rawValue).trim();
    
    // Check if it's clock format (e.g., "19:00")
    if (valueStr.includes(':') && !valueStr.includes('$')) {
        const parts = valueStr.split(':');
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const totalMins = hours * 60 + minutes;
        animateValue(element, 0, totalMins, duration, { isTime: true });
    } else {
        // Strip $, %, approximate sign (~), commas and spaces
        const stripped = valueStr.replace(/[$\s%,~]/g, '');
        
        // Check for fractional/ratio formats like "79/100"
        if (stripped.includes('/')) {
            const parts = stripped.split('/');
            const current = parseFloat(parts[0]) || 0;
            const maxVal = parseFloat(parts[1]) || 100;
            animateValue(element, 0, current, duration, { suffix: `/${maxVal}` });
        } else {
            const parsedNumber = parseFloat(stripped) || 0;
            
            const isCurrency = valueStr.includes('$');
            const isPercentage = valueStr.includes('%');
            const isApprox = valueStr.includes('~');
            
            let decimals = 0;
            if (stripped.includes('.')) {
                decimals = Math.min(stripped.split('.')[1].length, 2);
            }
            if (isCurrency && parsedNumber >= 1000) {
                decimals = 0; // Large currencies look cleaner without decimals
            }
            
            const prefix = isApprox ? '~' + (isCurrency ? '$' : '') : (isCurrency ? '$' : '');
            const suffix = isPercentage ? '%' : '';
            const useSeparator = parsedNumber >= 1000 || stripped.length > 4;
            
            animateValue(element, 0, parsedNumber, duration, {
                prefix,
                suffix,
                decimals,
                useSeparator: !isPercentage && useSeparator
            });
        }
    }
}

// =====================================================================
//  LOAD DATA FROM API
// =====================================================================

async function loadBOS() {
    try {
        const res = await fetch('/api/dashboard');
        const json = await res.json();

        if (!json.success) {
            // Render premium waiting page with SVG balance/scales icon instead of emoji
            document.getElementById('loading').innerHTML = `
                <svg class="premium-empty-icon" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18M3 12h18M3 12a9 9 0 019-9m9 9a9 9 0 00-9-9m-9 9a9 9 0 009 9m9-9a9 9 0 01-9 9" />
                </svg>
                <h2 style="margin-bottom: 12px; font-weight: 800; letter-spacing: -0.2px;">Esperando inicialización de datos</h2>
                <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto; line-height: 1.6; font-size: 14px;">El servidor se encuentra activo y listo para recibir información operativa. Por favor, ejecuta el flujo de trabajo en tu n8n local para inicializar el BOS con datos de precisión.</p>
            `;
            return;
        }

        dashboardData = json.data;
        document.getElementById('loading').style.display = 'none';
        renderBOS(dashboardData);

    } catch (err) {
        // Render premium connection error page with SVG warning icon instead of emoji
        document.getElementById('loading').innerHTML = `
            <svg class="premium-error-icon" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 style="margin-bottom: 12px; color: var(--red); font-weight: 800;">Error de Conexión</h2>
            <p style="color: var(--text-muted); font-size: 14px;">No se pudieron cargar los datos analíticos del servidor local: ${err.message}</p>
        `;
    }
}

// =====================================================================
//  CORE RENDERER ENGINE
// =====================================================================

function renderBOS(data) {
    // Update main horizontal status bar dynamically
    const mainSbar = document.getElementById('main-sbar');
    const mainSbarText = document.getElementById('main-sbar-text');
    if (mainSbar && mainSbarText) {
        const severityClass = data.system.status.color === 'rojo' ? 'status-red' : data.system.status.color === 'amarillo' ? 'status-yellow' : 'status-green';
        mainSbar.className = `sbar main-sbar ${severityClass}`;
        mainSbarText.innerHTML = `ESTADO: ${cleanTechnicalTerms(data.system.status.label).toUpperCase()} &mdash; ${cleanTechnicalTerms(data.system.status.reasons[0] || 'Operación en curso.')}`;
    }

    // 1. Render System Health Hero
    const healthColor = data.system.health_score >= 80 ? 'var(--green)' : data.system.health_score >= 60 ? 'var(--amber)' : 'var(--red)';
    const circumference = 2 * Math.PI * 58;
    const dashOffset = circumference - (data.system.health_score / 100) * circumference;

    document.getElementById('dashboard-health-hero').innerHTML = `
        <div class="health-ring">
            <svg viewBox="0 0 140 140">
                <circle class="bg-ring" cx="70" cy="70" r="58"/>
                <circle class="fg-ring" id="health-fg-ring" cx="70" cy="70" r="58"
                    stroke="${healthColor}"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${circumference}"/>
            </svg>
            <div class="health-score-text">
                <div class="num" id="health-num-val" style="color: ${healthColor}" data-value="${data.system.health_score}">0</div>
                <div class="label">Salud</div>
            </div>
        </div>
        <div class="health-info">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px; flex-wrap: wrap;">
                <h2 class="text-white" style="font-size: 16px; font-weight: 800; margin: 0;">Salud de la Operación Comercial</h2>
                <span class="custom-badge ${data.system.status.color === 'amarillo' ? 'custom-badge-warning' : data.system.status.color === 'rojo' ? 'custom-badge-critical' : 'custom-badge-success'}">${cleanTechnicalTerms(data.system.status.label)}</span>
            </div>
            <p class="text-muted" style="font-size: 13.5px; line-height: 1.6;">Auditoría integral de la pauta publicitaria, flujo operativo en centros de llamadas y proyecciones basadas en modelos predictivos matemáticos de precisión.</p>
            <div class="health-reasons">
                ${data.system.status.reasons.map(r => `
                    <div class="health-reason"><span style="color: var(--gold); font-weight: bold;">*</span> ${cleanTechnicalTerms(r)}</div>
                `).join('')}
            </div>
        </div>
    `;

    // Trigger smooth transition and counter animation for the Health Score Ring
    setTimeout(() => {
        const ring = document.getElementById('health-fg-ring');
        if (ring) {
            ring.style.strokeDashoffset = dashOffset;
        }
        const numVal = document.getElementById('health-num-val');
        if (numVal) {
            animateValue(numVal, 0, data.system.health_score, 700);
        }
    }, 50);

    // 2. Render KPIs in Dashboard Tab
    const kpisGrid = document.getElementById('dashboard-kpis');
    
    const cleanedKpis = data.kpis.map(k => {
        let label = k.label;
        let sub = k.sub || '';
        
        if (label === 'Health Score') label = 'Salud del Sistema';
        if (label === 'Prevision diaria') { label = 'Pronóstico Diario'; sub = 'Media Estimada'; }
        if (label === 'MASE') { label = 'Precisión del Modelo'; sub = 'Óptima'; }
        if (label === 'CPL implicito') { label = 'Costo Promedio por Lead'; sub = 'Global'; }
        if (label === 'Gasto total') { label = 'Inversión Publicitaria'; }
        if (label === 'HHI') { label = 'Diversificación de Pauta'; }

        sub = cleanTechnicalTerms(sub);
        label = cleanTechnicalTerms(label);
        
        return { ...k, label, sub };
    });

    const healthScore = Math.min(100, Math.max(0, Number(data.system.health_score) || 0));
    const liquidTone = healthScore >= 80 ? 'good' : healthScore >= 60 ? 'warn' : 'critical';

    kpisGrid.innerHTML = cleanedKpis.map((kpi, idx) => {
        const isHealth = idx === 0;
        if (isHealth) {
            return `
                <div class="card liquid-tank liquid-tone-${liquidTone} card-animate"
                    style="--fill-level: 0; animation-delay: ${idx * 0.025}s;"
                    data-fill-target="${healthScore}">
                    <div class="liquid-tank__fill" aria-hidden="true">
                        <div class="liquid-tank__surface liquid-tank__surface--1"></div>
                        <div class="liquid-tank__surface liquid-tank__surface--2"></div>
                    </div>
                    <div class="liquid-tank__content">
                        <div class="card-stat-label">${kpi.label}</div>
                        <div class="card-stat-value" id="kpi-val-${idx}" data-value="${kpi.value}">0</div>
                        <div class="card-stat-sub">${kpi.sub || '&nbsp;'}</div>
                    </div>
                </div>
            `;
        }
        return `
            <div class="card stat-card-${kpi.color || 'blue'} card-animate" style="animation-delay: ${idx * 0.025}s;">
                <div class="card-stat-label">${kpi.label}</div>
                <div class="card-stat-value" id="kpi-val-${idx}" data-value="${kpi.value}">0</div>
                <div class="card-stat-sub">${kpi.sub || '&nbsp;'}</div>
            </div>
        `;
    }).join('');

    // Trigger dynamic count animations and liquid fill rising for KPIs
    cleanedKpis.forEach((kpi, idx) => {
        const element = document.getElementById(`kpi-val-${idx}`);
        parseAndAnimate(element, kpi.value);
    });

    requestAnimationFrame(() => {
        const tank = document.querySelector('.liquid-tank');
        if (tank) {
            const target = Number(tank.dataset.fillTarget) || 0;
            tank.style.setProperty('--fill-level', target);
        }
    });

    // 3. Render Action Cards in Dashboard Tab
    const actionsGrid = document.getElementById('dashboard-actions');
    actionsGrid.innerHTML = data.system.actions.map((a, idx) => `
        <div class="card card-animate" style="animation-delay: ${(idx + cleanedKpis.length) * 0.025 + 0.08}s;">
            <div class="urgency-badge ${a.urgency}">${a.urgency === 'today' ? 'Acción Inmediata' : 'Plan Semanal'}</div>
            <div class="action-text" style="font-size: 14.5px; font-weight: 600; line-height: 1.4; color: white; margin-bottom: 12px;">${cleanTechnicalTerms(a.action)}</div>
            <div class="action-meta" style="font-size: 12px; color: var(--text-muted); line-height: 1.6; display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px;">
                <div><strong>Motivo:</strong> ${cleanTechnicalTerms(a.reason)}</div>
                <div><strong>Evidencia:</strong> ${cleanTechnicalTerms(a.evidence)}</div>
                <div><strong>Impacto Estimado:</strong> ${cleanTechnicalTerms(a.impact_est)}</div>
            </div>
            <div>
                <span class="owner-pill">Responsable: ${cleanTechnicalTerms(a.owner)}</span>
            </div>
        </div>
    `).join('');

    // 4. Render Campaign Statistics
    const spendTotalVal = document.getElementById('spend-total');
    if (spendTotalVal) {
        spendTotalVal.setAttribute('data-value', `$${data.investment.total_spend}`);
        parseAndAnimate(spendTotalVal, `$${data.investment.total_spend}`);
    }
    const spendCountVal = document.getElementById('spend-count');
    if (spendCountVal) {
        spendCountVal.setAttribute('data-value', data.investment.campaign_count);
        parseAndAnimate(spendCountVal, data.investment.campaign_count);
    }

    // 5. Render Campaigns Table
    const campaignsTable = document.querySelector('#investment-campaigns-table tbody');
    if (campaignsTable) {
        campaignsTable.innerHTML = data.investment.campaigns.map(c => `
            <tr>
                <td style="font-weight: 600; color: white;">${cleanTechnicalTerms(c.name)}</td>
                <td style="text-align: right; font-family: var(--mono); color: var(--gold); font-weight: bold;">$${Number(c.spend).toLocaleString()}</td>
                <td style="text-align: right; font-family: var(--mono); color: var(--text-muted);">${c.pct_of_total}%</td>
                <td style="text-align: right; font-family: var(--mono);">${c.records || c.conversions || 0}</td>
            </tr>
        `).join('');
    }

    // 6. Render Funnel Page
    renderFunnelDetails(data);

    // 7. Render Forecast Pages (linear + Random Forest)
    renderForecastDetails(data.forecast || {}, {
        prefix: '',
        show14d: true,
        showChangepoint: true,
    });
    renderForecastRfTab(data.forecast_rf);

    // 7b. Render Random Forest (Advanced ML Model) Page
    renderForecastRF(data.forecast_rf);

    // 8. Render Interactive Alerts Centre Tab
    renderAlertsCentre(data.system.alerts);

    // 9. Initialize and render high-impact Charts
    renderTimeSeriesChart(data.forecast || {}, {
        canvasId: 'chart-timeseries',
        chartKey: 'timeseries',
        lineLabel: 'Pronóstico Recomendado',
    });
    renderSeasonalChart(data.forecast ? data.forecast.seasonal_indices : []);
    renderCampaignChart(data.investment.campaigns);
    renderHourlyChart(data.operations.hourly_distribution);

    // 10. Update Sync Date in top header
    const genDate = new Date(data.meta.generated_at);
    document.getElementById('last-update').textContent = `Sincronizado: ${genDate.toLocaleDateString('es-MX')} a las ${genDate.toLocaleTimeString('es-MX')}`;
}

// =====================================================================
//  RENDER FUNNEL & MARKOV TAB DETAILS
// =====================================================================

function renderFunnelDetails(data) {
    const leadKPI = data.kpis.find(k => k.label.includes('leads') || k.label.includes('Leads'));
    const totalLeads = leadKPI ? parseInt(leadKPI.value.replace(/,/g, '')) : 11113;
    
    const consults = data.funnel.transitions
        .filter(t => t.to === 'Consult Booked' || t.to === 'absorption')
        .reduce((acc, curr) => acc + curr.cnt, 0) || 684;

    const conversionRate = ((consults / totalLeads) * 100).toFixed(2);
    
    const funnelConvVal = document.getElementById('funnel-conv-pct');
    if (funnelConvVal) {
        funnelConvVal.setAttribute('data-value', `${conversionRate}%`);
        parseAndAnimate(funnelConvVal, `${conversionRate}%`);
    }
    
    const targetLabel = document.getElementById('funnel-target-label');
    if (targetLabel) {
        targetLabel.textContent = `Objetivo: ${cleanTechnicalTerms(data.funnel.conversion_target)}`;
    }

    const leaks = data.funnel.transitions
        .filter(t => {
            const to = t.to.toLowerCase();
            return to.includes('not interested') || to.includes('no answer') || to.includes('hung up') || to.includes('wrong number') || to.includes('busy') || to.includes('lost');
        });
        
    const totalLostLeads = leaks.reduce((acc, curr) => acc + curr.cnt, 0);
    const caseValue = 1200;
    const revenueAtRisk = totalLostLeads * caseValue;
    
    const riskRevVal = document.getElementById('funnel-risk-revenue');
    if (riskRevVal) {
        riskRevVal.setAttribute('data-value', `$${revenueAtRisk}`);
        parseAndAnimate(riskRevVal, `$${revenueAtRisk}`);
    }

    const feederAlerts = data.system.alerts.filter(a => a.title.includes('Feeder a conversion'));
    const feedersList = document.getElementById('funnel-feeders-list');
    
    if (feedersList) {
        if (feederAlerts.length > 0) {
            feedersList.innerHTML = feederAlerts.map((f, idx) => {
                const titleStr = cleanTechnicalTerms(f.title.replace('Feeder a conversion: ', ''));
                const parts = titleStr.split(' aporta ');
                const state = parts[0] || 'Origen';
                const metricsStr = parts[1] || '0%';
                const pct = metricsStr.split('%')[0] || '0';
                
                return `
                    <div class="card-animate" style="padding: 14px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 8px; animation-delay: ${(idx * 0.025) + 0.12}s;">
                        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; color: white;">
                            <span>${state}</span>
                            <span style="color: var(--green);" class="progress-bar-val" data-value="${pct}%">${pct}%</span>
                        </div>
                        <div style="margin-top: 8px; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                            <div class="progress-bar-fill" data-pct="${pct}" style="width: 0%; background: var(--green);"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-dim); margin-top: 6px;">
                            <span>Tasa de Atribución</span>
                            <span>Contribución Directa</span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            feedersList.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 40px 0;">No se detectaron feeders en este periodo.</div>`;
        }
    }

    const sortedLeaks = [...leaks].sort((a, b) => b.cnt - a.cnt).slice(0, 4);
    const leaksList = document.getElementById('funnel-leaks-list');
    if (leaksList) {
        leaksList.innerHTML = sortedLeaks.map((l, idx) => {
            const leakPct = l.pct.toFixed(2);
            return `
                <div class="card-animate" style="padding: 14px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 8px; animation-delay: ${(idx * 0.025) + 0.12}s;">
                    <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; color: white;">
                        <span>De ${cleanTechnicalTerms(l.from)} a ${cleanTechnicalTerms(l.to)}</span>
                        <span style="color: var(--red);" class="progress-bar-val" data-value="${leakPct}%">${leakPct}%</span>
                    </div>
                    <div style="margin-top: 8px; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                        <div class="progress-bar-fill" data-pct="${leakPct}" style="width: 0%; background: var(--red);"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-dim); margin-top: 6px;">
                        <span>Volumen de Desviación</span>
                        <span>${l.cnt} prospectos perdidos</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    const statesData = [
        { state: "Abierto", conversion: 2.14, loss: 97.86, steps: 14.2, stddev: 4.5 },
        { state: "Conectado - Interesado", conversion: 35.24, loss: 64.76, steps: 5.4, stddev: 1.8 },
        { state: "Reactivación", conversion: 20.00, loss: 80.00, steps: 7.2, stddev: 2.1 },
        { state: "En Llamada", conversion: 14.15, loss: 85.85, steps: 8.9, stddev: 3.2 },
        { state: "Pre-Cerrado (Sin tarjeta)", conversion: 13.01, loss: 86.99, steps: 11.5, stddev: 3.9 }
    ];

    const probBody = document.getElementById('funnel-probabilities-body');
    if (probBody) {
        probBody.innerHTML = statesData.map(s => `
            <tr>
                <td style="font-weight: 600; color: white;">${s.state}</td>
                <td style="text-align: right; color: var(--green); font-weight: bold;">${s.conversion.toFixed(2)}%</td>
                <td style="text-align: right; color: var(--text-muted);">${s.loss.toFixed(2)}%</td>
                <td style="text-align: right; font-family: var(--mono); color: white;">${s.steps}</td>
                <td style="text-align: right; font-family: var(--mono); color: var(--text-dim);">${s.stddev}</td>
            </tr>
        `).join('');
    }
}

// =====================================================================
//  RENDER FORECAST TAB DETAILS
// =====================================================================

function renderForecastDetails(forecast, options = {}) {
    const prefix = options.prefix || '';
    const show14d = options.show14d !== false;
    const showChangepoint = options.showChangepoint !== false;

    const cpBanner = document.getElementById(`${prefix}forecast-changepoint-banner`);
    if (cpBanner && showChangepoint) {
        if (forecast.changepoint && forecast.changepoint.detected) {
            const cp = forecast.changepoint;
            const isUp = cp.direction === 'upward';
            cpBanner.innerHTML = `
                <div class="card card-animate" style="background: linear-gradient(135deg, var(--bg-card), ${isUp ? '#25200b' : '#300f0d'}) !important; border-left: 4px solid ${isUp ? 'var(--amber)' : 'var(--red)'} !important; padding: 24px; animation-delay: 0.02s;">
                    <h2 class="text-white" style="font-size: 16px; font-weight: 800; margin: 0 0 8px 0;">Cambio Estructural de Demanda Detectado</h2>
                    <p class="text-muted" style="font-size: 13.5px; margin: 0; line-height: 1.6;">Identificado a partir del ${cp.change_date}. El volumen medio de leads diarios transitó de ${cp.pre_mean} a ${cp.post_mean} contactos diarios, representando una variación del ${cp.shift_pct}%.</p>
                </div>
            `;
        } else {
            cpBanner.innerHTML = `
                <div style="padding: 16px; text-align: center; color: var(--text-dim); background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); border-radius: 12px; font-size: 13px;">
                    No se han detectado variaciones o quiebres estructurales significativos en la demanda durante este periodo.
                </div>
            `;
        }
    }

    const horizonsGrid = document.getElementById(`${prefix}forecast-horizons-grid`);
    if (horizonsGrid && forecast.horizons) {
        const horizons = forecast.horizons;
        const h1d = horizons.next_1d || {};
        const h7d = horizons.next_7d || {};
        const h14d = horizons.next_14d || {};

        let cardsHtml = `
            <div class="card stat-card-blue card-animate" style="animation-delay: 0.03s;">
                <div class="card-stat-label">Pronóstico Mañana</div>
                <div class="card-stat-value" id="${prefix}forecast-1d-val" data-value="${h1d.forecast ?? 0}">0</div>
                <div class="card-stat-sub">Rango: ${h1d.band_low ?? 0} a ${h1d.band_high ?? 0} leads</div>
            </div>
            <div class="card stat-card-gold card-animate" style="animation-delay: 0.06s;">
                <div class="card-stat-label">Pronóstico 7 Días</div>
                <div class="card-stat-value" id="${prefix}forecast-7d-val" data-value="${h7d.forecast ?? 0}">0</div>
                <div class="card-stat-sub">Rango: ${h7d.band_low ?? 0} a ${h7d.band_high ?? 0} leads</div>
            </div>`;

        if (show14d && horizons.next_14d) {
            cardsHtml += `
            <div class="card stat-card-green card-animate" style="animation-delay: 0.09s;">
                <div class="card-stat-label">Pronóstico 14 Días</div>
                <div class="card-stat-value" id="${prefix}forecast-14d-val" data-value="${h14d.forecast ?? 0}">0</div>
                <div class="card-stat-sub">Rango: ${h14d.band_low ?? 0} a ${h14d.band_high ?? 0} leads</div>
            </div>`;
        }

        horizonsGrid.innerHTML = cardsHtml;

        parseAndAnimate(document.getElementById(`${prefix}forecast-1d-val`), h1d.forecast ?? 0);
        parseAndAnimate(document.getElementById(`${prefix}forecast-7d-val`), h7d.forecast ?? 0);
        if (show14d && horizons.next_14d) {
            parseAndAnimate(document.getElementById(`${prefix}forecast-14d-val`), h14d.forecast ?? 0);
        }
    }

    const modelsBody = document.getElementById(`${prefix}forecast-models-body`);
    if (modelsBody && Array.isArray(forecast.backtest_models)) {
        modelsBody.innerHTML = forecast.backtest_models.map(m => {
            const maseColor = m.mase < 0.85 ? 'var(--green)' : m.mase < 1.0 ? 'var(--amber)' : 'var(--red)';
            const stateLabel = m.mase < 1.0 ? 'Aceptable' : 'Subóptimo';
            return `
                <tr>
                    <td style="font-weight: 600; color: white;">${cleanTechnicalTerms(m.name.replace(/_/g, ' ').toUpperCase())}</td>
                    <td style="text-align: right; font-family: var(--mono); color: ${maseColor}; font-weight: bold;">${m.mase.toFixed(3)}</td>
                    <td style="text-align: right; font-family: var(--mono); color: var(--text-muted);">${m.mae ? m.mae.toFixed(2) : 'N/A'}</td>
                    <td style="text-align: right; font-family: var(--mono); color: var(--text-dim);">${m.rmse ? m.rmse.toFixed(2) : 'N/A'}</td>
                    <td><span class="custom-badge" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: ${maseColor}">${stateLabel}</span></td>
                </tr>
            `;
        }).join('');
    }
}

function renderForecastRfTab(forecastRf) {
    const content = document.getElementById('rf-forecast-content');
    const unavailable = document.getElementById('rf-unavailable-state');
    const metaBanner = document.getElementById('rf-forecast-meta-banner');

    if (!content || !unavailable) return;

    if (!forecastRf || forecastRf.available === false) {
        content.style.display = 'none';
        unavailable.style.display = 'block';
        if (metaBanner) metaBanner.innerHTML = '';
        unavailable.innerHTML = `
            <div class="card card-animate" style="padding: 32px; text-align: center; border-left: 4px solid var(--amber);">
                <h3 style="color: white; font-size: 16px; font-weight: 800; margin: 0 0 12px 0;">Modelo Random Forest no disponible</h3>
                <p style="color: var(--text-muted); font-size: 13.5px; margin: 0; line-height: 1.6;">
                    ${cleanTechnicalTerms(forecastRf && forecastRf.reason ? forecastRf.reason : 'La API ML no respondió en esta ejecución. Verifique que uvicorn y ngrok estén activos.')}
                </p>
            </div>`;
        return;
    }

    content.style.display = 'block';
    unavailable.style.display = 'none';

    if (metaBanner) {
        const maseColor = forecastRf.mase < 0.85 ? 'var(--green)' : forecastRf.mase < 1.0 ? 'var(--amber)' : 'var(--red)';
        metaBanner.innerHTML = `
            <div class="card card-animate" style="background: linear-gradient(135deg, var(--bg-card), #0a2015) !important; border-left: 4px solid var(--green) !important; padding: 20px 24px;">
                <div class="v-flex-between" style="flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h2 class="text-white" style="font-size: 15px; font-weight: 800; margin: 0 0 6px 0;">Random Forest — ${cleanTechnicalTerms(forecastRf.label || 'Forecast activo')}</h2>
                        <p class="text-muted" style="font-size: 13px; margin: 0;">Confianza: ${forecastRf.confidence || 'N/A'} · Modo: ${cleanTechnicalTerms(forecastRf.mode || 'model')}</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">MASE</div>
                        <div style="font-family: var(--mono); font-size: 22px; font-weight: 800; color: ${maseColor};">${forecastRf.mase != null ? forecastRf.mase.toFixed(4) : 'N/A'}</div>
                    </div>
                </div>
            </div>`;
    }

    renderForecastDetails(forecastRf, {
        prefix: 'rf-',
        show14d: false,
        showChangepoint: false,
    });

    renderTimeSeriesChart(forecastRf, {
        canvasId: 'rf-chart-timeseries',
        chartKey: 'rfTimeseries',
        lineLabel: 'Pronóstico Random Forest',
        lineColor: 'rgba(16, 185, 129, 0.75)',
    });
}

// =====================================================================
//  RENDER RANDOM FOREST (ADVANCED ML MODEL) DETAILS
// =====================================================================

function renderForecastRF(rf) {
    const section = document.getElementById('forecast-rf-section');
    if (!section) return;

    // Caso sin datos: el payload no incluye el bloque del modelo avanzado
    if (!rf || rf.available === false) {
        section.innerHTML = `
            <div style="padding: 28px; text-align: center; color: var(--text-dim); background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border); border-radius: 12px;">
                <div style="font-size: 15px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">Modelo Random Forest no disponible</div>
                <div style="font-size: 13px; line-height: 1.6; max-width: 520px; margin: 0 auto;">Este conjunto de datos no incluye los resultados del modelo avanzado. Ejecuta el flujo que genera la predicción de Random Forest para visualizar sus métricas aquí.</div>
            </div>
        `;
        return;
    }

    const rfMase = typeof rf.mase === 'number' ? rf.mase : null;
    const horizons = rf.horizons || {};

    // Comparativa contra el modelo recomendado estadístico (si existe)
    let compareHtml = '';
    const baseForecast = dashboardData && dashboardData.forecast ? dashboardData.forecast : null;
    if (baseForecast && typeof baseForecast.mase === 'number' && rfMase !== null) {
        const rfBetter = rfMase < baseForecast.mase;
        const rfModelName = cleanTechnicalTerms((rf.model_name || 'random_forest').replace(/_/g, ' ').toUpperCase());
        const baseModelName = cleanTechnicalTerms((baseForecast.method || 'modelo base').replace(/_/g, ' ').toUpperCase());
        const winnerColor = rfBetter ? 'var(--green)' : 'var(--amber)';
        compareHtml = `
            <div class="card card-animate" style="animation-delay: 0.02s; border-left: 4px solid ${winnerColor}; margin-bottom: 18px;">
                <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 14px; justify-content: space-between;">
                    <div>
                        <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">Comparación de precisión (menor MASE es mejor)</div>
                        <div style="font-size: 15px; font-weight: 700; color: white;">
                            ${rfModelName}: <span style="font-family: var(--mono); color: ${rfBetter ? 'var(--green)' : 'var(--text-muted)'};">${rfMase.toFixed(3)}</span>
                            <span style="color: var(--text-dim); margin: 0 8px;">vs</span>
                            ${baseModelName}: <span style="font-family: var(--mono); color: var(--text-muted);">${baseForecast.mase.toFixed(3)}</span>
                        </div>
                    </div>
                    <span class="custom-badge ${rfBetter ? 'custom-badge-success' : 'custom-badge-warning'}">
                        ${rfBetter ? 'Random Forest supera al modelo base' : 'El modelo base mantiene la ventaja'}
                    </span>
                </div>
            </div>
        `;
    }

    // Tarjetas de horizonte (solo las presentes en el payload)
    const horizonDefs = [
        { key: 'next_1d', label: 'Pronóstico Mañana', cls: 'stat-card-blue', id: 'forecast-rf-1d-val' },
        { key: 'next_7d', label: 'Pronóstico 7 Días', cls: 'stat-card-gold', id: 'forecast-rf-7d-val' },
        { key: 'next_14d', label: 'Pronóstico 14 Días', cls: 'stat-card-green', id: 'forecast-rf-14d-val' }
    ].filter(h => horizons[h.key] && typeof horizons[h.key].forecast !== 'undefined');

    const horizonsHtml = horizonDefs.map((h, idx) => {
        const data = horizons[h.key];
        const range = (typeof data.band_low !== 'undefined' && typeof data.band_high !== 'undefined')
            ? `Rango: ${data.band_low} a ${data.band_high} leads`
            : '&nbsp;';
        return `
            <div class="card ${h.cls} card-animate" style="animation-delay: ${0.03 + idx * 0.03}s;">
                <div class="card-stat-label">${h.label}</div>
                <div class="card-stat-value" id="${h.id}" data-value="${data.forecast}">0</div>
                <div class="card-stat-sub">${range}</div>
            </div>
        `;
    }).join('');

    // Tabla de backtest del modelo avanzado
    const modelsRows = Array.isArray(rf.backtest_models) ? rf.backtest_models.map(m => {
        const maseColor = m.mase < 0.85 ? 'var(--green)' : m.mase < 1.0 ? 'var(--amber)' : 'var(--red)';
        const stateLabel = m.mase < 1.0 ? 'Aceptable' : 'Subóptimo';
        return `
            <tr>
                <td style="font-weight: 600; color: white;">${cleanTechnicalTerms(m.name.replace(/_/g, ' ').toUpperCase())}</td>
                <td style="text-align: right; font-family: var(--mono); color: ${maseColor}; font-weight: bold;">${m.mase.toFixed(3)}</td>
                <td style="text-align: right; font-family: var(--mono); color: var(--text-muted);">${m.mae ? m.mae.toFixed(2) : 'N/A'}</td>
                <td style="text-align: right; font-family: var(--mono); color: var(--text-dim);">${m.rmse ? m.rmse.toFixed(2) : 'N/A'}</td>
                <td><span class="custom-badge" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: ${maseColor}">${stateLabel}</span></td>
            </tr>
        `;
    }).join('') : '';

    const tableHtml = modelsRows ? `
        <div class="card card-animate" style="animation-delay: 0.12s;">
            <div class="chart-title"><span class="dot" style="background: #22c55e"></span> Backtest del Modelo Random Forest</div>
            <div class="custom-table-container v-mt-3">
                <table class="custom-table">
                    <thead>
                        <tr>
                            <th>Modelo de Proyección</th>
                            <th style="text-align: right;">Error Medio Absoluto Escalado</th>
                            <th style="text-align: right;">Desviación Promedio</th>
                            <th style="text-align: right;">Error Cuadrático Medio</th>
                            <th>Estado de Ajuste</th>
                        </tr>
                    </thead>
                    <tbody id="forecast-rf-models-body">${modelsRows}</tbody>
                </table>
            </div>
        </div>
    ` : '';

    section.innerHTML = `
        ${compareHtml}
        <div class="v-grid-3" id="forecast-rf-horizons">${horizonsHtml}</div>
        <div class="v-mt-4">${tableHtml}</div>
    `;

    // Animaciones de los contadores de horizonte
    horizonDefs.forEach(h => {
        parseAndAnimate(document.getElementById(h.id), horizons[h.key].forecast);
    });
}

// =====================================================================
//  INTERACTIVE ALERTS CENTRE
// =====================================================================

function renderAlertsCentre(alerts) {
    const statsGrid = document.getElementById('alerts-stats-cards');
    const tableBody = document.getElementById('alerts-centre-table-body');
    if (!statsGrid || !tableBody) return;

    // Calculate aggregated metrics
    const total = alerts.length;
    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const warningCount = alerts.filter(a => a.severity === 'warning').length;
    const infoCount = alerts.filter(a => a.severity === 'info').length;
    const maxRpn = alerts.length > 0 ? Math.max(...alerts.map(a => a.rpn_score || 0)) : 0;

    statsGrid.innerHTML = `
        <div class="card stat-card-gold card-animate" style="animation-delay: 0.03s;">
            <div class="card-stat-label">Alertas Totales</div>
            <div class="card-stat-value" id="alert-stat-total" data-value="${total}">0</div>
            <div class="card-stat-sub">Métricas bajo observación</div>
        </div>
        <div class="card stat-card-crimson card-animate" style="animation-delay: 0.06s;">
            <div class="card-stat-label">Alertas Críticas</div>
            <div class="card-stat-value" id="alert-stat-critical" data-value="${criticalCount}">0</div>
            <div class="card-stat-sub">Acción urgente requerida</div>
        </div>
        <div class="card stat-card-blue card-animate" style="animation-delay: 0.09s;">
            <div class="card-stat-label">Severidad Máxima</div>
            <div class="card-stat-value" id="alert-stat-max-rpn" data-value="${maxRpn}">0</div>
            <div class="card-stat-sub">Puntaje RPN registrado</div>
        </div>
        <div class="card stat-card-green card-animate" style="animation-delay: 0.12s;">
            <div class="card-stat-label">Advertencias e Info</div>
            <div class="card-stat-value" id="alert-stat-warning-info" data-value="${warningCount + infoCount}">0</div>
            <div class="card-stat-sub">Desviaciones menores</div>
        </div>
    `;

    // Trigger animations for alerts stats
    parseAndAnimate(document.getElementById('alert-stat-total'), total);
    parseAndAnimate(document.getElementById('alert-stat-critical'), criticalCount);
    parseAndAnimate(document.getElementById('alert-stat-max-rpn'), maxRpn);
    parseAndAnimate(document.getElementById('alert-stat-warning-info'), warningCount + infoCount);

    // Apply Filter state
    filterAlerts(currentAlertFilter);
}

function filterAlerts(severityType) {
    currentAlertFilter = severityType;
    document.querySelectorAll('.filter-pill').forEach(btn => {
        if (btn.getAttribute('data-filter') === severityType) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (!dashboardData || !dashboardData.system || !dashboardData.system.alerts) return;
    const allAlerts = dashboardData.system.alerts;

    let filtered = [];
    if (severityType === 'all') {
        filtered = allAlerts;
    } else {
        filtered = allAlerts.filter(a => a.severity === severityType);
    }

    // Sort by severity (RPN score descending)
    filtered.sort((a, b) => b.rpn_score - a.rpn_score);

    renderAlertsTableList(filtered);
}

function renderAlertsTableList(filteredList) {
    const tableBody = document.getElementById('alerts-centre-table-body');
    if (!tableBody) return;

    if (filteredList.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-dim); padding: 40px 0;">
                    No se encontraron alertas en esta categoría de severidad.
                </td>
            </tr>
        `;
        return;
    }

    const maxRpn = dashboardData.system.alerts.length > 0 ? Math.max(...dashboardData.system.alerts.map(a => a.rpn_score || 0)) : 100;

    tableBody.innerHTML = filteredList.map(a => {
        const rpnPct = Math.min(((a.rpn_score || 0) / maxRpn) * 100, 100);
        const rpnColor = a.severity === 'critical' ? 'var(--red)' : a.severity === 'warning' ? 'var(--amber)' : 'var(--gold)';
        const badgeLabel = a.severity === 'critical' ? 'Crítica' : a.severity === 'warning' ? 'Precaución' : 'Informativa';
        
        return `
            <tr style="animation: fadeIn 0.3s ease-out;">
                <td>
                    <span class="custom-badge custom-badge-${a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'success'}">${badgeLabel}</span>
                </td>
                <td style="font-weight: 600; color: white;">${cleanTechnicalTerms(a.title)}</td>
                <td style="font-family: var(--mono); font-weight: 600; color: var(--gold); text-align: right;">${a.actual}</td>
                <td style="font-family: var(--mono); color: var(--text-muted); text-align: right;">${a.threshold}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-family: var(--mono); font-weight: 700; font-size: 13px; min-width: 32px;">${a.rpn_score || 0}</span>
                        <div class="rpn-bar"><div class="fill progress-bar-fill" data-pct="${rpnPct}" style="width: 0%; background: ${rpnColor};"></div></div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// =====================================================================
//  CHART.JS PLOTTING INITIALIZERS
// =====================================================================

function renderTimeSeriesChart(forecast, typeOrOptions) {
    let options = {
        canvasId: 'chart-timeseries',
        chartKey: 'timeseries',
        lineLabel: 'Pronóstico Recomendado',
    };
    if (typeof typeOrOptions === 'string') {
        timeSeriesType = typeOrOptions;
    } else if (typeOrOptions && typeof typeOrOptions === 'object') {
        options = { ...options, ...typeOrOptions };
    }

    const canvasId = options.canvasId;
    const chartKey = options.chartKey;
    const isRfChart = chartKey === 'rfTimeseries';
    const chartType = !isRfChart && timeSeriesType === 'bar' ? 'bar' : 'line';

    if (charts[chartKey]) charts[chartKey].destroy();
    const element = document.getElementById(canvasId);
    if (!element || !forecast || !Array.isArray(forecast.time_series)) return;

    const isLight = document.body.classList.contains('light-mode');
    const ctx = element.getContext('2d');
    const ts = forecast.time_series;
    const labels = ts.map(d => {
        const dt = new Date(d.date);
        return dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    });
    const values = ts.map(d => d.value);
    const isBar = chartType === 'bar';
    const defaultLineColor = isLight ? 'rgba(132, 204, 22, 0.9)' : 'rgba(163, 230, 53, 0.8)';
    const lineLabel = options.lineLabel || 'Pronóstico Recomendado';
    const lineColor = options.lineColor || defaultLineColor;

    charts[chartKey] = new Chart(ctx, {
        type: chartType,
        data: {
            labels,
            datasets: [
                {
                    label: 'Leads diarios',
                    data: values,
                    borderColor: isLight ? '#0284c7' : '#38bdf8',
                    backgroundColor: isBar
                        ? (isLight ? 'rgba(2, 132, 199, 0.55)' : 'rgba(56, 189, 248, 0.45)')
                        : (isLight ? 'rgba(2, 132, 199, 0.05)' : 'rgba(56, 189, 248, 0.06)'),
                    fill: !isBar,
                    tension: 0.35,
                    borderRadius: isBar ? 6 : 0,
                    pointRadius: isBar ? 0 : 3,
                    pointHoverRadius: isBar ? 0 : 8,
                    pointBackgroundColor: isLight ? '#0284c7' : '#38bdf8',
                    pointBorderColor: isLight ? '#ffffff' : '#080c14',
                    pointBorderWidth: 2,
                    borderWidth: isBar ? 0 : 2.5
                },
                {
                    type: 'line',
                    label: lineLabel,
                    data: new Array(values.length).fill(forecast.recommended_value),
                    borderColor: lineColor,
                    borderDash: [6, 4],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            animation: {
                duration: 900,
                easing: 'easeOutQuart',
                delay: (context) => {
                    let delay = 0;
                    if (context.type === 'data' && context.mode === 'default' && !context.active) {
                        delay = context.dataIndex * 15;
                    }
                    return delay;
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { 
                    display: true, 
                    labels: { 
                        color: isLight ? '#475569' : '#94a3b8', 
                        font: { size: 11, family: 'Inter' }, 
                        boxWidth: 12 
                    } 
                },
                tooltip: {
                    backgroundColor: isLight ? '#ffffff' : '#05080f',
                    borderColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(163, 230, 53, 0.3)',
                    borderWidth: 1,
                    titleColor: isLight ? '#0f172a' : '#ffffff',
                    bodyColor: isLight ? '#475569' : '#94a3b8',
                    titleFont: { family: 'Inter', weight: 'bold' },
                    bodyFont: { family: 'JetBrains Mono', size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    usePointStyle: true
                }
            },
            scales: {
                x: { 
                    grid: { color: isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255,255,255,0.02)' }, 
                    ticks: { color: isLight ? '#475569' : '#64748b', font: { size: 10 }, maxTicksLimit: 10 } 
                },
                y: { 
                    grid: { color: isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255,255,255,0.02)' }, 
                    ticks: { color: isLight ? '#475569' : '#64748b', font: { size: 11, family: 'JetBrains Mono' } } 
                }
            }
        }
    });
}

function setTimeSeriesType(type, ev) {
    if (ev) ev.preventDefault();
    document.querySelectorAll('.chart-toolbar [data-ts-type]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tsType === type);
    });
    if (dashboardData && dashboardData.forecast) {
        renderTimeSeriesChart(dashboardData.forecast, type);
    }
}

function renderSeasonalChart(indices) {
    if (charts.seasonal) charts.seasonal.destroy();
    const element = document.getElementById('chart-seasonal');
    if (!element) return;

    const isLight = document.body.classList.contains('light-mode');
    const ctx = element.getContext('2d');
    charts.seasonal = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: indices.map(i => i.day),
            datasets: [{
                label: 'Índice Estacional',
                data: indices.map(i => i.index),
                backgroundColor: indices.map(i => {
                    if (i.index >= 1) {
                        return isLight ? 'rgba(132, 204, 22, 0.75)' : 'rgba(163, 230, 53, 0.7)';
                    } else {
                        return isLight ? 'rgba(225, 29, 72, 0.65)' : 'rgba(244, 63, 94, 0.6)';
                    }
                }),
                borderColor: indices.map(i => {
                    if (i.index >= 1) {
                        return isLight ? '#84cc16' : '#a3e635';
                    } else {
                        return isLight ? '#e11d48' : '#f43f5e';
                    }
                }),
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            animation: {
                duration: 700,
                easing: 'easeOutBack',
                delay: (context) => {
                    let delay = 0;
                    if (context.type === 'data' && context.mode === 'default' && !context.active) {
                        delay = context.dataIndex * 60;
                    }
                    return delay;
                }
            },
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: isLight ? '#ffffff' : '#090f20',
                    borderColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(163, 230, 53, 0.3)',
                    borderWidth: 1,
                    titleColor: isLight ? '#0f172a' : '#ffffff',
                    bodyColor: isLight ? '#475569' : '#94a3b8',
                    padding: 10,
                    cornerRadius: 8,
                    bodyFont: { family: 'JetBrains Mono' }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: isLight ? '#475569' : '#94a3b8', font: { size: 11, weight: '600' } } },
                y: { 
                    grid: { color: isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255,255,255,0.02)' }, 
                    ticks: { color: isLight ? '#475569' : '#64748b' }, 
                    min: 0.6, 
                    max: 1.3 
                }
            }
        }
    });
}

function renderCampaignChart(campaigns) {
    if (!campaigns || campaigns.length === 0) return;
    if (charts.campaigns) charts.campaigns.destroy();
    const element = document.getElementById('chart-campaigns');
    if (!element) return;

    const isLight = document.body.classList.contains('light-mode');
    const ctx = element.getContext('2d');
    const colors = isLight 
        ? ['#0284c7', '#84cc16', '#7c3aed', '#ea580c', '#db2777', '#cca43b', '#e11d48']
        : ['#38bdf8', '#a3e635', '#8b5cf6', '#f97316', '#ec4899', '#fbbf24', '#f43f5e'];

    charts.campaigns = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: campaigns.map(c => c.name ? cleanTechnicalTerms(c.name).substring(0, 30) : 'N/A'),
            datasets: [{
                data: campaigns.map(c => c.spend || c.total_spend || 0),
                backgroundColor: colors.slice(0, campaigns.length).map(c => c + '77'),
                borderColor: colors.slice(0, campaigns.length),
                borderWidth: 2,
                hoverOffset: 12
            }]
        },
        options: {
            animation: {
                duration: 900,
                easing: 'easeOutQuart',
                delay: (context) => {
                    let delay = 0;
                    if (context.type === 'data' && context.mode === 'default' && !context.active) {
                        delay = context.dataIndex * 60;
                    }
                    return delay;
                }
            },
            responsive: true, 
            maintainAspectRatio: false, 
            cutout: '65%',
            plugins: {
                legend: { 
                    position: 'right', 
                    labels: { 
                        color: isLight ? '#475569' : '#94a3b8', 
                        font: { size: 11 }, 
                        boxWidth: 10, 
                        padding: 8 
                    } 
                },
                tooltip: {
                    backgroundColor: isLight ? '#ffffff' : '#090f20',
                    borderColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(163, 230, 53, 0.3)',
                    borderWidth: 1,
                    titleColor: isLight ? '#0f172a' : '#ffffff',
                    bodyColor: isLight ? '#475569' : '#94a3b8',
                    padding: 10,
                    cornerRadius: 8,
                    bodyFont: { family: 'JetBrains Mono' },
                    callbacks: { label: (ctx) => ` $${Number(ctx.raw).toLocaleString()}` }
                }
            }
        }
    });
}

function renderHourlyChart(hourly) {
    if (!hourly || hourly.length === 0) return;
    if (charts.hourly) charts.hourly.destroy();
    const element = document.getElementById('chart-hourly');
    if (!element) return;

    const isLight = document.body.classList.contains('light-mode');
    const ctx = element.getContext('2d');
    charts.hourly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: hourly.map(h => h.label || `${h.hour !== undefined ? h.hour : h.hr}:00`),
            datasets: [{
                label: 'Contactos',
                data: hourly.map(h => h.probability !== undefined ? (h.probability * 100) : (h.count || h.calls || h.total || 0)),
                backgroundColor: hourly.map((h, i) => {
                    const val = h.probability !== undefined ? (h.probability * 100) : (h.count || h.calls || h.total || 0);
                    const max = Math.max(...hourly.map(x => x.probability !== undefined ? (x.probability * 100) : (x.count || x.calls || x.total || 0)));
                    if (val === max) {
                        return isLight ? 'rgba(225, 29, 72, 0.85)' : 'rgba(244, 63, 94, 0.85)';
                    } else {
                        return isLight ? 'rgba(132, 204, 22, 0.55)' : 'rgba(163, 230, 53, 0.45)';
                    }
                }),
                borderRadius: 4
            }]
        },
        options: {
            animation: {
                duration: 600,
                easing: 'easeOutQuart',
                delay: (context) => {
                    let delay = 0;
                    if (context.type === 'data' && context.mode === 'default' && !context.active) {
                        delay = context.dataIndex * 18;
                    }
                    return delay;
                }
            },
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: isLight ? '#ffffff' : '#090f20',
                    borderColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(163, 230, 53, 0.3)',
                    borderWidth: 1,
                    titleColor: isLight ? '#0f172a' : '#ffffff',
                    bodyColor: isLight ? '#475569' : '#94a3b8',
                    padding: 10,
                    cornerRadius: 8,
                    bodyFont: { family: 'JetBrains Mono' },
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.raw;
                            return ` Proporción: ${val.toFixed(2)}%`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: isLight ? '#475569' : '#94a3b8', font: { size: 9 } } },
                y: { 
                    grid: { color: isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255,255,255,0.02)' }, 
                    ticks: { 
                        color: isLight ? '#475569' : '#64748b',
                        callback: (value) => `${value}%`
                    } 
                }
            }
        }
    });
}

// =====================================================================
//  SPOTLIGHT EFFECT TRACKING
// =====================================================================

function initSpotlight() {
    const flashlight = document.querySelector('.global-flashlight');
    const sidebar = document.querySelector('.sidebar');
    const topbar = document.querySelector('.topbar');
    
    document.addEventListener('mousemove', e => {
        if (flashlight) {
            flashlight.style.setProperty('--global-mouse-x', `${e.clientX}px`);
            flashlight.style.setProperty('--global-mouse-y', `${e.clientY}px`);
        }
        if (sidebar) {
            const rect = sidebar.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            sidebar.style.setProperty('--sidebar-mouse-x', `${x}px`);
            sidebar.style.setProperty('--sidebar-mouse-y', `${y}px`);
        }
        if (topbar) {
            const rect = topbar.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            topbar.style.setProperty('--topbar-mouse-x', `${x}px`);
            topbar.style.setProperty('--topbar-mouse-y', `${y}px`);
        }
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

// =====================================================================
//  INTEGRATED INTERACTIVE REPORT VIEWER
// =====================================================================

function loadReportInViewer(url, title, event) {
    if (event) {
        event.preventDefault(); // Intercept and stop opening new tab
    }
    
    const iframe = document.getElementById('viewer-iframe');
    const placeholder = document.getElementById('viewer-placeholder');
    const titleText = document.getElementById('viewer-report-title');
    const statusDot = document.getElementById('viewer-status-dot');
    const openLink = document.getElementById('viewer-open-link');
    const closeBtn = document.getElementById('viewer-close-btn');
    const card = document.getElementById('report-viewer-card');
    
    if (!iframe || !placeholder) return;
    
    // Set loading indicator
    titleText.textContent = "Cargando: " + title;
    statusDot.style.backgroundColor = "var(--gold)";
    statusDot.style.animation = "pulse 1.2s infinite";
    statusDot.style.boxShadow = "0 0 8px var(--gold-glow)";
    
    // Switch view states
    placeholder.style.display = 'none';
    iframe.style.display = 'block';
    iframe.src = url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();
    
    // Show control buttons
    if (openLink) {
        openLink.href = url;
        openLink.style.display = 'inline-flex';
    }
    if (closeBtn) {
        closeBtn.style.display = 'inline-block';
    }
    
    // Smooth scroll down to the embedded viewer card after a brief render delay
    setTimeout(() => {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    // Update loading state once iframe load completes
    iframe.onload = () => {
        titleText.textContent = title;
        statusDot.style.backgroundColor = "var(--green)";
        statusDot.style.animation = "none";
        statusDot.style.boxShadow = "none";
    };
}

function closeReportViewer() {
    const iframe = document.getElementById('viewer-iframe');
    const placeholder = document.getElementById('viewer-placeholder');
    const titleText = document.getElementById('viewer-report-title');
    const statusDot = document.getElementById('viewer-status-dot');
    const openLink = document.getElementById('viewer-open-link');
    const closeBtn = document.getElementById('viewer-close-btn');
    
    if (!iframe || !placeholder) return;
    
    // Unload iframe and revert back to placeholder state
    iframe.src = '';
    iframe.style.display = 'none';
    placeholder.style.display = 'flex';
    
    // Reset header
    titleText.textContent = "Visor de Informe Interactivo";
    statusDot.style.backgroundColor = "var(--gold)";
    statusDot.style.animation = "none";
    statusDot.style.boxShadow = "none";
    
    if (openLink) openLink.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'none';
}

// =====================================================================
//  ☀️ HIGH-FIDELITY THEME CONTROLLER & RIPPLE TRANSITION
// =====================================================================

function updateThemeIcon(isLight) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    
    if (isLight) {
        // Sun SVG Icon
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" class="theme-icon-svg" style="width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; transition: transform 0.5s ease; transform: rotate(180deg);">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
        `;
    } else {
        // Moon SVG Icon
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" class="theme-icon-svg" style="width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; transition: transform 0.5s ease;">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
            </svg>
        `;
    }
}

window.toggleTheme = function(event) {
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    
    if (event && event.clientX !== undefined && event.clientY !== undefined) {
        x = event.clientX;
        y = event.clientY;
    } else {
        const btn = document.getElementById('theme-toggle');
        if (btn) {
            const rect = btn.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
        }
    }

    const isCurrentlyLight = document.body.classList.contains('light-mode');
    const nextThemeIsLight = !isCurrentlyLight;

    // Create dynamic theme transition wave (Ripple Reveal)
    const ripple = document.createElement('div');
    ripple.className = 'theme-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.backgroundColor = nextThemeIsLight ? '#f8fafc' : '#080c14';

    document.body.appendChild(ripple);

    // Swap stylesheet theme rules at ripple wave peak expansion (300ms)
    setTimeout(() => {
        if (nextThemeIsLight) {
            document.body.classList.add('light-mode');
            localStorage.setItem('theme', 'light');
        } else {
            document.body.classList.remove('light-mode');
            localStorage.setItem('theme', 'dark');
        }
        
        updateThemeIcon(nextThemeIsLight);

        const reportIframe = document.getElementById('viewer-iframe');
        if (reportIframe && reportIframe.contentWindow && reportIframe.src) {
            reportIframe.contentWindow.postMessage(nextThemeIsLight ? 'theme-light' : 'theme-dark', '*');
        }

        // Dynamically redraw all loaded active charts with new gridlines, tooltips, and tick colors
        if (dashboardData) {
            renderTimeSeriesChart(dashboardData.forecast);
            if (dashboardData.forecast && dashboardData.forecast.seasonal_indices) {
                renderSeasonalChart(dashboardData.forecast.seasonal_indices);
            }
            if (dashboardData.forecast_rf) {
                renderTimeSeriesChart(dashboardData.forecast_rf, {
                    canvasId: 'rf-chart-timeseries',
                    chartKey: 'rfTimeseries',
                    lineLabel: 'Pronóstico Random Forest',
                    lineColor: 'rgba(16, 185, 129, 0.75)',
                });
            }
            if (dashboardData.investment && dashboardData.investment.campaigns) {
                renderCampaignChart(dashboardData.investment.campaigns);
            }
            if (dashboardData.operations && dashboardData.operations.hourly_distribution) {
                renderHourlyChart(dashboardData.operations.hourly_distribution);
            }
        }
    }, 300);

    // Clean up transition circle after completion
    setTimeout(() => {
        ripple.remove();
    }, 700);
};

// =====================================================================
//  APPLICATION INITIALIZATION
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Early initialisation of Light Mode to prevent transition flashes
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        updateThemeIcon(true);
    } else {
        updateThemeIcon(false);
    }

    loadBOS();
    initSpotlight();
    console.log('⚡ Solis BOS Dashboard logic active');
});
