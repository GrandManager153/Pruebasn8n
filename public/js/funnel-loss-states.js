/**
 * Detección de estados de pérdida/fuga — alineado con scripts/markov-matrix.js
 */

function normalizeFunnelStateKey(state) {
    return String(state || '')
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/ +/g, ' ')
        .trim();
}

function isFunnelConversionState(state, conversionTarget) {
    const sl = normalizeFunnelStateKey(state);
    const target = normalizeFunnelStateKey(conversionTarget || 'Consult Booked');
    if (!sl || !target) return false;
    if (sl === target) return true;
    if (sl.includes('consult booked') || target.includes('consult booked')) {
        return sl.includes('consult booked');
    }
    return sl.includes(target) || target.includes(sl);
}

function isFunnelLossState(state, conversionTarget) {
    if (isFunnelConversionState(state, conversionTarget)) return false;
    const t = String(state || '').toLowerCase();
    return (
        t.includes('not interested')
        || t.includes('no answer')
        || t.includes('hung up')
        || t.includes('wrong number')
        || t.includes('busy')
        || t.includes('lost')
        || t.includes('voicemail')
        || t.includes('distrust')
        || t.includes('disqualified')
        || t.includes('cancelled')
        || t.includes('no show')
        || t.includes('duplicate')
        || t === 'won'
    );
}
