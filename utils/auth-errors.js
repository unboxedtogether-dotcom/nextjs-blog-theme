export function friendlyAuthError(error) {
  if (error?.status === 401) return 'That email and password combination was not recognised.';
  if (error?.status === 403) return 'This action is not currently available. Please contact support if the problem continues.';
  if (error?.status === 404) return 'We could not find an account for that email address.';
  if (error?.status === 422) return 'Please check the details you entered. Passwords must be at least 8 characters.';
  if (/confirm/i.test(error?.message || '')) return 'Please confirm your email before logging in.';
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
