/** KPI explanations dictionary — migrated from app.js */
export const KPI_EXPLANATIONS = {
  'Health Score': {
    icon: '💓',
    definition: 'SHS: indicador compuesto de 0 a 100 que resume el estado general de toda la operación comercial.',
    interpretation: 'Un valor de 80+ indica un sistema saludable. Entre 60-79, el sistema está bajo presión. Por debajo de 60 indica estado crítico.',
    source: 'Calculado por el Motor BOS — combina métricas de operaciones, embudo y finanzas',
  },
  'Leads totales': {
    icon: '👥',
    definition: 'La cantidad total de prospectos que han ingresado al sistema durante el periodo analizado.',
    interpretation: 'Volumen alto sin agentes = saturación; volumen bajo = problemas con la pauta publicitaria.',
    source: 'Conteo directo del CRM integrado vía n8n',
  },
  'Promedio diario': {
    icon: '📊',
    definition: 'El número promedio de leads nuevos que ingresan al sistema cada día.',
    interpretation: 'Sirve para planear la capacidad operativa del equipo.',
    source: 'Cálculo: total_leads ÷ total_days',
  },
  'Hora pico': {
    icon: '⏰',
    definition: 'La hora del día en que se recibe el mayor volumen de contactos.',
    interpretation: 'El equipo debe estar a su máxima capacidad durante esta hora.',
    source: 'Análisis de distribución horaria del CRM',
  },
  'Prevision diaria': {
    icon: '🔮',
    definition: 'Daily Forecast: predicción del modelo sobre cuántos leads se recibirán mañana.',
    interpretation: 'Útil para staffing del call center al día siguiente.',
    source: 'forecast.recommended_value — modelo recomendado por backtest',
  },
  'MASE': {
    icon: '🎯',
    definition: 'MASE (error medio absoluto escalado): mide el error promedio del pronóstico.',
    interpretation: '< 0.75 excelente; 0.75–1.0 aceptable; ≥ 1.0 no supera la línea base.',
    source: 'Backtest rolling — forecast.diagnostics.best_mase',
  },
  'CPL implicito': {
    icon: '💰',
    definition: 'CPL: costo implícito por prospecto. Gasto total ÷ leads totales.',
    interpretation: 'A menor CPL, mejor. Comparar contra ingreso promedio por caso.',
    source: 'investment.cpl.global_cpl',
  },
  'Gasto total': {
    icon: '📢',
    definition: 'Ad Spend: monto total invertido en paid media durante el periodo.',
    interpretation: 'Spend alto sin leads proporcionales sugiere fatiga de audiencias.',
    source: 'investment.total_spend',
  },
  'HHI': {
    icon: '🎲',
    definition: 'HHI: índice de concentración del gasto entre campañas. 0 = diversificado; 1 = concentrado.',
    interpretation: '< 0.15 diversificado; 0.15–0.25 moderado; > 0.25 riesgo.',
    source: 'investment.mmm.hhi_index',
  },
  'Conversion global': {
    icon: '🎯',
    definition: 'Global CVR: porcentaje de leads que avanzan a etapa clave vs total.',
    interpretation: '> 5% es fuerte; < 3.5% sugiere fuga temprana o leads no calificados.',
    source: 'funnel.global_conversion_pct',
  },
  'Revenue at Risk': {
    icon: '💸',
    definition: 'Revenue at Risk: opportunity cost de leads perdidos, asumiendo ~$1,200 USD por caso.',
    interpretation: 'Reducirlo vía mejor speed-to-lead y menos over-dialing mejora revenue.',
    source: 'funnel.total_revenue_at_risk',
  },
  'Cambio semanal': {
    icon: '📈',
    definition: 'WoW: cambio porcentual del volumen vs la semana anterior.',
    interpretation: 'Caídas > 10% = fatiga de creativos. Subidas > 15% = necesita más agentes.',
    source: 'operations.wow_change_pct',
  },
  'Pronóstico Mañana': {
    icon: '🔮',
    definition: 'La proyección de leads para mañana utilizando el modelo predictivo.',
    interpretation: 'Si supera el promedio, reforzar el call center.',
    source: 'Forecast API — theta_lite / Random Forest',
  },
  'Pronóstico 7 Días': {
    icon: '📅',
    definition: 'Volumen acumulado de leads esperados en los próximos 7 días.',
    interpretation: 'Permite planear la agenda operativa semanal.',
    source: 'Sumatoria de proyecciones diarias a 7 días',
  },
  'Pronóstico 14 Días': {
    icon: '📆',
    definition: 'Volumen total de leads proyectados para las próximas dos semanas.',
    interpretation: 'Sirve para planear compras publicitarias y presupuestos quincenales.',
    source: 'Proyección temporal a mediano plazo (14 días)',
  },
  'Cambio de Régimen': {
    icon: '📉',
    definition: 'Cambio estructural significativo en el volumen diario, detectado mediante CUSUM.',
    interpretation: 'Valor negativo = reducción persistente. Valor positivo = incremento sostenido.',
    source: 'Algoritmo CUSUM integrado en el motor de predicción BOS',
  },
  'Leads Hoy': {
    icon: '📈',
    definition: 'El volumen de prospectos registrados en el día actual.',
    interpretation: 'Muestra el tráfico entrante inmediato del día de hoy.',
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
    definition: 'El promedio general de intentos de llamadas por lead.',
    interpretation: 'Valores mayores a 7 sugieren sobre-contacto y saturación de la base de datos.',
    source: 'Métricas operativas del CRM',
  },
};

/** Map display labels back to explanation keys */
export const KPI_ALIASES = {
  'Salud del Sistema': 'Health Score',
  'Pronóstico Diario': 'Prevision diaria',
  'Precisión del Modelo': 'MASE',
  'Costo Promedio por Lead': 'CPL implicito',
  'Inversión Publicitaria': 'Gasto total',
  'Diversificación de Pauta': 'HHI',
  'Tasa Global de Conversión': 'Conversion global',
  'Revenue at Risk (ingreso en riesgo)': 'Revenue at Risk',
  'Cambio regimen': 'Cambio de Régimen',
};

export function resolveKpiExplanation(label) {
  if (!label) return null;
  if (KPI_EXPLANATIONS[label]) return KPI_EXPLANATIONS[label];
  const alias = KPI_ALIASES[label];
  if (alias && KPI_EXPLANATIONS[alias]) return KPI_EXPLANATIONS[alias];
  return null;
}
