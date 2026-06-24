/**
 * Enriquece funnel.* a partir de transitions[] sin acceso a BD.
 */

const {
    buildTransitionMatrix,
    isConversionState,
    isLossState,
} = require('./markov-matrix');

const DEFAULT_FUNNEL_CONFIG = {
    ticket_promedio: 500,
    revenue_per_conversion: 1200,
    conversion_target: 'Consult Booked',
    trap_threshold_leads: 200,
    leak_warning_pct: 10,
    leak_critical_pct: 25,
    revenue_at_risk_top_n: 50,
};

function resolveConfig(data) {
    const cfg = data?.meta?.config || {};
    const funnel = data?.funnel || {};
    return {
        ticket_promedio: Number(cfg.ticket_promedio) || DEFAULT_FUNNEL_CONFIG.ticket_promedio,
        revenue_per_conversion: Number(cfg.revenue_per_conversion) || DEFAULT_FUNNEL_CONFIG.revenue_per_conversion,
        conversion_target: funnel.conversion_target || cfg.conversion_target || DEFAULT_FUNNEL_CONFIG.conversion_target,
        trap_threshold_leads: Number(cfg.trap_threshold_leads) || DEFAULT_FUNNEL_CONFIG.trap_threshold_leads,
        leak_warning_pct: Number(cfg.leak_warning_pct) || DEFAULT_FUNNEL_CONFIG.leak_warning_pct,
        leak_critical_pct: Number(cfg.leak_critical_pct) || DEFAULT_FUNNEL_CONFIG.leak_critical_pct,
        revenue_at_risk_top_n: Number(cfg.revenue_at_risk_top_n) || DEFAULT_FUNNEL_CONFIG.revenue_at_risk_top_n,
    };
}

function isEntryState(state) {
    const t = String(state || '').toLowerCase();
    return t.includes('new lead') || t.includes('abierto') || t === 'open';
}

function buildLeaks(transitions, conversionTarget) {
    return (transitions || [])
        .filter((t) => isLossState(t.to, conversionTarget))
        .map((t) => ({
            from: t.from || 'Origen',
            to: t.to || 'Destino',
            pct: Number(t.pct) || 0,
            cnt: Number(t.cnt) || 0,
        }))
        .sort((a, b) => b.cnt - a.cnt);
}

function buildFeedersFromTransitions(transitions, conversionTarget) {
    const conversionCntByFrom = {};
    const totalOutByFrom = {};

    (transitions || []).forEach((t) => {
        const from = t.from || 'Origen';
        const cnt = Number(t.cnt) || 0;
        if (!totalOutByFrom[from]) totalOutByFrom[from] = 0;
        totalOutByFrom[from] += cnt;

        if (isConversionState(t.to, conversionTarget)) {
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

function buildTrapStates(transitions, matrix, config) {
    if (!matrix) return [];

    const traps = [];
    const { byFrom, transitoryNames } = matrix;
    const threshold = config.trap_threshold_leads;

    transitoryNames.forEach((state) => {
        const trans = byFrom[state] || [];
        const totalCnt = trans.reduce((sum, t) => sum + t.cnt, 0);
        if (totalCnt < threshold) return;

        const selfLoop = trans.find((t) => t.to === state);
        const selfPct = selfLoop && trans.reduce((s, t) => s + t.pct, 0) > 0
            ? selfLoop.pct / trans.reduce((s, t) => s + t.pct, 0)
            : 0;

        const toConversion = trans
            .filter((t) => isConversionState(t.to, config.conversion_target))
            .reduce((sum, t) => sum + t.cnt, 0);
        const toLoss = trans
            .filter((t) => isLossState(t.to, config.conversion_target))
            .reduce((sum, t) => sum + t.cnt, 0);

        const conversionRate = totalCnt > 0 ? toConversion / totalCnt : 0;
        const lossRate = totalCnt > 0 ? toLoss / totalCnt : 0;

        if (selfPct >= 0.4 || (lossRate > conversionRate && lossRate >= 0.3)) {
            traps.push({
                state,
                total_cnt: totalCnt,
                self_loop_pct: Math.round(selfPct * 10000) / 100,
                conversion_rate: Math.round(conversionRate * 10000) / 100,
                loss_rate: Math.round(lossRate * 10000) / 100,
                reason: selfPct >= 0.4
                    ? 'Alto auto-loop en el estado'
                    : 'Más fugas que avances a conversión',
            });
        }
    });

    return traps.sort((a, b) => b.total_cnt - a.total_cnt);
}

function buildAbsorptionProbabilities(matrix) {
    if (!matrix) return [];

    const { transitoryNames, B, expSteps, stddevByState, conversionIndices, lossIndices } = matrix;

    return transitoryNames.map((state, i) => {
        let probConversion = 0;
        conversionIndices.forEach((j) => { probConversion += B[i][j] || 0; });

        let probLoss = 0;
        lossIndices.forEach((j) => { probLoss += B[i][j] || 0; });

        const metrics = stddevByState[state] || {};

        return {
            state,
            prob_conversion: Math.round(probConversion * 10000) / 10000,
            prob_loss: Math.round(probLoss * 10000) / 10000,
            expected_steps: Math.round((expSteps[i] || 0) * 100) / 100,
            step_variance: metrics.step_variance || 0,
            step_stddev: metrics.step_stddev || 0,
        };
    }).filter((row) => row.prob_conversion > 0 || row.prob_loss > 0)
        .sort((a, b) => b.prob_conversion - a.prob_conversion);
}

function computeConversionPct(transitions, config, totalLeads) {
    const target = config.conversion_target;
    const conversionsToTarget = (transitions || [])
        .filter((t) => isConversionState(t.to, target))
        .reduce((sum, t) => sum + (Number(t.cnt) || 0), 0);

    if (totalLeads > 0) {
        return Math.round((conversionsToTarget / totalLeads) * 10000) / 100;
    }

    let entryLeads = (transitions || [])
        .filter((t) => isEntryState(t.from))
        .reduce((sum, t) => sum + (Number(t.cnt) || 0), 0);

    if (entryLeads <= 0) {
        entryLeads = conversionsToTarget > 0 ? conversionsToTarget : 1;
    }

    return Math.round((conversionsToTarget / entryLeads) * 10000) / 100;
}

function syncConversionKpi(data, pct) {
    if (!Array.isArray(data.kpis)) return;
    const formatted = `${pct}%`;
    data.kpis.forEach((kpi) => {
        if (kpi.label === 'Conversion global') {
            kpi.value = formatted;
        }
    });
}

function buildRevenueAtRisk(leaks, config) {
    const topN = config.revenue_at_risk_top_n;
    const revenuePer = config.revenue_per_conversion;

    const items = leaks.slice(0, topN).map((leak) => ({
        from: leak.from,
        to: leak.to,
        cnt: leak.cnt,
        value: Math.round((leak.cnt || 0) * revenuePer),
    }));

    const total = items.reduce((sum, item) => sum + item.value, 0);
    return { items, total };
}

function hasValidArray(arr) {
    return Array.isArray(arr) && arr.length > 0;
}

function enrichFunnelFromTransitions(data) {
    if (!data || typeof data !== 'object') return data;

    const funnel = data.funnel || {};
    const transitions = funnel.transitions;
    if (!Array.isArray(transitions) || !transitions.length) return data;

    const skipHeavyEnrich = data.meta?._enriched_funnel === true
        && hasValidArray(funnel.absorption_probabilities)
        && funnel.total_revenue_at_risk != null
        && hasValidArray(funnel.leaks);

    const config = resolveConfig(data);
    const totalLeads = Number(data.operations?.total_leads) || 0;

    data.meta = data.meta || {};
    data.funnel = funnel;

    if (!funnel.conversion_target) {
        funnel.conversion_target = config.conversion_target;
    }

    const matrix = buildTransitionMatrix(transitions, { conversionTarget: config.conversion_target });

    if (!skipHeavyEnrich) {
        if (!hasValidArray(funnel.leaks)) {
            funnel.leaks = buildLeaks(transitions, config.conversion_target);
        }

        if (!hasValidArray(funnel.trap_states)) {
            funnel.trap_states = buildTrapStates(transitions, matrix, config);
        }

        if (!hasValidArray(funnel.absorption_probabilities)) {
            funnel.absorption_probabilities = buildAbsorptionProbabilities(matrix);
        }

        if (!hasValidArray(funnel.revenue_at_risk) || funnel.total_revenue_at_risk == null) {
            const leaks = hasValidArray(funnel.leaks) ? funnel.leaks : buildLeaks(transitions, config.conversion_target);
            const { items, total } = buildRevenueAtRisk(leaks, config);
            if (!hasValidArray(funnel.revenue_at_risk)) {
                funnel.revenue_at_risk = items;
            }
            if (funnel.total_revenue_at_risk == null) {
                funnel.total_revenue_at_risk = total;
            }
        }
    } else if (hasValidArray(funnel.leaks)) {
        funnel.leaks = funnel.leaks.slice().sort((a, b) => (Number(b.cnt) || 0) - (Number(a.cnt) || 0));
    }

    const previousPct = funnel.conversion_pct ?? funnel.global_conversion_pct;
    const recalculatedPct = computeConversionPct(transitions, config, totalLeads);

    if (previousPct != null && Math.abs(Number(previousPct) - recalculatedPct) > 0.01) {
        funnel.markov_entry_conversion_pct = Number(previousPct);
    }

    funnel.conversion_pct = recalculatedPct;
    funnel.global_conversion_pct = recalculatedPct;
    syncConversionKpi(data, recalculatedPct);

    funnel.feeders = buildFeedersFromTransitions(transitions, config.conversion_target);

    data.meta._enriched_funnel = true;
    data.meta._enriched_at = new Date().toISOString();

    return data;
}

module.exports = {
    enrichFunnelFromTransitions,
    DEFAULT_FUNNEL_CONFIG,
    buildLeaks,
    buildFeedersFromTransitions,
    buildTrapStates,
    buildAbsorptionProbabilities,
    computeConversionPct,
    syncConversionKpi,
};
