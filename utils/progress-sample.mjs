// Demonstration values for the design previews only. Never written to the
// database or shown to real members.
import { SCORING_VERSION } from './progress-checkin.mjs';
import { buildTimeline } from './progress-timeline.mjs';

const overall = [52, 57, 63, 61, 72, 78];
const start = Date.parse('2026-09-07T00:00:00Z');
const day = 86400000;
const answers = { sleepQuality: 3, restedAfterSleep: 2, enoughSleep: 1, mood: 4, managingDemands: 3, energy: 3, focus: 3, regularMeals: 5, freshMeals: 4, fruitVeg: 2, hydration: 2, movementDays: 3, cookingConfidence: 3, weekContext: ['A busy or changed routine'], personalNote: 'Sample note: tried batch cooking on Sunday.' };

export const sampleProgressEntries = overall.map((score, week) => ({
  rootId: `sample-${week}`,
  submissionId: `sample-${week}`,
  formType: week === 0 ? 'baseline_wellbeing' : 'weekly_checkin',
  weekNumber: week,
  weekStart: new Date(start + week * 7 * day).toISOString().slice(0, 10),
  submittedAt: new Date(start + (week * 7 + 2) * day + 19 * 3600000).toISOString(),
  originalSubmittedAt: new Date(start + (week * 7 + 2) * day + 19 * 3600000).toISOString(),
  revisionNumber: 0,
  revisions: [],
  answers,
  overall: score,
  completeness: 'complete',
  scoringVersion: SCORING_VERSION,
  categories: { sleep: { score: score + 4 }, mood: { score: score - 2 }, energy_focus: { score: score - 4 }, nutrition: { score: score + 2 }, activity: { score } },
  notes: [],
}));

export const sampleProgressState = {
  consent: { given: true, givenAt: '2026-09-09T19:00:00Z' },
  state: 'due',
  currentWeek: { start: new Date(start + 6 * 7 * day).toISOString().slice(0, 10), number: 6 },
  baseline: { date: '2026-09-09', weekStart: '2026-09-07' },
  nextCheckInOpens: '2026-09-14',
  drafts: {},
  prefill: {},
  revisionReasons: [],
  entries: sampleProgressEntries,
  generalNotes: [],
};

export const sampleProgressSummary = {
  state: 'due',
  consentGiven: true,
  nextCheckInOpens: null,
  hasDraft: false,
  summary: buildTimeline(sampleProgressEntries, 6).summary,
};
