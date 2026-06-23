/**
 * Historial ligero de ejecuciones (índice en disco, sin BD).
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_MAX_ENTRIES = 90;

function getHistoryDir(dataDir) {
    return path.join(dataDir, 'history');
}

function getIndexPath(dataDir) {
    return path.join(getHistoryDir(dataDir), 'index.json');
}

function getMaxEntries() {
    const env = Number(process.env.HISTORY_MAX_ENTRIES);
    return Number.isFinite(env) && env > 0 ? env : DEFAULT_MAX_ENTRIES;
}

function ensureHistoryDir(dataDir) {
    const dir = getHistoryDir(dataDir);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

function readIndex(dataDir) {
    const indexPath = getIndexPath(dataDir);
    if (!fs.existsSync(indexPath)) {
        return { entries: [], updated_at: null };
    }
    try {
        const raw = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        if (Array.isArray(raw)) {
            return { entries: raw, updated_at: null };
        }
        return {
            entries: Array.isArray(raw.entries) ? raw.entries : [],
            updated_at: raw.updated_at || null,
        };
    } catch {
        return { entries: [], updated_at: null };
    }
}

function writeIndex(dataDir, entries) {
    ensureHistoryDir(dataDir);
    const indexPath = getIndexPath(dataDir);
    const payload = {
        updated_at: new Date().toISOString(),
        entries: entries.slice(-getMaxEntries()),
    };
    fs.writeFileSync(indexPath, JSON.stringify(payload, null, 2), 'utf-8');
    return payload.entries;
}

function alertFingerprint(alert) {
    return String(alert?.metric || alert?.id || alert?.title || '').trim();
}

function extractMase(payload) {
    const rf = payload?.forecast_rf;
    const fc = payload?.forecast;
    if (rf?.mase != null && rf.available !== false) return Number(rf.mase);
    if (fc?.mase != null) return Number(fc.mase);
    if (Array.isArray(fc?.backtest_models) && fc.backtest_models.length) {
        const best = fc.backtest_models.reduce((a, b) => (
            (a.mase != null && (b.mase == null || a.mase < b.mase)) ? a : b
        ));
        if (best?.mase != null) return Number(best.mase);
    }
    return null;
}

function extractForecastValue(payload) {
    const fc = payload?.forecast;
    const rf = payload?.forecast_rf;
    if (fc?.recommended_value != null) return Number(fc.recommended_value);
    if (rf?.available !== false && rf?.recommended_value != null) return Number(rf.recommended_value);
    return null;
}

function buildHistoryEntry(payload) {
    const meta = payload?.meta || {};
    const sys = payload?.system || {};
    const ops = payload?.operations || {};
    const inv = payload?.investment || {};
    const alerts = Array.isArray(sys.alerts) ? sys.alerts : [];

    const counts = { critical: 0, warning: 0, info: 0 };
    alerts.forEach((a) => {
        const s = a.severity || 'info';
        if (counts[s] !== undefined) counts[s] += 1;
    });

    const fingerprints = [...new Set(
        alerts.map(alertFingerprint).filter(Boolean)
    )];

    return {
        execution_id: meta.execution_id || `exec_${Date.now()}`,
        generated_at: meta.generated_at || new Date().toISOString(),
        health_score: Number(sys.health_score) || 0,
        status_label: sys.status?.label || '',
        alert_counts: counts,
        alert_fingerprints: fingerprints,
        metrics: {
            total_leads: Number(ops.total_leads) || 0,
            avg_daily: Number(ops.avg_daily) || 0,
            wow_change_pct: Number(ops.wow_change_pct) || 0,
            overcontact_pct: Number(ops.contact_distribution?.overcontact_pct) || 0,
            conversion_pct: Number(payload?.funnel?.conversion_pct ?? payload?.funnel?.global_conversion_pct) || null,
            global_cpl: Number(inv.cpl?.global_cpl) || null,
            total_spend: Number(inv.total_spend) || 0,
            mase: extractMase(payload),
            roas_proxy: payload?.derived?.economics?.roas_proxy != null
                ? Number(payload.derived.economics.roas_proxy)
                : null,
            forecast_value: extractForecastValue(payload),
        },
    };
}

function appendHistoryEntry(payload, dataDir) {
    const entry = buildHistoryEntry(payload);
    const { entries } = readIndex(dataDir);

    if (entries.some((e) => e.execution_id === entry.execution_id)) {
        return { appended: false, entry, entries };
    }

    entries.push(entry);
    const saved = writeIndex(dataDir, entries);
    return { appended: true, entry, entries: saved };
}

function loadHistoryIndex(dataDir, limit = getMaxEntries()) {
    const { entries } = readIndex(dataDir);
    return entries.slice(-limit);
}

function buildShsSparkline(entries) {
    return (entries || []).map((e) => {
        const d = e.generated_at ? String(e.generated_at).slice(0, 10) : '';
        return {
            date: d,
            shs: Number(e.health_score) || 0,
            execution_id: e.execution_id,
        };
    });
}

function deltaDirection(delta, invert = false) {
    if (delta == null || !Number.isFinite(delta) || delta === 0) return 'flat';
    const up = delta > 0;
    if (invert) return up ? 'down' : 'up';
    return up ? 'up' : 'down';
}

function buildDelta(current, previous, invert = false) {
    const cur = current != null ? Number(current) : null;
    const prev = previous != null ? Number(previous) : null;
    if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev)) {
        return null;
    }
    const delta = Math.round((cur - prev) * 1000) / 1000;
    return {
        current: cur,
        previous: prev,
        delta,
        direction: deltaDirection(delta, invert),
    };
}

function compareAlertFingerprints(currentEntry, previousEntry) {
    const current = new Set(currentEntry?.alert_fingerprints || []);
    const previous = new Set(previousEntry?.alert_fingerprints || []);

    const newAlerts = [...current].filter((f) => !previous.has(f));
    const recurrent = [...current].filter((f) => previous.has(f));
    const resolved = [...previous].filter((f) => !current.has(f));

    return { new: newAlerts, recurrent, resolved };
}

function findPreviousEntry(entries, currentExecutionId) {
    if (!entries.length) return null;
    const idx = entries.findIndex((e) => e.execution_id === currentExecutionId);
    if (idx > 0) return entries[idx - 1];
    if (idx === 0) return null;
  // Current run not yet in index — compare against the latest saved execution
    return entries[entries.length - 1];
}

function compareWithPrevious(currentPayload, dataDir) {
    const entries = loadHistoryIndex(dataDir);
    const currentEntry = buildHistoryEntry(currentPayload);
    const previous = findPreviousEntry(entries, currentEntry.execution_id)
        || (entries.length >= 2 ? entries[entries.length - 2] : null);

    if (!previous) {
        return {
            available: false,
            reason: 'no_previous_entry',
            alert_diff: { new: [], recurrent: [], resolved: [] },
        };
    }

    const cm = currentEntry.metrics;
    const pm = previous.metrics;

    const deltas = {
        health_score: buildDelta(currentEntry.health_score, previous.health_score),
        total_leads: buildDelta(cm.total_leads, pm.total_leads),
        overcontact_pct: buildDelta(cm.overcontact_pct, pm.overcontact_pct, true),
        conversion_pct: buildDelta(cm.conversion_pct, pm.conversion_pct),
        global_cpl: buildDelta(cm.global_cpl, pm.global_cpl, true),
        mase: buildDelta(cm.mase, pm.mase, true),
        roas_proxy: buildDelta(cm.roas_proxy, pm.roas_proxy),
    };

    const alert_diff = compareAlertFingerprints(currentEntry, previous);

    return {
        available: true,
        previous_generated_at: previous.generated_at,
        previous_execution_id: previous.execution_id,
        deltas,
        alerts: alert_diff,
        alert_diff,
    };
}

function buildHistoryResponse(currentPayload, dataDir) {
    const entries = loadHistoryIndex(dataDir);
    const compare = compareWithPrevious(currentPayload, dataDir);
    const sparkline = buildShsSparkline(entries);

    return {
        available: entries.length > 0,
        entry_count: entries.length,
        sparkline,
        compare: {
            available: compare.available,
            previous_generated_at: compare.previous_generated_at || null,
            previous_execution_id: compare.previous_execution_id || null,
            deltas: compare.deltas || {},
            alerts: compare.alerts || { new: [], recurrent: [], resolved: [] },
        },
    };
}

function seedHistoryEntries(entries, dataDir) {
    ensureHistoryDir(dataDir);
    writeIndex(dataDir, entries);
    return entries;
}

module.exports = {
    buildHistoryEntry,
    appendHistoryEntry,
    loadHistoryIndex,
    buildShsSparkline,
    compareWithPrevious,
    compareAlertFingerprints,
    buildHistoryResponse,
    seedHistoryEntries,
    readIndex,
    getHistoryDir,
};
