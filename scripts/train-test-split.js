/**
 * Temporal train/test split for forecast evaluation (70/30, min 14 test days).
 */

const TRAIN_RATIO = 0.7;
const MIN_TEST_DAYS = 14;

function computeTrainTestSplit(n, timeSeries = null) {
  if (!n || n < MIN_TEST_DAYS + 1) {
    return null;
  }

  let trainCount = Math.floor(n * TRAIN_RATIO);
  let testCount = n - trainCount;

  if (testCount < MIN_TEST_DAYS) {
    trainCount = n - MIN_TEST_DAYS;
    testCount = MIN_TEST_DAYS;
  }

  if (trainCount < 1) {
    return null;
  }

  const splitIndex = trainCount;
  let splitDate = null;
  if (Array.isArray(timeSeries) && timeSeries[splitIndex]?.date) {
    splitDate = String(timeSeries[splitIndex].date).split('T')[0];
  }

  return {
    train_count: trainCount,
    test_count: testCount,
    split_index: splitIndex,
    split_date: splitDate,
    train_ratio: Math.round((trainCount / n) * 1000) / 1000,
    test_ratio: Math.round((testCount / n) * 1000) / 1000,
    min_test_days: MIN_TEST_DAYS,
    total_days: n,
  };
}

function testZoneCoverage(series, splitIndex) {
  if (!Array.isArray(series) || splitIndex == null) return 0;
  let count = 0;
  for (let i = splitIndex; i < series.length; i++) {
    if (series[i] != null && isFinite(series[i])) count++;
  }
  return count;
}

module.exports = {
  TRAIN_RATIO,
  MIN_TEST_DAYS,
  computeTrainTestSplit,
  testZoneCoverage,
};
