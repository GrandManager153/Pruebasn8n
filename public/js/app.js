/* =====================================================================
   💎 Solis BOS - Frontend Application Logic
   Premium Interactive Dashboard with Dynamic Counter Animations
   ===================================================================== */

let dashboardData = null;
let dashboardHistory = null;
let charts = {};
let comparableModelsCache = null;
const termCache = new Map();
const renderedTabs = new Set();
const PERF = { lite: true };

let currentTab = 'dashboard';
let currentAlertFilter = 'all';
let currentRecurrenceFilter = 'all';
let timeSeriesType = 'line';
let dailyVolumeType = 'bar';
let selectedCompareModel = '';
let showAllModels = false;
let visibleModelNames = new Set();

function clearComparableModelsCache() {
    comparableModelsCache = null;
}

function clearTermCache() {
    termCache.clear();
}

function shouldAnimateUI() {
    return !PERF.lite && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getChartAnimationOptions(heavy = false) {
    if (PERF.lite || heavy) return false;
    return { duration: 280, easing: 'easeOutQuart' };
}

function shouldAnimateForecastChart() {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getForecastChartAnimationOptions(heavy = false) {
    if (!shouldAnimateForecastChart()) return false;
    if (heavy) {
        return { duration: 500, easing: 'easeOutQuart' };
    }
    return {
        duration: 900,
        easing: 'easeOutQuart',
        delay: (context) => {
            if (context.type === 'data' && context.mode === 'default' && !context.active) {
                return context.dataIndex * 15;
            }
            return 0;
        },
    };
}

function shouldAnimateInvestmentChart() {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getInvestmentChartAnimationOptions() {
    if (!shouldAnimateInvestmentChart()) return false;
    return {
        animateRotate: true,
        animateScale: true,
        duration: 1100,
        easing: 'easeOutCubic',
        delay: (context) => {
            if (context.type === 'data' && context.mode === 'default') {
                return context.dataIndex * 80;
            }
            return 0;
        },
    };
}

function replayInvestmentChartAnimation() {
    const chart = charts.campaigns;
    if (!chart || !shouldAnimateInvestmentChart()) return;
    chart.reset();
    chart.update('active');
}

function scheduleDeferredRender(fn) {
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => fn(), { timeout: 1500 });
    } else {
        setTimeout(fn, 60);
    }
}

function initPerformanceMode() {
    if (PERF.lite) document.body.classList.add('perf-lite');
}

function applyProgressBars(root, animate = shouldAnimateUI()) {
    const scope = root || document;
    scope.querySelectorAll('.progress-bar-fill[data-pct], .mase-bar-fill[data-pct]').forEach(bar => {
        const pct = bar.getAttribute('data-pct');
        if (pct == null) return;
        if (animate) {
            bar.style.width = '0%';
            void bar.offsetWidth;
            bar.style.width = pct + '%';
        } else {
            bar.style.width = pct + '%';
        }
    });
}

function ensureTabRendered(tabId) {
    if (!dashboardData) return;
    switch (tabId) {
        case 'funnel':
            if (!renderedTabs.has('funnel')) {
                renderFunnelDetails(dashboardData);
                renderedTabs.add('funnel');
            }
            applyProgressBars(document.getElementById('tab-funnel'));
            break;
        case 'forecast': {
            const data = dashboardData;
            if (!renderedTabs.has('forecast-content')) {
                renderForecastDetails(data.forecast || {}, {
                    prefix: '',
                    show14d: true,
                    showChangepoint: true,
                    horizons: getBestModelHorizons(data),
                    bestModelName: getBestForecastRecord(data)?.modelName || data.forecast?.method,
                });
                populateModelCompareDropdown(data);
                renderedTabs.add('forecast-content');
            }
            if (!renderedTabs.has('forecast-chart')) {
                showBestModelOnLoad(data);
                renderedTabs.add('forecast-chart');
            }
            applyProgressBars(document.getElementById('tab-forecast'));
            break;
        }
        case 'investment':
            if (dashboardData.investment?.campaigns) {
                if (!renderedTabs.has('investment-chart')) {
                    renderCampaignChart(dashboardData.investment.campaigns);
                    renderedTabs.add('investment-chart');
                } else {
                    replayInvestmentChartAnimation();
                }
            }
            break;
        case 'operations':
            if (!renderedTabs.has('operations-content')) {
                renderOperationsTab(dashboardData, { charts: false });
                renderedTabs.add('operations-content');
            }
            if (!renderedTabs.has('operations-charts')) {
                const ops = dashboardData.operations;
                if (ops) {
                    renderDailyVolumeChart(ops);
                    const seasonalIndices = dashboardData.operations?.seasonal_indices
                        || dashboardData.forecast?.seasonal_indices;
                    if (seasonalIndices) renderSeasonalChart(seasonalIndices);
                    renderHourlyChart(ops.hourly_distribution);
                }
                renderedTabs.add('operations-charts');
            }
            break;
        case 'alerts':
            if (!renderedTabs.has('alerts')) {
                renderAlertsCentre(dashboardData.system.alerts);
                renderedTabs.add('alerts');
            }
            applyProgressBars(document.getElementById('tab-alerts'));
            break;
        default:
            break;
    }
}

// =====================================================================
//  📘 INDUSTRY TERMS — English term + Spanish gloss in parentheses
// =====================================================================

/** Backend KPI label → display label (término en inglés + descripción en español). */
const KPI_BACKEND_LABEL_MAP = {
    'Health Score': 'Salud del Sistema',
    'Leads totales': 'Leads Totales',
    'Promedio diario': 'Promedio Diario',
    'Cambio semanal': 'Cambio Semanal',
    'Hora pico': 'Hora Pico',
    'Prevision diaria': 'Pronóstico Diario',
    'MASE': 'Precisión del Modelo',
    'CPL implicito': 'Costo por Lead',
    'Gasto total': 'Inversión Publicitaria',
    'HHI': 'Diversificación de Pauta',
    'Conversion global': 'Conversión Global',
    'Revenue at Risk': 'Ingreso en Riesgo',
    'Utilizacion capacidad': 'Uso de Capacidad',
    'Cambio regimen': 'Cambio de Régimen',
};

const INDUSTRY_INLINE_REPLACEMENTS = [
    [/\bCPL implicito\b/gi, 'CPL (costo por lead)'],
    [/\bensemble_weighted\b/gi, 'ensemble ponderado'],
    [/\bsupera baseline\b/gi, 'supera línea base (<1)'],
    [/\bno supera baseline\b/gi, 'no supera línea base (≥1)'],
    [/\bbaseline\b/gi, 'baseline (línea base)'],
    [/\bFeeder a conversion:\s*/gi, 'Feeder (ruta de conversión): '],
    [/\bfeeders\b/gi, 'feeders (rutas que convierten)'],
    [/\bfugas\b/gi, 'leaks (fugas del embudo)'],
    [/\bRPN\b/g, 'RPN (prioridad de riesgo)'],
    [/\bMASE comparado:\s*/gi, 'MASE (comparado): '],
    [/\bIntentos Avg\b/g, 'Avg Dial Attempts (intentos promedio)'],
    [/\bIntervalo Avg\b/g, 'Avg Callback Interval (min entre intentos)'],
];

function formatKpiLabel(backendLabel) {
    if (!backendLabel || typeof backendLabel !== 'string') return backendLabel;
    return KPI_BACKEND_LABEL_MAP[backendLabel] || backendLabel;
}

function applyIndustryInlineTerms(text) {
    if (!text || typeof text !== 'string') return text;
    let out = text;
    INDUSTRY_INLINE_REPLACEMENTS.forEach(([pattern, replacement]) => {
        out = out.replace(pattern, replacement);
    });
    return out;
}

function resolveKpiExplanationKey(label) {
    if (!label) return null;
    if (KPI_EXPLANATIONS[label]) return label;
    const upper = label.trim().toUpperCase();
    const backendKey = Object.keys(KPI_BACKEND_LABEL_MAP).find(
        (k) => KPI_BACKEND_LABEL_MAP[k] === label
    );
    if (backendKey && KPI_EXPLANATIONS[backendKey]) return backendKey;
    const alias = KPI_EXPLANATION_ALIASES[label] || KPI_EXPLANATION_ALIASES[upper];
    if (alias && KPI_EXPLANATIONS[alias]) return alias;
    for (const key of Object.keys(KPI_EXPLANATIONS)) {
        const keyUpper = key.toUpperCase();
        if (upper.includes(keyUpper) || keyUpper.includes(upper)) return key;
    }
    return null;
}

// =====================================================================
//  📘 KPI EXPLANATION DICTIONARY & MODAL CONTROLLER
// =====================================================================

/** Legacy Spanish labels still used in static HTML onclick handlers. */
const KPI_EXPLANATION_ALIASES = {
    'Salud del Sistema': 'Health Score',
    'Pronóstico Diario': 'Prevision diaria',
    'Precisión del Modelo': 'MASE',
    'Costo Promedio por Lead': 'CPL implicito',
    'Inversión Publicitaria': 'Gasto total',
    'Diversificación de Pauta': 'HHI',
    'Tasa Global de Conversión': 'Conversion global',
    'Global CVR (tasa de conversión global)': 'Conversion global',
    'Tasa de conversión': 'Conversion global',
    'Ingresos en Riesgo Estimados': 'Revenue at Risk',
    'Revenue at Risk (ingreso en riesgo)': 'Revenue at Risk',
    'Ingreso en riesgo': 'Revenue at Risk',
    'Severidad Máxima': 'RPN max',
    'Regime Shift (cambio estructural de demanda)': 'Cambio de Régimen',
    'Cambio de Régimen': 'Cambio de Régimen',

    // Operaciones diarias — etiquetas bilingües de las tarjetas
    'Total Records (Registros de Llamadas)': 'Registros',
    'Unique Leads (Contactos Únicos)': 'Contactos',
    'Avg Dial Attempts (Intentos Promedio)': 'Promedio Intentos',
    'Avg Callback Interval (Demora entre Re-intentos)': 'Avg Callback Interval (min entre intentos)',
    'First Contact Rate (Tasa de Primer Contacto)': 'First Contact Rate',
    'First Contact Rate': 'First Contact Rate',
    'Sweet Spot % (Intentos 1–3)': 'Sweet Spot %',
    'Sweet Spot %': 'Sweet Spot %',
    'Dial Efficiency (Eficiencia de Marcación)': 'Dial Efficiency',
    'Dial Efficiency': 'Dial Efficiency',
    'Overcontact Index (Llamadas >7 est.)': 'Overcontact Index',
    'Overcontact Index': 'Overcontact Index',
    'Tasa de llegada (λ)': 'Tasa de llegada (λ)',
    'Tiempo de servicio (W)': 'Tiempo de servicio (W)',
    'Cola estimada (L)': 'Cola estimada (L)',
    'Presión de staffing': 'Presión de staffing',
    'Presión staffing': 'Presión de staffing',
};

const KPI_EXPLANATIONS = {
    'Health Score': {
        icon: '💓',
        definition: 'SHS: indicador compuesto de 0 a 100 que resume el estado general de toda la operación comercial. Combina eficiencia del call center, calidad de contacto, velocidad de respuesta y balance de inversión publicitaria.',
        interpretation: 'Un valor de 80+ indica un sistema saludable. Entre 60-79, el sistema está bajo presión y requiere atención en áreas específicas. Por debajo de 60 indica estado crítico con problemas que afectan directamente los ingresos.',
        source: 'Calculado por el Motor PulseMkt — combina métricas de operaciones, embudo y finanzas'
    },
    'Leads totales': {
        icon: '👥',
        definition: 'La cantidad total de prospectos (personas interesadas) que han ingresado al sistema durante el periodo analizado. Cada "lead" es un contacto potencial que podría convertirse en cliente.',
        interpretation: 'Este número refleja el volumen de demanda que el equipo debe atender. Un volumen muy alto sin suficientes agentes puede saturar el call center; un volumen muy bajo puede indicar problemas con la pauta publicitaria.',
        source: 'Conteo directo del CRM integrado vía n8n — campo: total_leads'
    },
    'Promedio diario': {
        icon: '📊',
        definition: 'El número promedio de leads nuevos que ingresan al sistema cada día. Se calcula dividiendo el total de leads entre la cantidad de días del periodo analizado.',
        interpretation: 'Sirve para planear la capacidad operativa del equipo. Si el promedio es 265, el call center debe estar preparado para atender al menos esa cantidad de contactos nuevos diariamente.',
        source: 'Cálculo: total_leads ÷ total_days — fuente: n8n operations.avg_daily'
    },
    'Hora pico': {
        icon: '⏰',
        definition: 'La hora del día en que se recibe el mayor volumen de contactos telefónicos y leads. Es el momento de máxima actividad del call center.',
        interpretation: 'El equipo de agentes debe estar a su máxima capacidad durante esta hora. Si los agentes están en turno en horarios distintos, se desperdicia capacidad de contacto cuando más se necesita.',
        source: 'Análisis de distribución horaria del CRM — fuente: n8n operations.peak_hour'
    },
    'Prevision diaria': {
        icon: '🔮',
        definition: 'Daily Forecast: predicción del modelo sobre cuántos leads se recibirán mañana. Se calcula con time-series models (p. ej. theta_lite) que capturan patrones históricos y estacionalidad.',
        interpretation: 'El símbolo "~" indica aproximación. Con intervalos de confianza (p. ej. 80%), útil para staffing del call center al día siguiente.',
        source: 'Mejor modelo por MASE en forecast + forecast_rf — recommended_value / next_1d'
    },
    'MASE': {
        icon: '🎯',
        definition: 'MASE (error medio absoluto escalado): mide el error promedio del pronóstico en el holdout de prueba (30% final del histórico), ajustado por una línea base estacional. Si el valor es menor a 1.0, el modelo predice mejor que repetir el dato de la semana pasada.',
        interpretation: 'Referencia del área: < 0.75 excelente; 0.75–1.0 aceptable; ≥ 1.0 no supera la línea base (usar con cautela). La línea punteada vertical en la gráfica marca el corte entre entrenamiento (70%) y prueba (30%).',
        source: 'Menor MASE entre modelos evaluados solo en la ventana de holdout (30% test)'
    },
    'CPL implicito': {
        icon: '💰',
        definition: 'CPL: costo implícito por prospecto. Gasto total ÷ leads totales en el periodo.',
        interpretation: 'A menor CPL, mejor. Comparar contra el ingreso promedio por caso cerrado para evaluar rentabilidad de pauta.',
        source: 'investment.cpl.global_cpl'
    },
    'Gasto total': {
        icon: '📢',
        definition: 'Ad Spend: monto total invertido en paid media (Meta, Google, etc.) en el periodo.',
        interpretation: 'Analizar junto con CPL y volumen de leads. Spend alto sin leads proporcionales sugiere audience fatigue o mala segmentación.',
        source: 'investment.total_spend'
    },
    'HHI': {
        icon: '🎲',
        definition: 'HHI: índice de concentración del gasto entre campañas. Cerca de 0 = diversificado; cerca de 1 = dependencia de pocas campañas.',
        interpretation: '< 0.15 diversificado; 0.15–0.25 moderado; > 0.25 riesgo de concentración en poca pauta.',
        source: 'investment.mmm.hhi_index'
    },
    'Conversion global': {
        icon: '🎯',
        definition: 'Porcentaje de consultas agendadas respecto al total de leads del periodo (operations.total_leads). Incluye todas las variantes de Consult Booked.',
        interpretation: '> 5% suele ser fuerte en este sector; < 3.5% sugiere fuga temprana o leads no calificados por creativo/audiencia.',
        source: 'funnel.conversion_pct — (consultas agendadas ÷ leads totales del periodo) × 100'
    },
    'Revenue at Risk': {
        icon: '💸',
        definition: 'Estimación del costo de oportunidad por fugas: suma de eventos de fuga (top N) × valor por conversión configurado (p. ej. $1,200 USD). No es ingreso contable ni cuenta leads únicos.',
        interpretation: 'Proxy de ineficiencia operativa. Sirve para comparar periodos y priorizar fugas de alto volumen, no como cifra financiera exacta.',
        source: 'funnel.total_revenue_at_risk'
    },
    'Cambio semanal': {
        icon: '📈',
        definition: 'WoW: cambio porcentual del volumen de leads vs la semana anterior.',
        interpretation: 'Caídas > 10% pueden indicar fatiga de creativos o cambio de mercado. Subidas > 15% pueden requerir más agentes en el floor.',
        source: 'operations.wow_change_pct'
    },
    'RPN max': {
        icon: '⚡',
        definition: 'RPN: puntaje estilo FMEA = Severidad × Ocurrencia × Detección. El máximo activo prioriza qué alerta atender primero.',
        interpretation: 'RPN > 400 = prioridad crítica en la cola de incidentes operativos.',
        source: 'system.alerts — max rpn_score'
    },
    'Leads Hoy': {
        icon: '📅',
        definition: 'La cantidad de leads recibidos en el día más reciente del que se tiene registro en el sistema. Este dato refleja el pulso operativo inmediato del negocio.',
        interpretation: 'Compáralo con el promedio diario para saber si el día fue mejor o peor de lo esperado. Si es significativamente más alto que el pronóstico, verifica que los agentes puedan responder a todos los contactos entrantes.',
        source: 'Dato del último día registrado — fuente: n8n operations.latest.leads'
    },
    'Máximo Diario': {
        icon: '🔺',
        definition: 'El mayor número de leads recibidos en un solo día durante todo el periodo analizado. Representa el pico histórico de demanda que el sistema ha tenido que procesar.',
        interpretation: 'Este valor define el techo de capacidad que el call center debe poder manejar. Si el equipo no tuvo problemas ese día, la capacidad es adecuada. Si hubo colas y leads sin atender, se necesita aumentar personal para picos similares.',
        source: 'Máximo de la serie diaria de volúmenes — fuente: n8n operations.max_daily'
    },
    'Tasa de Sobre-Contacto': {
        icon: '⚠️',
        definition: 'El porcentaje de llamadas que han excedido los 7 intentos de contacto (el "sweet spot" recomendado). Cada intento adicional después del séptimo tiene un retorno marginal decreciente, es decir, es muy poco probable que se logre el contacto.',
        interpretation: 'Valores por debajo de 15% son aceptables. Entre 15% y 30% es moderado. Por encima de 30% indica un problema grave: los agentes están desperdiciando tiempo y esfuerzo en leads que probablemente nunca contestarán, en vez de atender leads frescos.',
        source: 'Distribución de intentos de contacto del CRM — fuente: n8n operations.contact_distribution.overcontact_pct'
    },
    'Promedio Intentos': {
        icon: '📞',
        definition: 'El número promedio de veces que un agente marca a cada lead antes de lograr contacto o abandonar el intento. Es una medida directa de la eficiencia del call center.',
        interpretation: 'El umbral saludable es de máximo 7 intentos. Un promedio de 11+ es alarmante porque significa que los agentes están insistiendo excesivamente en leads difíciles en vez de priorizar los contactos más recientes y con mayor probabilidad de conversión.',
        source: 'Estadísticas de marcación del CRM — fuente: n8n operations.call_metrics.call_rank.avg'
    },
    'Tasa Global de Conversión': {
        icon: '🎯',
        definition: 'Porcentaje de consultas agendadas respecto al total de leads del periodo analizado (operations.total_leads).',
        interpretation: 'Una tasa superior al 5% es excelente para este sector. Por debajo de 3.5% sugiere fuga importante o leads poco calificados.',
        source: 'funnel.conversion_pct — consultas agendadas ÷ leads totales del periodo'
    },
    'Ingresos en Riesgo Estimados': {
        icon: '💸',
        definition: 'Estimación: eventos de fuga del periodo × $1,200 USD (valor configurable). No es ingreso real ni leads únicos.',
        interpretation: 'Indicador relativo de oportunidad perdida por fugas. Útil para priorizar mejoras operativas.',
        source: 'funnel.total_revenue_at_risk'
    },
    'Pronóstico Mañana': {
        icon: '🔮',
        definition: 'La proyección de la cantidad de leads que entrarán al sistema el día de mañana utilizando el modelo predictivo matemático de la serie temporal (Theta Lite o Random Forest).',
        interpretation: 'Se utiliza para prever la capacidad de agentes requerida. Si la proyección supera el promedio, se recomienda reforzar el call center para evitar desbordes.',
        source: 'Modelos predictivos de series temporales (theta_lite / Random Forest) — Forecast API'
    },
    'Pronóstico 7 Días': {
        icon: '📅',
        definition: 'La estimación del volumen acumulado de leads que se recibirán en los próximos 7 días bajo condiciones normales de pauta y estacionalidad.',
        interpretation: 'Indica la tendencia de demanda a corto plazo. Permite planear la agenda operativa semanal y balancear el flujo de trabajo de los asesores.',
        source: 'Sumatoria de proyecciones diarias a 7 días — Forecast Engine'
    },
    'Pronóstico 14 Días': {
        icon: '📆',
        definition: 'El volumen total de leads proyectados para las próximas dos semanas. Ofrece una visión quincenal del comportamiento de la demanda.',
        interpretation: 'Sirve para planear compras publicitarias y estructurar presupuestos quincenales. Permite corregir creativos de anuncios si la tendencia apunta a la baja.',
        source: 'Proyección temporal a mediano plazo (14 días) — Forecast Engine'
    },
    'Inversión Total Ejecutada': {
        icon: '💰',
        definition: 'El presupuesto total devengado en pesos para publicidad digital en todas las plataformas (Facebook Ads, Google Ads, etc.) durante el periodo.',
        interpretation: 'Debe analizarse en conjunto con el CPL global. Si el gasto aumenta sin un incremento proporcional en leads, existe fatiga de audiencias o saturación.',
        source: 'Suma de gastos reportados en APIs de marketing — investment.total_spend'
    },
    'Campañas Activas Modeladas': {
        icon: '📣',
        definition: 'La cantidad de campañas publicitarias individuales auditadas y clasificadas por el motor de atribución durante el ciclo de análisis.',
        interpretation: 'Una cantidad demasiado alta diluye el presupuesto e impide optimizar; una cantidad muy baja eleva el riesgo de depender de pocas audiencias.',
        source: 'Conteo de campañas registradas — investment.campaign_count'
    },
    'Alertas Totales': {
        icon: '⚠️',
        definition: 'El recuento consolidado de todas las desviaciones, anomalías o advertencias detectadas por el sistema al cruzar los umbrales operativos y financieros de control.',
        interpretation: 'Mide la estabilidad de la operación. Mantener este indicador bajo indica un sistema robusto y bien coordinado sin cuellos de botella.',
        source: 'Conteo total de incidencias operativas activas — system.alerts'
    },
    'Alertas Críticas': {
        icon: '🚨',
        definition: 'El total de incidentes calificados con severidad grave, que representan un peligro inmediato para los ingresos o la absorción de leads del negocio.',
        interpretation: 'Requieren resolución inmediata (máximo 24 horas). Cada alerta crítica activa indica pérdidas financieras en curso o ineficiencias críticas.',
        source: 'Alertas con nivel "critical" — system.alerts.critical'
    },
    'Severidad Máxima': {
        icon: '⚡',
        definition: 'El puntaje de Número de Prioridad de Riesgo (RPN) más alto registrado entre las alertas de sistema activas en el periodo.',
        interpretation: 'Un RPN arriba de 400 es crítico. Indica exactamente a qué alerta se le debe prestar atención primero para mitigar el mayor impacto financiero posible.',
        source: 'Fórmula RPN: Severidad × Ocurrencia × Detección — system.alerts'
    },
    'Advertencias e Info': {
        icon: 'ℹ️',
        definition: 'La suma acumulada de advertencias leves y notas informativas de desviación operativa que no representan un riesgo de negocio crítico inmediato.',
        interpretation: 'Indican oportunidades de mejora proactiva y preventiva. Deben auditarse semanalmente para evitar que escalen a incidentes críticos.',
        source: 'Alertas con nivel "warning" o "info" — system.alerts'
    },
    'Registros': {
        icon: '📞',
        definition: 'El volumen consolidado de todas las llamadas telefónicas realizadas por el equipo de asesores durante el periodo analizado.',
        interpretation: 'Mide el esfuerzo bruto de marcación del call center. Un volumen alto refleja alta actividad, pero debe ser analizado en relación con los contactos únicos para medir la efectividad.',
        source: 'CRM integrado — total_records'
    },
    'Contactos': {
        icon: '👥',
        definition: 'La cantidad de leads únicos (contactos de personas individuales) que han sido marcados al menos una vez en el ciclo operativo.',
        interpretation: 'Indica la base de prospectos única que está siendo trabajada por la operación. Representa la cantidad de oportunidades individuales creadas.',
        source: 'CRM integrado — unique_contacts'
    },
    'Avg Dial Attempts (intentos promedio)': {
        icon: '🔄',
        definition: 'Avg Dial Attempts: promedio de intentos de marcación por lead antes de contacto o disposición final.',
        interpretation: 'Buena práctica en intake: ≤ 7 marcaciones por lead. Promedios 11+ sugieren sobre-contacto en leads fríos vs priorizar speed-to-lead en leads nuevos.',
        source: 'call_metrics.call_rank.avg'
    },
    'Avg Callback Interval (min entre intentos)': {
        icon: '⏳',
        definition: 'El tiempo promedio transcurrido entre intentos de contacto consecutivos realizados a un mismo lead.',
        interpretation: 'El speed-to-lead inicial y la insistencia oportuna son claves. Intervalos muy largos (por ejemplo, miles de minutos) degradan severamente la probabilidad de conversión ya que el prospecto se enfría.',
        source: 'CRM integrado — minutes_since_prev.avg'
    },
    'Cambio de Régimen': {
        icon: '📉',
        definition: 'Indica un cambio o quiebre estructural significativo en el volumen diario de entrada de leads, detectado mediante el algoritmo de Sumas Acumuladas (CUSUM).',
        interpretation: 'Un valor negativo (como -14%) confirma que la media de entrada diaria ha sufrido una reducción persistente en su línea base, indicando fatiga en canales de adquisición o pauta publicitaria. Un valor positivo refleja un incremento sostenido en la demanda.',
        source: 'Algoritmo estadístico CUSUM (Suma Acumulada) integrado en el motor de predicción PulseMkt'
    },
    'Pre-Cierre (Solo Efectivo)': {
        icon: '💵',
        definition: 'Prospectos en la etapa final de pre-cierre que han indicado que realizarán el pago únicamente en efectivo (sin tarjetas de crédito o débito).',
        interpretation: 'Representa leads con muy alta intención de compra, pero cuya conversión final puede requerir mayor seguimiento logístico para coordinar el depósito o pago físico.',
        source: 'Mapeo de transiciones del CRM de ventas vía n8n'
    },
    'Pre-Cierre (Reactivación)': {
        icon: '🔄',
        definition: 'Prospectos previamente inactivos o estancados en el embudo de ventas que fueron contactados de nuevo y reactivados exitosamente en la etapa de pre-cierre.',
        interpretation: 'Muestra la efectividad de las estrategias de seguimiento y la persistencia de los agentes para recuperar leads antiguos.',
        source: 'Mapeo de transiciones del CRM de ventas vía n8n'
    },
    'Pre-Cierre (Sin Tarjeta)': {
        icon: '💳',
        definition: 'Prospectos listos para el cierre comercial que no cuentan con tarjetas de crédito/débito o prefieren no ingresarlas en el sistema.',
        interpretation: 'Requieren que los agentes ofrezcan alternativas de pago especiales como transferencias bancarias o depósitos para consolidar el caso sin perder el interés comercial.',
        source: 'Mapeo de transiciones del CRM de ventas vía n8n'
    },
    'First Contact Rate': {
        icon: '🎯',
        definition: 'Proporción de contactos únicos alcanzados en el primer intento de marcación telefónica.',
        interpretation: 'Valores altos indican mejor speed-to-lead y menor desperdicio de intentos. Si es bajo, revisa horarios de agentes y velocidad de primera marcación.',
        source: 'operations.derived.first_contact_rate — CRM vía n8n'
    },
    'Sweet Spot %': {
        icon: '✅',
        definition: 'Porcentaje de llamadas realizadas dentro de la ventana óptima de 1 a 3 intentos por lead.',
        interpretation: 'Refleja disciplina operativa saludable. Un valor bajo con mucho sobre-contacto (>7) indica que los agentes insisten demasiado en leads fríos.',
        source: 'operations.derived.sweet_spot_pct — CRM vía n8n'
    },
    'Dial Efficiency': {
        icon: '📲',
        definition: 'Proporción de contactos únicos respecto al total de registros de llamada. Mide si cada marcación llega a un lead distinto.',
        interpretation: 'Valores altos = menos duplicidad. Bajo indica muchas re-marcaciones al mismo prospecto y posible saturación de la base.',
        source: 'operations.derived.dial_efficiency — CRM vía n8n'
    },
    'Overcontact Index': {
        icon: '⚠️',
        definition: 'Estimación de llamadas con más de 7 intentos acumulados, umbral donde el retorno marginal de contacto cae drásticamente.',
        interpretation: 'Valores altos señalan desgaste de la base y tiempo de agentes mal invertido. Prioriza leads nuevos sobre re-intentos excesivos.',
        source: 'operations.derived.overcontact_index — CRM vía n8n'
    },
    'Tasa de llegada (λ)': {
        icon: '📥',
        definition: 'Tasa de llegada (λ): volumen de leads nuevos por hora, derivado del promedio diario dividido entre 24.',
        interpretation: 'Base del modelo de colas (Little\'s Law). A mayor λ, se requieren más agentes o menor tiempo de servicio para evitar colas.',
        source: 'operations.littles_law.arrival_rate_per_hour'
    },
    'Tiempo de servicio (W)': {
        icon: '⏱️',
        definition: 'Tiempo de servicio (W): minutos promedio que un agente dedica a cada interacción telefónica.',
        interpretation: 'W alto aumenta la cola estimada (L = λ × W) si no se ajusta la capacidad de staffing.',
        source: 'operations.littles_law.avg_service_minutes'
    },
    'Cola estimada (L)': {
        icon: '📋',
        definition: 'Cola estimada (L): número de leads en sistema esperando atención, calculado con la ley de Little (L = λ × W).',
        interpretation: 'Valores elevados anticipan saturación del call center si no hay refuerzo de personal.',
        source: 'operations.littles_law.estimated_queue_leads'
    },
    'Utilización': {
        icon: '⚙️',
        definition: 'Porcentaje de utilización de la capacidad operativa: qué fracción del máximo de leads/día que el equipo puede atender está siendo demandada.',
        interpretation: 'Por encima de 85% hay riesgo de colas y tiempos de espera prolongados para nuevos leads.',
        source: 'operations.littles_law.utilization_pct'
    },
    'Presión de staffing': {
        icon: '👥',
        definition: 'Indicador de presión de personal: compara la demanda proyectada contra la capacidad disponible de agentes.',
        interpretation: 'Estado Crítica o Presión implica gap de leads sin atender mañana; OK indica cobertura suficiente.',
        source: 'operations.littles_law.staffing_pressure'
    }
};

function setKpiModalContent({ title, subtitle, value, definition, interpretation, source }) {
    document.getElementById('kpi-modal-title').textContent = title;
    const subtitleEl = document.getElementById('kpi-modal-subtitle');
    if (subtitleEl) {
        if (subtitle) {
            subtitleEl.textContent = subtitle;
            subtitleEl.style.display = 'block';
        } else {
            subtitleEl.textContent = '';
            subtitleEl.style.display = 'none';
        }
    }
    document.getElementById('kpi-modal-value').textContent = value;
    document.getElementById('kpi-modal-definition').textContent = definition;
    document.getElementById('kpi-modal-interpretation').textContent = interpretation;
    document.getElementById('kpi-modal-source-text').textContent = source;
    document.getElementById('kpi-modal-overlay').classList.add('open');
}

function openKpiModal(label, value) {
    const explainKey = resolveKpiExplanationKey(label);
    const explain = explainKey ? KPI_EXPLANATIONS[explainKey] : null;

    setKpiModalContent({
        title: label,
        value: value != null && value !== '' ? value : '—',
        definition: explain?.definition || 'Indicador operativo del call center registrado en el periodo analizado.',
        interpretation: explain?.interpretation || 'Compara el valor actual con los umbrales operativos recomendados para decidir si requiere acción.',
        source: explain?.source || 'CRM integrado vía n8n — operations',
    });
}

function openFeederModal(rawFrom, pct, cnt) {
    const displayName = shortenFunnelLabel(cleanTechnicalTerms(rawFrom));
    const pctNum = parseFloat(String(pct).replace('%', '')) || 0;
    const count = Number(cnt) || 0;

    setKpiModalContent({
        title: displayName,
        value: `${count} consultas`,
        definition: `Ruta hacia consulta agendada desde "${displayName}". El ${pctNum.toFixed(2)}% de los leads que salen de este estado pasan a consulta en el siguiente paso.`,
        interpretation: `En este periodo se registraron ${count} consultas agendadas atribuidas a esta ruta (todas las variantes de Consult Booked).`,
        source: 'funnel.feeders — transiciones del CRM',
    });
}

function openLeakModal(from, to, pct, cnt) {
    const leak = formatLeakDisplay(from, to);
    const origin = leak.subtitle.replace('Origen: ', '');
    const pctNum = parseFloat(String(pct).replace('%', '')) || 0;
    const count = Number(cnt) || 0;

    setKpiModalContent({
        title: leak.title,
        subtitle: leak.subtitle,
        value: `${count} leads`,
        definition: `Punto de fuga: los leads que vienen de ${origin} acaban en ${leak.title} y abandonan el embudo.`,
        interpretation: `El ${pctNum.toFixed(2)}% de las salidas desde ${origin} van a esta fuga (${count} eventos en el periodo).`,
        source: 'funnel.leaks — transiciones del CRM',
    });
}

function closeKpiModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('kpi-modal-overlay').classList.remove('open');
}

// Close modal on Escape key press
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('kpi-modal-overlay');
        if (overlay && overlay.classList.contains('open')) {
            overlay.classList.remove('open');
        }
    }
});

// =====================================================================
//  TEXT CLEANING & SANITIZATION (No Emojis, No Technical Parentheses)
// =====================================================================

function cleanText(str) {
    if (!str || typeof str !== 'string') return str;

    // Remove all emojis and emoticons
    let clean = str.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{2000}-\u{3300}\u{1F000}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F700}-\u{1F7FF}\u{1FA00}-\u{1FAFF}]/gu, '');

    // Remove backend/metadata parentheses only (keep industry glossary parens)
    clean = clean.replace(/\s*\([^)]*(?:umbral:\s*\d|FactsBuilder|n8n|webhook|server error)[^)]*\)/gi, '');

    // Standardize white spaces
    clean = clean.replace(/\s+/g, ' ').trim();

    return clean;
}

const CRM_TRANSLATIONS = {
    'PreClosed – Cash Only': 'Pre-Cierre (Solo Efectivo)',
    'PreClosed - Cash Only': 'Pre-Cierre (Solo Efectivo)',
    'PreClosed Cash Only': 'Pre-Cierre (Solo Efectivo)',
    'PreClosed Reactivación': 'Pre-Cierre (Reactivación)',
    'PreClosed Reactivacin': 'Pre-Cierre (Reactivación)',
    'PreClosed - No Card': 'Pre-Cierre (Sin Tarjeta)',
    'PreClosed - No Answer': 'Pre-Cierre (Sin Respuesta)',
    'PreClosed - Busy': 'Pre-Cierre (Ocupado)',
    'PreClosed - Hung Up': 'Pre-Cierre (Llamada Colgada)',
    'PreClosed - Distrust': 'Pre-Cierre (Desconfianza)',
    'PreClosed - Indirect Client': 'Pre-Cierre (Cliente Indirecto)',
    'PreClosed - Needs to be Approved': 'Pre-Cierre (Pendiente Aprobación)',
    'PreClosed - No Money - No Job': 'Pre-Cierre (Sin Dinero/Trabajo)',
    'PreClosed - No Price': 'Pre-Cierre (Sin Dinero/Trabajo)', // simplified for common user
    'PreClosed - Prefers to go to the office': 'Pre-Cierre (Prefiere Oficina)',
    'PreClosed Opportunity': 'Oportunidad de Pre-Cierre',
    'Pre-Cerrado (Sin tarjeta)': 'Pre-Cierre (Sin Tarjeta)',
    'Abierto (Open)': 'Abierto',
    'Busy - Callback': 'Ocupado (Re-llamada)',
    'Connected Voicemail': 'Buzón de Voz',
    'EN LLAMADA': 'En Llamada',
    'New Lead': 'Nuevo Lead',
    'No Answer': 'Sin Respuesta',
    'New Lead Primer Intento': 'Nuevo Lead - 1er Intento',
    'Alivio Vendido': 'Alivio Vendido',
    'Cita en oficina': 'Cita en Oficina',
    'Connected - Not Interested': 'Contactado (No Interesado)',
    'Consult Booked': 'Consulta Agendada',
    'Consult Booked PROMO': 'Consulta Agendada (Promo)',
    'Customer Service Call': 'Llamada Atención Cliente',
    'Detenidos - Cortes': 'Detenidos / Cortes',
    'Duplicate Lead': 'Lead Duplicado',
    'Hung Up': 'Llamada Colgada',
    'Indirect Client': 'Cliente Indirecto',
    'Leads Opportunity': 'Oportunidad de Lead',
    'OutReach Primer Intento': 'Contacto - 1er Intento',
    'OutReach Segundo Intento': 'Contacto - 2do Intento',
    'Pre Closed PROMO': 'Pre-Cierre (Promo)',
    'Reconversion Lead': 'Reconversión de Lead',
    'Recovery Department': 'Dpto. de Recuperación',
    'Recovery No Answer': 'Recuperación - Sin Respuesta',
    'Transfer to Detenidos': 'Transferido a Detenidos',
    'Wrong Number': 'Número Equivocado',
    'Consult Booked HS': 'Consulta Agendada (HS)',
    'NL Agendado CDMX': 'Lead Agendado CDMX',
    'Consult Booked - Referal to Detainees': 'Consulta Agendada (Ref. Detenidos)',
    'Hot Transfer Cancn': 'Transferencia Directa Cancún',
    'NL Connector CUN': 'Conector Lead Nuevo CUN',
    'New Lead Segundo Intento': 'Nuevo Lead - 2do Intento',
    'Outeach 3 intento': 'Contacto - 3er Intento',
    'Recovery Not Interested': 'Recuperación - No Interesado',
    'NL Agendado CUN': 'Lead Agendado CUN'
};

const FUNNEL_SHORT_LABELS = {
    'Contactado (No Interesado)': 'No interesado',
    'Sin Respuesta': 'Sin respuesta',
    'Llamada Colgada': 'Colgó',
    'Número Equivocado': 'Núm. equivocado',
    'Buzón de Voz': 'Buzón de voz',
    'Ocupado (Re-llamada)': 'Ocupado',
    'Pre-Cierre (Sin Respuesta)': 'Pre-cierre sin resp.',
    'Pre-Cierre (Llamada Colgada)': 'Pre-cierre colgó',
    'Pre-Cierre (Desconfianza)': 'Desconfianza',
    'Pre-Cierre (Ocupado)': 'Pre-cierre ocupado',
    'Pre-Cierre (Sin Tarjeta)': 'Pre-cierre sin tarjeta',
    'Pre-Cierre (Solo Efectivo)': 'Pre-cierre efectivo',
    'Pre-Cierre (Cliente Indirecto)': 'Cliente indirecto',
    'Pre-Cierre (Sin Dinero/Trabajo)': 'Sin dinero/trabajo',
    'Pre-Cierre (Prefiere Oficina)': 'Prefiere oficina',
    'Pre-Cierre (Reactivación)': 'Pre-cierre reactivación',
    'Pre-Cierre (Promo)': 'Pre-cierre promo',
    'Pre-Cierre (Pendiente Aprobación)': 'Pendiente aprobación',
    'Recuperación - Sin Respuesta': 'Recup. sin respuesta',
    'Recuperación - No Interesado': 'Recup. no interesado',
    'Nuevo Lead - 1er Intento': 'Lead nuevo (1.er)',
    'Nuevo Lead - 2do Intento': 'Lead nuevo (2.do)',
    'Contacto - 1er Intento': '1.er contacto',
    'Contacto - 2do Intento': '2.do contacto',
    'Contacto - 3er Intento': '3.er contacto',
    'En Llamada': 'En llamada',
    'Consulta Agendada': 'Cita agendada',
    'Consulta Agendada (Promo)': 'Cita promo',
    'Dpto. de Recuperación': 'Recuperación',
    'Transferido a Detenidos': 'A detenidos',
    'Lead Duplicado': 'Duplicado',
    'Llamada Atención Cliente': 'Atención cliente',
    'Detenidos / Cortes': 'Detenidos',
    'Oportunidad de Lead': 'Oportunidad',
    'Oportunidad de Pre-Cierre': 'Oport. pre-cierre',
    'Reconversión de Lead': 'Reconversión',
    'Lead Agendado CDMX': 'Agendado CDMX',
    'Lead Agendado CUN': 'Agendado CUN',
    'Nuevo Lead': 'Lead nuevo',
    'Abierto': 'Abierto',
};

function shortenFunnelLabel(name) {
    const cleaned = String(name || '—').trim();
    if (FUNNEL_SHORT_LABELS[cleaned]) return FUNNEL_SHORT_LABELS[cleaned];

    const preClosed = cleaned.match(/^Pre-Cierre \((.+)\)$/i);
    if (preClosed) return preClosed[1];

    const contacted = cleaned.match(/^Contactado \((.+)\)$/i);
    if (contacted) return contacted[1];

    if (cleaned.length > 34) return `${cleaned.slice(0, 32)}…`;
    return cleaned;
}

function formatLeakDisplay(from, to) {
    const sourceFull = cleanTechnicalTerms(from || 'Origen');
    const targetFull = cleanTechnicalTerms(to || 'Destino');
    return {
        title: shortenFunnelLabel(targetFull),
        subtitle: `Origen: ${shortenFunnelLabel(sourceFull)}`,
        sourceFull,
        targetFull,
    };
}

function cleanTechnicalTerms(str) {
    if (!str || typeof str !== 'string') return str;
    if (termCache.has(str)) return termCache.get(str);
    let text = applyIndustryInlineTerms(str.trim());

    // Check exact match in CRM translations
    if (CRM_TRANSLATIONS[text]) {
        return CRM_TRANSLATIONS[text];
    }

    // Check partial/regex replacements or replace inline parts of the text
    for (const [key, val] of Object.entries(CRM_TRANSLATIONS)) {
        const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(escapedKey, 'gi');
        text = text.replace(regex, val);
    }

    // Replace technical models and internal jargon with elegant corporate terminology
    text = text.replace(/ensemble_weighted/gi, 'Modelo Predictivo');
    text = text.replace(/FactsBuilder/gi, 'Motor PulseMkt');
    text = text.replace(/baseline/gi, 'Línea Base');
    text = text.replace(/CPL implicito/gi, 'Costo por Lead');

    // Standardize CUSUM changepoint labels to elegant corporate terminology
    text = text.replace(/Cambio regimen/gi, 'Cambio de Régimen');

    text = cleanText(text);
    termCache.set(str, text);
    return text;
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
        activeTabContent.classList.add('active');

        if (shouldAnimateUI()) {
            activeTabContent.classList.remove('active');
            void activeTabContent.offsetWidth;
            activeTabContent.classList.add('active');

            activeTabContent.querySelectorAll('[data-value]').forEach(el => {
                parseAndAnimate(el, el.getAttribute('data-value'));
            });
        }

        ensureTabRendered(tabId);
        applyProgressBars(activeTabContent);

        if (tabId === 'dashboard' && shouldAnimateUI()) {
            setTimeout(restartHealthRing, 60);
        } else if (tabId === 'forecast' && dashboardData?.forecast) {
            const line = getChartForecastLine();
            renderTimeSeriesChart(dashboardData.forecast, {
                canvasId: 'chart-timeseries',
                chartKey: 'timeseries',
                lineLabel: line.label,
                lineColor: line.color,
                forecastValue: line.value,
                overlays: getActiveOverlays()
            });
            renderModelDetailPanel();
        }
    }

    // Update topbar header title
    const titles = {
        'dashboard': 'Resumen General',
        'funnel': 'Funnel y Conversiones',
        'forecast': 'Pronósticos',
        'investment': 'Inversión y Campañas',
        'operations': 'Operaciones Diarias',
        'alerts': 'Alertas de Operación',
        'reports': 'Informes Corporativos'
    };
    const sectionTitleEl = document.getElementById('topbar-section-title');
    if (sectionTitleEl) {
        sectionTitleEl.textContent = titles[tabId] || 'PulseMkt';
    }

    currentTab = tabId;

    if (['forecast', 'investment', 'operations'].includes(tabId)) {
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
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

    if (!shouldAnimateUI() || duration <= 0) {
        if (isTime) {
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
        return;
    }

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
    if (!shouldAnimateUI()) duration = 0;
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

const INTERVAL_CALLBACK_SLA_MIN = 24 * 60;

function formatDurationPair(actualMin, thresholdMin, decimals = 1) {
    const actual = Number(actualMin);
    const threshold = Number(thresholdMin);
    if (!Number.isFinite(actual) || actual < 0) {
        return { actual: { text: '—' }, threshold: { text: '—' } };
    }
    const scale = Math.max(actual, Number.isFinite(threshold) ? threshold : 0, 0);

    if (scale >= 2880) {
        const fmt = (m) => {
            const days = (m / 1440).toFixed(decimals);
            const label = Number(days) === 1 ? 'día' : 'días';
            return `${days} ${label}`;
        };
        return {
            actual: { text: fmt(actual) },
            threshold: { text: Number.isFinite(threshold) ? fmt(threshold) : '—' },
        };
    }
    if (scale >= 120) {
        const fmt = (m) => `${(m / 60).toFixed(decimals)} h`;
        return {
            actual: { text: fmt(actual) },
            threshold: { text: Number.isFinite(threshold) ? fmt(threshold) : '—' },
        };
    }
    const fmt = (m) => `${Math.round(m)} min`;
    return {
        actual: { text: fmt(actual) },
        threshold: { text: Number.isFinite(threshold) ? fmt(threshold) : '—' },
    };
}

function normalizeOperationalAlerts(data) {
    const alerts = data?.system?.alerts;
    if (!Array.isArray(alerts)) return data;

    const intervalAlert = alerts.find((a) => a.metric === 'avg_interval_min');
    if (!intervalAlert) return data;

    const actualMin = Number(intervalAlert.actual) || 0;
    const pair = formatDurationPair(actualMin, INTERVAL_CALLBACK_SLA_MIN);
    const ratio = actualMin / INTERVAL_CALLBACK_SLA_MIN;

    intervalAlert.threshold = INTERVAL_CALLBACK_SLA_MIN;
    intervalAlert.actual_display = pair.actual.text;
    intervalAlert.threshold_display = pair.threshold.text;
    intervalAlert.title = `Demora media entre re-intentos: ${pair.actual.text} (objetivo: ≤${pair.threshold.text})`;
    intervalAlert.impact = `Entre una marcación y la siguiente, los leads esperan ${pair.actual.text} en promedio (${ratio.toFixed(1)}× el objetivo de ${pair.threshold.text}). Esto incluye pausas largas y leads reactivados días después.`;

    if (ratio >= 2.5 && intervalAlert.severity === 'warning') {
        intervalAlert.severity = 'critical';
    }

    return data;
}

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
                <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto; line-height: 1.6; font-size: 14px;">El servidor se encuentra activo y listo para recibir información operativa. Por favor, ejecuta el flujo de trabajo en tu n8n local para inicializar PulseMkt con datos de precisión.</p>
            `;
            return;
        }

        normalizeOperationalAlerts(json.data);
        if (typeof enrichFunnelClientData === 'function') {
            enrichFunnelClientData(json.data);
        }
        if (typeof enrichFunnelMarkovStddev === 'function') {
            enrichFunnelMarkovStddev(json.data);
        }
        ensureFunnelDerivedMetrics(json.data);
        dashboardData = json.data;
        dashboardHistory = json.history || null;
        clearComparableModelsCache();
        clearTermCache();
        document.getElementById('loading').style.display = 'none';
        renderBOS(dashboardData, dashboardHistory);

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
//  PHASE 2 — History / compare / sparkline / Little's Law
// =====================================================================

const COMPARE_METRICS = [
    { key: 'health_score', label: 'SHS', suffix: '' },
    { key: 'total_leads', label: 'Leads', suffix: '' },
    { key: 'overcontact_pct', label: 'Sobre-contacto', suffix: '%' },
    { key: 'conversion_pct', label: 'Conversión', suffix: '%' },
    { key: 'global_cpl', label: 'CPL', prefix: '$' },
    { key: 'mase', label: 'MASE', suffix: '' },
];

function formatCompareDelta(d, prefix = '', suffix = '') {
    if (!d || d.delta == null) return '—';
    const sign = d.delta > 0 ? '+' : '';
    const arrow = d.direction === 'up' ? '↑' : d.direction === 'down' ? '↓' : '→';
    return `${arrow} ${prefix}${sign}${d.delta}${suffix}`;
}

function compareDeltaColor(d) {
    if (!d || d.direction === 'flat') return 'var(--text-muted)';
    return d.direction === 'up' ? 'var(--green)' : 'var(--red)';
}

function renderDashboardCompareStrip(history) {
    const el = document.getElementById('dashboard-compare-strip');
    const emptyEl = document.getElementById('dashboard-history-empty');
    if (!el) return;

    const compare = history?.compare;
    if (!compare?.available) {
        el.style.display = 'none';
        el.innerHTML = '';
        if (emptyEl) {
            emptyEl.style.display = history && (history.entry_count || 0) < 2 ? 'block' : 'none';
        }
        return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    const prevDate = compare.previous_generated_at
        ? new Date(compare.previous_generated_at).toLocaleString('es-MX', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        })
        : '';

    const chips = COMPARE_METRICS.map((m) => {
        const d = compare.deltas?.[m.key];
        if (!d) return '';
        return `
            <div style="padding:8px 12px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid var(--border);min-width:100px;">
                <div style="font-size:10px;color:var(--text-dim);margin-bottom:2px;">${m.label}</div>
                <div style="font-size:13px;font-weight:700;color:${compareDeltaColor(d)};">
                    ${formatCompareDelta(d, m.prefix || '', m.suffix || '')}
                </div>
            </div>
        `;
    }).join('');

    el.style.display = 'block';
    el.className = 'card';
    el.innerHTML = `
        <div style="font-size:12px;font-weight:700;margin-bottom:10px;color:var(--text-muted);">
            Vs ejecución anterior${prevDate ? ` <span style="font-weight:500;margin-left:8px;">(${prevDate})</span>` : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;">${chips}</div>
    `;
}

function renderLittlesLawCards(ops) {
    const el = document.getElementById('operations-littles-law-cards');
    if (!el) return;

    const ll = ops?.littles_law || {};
    if (!ll.available) {
        el.style.display = 'none';
        el.innerHTML = '';
        return;
    }

    const pressureLabel = ll.staffing_pressure === 'critical' ? 'Crítica'
        : ll.staffing_pressure === 'pressure' ? 'Presión' : 'OK';

    const cards = [
        { label: 'Tasa de llegada (λ)', value: `${Number(ll.arrival_rate_per_hour).toFixed(2)} leads/h`, sub: 'Promedio diario / 24', color: 'blue' },
        { label: 'Tiempo de servicio (W)', value: `${Number(ll.avg_service_minutes).toFixed(1)} min`, sub: 'Duración media', color: 'blue' },
        { label: 'Cola estimada (L)', value: Number(ll.estimated_queue_leads).toFixed(1), sub: 'λ × W', color: 'gold' },
        { label: 'Utilización', value: `${ll.utilization_pct}%`, sub: `Capacidad: ${ll.capacity_leads_per_day || '—'} leads/día`, color: ll.utilization_pct > 85 ? 'red' : 'green' },
        { label: 'Presión staffing', value: pressureLabel, sub: ll.staffing_gap_tomorrow > 0 ? `Gap mañana: +${ll.staffing_gap_tomorrow}` : 'Sin gap', color: ll.staffing_pressure === 'critical' ? 'red' : ll.staffing_pressure === 'pressure' ? 'gold' : 'green' },
    ];

    el.style.display = 'grid';
    el.innerHTML = cards.map((c, i) => {
        const escapedLabel = c.label.replace(/'/g, "\\'");
        const escapedValue = String(c.value).replace(/'/g, "\\'");
        return `
        <div class="card stat-card-${c.color} card-animate" style="animation-delay:${i * 0.03}s;cursor:pointer;"
            onclick="openKpiModal('${escapedLabel}', '${escapedValue}')">
            <div class="card-stat-label">${c.label}</div>
            <div class="card-stat-value">${c.value}</div>
            <div class="card-stat-sub">${c.sub}</div>
        </div>
    `;
    }).join('');
}

function alertFingerprintLegacy(a) {
    return String(a?.metric || a?.id || '').trim();
}

function classifyAlertRecurrence(a) {
    const diff = dashboardHistory?.compare?.alerts || { new: [], recurrent: [], resolved: [] };
    const fp = alertFingerprintLegacy(a);
    if (diff.new?.includes(fp)) return 'new';
    if (diff.recurrent?.includes(fp)) return 'recurrent';
    return null;
}

function filterAlertsRecurrence(type) {
    currentRecurrenceFilter = type;
    document.querySelectorAll('#alerts-recurrence-filters .filter-pill').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-recurrence') === type);
    });
    renderAlertsResolvedPanel();
    filterAlerts(currentAlertFilter);
}

function renderAlertsRecurrenceFilters(history) {
    const el = document.getElementById('alerts-recurrence-filters');
    if (!el) return;
    el.style.display = history?.compare?.available ? 'flex' : 'none';
}

function renderAlertsResolvedPanel() {
    const panel = document.getElementById('alerts-resolved-panel');
    if (!panel) return;
    const resolved = dashboardHistory?.compare?.alerts?.resolved || [];
    if (!resolved.length || currentRecurrenceFilter !== 'resolved') {
        panel.style.display = 'none';
        panel.innerHTML = '';
        return;
    }
    panel.style.display = 'block';
    panel.innerHTML = `
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px;">Alertas resueltas (ya no activas)</div>
        <ul style="margin:0;padding-left:20px;color:var(--text-muted);font-size:13px;">
            ${resolved.map((fp) => `<li>${fp}</li>`).join('')}
        </ul>
    `;
}

function renderReportsQaBadge(data) {
    const qa = data?.meta?.narrative_qa;
    const badge = qa?.passed === true
        ? '<span class="custom-badge custom-badge-success" style="margin-left:8px;font-size:10px;">Narrativa validada</span>'
        : '';
    document.querySelectorAll('#tab-reports .report-info h4').forEach((h4) => {
        const base = h4.textContent.replace(/\s*Narrativa validada\s*/g, '').trim();
        h4.innerHTML = base + badge;
    });
}

// =====================================================================
//  CORE RENDERER ENGINE
// =====================================================================

function renderBOS(data, history) {
    renderedTabs.clear();
    renderedTabs.add('dashboard');

    // Update main horizontal status bar dynamically
    const mainSbar = document.getElementById('main-sbar');
    const mainSbarText = document.getElementById('main-sbar-text');
    if (mainSbar && mainSbarText) {
        const severityClass = data.system.status.color === 'rojo' ? 'status-red' : data.system.status.color === 'amarillo' ? 'status-yellow' : 'status-green';
        mainSbar.className = `sbar topbar-status ${severityClass}`;
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
            <div class="health-info-head">
                <h2 class="health-info-title">Salud Operativa</h2>
                <span class="custom-badge ${data.system.status.color === 'amarillo' ? 'custom-badge-warning' : data.system.status.color === 'rojo' ? 'custom-badge-critical' : 'custom-badge-success'}">${cleanTechnicalTerms(data.system.status.label)}</span>
            </div>
            <div class="health-reasons-inline">
                ${data.system.status.reasons.slice(0, 3).map(r => `
                    <span class="health-reason-chip">${cleanTechnicalTerms(r)}</span>
                `).join('')}
            </div>
        </div>
    `;

    if (shouldAnimateUI()) {
        setTimeout(() => {
            const ring = document.getElementById('health-fg-ring');
            if (ring) ring.style.strokeDashoffset = dashOffset;
            const numVal = document.getElementById('health-num-val');
            if (numVal) animateValue(numVal, 0, data.system.health_score, 700);
        }, 50);
    } else {
        const ring = document.getElementById('health-fg-ring');
        if (ring) ring.style.strokeDashoffset = dashOffset;
        const numVal = document.getElementById('health-num-val');
        if (numVal) numVal.textContent = data.system.health_score;
    }

    renderDashboardCompareStrip(history || dashboardHistory);

    // 2. Render KPIs in Dashboard Tab
    const kpisGrid = document.getElementById('dashboard-kpis');

    const kpisWithBestForecast = applyBestForecastToKpis(data.kpis, data);

    const cleanedKpis = kpisWithBestForecast.map(k => {
        let label = formatKpiLabel(k.label);
        let sub = applyIndustryInlineTerms(k.sub || '');

        if (k.label === 'Health Score') {
            label = 'Salud del Sistema';
        }
        if (k.label === 'Prevision diaria') {
            let bestModelVal = 264;
            let bestModelName = 'Theta Lite';
            let bestConfidence = 'Alta';

            let maseRf = (data.forecast_rf && data.forecast_rf.mase != null) ? data.forecast_rf.mase : 999;
            let maseLocal = (data.forecast && data.forecast.mase != null) ? data.forecast.mase : 999;
            if (data.forecast && Array.isArray(data.forecast.backtest_models)) {
                data.forecast.backtest_models.forEach(m => {
                    if (m.mase != null && m.mase < maseLocal) maseLocal = m.mase;
                });
            }

            if (maseRf <= maseLocal && data.forecast_rf && data.forecast_rf.recommended_value != null) {
                bestModelVal = data.forecast_rf.recommended_value;
                bestModelName = data.forecast_rf.model_name || 'Random Forest';
                bestConfidence = data.forecast_rf.confidence || 'Alta';
            } else if (data.forecast && data.forecast.recommended_value != null) {
                bestModelVal = data.forecast.recommended_value;
                bestModelName = data.forecast.method || 'Theta Lite';
                bestConfidence = data.forecast.confidence || 'Alta';
            }

            let formattedName = bestModelName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            k.value = `~${bestModelVal}`;
            sub = `${formattedName} | ${bestConfidence.replace(/\b\w/g, c => c.toUpperCase())}`;
            label = 'Pronóstico Diario';
        }
        if (k.label === 'MASE') {
            let bestModelName = 'Random Forest';
            let bestMase = 999;
            if (data.forecast_rf && data.forecast_rf.mase != null) {
                bestMase = data.forecast_rf.mase;
                bestModelName = data.forecast_rf.model_name || 'Random Forest';
            }
            if (data.forecast_rf && Array.isArray(data.forecast_rf.backtest_models)) {
                data.forecast_rf.backtest_models.forEach(m => {
                    if (m.mase != null && m.mase < bestMase) {
                        bestMase = m.mase;
                        bestModelName = m.name;
                    }
                });
            }
            if (data.forecast && data.forecast.mase != null && data.forecast.mase < bestMase) {
                bestMase = data.forecast.mase;
                bestModelName = data.forecast.method || 'Theta Lite';
            }
            if (data.forecast && Array.isArray(data.forecast.backtest_models)) {
                data.forecast.backtest_models.forEach(m => {
                    if (m.mase != null && m.mase < bestMase) {
                        bestMase = m.mase;
                        bestModelName = m.name;
                    }
                });
            }
            let formattedName = bestModelName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            k.value = Number(bestMase).toFixed(3);
            sub = formattedName;
            label = 'Precisión del Modelo';
            sub = applyIndustryInlineTerms(k.sub || '') || 'vs línea base naive';
        }
        if (k.label === 'CPL implicito') {
            label = 'Costo Promedio por Lead';
            sub = applyIndustryInlineTerms(k.sub || '') || 'Global';
        }
        if (k.label === 'Gasto total') {
            label = 'Inversión Publicitaria';
        }
        if (k.label === 'HHI') {
            label = 'Diversificación de Pauta';
        }
        if (k.label === 'Prevision diaria' && !sub) {
            sub = 'estimación puntual';
        }

        return { ...k, label, sub };
    });

    // Inject additional KPIs from available n8n data not yet shown
    if (data.operations) {
        if (data.operations.latest && data.operations.latest.leads) {
            cleanedKpis.push({
                value: String(data.operations.latest.leads),
                label: 'Leads Hoy',
                sub: data.operations.latest.date || 'Último día registrado',
            });
        }
        if (data.operations.max_daily) {
            cleanedKpis.push({
                value: String(data.operations.max_daily),
                label: 'Máximo Diario',
                sub: 'Pico histórico del periodo',
            });
        }
        if (data.operations.contact_distribution && data.operations.contact_distribution.overcontact_pct != null) {
            cleanedKpis.push({
                value: data.operations.contact_distribution.overcontact_pct + '%',
                label: 'Sobre-Contacto',
                sub: 'Llamadas > 7 intentos',
            });
        }
        if (data.operations.call_metrics && data.operations.call_metrics.call_rank) {
            cleanedKpis.push({
                value: String(data.operations.call_metrics.call_rank.avg),
                label: 'Intentos Promedio',
                sub: 'Marcaciones por lead (umbral: 7)',
            });
        }
        const derived = data.operations.derived;
        if (derived?.first_contact_rate != null) {
            cleanedKpis.push({
                value: (derived.first_contact_rate * 100).toFixed(1) + '%',
                label: 'First Contact Rate',
                sub: 'Primer intento / únicos',
            });
        }
        if (derived?.sweet_spot_pct != null) {
            cleanedKpis.push({
                value: derived.sweet_spot_pct.toFixed(1) + '%',
                label: 'Sweet Spot %',
                sub: 'Intentos 1–3',
            });
        }
        const economics = data.derived?.economics;
        if (economics?.roas_proxy != null && data.investment?.total_spend > 0) {
            cleanedKpis.push({
                value: economics.roas_proxy.toFixed(2),
                label: 'ROAS Proxy',
                sub: 'Ingreso est. / gasto',
            });
        }
        if (economics?.breakeven_cpl_gap != null) {
            cleanedKpis.push({
                value: '$' + economics.breakeven_cpl_gap.toFixed(2),
                label: 'Breakeven CPL Gap',
                sub: economics.breakeven_cpl != null ? `Umbral: $${economics.breakeven_cpl}` : 'Global',
            });
        }
    }

    const healthScore = Math.min(100, Math.max(0, Number(data.system.health_score) || 0));
    const liquidTone = healthScore >= 80 ? 'good' : healthScore >= 60 ? 'warn' : 'critical';

    kpisGrid.innerHTML = cleanedKpis.map((kpi, idx) => {
        const isHealth = idx === 0;
        const escapedLabel = kpi.label.replace(/'/g, "\\'");
        const escapedValue = String(kpi.value).replace(/'/g, "\\'");
        const trendBadge = isHealth ? '' : getKpiTrendBadgeHtml(kpi, data);
        const cardColor = isHealth ? null : resolveKpiCardColor(kpi, data);
        if (isHealth) {
            return `
                <div class="card liquid-tank liquid-tone-${liquidTone} card-animate"
                    style="--fill-level: 0; animation-delay: ${idx * 0.025}s;"
                    data-fill-target="${healthScore}"
                    onclick="openKpiModal('${escapedLabel}', '${escapedValue}')">
                    <div class="liquid-tank__fill" aria-hidden="true">
                        <div class="liquid-tank__surface liquid-tank__surface--1"></div>
                        <div class="liquid-tank__surface liquid-tank__surface--2"></div>
                    </div>
                    <div class="liquid-tank__content">
                        <div class="card-stat-top">
                            <div class="card-stat-label">${kpi.label}</div>
                        </div>
                        <div class="card-stat-value" id="kpi-val-${idx}" data-value="${kpi.value}">${shouldAnimateUI() ? '0' : kpi.value}</div>
                        <div class="card-stat-sub">${kpi.sub || '&nbsp;'}</div>
                    </div>
                </div>
            `;
        }
        return `
            <div class="card stat-card-${cardColor} card-animate kpi-card" style="animation-delay: ${idx * 0.025}s;"
                onclick="openKpiModal('${escapedLabel}', '${escapedValue}')">
                <div class="card-stat-top">
                    <div class="card-stat-label">${kpi.label}</div>
                    ${trendBadge}
                </div>
                <div class="card-stat-value" id="kpi-val-${idx}" data-value="${kpi.value}">${shouldAnimateUI() ? '0' : kpi.value}</div>
                <div class="card-stat-sub">${kpi.sub || '&nbsp;'}</div>
            </div>
        `;
    }).join('');

    if (shouldAnimateUI()) {
        cleanedKpis.forEach((kpi, idx) => {
            parseAndAnimate(document.getElementById(`kpi-val-${idx}`), kpi.value);
        });
        requestAnimationFrame(() => {
            const tank = document.querySelector('.liquid-tank');
            if (tank) tank.style.setProperty('--fill-level', Number(tank.dataset.fillTarget) || 0);
        });
    } else {
        const tank = document.querySelector('.liquid-tank');
        if (tank) tank.style.setProperty('--fill-level', healthScore);
    }

    // 3. Render Action Cards in Dashboard Tab
    const actionsGrid = document.getElementById('dashboard-actions');
    actionsGrid.innerHTML = data.system.actions.map((a, idx) => `
        <div class="card card-animate" style="animation-delay: ${(idx + cleanedKpis.length) * 0.025 + 0.08}s;">
            <div class="urgency-badge ${a.urgency}">${a.urgency === 'today' ? 'Acción Inmediata' : 'Plan Semanal'}</div>
            <div class="action-text">${cleanTechnicalTerms(a.action)}</div>
            <details class="action-details">
                <summary>Ver contexto</summary>
                <div class="action-meta">
                    <div><strong>Motivo:</strong> ${cleanTechnicalTerms(a.reason)}</div>
                    <div><strong>Evidencia:</strong> ${cleanTechnicalTerms(a.evidence)}</div>
                    <div><strong>Impacto Estimado:</strong> ${cleanTechnicalTerms(a.impact_est)}</div>
                </div>
            </details>
            <div class="action-card-footer">
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

    // 6–9. Pestañas secundarias y gráficas: diferidas para no bloquear la carga inicial
    scheduleDeferredRender(() => {
        renderFunnelDetails(data);
        applyProgressBars(document.getElementById('tab-funnel'));
        renderedTabs.add('funnel');

        renderForecastDetails(data.forecast || {}, {
            prefix: '',
            show14d: true,
            showChangepoint: true,
            horizons: getBestModelHorizons(data),
            bestModelName: getBestForecastRecord(data)?.modelName || data.forecast?.method,
        });
        populateModelCompareDropdown(data);
        renderedTabs.add('forecast-content');

        renderAlertsCentre(data.system.alerts);
        applyProgressBars(document.getElementById('tab-alerts'));
        renderedTabs.add('alerts');

        renderOperationsTab(data, { charts: false });
        renderedTabs.add('operations-content');

        if (currentTab !== 'dashboard') {
            ensureTabRendered(currentTab);
        }
    });

    renderReportsQaBadge(data);

    // 10. Update Sync Date in top header
    const genDate = new Date(data.meta.generated_at);
    document.getElementById('last-update').textContent = `Sincronizado: ${genDate.toLocaleDateString('es-MX')} a las ${genDate.toLocaleTimeString('es-MX')}`;
}

// =====================================================================
//  RENDER FUNNEL & MARKOV TAB DETAILS
// =====================================================================

const FUNNEL_PREVIEW_COUNT = 3;

const funnelUiState = {
    feedersExpanded: false,
    leaksExpanded: false,
    markovExpanded: false,
    markovAdvanced: false,
    markovGroup: 'all',
};

function buildFunnelInsight(feeders, leaks) {
    const topFeederByVolume = feeders[0];
    const topFeederByEfficiency = feeders.slice().sort((a, b) => (Number(b.pct) || 0) - (Number(a.pct) || 0))[0];
    const topLeak = leaks[0];
    if (!topFeederByVolume && !topLeak) return '';

    const parts = [];
    if (topFeederByVolume) {
        const state = shortenFunnelLabel(cleanTechnicalTerms(topFeederByVolume.from || 'Origen'));
        const cnt = Number(topFeederByVolume.cnt) || 0;
        parts.push(`Mayor volumen de consultas: <strong>${state}</strong> (${cnt} consultas en el periodo).`);
    }
    if (topFeederByEfficiency && topFeederByEfficiency.from !== topFeederByVolume?.from) {
        const effState = shortenFunnelLabel(cleanTechnicalTerms(topFeederByEfficiency.from || 'Origen'));
        const effPct = Number(topFeederByEfficiency.pct) || 0;
        parts.push(`Mayor eficiencia: <strong>${effState}</strong> (${effPct.toFixed(1)}% pasan a consulta desde ese estado).`);
    }
    if (topLeak) {
        const leak = formatLeakDisplay(topLeak.from, topLeak.to);
        const cnt = Number(topLeak.cnt) || 0;
        const pct = Number(topLeak.pct) || 0;
        parts.push(`Fuga con más impacto: <strong>${leak.title}</strong> (${leak.subtitle.replace('Origen: ', '')}) — ${cnt} leads (${pct.toFixed(1)}% de esa transición).`);
    }
    return parts.join(' ');
}

function formatFunnelPeriodMeta(data) {
    const generatedAt = data?.meta?.generated_at;
    const lookback = data?.meta?.config?.lookback_days;
    const totalLeads = Number(data?.operations?.total_leads) || 0;
    const parts = [];

    if (generatedAt) {
        try {
            const date = new Date(generatedAt);
            parts.push(`Datos al ${date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`);
        } catch (_) {
            parts.push(`Periodo: ${generatedAt}`);
        }
    }
    if (lookback) parts.push(`${lookback} días`);
    if (totalLeads > 0) parts.push(`${totalLeads.toLocaleString('es-MX')} leads`);

    return parts.join(' · ');
}

function renderFunnelListToggle(listId, items, expanded, noun) {
    const btn = document.getElementById(listId);
    if (!btn) return;

    const hasMore = items.length > FUNNEL_PREVIEW_COUNT;
    if (!hasMore) {
        btn.style.display = 'none';
        return;
    }

    const remaining = items.length - FUNNEL_PREVIEW_COUNT;
    btn.style.display = 'block';
    btn.textContent = expanded
        ? 'Ver menos'
        : `Ver las ${remaining} ${noun} restantes`;
}

function renderFunnelFeedersList(data, feeders) {
    const feedersList = document.getElementById('funnel-feeders-list');
    if (!feedersList) return;

    feedersList.classList.toggle('funnel-scroll-list--preview', !funnelUiState.feedersExpanded);

    if (feeders.length > 0) {
        const visible = funnelUiState.feedersExpanded
            ? feeders
            : feeders.slice(0, FUNNEL_PREVIEW_COUNT);
        feedersList.innerHTML = visible.map((f, idx) => {
            const state = shortenFunnelLabel(cleanTechnicalTerms(f.from));
            const pct = Number(f.pct) || 0;
            const cnt = Number(f.cnt) || 0;
            return renderFunnelListItem({
                title: state,
                pct,
                color: 'var(--green)',
                barColor: 'var(--green)',
                metaLeft: 'Eficiencia de la ruta',
                metaRight: `${cnt} consultas · ${pct.toFixed(1)}%`,
                onClick: `openFeederModal('${(f.from || '').replace(/'/g, "\\'")}', '${pct.toFixed(2)}%', ${cnt})`,
                delay: (idx * 0.02) + 0.12,
                rank: idx + 1,
                variant: 'feeder',
            });
        }).join('');
    } else {
        feedersList.innerHTML = `<div class="funnel-list-empty">Sin datos de rutas disponibles</div>`;
    }

    renderFunnelListToggle('funnel-feeders-toggle', feeders, funnelUiState.feedersExpanded, 'rutas');
}

function renderFunnelLeaksList(data, leaks) {
    const leaksList = document.getElementById('funnel-leaks-list');
    if (!leaksList) return;

    leaksList.classList.toggle('funnel-scroll-list--preview', !funnelUiState.leaksExpanded);

    if (leaks.length > 0) {
        const visible = funnelUiState.leaksExpanded
            ? leaks
            : leaks.slice(0, FUNNEL_PREVIEW_COUNT);
        leaksList.innerHTML = visible.map((l, idx) => {
            const leak = formatLeakDisplay(l.from, l.to);
            const leakPct = Number(l.pct) || 0;
            const leakCnt = Number(l.cnt) || 0;
            return renderFunnelListItem({
                title: leak.title,
                subtitle: leak.subtitle,
                pct: leakPct,
                color: 'var(--red)',
                barColor: 'var(--red)',
                metaLeft: 'Leads afectados',
                metaRight: `${leakCnt} leads perdidos`,
                onClick: `openLeakModal('${(l.from || '').replace(/'/g, "\\'")}', '${(l.to || '').replace(/'/g, "\\'")}', '${leakPct.toFixed(2)}%', ${leakCnt})`,
                delay: (idx * 0.02) + 0.12,
                rank: idx + 1,
                variant: 'leak',
            });
        }).join('');
    } else {
        leaksList.innerHTML = `<div class="funnel-list-empty">Sin datos de fugas disponibles</div>`;
    }

    renderFunnelListToggle('funnel-leaks-toggle', leaks, funnelUiState.leaksExpanded, 'fugas');
}

function renderFunnelMarkovGroupFilters(statesData) {
    const container = document.getElementById('funnel-markov-group-filters');
    if (!container) return;

    const options = getMarkovGroupOptions(statesData);
    if (options.length <= 1) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    container.innerHTML = options.map((opt) => `
        <button
            type="button"
            class="filter-pill funnel-markov-group-pill${funnelUiState.markovGroup === opt.id ? ' active' : ''}"
            onclick="toggleFunnelMarkovGroup('${opt.id}')"
        >${opt.label} (${opt.count})</button>
    `).join('');
}

function getFunnelRankBadge(rank) {
    if (rank === 1) return '<span class="funnel-rank funnel-rank--gold" title="Mayor participación">1</span>';
    if (rank === 2) return '<span class="funnel-rank funnel-rank--silver">2</span>';
    if (rank === 3) return '<span class="funnel-rank funnel-rank--bronze">3</span>';
    return `<span class="funnel-rank">${rank}</span>`;
}

function getMarkovConvTier(pct) {
    if (pct >= 25) return 'funnel-markov-row--high';
    if (pct >= 12) return 'funnel-markov-row--mid';
    return 'funnel-markov-row--low';
}

function renderFunnelMarkovTable(statesData) {
    const showAdvanced = funnelUiState.markovAdvanced;
    const filtered = filterMarkovByGroup(statesData, funnelUiState.markovGroup);
    const head = document.getElementById('funnel-probabilities-head');
    const probBody = document.getElementById('funnel-probabilities-body');

    if (head) {
        head.innerHTML = `
            <tr>
                <th class="funnel-markov-th-rank">#</th>
                <th>Estado inicial</th>
                <th class="funnel-markov-th-metric">Prob. de conversión</th>
                ${showAdvanced ? `
                    <th class="funnel-markov-th-metric">Prob. de no convertir</th>
                    <th class="funnel-markov-th-metric">Toques promedio</th>
                    <th class="funnel-markov-th-metric">Variabilidad</th>
                ` : ''}
            </tr>
        `;
    }

    if (!probBody) return;

    const colSpan = showAdvanced ? 6 : 3;
    const emptyMessage = statesData.length > 0
        ? 'Sin estados en este grupo para el periodo actual'
        : 'Sin estados con actividad de conversión en este periodo';

    probBody.innerHTML = filtered.length > 0
        ? filtered.map((s, idx) => {
            const rank = idx + 1;
            const tier = getMarkovConvTier(s.conversion);
            const barW = Math.min(Math.max(s.conversion, 0), 100);
            const groupAttr = s.group ? ` data-group="${s.group}"` : '';
            return `
            <tr class="funnel-markov-row ${tier} card-animate" style="animation-delay: ${(idx * 0.03).toFixed(2)}s;">
                <td class="funnel-markov-rank-cell">${getFunnelRankBadge(rank)}</td>
                <td>
                    <div class="funnel-markov-state">
                        <span class="funnel-markov-state-dot"${groupAttr}></span>
                        <div class="funnel-markov-state-copy">
                            <div class="funnel-markov-state-name">${s.state}</div>
                            ${s.rawState && s.rawState !== s.state ? `<div class="funnel-markov-state-raw">Estado CRM: ${s.rawState}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td class="funnel-markov-metric-cell">
                    <div class="funnel-markov-metric funnel-markov-metric--conv">
                        <span class="funnel-markov-pct">${s.conversion.toFixed(2)}%</span>
                        <div class="funnel-markov-mini-bar" aria-hidden="true"><span style="width: ${barW.toFixed(1)}%;"></span></div>
                    </div>
                </td>
                ${showAdvanced ? `
                    <td class="funnel-markov-metric-cell">
                        <span class="funnel-markov-pill funnel-markov-pill--loss">${s.loss.toFixed(2)}%</span>
                    </td>
                    <td class="funnel-markov-metric-cell">
                        <span class="funnel-markov-pill funnel-markov-pill--mono">${s.steps.toFixed(1)}</span>
                    </td>
                    <td class="funnel-markov-metric-cell">
                        <span class="funnel-markov-pill funnel-markov-pill--dim">${s.stddev > 0 ? s.stddev.toFixed(1) : '—'}</span>
                    </td>
                ` : ''}
            </tr>
        `;
        }).join('')
        : `<tr><td colspan="${colSpan}" class="funnel-markov-empty">${emptyMessage}</td></tr>`;
}

function syncFunnelMarkovAccordion() {
    const body = document.getElementById('funnel-markov-body');
    const chevron = document.getElementById('funnel-markov-chevron');
    const toggle = document.getElementById('funnel-markov-toggle');
    if (body) {
        body.classList.toggle('funnel-accordion-body--open', funnelUiState.markovExpanded);
    }
    if (chevron) {
        chevron.textContent = funnelUiState.markovExpanded ? '▼' : '▶';
    }
    if (toggle) {
        toggle.setAttribute('aria-expanded', funnelUiState.markovExpanded ? 'true' : 'false');
    }
}

function toggleFunnelList(type) {
    if (type === 'feeders') {
        funnelUiState.feedersExpanded = !funnelUiState.feedersExpanded;
    } else if (type === 'leaks') {
        funnelUiState.leaksExpanded = !funnelUiState.leaksExpanded;
    }
    if (dashboardData) {
        renderFunnelDetails(dashboardData);
    }
}

function toggleFunnelMarkov() {
    funnelUiState.markovExpanded = !funnelUiState.markovExpanded;
    syncFunnelMarkovAccordion();
}

function toggleFunnelMarkovAdvanced() {
    const checkbox = document.getElementById('funnel-markov-advanced-toggle');
    funnelUiState.markovAdvanced = !!(checkbox && checkbox.checked);
    if (dashboardData) {
        const statesData = resolveFunnelMarkovStates(dashboardData);
        renderFunnelMarkovTable(statesData);
    }
}

function toggleFunnelMarkovGroup(groupId) {
    funnelUiState.markovGroup = groupId || 'all';
    if (dashboardData) {
        const statesData = resolveFunnelMarkovStates(dashboardData);
        renderFunnelMarkovGroupFilters(statesData);
        renderFunnelMarkovTable(statesData);
    }
}

function parseFeederAlert(alert) {
    const titleStr = (alert.title || '').replace('Feeder a conversion: ', '');
    const parts = titleStr.split(' aporta ');
    const pct = parseFloat((parts[1] || '0').split('%')[0]) || 0;
    const leadMatch = titleStr.match(/\((\d+)\s*leads?\)/i);
    return {
        from: parts[0] || 'Origen',
        pct,
        cnt: leadMatch ? parseInt(leadMatch[1], 10) : 0,
    };
}

function resolveFunnelFeeders(data) {
    const feeders = data?.funnel?.feeders;
    if (Array.isArray(feeders) && feeders.length) {
        return feeders
            .map((f) => ({
                from: f.from || f.state || 'Origen',
                pct: Number(f.pct) || 0,
                cnt: Number(f.cnt) || 0,
            }))
            .sort((a, b) => b.cnt - a.cnt);
    }

    return (data.system?.alerts || [])
        .filter((a) => (a.title || '').includes('Feeder a conversion'))
        .map(parseFeederAlert)
        .sort((a, b) => b.cnt - a.cnt);
}

function isLeakDestination(to) {
    return typeof isFunnelLossState === 'function'
        ? isFunnelLossState(to, 'Consult Booked')
        : false;
}

function resolveFunnelLeaks(data) {
    const leaks = data?.funnel?.leaks;
    if (Array.isArray(leaks) && leaks.length) {
        return leaks
            .map((l) => ({
                from: l.from || 'Origen',
                to: l.to || 'Destino',
                pct: Number(l.pct) || 0,
                cnt: Number(l.cnt) || 0,
            }))
            .sort((a, b) => b.cnt - a.cnt);
    }
    return (data.funnel?.transitions || [])
        .filter((t) => isLeakDestination(t.to))
        .map((t) => ({
            from: t.from || 'Origen',
            to: t.to || 'Destino',
            pct: Number(t.pct) || 0,
            cnt: Number(t.cnt) || 0,
        }))
        .sort((a, b) => b.cnt - a.cnt);
}

function resolveFunnelRevenuePerConversion(data) {
    return Number(data?.meta?.config?.revenue_per_conversion) || 1200;
}

/** Calcula ingreso en riesgo si n8n no lo envió (leads en fugas × valor por conversión). */
function resolveFunnelRevenueAtRisk(data) {
    const funnel = data?.funnel;
    if (!funnel) return null;
    const fromPayload = funnel.total_revenue_at_risk;
    if (fromPayload != null && Number.isFinite(Number(fromPayload))) {
        return Number(fromPayload);
    }
    const revenuePer = resolveFunnelRevenuePerConversion(data);
    const leaks = resolveFunnelLeaks(data);
    if (!leaks.length) return null;
    return leaks.reduce((sum, l) => sum + (Number(l.cnt) || 0) * revenuePer, 0);
}

function ensureFunnelDerivedMetrics(data) {
    if (!data?.funnel) return data;
    const funnel = data.funnel;
    if (!Array.isArray(funnel.leaks) || !funnel.leaks.length) {
        funnel.leaks = resolveFunnelLeaks(data);
    }
    if (funnel.total_revenue_at_risk == null) {
        const risk = resolveFunnelRevenueAtRisk(data);
        if (risk != null) funnel.total_revenue_at_risk = risk;
    }
    return data;
}

function resolveFunnelMarkovStates(data) {
    const absorption = data?.funnel?.absorption_probabilities;
    if (Array.isArray(absorption) && absorption.length) {
        return filterVisibleMarkovRows(
            absorption
                .map((ap) => {
                    const raw = ap.state || '';
                    const cleaned = cleanTechnicalTerms(raw);
                    return {
                        rawState: raw,
                        state: formatMarkovStateLabel(raw, cleanTechnicalTerms),
                        group: resolveMarkovGroup(raw, cleaned),
                        conversion: (ap.prob_conversion || 0) * 100,
                        loss: (ap.prob_loss || 0) * 100,
                        steps: ap.expected_steps || 0,
                        stddev: ap.step_stddev || 0,
                    };
                })
                .filter((p) => p.conversion > 0)
                .sort((a, b) => b.conversion - a.conversion)
        );
    }
    return [];
}

function renderFunnelListItem(options) {
    const {
        title,
        subtitle,
        pct,
        color,
        barColor,
        metaLeft,
        metaRight,
        onClick,
        delay = 0,
        rank = 0,
        variant = 'feeder',
    } = options;
    const safePct = Math.max(0, Number(pct) || 0);
    const barWidth = Math.min(safePct, 100);
    const clickAttr = onClick ? `onclick="${onClick}"` : '';
    const subtitleHtml = subtitle
        ? `<span class="funnel-data-row-sub">${subtitle}</span>`
        : '';
    const rankHtml = rank > 0 ? getFunnelRankBadge(rank) : '';
    return `
        <div class="funnel-data-row funnel-data-row--${variant} card-animate" ${clickAttr} style="animation-delay: ${delay}s;" role="button" tabindex="0">
            ${rankHtml}
            <div class="funnel-data-row-main">
                <div class="funnel-data-row-head">
                    <div class="funnel-data-row-titles">
                        <span class="funnel-data-row-title">${title}</span>
                        ${subtitleHtml}
                    </div>
                    <span class="funnel-data-row-pct progress-bar-val" style="color: ${color};" data-value="${safePct.toFixed(2)}%">${safePct.toFixed(2)}%</span>
                </div>
                <div class="funnel-data-row-bar">
                    <div class="funnel-data-row-bar-fill progress-bar-fill" data-pct="${barWidth}" style="width: 0%; background: ${barColor};"></div>
                </div>
                ${metaLeft || metaRight ? `
                <div class="funnel-data-row-foot">
                    ${metaLeft ? `<span class="funnel-data-chip">${metaLeft}</span>` : ''}
                    ${metaRight ? `<span class="funnel-data-chip funnel-data-chip--value">${metaRight}</span>` : ''}
                </div>` : ''}
            </div>
        </div>
    `;
}

function renderFunnelDetails(data) {
    ensureFunnelDerivedMetrics(data);

    const conversionRate = data.funnel?.conversion_pct != null
        ? Number(data.funnel.conversion_pct).toFixed(2)
        : data.funnel?.global_conversion_pct != null
            ? Number(data.funnel.global_conversion_pct).toFixed(2)
            : '—';

    const totalLeads = Number(data.operations?.total_leads) || 0;
    const revenuePer = resolveFunnelRevenuePerConversion(data);

    const funnelConvVal = document.getElementById('funnel-conv-pct');
    if (funnelConvVal) {
        const display = conversionRate === '—' ? '—' : `${conversionRate}%`;
        funnelConvVal.setAttribute('data-value', display);
        parseAndAnimate(funnelConvVal, display);
    }

    const targetLabel = document.getElementById('funnel-target-label');
    if (targetLabel) {
        targetLabel.textContent = `Objetivo: ${cleanTechnicalTerms(data.funnel.conversion_target)}`;
    }

    const periodMeta = document.getElementById('funnel-period-meta');
    if (periodMeta) {
        const periodText = formatFunnelPeriodMeta(data);
        periodMeta.textContent = periodText || '';
        periodMeta.style.display = periodText ? 'block' : 'none';
    }

    const enrichChip = document.getElementById('funnel-enrich-chip');
    if (enrichChip) {
        const showEnrich = data.meta?._enriched_funnel === true;
        enrichChip.style.display = showEnrich ? 'inline-flex' : 'none';
    }

    const leaks = resolveFunnelLeaks(data);

    const revenueAtRisk = resolveFunnelRevenueAtRisk(data);
    const riskRevenueFormatted = revenueAtRisk != null
        ? `$${revenueAtRisk.toLocaleString('es-MX')}`
        : '—';

    const narrative = document.getElementById('funnel-narrative-subtitle');
    if (narrative) {
        if (conversionRate === '—') {
            narrative.innerHTML = 'Sin tasa de conversión calculada para este periodo.';
        } else if (totalLeads > 0) {
            narrative.innerHTML = `En este periodo (<strong>${totalLeads.toLocaleString('es-MX')} leads</strong>), <strong>${conversionRate}%</strong> llegaron a consulta agendada. Ingreso en riesgo estimado: <strong>${riskRevenueFormatted}</strong> (fugas × $${revenuePer.toLocaleString('es-MX')}; no es ingreso real).`;
        } else {
            narrative.innerHTML = `Tasa de conversión del periodo: <strong>${conversionRate}%</strong>. Ingreso en riesgo estimado: <strong>${riskRevenueFormatted}</strong> (fugas × $${revenuePer.toLocaleString('es-MX')}).`;
        }
    }

    const riskRevVal = document.getElementById('funnel-risk-revenue');
    if (riskRevVal) {
        if (revenueAtRisk == null) {
            riskRevVal.textContent = '—';
        } else {
            riskRevVal.setAttribute('data-value', riskRevenueFormatted);
            parseAndAnimate(riskRevVal, riskRevenueFormatted);
        }
    }

    const feederAlerts = resolveFunnelFeeders(data);
    const insightBanner = document.getElementById('funnel-insight-banner');
    const insightText = buildFunnelInsight(feederAlerts, leaks);
    if (insightBanner) {
        if (insightText) {
            insightBanner.innerHTML = insightText;
            insightBanner.style.display = 'block';
        } else {
            insightBanner.innerHTML = '';
            insightBanner.style.display = 'none';
        }
    }

    renderFunnelFeedersList(data, feederAlerts);
    renderFunnelLeaksList(data, leaks);

    const trapStates = Array.isArray(data.funnel?.trap_states) ? data.funnel.trap_states : [];
    const trapPanel = document.getElementById('funnel-trap-states-panel');
    if (trapPanel) {
        if (trapStates.length > 0) {
            trapPanel.style.display = 'block';
            trapPanel.innerHTML = `
                <div class="chart-title" style="margin-bottom: 12px;">
                    <span class="dot" style="background: var(--amber);"></span>
                    Estados trampa (leads estancados)
                </div>
                <div class="funnel-scroll-list">
                    ${trapStates.slice(0, 8).map((trap, idx) => renderFunnelListItem({
                        title: shortenFunnelLabel(cleanTechnicalTerms(trap.state || '—')),
                        subtitle: trap.reason || 'Bajo avance hacia conversión',
                        pct: Math.min(Number(trap.loss_rate) || 0, 100),
                        color: 'var(--amber)',
                        barColor: 'var(--amber)',
                        metaRight: `${trap.total_cnt || 0} leads`,
                        delay: idx * 0.02,
                        rank: idx + 1,
                        variant: 'leak',
                    })).join('')}
                </div>
            `;
        } else {
            trapPanel.style.display = 'none';
            trapPanel.innerHTML = '';
        }
    }

    const statesData = resolveFunnelMarkovStates(data);
    const advancedToggle = document.getElementById('funnel-markov-advanced-toggle');
    if (advancedToggle) {
        advancedToggle.checked = funnelUiState.markovAdvanced;
    }
    const activeGroupExists = funnelUiState.markovGroup === 'all'
        || statesData.some((row) => row.group === funnelUiState.markovGroup);
    if (!activeGroupExists) {
        funnelUiState.markovGroup = 'all';
    }
    renderFunnelMarkovGroupFilters(statesData);
    renderFunnelMarkovTable(statesData);
    syncFunnelMarkovAccordion();

    applyProgressBars(document.getElementById('tab-funnel'));
}

// =====================================================================
//  RENDER FORECAST TAB DETAILS
// =====================================================================

function getMaseMetricClass(mase) {
    if (typeof mase !== 'number' || !isFinite(mase)) return 'metric-mase-warn';
    if (mase < 0.85) return 'metric-mase-good';
    if (mase < 1.0) return 'metric-mase-warn';
    return 'metric-mase-bad';
}

function getMaseBadgeClass(mase) {
    if (typeof mase !== 'number' || !isFinite(mase)) return 'metric-badge-warn';
    if (mase < 0.85) return 'metric-badge-good';
    if (mase < 1.0) return 'metric-badge-warn';
    return 'metric-badge-bad';
}

function getMaseStateLabel(mase) {
    return (typeof mase === 'number' && isFinite(mase) && mase < 1.0) ? 'Aceptable' : 'Subóptimo';
}

/** Badge de tendencia ↑/↓ para tarjetas KPI del dashboard. */
function resolveKpiBackendKey(label) {
    if (Object.prototype.hasOwnProperty.call(KPI_BACKEND_LABEL_MAP, label)) return label;
    const mapped = Object.keys(KPI_BACKEND_LABEL_MAP).find(k => KPI_BACKEND_LABEL_MAP[k] === label);
    if (mapped) return mapped;
    const alias = KPI_EXPLANATION_ALIASES[label];
    if (alias) return alias;
    return label;
}

function resolveStatCardColor(color) {
    const valid = ['gold', 'blue', 'green', 'red', 'white', 'crimson'];
    return valid.includes(color) ? color : 'blue';
}

/** Extrae un número con signo desde strings tipo "-39.25%", "$534", "12.34". */
function parseSignedPercent(value) {
    if (value == null) return null;
    const n = parseFloat(String(value).replace(/[^0-9.\-+]/g, ''));
    return Number.isFinite(n) ? n : null;
}

/**
 * Reglas de semántica KPI: color de tarjeta vs chip de tendencia.
 * El chip ↑/↓ solo aparece si hay un delta explícito distinto del valor principal
 * (p. ej. WoW en el subtexto del CPL, o MASE vs línea base 1.0).
 * Métricas cuyo valor ya ES el cambio (Cambio Semanal) o son niveles absolutos
 * (50% sobre-contacto, 189% capacidad) no duplican ese número en un badge.
 */
function getKpiSemantics(kpi, data) {
    const backendKey = resolveKpiBackendKey(kpi.label);
    const label = kpi.label || '';

    if (backendKey === 'MASE' || label.includes('Precisión')) {
        const mase = parseFloat(String(kpi.value).replace(/[^0-9.]/g, ''));
        return {
            backendKey,
            showTrend: Number.isFinite(mase),
            isMase: true,
            mase,
            goodWhenUp: null,
            trendPct: null,
            cardColor: !Number.isFinite(mase) ? resolveStatCardColor(kpi.color)
                : mase < 0.75 ? 'green' : mase < 1.0 ? 'gold' : 'red',
        };
    }

    let trendPct = null;
    let goodWhenUp = true;
    let showTrend = false;
    let cardColor = resolveStatCardColor(kpi.color);

    switch (backendKey) {
        case 'Cambio semanal': {
            const wow = data?.operations?.wow_change_pct ?? parseSignedPercent(kpi.value);
            showTrend = false;
            if (wow != null) cardColor = wow >= 0 ? 'green' : 'red';
            break;
        }
        case 'Cambio regimen': {
            const shift = parseSignedPercent(kpi.value);
            showTrend = false;
            if (shift != null) cardColor = shift >= 0 ? 'green' : 'red';
            break;
        }
        case 'Utilizacion capacidad': {
            const util = parseSignedPercent(kpi.value);
            showTrend = false;
            if (util != null) {
                cardColor = util > 100 ? 'red' : util > 85 ? 'gold' : 'green';
            }
            break;
        }
        case 'Conversion global':
            showTrend = false;
            if (parseSignedPercent(kpi.value) != null) {
                const cvr = parseSignedPercent(kpi.value);
                cardColor = cvr >= 3.0 ? 'green' : cvr >= 2.0 ? 'blue' : 'red';
            }
            break;
        case 'CPL implicito': {
            const sub = kpi.sub || '';
            const m = sub.match(/([+\-]?\d+(?:\.\d+)?)\s*%\s*WoW/i);
            if (m) {
                trendPct = parseFloat(m[1]);
                goodWhenUp = false;
                showTrend = true;
                cardColor = trendPct > 20 ? 'red' : trendPct > 0 ? 'gold' : 'green';
            } else {
                showTrend = false;
                cardColor = 'blue';
            }
            break;
        }
        case 'HHI': {
            const hhi = parseSignedPercent(kpi.value);
            showTrend = false;
            if (hhi != null) {
                cardColor = hhi > 0.25 ? 'red' : hhi > 0.15 ? 'gold' : 'green';
            }
            break;
        }
        case 'Revenue at Risk': {
            showTrend = false;
            const risk = parseSignedPercent(kpi.value);
            if (risk != null && risk > 5000) cardColor = 'red';
            else if (risk != null && risk > 0) cardColor = 'gold';
            break;
        }
        default:
            if (label.includes('Sobre-Contacto')) {
                const rate = parseSignedPercent(kpi.value);
                showTrend = false;
                if (rate != null) {
                    cardColor = rate > 30 ? 'red' : rate > 15 ? 'gold' : 'green';
                }
            } else if (label.includes('Intentos')) {
                const avg = parseSignedPercent(kpi.value);
                showTrend = false;
                if (avg != null) {
                    cardColor = avg > 7 ? 'red' : avg > 5 ? 'gold' : 'blue';
                }
            } else {
                showTrend = false;
            }
            break;
    }

    return { backendKey, showTrend, isMase: false, mase: null, goodWhenUp, trendPct, cardColor };
}

function resolveKpiCardColor(kpi, data) {
    return getKpiSemantics(kpi, data).cardColor;
}

function getKpiTrendBadgeHtml(kpi, data) {
    const sem = getKpiSemantics(kpi, data);

    if (sem.isMase && sem.mase != null) {
        const mase = sem.mase;
        if (mase < 1) {
            const pct = ((1 - mase) * 100).toFixed(1);
            return `<span class="kpi-trend-badge kpi-trend-good">↓ ${pct}% base</span>`;
        }
        const pct = ((mase - 1) * 100).toFixed(1);
        return `<span class="kpi-trend-badge kpi-trend-bad">↑ ${pct}% base</span>`;
    }

    if (!sem.showTrend || sem.trendPct == null || !Number.isFinite(sem.trendPct)) return '';

    const pct = sem.trendPct;
    const absPct = Math.abs(pct).toFixed(1);

    if (Math.abs(pct) < 0.05) {
        return `<span class="kpi-trend-badge kpi-trend-neutral">→ ${absPct}%</span>`;
    }

    const isUp = pct > 0;
    const isGood = sem.goodWhenUp ? isUp : !isUp;
    const arrow = isUp ? '↑' : '↓';
    const cls = isGood ? 'kpi-trend-good' : 'kpi-trend-bad';
    return `<span class="kpi-trend-badge ${cls}">${arrow} ${absPct}%</span>`;
}

function getMaseBarStyle(mase) {
    if (mase == null || !isFinite(mase)) return { width: 0, color: 'var(--text-dim)' };
    const width = Math.min((mase / 1.5) * 100, 100);
    const color = mase < 0.85 ? 'var(--green)' : mase < 1.0 ? 'var(--amber)' : 'var(--red)';
    return { width, color };
}

function renderModelLeaderboardRow(m, rank) {
    const maseClass = getMaseMetricClass(m.mase);
    const badgeClass = getMaseBadgeClass(m.mase);
    const stateLabel = getMaseStateLabel(m.mase);
    const maseVal = m.mase != null && isFinite(m.mase) ? m.mase : null;
    const bar = getMaseBarStyle(maseVal);

    const medalHtml = rank === 1
        ? '<span class="model-medal medal-1" title="1er lugar">1</span>'
        : rank === 2
            ? '<span class="model-medal medal-2" title="2do lugar">2</span>'
            : rank === 3
                ? '<span class="model-medal medal-3" title="3er lugar">3</span>'
                : `<span class="model-rank-num">${rank}</span>`;

    const rowClasses = ['model-leaderboard-row'];
    if (rank === 1) rowClasses.push('model-row-best');
    if (rank % 2 === 0) rowClasses.push('model-row-alt');

    const bestTag = rank === 1 ? '<span class="best-model-tag">Mejor modelo</span>' : '';
    const modelName = cleanTechnicalTerms(m.name.replace(/_/g, ' ').toUpperCase());

    return `
        <tr class="${rowClasses.join(' ')}">
            <td class="model-rank-cell">${medalHtml}</td>
            <td class="metric-model-name">${modelName}${bestTag}</td>
            <td class="mase-cell">
                <div class="mase-cell-inner">
                    <span class="${maseClass}">${maseVal != null ? maseVal.toFixed(3) : 'N/A'}</span>
                    ${maseVal != null ? `<div class="mase-bar" title="MASE ${maseVal.toFixed(3)}"><div class="mase-bar-fill" data-pct="${bar.width}" style="width: 0%; background: ${bar.color};"></div></div>` : ''}
                </div>
            </td>
            <td class="metric-mae">${m.mae ? m.mae.toFixed(2) : 'N/A'}</td>
            <td class="metric-rmse">${m.rmse ? m.rmse.toFixed(2) : 'N/A'}</td>
            <td><span class="custom-badge ${badgeClass}">${stateLabel}</span></td>
        </tr>
    `;
}

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
    const cardHorizons = options.horizons || forecast.horizons;
    const bestLabel = options.bestModelName || forecast.method;
    if (horizonsGrid && cardHorizons) {
        renderHorizonCards(cardHorizons, { prefix, show14d, bestModelName: bestLabel });
    }

}

// =====================================================================
//  COMPARADOR DE MODELOS (lista desplegable + overlay)
// =====================================================================

// Paleta fija: todos distintos entre sí y distintos del azul de leads (#38bdf8).
const MODEL_COLORS = {
    random_forest: '#10b981',
    gradient_boosting: '#f97316',
    mlp_neural_network: '#ec4899',
    ridge: '#84cc16',
    lightgbm: '#06b6d4',
    autoets: '#a78bfa',
    theta_lite: '#d946ef',
    holt_winters: '#f43f5e',
    trend_season: '#f59e0b',
    seasonal_naive: '#818cf8',
    fourier_regression: '#22d3ee',
    mean_7d: '#fb923c',
    ewma: '#eab308',
};

const ML_MODEL_NAMES = [
    'random_forest',
    'gradient_boosting',
    'ridge',
    'mlp_neural_network',
    'lightgbm',
    'autoets',
];

function getModelColor(name) {
    if (!name) return '#f472b6';
    const key = normModelName(name);
    const entry = Object.entries(MODEL_COLORS).find(([k]) => normModelName(k) === key);
    if (entry) return entry[1];
    let h = 0;
    for (const c of String(name)) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
    return `hsl(${h % 360}, 72%, 58%)`;
}

function sortModelsByMase(models) {
    return [...models].sort((a, b) => {
        const ma = a.mase != null && isFinite(a.mase) ? a.mase : Infinity;
        const mb = b.mase != null && isFinite(b.mase) ? b.mase : Infinity;
        return ma - mb;
    });
}

function sortModelNamesByMase(data, names) {
    const byName = new Map(buildComparableModels(data).map(m => [m.name, m]));
    return [...names].sort((a, b) => {
        const ma = byName.get(a)?.mase ?? Infinity;
        const mb = byName.get(b)?.mase ?? Infinity;
        return ma - mb;
    });
}

function normModelName(name) {
    return String(name || '').trim().toLowerCase();
}

/** Pronóstico 1d y confianza del bloque forecast o forecast_rf que corresponde al modelo. */
function resolveDailyForecastForModel(data, modelName) {
    const f = data.forecast || {};
    const rf = data.forecast_rf;
    const confidence = f.confidence || rf?.confidence || 'media';
    const rec = getModelRecord(data, modelName);

    if (rec) {
        const v = rec.forecast_1d ?? rec.horizons?.next_1d?.forecast;
        if (v != null && isFinite(v)) return { value: v, confidence };
    }

    const key = normModelName(modelName);
    if (rf && rf.available !== false && normModelName(rf.model_name || 'random_forest') === key) {
        const v = rf.recommended_value ?? rf.horizons?.next_1d?.forecast;
        if (v != null && isFinite(v)) return { value: v, confidence: rf.confidence };
    }
    if (normModelName(f.method) === key) {
        const v = f.recommended_value ?? f.horizons?.next_1d?.forecast;
        if (v != null && isFinite(v)) return { value: v, confidence: f.confidence };
    }
    return null;
}

/** Menor MASE entre forecast.backtest_models, forecast (recomendado) y forecast_rf. */
function getBestForecastRecord(data) {
    if (!data) return null;
    const byName = new Map();

    const register = (name, mase) => {
        if (name == null || mase == null || !isFinite(mase)) return;
        const key = normModelName(name);
        const prev = byName.get(key);
        if (!prev || mase < prev.mase) byName.set(key, { name: String(name), mase });
    };

    const f = data.forecast || {};
    (f.backtest_models || []).forEach(m => register(m.name, m.mase));
    if (f.method != null && f.mase != null) register(f.method, f.mase);

    const rf = data.forecast_rf;
    if (rf && rf.available !== false) {
        register(rf.model_name || 'random_forest', rf.mase);
        (rf.backtest_models || []).forEach(m => register(m.name, m.mase));
    }

    let best = null;
    byName.forEach(rec => {
        if (!best || rec.mase < best.mase) best = rec;
    });
    if (!best) return null;

    const daily = resolveDailyForecastForModel(data, best.name);
    return {
        modelName: best.name,
        mase: best.mase,
        dailyValue: daily?.value ?? null,
        confidence: daily?.confidence || f.confidence || (rf && rf.confidence) || 'media'
    };
}

function applyBestForecastToKpis(kpis, data) {
    const best = getBestForecastRecord(data);
    if (!best || !Array.isArray(kpis)) return kpis;

    const maseSub = best.mase < 1.0 ? 'supera línea base (<1)' : 'no supera línea base (≥1)';
    const maseColor = best.mase < 0.75 ? 'green' : best.mase < 1.0 ? '' : 'red';
    const modelSub = best.modelName.replace(/_/g, ' ');
    const conf = best.confidence ? String(best.confidence) : 'media';
    const dailySub = `${modelSub} | ${conf}`;
    const dailyVal = best.dailyValue != null ? `~${Math.round(best.dailyValue)}` : null;

    const forecastLabels = new Set(['Prevision diaria', 'Pronóstico Diario']);
    const maseLabels = new Set(['MASE', 'Precisión del Modelo']);

    return kpis.map(k => {
        if (forecastLabels.has(k.label) && dailyVal) {
            return { ...k, value: dailyVal, sub: dailySub };
        }
        if (maseLabels.has(k.label)) {
            return { ...k, value: best.mase.toFixed(3), sub: maseSub, color: maseColor };
        }
        return k;
    });
}

/** Horizontes del mejor modelo global (menor MASE). */
function getBestModelHorizons(data) {
    if (!data) return null;
    const best = getBestForecastRecord(data);
    if (best) {
        const h = getModelHorizons(best.modelName);
        if (h) return h;
    }
    const rf = data.forecast_rf;
    if (rf && rf.available !== false && rf.horizons) return rf.horizons;
    return data.forecast?.horizons || null;
}

function formatModelLabel(name) {
    return cleanTechnicalTerms(String(name || '').replace(/_/g, ' ').toUpperCase());
}

function renderHorizonCards(horizons, options = {}) {
    const prefix = options.prefix || '';
    const show14d = options.show14d !== false;
    const bestName = options.bestModelName;
    const grid = document.getElementById(`${prefix}forecast-horizons-grid`);
    if (!grid || !horizons) return;

    const h1d = horizons.next_1d || {};
    const h7d = horizons.next_7d || {};
    const h14d = horizons.next_14d || {};
    const modelSub = bestName
        ? `Mejor modelo: ${formatModelLabel(bestName)}`
        : 'Mejor modelo por MASE';

    let cardsHtml = `
        <div class="card stat-card-blue card-animate" style="animation-delay: 0.03s;"
            onclick="openKpiModal('Pronóstico Mañana', '${h1d.forecast ?? 0}')">
            <div class="card-stat-label">Pronóstico Mañana</div>
            <div class="card-stat-value" id="${prefix}forecast-1d-val" data-value="${h1d.forecast ?? 0}">0</div>
            <div class="card-stat-sub">Rango: ${h1d.band_low ?? 0} a ${h1d.band_high ?? 0} leads · ${modelSub}</div>
        </div>
        <div class="card stat-card-gold card-animate" style="animation-delay: 0.06s;"
            onclick="openKpiModal('Pronóstico 7 Días', '${h7d.forecast ?? 0}')">
            <div class="card-stat-label">Pronóstico 7 Días</div>
            <div class="card-stat-value" id="${prefix}forecast-7d-val" data-value="${h7d.forecast ?? 0}">0</div>
            <div class="card-stat-sub">Rango: ${h7d.band_low ?? 0} a ${h7d.band_high ?? 0} leads · ${modelSub}</div>
        </div>`;

    if (show14d && horizons.next_14d) {
        cardsHtml += `
        <div class="card stat-card-green card-animate" style="animation-delay: 0.09s;"
            onclick="openKpiModal('Pronóstico 14 Días', '${h14d.forecast ?? 0}')">
            <div class="card-stat-label">Pronóstico 14 Días</div>
            <div class="card-stat-value" id="${prefix}forecast-14d-val" data-value="${h14d.forecast ?? 0}">0</div>
            <div class="card-stat-sub">Rango: ${h14d.band_low ?? 0} a ${h14d.band_high ?? 0} leads · ${modelSub}</div>
        </div>`;
    }

    grid.innerHTML = cardsHtml;
    parseAndAnimate(document.getElementById(`${prefix}forecast-1d-val`), h1d.forecast ?? 0);
    parseAndAnimate(document.getElementById(`${prefix}forecast-7d-val`), h7d.forecast ?? 0);
    if (show14d && horizons.next_14d) {
        parseAndAnimate(document.getElementById(`${prefix}forecast-14d-val`), h14d.forecast ?? 0);
    }
}

function seriesHasChartPoints(series) {
    return Array.isArray(series) && series.some((v) => v != null && isFinite(v));
}

function modelSeriesCoverage(series) {
    if (!Array.isArray(series)) return 0;
    return series.filter((v) => v != null && isFinite(v)).length;
}

function holdoutSeriesScore(series, splitIndex) {
    if (!Array.isArray(series) || splitIndex == null) return modelSeriesCoverage(series);
    const train = series.slice(0, splitIndex).filter((v) => v != null && isFinite(v)).length;
    const test = series.slice(splitIndex).filter((v) => v != null && isFinite(v)).length;
    const bothZones = train > 0 && test > 0 ? 10000 : 0;
    return bothZones + train + test;
}

function pickBetterModelSeries(a, b, splitIndex) {
    if (!seriesHasChartPoints(a)) return b;
    if (!seriesHasChartPoints(b)) return a;
    const scoreA = holdoutSeriesScore(a, splitIndex);
    const scoreB = holdoutSeriesScore(b, splitIndex);
    if (scoreB > scoreA) return b;
    if (scoreA > scoreB) return a;
    return a.length >= b.length ? a : b;
}

function normalizeModelSeries(series, chartLen) {
    if (!Array.isArray(series) || !chartLen) return series;
    if (series.length === chartLen) return series;
    const isSparse = series.some((v) => v == null);
    if (isSparse) {
        if (series.length < chartLen) {
            return [...series, ...Array(chartLen - series.length).fill(null)];
        }
        return series.slice(0, chartLen);
    }
    if (series.length < chartLen) {
        const out = Array(chartLen).fill(null);
        const start = chartLen - series.length;
        series.forEach((v, i) => { out[start + i] = v; });
        return out;
    }
    return series.slice(series.length - chartLen);
}

function resolveNextForecastLabel(forecast, ts) {
    const np = forecast?.next_point?.date
        || dashboardData?.forecast_rf?.next_point?.date;
    let dateStr = np;
    if (!dateStr && ts?.length) {
        const d = new Date(ts[ts.length - 1].date);
        if (!isNaN(d.getTime())) {
            d.setDate(d.getDate() + 1);
            dateStr = d.toISOString().slice(0, 10);
        }
    }
    if (!dateStr) return 'Mañana';
    const dt = new Date(dateStr);
    return dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function buildForecastExtensionData(values, forecastVal) {
    if (forecastVal == null || !isFinite(forecastVal) || !values?.length) return null;
    const n = values.length;
    const data = Array(n + 1).fill(null);
    data[n - 1] = values[n - 1];
    data[n] = forecastVal;
    return data;
}

function extendSeriesForForecastDay(series, targetLen) {
    if (!Array.isArray(series) || !targetLen) return series;
    if (series.length === targetLen) return series;
    if (series.length < targetLen) {
        return [...series, ...Array(targetLen - series.length).fill(null)];
    }
    return series.slice(0, targetLen);
}

function modelHasChartData(m) {
    return seriesHasChartPoints(m.series) || !!getModelHorizons(m.name);
}

function getAllComparableModelNames(data) {
    return buildComparableModels(data).filter(modelHasChartData).map(m => m.name);
}

function getVisibleModelNames() {
    if (showAllModels) return [...visibleModelNames];
    if (selectedCompareModel) return [selectedCompareModel];
    return [];
}

function getModelRecord(data, modelName) {
    if (!data || !modelName) return null;
    const key = normModelName(modelName);
    const statEntry = (data.forecast?.backtest_models || []).find(m => normModelName(m.name) === key);
    const rf = data.forecast_rf;

    if (rf && rf.available !== false) {
        const mlEntry = (rf.backtest_models || []).find(m => normModelName(m.name) === key);
        if (mlEntry) {
            const rfName = rf.model_name || 'random_forest';
            const isPrimary = normModelName(mlEntry.name) === normModelName(rfName);
            let series = Array.isArray(mlEntry.series) ? mlEntry.series : null;
            if (!series && isPrimary) series = buildRfAlignedSeries(data);
            if (!series && Array.isArray(statEntry?.series)) series = statEntry.series;

            let forecast_1d = mlEntry.forecast_1d;
            let horizons = mlEntry.horizons;
            if ((forecast_1d == null || !isFinite(forecast_1d)) && statEntry) {
                forecast_1d = statEntry.forecast_1d ?? statEntry.horizons?.next_1d?.forecast;
                horizons = horizons || statEntry.horizons;
            }
            if ((forecast_1d == null || !isFinite(forecast_1d)) && isPrimary) {
                forecast_1d = rf.recommended_value ?? rf.horizons?.next_1d?.forecast;
                horizons = horizons || rf.horizons;
            }

            return {
                name: mlEntry.name,
                mase: mlEntry.mase ?? statEntry?.mase,
                mae: mlEntry.mae ?? statEntry?.mae,
                rmse: mlEntry.rmse ?? statEntry?.rmse,
                series,
                horizons,
                forecast_1d: forecast_1d != null && isFinite(forecast_1d) ? forecast_1d : null,
            };
        }
    }
    if (statEntry) return statEntry;
    return buildComparableModels(data).find(m => normModelName(m.name) === key) || null;
}

function getChartForecastLine() {
    const f = dashboardData?.forecast || {};
    const visible = getVisibleModelNames();
    if (visible.length === 1) {
        const name = visible[0];
        const daily = resolveDailyForecastForModel(dashboardData, name);
        return {
            value: daily?.value ?? f.recommended_value,
            label: `Pronóstico ${formatModelLabel(name)}`,
            color: getModelColor(name),
        };
    }
    const method = f.method || 'recomendado';
    return {
        value: f.recommended_value,
        label: `Pronóstico ${formatModelLabel(method)}`,
        color: getModelColor(method),
    };
}

function getChartVisibleModelNames() {
    const chart = charts.timeseries;
    if (chart && chart.data && Array.isArray(chart.data.datasets)) {
        const names = [];
        chart.data.datasets.forEach((ds, idx) => {
            if (ds._modelName && chart.isDatasetVisible(idx)) {
                names.push(ds._modelName);
            }
        });
        if (showAllModels || selectedCompareModel || names.length) {
            return dashboardData ? sortModelNamesByMase(dashboardData, names) : names;
        }
    }
    const fallback = getVisibleModelNames();
    return dashboardData ? sortModelNamesByMase(dashboardData, fallback) : fallback;
}

// =====================================================================
//  COMPARADOR DE MODELOS (lista desplegable + overlay)
// =====================================================================

function syncModelCompareUI() {
    renderForecastBaseChart();
    renderModelDetailPanel();
}

function renderModelDetailPanel() {
    const panel = document.getElementById('model-detail-panel');
    const sub = document.getElementById('model-detail-sub');
    if (!panel) return;

    const visible = getChartVisibleModelNames();

    if (!visible.length || !dashboardData) {
        panel.innerHTML = '<div class="model-detail-empty">Selecciona un modelo en el desplegable o usa «Mostrar todas».</div>';
        if (sub) sub.textContent = 'Selecciona un modelo o pulsa «Mostrar todas». Clic en la leyenda para ocultar o mostrar filas.';
        return;
    }

    if (sub) {
        sub.textContent = visible.length === 1
            ? `1 modelo visible · pronóstico diario (1d)`
            : `${visible.length} modelos visibles · clic en la leyenda para ocultar o mostrar`;
    }

    const rows = visible.map(name => {
        const rec = getModelRecord(dashboardData, name);
        const daily = resolveDailyForecastForModel(dashboardData, name);
        const pron = daily?.value != null ? Math.round(daily.value) : '—';
        const color = getModelColor(name);
        const mase = rec?.mase;
        const maseClass = getMaseMetricClass(mase);
        return `
            <tr>
                <td style="font-weight: 600; color: ${color};">${formatModelLabel(name)}</td>
                <td class="metric-pron">${pron}</td>
                <td class="${maseClass}">${typeof mase === 'number' ? mase.toFixed(3) : '—'}</td>
                <td class="metric-mae">${rec?.mae != null ? Number(rec.mae).toFixed(2) : '—'}</td>
                <td class="metric-rmse">${rec?.rmse != null ? Number(rec.rmse).toFixed(2) : '—'}</td>
            </tr>
        `;
    }).join('');

    panel.innerHTML = `
        <div class="custom-table-container">
            <table class="custom-table model-detail-table">
                <thead>
                    <tr>
                        <th>Modelo</th>
                        <th style="text-align: right;" title="Pronóstico diario">Pron.</th>
                        <th style="text-align: right;" title="Error medio absoluto escalado">MASE</th>
                        <th style="text-align: right;" title="Error absoluto medio">MAE</th>
                        <th style="text-align: right;" title="Error cuadrático medio">RMSE</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

// Construye la lista de modelos comparables: los del backtest estadistico
// mas el Random Forest (desde forecast_rf), cada uno con su serie diaria si existe.
function buildComparableModels(data) {
    if (comparableModelsCache && comparableModelsCache.source === data) {
        return comparableModelsCache.list;
    }
    const list = [];
    const f = (data && data.forecast) ? data.forecast : {};
    const chartLen = Array.isArray(f.time_series) ? f.time_series.length : 0;
    const splitIndex = resolveTrainTestSplit(f)?.split_index ?? null;
    const mlNames = new Set(ML_MODEL_NAMES.map(normModelName));

    (f.backtest_models || []).forEach(m => {
        if (mlNames.has(normModelName(m.name))) return;
        let series = m.series;
        if (seriesHasChartPoints(series) && chartLen) {
            series = normalizeModelSeries(series, chartLen);
        }
        list.push({
            name: m.name,
            mase: m.mase,
            mae: m.mae,
            rmse: m.rmse,
            series: series,
            horizons: m.horizons,
            forecast_1d: m.forecast_1d,
        });
    });

    const rf = data ? data.forecast_rf : null;
    if (rf && rf.available !== false) {
        const rfName = rf.model_name || 'random_forest';
        (rf.backtest_models || []).forEach(m => {
            const key = normModelName(m.name);
            if (!mlNames.has(key)) return;
            let series = Array.isArray(m.series) ? m.series : null;
            if (!series && normModelName(m.name) === normModelName(rfName) && Array.isArray(rf.series)) {
                series = rf.series;
            }
            if (!series && normModelName(m.name) === normModelName(rfName)) {
                series = buildRfAlignedSeries(data);
            }
            if (seriesHasChartPoints(series) && chartLen) {
                series = normalizeModelSeries(series, chartLen);
            }
            const existing = list.find(x => normModelName(x.name) === key);
            if (existing) {
                existing.series = pickBetterModelSeries(existing.series, series, splitIndex);
                existing.mase = m.mase ?? existing.mase;
                existing.mae = m.mae ?? existing.mae;
                existing.rmse = m.rmse ?? existing.rmse;
                existing.horizons = m.horizons || existing.horizons;
                existing.forecast_1d = m.forecast_1d ?? existing.forecast_1d;
                return;
            }
            list.push({
                name: m.name,
                mase: m.mase,
                mae: m.mae,
                rmse: m.rmse,
                series: series,
                horizons: m.horizons || null,
                forecast_1d: m.forecast_1d || null,
            });
        });

        if (!list.some(m => normModelName(m.name) === normModelName(rfName))) {
            let series = Array.isArray(rf.series) ? rf.series : null;
            const e = (rf.backtest_models || []).find(x => normModelName(x.name) === normModelName(rfName));
            if (!series && e && Array.isArray(e.series)) series = e.series;
            if (!series) series = buildRfAlignedSeries(data);
            if (seriesHasChartPoints(series) && chartLen) {
                series = normalizeModelSeries(series, chartLen);
            }
            list.push({
                name: rfName,
                mase: rf.mase,
                mae: e?.mae,
                rmse: e?.rmse,
                series: series,
                horizons: rf.horizons,
                forecast_1d: rf.recommended_value ?? rf.horizons?.next_1d?.forecast,
            });
        }
    }
    comparableModelsCache = { source: data, list };
    return list;
}

function showBestModelOnLoad(data) {
    const models = buildComparableModels(data);
    const best = getBestForecastRecord(data);
    const bestEntry = best
        ? models.find((m) => normModelName(m.name) === normModelName(best.modelName))
        : null;

    if (bestEntry && seriesHasChartPoints(bestEntry.series)) {
        selectedCompareModel = bestEntry.name;
        showAllModels = false;
        visibleModelNames = new Set([bestEntry.name]);
        const sel = document.getElementById('model-compare-select');
        if (sel) {
            sel.value = bestEntry.name;
            sel.style.borderColor = getModelColor(bestEntry.name);
            sel.style.color = getModelColor(bestEntry.name);
        }
        const meta = document.getElementById('model-compare-meta');
        if (meta) {
            meta.textContent = typeof bestEntry.mase === 'number' ? `MASE (comparado): ${bestEntry.mase.toFixed(3)}` : '';
            meta.style.color = getModelColor(bestEntry.name);
        }
    } else {
        selectedCompareModel = '';
        showAllModels = false;
        visibleModelNames = new Set();
    }
    syncModelCompareUI();
}

// Alinea las predicciones diarias del backtest del Random Forest (forecast_rf.backtest_series)
// contra las fechas de la serie histórica base, dejando null donde no hay predicción.
function buildRfAlignedSeries(data) {
    const rf = data ? data.forecast_rf : null;
    if (!rf || !Array.isArray(rf.backtest_series) || !rf.backtest_series.length) return null;
    const baseTs = (data.forecast && Array.isArray(data.forecast.time_series) && data.forecast.time_series.length)
        ? data.forecast.time_series
        : (Array.isArray(rf.time_series) ? rf.time_series : []);
    if (!baseTs.length) return null;
    const predByDate = {};
    rf.backtest_series.forEach(p => {
        if (p && p.date != null) predByDate[String(p.date).split('T')[0]] = p.predicted;
    });
    const aligned = baseTs.map(d => {
        const key = String(d.date).split('T')[0];
        return (key in predByDate) ? predByDate[key] : null;
    });
    return aligned.some(v => v != null) ? aligned : null;
}

// Construye el dataset de overlay para un modelo dado.
// La leyenda muestra solo el nombre del modelo; el MASE vive únicamente en la tabla de abajo.
function overlayForModel(m) {
    return {
        label: formatModelLabel(m.name),
        series: m.series,
        color: getModelColor(m.name),
        modelName: m.name,
    };
}

function getActiveOverlays() {
    if (!dashboardData) return [];
    const visible = getVisibleModelNames();
    if (!visible.length) return [];
    const models = sortModelsByMase(
        buildComparableModels(dashboardData)
            .filter(m => visible.includes(m.name) && seriesHasChartPoints(m.series))
    );
    return models.map(overlayForModel);
}

function renderForecastBaseChart() {
    if (!dashboardData || !dashboardData.forecast) return;
    const line = getChartForecastLine();
    renderTimeSeriesChart(dashboardData.forecast, {
        canvasId: 'chart-timeseries',
        chartKey: 'timeseries',
        lineLabel: line.label,
        lineColor: line.color,
        forecastValue: line.value,
        overlays: getActiveOverlays(),
    });
}

function showAllModelOverlays() {
    showAllModels = true;
    selectedCompareModel = '';
    visibleModelNames = new Set(getAllComparableModelNames(dashboardData));
    const sel = document.getElementById('model-compare-select');
    if (sel) { sel.value = ''; sel.style.borderColor = ''; sel.style.color = ''; }
    const meta = document.getElementById('model-compare-meta');
    if (meta) { meta.textContent = 'Mostrando todos los modelos'; meta.style.color = ''; }
    syncModelCompareUI();
}

function clearModelOverlays() {
    showAllModels = false;
    selectedCompareModel = '';
    visibleModelNames = new Set();
    const sel = document.getElementById('model-compare-select');
    if (sel) { sel.value = ''; sel.style.borderColor = ''; sel.style.color = ''; }
    const meta = document.getElementById('model-compare-meta');
    if (meta) { meta.textContent = ''; meta.style.color = ''; }
    syncModelCompareUI();
}

function populateModelCompareDropdown(data) {
    const sel = document.getElementById('model-compare-select');
    if (!sel) return;
    const models = sortModelsByMase(buildComparableModels(data));

    let html = '<option value="">Ninguno (modelo recomendado)</option>';
    models.forEach(m => {
        const hasData = modelHasChartData(m);
        const label = formatModelLabel(m.name);
        const color = getModelColor(m.name);
        html += `<option value="${m.name}" style="color:${color}"${hasData ? '' : ' disabled'}>${label}${hasData ? '' : ' (sin datos)'}</option>`;
    });
    sel.innerHTML = html;
    selectedCompareModel = '';
    showAllModels = false;
    visibleModelNames = new Set();
    sel.style.borderColor = '';
    sel.style.color = '';
    const meta = document.getElementById('model-compare-meta');
    if (meta) { meta.textContent = ''; meta.style.color = ''; }
}

function getModelHorizons(name) {
    if (!name || !dashboardData) return null;
    const rf = dashboardData.forecast_rf;
    const rfName = rf ? (rf.model_name || 'random_forest') : null;
    if (rf && rf.available !== false && normModelName(name) === normModelName(rfName) && rf.horizons) {
        return rf.horizons;
    }
    const f = dashboardData.forecast || {};
    if (normModelName(f.method) === normModelName(name) && f.horizons) return f.horizons;
    const m = (f.backtest_models || []).find(x => normModelName(x.name) === normModelName(name));
    if (m && m.horizons) return m.horizons;
    const daily = resolveDailyForecastForModel(dashboardData, name);
    if (daily?.value != null) {
        return {
            next_1d: { forecast: daily.value, band_low: null, band_high: null, method: name },
        };
    }
    return null;
}

function onModelCompareChange() {
    const sel = document.getElementById('model-compare-select');
    if (!sel) return;
    selectedCompareModel = sel.value || '';
    showAllModels = false;
    visibleModelNames = selectedCompareModel ? new Set([selectedCompareModel]) : new Set();

    const color = selectedCompareModel ? getModelColor(selectedCompareModel) : '';
    sel.style.borderColor = color;
    sel.style.color = color;

    const meta = document.getElementById('model-compare-meta');
    if (meta) {
        const m = buildComparableModels(dashboardData).find(x => x.name === selectedCompareModel);
        meta.textContent = (m && typeof m.mase === 'number') ? `MASE (comparado): ${m.mase.toFixed(3)}` : '';
        meta.style.color = color;
    }

    syncModelCompareUI();
}

// =====================================================================
//  INTERACTIVE ALERTS CENTRE
// =====================================================================

function formatAlertThreshold(threshold, alert) {
    if (alert?.threshold_display) return alert.threshold_display;
    if (threshold == null || threshold === 0) return 'N/A';
    if (isIntervalMinutesMetric(alert)) {
        return formatDurationPair(alert.actual, threshold).threshold.text;
    }
    return threshold;
}

function isIntervalMinutesMetric(alert) {
    return alert?.metric === 'avg_interval_min';
}

function formatAlertObservedValue(alert) {
    if (alert?.actual_display) return alert.actual_display;
    const val = alert?.actual;
    if (val === undefined || val === null || val === '') return '—';
    if (isIntervalMinutesMetric(alert)) {
        return formatDurationPair(alert.actual, alert.threshold ?? INTERVAL_CALLBACK_SLA_MIN).actual.text;
    }
    return val;
}

function formatAlertTitle(alert) {
    return cleanTechnicalTerms(alert.title || '');
}

function renderAlertsCentre(alerts) {
    const statsGrid = document.getElementById('alerts-stats-cards');
    const tableBody = document.getElementById('alerts-centre-table-body');
    if (!statsGrid || !tableBody) return;

    renderAlertsRecurrenceFilters(dashboardHistory);

    // Calculate aggregated metrics
    const total = alerts.length;
    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const warningCount = alerts.filter(a => a.severity === 'warning').length;
    const infoCount = alerts.filter(a => a.severity === 'info').length;
    const maxRpn = alerts.length > 0 ? Math.max(...alerts.map(a => a.rpn_score || 0)) : 0;
    const recurrentCount = alerts.filter((a) => classifyAlertRecurrence(a) === 'recurrent').length;

    statsGrid.innerHTML = `
        <div class="card stat-card-gold card-animate" style="animation-delay: 0.03s;"
            onclick="openKpiModal('Alertas Totales', '${total}')">
            <div class="card-stat-label">Alertas Totales</div>
            <div class="card-stat-value" id="alert-stat-total" data-value="${total}">0</div>
            <div class="card-stat-sub">Métricas bajo observación</div>
        </div>
        <div class="card stat-card-crimson card-animate" style="animation-delay: 0.06s;"
            onclick="openKpiModal('Alertas Críticas', '${criticalCount}')">
            <div class="card-stat-label">Alertas Críticas</div>
            <div class="card-stat-value" id="alert-stat-critical" data-value="${criticalCount}">0</div>
            <div class="card-stat-sub">Acción urgente requerida</div>
        </div>
        <div class="card stat-card-blue card-animate" style="animation-delay: 0.09s;"
            onclick="openKpiModal('Severidad Máxima', '${maxRpn}')">
            <div class="card-stat-label">Severidad Máxima</div>
            <div class="card-stat-value" id="alert-stat-max-rpn" data-value="${maxRpn}">0</div>
            <div class="card-stat-sub">RPN (prioridad de riesgo)</div>
        </div>
        <div class="card stat-card-green card-animate" style="animation-delay: 0.12s;"
            onclick="openKpiModal('Advertencias e Info', '${warningCount + infoCount}')">
            <div class="card-stat-label">Advertencias e Info</div>
            <div class="card-stat-value" id="alert-stat-warning-info" data-value="${warningCount + infoCount}">0</div>
            <div class="card-stat-sub">Desviaciones menores</div>
        </div>
        ${dashboardHistory?.compare?.available ? `
        <div class="card stat-card-gold card-animate" style="animation-delay: 0.15s;"
            onclick="openKpiModal('Alertas Recurrentes', '${recurrentCount}')">
            <div class="card-stat-label">Alertas Recurrentes</div>
            <div class="card-stat-value" id="alert-stat-recurrent" data-value="${recurrentCount}">0</div>
            <div class="card-stat-sub">vs ejecución anterior</div>
        </div>` : ''}
    `;

    // Trigger animations for alerts stats
    parseAndAnimate(document.getElementById('alert-stat-total'), total);
    parseAndAnimate(document.getElementById('alert-stat-critical'), criticalCount);
    parseAndAnimate(document.getElementById('alert-stat-max-rpn'), maxRpn);
    parseAndAnimate(document.getElementById('alert-stat-warning-info'), warningCount + infoCount);
    const recurrentEl = document.getElementById('alert-stat-recurrent');
    if (recurrentEl) parseAndAnimate(recurrentEl, recurrentCount);

    renderAlertsResolvedPanel();
    // Apply Filter state
    filterAlerts(currentAlertFilter);
}

function filterAlerts(severityType) {
    currentAlertFilter = severityType;
    document.querySelectorAll('#alerts-severity-filters .filter-pill').forEach(btn => {
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

    if (currentRecurrenceFilter === 'new') {
        filtered = filtered.filter((a) => classifyAlertRecurrence(a) === 'new');
    } else if (currentRecurrenceFilter === 'recurrent') {
        filtered = filtered.filter((a) => classifyAlertRecurrence(a) === 'recurrent');
    } else if (currentRecurrenceFilter === 'resolved') {
        filtered = [];
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
        const recurrence = classifyAlertRecurrence(a);
        const recurrenceBadge = recurrence === 'new'
            ? '<span class="custom-badge custom-badge-success" style="margin-left:8px;font-size:10px;">Nueva</span>'
            : recurrence === 'recurrent'
                ? '<span class="custom-badge custom-badge-warning" style="margin-left:8px;font-size:10px;">Recurrente</span>'
                : '';

        return `
            <tr style="animation: fadeIn 0.3s ease-out;">
                <td>
                    <span class="custom-badge custom-badge-${a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'success'}">${badgeLabel}</span>
                </td>
                <td style="font-weight: 600; color: white;">${formatAlertTitle(a)}${recurrenceBadge}</td>
                <td style="font-family: var(--mono); font-weight: 600; color: var(--gold); text-align: right;">${formatAlertObservedValue(a)}</td>
                <td style="font-family: var(--mono); color: var(--text-muted); text-align: right;">${formatAlertThreshold(a.threshold, a)}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-family: var(--mono); font-weight: 700; font-size: 13px; min-width: 32px;">${a.rpn_score || 0}</span>
                        <div class="rpn-bar"><div class="fill progress-bar-fill" data-pct="${rpnPct}" style="width: 0%; background: ${rpnColor};"></div></div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    applyProgressBars(tableBody);
}

const plotAreaBackgroundPlugin = {
    id: 'plotAreaBackground',
    beforeDatasetsDraw(chart, _args, opts) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        ctx.save();
        ctx.fillStyle = (opts && opts.fillColor) || 'rgba(56, 189, 248, 0.06)';
        ctx.fillRect(
            chartArea.left,
            chartArea.top,
            chartArea.right - chartArea.left,
            chartArea.bottom - chartArea.top
        );
        ctx.restore();
    },
};

// =====================================================================
//  CHART.JS PLOTTING INITIALIZERS
// =====================================================================

function computeTrainTestSplitClient(n, timeSeries = null) {
    const MIN_TEST_DAYS = 14;
    const TRAIN_RATIO = 0.7;
    if (!n || n < MIN_TEST_DAYS + 1) return null;
    let trainCount = Math.floor(n * TRAIN_RATIO);
    let testCount = n - trainCount;
    if (testCount < MIN_TEST_DAYS) {
        trainCount = n - MIN_TEST_DAYS;
        testCount = MIN_TEST_DAYS;
    }
    if (trainCount < 1) return null;
    const splitIndex = trainCount;
    let splitDate = null;
    if (Array.isArray(timeSeries) && timeSeries[splitIndex]?.date) {
        splitDate = String(timeSeries[splitIndex].date).split('T')[0];
    }
    return {
        train_count: trainCount,
        test_count: testCount,
        split_index: splitIndex,
        split_date: splitDate,
    };
}

function resolveTrainTestSplit(forecast) {
    return forecast?.train_test_split
        || dashboardData?.forecast_rf?.diagnostics?.train_test_split
        || computeTrainTestSplitClient(forecast?.time_series?.length, forecast?.time_series);
}

function updateForecastSplitSubtitle(forecast) {
    const el = document.getElementById('forecast-chart-split-sub');
    if (!el || !forecast) return;
    const split = resolveTrainTestSplit(forecast);
    if (!split) {
        el.textContent = '';
        return;
    }
    let cutLabel = split.split_date;
    if (cutLabel) {
        const dt = new Date(cutLabel);
        if (!isNaN(dt.getTime())) {
            cutLabel = dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        }
    }
    el.textContent = `Entrenamiento: ${split.train_count} días · Prueba: ${split.test_count} días (holdout 30%)${cutLabel ? ` · Corte: ${cutLabel}` : ''}`;
}

function buildTrainTestSplitAnnotation(split, isLight, isForecastChart) {
    if (!isForecastChart || !split || split.split_index == null) return {};
    const lineColor = isLight ? 'rgba(100, 116, 139, 0.65)' : 'rgba(148, 163, 184, 0.55)';
    const labelColor = isLight ? '#475569' : '#94a3b8';
    const xPos = split.split_index - 0.5;
    return {
        trainTestSplit: {
            type: 'line',
            xMin: xPos,
            xMax: xPos,
            borderColor: lineColor,
            borderWidth: 2,
            borderDash: [6, 4],
            label: {
                display: true,
                content: 'Entrenamiento | Prueba',
                position: 'start',
                backgroundColor: 'transparent',
                color: labelColor,
                font: { size: 10, family: 'Inter', weight: '600' },
                padding: 4,
            },
        },
    };
}

function computeChartYBounds(datasets) {
    const nums = [];
    (datasets || []).forEach((ds) => {
        (ds.data || []).forEach((v) => {
            if (v != null && isFinite(Number(v))) nums.push(Number(v));
        });
    });
    if (!nums.length) return null;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const span = Math.max(max - min, 1);
    const pad = Math.max(span * 0.1, 8);
    return {
        min: min - pad,
        max: max + pad,
    };
}

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
    const forecastVal = options.forecastValue != null ? options.forecastValue : forecast.recommended_value;
    const overlays = Array.isArray(options.overlays)
        ? options.overlays
        : (options.overlay ? [options.overlay] : []);
    const heavyChart = overlays.length > 2;
    const isForecastChart = chartKey === 'timeseries';
    const forecastAnimated = isForecastChart && shouldAnimateForecastChart();
    const showForecastLine = isForecastChart && !isBar && forecastVal != null && isFinite(forecastVal);
    const forecastExtension = showForecastLine ? buildForecastExtensionData(values, forecastVal) : null;

    let chartLabels = labels;
    let leadsData = values;
    if (forecastExtension) {
        chartLabels = [...labels, resolveNextForecastLabel(forecast, ts)];
        leadsData = [...values, null];
    }

    const datasets = [
        {
            label: 'Leads diarios',
            data: leadsData,
            borderColor: isLight ? '#0284c7' : '#38bdf8',
            backgroundColor: isBar
                ? (isLight ? 'rgba(2, 132, 199, 0.55)' : 'rgba(56, 189, 248, 0.45)')
                : 'transparent',
            fill: false,
            tension: 0.35,
            borderRadius: isBar ? 6 : 0,
            pointRadius: isBar ? 0 : (forecastAnimated ? 3 : (heavyChart ? 0 : 2)),
            pointHoverRadius: isBar ? 0 : (forecastAnimated ? 8 : (heavyChart ? 0 : 6)),
            pointBackgroundColor: isLight ? '#0284c7' : '#38bdf8',
            pointBorderColor: isLight ? '#ffffff' : '#080c14',
            pointBorderWidth: 2,
            borderWidth: isBar ? 0 : 2.5
        }
    ];

    if (forecastExtension) {
        datasets.push({
            type: 'line',
            label: lineLabel,
            data: forecastExtension,
            borderColor: lineColor,
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: forecastExtension.map((v, i) => i === forecastExtension.length - 1 ? 6 : 0),
            pointHoverRadius: forecastExtension.map((v, i) => i === forecastExtension.length - 1 ? 8 : 0),
            pointBackgroundColor: lineColor,
            fill: false,
            spanGaps: false,
        });
    }

    const chartDataLen = chartLabels.length;
    const trainTestSplit = resolveTrainTestSplit(forecast);
    overlays.forEach(ov => {
        if (!ov || !seriesHasChartPoints(ov.series)) return;
        datasets.push({
            type: 'line',
            label: ov.label || 'Modelo comparado',
            data: extendSeriesForForecastDay(ov.series, chartDataLen),
            borderColor: ov.color || (isLight ? '#db2777' : '#f472b6'),
            backgroundColor: 'transparent',
            borderWidth: heavyChart ? 1.8 : 2.5,
            tension: 0.25,
            pointRadius: 0,
            pointHoverRadius: heavyChart ? 0 : 4,
            fill: false,
            spanGaps: true,
            clip: false,
            _modelName: ov.modelName || null,
        });
    });

    const yBounds = computeChartYBounds(datasets);
    const splitAnnotations = buildTrainTestSplitAnnotation(trainTestSplit, isLight, isForecastChart);
    updateForecastSplitSubtitle(forecast);

    charts[chartKey] = new Chart(ctx, {
        type: chartType,
        plugins: isForecastChart ? [plotAreaBackgroundPlugin] : [],
        data: {
            labels: chartLabels,
            datasets
        },
        options: {
            animation: isForecastChart
                ? getForecastChartAnimationOptions(heavyChart)
                : getChartAnimationOptions(heavyChart),
            transitions: forecastAnimated ? {
                hide: {
                    animations: {
                        opacity: { duration: 380, easing: 'easeInOutQuad', to: 0 },
                    },
                },
                show: {
                    animations: {
                        opacity: { duration: 480, easing: 'easeOutQuart', from: 0, to: 1 },
                    },
                },
            } : ((PERF.lite || heavyChart) ? {
                active: { animation: { duration: 0 } },
            } : {
                hide: {
                    animations: {
                        opacity: { duration: 200, easing: 'easeInOutQuad', to: 0 },
                    },
                },
                show: {
                    animations: {
                        opacity: { duration: 250, easing: 'easeOutQuart', from: 0, to: 1 },
                    },
                },
            }),
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                plotAreaBackground: isForecastChart ? {
                    fillColor: isLight ? 'rgba(2, 132, 199, 0.05)' : 'rgba(56, 189, 248, 0.06)',
                } : undefined,
                annotation: {
                    annotations: splitAnnotations,
                },
                legend: {
                    display: true,
                    onClick: (evt, legendItem, legend) => {
                        const chart = legend.chart;
                        const index = legendItem.datasetIndex;
                        if (chart.isDatasetVisible(index)) {
                            chart.hide(index);
                        } else {
                            chart.show(index);
                        }
                        if (chart.data.datasets[index]._modelName) {
                            renderModelDetailPanel();
                        }
                    },
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
                    beginAtZero: false,
                    grace: 0,
                    afterDataLimits(axis) {
                        if (!yBounds) return;
                        axis.min = yBounds.min;
                        axis.max = yBounds.max;
                    },
                    grid: { color: isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255,255,255,0.02)' },
                    ticks: { color: isLight ? '#475569' : '#64748b', font: { size: 11, family: 'JetBrains Mono' } }
                }
            }
        }
    });
}

function setTimeSeriesType(type, ev) {
    if (ev) ev.preventDefault();
    timeSeriesType = type;
    document.querySelectorAll('.chart-toolbar [data-ts-type]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tsType === type);
    });
    if (dashboardData && dashboardData.forecast) {
        const line = getChartForecastLine();
        renderTimeSeriesChart(dashboardData.forecast, {
            canvasId: 'chart-timeseries',
            chartKey: 'timeseries',
            lineLabel: line.label,
            lineColor: line.color,
            forecastValue: line.value,
            overlays: getActiveOverlays()
        });
    }
}

function renderSeasonalChart(indices, options = {}) {
    const canvasId = options.canvasId || 'chart-seasonal';
    const chartKey = options.chartKey || 'seasonal';

    if (charts[chartKey]) charts[chartKey].destroy();
    const element = document.getElementById(canvasId);
    if (!element || !Array.isArray(indices) || indices.length === 0) return;

    const isLight = document.body.classList.contains('light-mode');
    const ctx = element.getContext('2d');
    charts[chartKey] = new Chart(ctx, {
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
                hoverBackgroundColor: indices.map(i => {
                    if (i.index >= 1) {
                        return isLight ? 'rgba(132, 204, 22, 0.95)' : 'rgba(163, 230, 53, 0.9)';
                    } else {
                        return isLight ? 'rgba(225, 29, 72, 0.85)' : 'rgba(244, 63, 94, 0.8)';
                    }
                }),
                hoverBorderColor: indices.map(i => {
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
            animation: getChartAnimationOptions(),
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
    const animate = shouldAnimateInvestmentChart();

    charts.campaigns = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: campaigns.map(c => c.name ? cleanTechnicalTerms(c.name).substring(0, 30) : 'N/A'),
            datasets: [{
                data: campaigns.map(c => c.spend || c.total_spend || 0),
                backgroundColor: colors.slice(0, campaigns.length).map(c => c + '77'),
                borderColor: colors.slice(0, campaigns.length),
                borderWidth: 2,
                borderRadius: 6,
                spacing: 2,
                hoverOffset: 14,
                hoverBorderWidth: 3,
            }]
        },
        options: {
            animation: getInvestmentChartAnimationOptions(),
            animations: animate ? {
                circumference: {
                    duration: 1100,
                    easing: 'easeOutCubic',
                    delay: (context) => (context.type === 'data' ? context.dataIndex * 80 : 0),
                },
                numbers: {
                    type: 'number',
                    duration: 900,
                    easing: 'easeOutCubic',
                },
            } : undefined,
            transitions: animate ? {
                active: {
                    animation: {
                        duration: 380,
                        easing: 'easeOutQuart',
                    },
                },
            } : undefined,
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
    const hourlyValues = hourly.map(h => h.probability !== undefined ? (h.probability * 100) : (h.count || h.calls || h.total || 0));
    const maxVal = Math.max(...hourlyValues);
    const peakBg = isLight ? 'rgba(225, 29, 72, 0.85)' : 'rgba(244, 63, 94, 0.85)';
    const peakHover = isLight ? 'rgba(225, 29, 72, 0.95)' : 'rgba(244, 63, 94, 0.95)';
    const normalBg = isLight ? 'rgba(132, 204, 22, 0.55)' : 'rgba(163, 230, 53, 0.45)';
    const normalHover = isLight ? 'rgba(132, 204, 22, 0.75)' : 'rgba(163, 230, 53, 0.65)';
    charts.hourly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: hourly.map(h => h.label || `${h.hour !== undefined ? h.hour : h.hr}:00`),
            datasets: [{
                label: 'Contactos',
                data: hourlyValues,
                backgroundColor: hourlyValues.map(v => v === maxVal ? peakBg : normalBg),
                hoverBackgroundColor: hourlyValues.map(v => v === maxVal ? peakHover : normalHover),
                borderRadius: 4
            }]
        },
        options: {
            animation: getChartAnimationOptions(),
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

function renderDailyVolumeChart(ops) {
    if (!ops || !Array.isArray(ops.daily_volumes) || ops.daily_volumes.length === 0) return;
    if (charts.daily_volume) charts.daily_volume.destroy();
    const element = document.getElementById('chart-daily-volume');
    if (!element) return;

    const isLight = document.body.classList.contains('light-mode');
    const ctx = element.getContext('2d');

    // Calculate values
    const labels = ops.daily_volumes.map(d => {
        const parts = d.date.split('-');
        if (parts.length === 3) {
            const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            const mIdx = parseInt(parts[1]) - 1;
            return `${parts[2]}-${months[mIdx] || parts[1]}`;
        }
        return d.date;
    });
    const leads = ops.daily_volumes.map(d => d.leads);
    const avgVal = ops.avg_daily || 0;

    const avgLine = Array(leads.length).fill(avgVal);
    const isBar = dailyVolumeType === 'bar';

    charts.daily_volume = new Chart(ctx, {
        type: dailyVolumeType,
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Promedio Diario',
                    data: avgLine,
                    type: 'line',
                    borderColor: isLight ? '#b27415' : '#e0992a',
                    borderDash: [5, 5],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                    order: 1
                },
                {
                    label: 'Leads Recibidos',
                    data: leads,
                    type: isBar ? 'bar' : 'line',
                    backgroundColor: isBar
                        ? (isLight ? 'rgba(2, 132, 199, 0.75)' : 'rgba(56, 189, 248, 0.7)')
                        : (isLight ? 'rgba(2, 132, 199, 0.15)' : 'rgba(56, 189, 248, 0.15)'),
                    borderColor: isLight ? '#0284c7' : '#38bdf8',
                    borderWidth: isBar ? 1 : 2,
                    borderRadius: isBar ? 4 : 0,
                    fill: !isBar,
                    tension: isBar ? 0 : 0.35,
                    pointRadius: isBar ? 0 : 2,
                    pointHoverRadius: isBar ? 0 : 6,
                    hoverBackgroundColor: isLight ? 'rgba(2, 132, 199, 0.95)' : 'rgba(56, 189, 248, 0.95)',
                    hoverBorderColor: isLight ? '#0284c7' : '#ffffff',
                    hoverBorderWidth: 2,
                    order: 2
                }
            ]
        },
        options: {
            animation: getChartAnimationOptions(),
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: isLight ? '#475569' : '#94a3b8',
                        font: { size: 10, family: 'Inter', weight: 'bold' },
                        boxWidth: 12
                    }
                },
                tooltip: {
                    backgroundColor: isLight ? '#ffffff' : '#05080f',
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
                x: {
                    grid: { display: false },
                    ticks: {
                        color: isLight ? '#475569' : '#94a3b8',
                        font: { size: 9 },
                        maxTicksLimit: 7
                    }
                },
                y: {
                    grid: { color: isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255,255,255,0.02)' },
                    ticks: { color: isLight ? '#475569' : '#64748b', font: { family: 'JetBrains Mono' } }
                }
            }
        }
    });
}

function setDailyVolumeType(type, ev) {
    if (ev) ev.preventDefault();
    dailyVolumeType = type;
    document.querySelectorAll('.chart-toolbar button').forEach(btn => {
        if (btn.id === 'btn-vol-bar') {
            btn.classList.toggle('active', type === 'bar');
        } else if (btn.id === 'btn-vol-line') {
            btn.classList.toggle('active', type === 'line');
        }
    });
    if (dashboardData && dashboardData.operations) {
        renderDailyVolumeChart(dashboardData.operations);
    }
}

function renderOperationsTab(data, options = {}) {
    const renderCharts = options.charts !== false;
    if (!data || !data.operations) return;
    const ops = data.operations;
    const call = ops.call_metrics || {};
    const dist = ops.contact_distribution || {};
    const derived = ops.derived || {};
    const capacity = derived.forecast_vs_capacity || {};

    // Capacity badge
    const capacityBadge = document.getElementById('operations-capacity-badge');
    if (capacityBadge) {
        if (capacity.available) {
            const label = capacity.label === 'critical' ? 'Presión crítica'
                : capacity.label === 'pressure' ? 'Bajo presión' : 'Capacidad OK';
            capacityBadge.style.display = 'block';
            capacityBadge.innerHTML = `<strong>Forecast vs capacidad:</strong> ${label} — pronóstico ${capacity.forecast_value} vs promedio ${capacity.avg_daily} (ratio ${capacity.ratio})`;
        } else {
            capacityBadge.style.display = 'none';
            capacityBadge.innerHTML = '';
        }
    }

    renderLittlesLawCards(ops);

    // 1. Populate KPI Cards
    const kpiCardsEl = document.getElementById('operations-kpi-cards');
    if (kpiCardsEl) {
        const totalRecords = call.total_records || 0;
        const uniqueContacts = call.unique_contacts || 0;
        const attemptsAvg = call.call_rank ? call.call_rank.avg : 0;
        const intervalAvg = call.minutes_since_prev ? call.minutes_since_prev.avg : 0;

        const intervalPair = formatDurationPair(intervalAvg, INTERVAL_CALLBACK_SLA_MIN);

        const kpis = [];
        if (derived.first_contact_rate != null) {
            kpis.push({
                label: 'First Contact Rate (Tasa de Primer Contacto)',
                value: (derived.first_contact_rate * 100).toFixed(1) + '%',
                sub: '1.er intento / únicos',
                color: 'green',
            });
        }
        if (derived.sweet_spot_pct != null) {
            kpis.push({
                label: 'Sweet Spot % (Intentos 1–3)',
                value: derived.sweet_spot_pct.toFixed(1) + '%',
                sub: 'Intentos 1–3',
                color: 'green',
            });
        }
        if (derived.dial_efficiency != null) {
            kpis.push({
                label: 'Dial Efficiency (Eficiencia de Marcación)',
                value: (derived.dial_efficiency * 100).toFixed(1) + '%',
                sub: 'Únicos / registros',
                color: 'blue',
            });
        }
        if (derived.overcontact_index != null) {
            kpis.push({
                label: 'Overcontact Index (Llamadas >7 est.)',
                value: Math.round(derived.overcontact_index).toLocaleString('es-MX'),
                sub: 'Llamadas >7 est.',
                color: 'red',
            });
        }
        kpis.push(
            {
                label: 'Total Records (Registros de Llamadas)',
                value: totalRecords.toLocaleString(),
                sub: 'llamadas totales',
                color: 'blue'
            },
            {
                label: 'Unique Leads (Contactos Únicos)',
                value: uniqueContacts.toLocaleString(),
                sub: 'leads únicos',
                color: 'blue'
            },
            {
                label: 'Avg Dial Attempts (Intentos Promedio)',
                value: attemptsAvg.toFixed(2),
                sub: `rango: 1-${call.call_rank ? call.call_rank.max : 365}`,
                color: attemptsAvg > 7 ? 'red' : 'blue'
            },
            {
                label: 'Avg Callback Interval (Demora entre Re-intentos)',
                value: intervalPair.actual.text,
                sub: `objetivo: ≤${intervalPair.threshold.text}`,
                color: intervalAvg > 1440 ? 'red' : 'blue'
            }
        );

        kpiCardsEl.innerHTML = kpis.map((kpi, idx) => {
            const escapedLabel = kpi.label.replace(/'/g, "\\'");
            const escapedValue = String(kpi.value).replace(/'/g, "\\'");
            return `
                <div class="card stat-card-${kpi.color} card-animate" style="animation-delay: ${idx * 0.025}s;cursor:pointer;"
                    onclick="openKpiModal('${escapedLabel}', '${escapedValue}')">
                    <div class="card-stat-label">${kpi.label}</div>
                    <div class="card-stat-value" id="ops-kpi-val-${idx}">${kpi.value}</div>
                    <div class="card-stat-sub">${kpi.sub}</div>
                </div>
            `;
        }).join('');

        kpis.forEach((kpi, idx) => {
            const el = document.getElementById(`ops-kpi-val-${idx}`);
            parseAndAnimate(el, kpi.value);
        });
    }

    // 2. Render Daily Volume Chart
    const volSub = document.getElementById('volume-chart-sub');
    if (volSub) {
        volSub.textContent = `${ops.total_days} días | Promedio: ${Math.round(ops.avg_daily)} leads/día`;
    }
    if (renderCharts) {
        renderDailyVolumeChart(ops);
        const seasonalIndices = data?.operations?.seasonal_indices
            || data?.forecast?.seasonal_indices;
        if (seasonalIndices) renderSeasonalChart(seasonalIndices);
    }

    // 3. Populate Contact Distribution Bars
    const totalCalls = call.total_records || 1;
    const contactTotalEl = document.getElementById('contact-total-calls');
    if (contactTotalEl) {
        contactTotalEl.textContent = `${totalCalls.toLocaleString()} llamadas totales`;
    }

    const distBarsEl = document.getElementById('contact-distribution-bars');
    if (distBarsEl) {
        const items = [
            {
                label: '1er intento',
                val: dist.first_attempts || 0,
                color: 'var(--green)'
            },
            {
                label: '1-3 intentos',
                val: dist.attempts_1_to_3 || 0,
                color: 'var(--blue)'
            },
            {
                label: '1-5 intentos',
                val: dist.attempts_1_to_5 || 0,
                color: 'var(--gold)'
            },
            {
                label: '>7 (sobre-contacto)',
                val: dist.overcontact_calls || 0,
                color: 'var(--red)'
            }
        ];

        distBarsEl.innerHTML = items.map(item => {
            const pct = ((item.val / totalCalls) * 100).toFixed(1);
            return `
                <div class="progress-bar-wrapper" style="width: 100%;">
                    <div style="display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 600; margin-bottom: 6px; color: var(--text-muted);">
                        <span>${item.label}</span>
                        <span style="font-family: var(--mono); color: var(--text-main);">${item.val.toLocaleString()} (${pct}%)</span>
                    </div>
                    <div style="height: 8px; background: rgba(255,255,255,0.03); border-radius: 4px; overflow: hidden; position: relative; border: 1px solid rgba(255,255,255,0.02);">
                        <div class="progress-bar-fill" style="width: ${pct}%; background: ${item.color};" data-pct="${pct}"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 4. Update Warning Text
    const overcontactWarningText = document.getElementById('contact-overcontact-warning-text');
    if (overcontactWarningText) {
        overcontactWarningText.textContent = `${dist.overcontact_pct || 0}% de llamadas exceden el sweet spot de intentos`;
    }

    // 5. Render Hourly Distribution Chart
    const hourlySub = document.getElementById('hourly-chart-sub');
    if (hourlySub && ops.peak_hour !== undefined) {
        const peakStr = `${String(ops.peak_hour).padStart(2, '0')}:00`;
        const valleyStr = `${String(ops.valley_hour !== undefined ? ops.valley_hour : 3).padStart(2, '0')}:00`;
        hourlySub.textContent = `Pico: ${peakStr} | Valle: ${valleyStr}`;
    }
    if (renderCharts) renderHourlyChart(ops.hourly_distribution);
}

// =====================================================================
//  SPOTLIGHT EFFECT TRACKING
// =====================================================================

function initSpotlight() {
    if (PERF.lite) return;

    const flashlight = document.querySelector('.global-flashlight');
    const sidebar = document.querySelector('.sidebar');
    const topbar = document.querySelector('.topbar');
    let rafId = null;
    let lastX = 0;
    let lastY = 0;
    let activeCard = null;

    document.addEventListener('mousemove', (e) => {
        lastX = e.clientX;
        lastY = e.clientY;
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            rafId = null;
            if (flashlight) {
                flashlight.style.setProperty('--global-mouse-x', `${lastX}px`);
                flashlight.style.setProperty('--global-mouse-y', `${lastY}px`);
            }
            if (sidebar) {
                const rect = sidebar.getBoundingClientRect();
                sidebar.style.setProperty('--sidebar-mouse-x', `${lastX - rect.left}px`);
                sidebar.style.setProperty('--sidebar-mouse-y', `${lastY - rect.top}px`);
            }
            if (topbar) {
                const rect = topbar.getBoundingClientRect();
                topbar.style.setProperty('--topbar-mouse-x', `${lastX - rect.left}px`);
                topbar.style.setProperty('--topbar-mouse-y', `${lastY - rect.top}px`);
            }
            const hovered = document.elementFromPoint(lastX, lastY)?.closest('.card');
            if (hovered !== activeCard) activeCard = hovered;
            if (activeCard) {
                const rect = activeCard.getBoundingClientRect();
                activeCard.style.setProperty('--mouse-x', `${lastX - rect.left}px`);
                activeCard.style.setProperty('--mouse-y', `${lastY - rect.top}px`);
            }
        });
    }, { passive: true });
}

// =====================================================================
//  INTEGRATED INTERACTIVE REPORT VIEWER
// =====================================================================

function resizeReportIframe(iframe) {
    if (!iframe || !iframe.contentWindow) return;
    try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const height = Math.max(
            doc.body?.scrollHeight || 0,
            doc.documentElement?.scrollHeight || 0
        );
        iframe.style.height = Math.max(height + 32, 420) + 'px';
    } catch (err) {
        iframe.style.height = '1400px';
    }
}

window.addEventListener('message', (event) => {
    if (event.data !== 'report-resize') return;
    const iframe = document.getElementById('viewer-iframe') || document.getElementById('report-iframe');
    if (iframe) resizeReportIframe(iframe);
});

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
    const printBtn = document.getElementById('viewer-print-btn');
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
    if (printBtn) {
        printBtn.style.display = 'inline-flex';
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
        resizeReportIframe(iframe);
        setTimeout(() => resizeReportIframe(iframe), 350);
    };
}

function closeReportViewer() {
    const iframe = document.getElementById('viewer-iframe');
    const placeholder = document.getElementById('viewer-placeholder');
    const titleText = document.getElementById('viewer-report-title');
    const statusDot = document.getElementById('viewer-status-dot');
    const openLink = document.getElementById('viewer-open-link');
    const closeBtn = document.getElementById('viewer-close-btn');
    const printBtn = document.getElementById('viewer-print-btn');

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
    if (printBtn) printBtn.style.display = 'none';
}

function printActiveReport() {
    const iframe = document.getElementById('viewer-iframe');
    if (!iframe || !iframe.contentWindow) return;

    const runPrint = () => {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (err) {
            console.error("No se pudo iniciar la impresión del iframe:", err);
            const newWindow = window.open(iframe.src, '_blank');
            if (newWindow) {
                newWindow.onload = () => newWindow.print();
            }
        }
    };

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (iframe.contentWindow.__BOS_REPORT_READY__) {
        runPrint();
        return;
    }

    const onReady = () => {
        iframe.contentWindow.removeEventListener('bos-report-ready', onReady);
        runPrint();
    };

    iframe.contentWindow.addEventListener('bos-report-ready', onReady);

    // Fallback if the report script already ran before we attached the listener
    setTimeout(() => {
        if (iframe.contentWindow.__BOS_REPORT_READY__) {
            iframe.contentWindow.removeEventListener('bos-report-ready', onReady);
            runPrint();
        }
    }, 1200);
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

window.toggleTheme = function (event) {
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
            const line = getChartForecastLine();
            renderTimeSeriesChart(dashboardData.forecast, {
                canvasId: 'chart-timeseries',
                chartKey: 'timeseries',
                lineLabel: line.label,
                lineColor: line.color,
                forecastValue: line.value,
                overlays: getActiveOverlays()
            });
            if (dashboardData.investment && dashboardData.investment.campaigns) {
                renderCampaignChart(dashboardData.investment.campaigns);
            }
            if (dashboardData.operations) {
                renderOperationsTab(dashboardData);
            }
        }
    }, 300);

    // Clean up transition circle after completion
    setTimeout(() => {
        ripple.remove();
    }, 700);
};

window.triggerSync = async function (event) {
    const icon = document.getElementById('sync-icon-svg');
    const sbarText = document.getElementById('main-sbar-text');
    if (icon) {
        icon.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            icon.style.transition = 'none';
            icon.style.transform = 'rotate(0deg)';
            void icon.offsetWidth; // Force reflow
            icon.style.transition = 'transform 1s ease';
        }, 1000);
    }

    if (sbarText) {
        sbarText.innerHTML = "Sincronizando datos con n8n al instante...";
    }

    // Call loadBOS to fetch the latest dynamic data from the server
    await loadBOS();

    // Reload report viewer iframe if it is currently open
    const iframe = document.getElementById('viewer-iframe');
    if (iframe && iframe.style.display !== 'none' && iframe.src) {
        iframe.src = iframe.src.split('?')[0] + '?_=' + Date.now();
    }
};

// =====================================================================
//  APPLICATION INITIALIZATION
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {
    initPerformanceMode();

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
    console.log('⚡ PulseMkt Dashboard logic active');
});
