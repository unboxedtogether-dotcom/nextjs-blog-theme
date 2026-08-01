import { getDatabase } from '@netlify/database';

const db = getDatabase();

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
};

export default identityEvents;
