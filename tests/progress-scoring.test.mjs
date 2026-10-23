// Scoring and timeline rules for the weekly check-in. Run with `npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCheckinAnswers, describeCheckinAnswers, missingRequired, scoreCategories, scoreCheckin } from '../utils/progress-checkin.mjs';
import { buildTimeline, weeksInPeriod } from '../utils/progress-timeline.mjs';

const best = { sleepQuality: 5, restedAfterSleep: 3, enoughSleep: 3, mood: 5, managingDemands: 5, energy: 5, focus: 5, regularMeals: 7, freshMeals: 7, fruitVeg: 3, hydration: 3, movementDays: 5 };
const lowest = { sleepQuality: 1, restedAfterSleep: 0, enoughSleep: 0, mood: 1, managingDemands: 1, energy: 1, focus: 1, regularMeals: 0, freshMeals: 0, fruitVeg: 0, hydration: 0, movementDays: 0 };
const category = (result, key) => result.categories.find((item) => item.key === key);

test('weights add up to 100%', () => {
  assert.equal(Math.round(scoreCategories.reduce((sum, item) => sum + item.weight, 0) * 100), 100);
});

test('best and lowest answers score 100 and 0', () => {
  assert.equal(scoreCheckin(cleanCheckinAnswers(best)).overall, 100);
  assert.equal(scoreCheckin(cleanCheckinAnswers(lowest)).overall, 0);
});

test('weighted overall from category scores', () => {
  const result = scoreCheckin(cleanCheckinAnswers({ ...best, sleepQuality: 1, restedAfterSleep: 0, enoughSleep: 0 }));
  assert.equal(category(result, 'sleep').score, 0);
  assert.equal(result.overall, 75); // sleep is 25% of the total
});

test('missing answers are never counted as zero', () => {
  const answers = cleanCheckinAnswers({ ...best, mood: null });
  const result = scoreCheckin(answers);
  assert.equal(result.completeness, 'incomplete');
  assert.equal(result.overall, null);
  assert.equal(category(result, 'mood').score, null);
  assert.equal(category(result, 'sleep').score, 100);
  assert.deepEqual(missingRequired(answers).map((item) => item.key), ['mood']);
});

test('optional items are averaged only when answered', () => {
  const result = scoreCheckin(cleanCheckinAnswers({ ...best, enoughSleep: null, hydration: null }));
  assert.equal(result.overall, 100);
  assert.equal(category(result, 'sleep').status, 'complete');
});

test('shift work and takeaways are not penalised', () => {
  const shiftWeek = scoreCheckin(cleanCheckinAnswers({ ...best, weekContext: ['Shift or working-hours changes'] }));
  assert.equal(shiftWeek.overall, 100, 'context answers are not scored');
  const ids = scoreCategories.flatMap((item) => item.items.map((question) => `${question.key} ${question.label}`)).join(' ').toLowerCase();
  assert.ok(!ids.includes('takeaway') && !ids.includes('bedtime') && !ids.includes('regular sleep'));
});

test('movement scores in full at 5 days', () => {
  assert.equal(category(scoreCheckin(cleanCheckinAnswers({ ...best, movementDays: 7 })), 'activity').score, 100);
  assert.equal(category(scoreCheckin(cleanCheckinAnswers({ ...best, movementDays: 2 })), 'activity').score, 40);
});

test('invalid and unknown answers are dropped', () => {
  const answers = cleanCheckinAnswers({ mood: 6, energy: '3', focus: 2.5, hack: 'x', weekContext: ['Travel or time away', 'nope'] });
  assert.equal(answers.mood, null);
  assert.equal(answers.energy, 3);
  assert.equal(answers.focus, null);
  assert.ok(!('hack' in answers));
  assert.deepEqual(answers.weekContext, ['Travel or time away']);
});

test('answers are described for history views', () => {
  const rows = describeCheckinAnswers(cleanCheckinAnswers({ ...best, fruitVeg: 1 }));
  assert.equal(rows.find((row) => row.key === 'fruitVeg').value, '1 to 2');
  assert.equal(rows.find((row) => row.key === 'mood').value, '5 of 5 (Very good)');
});

const entry = (weekNumber, overall, completeness = 'complete') => ({ weekNumber, overall, completeness, categories: { sleep: { score: overall } }, submittedAt: `2026-01-0${weekNumber + 1}T10:00:00Z` });

test('timeline marks missed weeks and compares with the previous completed week', () => {
  const { weeks, summary } = buildTimeline([entry(0, 52), entry(1, 57), entry(3, 61), entry(4, null, 'incomplete')], 5);
  assert.deepEqual(weeks.map((week) => week.status), ['complete', 'complete', 'missed', 'complete', 'incomplete', 'due']);
  assert.equal(weeks[3].change, 4);
  assert.equal(weeks[3].previousWeekNumber, 1);
  assert.equal(weeks[4].change, null);
  assert.deepEqual(
    { current: summary.currentScore, previous: summary.previousScore, change: summary.change, baseline: summary.baselineScore, fromBaseline: summary.changeFromBaseline, missed: summary.missedCount },
    { current: 61, previous: 57, change: 4, baseline: 52, fromBaseline: 9, missed: 1 },
  );
});

test('baseline alone has no current score or change', () => {
  const { summary } = buildTimeline([entry(0, 52)], 0);
  assert.equal(summary.currentScore, null);
  assert.equal(summary.baselineScore, 52);
  assert.equal(summary.changeFromBaseline, null);
});

test('period filter counts back from the latest week', () => {
  const { weeks } = buildTimeline([0, 1, 2, 3, 4, 5, 6].map((week) => entry(week, 50 + week)), 6);
  assert.deepEqual(weeksInPeriod(weeks, '4').map((week) => week.weekNumber), [3, 4, 5, 6]);
  assert.equal(weeksInPeriod(weeks, 'all').length, 7);
});
