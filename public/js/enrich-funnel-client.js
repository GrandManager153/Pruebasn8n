/**
 * Recalcula métricas del embudo en el navegador (misma lógica que el servidor).
 * Garantiza conversión/feeders correctos aunque el JSON en disco traiga valores Markov viejos.
 */

function isFunnelEntryState(state) {
    const t = String(state || '').toLowerCase();
    return t.includes('new lead') || t.includes('abierto') || t === 'open';
}

function computeFunnelConversionPct(transitions, conversionTarget, totalLeads) {
    const target = conversionTarget || 'Consult Booked';
    const conversionsToTarget = (transitions || [])
        .filter((t) => isFunnelConversionState(t.to, target))
        .reduce((sum, t) => sum + (Number(t.cnt) || 0), 0);

    if (totalLeads > 0) {
        return Math.round((conversionsToTarget / totalLeads) * 10000) / 100;
    }

    let entryLeads = (transitions || [])
        .filter((t) => isFunnelEntryState(t.from))
        .reduce((sum, t) => sum + (Number(t.cnt) || 0), 0);

    if (entryLeads <= 0) {
        entryLeads = conversionsToTarget > 0 ? conversionsToTarget : 1;
    }

    return Math.round((conversionsToTarget / entryLeads) * 10000) / 100;
}

function buildFunnelFeedersFromTransitions(transitions, conversionTarget) {
    const conversionCntByFrom = {};
    const totalOutByFrom = {};

    (transitions || []).forEach((t) => {
        const from = t.from || 'Origen';
        const cnt = Number(t.cnt) || 0;
        if (!totalOutByFrom[from]) totalOutByFrom[from] = 0;
        totalOutByFrom[from] += cnt;

        if (isFunnelConversionState(t.to, conversionTarget)) {
            if (!conversionCntByFrom[from]) conversionCntByFrom[from] = 0;
            conversionCntByFrom[from] += cnt;
        }
    });

    return Object.entries(conversionCntByFrom)
        .map(([from, cnt]) => {
            const totalOut = totalOutByFrom[from] || cnt;
            const pct = totalOut > 0 ? Math.round((cnt / totalOut) * 10000) / 100 : 0;
            return { from, pct, cnt };
        })
        .sort((a, b) => b.cnt - a.cnt);
}

function syncFunnelConversionKpi(data, pct) {
    if (!Array.isArray(data.kpis)) return;
    const formatted = `${pct}%`;
    data.kpis.forEach((kpi) => {
        if (kpi.label === 'Conversion global') {
            kpi.value = formatted;
        }
    });
}

function enrichFunnelClientData(data) {
    if (!data || typeof data !== 'object') return data;

    const funnel = data.funnel;
    if (!funnel || !Array.isArray(funnel.transitions) || !funnel.transitions.length) {
        return data;
    }

    const conversionTarget = funnel.conversion_target
        || data.meta?.config?.conversion_target
        || 'Consult Booked';
    const totalLeads = Number(data.operations?.total_leads) || 0;

    const previousPct = funnel.conversion_pct ?? funnel.global_conversion_pct;
    const recalculatedPct = computeFunnelConversionPct(
        funnel.transitions,
        conversionTarget,
        totalLeads
    );

    if (previousPct != null && Math.abs(Number(previousPct) - recalculatedPct) > 0.01) {
        funnel.markov_entry_conversion_pct = Number(previousPct);
    }

    funnel.conversion_pct = recalculatedPct;
    funnel.global_conversion_pct = recalculatedPct;
    syncFunnelConversionKpi(data, recalculatedPct);

    funnel.feeders = buildFunnelFeedersFromTransitions(funnel.transitions, conversionTarget);

    if (Array.isArray(funnel.leaks) && funnel.leaks.length) {
        funnel.leaks = funnel.leaks
            .slice()
            .sort((a, b) => (Number(b.cnt) || 0) - (Number(a.cnt) || 0));
    }

    data.meta = data.meta || {};
    data.meta._enriched_funnel = true;

    return data;
}
