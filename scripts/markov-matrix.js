/**
 * Shared Markov chain utilities for funnel enrichment.
 */

function matInv(A) {
    const n = A.length;
    const M = A.map((row, i) => [
        ...row.map((v) => Number(v) || 0),
        ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    ]);

    for (let col = 0; col < n; col++) {
        let pivot = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
        }
        if (Math.abs(M[pivot][col]) < 1e-12) return null;
        [M[col], M[pivot]] = [M[pivot], M[col]];

        const div = M[col][col];
        for (let j = 0; j < 2 * n; j++) M[col][j] /= div;

        for (let row = 0; row < n; row++) {
            if (row === col) continue;
            const factor = M[row][col];
            for (let j = 0; j < 2 * n; j++) M[row][j] -= factor * M[col][j];
        }
    }

    return M.map((row) => row.slice(n));
}

function matMul(A, B) {
    const rows = A.length;
    const cols = B[0].length;
    const inner = B.length;
    const out = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (let i = 0; i < rows; i++) {
        for (let k = 0; k < inner; k++) {
            const aik = A[i][k];
            if (!aik) continue;
            for (let j = 0; j < cols; j++) out[i][j] += aik * B[k][j];
        }
    }
    return out;
}

function matVecMul(A, vec) {
    return A.map((row) => row.reduce((sum, val, idx) => sum + val * vec[idx], 0));
}

function normalizeStateKey(state) {
    return String(state || '')
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/ +/g, ' ')
        .trim();
}

function isConversionState(state, conversionTarget = 'Consult Booked') {
    const sl = normalizeStateKey(state);
    const target = normalizeStateKey(conversionTarget);
    if (!sl || !target) return false;
    if (sl === target) return true;
    if (sl.includes('consult booked') || target.includes('consult booked')) {
        return sl.includes('consult booked');
    }
    return sl.includes(target) || target.includes(sl);
}

function isLossState(state, conversionTarget = 'Consult Booked') {
    if (isConversionState(state, conversionTarget)) return false;
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

function isAbsorbingState(state, conversionTarget = 'Consult Booked') {
    const sl = normalizeStateKey(state);
    if (isConversionState(state, conversionTarget)) return true;
    if (isLossState(state, conversionTarget)) return true;
    const absorbing = new Set(['won', 'closed lost', 'no show', 'disqualified', 'cancelled', 'absorption']);
    return absorbing.has(sl);
}

function buildTransitionMatrix(transitions, options = {}) {
    const conversionTarget = options.conversionTarget || 'Consult Booked';
    const byFrom = {};

    (transitions || []).forEach((t) => {
        const from = t.from || '';
        if (!byFrom[from]) byFrom[from] = [];
        byFrom[from].push({
            to: t.to || '',
            pct: Number(t.pct) || 0,
            cnt: Number(t.cnt) || 0,
        });
    });

    const allStates = [...new Set([
        ...Object.keys(byFrom),
        ...(transitions || []).map((t) => t.to).filter(Boolean),
    ])];

    const conversionAbsorbing = [];
    const lossAbsorbing = [];
    const transitoryNames = [];

    allStates.forEach((state) => {
        if (isConversionState(state, conversionTarget)) {
            if (!conversionAbsorbing.includes(state)) conversionAbsorbing.push(state);
        } else if (isAbsorbingState(state, conversionTarget)) {
            if (!lossAbsorbing.includes(state)) lossAbsorbing.push(state);
        } else {
            transitoryNames.push(state);
        }
    });

    const absorbingNames = [...conversionAbsorbing, ...lossAbsorbing];
    if (!transitoryNames.length || !absorbingNames.length) return null;

    const tN = transitoryNames.length;
    const aN = absorbingNames.length;
    const Q = Array.from({ length: tN }, () => Array(tN).fill(0));
    const R = Array.from({ length: tN }, () => Array(aN).fill(0));

    transitoryNames.forEach((from, fi) => {
        const trans = byFrom[from] || [];
        const totalPct = trans.reduce((sum, t) => sum + t.pct, 0);
        trans.forEach((t) => {
            const tiIdx = transitoryNames.indexOf(t.to);
            const aiIdx = absorbingNames.indexOf(t.to);
            if (tiIdx >= 0) Q[fi][tiIdx] = totalPct > 0 ? t.pct / totalPct : 0;
            if (aiIdx >= 0) R[fi][aiIdx] = totalPct > 0 ? t.pct / totalPct : 0;
        });
    });

    const ImQ = Array.from({ length: tN }, (_, i) =>
        Array.from({ length: tN }, (_, j) => (i === j ? 1 : 0) - Q[i][j]));
    const N = matInv(ImQ);
    if (!N) return null;

    const B = matMul(N, R);
    const ones = Array(tN).fill(1);
    const expSteps = matVecMul(N, ones);

    const conversionIndices = conversionAbsorbing.map((s) => absorbingNames.indexOf(s)).filter((i) => i >= 0);
    const lossIndices = lossAbsorbing.map((s) => absorbingNames.indexOf(s)).filter((i) => i >= 0);

    const stddevByState = {};
    transitoryNames.forEach((state, i) => {
        let secondMoment = 0;
        for (let j = 0; j < tN; j++) {
            secondMoment += N[i][j] * (2 * expSteps[j] - 1);
        }
        const variance = Math.max(0, secondMoment - Math.pow(expSteps[i], 2));
        stddevByState[state] = {
            step_variance: Math.round(variance * 100) / 100,
            step_stddev: Math.round(Math.sqrt(variance) * 100) / 100,
        };
    });

    return {
        byFrom,
        allStates,
        transitoryNames,
        conversionAbsorbing,
        lossAbsorbing,
        absorbingNames,
        Q,
        R,
        N,
        B,
        expSteps,
        stddevByState,
        conversionIndices,
        lossIndices,
    };
}

function buildStddevByState(transitions, options = {}) {
    const matrix = buildTransitionMatrix(transitions, options);
    return matrix ? matrix.stddevByState : null;
}

module.exports = {
    matInv,
    matMul,
    matVecMul,
    normalizeStateKey,
    isConversionState,
    isLossState,
    isAbsorbingState,
    buildTransitionMatrix,
    buildStddevByState,
};
