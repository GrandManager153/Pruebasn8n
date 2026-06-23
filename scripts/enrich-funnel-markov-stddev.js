/**
 * Recalcula step_stddev en absorption_probabilities cuando el pipeline n8n
 * deja varianza en 0 (fórmula incorrecta: usa N[j][j] en lugar de 2*t[j]-1).
 */

const { buildStddevByState } = require('./markov-matrix');

function computeMarkovAnalysis(transitions) {
    const byFrom = {};
    transitions.forEach((t) => {
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
        ...transitions.map((t) => t.to).filter(Boolean),
    ])];

    const absorbingNames = [];
    const transitoryNames = [];
    allStates.forEach((state) => {
        if (isAbsorbingState(state)) absorbingNames.push(state);
        else transitoryNames.push(state);
    });

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

    const convAbsIdx = absorbingNames.findIndex((s) =>
        s.toLowerCase().includes('consult booked') || s.toLowerCase().includes('won')
    );

    const absorption_probabilities = transitoryNames.map((s, i) => {
        const prob_conversion = convAbsIdx >= 0 ? Math.round(B[i][convAbsIdx] * 10000) / 10000 : 0;
        const prob_loss = convAbsIdx >= 0 ? Math.round((1 - B[i][convAbsIdx]) * 10000) / 10000 : 1;

        let secondMoment = 0;
        for (let j = 0; j < tN; j++) {
            secondMoment += N[i][j] * (2 * expSteps[j] - 1);
        }
        const variance = Math.max(0, secondMoment - Math.pow(expSteps[i], 2));

        return {
            state: s,
            prob_conversion,
            prob_loss,
            expected_steps: Math.round(expSteps[i] * 100) / 100,
            step_variance: Math.round(variance * 100) / 100,
            step_stddev: Math.round(Math.sqrt(variance) * 100) / 100,
        };
    });

    return absorption_probabilities;
}

function enrichFunnelMarkovStddev(data) {
    const funnel = data?.funnel;
    if (!funnel) return data;

    const transitions = funnel.transitions;
    if (!Array.isArray(transitions) || !transitions.length) {
        return data;
    }

    let absorption = funnel.absorption_probabilities;
    if (!Array.isArray(absorption) || !absorption.length) {
        const computed = computeMarkovAnalysis(transitions);
        if (computed) {
            funnel.absorption_probabilities = computed;
            console.log(`  📊 Markov chain recalculado en el backend: ${computed.length} estados transitorios.`);
        }
        return data;
    }

    const hasStddev = absorption.some((row) => Number(row.step_stddev) > 0);
    if (hasStddev) return data;

    const conversionTarget = funnel.conversion_target || data?.meta?.config?.conversion_target || 'Consult Booked';
    const stddevByState = buildStddevByState(transitions, { conversionTarget });
    if (!stddevByState) return data;

    absorption.forEach((row) => {
        const metrics = stddevByState[row.state];
        if (!metrics) return;
        row.step_variance = metrics.step_variance;
        row.step_stddev = metrics.step_stddev;
    });

    return data;
}

module.exports = {
    computeMarkovAnalysis,
    enrichFunnelMarkovStddev,
};
