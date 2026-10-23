import { scoreCategories } from './progress-checkin.mjs';

// Turns stored check-ins into a week-by-week timeline. Pure, so the member
// page, admin view, PDF report and tests all share the same rules:
// - every week from the baseline (Week 0) to the current week is listed;
// - a week without a check-in is "missed" (or "due" if it is this week), never zero;
// - an incomplete check-in keeps its category scores but has no overall score
//   and is left out of the trend and change figures;
// - changes are measured against the previous *completed* week.

export const periods = [
  { key: '4', label: 'Last 4 weeks', weeks: 4 },
  { key: '8', label: 'Last 8 weeks', weeks: 8 },
  { key: '12', label: 'Last 12 weeks', weeks: 12 },
  { key: 'all', label: 'All time', weeks: null },
];

export const direction = (delta) => {
  if (delta === null || delta === undefined) return null;
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'same';
};

export const formatChange = (delta) => {
  if (delta === null || delta === undefined) return '';
  const rounded = Math.round(delta);
  return rounded > 0 ? `+${rounded}` : String(rounded);
};

export const weekLabel = (weekNumber) => (weekNumber === 0 ? 'Baseline' : `Week ${weekNumber}`);

export function buildTimeline(entries = [], currentWeekNumber = null) {
  const byWeek = new Map(entries.map((entry) => [entry.weekNumber, entry]));
  const lastWeek = Math.max(currentWeekNumber ?? 0, ...entries.map((entry) => entry.weekNumber), 0);
  const hasBaseline = byWeek.has(0);
  const weeks = [];
  let previousComplete = null;

  for (let number = 0; number <= lastWeek && hasBaseline; number += 1) {
    const entry = byWeek.get(number);
    if (!entry) {
      weeks.push({ weekNumber: number, status: number === currentWeekNumber ? 'due' : 'missed' });
      continue;
    }
    const complete = entry.completeness === 'complete';
    const comparedWith = complete ? previousComplete : null;
    const categoryChanges = Object.fromEntries(scoreCategories.map(({ key }) => {
      const now = entry.categories?.[key]?.score;
      const before = previousComplete?.categories?.[key]?.score;
      return [key, now !== null && now !== undefined && before !== null && before !== undefined ? Math.round(now) - Math.round(before) : null];
    }));
    weeks.push({
      ...entry,
      status: complete ? 'complete' : 'incomplete',
      previousWeekNumber: previousComplete?.weekNumber ?? null,
      previousCategories: previousComplete?.categories ?? null,
      change: comparedWith ? entry.overall - comparedWith.overall : null,
      categoryChanges,
    });
    if (complete) previousComplete = entry;
  }

  const completed = weeks.filter((week) => week.status === 'complete');
  const baseline = weeks.find((week) => week.weekNumber === 0) || null;
  const checkIns = completed.filter((week) => week.weekNumber > 0);
  const latest = checkIns[checkIns.length - 1] || null;
  const previous = latest ? completed[completed.indexOf(latest) - 1] || null : null;
  const baselineScore = baseline?.status === 'complete' ? baseline.overall : null;

  return {
    weeks,
    summary: {
      currentScore: latest?.overall ?? null,
      currentWeekNumber: latest?.weekNumber ?? null,
      previousScore: previous?.overall ?? null,
      previousWeekNumber: previous?.weekNumber ?? null,
      change: latest && previous ? latest.overall - previous.overall : null,
      baselineScore,
      changeFromBaseline: latest && baselineScore !== null ? latest.overall - baselineScore : null,
      // The date the member chose for the check-in, falling back to when it was saved.
      lastCheckInAt: latest ? (latest.entryDate ? `${latest.entryDate}T12:00:00Z` : latest.submittedAt) : null,
      completedCount: checkIns.length,
      missedCount: weeks.filter((week) => week.status === 'missed').length,
      incompleteCount: weeks.filter((week) => week.status === 'incomplete').length,
    },
  };
}

// Weeks shown for a selected period, counted back from the latest week.
export function weeksInPeriod(weeks, periodKey) {
  const period = periods.find((item) => item.key === periodKey);
  if (!period?.weeks || !weeks.length) return weeks;
  const last = weeks[weeks.length - 1].weekNumber;
  return weeks.filter((week) => week.weekNumber > last - period.weeks);
}
