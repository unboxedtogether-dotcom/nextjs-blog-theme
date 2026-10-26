// Wording for the Refer a friend invitation. Mirrors the top of the Join us
// page the link opens. Used for the branded email (only sent where the friend
// already agreed to hear from us), the preview on Refer a friend, and the
// message a member copies or shares themselves.

export const REFERRAL_SUBJECT = 'You’ve been invited to discover Unboxed Together';
export const REFERRAL_BUTTON = 'I’m interested — let’s get started';
export const REFERRAL_HEADLINE = 'What if understanding yourself started with understanding your food?';
export const REFERRAL_LEAD = 'A personal journey. A book. A community. And something bigger we’re building together.';
export const REFERRAL_NOTE = 'It takes around two minutes. No obligation to join.';

export const referralOpening = (referrerName) => (referrerName
  ? `${referrerName} thought you might find this interesting.`
  : 'Someone thought you might find this interesting.');

// Short line shown above the headline, as on the Join us page.
export const referralKicker = (referrerName) => (referrerName
  ? `${referrerName} thought you might find this interesting`
  : 'Unboxed Together');

// Plain-text version, also what a member shares from their own email or phone.
export function referralInvitationText({ referrerName = '', url }) {
  return [
    referralOpening(referrerName),
    '',
    REFERRAL_HEADLINE,
    '',
    REFERRAL_LEAD,
    '',
    `${REFERRAL_BUTTON}: ${url}`,
    '',
    REFERRAL_NOTE,
  ].join('\n');
}
