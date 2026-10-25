// Prospective member interest questionnaire (/join-us/questionnaire).
// Separate from the member welcome questionnaire: nothing here is copied into
// member records. Shared by the browser and the server so both validate the
// same options.

export const PROSPECT_QUESTIONNAIRE_VERSION = 'prospect-2026-10';
// Bump when any consent wording below changes; stored with every permission.
export const PROSPECT_CONSENT_VERSION = 'prospect-consent-2026-10';
// Unlinked records with no active permission are deleted after this long.
export const PROSPECT_RETENTION_MONTHS = 24;

// Browser session storage keys: the campaign label from the invitation link,
// and which confirmations to show on the thank-you page (never any answers).
export const joinSourceKey = 'ut-join-source';
export const joinResultKey = 'ut-join-result';

export const NOTHING_IN_PARTICULAR = 'Nothing in particular';
export const PREFER_NOT_TO_SAY = 'Prefer not to say';
export const JUST_EXPLORE = 'Just explore for now';
export const ONE_TO_ONE = 'Ask about one-to-one support';

export const prospectQuestions = [
  {
    key: 'topics',
    number: 1,
    title: 'Which of these would you like to understand better?',
    help: 'Select all that apply. These are topics you would like to learn about, not a statement about you.',
    options: [
      'Food, ingredients and additives',
      'ADHD, autism and neurodivergence',
      'Burnout, stress and wellbeing',
      'Sleep, mood and energy',
      'Nutrition and everyday habits',
      'Finding a supportive community',
      "I'm simply curious",
    ],
    required: true,
  },
  {
    key: 'challenges',
    number: 2,
    title: 'Are there any areas you personally find challenging?',
    help: 'Optional. Select all that apply, or skip this question.',
    options: [
      'Focus or concentration',
      'Low energy or motivation',
      'Sleep quality',
      'Stress or feeling overwhelmed',
      "Understanding what I'm eating",
      'Finding support or community',
      NOTHING_IN_PARTICULAR,
      PREFER_NOT_TO_SAY,
    ],
    // Each of these must be the only answer.
    exclusive: [NOTHING_IN_PARTICULAR, PREFER_NOT_TO_SAY],
    optional: true,
    sensitive: true,
  },
  {
    key: 'projects',
    number: 3,
    title: 'Which upcoming Unboxed Together projects interest you?',
    help: 'Select all that apply.',
    options: [
      '30-Day Barcode Challenge',
      'Food and additive database',
      'Unboxed Together app and tracking tools',
      'Community discussions',
      'Group walks and local activities',
      'Personal guidance and support',
    ],
    required: true,
  },
  {
    key: 'involvement',
    number: 4,
    title: 'How would you like to get involved?',
    help: 'Select all that apply.',
    options: [
      'Join the free website membership',
      'Take part in the Barcode Challenge when available',
      'Become an early app tester',
      'Join community conversations',
      'Receive updates about specific project launches',
      'Share ideas to help shape the project',
      ONE_TO_ONE,
      JUST_EXPLORE,
    ],
    exclusive: [JUST_EXPLORE],
    required: true,
  },
];

// Answers to question 2 can reveal health information (special category data
// under UK GDPR), so they are only kept with this explicit consent.
export const sensitiveConsentText = 'I agree to Unboxed Together storing my answer to this question so the team can understand what support would be useful. I understand this is optional and I can ask for it to be deleted at any time.';

export const consentTexts = {
  project_contact: 'Contact me about the projects or support I have selected. For example, when the Barcode Challenge opens, about app testing or about one-to-one support.',
  general_marketing: 'Send me general Unboxed Together news, offers and promotional emails. Optional. You can unsubscribe at any time.',
  sensitive_answers: sensitiveConsentText,
};

export const permissionTypes = Object.keys(consentTexts);

// Summary counts on the admin dashboard and project update segments.
export const projectSegments = {
  barcode: { label: 'Barcode Challenge', project: '30-Day Barcode Challenge', involvement: 'Take part in the Barcode Challenge when available' },
  app: { label: 'App testing', project: 'Unboxed Together app and tracking tools', involvement: 'Become an early app tester' },
  database: { label: 'Food database', project: 'Food and additive database' },
  community: { label: 'Community discussions', project: 'Community discussions', involvement: 'Join community conversations' },
  walks: { label: 'Group walks', project: 'Group walks and local activities' },
  support: { label: 'Personal support', project: 'Personal guidance and support', involvement: ONE_TO_ONE },
};

export const emptyProspectAnswers = () => ({ topics: [], challenges: [], projects: [], involvement: [] });

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const questionByKey = Object.fromEntries(prospectQuestions.map((question) => [question.key, question]));

// Applies a click on an option, keeping exclusive answers on their own.
export function toggleOption(questionKey, selected, option) {
  const question = questionByKey[questionKey];
  if (selected.includes(option)) return selected.filter((item) => item !== option);
  if (question.exclusive?.includes(option)) return [option];
  return [...selected.filter((item) => !question.exclusive?.includes(item)), option];
}

// True when question 2 holds an answer that describes the person.
export const hasSensitiveChallenge = (challenges = []) => challenges.some((item) => item !== PREFER_NOT_TO_SAY && item !== NOTHING_IN_PARTICULAR);

export function questionError(question, selected) {
  if (!Array.isArray(selected)) return 'Please choose from the options shown.';
  if (selected.some((item) => !question.options.includes(item))) return 'Please choose from the options shown.';
  if (new Set(selected).size !== selected.length) return 'Please choose each option once.';
  if (question.required && !selected.length) return 'Please choose at least one option.';
  const exclusive = selected.filter((item) => question.exclusive?.includes(item));
  if (exclusive.length && selected.length > 1) return `“${exclusive[0]}” cannot be combined with other answers.`;
  return '';
}

const clean = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max + 1);

// Server-side validation. Returns { values } or { error }.
export function cleanProspectSubmission(input) {
  if (!input || typeof input !== 'object') return { error: 'Please complete the questionnaire.' };
  const answers = input.answers && typeof input.answers === 'object' ? input.answers : {};
  const values = {};
  for (const question of prospectQuestions) {
    const selected = answers[question.key] ?? [];
    const error = questionError(question, selected);
    if (error) return { error: `Question ${question.number}: ${error}` };
    values[question.key] = [...selected];
  }

  const consent = input.consent && typeof input.consent === 'object' ? input.consent : {};
  const sensitiveConsent = consent.sensitive_answers === true;
  // Without explicit consent, personal challenge answers are dropped, never stored.
  if (hasSensitiveChallenge(values.challenges) && !sensitiveConsent) values.challenges = [];

  const firstName = clean(input.firstName, 60);
  const email = clean(input.email, 254).toLowerCase();
  if (firstName.length > 60) return { error: 'Please keep your first name under 60 characters.' };
  if (email && (!emailPattern.test(email) || email.length > 254)) return { error: 'Please enter a valid email address, or leave it blank.' };

  const projectContact = consent.project_contact === true;
  const generalMarketing = consent.general_marketing === true;
  if ((projectContact || generalMarketing) && !email) return { error: 'Please add your email address so we can contact you, or untick the contact boxes.' };
  if ((projectContact || generalMarketing) && !firstName) return { error: 'Please add your first name so we know what to call you.' };

  const campaign = clean(input.source, 60).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return {
    values: {
      ...values,
      firstName: firstName || null,
      email: email || null,
      permissions: {
        project_contact: projectContact,
        general_marketing: generalMarketing,
        sensitive_answers: sensitiveConsent && hasSensitiveChallenge(values.challenges),
      },
      sourceCampaign: campaign || null,
    },
  };
}
