/**
 * Valida pipeline Fase 3: investment.derived (CPL proxy, HHI, alertas).
 */
const fs = require('fs');
const path = require('path');
const { enrichOperationsDerived } = require('./enrich-operations-derived');
const { enrichInvestmentDerived } = require('./enrich-investment-derived');

const SAMPLE_PATH = path.join(__dirname, '..', 'data', 'dashboard_payload.sample.json');
const ENRICHED_OUT = path.join(__dirname, '..', 'data', 'dashboard_payload.sample.enriched.json');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function main() {
    console.log('Validando Fase 3...');

    if (!fs.existsSync(SAMPLE_PATH)) {
        throw new Error(`Falta ${SAMPLE_PATH}`);
    }

    const data = JSON.parse(fs.readFileSync(SAMPLE_PATH, 'utf-8'));
    enrichOperationsDerived(data);
    enrichInvestmentDerived(data);

    const derived = data.investment?.derived;
    assert(derived != null, 'investment.derived requerido');
    assert(derived.concentration?.available === true, 'concentration.available debe ser true');
    assert(Array.isArray(derived.campaigns), 'derived.campaigns debe ser array');
    assert(
        derived.campaigns.length === (data.investment?.campaigns?.length || 0),
        'derived.campaigns.length debe coincidir con campaigns'
    );

    derived.campaigns.forEach((c, i) => {
        assert(c.cpl_proxy > 0, `campaña ${i}: cpl_proxy debe ser > 0`);
        assert(c.leads_allocated >= 1, `campaña ${i}: leads_allocated >= 1`);
    });

    assert(Array.isArray(derived.investment_alerts), 'investment_alerts debe ser array');
    derived.investment_alerts.forEach((a) => {
        const m = String(a.metric || a.id || '').toLowerCase();
        assert(
            m.includes('hhi') || m.includes('cpl'),
            `alerta ${m} no es de inversión`
        );
    });

    assert(derived.economics?.global_cpl != null, 'economics.global_cpl requerido');

    fs.writeFileSync(ENRICHED_OUT, JSON.stringify(data, null, 2), 'utf-8');

    console.log('OK — Fase 3 validada');
    console.log('  campaigns enriched:', derived.campaigns.length);
    console.log('  hhi:', derived.concentration.hhi);
    console.log('  top3_pct:', derived.concentration.top3_pct);
    console.log('  investment_alerts:', derived.investment_alerts.length);
}

try {
    main();
    process.exit(0);
} catch (err) {
    console.error('FALLO —', err.message);
    process.exit(1);
}
