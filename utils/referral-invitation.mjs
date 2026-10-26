// Wording for the Refer a friend invitation. Used for the branded email (only
// sent where the friend already agreed to hear from us) and for the message a
// member copies or shares themselves.

export const REFERRAL_SUBJECT = 'You’ve been invited to discover Unboxed Together';
export const REFERRAL_BUTTON = 'Discover Unboxed Together';

export const referralOpening = (referrerName) => (referrerName
  ? `${referrerName} thought you might find this interesting.`
  : 'Someone thought you might find this interesting.');

export const referralParagraphs = [
  'You’ve been invited to discover Unboxed Together.',
  'We’re building a community around understanding food, nutrition, everyday habits and wellbeing.',
  'It began with a personal journey through ADHD and burnout, which led to the book: Unboxed – The Dirty Secret Hiding In Our Diet.',
];

export const referralProjects = [
  'The 30-Day Barcode Challenge.',
  'A searchable food and ingredient database.',
  'The Unboxed Together app.',
  'Community activities and support.',
];

export const referralClosing = [
  'These projects are still being developed, and we’re inviting people to help shape what comes next.',
  'No perfect diets. No quick fixes. Just helping you understand you.',
];

// Plain-text version, also what a member shares from their own email or phone.
export function referralInvitationText({ referrerName = '', url }) {
  return [
    referralOpening(referrerName),
    '',
    ...referralParagraphs.flatMap((line) => [line, '']),
    'Now we’re developing:',
    ...referralProjects.map((line) => `• ${line}`),
    '',
    ...referralClosing.flatMap((line) => [line, '']),
    `${REFERRAL_BUTTON}: ${url}`,
  ].join('\n');
}
