/** KPI explanations dictionary — migrated from app.js and expanded for bilingual metrics */
export const KPI_EXPLANATIONS = {
  'Health Score': {
    icon: '💓',
    definition: 'SHS (System Health Score): indicador compuesto de 0 a 100 que resume el estado general de toda la operación comercial. Combina eficiencia del call center, calidad del contacto, velocidad de respuesta y balance de inversión publicitaria.',
    interpretation: 'Un valor de 80+ indica un sistema saludable. Entre 60-79, el sistema está bajo presión y requiere atención. Por debajo de 60 indica estado crítico con problemas que afectan directamente los ingresos.',
    source: 'Calculado por el Motor PulseMkt — combina métricas de operaciones, embudo y finanzas',
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
    source: 'Algoritmo CUSUM integrado en el motor de predicción PulseMkt',
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
    shortHint: 'Cuántas veces en promedio se llama a cada lead.',
    definition: 'El promedio general de intentos de llamadas telefónicas por lead.',
    interpretation: 'Valores mayores a 7 sugieren sobre-contacto y saturación de la base de datos.',
    source: 'Métricas operativas del CRM',
  },
  'First Contact Rate (Tasa de Primer Contacto)': {
    icon: '🎯',
    shortHint: 'Cuántos leads se contactan al primer intento de llamada.',
    definition: 'Proporción de contactos únicos alcanzados en el primer intento de marcación.',
    interpretation: 'Valores altos indican mejor speed-to-lead y menor desperdicio de intentos.',
    source: 'operations.derived.first_contact_rate',
  },
  'Sweet Spot % (Intentos 1–3)': {
    icon: '✅',
    shortHint: 'Llamadas dentro de la ventana ideal de 1 a 3 intentos.',
    definition: 'Porcentaje de llamadas realizadas dentro de la ventana óptima de 1 a 3 intentos.',
    interpretation: 'Por encima del sobre-contacto (>7) refleja disciplina operativa saludable.',
    source: 'operations.derived.sweet_spot_pct',
  },
  'Dial Efficiency (Eficiencia de Marcación)': {
    icon: '📲',
    shortHint: 'Qué tan bien se evitan llamadas repetidas al mismo lead.',
    definition: 'Proporción de contactos únicos respecto al total de registros de llamada. Mide si cada marcación llega a un lead distinto.',
    interpretation: 'Valores altos = menos duplicidad. Bajo indica muchas re-marcaciones al mismo prospecto.',
    source: 'operations.derived.dial_efficiency',
  },
  'Overcontact Index (Llamadas >7 est.)': {
    icon: '⚠️',
    shortHint: 'Llamadas que superan el límite recomendado de intentos.',
    definition: 'Estimación de llamadas con más de 7 intentos acumulados, umbral donde el retorno marginal cae drásticamente.',
    interpretation: 'Valores altos señalan desgaste de la base y posible saturación de leads.',
    source: 'operations.derived.overcontact_index',
  },
  'Tasa de llegada (λ)': {
    icon: '📥',
    shortHint: 'Leads que entran por hora según el promedio diario.',
    definition: 'Tasa de llegada (λ): volumen de leads nuevos por hora, derivado del promedio diario dividido entre 24.',
    interpretation: 'Base del modelo de colas; a mayor λ, más agentes o menor tiempo de servicio se requieren.',
    source: 'operations.littles_law.arrival_rate_per_hour',
  },
  'Tiempo de servicio (W)': {
    icon: '⏱️',
    shortHint: 'Duración media de cada llamada atendida.',
    definition: 'Tiempo de servicio (W): minutos promedio que un agente dedica a cada interacción telefónica.',
    interpretation: 'W alto aumenta la cola estimada (L = λ × W) si no se ajusta la capacidad.',
    source: 'operations.littles_law.avg_service_minutes',
  },
  'Cola estimada (L)': {
    icon: '📋',
    shortHint: 'Leads en espera según la ley de Little (λ × W).',
    definition: 'Cola estimada (L): número de leads en sistema esperando atención, calculado con la ley de Little (L = λ × W).',
    interpretation: 'Valores elevados anticipan saturación del call center si no hay refuerzo de staffing.',
    source: 'operations.littles_law.estimated_queue_leads',
  },
  'Utilización': {
    icon: '⚙️',
    shortHint: 'Porcentaje de capacidad diaria que consume la demanda actual.',
    definition: 'Porcentaje de utilización de la capacidad operativa: qué fracción del máximo de leads/día que el equipo puede atender está siendo demandada.',
    interpretation: 'Por encima de 85% hay riesgo de colas y tiempos de espera prolongados.',
    source: 'operations.littles_law.utilization_pct',
  },
  'Presión de staffing': {
    icon: '👥',
    shortHint: 'Si el equipo actual cubre la demanda de mañana.',
    definition: 'Indicador de presión de personal: compara la demanda proyectada contra la capacidad disponible de agentes.',
    interpretation: 'Crítica o Presión implica gap de leads sin atender; OK indica cobertura suficiente.',
    source: 'operations.littles_law.staffing_pressure',
  },
  'Daily Volume (Volumen Diario de Leads)': {
    icon: '📊',
    shortHint: 'Cuántos leads llegan cada día y cómo se comparan con el promedio.',
    definition: 'Serie temporal del volumen diario de leads recibidos en el periodo analizado.',
    interpretation: 'Picos sostenidos por encima del promedio requieren más agentes; valles sugieren revisar pauta.',
    source: 'operations.daily_volumes',
  },
  'Hourly Distribution (Distribución Horaria)': {
    icon: '🕐',
    shortHint: 'En qué horas del día se concentran las llamadas.',
    definition: 'Distribución porcentual de contactos telefónicos a lo largo de las 24 horas del día.',
    interpretation: 'Alinea turnos de agentes con la hora pico para mejorar el speed-to-lead.',
    source: 'operations.hourly_distribution',
  },
  'Contact Distribution (Distribución de Contacto)': {
    icon: '📞',
    shortHint: 'En cuántos intentos se logra contactar a los leads.',
    definition: 'Desglose de llamadas según el número de intento: primer contacto, ventana 1–3, 1–5 y sobre-contacto (>7).',
    interpretation: 'Un alto % en 1er intento o sweet spot indica operación eficiente; >7% en sobre-contacto es señal de alerta.',
    source: 'operations.contact_distribution',
  },
  'Forecast vs capacidad': {
    icon: '⚖️',
    shortHint: 'Compara el pronóstico de mañana con la capacidad histórica.',
    definition: 'Relación entre el pronóstico de leads del día siguiente y el promedio diario histórico de capacidad.',
    interpretation: 'Ratio > 1 con presión crítica indica que mañana se superará la capacidad operativa habitual.',
    source: 'operations.derived.forecast_vs_capacity',
  },
  'ROAS Proxy (Retorno Estimado / Gasto)': {
    icon: '📈',
    definition: 'Retorno estimado sobre gasto publicitario usando conversiones Markov y valor por caso.',
    interpretation: '≥ 1 sugiere rentabilidad proxy; < 1 indica que el gasto supera el ingreso estimado.',
    source: 'derived.economics.roas_proxy',
  },
  'Breakeven CPL Gap (CPL vs Umbral Rentable)': {
    icon: '⚖️',
    definition: 'Diferencia entre el CPL global actual y el CPL máximo rentable según la tasa de conversión.',
    interpretation: 'Positivo = estás pagando más de lo sostenible por lead; negativo = margen favorable.',
    source: 'derived.economics.breakeven_cpl_gap',
  },
  'Delta vs ejecución anterior': {
    icon: '📉',
    definition: 'Cambio de cada KPI respecto a la ejecución diaria anterior guardada en el historial local.',
    interpretation: 'En SHS/leads/conversión, subir suele ser bueno; en CPL, MASE y sobre-contacto la dirección favorable se invierte.',
    source: 'history.compare.deltas',
  },
  'Alertas recurrentes': {
    icon: '🔁',
    definition: 'Incidentes cuya métrica ya aparecía en la ejecución anterior.',
    interpretation: 'Indican problemas persistentes que requieren acción de fondo, no solo monitoreo.',
    source: 'history.compare.alerts.recurrent',
  },
  'Narrativa validada': {
    icon: '✅',
    definition: 'Los informes HTML pasaron la validación NarrativeQA en n8n.',
    interpretation: 'Badge verde cuando meta.narrative_qa.passed es true.',
    source: 'meta.narrative_qa',
  },
  'Registros de Llamadas': {
    icon: '📞',
    shortHint: 'Todas las llamadas registradas, incluyendo reintentos.',
    definition: 'Total Records: cantidad total de llamadas telefónicas brutas registradas en el CRM durante el periodo analizado.',
    interpretation: 'Mide la carga de trabajo bruta. Útil para dimensionar el esfuerzo bruto y el volumen de marcaciones diarias.',
    source: 'CRM integrado vía n8n',
  },
  'Contactos Únicos': {
    icon: '👤',
    shortHint: 'Prospectos distintos que recibieron al menos una llamada.',
    definition: 'Unique Leads: número de prospectos únicos que recibieron llamadas o gestiones.',
    interpretation: 'Diferencia el esfuerzo bruto del alcance real. Un ratio llamadas/contactos alto indica alta insistencia telefónica.',
    source: 'CRM integrado vía n8n',
  },
  'Intervalo entre Intentos': {
    icon: '⏱️',
    shortHint: 'Tiempo promedio entre una llamada y la siguiente al mismo lead.',
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
    source: 'Motor de alertas de PulseMkt',
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
    source: 'Motor de alertas de PulseMkt',
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
  'Tasa de conversión': 'Conversion global',
  
  'Revenue at Risk (Ingreso en Riesgo por Fugas)': 'Revenue at Risk',
  'Revenue at Risk (ingreso en riesgo)': 'Revenue at Risk',
  'Revenue at Risk': 'Revenue at Risk',
  'REVENUE AT RISK (INGRESO EN RIESGO POR FUGAS)': 'Revenue at Risk',
  'Ingreso en riesgo': 'Revenue at Risk',

  'First Contact Rate (Tasa de Primer Contacto)': 'First Contact Rate (Tasa de Primer Contacto)',
  'First Contact Rate': 'First Contact Rate (Tasa de Primer Contacto)',
  'Sweet Spot % (Intentos 1–3)': 'Sweet Spot % (Intentos 1–3)',
  'Sweet Spot %': 'Sweet Spot % (Intentos 1–3)',
  'ROAS Proxy (Retorno Estimado / Gasto)': 'ROAS Proxy (Retorno Estimado / Gasto)',
  'ROAS Proxy': 'ROAS Proxy (Retorno Estimado / Gasto)',
  'Breakeven CPL Gap (CPL vs Umbral Rentable)': 'Breakeven CPL Gap (CPL vs Umbral Rentable)',
  'Breakeven CPL Gap': 'Breakeven CPL Gap (CPL vs Umbral Rentable)',
  'Dial Efficiency (Eficiencia de Marcación)': 'Dial Efficiency (Eficiencia de Marcación)',
  'Dial Efficiency': 'Dial Efficiency (Eficiencia de Marcación)',
  'Overcontact Index (Llamadas >7 est.)': 'Overcontact Index (Llamadas >7 est.)',
  'Overcontact Index': 'Overcontact Index (Llamadas >7 est.)',

  'Tasa de llegada (λ)': 'Tasa de llegada (λ)',
  'Tiempo de servicio (W)': 'Tiempo de servicio (W)',
  'Cola estimada (L)': 'Cola estimada (L)',
  'Presión de staffing': 'Presión de staffing',

  'Avg Callback Interval (Demora entre Re-intentos)': 'Intervalo entre Intentos',
  'AVG CALLBACK INTERVAL (DEMORA ENTRE RE-INTENTOS)': 'Intervalo entre Intentos',

  'Daily Volume (Volumen Diario de Leads)': 'Daily Volume (Volumen Diario de Leads)',
  'Hourly Distribution (Distribución Horaria)': 'Hourly Distribution (Distribución Horaria)',
  'Contact Distribution (Distribución de Contacto)': 'Contact Distribution (Distribución de Contacto)',
  'Forecast vs capacidad': 'Forecast vs capacidad',

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

/** Short one-liner for inline card hints (non-invasive) */
export function resolveKpiShortHint(label) {
  const explain = resolveKpiExplanation(label);
  if (!explain) return null;
  if (explain.shortHint) return explain.shortHint;
  if (!explain.definition) return null;
  const first = explain.definition.split(/(?<=[.!?])\s+/)[0];
  return first.length > 110 ? `${first.slice(0, 107)}…` : first;
}
