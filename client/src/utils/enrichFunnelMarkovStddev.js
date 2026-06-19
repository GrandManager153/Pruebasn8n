/**
 * Recalcula step_stddev en absorption_probabilities cuando el pipeline n8n
 * deja varianza en 0 (fórmula incorrecta: usa N[j][j] en lugar de 2*t[j]-1).
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

function matVecMul(A, vec) {
  return A.map((row) => row.reduce((sum, val, idx) => sum + val * vec[idx], 0));
}

function isAbsorbingState(state) {
  const sl = String(state || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/ +/g, ' ').trim();
  const absorbing = new Set(['consult booked', 'won', 'closed lost', 'no show', 'disqualified', 'cancelled']);
  return absorbing.has(sl);
}

function buildMarkovFromTransitions(transitions) {
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

  const ones = Array(tN).fill(1);
  const expSteps = matVecMul(N, ones);
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

  return stddevByState;
}

export function enrichFunnelMarkovStddev(data) {
  const funnel = data?.funnel;
  const absorption = funnel?.absorption_probabilities;
  const transitions = funnel?.transitions;
  if (!Array.isArray(absorption) || !absorption.length || !Array.isArray(transitions) || !transitions.length) {
    return data;
  }

  const hasStddev = absorption.some((row) => Number(row.step_stddev) > 0);
  if (hasStddev) return data;

  const stddevByState = buildMarkovFromTransitions(transitions);
  if (!stddevByState) return data;

  absorption.forEach((row) => {
    const metrics = stddevByState[row.state];
    if (!metrics) return;
    row.step_variance = metrics.step_variance;
    row.step_stddev = metrics.step_stddev;
  });

  return data;
}
