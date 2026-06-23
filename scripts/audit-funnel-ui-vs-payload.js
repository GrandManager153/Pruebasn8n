/**
 * Verifica que los valores que renderiza la UI del embudo coincidan
 * con el payload tras el pipeline servidor + cliente.
 *
 * Uso: node scripts/audit-funnel-ui-vs-payload.js [ruta-json]
 */

const fs = require('fs');
const path = require('path');
const {
    enrichFunnelFromTransitions,
    computeConversionPct,
} = require('./enrich-funnel-from-transitions');
const { enrichFunnelMarkovStddev } = require('./enrich-funnel-markov-stddev');
const { isConversionState } = require('./markov-matrix');

const DEFAULT_PATH = path.join(__dirname, '..', 'data', 'dashboard_payload.sample.json');

function applyServerEnrichment(data) {
    enrichFunnelFromTransitions(data);
    enrichFunnelMarkovStddev(data);
    return data;
}

function isResidualMarkovState(rawState) {
    const raw = String(rawState || '').trim();
    return raw.toLowerCase() === 'abierto';
}

function filterVisibleMarkovRows(rows) {
    return (rows || []).filter((row) => !isResidualMarkovState(row.rawState ?? row.state));
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
    return [];
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
    return [];
}

function resolveFunnelRevenueAtRisk(data) {
    const funnel = data?.funnel;
    if (!funnel) return null;
    const fromPayload = funnel.total_revenue_at_risk;
    if (fromPayload != null && Number.isFinite(Number(fromPayload))) {
        return Number(fromPayload);
    }
    return null;
}

function ensureFunnelDerivedMetrics(data) {
    if (!data?.funnel) return data;
    const funnel = data.funnel;
    if (!Array.isArray(funnel.leaks) || !funnel.leaks.length) {
        funnel.leaks = resolveFunnelLeaks(data);
    }
    return data;
}

function resolveFunnelMarkovStates(data) {
    const absorption = data?.funnel?.absorption_probabilities;
    if (!Array.isArray(absorption) || !absorption.length) return [];
    return filterVisibleMarkovRows(
        absorption
            .map((ap) => ({
                rawState: ap.state || '',
                conversion: (ap.prob_conversion || 0) * 100,
            }))
            .filter((p) => p.conversion > 0)
            .sort((a, b) => b.conversion - a.conversion)
    );
}

function uiConversionRate(data) {
    const f = data.funnel;
    if (f?.conversion_pct != null) return Number(f.conversion_pct).toFixed(2);
    if (f?.global_conversion_pct != null) return Number(f.global_conversion_pct).toFixed(2);
    return '—';
}

function expectedConversionFromTotalLeads(data) {
    const funnel = data.funnel || {};
    const totalLeads = Number(data.operations?.total_leads) || 0;
    const target = funnel.conversion_target || 'Consult Booked';
    const convCnt = (funnel.transitions || [])
        .filter((t) => isConversionState(t.to, target))
        .reduce((sum, t) => sum + (Number(t.cnt) || 0), 0);
    if (totalLeads > 0) return Math.round((convCnt / totalLeads) * 10000) / 100;
    return computeConversionPct(funnel.transitions, { conversion_target: target }, 0);
}

function check(name, ok, detail) {
    return { name, ok, detail };
}

function main() {
    const inputPath = process.argv[2] || DEFAULT_PATH;
    console.log('Auditoría UI embudo vs payload');
    console.log('Archivo:', inputPath);
    console.log('');

    const rawOnDisk = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const afterServer = applyServerEnrichment(JSON.parse(JSON.stringify(rawOnDisk)));
    const afterClient = JSON.parse(JSON.stringify(afterServer));
    ensureFunnelDerivedMetrics(afterClient);
    enrichFunnelMarkovStddev(afterClient);

    const results = [];
    const fServer = afterServer.funnel || {};
    const fClient = afterClient.funnel || {};
    const expectedConv = expectedConversionFromTotalLeads(afterServer);

    const uiConv = uiConversionRate(afterClient);
    const payloadConv = Number(fServer.conversion_pct).toFixed(2);
    results.push(check(
        'KPI Tasa de conversión',
        uiConv === payloadConv,
        `UI: ${uiConv}% | payload: ${payloadConv}% | esperado total_leads: ${expectedConv}%`
    ));

    results.push(check(
        'Conversión usa total_leads (no Markov)',
        Math.abs(Number(payloadConv) - expectedConv) < 0.02,
        `payload ${payloadConv}% vs fórmula total_leads ${expectedConv}%`
    ));

    const kpiConv = (afterServer.kpis || []).find((k) => k.label === 'Conversion global');
    results.push(check(
        'KPI Conversion global sincronizado',
        !kpiConv || kpiConv.value === `${fServer.conversion_pct}%`,
        kpiConv ? `KPI: ${kpiConv.value}` : 'Sin KPI Conversion global en payload'
    ));

    const uiRisk = resolveFunnelRevenueAtRisk(afterClient);
    results.push(check(
        'KPI Ingreso en riesgo',
        uiRisk === fClient.total_revenue_at_risk,
        `UI: $${Number(uiRisk).toLocaleString('es-MX')} | payload: $${Number(fClient.total_revenue_at_risk).toLocaleString('es-MX')}`
    ));

    const uiFeeders = resolveFunnelFeeders(afterClient);
    const payloadFeeders = (fClient.feeders || []).slice().sort((a, b) => b.cnt - a.cnt);
    const feedersMatch = uiFeeders.length === payloadFeeders.length
        && uiFeeders.every((row, i) => {
            const p = payloadFeeders[i];
            return row.from === p.from && row.pct === Number(p.pct) && row.cnt === Number(p.cnt);
        });
    results.push(check(
        'Feeders (orden por cnt)',
        feedersMatch,
        `top: ${uiFeeders[0]?.from} — ${uiFeeders[0]?.cnt} consultas`
    ));

    const uiLeaks = resolveFunnelLeaks(afterClient);
    const payloadLeaks = (fClient.leaks || []).slice().sort((a, b) => b.cnt - a.cnt);
    const leaksMatch = uiLeaks.length === payloadLeaks.length
        && uiLeaks.every((row, i) => {
            const p = payloadLeaks[i];
            return row.from === p.from && row.to === p.to && row.pct === Number(p.pct) && row.cnt === Number(p.cnt);
        });
    results.push(check(
        'Leaks (orden por cnt)',
        leaksMatch,
        `top: ${uiLeaks[0]?.from} → ${uiLeaks[0]?.to} (${uiLeaks[0]?.cnt} leads)`
    ));

    const rawFunnel = rawOnDisk.funnel || {};
    if (rawFunnel.conversion_pct != null && Math.abs(rawFunnel.conversion_pct - fServer.conversion_pct) > 0.5) {
        results.push(check(
            'markov_entry_conversion_pct preservado',
            fServer.markov_entry_conversion_pct != null,
            `n8n envió ${rawFunnel.conversion_pct}% → recalculado ${fServer.conversion_pct}% | markov guardado: ${fServer.markov_entry_conversion_pct}`
        ));
    }

    console.log('=== COINCIDENCIA UI ↔ PAYLOAD ===');
    let failed = 0;
    results.forEach((r) => {
        const icon = r.ok ? 'OK' : 'FALLO';
        if (!r.ok) failed++;
        console.log(`[${icon}] ${r.name}`);
        console.log(`       ${r.detail}`);
    });

    console.log('');
    if (failed === 0) {
        console.log('RESULTADO: OK');
    } else {
        console.log(`RESULTADO: ${failed} fallo(s)`);
        process.exit(1);
    }
}

main();
