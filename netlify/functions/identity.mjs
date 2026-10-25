import { getDatabase } from '@netlify/database';
import { deliverQueuedEmails, queueEmail } from './_shared/email.mjs';
import { recordConsent, withMemberAccess } from './_shared/member-access.mjs';

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

    // Consent ticked on the signup form belongs in the consent history too,
    // so the team area shows when and how it was given.
    if (marketingConsent) {
      try {
        await withMemberAccess(event.user.id, async (query) => {
          const [existing] = await query("SELECT 1 FROM member_consent_events WHERE user_id = $1 AND consent_type = 'marketing_email' LIMIT 1", [event.user.id]);
          if (!existing) await recordConsent(query, event.user.id, 'marketing_email', 'given', metadata.full_name || null);
        });
      } catch (error) {
        console.error('Signup consent not recorded', error.message);
      }
    }

    // One branded welcome email per member. It waits in the outbox until an
    // email provider is configured, and a failure here never blocks signup.
    if (event.user.email) {
      try {
        const id = await queueEmail({ kind: 'member_welcome', to: event.user.email, userId: event.user.id, payload: { firstName: (metadata.full_name || '').split(' ')[0] } });
        if (id) await deliverQueuedEmails({ ids: [id] });
      } catch (error) {
        console.error('Welcome email not queued', error.message);
      }
    }

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
