import { logout } from '@netlify/identity';

// Signs out and always clears this browser's session, even if the Identity
// server cannot be reached, so the next person on a shared computer never
// inherits the account. A full page load then discards any in-memory details.
export async function signOutCompletely(destination = '/') {
  try {
    await logout();
  } catch {
    // Fall through: the local session is still removed below.
  }
  for (const name of ['nf_jwt', 'nf_refresh']) {
    document.cookie = `${name}=; path=/; secure; samesite=lax; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
  try {
    window.localStorage.removeItem('gotrue.user');
    window.sessionStorage.clear();
  } catch {
    // Storage can be unavailable in private modes.
  }
  window.location.replace(destination);
}
