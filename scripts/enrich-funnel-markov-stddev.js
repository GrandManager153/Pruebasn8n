/**
 * Recalcula step_stddev en absorption_probabilities cuando el pipeline n8n
 * deja varianza en 0 (fórmula incorrecta: usa N[j][j] en lugar de 2*t[j]-1).
 */

const { buildStddevByState } = require('./markov-matrix');

function enrichFunnelMarkovStddev(data) {
    const funnel = data?.funnel;
    const absorption = funnel?.absorption_probabilities;
    const transitions = funnel?.transitions;
    if (!Array.isArray(absorption) || !absorption.length || !Array.isArray(transitions) || !transitions.length) {
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
    enrichFunnelMarkovStddev,
};
