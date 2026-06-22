/**
 * Genera historial sintético para desarrollo (sparkline / compare sin n8n).
 */
const fs = require('fs');
const path = require('path');
const { seedHistoryEntries, buildHistoryEntry } = require('./history-store');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SAMPLE_PATH = path.join(DATA_DIR, 'dashboard_payload.sample.enriched.json');

function main() {
    if (!fs.existsSync(SAMPLE_PATH)) {
        console.error('Falta sample enriquecido:', SAMPLE_PATH);
        console.error('Ejecuta primero: npm run validate:phase1');
        process.exit(1);
    }

    const base = JSON.parse(fs.readFileSync(SAMPLE_PATH, 'utf-8'));
    const entries = [];
    const shsValues = [85, 82, 80, 78, 79, 81, 77];

    for (let i = 0; i < shsValues.length; i++) {
        const daysAgo = shsValues.length - 1 - i;
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);

        const clone = JSON.parse(JSON.stringify(base));
        clone.meta = clone.meta || {};
        clone.meta.execution_id = `exec_seed_${date.toISOString().slice(0, 10)}_${i}`;
        clone.meta.generated_at = date.toISOString();
        clone.system = clone.system || {};
        clone.system.health_score = shsValues[i];

        if (clone.system.alerts && clone.system.alerts[0]) {
            clone.system.alerts[0].metric = i % 2 === 0 ? 'overcontact_pct' : 'call_rank_avg';
        }

        const entry = buildHistoryEntry(clone);
        entry.health_score = shsValues[i];
        entry.generated_at = date.toISOString();
        entries.push(entry);
    }

    seedHistoryEntries(entries, DATA_DIR);
    console.log(`OK — ${entries.length} entradas en data/history/index.json`);
}

main();
