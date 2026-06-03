/* =====================================================================
   💎 Solis BOS - Frontend Application Logic
   Premium Interactive Dashboard with Dynamic Counter Animations
   ===================================================================== */

let dashboardData = null;
let charts = {};
let currentTab = 'dashboard';
let currentAlertFilter = 'all';
let timeSeriesType = 'line';
let dailyVolumeType = 'bar';
let selectedCompareModel = '';
let showAllModels = false;

// =====================================================================
//  📘 INDUSTRY TERMS — English term + Spanish gloss in parentheses
// =====================================================================

/** Backend KPI label → display label (término en inglés + descripción en español). */
const KPI_BACKEND_LABEL_MAP = {
    'Health Score': 'SHS (salud operativa consolidada)',
    'Leads totales': 'Total Leads (volumen total del periodo)',
    'Promedio diario': 'Daily Avg (promedio diario de leads)',
    'Cambio semanal': 'WoW (cambio vs semana anterior)',
    'Hora pico': 'Peak Hour (hora pico de contactos)',
    'Prevision diaria': 'Daily Forecast (pronóstico diario de demanda)',
    'MASE': 'MASE (error medio absoluto escalado)',
    'CPL implicito': 'CPL (costo por lead implícito)',
    'Gasto total': 'Ad Spend (gasto total en pauta)',
    'HHI': 'HHI (concentración del gasto en campañas)',
    'Conversion global': 'Global CVR (tasa de conversión entrada a cierre)',
    'Revenue at Risk': 'Revenue at Risk (ingreso en riesgo por fugas)',
    'Utilizacion capacidad': 'Capacity Utilization (uso de capacidad operativa)',
    'Cambio regimen': 'Regime Shift (cambio estructural de demanda)',
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
    const backendKey = Object.keys(KPI_BACKEND_LABEL_MAP).find(
        (k) => KPI_BACKEND_LABEL_MAP[k] === label
    );
    if (backendKey && KPI_EXPLANATIONS[backendKey]) return backendKey;
    const alias = KPI_EXPLANATION_ALIASES[label];
    if (alias && KPI_EXPLANATIONS[alias]) return alias;
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
    'Ingresos en Riesgo Estimados': 'Revenue at Risk',
    'Revenue at Risk (ingreso en riesgo)': 'Revenue at Risk',
    'Severidad Máxima': 'RPN max',
};

const KPI_EXPLANATIONS = {
    'Health Score': {
        icon: '💓',
        definition: 'SHS: indicador compuesto de 0 a 100 que resume el estado general de toda la operación comercial. Combina eficiencia del call center, calidad de contacto, velocidad de respuesta y balance de inversión publicitaria.',
        interpretation: 'Un valor de 80+ indica un sistema saludable. Entre 60-79, el sistema está bajo presión y requiere atención en áreas específicas. Por debajo de 60 indica estado crítico con problemas que afectan directamente los ingresos.',
        source: 'Calculado por el Motor BOS — combina métricas de operaciones, embudo y finanzas'
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
        source: 'forecast.recommended_value — modelo recomendado por backtest'
    },
    'MASE': {
        icon: '🎯',
        definition: 'MASE (error medio absoluto escalado): mide el error promedio del pronóstico ajustado por una línea base estacional. Si el valor es menor a 1.0, el modelo predice mejor que repetir el dato de la semana pasada.',
        interpretation: 'Referencia del área: < 0.75 excelente; 0.75–1.0 aceptable; ≥ 1.0 no supera la línea base (usar con cautela).',
        source: 'Backtest rolling — forecast.diagnostics.best_mase'
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
        definition: 'Global CVR: porcentaje de leads que avanzan a la etapa clave del embudo (p. ej. consulta reservada) vs total de entradas.',
        interpretation: '> 5% suele ser fuerte en este sector; < 3.5% sugiere fuga temprana o leads no calificados por creativo/audiencia.',
        source: 'funnel.global_conversion_pct'
    },
    'Revenue at Risk': {
        icon: '💸',
        definition: 'Revenue at Risk: valoración del opportunity cost de leads perdidos en el funnel, con case value assumption (p. ej. $1,200 USD).',
        interpretation: 'Proxy del costo de ineficiencia operativa. Reducirlo vía mejor speed-to-lead y menos over-dialing mejora revenue sin subir ad spend.',
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
        definition: 'El porcentaje total de leads o prospectos que logran reservar una consulta o avanzar exitosamente a la fase clave del embudo, medido contra el total de leads entrantes en el sistema.',
        interpretation: 'Una tasa superior al 5% es excelente para este sector. Por debajo de 3.5% sugiere una fuga importante de prospectos en el primer contacto o que la publicidad atrae leads no calificados.',
        source: 'Cálculo: (Consultas reservadas ÷ Leads totales) × 100 — Motor BOS desde n8n'
    },
    'Ingresos en Riesgo Estimados': {
        icon: '💸',
        definition: 'Valoración financiera del costo de oportunidad que representan los leads perdidos (no interesados, sin respuesta, cortadas o números incorrectos) asumiendo un valor promedio de caso de $1,200 USD.',
        interpretation: 'Representa el impacto de la ineficiencia del call center. Reducir esta cifra optimizando las llamadas incrementa de manera directa los ingresos facturados sin aumentar el presupuesto.',
        source: 'Cálculo: Leads perdidos × Valor de caso promedio ($1,200) — Motor BOS'
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
        source: 'Algoritmo estadístico CUSUM (Suma Acumulada) integrado en el motor de predicción BOS'
    }
};

function openKpiModal(label, value) {
    const explainKey = resolveKpiExplanationKey(label);
    const explain = explainKey ? KPI_EXPLANATIONS[explainKey] : null;
    if (!explain) return;

    document.getElementById('kpi-modal-title').textContent = label;
    document.getElementById('kpi-modal-value').textContent = value;
    document.getElementById('kpi-modal-definition').textContent = explain.definition;
    document.getElementById('kpi-modal-interpretation').textContent = explain.interpretation;
    document.getElementById('kpi-modal-source-text').textContent = explain.source;

    document.getElementById('kpi-modal-overlay').classList.add('open');
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

function cleanTechnicalTerms(str) {
    if (!str || typeof str !== 'string') return str;
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
    text = text.replace(/FactsBuilder/gi, 'Motor BOS');
    text = text.replace(/baseline/gi, 'Línea Base');
    text = text.replace(/CPL implicito/gi, 'Costo por Lead');

    // Standardize CUSUM changepoint labels to elegant corporate terminology
    text = text.replace(/Cambio regimen/gi, 'Cambio de Régimen');

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
                renderTimeSeriesChart(dashboardData.forecast, {
                    canvasId: 'chart-timeseries',
                    chartKey: 'timeseries',
                    lineLabel: 'Pronóstico Recomendado',
                    overlays: getActiveOverlays()
                });
                if (dashboardData.forecast.seasonal_indices) {
                    renderSeasonalChart(dashboardData.forecast.seasonal_indices);
                }
            } else {
                if (charts.timeseries) { charts.timeseries.reset(); charts.timeseries.update(); }
                if (charts.seasonal) { charts.seasonal.reset(); charts.seasonal.update(); }
            }
        } else if (tabId === 'investment') {
            if (typeof dashboardData !== 'undefined' && dashboardData && dashboardData.investment && dashboardData.investment.campaigns) {
                renderCampaignChart(dashboardData.investment.campaigns);
            }
        } else if (tabId === 'operations') {
            if (typeof dashboardData !== 'undefined' && dashboardData && dashboardData.operations) {
                renderOperationsTab(dashboardData);
            }
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
        let label = formatKpiLabel(k.label);
        let sub = applyIndustryInlineTerms(k.sub || '');

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
                bestModelName = 'Random Forest';
                bestConfidence = data.forecast_rf.confidence || 'Alta';
            } else if (data.forecast && data.forecast.recommended_value != null) {
                bestModelVal = data.forecast.recommended_value;
                bestModelName = data.forecast.method || 'Theta Lite';
                bestConfidence = data.forecast.confidence || 'Alta';
            }

            let formattedName = bestModelName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            k.value = `~${bestModelVal}`;
            sub = `${formattedName} | ${bestConfidence.replace(/\b\w/g, c => c.toUpperCase())}`;
        }
        if (k.label === 'MASE') {
            let bestModelName = 'Random Forest';
            let bestMase = 0.2724;
            if (data.forecast_rf && data.forecast_rf.mase != null) {
                bestMase = data.forecast_rf.mase;
                bestModelName = 'Random Forest';
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
            k.value = Number(bestMase).toFixed(2);
            sub = applyIndustryInlineTerms(formattedName);
            k.color = 'white';
        }
        if (k.label === 'CPL implicito') {
            sub = sub || 'global';
            k.color = 'blue';
        }
        if (k.label === 'Cambio regimen' || k.label === 'Cambio de Régimen') {
            k.color = 'blue';
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
                color: 'blue'
            });
        }
        if (data.operations.max_daily) {
            cleanedKpis.push({
                value: String(data.operations.max_daily),
                label: 'Máximo Diario',
                sub: 'Pico histórico del periodo',
                color: 'white'
            });
        }
        if (data.operations.contact_distribution && data.operations.contact_distribution.overcontact_pct != null) {
            cleanedKpis.push({
                value: data.operations.contact_distribution.overcontact_pct + '%',
                label: 'Tasa de Sobre-Contacto',
                sub: 'Llamadas > 7 intentos',
                color: 'red'
            });
        }
        if (data.operations.call_metrics && data.operations.call_metrics.call_rank) {
            cleanedKpis.push({
                value: String(data.operations.call_metrics.call_rank.avg),
                label: 'Promedio Intentos',
                sub: 'Marcaciones por lead (umbral: 7)',
                color: 'red'
            });
        }
    }

    const healthScore = Math.min(100, Math.max(0, Number(data.system.health_score) || 0));
    const liquidTone = healthScore >= 80 ? 'good' : healthScore >= 60 ? 'warn' : 'critical';

    kpisGrid.innerHTML = cleanedKpis.map((kpi, idx) => {
        const isHealth = idx === 0;
        const escapedLabel = kpi.label.replace(/'/g, "\\'");
        const escapedValue = String(kpi.value).replace(/'/g, "\\'");
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
                        <div class="card-stat-label">${kpi.label}</div>
                        <div class="card-stat-value" id="kpi-val-${idx}" data-value="${kpi.value}">0</div>
                        <div class="card-stat-sub">${kpi.sub || '&nbsp;'}</div>
                    </div>
                </div>
            `;
        }
        return `
            <div class="card stat-card-${kpi.color || 'blue'} card-animate" style="animation-delay: ${idx * 0.025}s;"
                onclick="openKpiModal('${escapedLabel}', '${escapedValue}')">
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

    // 7. Render Forecast Page (incluye comparador de modelos)
    renderForecastDetails(data.forecast || {}, {
        prefix: '',
        show14d: true,
        showChangepoint: true,
    });
    populateModelCompareDropdown(data);
    updateHorizonComparison();

    // 8. Render Interactive Alerts Centre Tab
    renderAlertsCentre(data.system.alerts);

    // 9. Initialize and render high-impact Charts
    renderTimeSeriesChart(data.forecast || {}, {
        canvasId: 'chart-timeseries',
        chartKey: 'timeseries',
        lineLabel: 'Pronóstico Recomendado',
        overlays: getActiveOverlays()
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
            <div class="card stat-card-blue card-animate" style="animation-delay: 0.03s;"
                onclick="openKpiModal('Pronóstico Mañana', '${h1d.forecast ?? 0}')">
                <div class="card-stat-label">Pronóstico Mañana</div>
                <div class="card-stat-value" id="${prefix}forecast-1d-val" data-value="${h1d.forecast ?? 0}">0</div>
                <div class="card-stat-sub">Rango: ${h1d.band_low ?? 0} a ${h1d.band_high ?? 0} leads</div>
                <div class="card-stat-compare" id="${prefix}forecast-1d-compare"></div>
            </div>
            <div class="card stat-card-gold card-animate" style="animation-delay: 0.06s;"
                onclick="openKpiModal('Pronóstico 7 Días', '${h7d.forecast ?? 0}')">
                <div class="card-stat-label">Pronóstico 7 Días</div>
                <div class="card-stat-value" id="${prefix}forecast-7d-val" data-value="${h7d.forecast ?? 0}">0</div>
                <div class="card-stat-sub">Rango: ${h7d.band_low ?? 0} a ${h7d.band_high ?? 0} leads</div>
                <div class="card-stat-compare" id="${prefix}forecast-7d-compare"></div>
            </div>`;

        if (show14d && horizons.next_14d) {
            cardsHtml += `
            <div class="card stat-card-green card-animate" style="animation-delay: 0.09s;"
                onclick="openKpiModal('Pronóstico 14 Días', '${h14d.forecast ?? 0}')">
                <div class="card-stat-label">Pronóstico 14 Días</div>
                <div class="card-stat-value" id="${prefix}forecast-14d-val" data-value="${h14d.forecast ?? 0}">0</div>
                <div class="card-stat-sub">Rango: ${h14d.band_low ?? 0} a ${h14d.band_high ?? 0} leads</div>
                <div class="card-stat-compare" id="${prefix}forecast-14d-compare"></div>
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
        const models = forecast.backtest_models.slice();

        // Incluir Random Forest (desde forecast_rf) en la clasificación
        if (typeof dashboardData !== 'undefined' && dashboardData && dashboardData.forecast_rf && dashboardData.forecast_rf.available !== false) {
            const rf = dashboardData.forecast_rf;
            const rfName = rf.model_name || 'random_forest';
            let rfEntry = Array.isArray(rf.backtest_models) ? rf.backtest_models.find(x => x.name === rfName) : null;
            if (!rfEntry && rf.mase != null) rfEntry = { name: rfName, mase: rf.mase };
            if (rfEntry && rfEntry.mase != null && !models.some(m => m.name === rfEntry.name)) {
                models.push(rfEntry);
            }
        }

        // Ordenar por MASE ascendente (mejor desempeño primero)
        models.sort((a, b) => (a.mase != null ? a.mase : Infinity) - (b.mase != null ? b.mase : Infinity));

        modelsBody.innerHTML = models.map(m => {
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

// =====================================================================
//  COMPARADOR DE MODELOS (lista desplegable + overlay)
// =====================================================================

// Color consistente por modelo (mapa fijo para los conocidos + hash determinístico).
const MODEL_COLORS = {
    theta_lite: '#38bdf8',
    holt_winters: '#f472b6',
    trend_season: '#f59e0b',
    seasonal_naive: '#a78bfa',
    fourier_regression: '#34d399',
    mean_7d: '#fb7185',
    ewma: '#facc15',
    random_forest: '#10b981',
};

function getModelColor(name) {
    if (!name) return '#f472b6';
    if (MODEL_COLORS[name]) return MODEL_COLORS[name];
    let h = 0;
    for (const c of String(name)) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
    return `hsl(${h % 360}, 70%, 62%)`;
}

// Construye la lista de modelos comparables: los del backtest estadistico
// mas el Random Forest (desde forecast_rf), cada uno con su serie diaria si existe.
function buildComparableModels(data) {
    const list = [];
    const f = (data && data.forecast) ? data.forecast : {};
    (f.backtest_models || []).forEach(m => {
        list.push({ name: m.name, mase: m.mase, mae: m.mae, rmse: m.rmse, series: m.series });
    });

    const rf = data ? data.forecast_rf : null;
    if (rf && rf.available !== false) {
        const rfName = rf.model_name || 'random_forest';
        if (!list.some(m => m.name === rfName)) {
            let series = Array.isArray(rf.series) ? rf.series : null;
            if (!series && Array.isArray(rf.backtest_models)) {
                const e = rf.backtest_models.find(x => x.name === rfName);
                if (e && Array.isArray(e.series)) series = e.series;
            }
            // Serie real de predicciones del backtest (predicho por día), alineada
            // por fecha a la serie histórica que define el eje X de la gráfica.
            if (!series) series = buildRfAlignedSeries(data);
            list.push({ name: rfName, mase: rf.mase, series: series });
        }
    }
    return list;
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
        label: cleanTechnicalTerms(m.name.replace(/_/g, ' ').toUpperCase()),
        series: m.series,
        color: getModelColor(m.name)
    };
}

// Devuelve los overlays activos: todos los modelos, uno solo, o ninguno.
function getActiveOverlays() {
    if (!dashboardData) return [];
    const baseName = (dashboardData.forecast && dashboardData.forecast.method) ? dashboardData.forecast.method : null;
    const models = buildComparableModels(dashboardData)
        .filter(m => m.name !== baseName && Array.isArray(m.series) && m.series.length);

    if (showAllModels) return models.map(overlayForModel);
    if (selectedCompareModel) {
        const m = models.find(x => x.name === selectedCompareModel);
        if (m) return [overlayForModel(m)];
    }
    return [];
}

// Vuelve a dibujar la gráfica base del tab forecast con los overlays activos.
function renderForecastBaseChart() {
    if (!dashboardData || !dashboardData.forecast) return;
    renderTimeSeriesChart(dashboardData.forecast, {
        canvasId: 'chart-timeseries',
        chartKey: 'timeseries',
        lineLabel: 'Pronóstico Recomendado',
        overlays: getActiveOverlays()
    });
}

// Botón "Mostrar todas": sobrepone todas las curvas de modelos a la vez.
function showAllModelOverlays() {
    showAllModels = true;
    selectedCompareModel = '';
    const sel = document.getElementById('model-compare-select');
    if (sel) { sel.value = ''; sel.style.borderColor = ''; sel.style.color = ''; }
    const meta = document.getElementById('model-compare-meta');
    if (meta) { meta.textContent = 'Mostrando todos los modelos'; meta.style.color = ''; }
    renderForecastBaseChart();
    updateHorizonComparison();
}

// Botón "Limpiar": regresa a la gráfica original (solo modelo base).
function clearModelOverlays() {
    showAllModels = false;
    selectedCompareModel = '';
    const sel = document.getElementById('model-compare-select');
    if (sel) { sel.value = ''; sel.style.borderColor = ''; sel.style.color = ''; }
    const meta = document.getElementById('model-compare-meta');
    if (meta) { meta.textContent = ''; meta.style.color = ''; }
    renderForecastBaseChart();
    updateHorizonComparison();
}

// Llena el desplegable con los modelos comparables, excluyendo el modelo base/actual.
function populateModelCompareDropdown(data) {
    const sel = document.getElementById('model-compare-select');
    if (!sel) return;
    const baseName = (data && data.forecast && data.forecast.method) ? data.forecast.method : null;
    const models = buildComparableModels(data).filter(m => m.name !== baseName);

    let html = '<option value="">Ninguno (solo modelo actual)</option>';
    models.forEach(m => {
        const hasSeries = Array.isArray(m.series) && m.series.length;
        const label = cleanTechnicalTerms(m.name.replace(/_/g, ' ').toUpperCase());
        const color = getModelColor(m.name);
        html += `<option value="${m.name}" style="color:${color}"${hasSeries ? '' : ' disabled'}>${label}${hasSeries ? '' : ' (sin serie)'}</option>`;
    });
    sel.innerHTML = html;
    selectedCompareModel = '';
    sel.style.borderColor = '';
    sel.style.color = '';
    const meta = document.getElementById('model-compare-meta');
    if (meta) { meta.textContent = ''; meta.style.color = ''; }
}

// Devuelve los horizontes (next_1d/7d/14d) del modelo indicado, si existen.
function getModelHorizons(name) {
    if (!name || !dashboardData) return null;
    const rf = dashboardData.forecast_rf;
    const rfName = rf ? (rf.model_name || 'random_forest') : null;
    if (rf && rf.available !== false && name === rfName && rf.horizons) return rf.horizons;
    const f = dashboardData.forecast || {};
    const m = (f.backtest_models || []).find(x => x.name === name);
    if (m && m.horizons) return m.horizons;
    return null;
}

// Actualiza las tarjetas de "Pronóstico de Demanda a Mediano Plazo" con los datos
// del modelo seleccionado para comparar (valor + variación vs modelo base).
function updateHorizonComparison() {
    // Las tarjetas de pronóstico muestran únicamente el modelo base/original.
    // La comparación por tarjeta (p. ej. "RANDOM FOREST: 80 ▼ 69.7%") quedó
    // deshabilitada a pedido; la comparación de modelos sigue disponible en la gráfica.
    ['forecast-1d-compare', 'forecast-7d-compare', 'forecast-14d-compare'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
}

// Handler del cambio en el desplegable: sobrepone (o quita) la curva del modelo elegido.
function onModelCompareChange() {
    const sel = document.getElementById('model-compare-select');
    if (!sel) return;
    selectedCompareModel = sel.value || '';
    showAllModels = false;

    const color = selectedCompareModel ? getModelColor(selectedCompareModel) : '';
    sel.style.borderColor = color;
    sel.style.color = color;

    const meta = document.getElementById('model-compare-meta');
    if (meta) {
        const m = buildComparableModels(dashboardData).find(x => x.name === selectedCompareModel);
        meta.textContent = (m && typeof m.mase === 'number') ? `MASE (comparado): ${m.mase.toFixed(3)}` : '';
        meta.style.color = color;
    }

    renderForecastBaseChart();
    updateHorizonComparison();
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

    const datasets = [
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
    ];

    // Overlays: una o varias curvas de modelos para comparar
    const overlays = Array.isArray(options.overlays)
        ? options.overlays
        : (options.overlay ? [options.overlay] : []);
    overlays.forEach(ov => {
        if (!ov || !Array.isArray(ov.series) || !ov.series.length) return;
        datasets.push({
            type: 'line',
            label: ov.label || 'Modelo comparado',
            data: ov.series,
            borderColor: ov.color || (isLight ? '#db2777' : '#f472b6'),
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 6,
            fill: false
        });
    });

    charts[chartKey] = new Chart(ctx, {
        type: chartType,
        data: {
            labels,
            datasets
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
    timeSeriesType = type;
    document.querySelectorAll('.chart-toolbar [data-ts-type]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tsType === type);
    });
    if (dashboardData && dashboardData.forecast) {
        renderTimeSeriesChart(dashboardData.forecast, {
            canvasId: 'chart-timeseries',
            chartKey: 'timeseries',
            lineLabel: 'Pronóstico Recomendado',
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
                hoverBackgroundColor: hourly.map((h, i) => {
                    const val = h.probability !== undefined ? (h.probability * 100) : (h.count || h.calls || h.total || 0);
                    const max = Math.max(...hourly.map(x => x.probability !== undefined ? (x.probability * 100) : (x.count || x.calls || x.total || 0)));
                    if (val === max) {
                        return isLight ? 'rgba(225, 29, 72, 0.95)' : 'rgba(244, 63, 94, 0.95)';
                    } else {
                        return isLight ? 'rgba(132, 204, 22, 0.75)' : 'rgba(163, 230, 53, 0.65)';
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
            animation: {
                duration: 700,
                easing: 'easeOutQuart',
                delay: (context) => {
                    let delay = 0;
                    if (context.type === 'data' && context.mode === 'default' && !context.active) {
                        delay = context.dataIndex * 8;
                    }
                    return delay;
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                intersect: true
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

function renderOperationsTab(data) {
    if (!data || !data.operations) return;
    const ops = data.operations;
    const call = ops.call_metrics || {};
    const dist = ops.contact_distribution || {};

    // 1. Populate KPI Cards
    const kpiCardsEl = document.getElementById('operations-kpi-cards');
    if (kpiCardsEl) {
        const totalRecords = call.total_records || 0;
        const uniqueContacts = call.unique_contacts || 0;
        const attemptsAvg = call.call_rank ? call.call_rank.avg : 0;
        const intervalAvg = call.minutes_since_prev ? call.minutes_since_prev.avg : 0;

        const kpis = [
            {
                label: 'Registros',
                value: totalRecords.toLocaleString(),
                sub: 'llamadas totales',
                color: 'blue'
            },
            {
                label: 'Contactos',
                value: uniqueContacts.toLocaleString(),
                sub: 'leads únicos',
                color: 'blue'
            },
            {
                label: 'Avg Dial Attempts (intentos promedio)',
                value: attemptsAvg.toFixed(2),
                sub: `rango: 1-${call.call_rank ? call.call_rank.max : 365}`,
                color: attemptsAvg > 7 ? 'red' : 'blue'
            },
            {
                label: 'Avg Callback Interval (min entre intentos)',
                value: `${Math.round(intervalAvg).toLocaleString()} min`,
                sub: `~${Math.round(intervalAvg / 60)}h entre marcaciones`,
                color: intervalAvg > 1440 ? 'red' : 'blue'
            }
        ];

        kpiCardsEl.innerHTML = kpis.map((kpi, idx) => {
            const escapedLabel = kpi.label.replace(/'/g, "\\'");
            const escapedValue = String(kpi.value).replace(/'/g, "\\'");
            return `
                <div class="card stat-card-${kpi.color} card-animate" style="animation-delay: ${idx * 0.025}s;"
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
    renderDailyVolumeChart(ops);

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
    renderHourlyChart(ops.hourly_distribution);
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
    if (iframe && iframe.contentWindow) {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (err) {
            console.error("No se pudo iniciar la impresión del iframe:", err);
            // Fallback: abrir en pestaña nueva e iniciar impresión
            const newWindow = window.open(iframe.src, '_blank');
            if (newWindow) {
                newWindow.onload = () => {
                    newWindow.print();
                };
            }
        }
    }
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
            renderTimeSeriesChart(dashboardData.forecast, {
                canvasId: 'chart-timeseries',
                chartKey: 'timeseries',
                lineLabel: 'Pronóstico Recomendado',
                overlays: getActiveOverlays()
            });
            if (dashboardData.forecast && dashboardData.forecast.seasonal_indices) {
                renderSeasonalChart(dashboardData.forecast.seasonal_indices);
            }
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
