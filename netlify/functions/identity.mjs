import { getDatabase } from '@netlify/database';
import { deliverQueuedEmails, queueEmail } from './_shared/email.mjs';
import { ensureProfile, recordConsent, withMemberAccess } from './_shared/member-access.mjs';
import { attributeRegistration } from './_shared/referrals.mjs';

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

    const email = String(event.user.email || '').trim().toLowerCase();
    // This event runs when the email is confirmed, so the account is verified now.
    await db.sql`
      INSERT INTO profiles (id, display_name, marketing_consent, marketing_consented_at, account_email, email_verified_at, identity_synced_at)
      VALUES (
        ${event.user.id},
        ${metadata.full_name || ''},
        ${marketingConsent},
        ${marketingConsent ? new Date().toISOString() : null},
        ${email.length >= 3 && email.length <= 254 ? email : null},
        ${event.user.confirmedAt || new Date().toISOString()},
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;
    // A profile the team area made earlier from the Identity account is now confirmed.
    await db.sql`UPDATE profiles SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ${event.user.id}`;

    // Credits the member who invited them, if they came from a referral link.
    try {
      await attributeRegistration({ ...event.user, confirmedAt: event.user.confirmedAt || new Date().toISOString() });
    } catch (error) {
      console.error('Referral not attributed', error.message);
    }

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

  // Every login also repairs a missing profile (for accounts whose signup
  // event did not run) and picks up a referral not yet credited. Neither can
  // ever block the login.
  async userLogin(event) {
    try {
      await ensureProfile(event.user);
      await attributeRegistration(event.user);
    } catch (error) {
      console.error('Login profile sync failed', error.message);
    }
    const user = await withAllowlistedAdminRole(event.user);
    if (user) return { user };
  },
};

export default identityEvents;
