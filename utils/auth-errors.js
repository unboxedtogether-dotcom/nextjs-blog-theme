export function friendlyAuthError(error) {
  if (error?.status === 401) return 'That email and password combination was not recognised.';
  if (error?.status === 403) return 'This action is not currently available. Please contact support if the problem continues.';
  if (error?.status === 404) return 'We could not find an account for that email address.';
  if (error?.status === 422) return 'Please check the details you entered. Passwords must be at least 8 characters.';
  if (/confirm/i.test(error?.message || '')) return 'Please confirm your email before logging in.';
  return 'Something went wrong. Please try again in a moment.';
}

export function safeReturnPath(value, fallback = '/members') {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}
