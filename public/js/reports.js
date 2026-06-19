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
            const isHeading = child.tagName === 'H2' || child.tagName === 'H3' || 
                              (child.tagName === 'P' && child.querySelector('strong')) ||
                              (child.tagName === 'P' && (child.style.fontWeight === '800' || child.style.fontWeight === 'bold' || 
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
            executive: ['cpl', 'gasto', 'inversion', 'concentracion', 'hhi', 'sobre-contacto', 'mase', 'prevision', 'health score'],
            manager: ['feeder', 'conversion', 'intentos', 'intervalo', 'llamadas', 'sobre-contacto'],
            analyst: ['mase', 'ensemble', 'theta_lite', 'hhi', 'regresion', 'prevision', 'sweet spot', 'diversificacion'],
            operations: ['intentos', 'intervalo', 'demoras', 'sobre-contacto', 'marcacion', 'llamadas']
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

    // ── Embedded preview: expand collapsible sections ──
    function setupEmbeddedPreview() {
        if (window.parent === window) return;
        document.querySelectorAll('.info-section').forEach((section) => {
            section.classList.add('open');
        });
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

    function applyPageBreaks() {
        const contentBlock = document.querySelector('.content-block');
        if (!contentBlock) return;
        
        // Find all heading elements inside content-block
        const inlineHeadings = Array.from(contentBlock.children).filter(child => {
            return child.tagName === 'H2' || 
                   child.tagName === 'H3' || 
                   (child.tagName === 'P' && child.querySelector('strong')) ||
                   (child.tagName === 'P' && (child.style.fontWeight === '800' || child.style.fontWeight === 'bold' || 
                    child.getAttribute('style')?.includes('font-weight:800') || child.getAttribute('style')?.includes('font-weight: 800')));
        });
        
        // Combine them with the main sections (#alertas and #acciones) in order
        const allSections = [...inlineHeadings];
        
        const alertasSec = document.getElementById('alertas');
        if (alertasSec) allSections.push(alertasSec);
        
        const accionesSec = document.getElementById('acciones');
        if (accionesSec) allSections.push(accionesSec);
        
        // For every 2nd heading starting from the 3rd, add the print break class
        allSections.forEach((sec, index) => {
            if (index > 0 && index % 2 === 0) {
                sec.classList.add('print-page-break');
            }
        });
    }

    // ── Inicialización ──
    function initReportAnimations() {
        initTheme();
        prepareKpiValues();
        injectLatexAbstract();
        
        const audience = getAudience();
        document.body.classList.add(`theme-${audience}`);
<<<<<<< HEAD
=======
        
>>>>>>> e00ff852f96008c6ddb9d6eefdee1dbee028df70
        // Analyst report is the full data audit — show all KPIs, narrative, alerts and actions
        if (audience !== 'analyst') {
            filterKpisByAudience(audience);
            filterContentByAudience(audience);
            filterAlertsAndActionsByAudience(audience);
        }

        setupEmbeddedPreview();
<<<<<<< HEAD

=======
        
>>>>>>> e00ff852f96008c6ddb9d6eefdee1dbee028df70
        injectKpiHelpTooltips();
        applyPageBreaks();
        injectChartContainers();
        injectAlertsChart();

        const active = document.querySelector('.tc.active') || document.getElementById('narrativa');
        if (active) {
            active.classList.add('active');
            animateCountersIn(active);
            staggerCards(active);
        }

        renderAllCharts();

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
