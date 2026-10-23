// Baseline and weekly check-in: questions, validation and scoring.
// Shared by the check-in page and the server. Scores are only ever stored
// from the server-side calculation; the browser copy is for display.
//
// Changing a question, an answer's points or a weight means a new
// SCORING_VERSION (and a new scoring_versions row) so earlier weeks keep the
// meaning they were scored with.

export const CHECKIN_FORM_VERSION = 'checkin-v1';
export const SCORING_VERSION = 'wellbeing-v1';
export const PROGRESS_NOTICE_VERSION = 'progress-notice-v1';

export const scoreDisclaimer = 'These scores are personal self-monitoring indicators based on your own answers. They are not a medical assessment, a diagnosis or a measure of clinical recovery.';

export const progressConsent = {
  heading: 'Consent for personal progress tracking',
  points: [
    'Each week you answer the same short set of questions about your sleep, mood, energy and focus, food habits and movement.',
    'We turn your answers into category scores and an overall score out of 100, so you can see your own patterns over time. The scores are not a diagnosis and are never used to judge you.',
    'Your answers are health and wellbeing information. They are stored privately against your account and can only be seen by you and by named Unboxed Together staff who support you. Every staff view is recorded.',
    'Nothing you enter here is shared publicly, emailed, sold or sent to analytics.',
    'This is separate from the consent on page 2 of the welcome questionnaire, and joining the community does not depend on it.',
    'You can withdraw at any time from My progress. Withdrawing stops tracking and permanently deletes your baseline, check-ins, scores and progress notes.',
  ],
  label: 'I explicitly consent to Unboxed Together storing and using my baseline and weekly check-in answers to calculate and show my personal progress scores, as described above.',
};

const thirds = [0, 100 / 3, 200 / 3, 100];
const scale = (low, high) => ({ type: 'scale', options: [1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) })), low, high, points: (value) => (value - 1) * 25 });
const choice = (labels) => ({ type: 'choice', options: labels.map((label, index) => ({ value: index, label })), points: (value) => thirds[value] });
const frequency = () => choice(['Rarely or never', 'Some days', 'Most days', 'Every day or nearly']);
const days = (points = (value) => (value / 7) * 100) => ({ type: 'days', options: [0, 1, 2, 3, 4, 5, 6, 7].map((value) => ({ value, label: String(value) })), points });

export const scoreCategories = [
  {
    key: 'sleep', label: 'Sleep', fullLabel: 'Sleep quality', weight: 0.25,
    intro: 'Whenever you sleep, day or night. Working shifts or irregular hours does not lower your score.',
    items: [
      { key: 'sleepQuality', label: 'Sleep quality', required: true, ...scale('Very poor', 'Very good') },
      { key: 'restedAfterSleep', label: 'How rested did you usually feel after sleeping?', required: true, ...choice(['Not at all rested', 'A little rested', 'Fairly rested', 'Well rested']) },
      { key: 'enoughSleep', label: 'How often did you get the amount of sleep you need?', help: 'At whatever time of day or night suits your routine.', required: false, ...frequency() },
    ],
  },
  {
    key: 'mood', label: 'Mood', fullLabel: 'Mood and emotional wellbeing', weight: 0.25,
    items: [
      { key: 'mood', label: 'Overall mood', required: true, ...scale('Very low', 'Very good') },
      { key: 'managingDemands', label: 'Feeling able to manage daily demands', required: true, ...scale('Not at all', 'Very well') },
    ],
  },
  {
    key: 'energy_focus', label: 'Energy and focus', fullLabel: 'Energy and focus', weight: 0.20,
    items: [
      { key: 'energy', label: 'Energy during your waking hours', required: true, ...scale('Very low', 'Very good') },
      { key: 'focus', label: 'Ability to focus on everyday tasks', required: true, ...scale('Very difficult', 'Very easy') },
    ],
  },
  {
    key: 'nutrition', label: 'Food habits', fullLabel: 'Nutrition habits', weight: 0.20,
    intro: 'Meals at any time of day count, including around shifts. Takeaways and shop-bought meals are not marked down.',
    items: [
      { key: 'regularMeals', label: 'On how many days did you eat meals that suited your routine?', help: 'Number of days in the past 7.', required: true, ...days() },
      { key: 'freshMeals', label: 'On how many days did you have a meal made mostly from fresh or simple ingredients?', help: 'Home-cooked, shop-bought or from a takeaway all count.', required: true, ...days() },
      { key: 'fruitVeg', label: 'On a usual day, how many portions of fruit and vegetables did you have?', required: true, ...choice(['None', '1 to 2', '3 to 4', '5 or more']) },
      { key: 'hydration', label: 'How often did you drink enough water or other drinks without added sugar?', required: false, ...frequency() },
    ],
  },
  {
    key: 'activity', label: 'Movement', fullLabel: 'Physical activity', weight: 0.10,
    items: [
      { key: 'movementDays', label: 'On how many days did you do at least 20 minutes of movement you chose?', help: 'Walking, gardening, dancing, chair-based exercise, whatever suits you. 5 or more days scores in full.', required: true, ...days((value) => (Math.min(value, 5) / 5) * 100) },
    ],
  },
];

export const weekContextOptions = ['A busy or changed routine', 'Shift or working-hours changes', 'Travel or time away', 'Feeling unwell', 'Caring responsibilities', 'Something else'];

// Recorded and shown in history, never scored.
export const unscoredItems = [
  { key: 'cookingConfidence', label: 'Confidence cooking a basic meal', required: false, ...scale('Not confident', 'Very confident') },
  { key: 'weekContext', label: 'Did anything affect your week?', help: 'Not scored. It helps you and Lee understand the numbers.', type: 'multi', options: weekContextOptions.map((label) => ({ value: label, label })) },
  { key: 'personalNote', label: 'Anything you would like to remember about this week?', help: 'Optional. Only you and the Unboxed Together team can read it.', type: 'text', maxLength: 500 },
];

export const scoredItems = scoreCategories.flatMap((category) => category.items.map((item) => ({ ...item, category: category.key })));
const allItems = [...scoredItems, ...unscoredItems];
export const categoryByKey = Object.fromEntries(scoreCategories.map((category) => [category.key, category]));

// Welcome questionnaire (page 3, Q21 and Q22) answers that ask the same
// question on the same scale. Used only to prefill the baseline, which the
// member then confirms.
export const welcomePrefill = {
  sleepQualityScore: 'sleepQuality',
  moodScore: 'mood',
  managingDemandsScore: 'managingDemands',
  energyScore: 'energy',
  focusScore: 'focus',
  movementDays: 'movementDays',
  cookingConfidenceScore: 'cookingConfidence',
};

// Drops unknown keys and invalid values. Missing answers stay null; they are
// never treated as zero.
export function cleanCheckinAnswers(input = {}) {
  const values = {};
  for (const item of allItems) {
    const raw = input?.[item.key];
    if (item.type === 'multi') {
      values[item.key] = Array.isArray(raw) ? [...new Set(raw.filter((value) => weekContextOptions.includes(value)))] : [];
    } else if (item.type === 'text') {
      values[item.key] = typeof raw === 'string' ? raw.trim().slice(0, item.maxLength) : '';
    } else {
      const number = raw === null || raw === undefined || raw === '' ? null : Number(raw);
      values[item.key] = Number.isInteger(number) && item.options.some((option) => option.value === number) ? number : null;
    }
  }
  return values;
}

const round1 = (value) => Math.round(value * 10) / 10;

export function scoreCheckin(answers) {
  const categories = scoreCategories.map((category) => {
    const answered = category.items.filter((item) => answers[item.key] !== null && answers[item.key] !== undefined);
    const required = category.items.filter((item) => item.required);
    const complete = required.every((item) => answers[item.key] !== null && answers[item.key] !== undefined);
    const raw = answered.length ? answered.reduce((sum, item) => sum + item.points(answers[item.key]), 0) / answered.length : null;
    return {
      key: category.key,
      weight: category.weight,
      raw: complete ? raw : null,
      score: complete ? round1(raw) : null,
      itemsAnswered: answered.filter((item) => item.required).length,
      itemsRequired: required.length,
      status: complete ? 'complete' : 'incomplete',
    };
  });
  const complete = categories.every((category) => category.status === 'complete');
  const overall = complete ? Math.round(categories.reduce((sum, category) => sum + category.raw * category.weight, 0)) : null;
  return {
    version: SCORING_VERSION,
    completeness: complete ? 'complete' : 'incomplete',
    overall,
    categories: categories.map(({ raw, ...category }) => category),
  };
}

export function missingRequired(answers) {
  return scoredItems.filter((item) => item.required && (answers[item.key] === null || answers[item.key] === undefined));
}

// Readable question/answer rows for history views and PDF reports.
export function describeCheckinAnswers(answers = {}) {
  return [
    ...scoreCategories.flatMap((category) => category.items.map((item) => ({ group: category.fullLabel, ...describeItem(item, answers[item.key]) }))),
    ...unscoredItems.map((item) => ({ group: 'About your week (not scored)', ...describeItem(item, answers[item.key]) })),
  ];
}

function describeItem(item, value) {
  let text = null;
  if (item.type === 'multi') text = Array.isArray(value) && value.length ? value.join(', ') : null;
  else if (item.type === 'text') text = value || null;
  else if (value !== null && value !== undefined) {
    const option = item.options.find((entry) => entry.value === value);
    if (item.type === 'scale') text = `${value} of 5${value === 1 ? ` (${item.low})` : value === 5 ? ` (${item.high})` : ''}`;
    else if (item.type === 'days') text = `${value} ${value === 1 ? 'day' : 'days'}`;
    else text = option?.label ?? String(value);
  }
  return { key: item.key, label: item.label, value: text };
}

export const formNames = {
  welcome_details: 'Welcome questionnaire: 1. Your details',
  welcome_food: 'Welcome questionnaire: 2. Your food and drink',
  welcome_everyday: 'Welcome questionnaire: 3. Your everyday life and starting point',
  welcome_health: 'Welcome questionnaire: 4. Health information',
  baseline_wellbeing: 'Baseline wellbeing assessment (Week 0)',
  weekly_checkin: 'Weekly check-in',
};

export const welcomeFormTypes = { 1: 'welcome_details', 2: 'welcome_food', 3: 'welcome_everyday', 4: 'welcome_health' };

export function submissionTitle(submission) {
  if (submission.form_type === 'weekly_checkin') return `Weekly check-in: Week ${submission.reporting_week_number}`;
  return formNames[submission.form_type] || submission.form_type;
}
