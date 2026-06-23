/**
 * Valida pipeline Fase 2: Little's Law + historial/compare.
 */
const fs = require('fs');
const path = require('path');
const { enrichLittlesLaw } = require('./enrich-littles-law');
const {
    buildHistoryEntry,
    compareWithPrevious,
    seedHistoryEntries,
    compareAlertFingerprints,
} = require('./history-store');

const SAMPLE_PATH = path.join(__dirname, '..', 'data', 'dashboard_payload.sample.enriched.json');
const DATA_DIR = path.join(__dirname, '..', 'data');
const TEST_HISTORY_DIR = path.join(DATA_DIR, 'history-test');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function buildSyntheticEntries(base) {
    const entries = [];
    for (let i = 0; i < 3; i++) {
        const clone = JSON.parse(JSON.stringify(base));
        const date = new Date();
        date.setDate(date.getDate() - (2 - i));
        clone.meta.execution_id = `exec_test_${i}`;
        clone.meta.generated_at = date.toISOString();
        clone.system.health_score = 70 + i * 5;
        const entry = buildHistoryEntry(clone);
        entry.alert_fingerprints = i < 2
            ? ['overcontact_pct', 'call_rank_avg']
            : ['overcontact_pct', 'avg_interval_min'];
        entries.push(entry);
    }
    return entries;
}

function main() {
    console.log('Validando Fase 2...');

    if (!fs.existsSync(SAMPLE_PATH)) {
        throw new Error(`Falta ${SAMPLE_PATH} — ejecuta npm run validate:phase1`);
    }

    const payload = JSON.parse(fs.readFileSync(SAMPLE_PATH, 'utf-8'));
    enrichLittlesLaw(payload);

    assert(payload.operations?.littles_law?.available === true,
        'operations.littles_law.available debe ser true');
    assert(payload.operations.littles_law.arrival_rate_per_hour > 0,
        'arrival_rate_per_hour debe ser > 0');

    if (fs.existsSync(TEST_HISTORY_DIR)) {
        fs.rmSync(TEST_HISTORY_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_HISTORY_DIR, { recursive: true });

    const entries = buildSyntheticEntries(payload);
    seedHistoryEntries(entries, TEST_HISTORY_DIR);

    const current = JSON.parse(JSON.stringify(payload));
    current.meta.execution_id = 'exec_test_current';
    current.system.health_score = 79;

    const compare = compareWithPrevious(current, TEST_HISTORY_DIR);
    assert(compare.available === true, 'compare debe estar available con 3+ entradas');
    assert(compare.deltas?.health_score != null, 'delta health_score requerido');

    const diff = compareAlertFingerprints(
        { alert_fingerprints: ['overcontact_pct', 'avg_interval_min'] },
        { alert_fingerprints: ['overcontact_pct', 'call_rank_avg'] }
    );
    assert(diff.recurrent.includes('overcontact_pct'), 'debe detectar alerta recurrente');
    assert(diff.new.includes('avg_interval_min'), 'debe detectar alerta nueva');

    fs.rmSync(TEST_HISTORY_DIR, { recursive: true, force: true });

    console.log('OK — Fase 2 validada');
    console.log('  littles_law.available:', payload.operations.littles_law.available);
    console.log('  arrival_rate_per_hour:', payload.operations.littles_law.arrival_rate_per_hour);
    console.log('  compare.available:', compare.available);
}

try {
    main();
    process.exit(0);
} catch (err) {
    console.error('FALLO —', err.message);
    process.exit(1);
}
