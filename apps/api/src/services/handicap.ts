export interface RoundDifferentialRow {
  id: string;
  played_at: string;
  score_differential: number;
  is_9_hole: boolean;
}

export interface EffectiveDifferential {
  value: number;
  playedAt: string;
  source: '18_hole' | 'paired_9_hole';
  roundIds: string[];
}

export interface HandicapSelectionResult {
  roundsConsidered: number;
  effectiveDifferentials: EffectiveDifferential[];
  countUsed: number;
  selected: EffectiveDifferential[];
  averageDifferential: number;
  multiplier: number;
  handicapIndex: number;
}

export interface CapApplicationResult {
  rawHandicapIndex: number;
  appliedHandicapIndex: number;
  lowHandicapIndex: number;
  updatedLowHandicapIndex: number;
  softCapTriggered: boolean;
  hardCapTriggered: boolean;
  softCapThreshold: number;
  hardCapThreshold: number;
}

export const MINIMUM_ELIGIBLE_HOLES = 54;

const WHS_COUNT_TABLE: Array<{ min: number; max: number; count: number }> = [
  { min: 3, max: 4, count: 1 },
  { min: 5, max: 6, count: 1 },
  { min: 7, max: 8, count: 2 },
  { min: 9, max: 11, count: 3 },
  { min: 12, max: 14, count: 4 },
  { min: 15, max: 16, count: 5 },
  { min: 17, max: 18, count: 6 },
  { min: 19, max: 19, count: 7 },
  { min: 20, max: 20, count: 8 },
];

function toThreeDecimals(value: number): number {
  return Number(value.toFixed(3));
}

function toOneDecimalTruncated(value: number): number {
  return Math.trunc(value * 10) / 10;
}

function getWhsCount(roundCount: number): number {
  const bounded = Math.max(0, Math.min(roundCount, 20));
  for (const row of WHS_COUNT_TABLE) {
    if (bounded >= row.min && bounded <= row.max) {
      return row.count;
    }
  }
  return 0;
}

export function buildEffectiveDifferentials(rounds: RoundDifferentialRow[]): EffectiveDifferential[] {
  const sorted = [...rounds].sort((a, b) => {
    const timeDiff = new Date(b.played_at).getTime() - new Date(a.played_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });

  const effective: EffectiveDifferential[] = [];
  let pendingNineHole: RoundDifferentialRow | null = null;

  for (const round of sorted) {
    if (!round.is_9_hole) {
      effective.push({
        value: toThreeDecimals(round.score_differential),
        playedAt: round.played_at,
        source: '18_hole',
        roundIds: [round.id],
      });
      continue;
    }

    if (!pendingNineHole) {
      pendingNineHole = round;
      continue;
    }

    effective.push({
      value: toThreeDecimals(pendingNineHole.score_differential + round.score_differential),
      playedAt: pendingNineHole.played_at,
      source: 'paired_9_hole',
      roundIds: [pendingNineHole.id, round.id],
    });
    pendingNineHole = null;
  }

  return effective.sort((a, b) => {
    const timeDiff = new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.roundIds.join(',').localeCompare(a.roundIds.join(','));
  });
}

export function calculateHandicapFromDifferentials(rounds: RoundDifferentialRow[]): HandicapSelectionResult | null {
  const effectiveDifferentials = buildEffectiveDifferentials(rounds);
  const roundsConsidered = effectiveDifferentials.length;
  const countUsed = getWhsCount(roundsConsidered);

  if (countUsed === 0) {
    return null;
  }

  const selected = [...effectiveDifferentials]
    .sort((a, b) => a.value - b.value)
    .slice(0, countUsed)
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());

  const averageDifferential = toThreeDecimals(selected.reduce((sum, item) => sum + item.value, 0) / selected.length);
  const multiplier = 0.96;
  const handicapIndex = toOneDecimalTruncated(averageDifferential * multiplier);

  return {
    roundsConsidered,
    effectiveDifferentials,
    countUsed,
    selected,
    averageDifferential,
    multiplier,
    handicapIndex,
  };
}

export function calculateEligibleHoles(rounds: RoundDifferentialRow[]): number {
  const effectiveDifferentials = buildEffectiveDifferentials(rounds);
  return effectiveDifferentials.length * 18;
}

export function applyWhsCaps(rawHandicapIndex: number, currentLowHandicapIndex: number | null): CapApplicationResult {
  const lowHandicapIndex = currentLowHandicapIndex === null
    ? rawHandicapIndex
    : Math.min(currentLowHandicapIndex, rawHandicapIndex);

  const softCapThreshold = lowHandicapIndex + 3;
  const hardCapThreshold = lowHandicapIndex + 5;

  let appliedHandicapIndex = rawHandicapIndex;
  let softCapTriggered = false;
  let hardCapTriggered = false;

  if (rawHandicapIndex > softCapThreshold) {
    softCapTriggered = true;
    const softAdjusted = softCapThreshold + ((rawHandicapIndex - softCapThreshold) / 2);
    appliedHandicapIndex = softAdjusted;
  }

  if (appliedHandicapIndex > hardCapThreshold) {
    hardCapTriggered = true;
    appliedHandicapIndex = hardCapThreshold;
  }

  const normalizedAppliedHandicapIndex = toOneDecimalTruncated(appliedHandicapIndex);
  const updatedLowHandicapIndex = Math.min(lowHandicapIndex, normalizedAppliedHandicapIndex);

  return {
    rawHandicapIndex,
    appliedHandicapIndex: normalizedAppliedHandicapIndex,
    lowHandicapIndex,
    updatedLowHandicapIndex,
    softCapTriggered,
    hardCapTriggered,
    softCapThreshold,
    hardCapThreshold,
  };
}