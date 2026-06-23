/**
 * Valida el pipeline de enriquecimiento Fase 1 contra el sample JSON.
 *
 * Esperado (sample): 955 consultas / 11181 total_leads ≈ 8.54%
 */

const fs = require('fs');
const path = require('path');
const { enrichFunnelFromTransitions, computeConversionPct } = require('./enrich-funnel-from-transitions');
const { enrichOperationsDerived } = require('./enrich-operations-derived');
const { enrichFunnelMarkovStddev } = require('./enrich-funnel-markov-stddev');
const { isConversionState } = require('./markov-matrix');

const SAMPLE_PATH = path.join(__dirname, '..', 'data', 'dashboard_payload.sample.json');
const ENRICHED_OUT = path.join(__dirname, '..', 'data', 'dashboard_payload.sample.enriched.json');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function runPhase1Pipeline(data) {
    enrichFunnelFromTransitions(data);
    enrichOperationsDerived(data);
    enrichFunnelMarkovStddev(data);
    return data;
}

function main() {
    console.log('Validando Fase 1 contra:', SAMPLE_PATH);

    const raw = JSON.parse(fs.readFileSync(SAMPLE_PATH, 'utf-8'));
    const data = runPhase1Pipeline(raw);

    const funnel = data.funnel || {};
    const derived = data.operations?.derived || {};
    const economics = data.derived?.economics || {};
    const totalLeads = Number(data.operations?.total_leads) || 0;

    assert(Array.isArray(funnel.absorption_probabilities) && funnel.absorption_probabilities.length > 0,
        'funnel.absorption_probabilities debe tener elementos');
    assert(funnel.absorption_probabilities.length >= 5,
        `absorption_probabilities esperaba >= 5, obtuvo ${funnel.absorption_probabilities.length}`);

    assert(Array.isArray(funnel.leaks) && funnel.leaks.length > 0,
        'funnel.leaks debe tener elementos');

    assert(funnel.conversion_pct != null,
        'funnel.conversion_pct no debe ser null');

    const convCnt = (funnel.transitions || [])
        .filter((t) => isConversionState(t.to, funnel.conversion_target))
        .reduce((sum, t) => sum + (Number(t.cnt) || 0), 0);
    const expectedPct = totalLeads > 0
        ? Math.round((convCnt / totalLeads) * 10000) / 100
        : computeConversionPct(funnel.transitions, { conversion_target: funnel.conversion_target }, 0);

    assert(Math.abs(funnel.conversion_pct - expectedPct) < 0.02,
        `conversion_pct esperaba ~${expectedPct}, obtuvo ${funnel.conversion_pct}`);

    const kpiConv = (data.kpis || []).find((k) => k.label === 'Conversion global');
    if (kpiConv) {
        assert(kpiConv.value === `${funnel.conversion_pct}%`,
            `KPI Conversion global debe ser ${funnel.conversion_pct}%, obtuvo ${kpiConv.value}`);
    }

    assert(Array.isArray(funnel.feeders) && funnel.feeders.length > 0,
        'funnel.feeders debe recalcularse desde transiciones');

    const feederCntSum = funnel.feeders.reduce((sum, f) => sum + (Number(f.cnt) || 0), 0);
    assert(feederCntSum >= convCnt - 1,
        `feeders deben sumar ~${convCnt} consultas, obtuvo ${feederCntSum}`);

    assert(funnel.leaks[0].cnt >= (funnel.leaks[1]?.cnt || 0),
        'leaks deben ordenarse por cnt descendente');

    assert(funnel.total_revenue_at_risk > 0,
        'funnel.total_revenue_at_risk debe ser > 0');

    const fcr = derived.first_contact_rate;
    assert(fcr != null && fcr >= 0 && fcr <= 1,
        `operations.derived.first_contact_rate debe estar entre 0 y 1, obtuvo ${fcr}`);

    assert(economics.revenue_estimated > 0,
        'derived.economics.revenue_estimated debe ser > 0');

    fs.writeFileSync(ENRICHED_OUT, JSON.stringify(data, null, 2), 'utf-8');

    console.log('OK — Fase 1 enrichment validado');
    console.log('  absorption_probabilities:', funnel.absorption_probabilities.length);
    console.log('  leaks:', funnel.leaks.length);
    console.log('  trap_states:', (funnel.trap_states || []).length);
    console.log('  conversion_pct:', funnel.conversion_pct, `(esperado ~${expectedPct})`);
    console.log('  total_revenue_at_risk:', funnel.total_revenue_at_risk);
    console.log('  first_contact_rate:', derived.first_contact_rate);
    console.log('  roas_proxy:', economics.roas_proxy);
    console.log('  Escrito:', ENRICHED_OUT);
}

try {
    main();
    process.exit(0);
} catch (err) {
    console.error('FALLO —', err.message);
    process.exit(1);
}
