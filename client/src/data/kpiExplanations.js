/** KPI explanations dictionary — migrated from app.js and expanded for bilingual metrics */
export const KPI_EXPLANATIONS = {
  'Health Score': {
    icon: '💓',
    definition: 'SHS (System Health Score): indicador compuesto de 0 a 100 que resume el estado general de toda la operación comercial. Combina eficiencia del call center, calidad del contacto, velocidad de respuesta y balance de inversión publicitaria.',
    interpretation: 'Un valor de 80+ indica un sistema saludable. Entre 60-79, el sistema está bajo presión y requiere atención. Por debajo de 60 indica estado crítico con problemas que afectan directamente los ingresos.',
    source: 'Calculado por el Motor BOS — combina métricas de operaciones, embudo y finanzas',
  },
  'Leads totales': {
    icon: '👥',
    definition: 'La cantidad total de prospectos (leads) que han ingresado al sistema durante el periodo analizado.',
    interpretation: 'Volumen alto sin agentes = saturación; volumen bajo = problemas con la pauta publicitaria.',
    source: 'Conteo directo del CRM integrado vía n8n',
  },
  'Promedio diario': {
    icon: '📊',
    definition: 'El número promedio de leads nuevos que ingresan al sistema cada día.',
    interpretation: 'Sirve para planear la capacidad operativa del equipo y los turnos de los agentes.',
    source: 'Cálculo: total_leads ÷ total_days',
  },
  'Hora pico': {
    icon: '⏰',
    definition: 'La hora del día en que se recibe el mayor volumen de contactos telefónicos y leads.',
    interpretation: 'El equipo debe estar a su máxima capacidad durante esta hora para garantizar un speed-to-lead inmediato.',
    source: 'Análisis de distribución horaria del CRM',
  },
  'Prevision diaria': {
    icon: '🔮',
    definition: 'Daily Forecast: predicción del modelo recomendado sobre cuántos leads se recibirán mañana.',
    interpretation: 'Útil para staffing del call center al día siguiente y prevenir colas de atención.',
    source: 'forecast.recommended_value — modelo recomendado por backtest',
  },
  'MASE': {
    icon: '🎯',
    definition: 'MASE (Mean Absolute Scaled Error): mide el error promedio del pronóstico ajustado por estacionalidad.',
    interpretation: '< 0.75 excelente; 0.75–1.0 aceptable; ≥ 1.0 no supera la línea base (usar con cautela).',
    source: 'Backtest rolling — forecast.diagnostics.best_mase',
  },
  'CPL implicito': {
    icon: '💰',
    definition: 'CPL (Cost Per Lead): costo implícito promedio por prospecto. Se calcula dividiendo el gasto total entre los leads totales.',
    interpretation: 'A menor CPL, mejor. Comparar contra el ingreso promedio por caso cerrado para evaluar la rentabilidad.',
    source: 'investment.cpl.global_cpl',
  },
  'Gasto total': {
    icon: '📢',
    definition: 'Ad Spend: monto total invertido en paid media (Facebook, Google Ads, etc.) durante el periodo.',
    interpretation: 'Spend alto sin leads proporcionales sugiere fatiga de creativos o audiencias.',
    source: 'investment.total_spend',
  },
  'HHI': {
    icon: '🎲',
    definition: 'HHI (Herfindahl-Hirschman Index): mide la concentración del gasto en las campañas de marketing. Cerca de 0 = diversificado; cerca de 1 = alta dependencia de una sola campaña.',
    interpretation: '< 0.15 diversificado; 0.15–0.25 moderado; > 0.25 riesgo de concentración.',
    source: 'investment.mmm.hhi_index',
  },
  'Conversion global': {
    icon: '🎯',
    definition: 'Global CVR (Conversion Rate): porcentaje de leads que avanzan a la etapa clave del embudo vs total de entradas.',
    interpretation: '> 5% es fuerte en este sector; < 3.5% sugiere fuga temprana o leads no calificados.',
    source: 'funnel.global_conversion_pct',
  },
  'Revenue at Risk': {
    icon: '💸',
    definition: 'Revenue at Risk: valoración del costo de oportunidad de leads perdidos en el embudo, asumiendo ~$1,200 USD por caso.',
    interpretation: 'Reducirlo vía mejor speed-to-lead y menor tasa de abandono mejora los ingresos directos.',
    source: 'funnel.total_revenue_at_risk',
  },
  'Cambio semanal': {
    icon: '📈',
    definition: 'WoW (Week over Week): cambio porcentual del volumen de leads versus la semana anterior.',
    interpretation: 'Caídas > 10% = fatiga de creativos o cambio de mercado. Subidas > 15% = requiere más agentes.',
    source: 'operations.wow_change_pct',
  },
  'Pronóstico Mañana': {
    icon: '🔮',
    definition: 'La proyección puntual de leads esperados para el día de mañana.',
    interpretation: 'Si supera el promedio histórico, se debe reforzar el staff de agentes.',
    source: 'Forecast API — theta_lite / Random Forest',
  },
  'Pronóstico 7 Días': {
    icon: '📅',
    definition: 'Volumen acumulado de leads proyectados para los próximos 7 días.',
    interpretation: 'Permite programar agendas operativas y dimensionar la carga semanal.',
    source: 'Sumatoria de proyecciones a 7 días',
  },
  'Pronóstico 14 Días': {
    icon: '📆',
    definition: 'Volumen acumulado de leads proyectados para las próximas dos semanas.',
    interpretation: 'Sirve para planificar compras de pauta y flujo de caja quincenal.',
    source: 'Proyección temporal a mediano plazo (14 días)',
  },
  'Cambio de Régimen': {
    icon: '📉',
    definition: 'Cambio estructural significativo en el volumen diario, detectado mediante CUSUM.',
    interpretation: 'Un valor negativo = reducción persistente de volumen. Valor positivo = incremento sostenido.',
    source: 'Algoritmo CUSUM integrado en el motor de predicción BOS',
  },
  'Leads Hoy': {
    icon: '📈',
    definition: 'El volumen de prospectos registrados en el día actual más reciente.',
    interpretation: 'Muestra el tráfico entrante inmediato en tiempo real.',
    source: 'Carga en tiempo real desde el CRM',
  },
  'Máximo Diario': {
    icon: '🏆',
    definition: 'El número máximo de leads recibidos en un solo día durante este periodo.',
    interpretation: 'Representa la capacidad pico histórica a la que se ha visto sometida la operación.',
    source: 'Valor máximo de la serie temporal del CRM',
  },
  'Tasa de Sobre-Contacto': {
    icon: '📞',
    definition: 'Porcentaje de prospectos con llamadas que superan el umbral óptimo de marcaciones (7 intentos).',
    interpretation: 'Una tasa alta indica desgaste innecesario de leads y baja eficiencia operativa de agentes.',
    source: 'Distribución de contactos del CRM',
  },
  'Promedio Intentos': {
    icon: '⚡',
    definition: 'El promedio general de intentos de llamadas telefónicas por lead.',
    interpretation: 'Valores mayores a 7 sugieren sobre-contacto y saturación de la base de datos.',
    source: 'Métricas operativas del CRM',
  },
  'Registros de Llamadas': {
    icon: '📞',
    definition: 'Total Records: cantidad total de llamadas telefónicas brutas registradas en el CRM durante el periodo analizado.',
    interpretation: 'Mide la carga de trabajo bruta. Útil para dimensionar el esfuerzo bruto y el volumen de marcaciones diarias.',
    source: 'CRM integrado vía n8n',
  },
  'Contactos Únicos': {
    icon: '👤',
    definition: 'Unique Leads: número de prospectos únicos que recibieron llamadas o gestiones.',
    interpretation: 'Diferencia el esfuerzo bruto del alcance real. Un ratio llamadas/contactos alto indica alta insistencia telefónica.',
    source: 'CRM integrado vía n8n',
  },
  'Intervalo entre Intentos': {
    icon: '⏱️',
    definition: 'Avg Callback Interval: el tiempo promedio transcurrido entre intentos consecutivos de llamada a un mismo lead.',
    interpretation: 'Intervalos muy largos (miles de minutos) indican un seguimiento lento, lo cual reduce drásticamente la probabilidad de conversión.',
    source: 'Diferencia de tiempo entre llamadas en el CRM',
  },
  'Inversión Total Ejecutada': {
    icon: '💰',
    definition: 'Total Ad Spend: el gasto total invertido en pauta publicitaria de marketing digital en el periodo.',
    interpretation: 'Debe compararse con el volumen de leads y el CVR para evaluar el retorno de inversión y el costo de adquisición.',
    source: 'Reportes de pauta publicitaria integrados',
  },
  'Campañas Activas Modeladas': {
    icon: '🎯',
    definition: 'Active Campaigns: número de campañas publicitarias activas monitoreadas.',
    interpretation: 'Refleja la diversificación y segmentación de los esfuerzos de marketing digital.',
    source: 'Bases de datos de pauta y atribución',
  },
  'Alertas Totales': {
    icon: '🔔',
    definition: 'Total Alerts: cantidad total de anomalías o desviaciones operativas detectadas en tiempo real.',
    interpretation: 'Un volumen creciente indica inestabilidad o desvíos severos de los procesos estándar.',
    source: 'Motor de alertas del BOS',
  },
  'Alertas Críticas': {
    icon: '🚨',
    definition: 'Critical Alerts: incidentes graves de alta prioridad que requieren intervención inmediata.',
    interpretation: 'Deben resolverse primero para evitar pérdidas financieras o degradación operativa severa.',
    source: 'Clasificación de severidad del motor de alertas',
  },
  'Severidad Máxima': {
    icon: '🔺',
    definition: 'Max Severity: la puntuación RPN (Risk Priority Number) más alta registrada en las alertas activas.',
    interpretation: 'Puntuaciones RPN > 400 indican fallas críticas en el sistema o cuellos de botella severos.',
    source: 'Cálculo RPN (Severidad x Ocurrencia x Detección)',
  },
  'Advertencias e Info': {
    icon: 'ℹ️',
    definition: 'Warnings & Info: alertas de severidad media y baja para seguimiento preventivo o informativo.',
    interpretation: 'Útiles para planificar mejoras proactivas antes de que se conviertan en incidentes críticos.',
    source: 'Motor de alertas del BOS',
  },
};

/** Map display labels back to explanation keys */
export const KPI_ALIASES = {
  // Bilingual aliases -> raw keys
  'SHS (Salud Operativa Consolidada)': 'Health Score',
  'Salud del Sistema': 'Health Score',
  'SHS (SALUD OPERATIVA CONSOLIDADA)': 'Health Score',
  
  'Total Leads (Volumen Total de Leads)': 'Leads totales',
  'Leads Totales': 'Leads totales',
  'TOTAL LEADS (VOLUMEN TOTAL DE LEADS)': 'Leads totales',
  
  'Daily Avg (Promedio Diario de Leads)': 'Promedio diario',
  'Promedio diario': 'Promedio diario',
  'DAILY AVG (PROMEDIO DIARIO DE LEADS)': 'Promedio diario',
  
  'WoW (Cambio Semanal vs Anterior)': 'Cambio semanal',
  'Cambio semanal': 'Cambio semanal',
  'WOW (CAMBIO SEMANAL VS ANTERIOR)': 'Cambio semanal',
  
  'Peak Hour (Hora Pico de Contactos)': 'Hora pico',
  'Hora pico': 'Hora pico',
  'PEAK HOUR (HORA PICO DE CONTACTOS)': 'Hora pico',
  
  'Daily Forecast (Pronóstico Diario de Demanda)': 'Prevision diaria',
  'Daily Forecast (Pronóstico Diario)': 'Prevision diaria',
  'Pronóstico Diario': 'Prevision diaria',
  'Prevision diaria': 'Prevision diaria',
  'DAILY FORECAST (PRONÓSTICO DIARIO DE DEMANDA)': 'Prevision diaria',
  'DAILY FORECAST (PRONÓSTICO DIARIO)': 'Prevision diaria',
  
  'MASE (Precisión del Modelo)': 'MASE',
  'Precisión del Modelo': 'MASE',
  'MASE (PRECISIÓN DEL MODELO)': 'MASE',
  
  'CPL (Costo por Lead Implícito)': 'CPL implicito',
  'Costo Promedio por Lead': 'CPL implicito',
  'CPL implicito': 'CPL implicito',
  'CPL (COSTO POR LEAD IMPLÍCITO)': 'CPL implicito',
  
  'Ad Spend (Inversión Publicitaria)': 'Gasto total',
  'Inversión Publicitaria': 'Gasto total',
  'Gasto total': 'Gasto total',
  'AD SPEND (INVERSIÓN PUBLICITARIA)': 'Gasto total',
  
  'HHI (Concentración de Pauta)': 'HHI',
  'HHI (Diversificación de Pauta)': 'HHI',
  'Diversificación de Pauta': 'HHI',
  'HHI (CONCENTRACIÓN DE PAUTA)': 'HHI',
  
  'Global CVR (Tasa de Conversión Global)': 'Conversion global',
  'Global CVR (tasa de conversión)': 'Conversion global',
  'Tasa Global de Conversión': 'Conversion global',
  'GLOBAL CVR (TASA DE CONVERSIÓN GLOBAL)': 'Conversion global',
  
  'Revenue at Risk (Ingreso en Riesgo por Fugas)': 'Revenue at Risk',
  'Revenue at Risk (ingreso en riesgo)': 'Revenue at Risk',
  'Revenue at Risk': 'Revenue at Risk',
  'REVENUE AT RISK (INGRESO EN RIESGO POR FUGAS)': 'Revenue at Risk',
  
  'Regime Shift (Cambio de Régimen)': 'Cambio de Régimen',
  'Cambio de Régimen': 'Cambio de Régimen',
  'Cambio regimen': 'Cambio de Régimen',
  'REGIME SHIFT (CAMBIO DE RÉGIMEN)': 'Cambio de Régimen',

  'Leads Today (Leads Recibidos Hoy)': 'Leads Hoy',
  'Leads Hoy': 'Leads Hoy',
  'LEADS TODAY (LEADS RECIBIDOS HOY)': 'Leads Hoy',
  
  'Max Daily (Máximo Diario)': 'Máximo Diario',
  'Máximo Diario': 'Máximo Diario',
  'MAX DAILY (MÁXIMO DIARIO)': 'Máximo Diario',
  
  'Overcontact Rate (Tasa de Sobre-Contacto)': 'Tasa de Sobre-Contacto',
  'Tasa de Sobre-Contacto': 'Tasa de Sobre-Contacto',
  'OVERCONTACT RATE (TASA DE SOBRE-CONTACTO)': 'Tasa de Sobre-Contacto',
  
  'Avg Dial Attempts (Intentos Promedio)': 'Promedio Intentos',
  'Promedio Intentos': 'Promedio Intentos',
  'Avg Dial Attempts (intentos promedio)': 'Promedio Intentos',
  'AVG DIAL ATTEMPTS (INTENTOS PROMEDIO)': 'Promedio Intentos',
  
  // Page specific new ones
  'Total Records (Registros de Llamadas)': 'Registros de Llamadas',
  'Registros de Llamadas': 'Registros de Llamadas',
  'Registros': 'Registros de Llamadas',
  'Call Records': 'Registros de Llamadas',
  'TOTAL RECORDS (REGISTROS DE LLAMADAS)': 'Registros de Llamadas',

  'Unique Leads (Contactos Únicos)': 'Contactos Únicos',
  'Contactos Únicos': 'Contactos Únicos',
  'Contactos': 'Contactos Únicos',
  'Unique Contacts': 'Contactos Únicos',
  'UNIQUE LEADS (CONTACTOS ÚNICOS)': 'Contactos Únicos',

  'Avg Callback Interval (Minutos entre Intentos)': 'Intervalo entre Intentos',
  'Avg Callback Interval (min entre intentos)': 'Intervalo entre Intentos',
  'Intervalo entre Intentos': 'Intervalo entre Intentos',
  'AVG CALLBACK INTERVAL (MINUTOS ENTRE INTENTOS)': 'Intervalo entre Intentos',
  
  'Ad Spend (Inversión Total Ejecutada)': 'Inversión Total Ejecutada',
  'Inversión Total Ejecutada': 'Inversión Total Ejecutada',
  'AD SPEND (INVERSIÓN TOTAL EJECUTADA)': 'Inversión Total Ejecutada',
  
  'Active Campaigns (Campañas Activas Modeladas)': 'Campañas Activas Modeladas',
  'Campañas Activas Modeladas': 'Campañas Activas Modeladas',
  'ACTIVE CAMPAIGNS (CAMPAÑAS ACTIVAS MODELADAS)': 'Campañas Activas Modeladas',
  
  'Total Alerts (Alertas Totales)': 'Alertas Totales',
  'Alertas Totales': 'Alertas Totales',
  'TOTAL ALERTS (ALERTAS TOTALES)': 'Alertas Totales',
  
  'Critical Alerts (Alertas Críticas)': 'Alertas Críticas',
  'Alertas Críticas': 'Alertas Críticas',
  'CRITICAL ALERTS (ALERTAS CRÍTICAS)': 'Alertas Críticas',
  
  'Max Severity (Severidad Máxima)': 'Severidad Máxima',
  'Severidad Máxima': 'Severidad Máxima',
  'MAX SEVERITY (SEVERIDAD MÁXIMA)': 'Severidad Máxima',
  
  'Warnings & Info (Advertencias e Info)': 'Advertencias e Info',
  'Advertencias e Info': 'Advertencias e Info',
  'WARNINGS & INFO (ADVERTENCIAS E INFO)': 'Advertencias e Info',
  
  'Daily Forecast (Pronóstico Mañana)': 'Pronóstico Mañana',
  'Pronóstico Mañana': 'Pronóstico Mañana',
  'DAILY FORECAST (PRONÓSTICO MAÑANA)': 'Pronóstico Mañana',
  
  '7-Day Forecast (Pronóstico 7 Días)': 'Pronóstico 7 Días',
  'Pronóstico 7 Días': 'Pronóstico 7 Días',
  '7-DAY FORECAST (PRONÓSTICO 7 DÍAS)': 'Pronóstico 7 Días',
  
  '14-Day Forecast (Pronóstico 14 Días)': 'Pronóstico 14 Días',
  'Pronóstico 14 Días': 'Pronóstico 14 Días',
  '14-DAY FORECAST (PRONÓSTICO 14 DÍAS)': 'Pronóstico 14 Días',
};

export function resolveKpiExplanation(label) {
  if (!label) return null;
  const upper = label.trim().toUpperCase();
  // Try direct match first
  if (KPI_EXPLANATIONS[label]) return KPI_EXPLANATIONS[label];
  if (KPI_EXPLANATIONS[upper]) return KPI_EXPLANATIONS[upper];
  
  // Try aliases match
  const alias = KPI_ALIASES[label] || KPI_ALIASES[upper];
  if (alias && KPI_EXPLANATIONS[alias]) return KPI_EXPLANATIONS[alias];
  
  // Fuzzy match (if label contains the key or vice versa)
  for (const key of Object.keys(KPI_EXPLANATIONS)) {
    if (upper.includes(key.toUpperCase()) || key.toUpperCase().includes(upper)) {
      return KPI_EXPLANATIONS[key];
    }
  }
  
  return null;
}
