import { getDatabase } from '@netlify/database';

const db = getDatabase();

// Gives the Identity `admin` role to a confirmed account whose email is on the
// database admin allowlist (and not already bound to a different account), so
// the site owner does not have to set the role by hand in the dashboard.
async function withAllowlistedAdminRole(user) {
  const email = (user.email || '').trim().toLowerCase();
  const roles = user.appMetadata?.roles || [];
  if (!email || !user.confirmedAt || roles.includes('admin')) return null;
  const rows = await db.sql`SELECT 1 FROM member_admins WHERE email = ${email} AND (user_id IS NULL OR user_id = ${user.id})`;
  if (!rows.length) return null;
  return { ...user, appMetadata: { ...user.appMetadata, roles: [...new Set([...roles, 'member', 'admin'])] } };
}

const identityEvents = {
  async userSignup(event) {
    const metadata = event.user.userMetadata || {};
    const marketingConsent = metadata.marketing_consent === true;

    await db.sql`
      INSERT INTO profiles (id, display_name, marketing_consent, marketing_consented_at)
      VALUES (
        ${event.user.id},
        ${metadata.full_name || ''},
        ${marketingConsent},
        ${marketingConsent ? new Date().toISOString() : null}
      )
      ON CONFLICT (id) DO NOTHING
    `;

    return {
      user: {
        ...event.user,
        appMetadata: { ...event.user.appMetadata, roles: ['member'] },
      },
    };
  },

  async userLogin(event) {
    const user = await withAllowlistedAdminRole(event.user);
    if (user) return { user };
  },
};

export default identityEvents;
