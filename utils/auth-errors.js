// An account that exists but has not clicked its confirmation link yet.
export const isUnconfirmedError = (error) => /not confirmed|confirm your email/i.test(error?.message || '');
// Signing up again with an address that already has a confirmed account.
export const isAlreadyRegisteredError = (error) => /already (been )?registered|already exists/i.test(error?.message || '');

// The Identity service could not hand the email to the mail server, so
// nothing was sent (and, for a signup, no account was created).
export const isEmailDeliveryError = (error) => /error sending .*mail/i.test(error?.message || '');

export function friendlyAuthError(error) {
  if (isEmailDeliveryError(error)) return 'We could not send your email just now, so nothing has been saved yet. Please try again a little later, or contact support@unboxedtogether.com if this keeps happening.';
  if (isUnconfirmedError(error)) return 'Please confirm your email before logging in. Check your inbox (and spam or junk folder) for the email from Unboxed Together.';
  if (isAlreadyRegisteredError(error)) return 'There is already an account for this email address. Please log in instead, or reset your password if you have forgotten it.';
  if (error?.status === 429) return 'Too many attempts. Please wait a few minutes and try again.';
  if (error?.status === 401) return 'That email and password combination was not recognised.';
  if (error?.status === 403) return 'This action is not currently available. Please contact support if the problem continues.';
  if (error?.status === 404) return 'We could not find an account for that email address.';
  if (error?.status === 422) return 'Please check the details you entered. Passwords must be at least 8 characters.';
  return 'Something went wrong. Please try again in a moment.';
}

// Only same-site paths. Backslashes and control characters are refused because
// browsers treat a leading slash-backslash like `//`, which leaves the site.
export function safeReturnPath(value, fallback = '/members') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return fallback;
  try {
    const base = 'https://unboxedtogether.invalid';
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
