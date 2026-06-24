const assert = require('assert');
const { resolveForecastTarget } = require('./forecast-target');

function makePayload(lastDate, generatedAt) {
  return {
    meta: { generated_at: generatedAt },
    forecast: {
      time_series: [{ date: lastDate, value: 100 }],
      next_point: { date: addOneDay(lastDate), forecast: 110 },
    },
  };
}

function addOneDay(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  OK ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL ${name}: ${err.message}`);
  }
}

console.log('forecast-target tests\n');

test('intradía: último día 23, ejecución 24 → Hoy', () => {
  const t = resolveForecastTarget(makePayload('2026-05-23', '2026-05-24T10:00:00-06:00'));
  assert.strictEqual(t.horizon_offset, 0);
  assert.strictEqual(t.label_short, 'Hoy');
  assert.strictEqual(t.label_card, 'Pronóstico de hoy');
  assert.strictEqual(t.target_date, '2026-05-24');
});

test('post-cierre: último día 24, ejecución 24 → Mañana', () => {
  const t = resolveForecastTarget(makePayload('2026-05-24', '2026-05-24T22:00:00-06:00'));
  assert.strictEqual(t.horizon_offset, 1);
  assert.strictEqual(t.label_short, 'Mañana');
  assert.strictEqual(t.label_card, 'Pronóstico de mañana');
  assert.strictEqual(t.target_date, '2026-05-25');
});

test('fecha explícita: último día 20, ejecución 24 → etiqueta con fecha', () => {
  const t = resolveForecastTarget(makePayload('2026-05-20', '2026-05-24T10:00:00-06:00'));
  assert.notStrictEqual(t.horizon_offset, 0);
  assert.notStrictEqual(t.horizon_offset, 1);
  assert.ok(t.label_card.startsWith('Pronóstico '));
  assert.strictEqual(t.target_date, '2026-05-21');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
