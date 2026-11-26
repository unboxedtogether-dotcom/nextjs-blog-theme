// Remembers on this device that someone has an account, so the front page
// sends them to the login page instead of the sign-up page. It holds no
// personal details, only the value "1".
const NAME = 'ut_member';

export function rememberAccount() {
  document.cookie = `${NAME}=1; path=/; max-age=${60 * 60 * 24 * 400}; secure; samesite=lax`;
}

export function forgetAccount() {
  document.cookie = `${NAME}=; path=/; secure; samesite=lax; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function hasHadAccount() {
  return typeof document !== 'undefined' && document.cookie.split('; ').includes(`${NAME}=1`);
}
