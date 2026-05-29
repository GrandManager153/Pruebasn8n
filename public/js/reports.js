/* =====================================================================
   BOS Panel — Motor de animaciones para informes HTML (n8n)
   Contadores, gráficas, transiciones de sección y tanque líquido KPI
   ===================================================================== */

(function () {
    'use strict';

    let kpiChart = null;
    let healthChart = null;
    let alertsChart = null;

    // ── Tema (sincronizado con el panel principal) ──
    function applyTheme(theme) {
        document.body.classList.toggle('light-mode', theme === 'light');
        if (kpiChart || healthChart || alertsChart) {
            renderAllCharts();
        }
    }

    function initTheme() {
        applyTheme(localStorage.getItem('theme') || 'dark');
        window.addEventListener('message', (e) => {
            if (e.data === 'theme-light') applyTheme('light');
            if (e.data === 'theme-dark') applyTheme('dark');
        });
        if (window.parent !== window) {
            const bar = document.querySelector('.report-back-bar');
            if (bar) bar.style.display = 'none';
        }
    }

    function isLight() {
        return document.body.classList.contains('light-mode');
    }

    function chartColors() {
        return isLight()
            ? { text: '#475569', grid: 'rgba(15,23,42,0.06)', blue: '#0284c7', lime: '#84cc16', crimson: '#e11d48', amber: '#d97706' }
            : { text: '#94a3b8', grid: 'rgba(255,255,255,0.04)', blue: '#38bdf8', lime: '#a3e635', crimson: '#f43f5e', amber: '#fbbf24' };
    }

    // ── Contadores animados (misma lógica que app.js) ──
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

    function parseAndAnimate(element, rawValue, duration = 750) {
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

    // ── Tarjetas con entrada escalonada ──
    function staggerCards(container) {
        if (!container) return;
        const cards = container.querySelectorAll('.card-animate');
        cards.forEach((card, idx) => {
            card.style.animationDelay = `${idx * 0.04}s`;
            card.classList.remove('card-animate-run');
            void card.offsetWidth;
            card.classList.add('card-animate-run');
        });
    }

    // ── Tanque líquido en primer KPI (Health Score) ──
    function initLiquidHealthKpi() {
        const firstKpi = document.querySelector('.kpi-row .kpi');
        if (!firstKpi) return;

        const valEl = firstKpi.querySelector('.kpi-value');
        if (!valEl) return;

        const raw = valEl.textContent.trim();
        valEl.setAttribute('data-value', raw);

        const scoreMatch = raw.match(/(\d+)\s*\/\s*100/);
        const score = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))) : 0;
        const tone = score >= 80 ? 'good' : score >= 60 ? 'warn' : 'critical';

        firstKpi.classList.add('report-liquid-kpi', `liquid-tone-${tone}`);
        firstKpi.dataset.fillTarget = score;

        const fill = document.createElement('div');
        fill.className = 'report-liquid-fill';
        fill.innerHTML = '<div class="report-liquid-surface report-liquid-surface--1"></div><div class="report-liquid-surface report-liquid-surface--2"></div>';
        firstKpi.insertBefore(fill, firstKpi.firstChild);

        firstKpi.style.setProperty('--fill-level', '0');
        requestAnimationFrame(() => {
            firstKpi.style.setProperty('--fill-level', score);
        });
    }

    // ── Preparar KPIs con data-value ──
    function prepareKpiValues() {
        document.querySelectorAll('.kpi-value').forEach(el => {
            if (!el.getAttribute('data-value')) {
                el.setAttribute('data-value', el.textContent.trim());
            }
        });
    }

    // ── Insertar contenedores de gráficas ──
    function injectChartContainers() {
        const narrativa = document.getElementById('narrativa');
        if (!narrativa || narrativa.querySelector('.report-charts-row')) return;

        const kpiRow = narrativa.querySelector('.kpi-row');
        if (!kpiRow) return;

        const chartsRow = document.createElement('div');
        chartsRow.className = 'report-charts-row';
        chartsRow.innerHTML = `
            <div class="report-chart-card card-animate">
                <div class="report-chart-title"><span class="dot"></span> Indicadores Clave del Informe</div>
                <div class="report-chart-wrap"><canvas id="report-kpi-chart"></canvas></div>
            </div>
            <div class="report-chart-card card-animate">
                <div class="report-chart-title"><span class="dot dot-lime"></span> Salud del Sistema</div>
                <div class="report-chart-wrap report-chart-wrap--donut"><canvas id="report-health-chart"></canvas></div>
            </div>
        `;
        kpiRow.insertAdjacentElement('afterend', chartsRow);
    }

    function injectAlertsChart() {
        const alertas = document.getElementById('alertas');
        if (!alertas || alertas.querySelector('#report-alerts-chart')) return;

        const cards = alertas.querySelectorAll('.alert-card');
        if (!cards.length) return;

        const wrap = document.createElement('div');
        wrap.className = 'report-chart-card card-animate report-alerts-chart-card';
        wrap.innerHTML = `
            <div class="report-chart-title"><span class="dot dot-crimson"></span> Distribución de Alertas</div>
            <div class="report-chart-wrap report-chart-wrap--bar"><canvas id="report-alerts-chart"></canvas></div>
        `;
        alertas.insertBefore(wrap, alertas.firstChild);
    }

    function collectKpiChartData() {
        const kpis = [];
        document.querySelectorAll('#narrativa .kpi-row .kpi').forEach((kpi, idx) => {
            if (idx === 0) return;
            const label = kpi.querySelector('.kpi-label')?.textContent?.trim() || `KPI ${idx}`;
            const raw = kpi.querySelector('.kpi-value')?.getAttribute('data-value') || '';
            const num = parseFloat(String(raw).replace(/[$\s%,~]/g, '').split('/')[0]);
            if (!isNaN(num) && isFinite(num) && Math.abs(num) > 0 && !raw.includes(':')) {
                kpis.push({ label: label.length > 18 ? label.slice(0, 16) + '…' : label, value: Math.abs(num) });
            }
        });
        return kpis.slice(0, 6);
    }

    function getHealthScore() {
        const first = document.querySelector('.kpi-row .kpi .kpi-value');
        if (!first) return 0;
        const raw = first.getAttribute('data-value') || first.textContent;
        const m = String(raw).match(/(\d+)\s*\/\s*100/);
        return m ? parseInt(m[1], 10) : 0;
    }

    function countAlertsByType() {
        let critical = 0, warning = 0, info = 0;
        document.querySelectorAll('#alertas .alert-card').forEach(card => {
            const badge = card.querySelector('.alert-badge')?.textContent?.toUpperCase() || '';
            if (badge.includes('CRIT')) critical++;
            else if (badge.includes('ALERT') || badge.includes('ADVERT')) warning++;
            else info++;
        });
        return { critical, warning, info };
    }

    function renderAllCharts() {
        if (typeof Chart === 'undefined') return;
        const c = chartColors();

        // KPI bar chart
        const kpiCanvas = document.getElementById('report-kpi-chart');
        if (kpiCanvas) {
            const data = collectKpiChartData();
            if (kpiChart) kpiChart.destroy();
            if (data.length) {
                kpiChart = new Chart(kpiCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: data.map(d => d.label),
                        datasets: [{
                            label: 'Valor',
                            data: data.map(d => d.value),
                            backgroundColor: isLight() ? 'rgba(2,132,199,0.55)' : 'rgba(56,189,248,0.45)',
                            borderColor: c.blue,
                            borderWidth: 1,
                            borderRadius: 8
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: { duration: 900, easing: 'easeOutQuart' },
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { ticks: { color: c.text, font: { size: 10, family: 'Inter' } }, grid: { display: false } },
                            y: { ticks: { color: c.text, font: { size: 10, family: 'JetBrains Mono' } }, grid: { color: c.grid } }
                        }
                    }
                });
            }
        }

        // Health doughnut
        const healthCanvas = document.getElementById('report-health-chart');
        if (healthCanvas) {
            const score = getHealthScore();
            if (healthChart) healthChart.destroy();
            healthChart = new Chart(healthCanvas.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Salud', 'Pendiente'],
                    datasets: [{
                        data: [score, Math.max(0, 100 - score)],
                        backgroundColor: [c.lime, isLight() ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)'],
                        borderWidth: 0,
                        hoverOffset: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '72%',
                    animation: { animateRotate: true, duration: 1200 },
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: true }
                    }
                }
            });
        }

        // Alerts bar chart
        const alertsCanvas = document.getElementById('report-alerts-chart');
        if (alertsCanvas) {
            const counts = countAlertsByType();
            if (alertsChart) alertsChart.destroy();
            alertsChart = new Chart(alertsCanvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['Críticas', 'Advertencias', 'Informativas'],
                    datasets: [{
                        data: [counts.critical, counts.warning, counts.info],
                        backgroundColor: [c.crimson, c.amber, c.blue],
                        borderRadius: 8,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 800 },
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: c.text, font: { size: 11, family: 'Inter' } }, grid: { display: false } },
                        y: { beginAtZero: true, ticks: { stepSize: 1, color: c.text }, grid: { color: c.grid } }
                    }
                }
            });
        }
    }

    // ── Navegación entre secciones con animación ──
    window.showTab = function (id, btn) {
        const current = document.querySelector('.tc.active');
        const next = document.getElementById(id);
        if (!next || current === next) return;

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        if (btn) btn.classList.add('active');

        const switchToNext = () => {
            document.querySelectorAll('.tc').forEach(el => el.classList.remove('active', 'tc-leave', 'tc-enter'));
            next.classList.add('active', 'tc-enter');
            animateCountersIn(next);
            staggerCards(next);
            if (id === 'narrativa') renderAllCharts();
            if (id === 'alertas') {
                injectAlertsChart();
                renderAllCharts();
            }
            setTimeout(() => next.classList.remove('tc-enter'), 450);
        };

        if (current) {
            current.classList.add('tc-leave');
            setTimeout(switchToNext, 220);
        } else {
            switchToNext();
        }
    };

    // ── Spotlight en tarjetas (como el panel) ──
    function initSpotlight() {
        document.querySelectorAll('.kpi, .content-block, .alert-card, .action-card, .report-chart-card').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
            });
        });
    }

    // ── Inicialización ──
    function initReportAnimations() {
        initTheme();
        prepareKpiValues();
        initLiquidHealthKpi();
        injectChartContainers();
        injectAlertsChart();

        document.querySelectorAll('.kpi, .content-block, .alert-card, .action-card, .hero, .report-chart-card').forEach(el => {
            el.classList.add('card-animate');
        });

        const active = document.querySelector('.tc.active') || document.getElementById('narrativa');
        if (active) {
            active.classList.add('tc-enter');
            animateCountersIn(active);
            staggerCards(active);
            setTimeout(() => active.classList.remove('tc-enter'), 450);
        }

        renderAllCharts();
        initSpotlight();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initReportAnimations);
    } else {
        initReportAnimations();
    }
})();
