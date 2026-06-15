import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPerformanceMetrics,
  buildScoringAverages,
  computeAverage,
  computePercentage,
} from './analytics';

test('computePercentage returns 0 when denominator is 0', () => {
  assert.equal(computePercentage(3, 0), 0);
});

test('computePercentage rounds to one decimal place', () => {
  assert.equal(computePercentage(7, 12), 58.3);
});

test('computeAverage returns 0 when count is 0', () => {
  assert.equal(computeAverage(10, 0), 0);
});

test('computeAverage rounds to two decimals', () => {
  assert.equal(computeAverage(83, 7), 11.86);
});

test('buildPerformanceMetrics computes GIR/FIR/putts/penalties', () => {
  const metrics = buildPerformanceMetrics({
    total_holes: '36',
    gir_holes: '22',
    fir_opportunities: '26',
    fir_hits: '15',
    total_putts: '61',
    total_penalties: '8',
    rounds_played: '2',
  });

  assert.deepEqual(metrics, {
    girPercentage: 61.1,
    firPercentage: 57.7,
    averagePutts: 30.5,
    averagePenalties: 4,
  });
});

test('buildPerformanceMetrics returns zeroed metrics for empty input', () => {
  assert.deepEqual(buildPerformanceMetrics(null), {
    girPercentage: 0,
    firPercentage: 0,
    averagePutts: 0,
    averagePenalties: 0,
  });
});

test('buildScoringAverages maps values to optional numbers', () => {
  const averages = buildScoringAverages({
    front9_average: '38.25',
    back9_average: '40.50',
    overall_average: '78.75',
  });

  assert.deepEqual(averages, {
    front9: 38.25,
    back9: 40.5,
    overall: 78.75,
  });
});

test('buildScoringAverages returns nulls for missing input', () => {
  assert.deepEqual(buildScoringAverages(undefined), {
    front9: null,
    back9: null,
    overall: null,
  });
});
