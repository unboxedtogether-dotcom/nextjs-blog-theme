import { admin } from '@netlify/identity';

const PER_PAGE = 100;

// Every Netlify Identity account, keyed by user id. Identity is the record of
// who has signed up and their current email; a profile row only exists once
// an account has been confirmed or used. Resolves to null when the Identity
// admin API is unavailable (for example in local tests), so callers fall back
// to what the database holds.
export async function loadIdentityAccounts() {
  try {
    const accounts = new Map();
    for (let page = 1; page <= 100; page += 1) {
      const users = await admin.listUsers({ page, perPage: PER_PAGE });
      const before = accounts.size;
      for (const user of users) accounts.set(user.id, user);
      if (users.length < PER_PAGE || accounts.size === before) break;
    }
    return accounts;
  } catch (error) {
    console.error('Identity accounts unavailable', error.message);
    return null;
  }
}

export async function loadIdentityAccount(userId) {
  try {
    return await admin.getUser(userId);
  } catch {
    return null;
  }
}

// The signed-in user with an up-to-date email and confirmation date. When the
// full account cannot be fetched, getUser() falls back to the login token,
// which never carries confirmedAt, so a verified member would look
// unverified. In that case the Identity account itself is the authority.
export async function withConfirmedAccount(user) {
  if (!user || user.confirmedAt) return user;
  const account = await loadIdentityAccount(user.id);
  if (!account) return user;
  return { ...user, email: account.email || user.email, confirmedAt: account.confirmedAt };
}
