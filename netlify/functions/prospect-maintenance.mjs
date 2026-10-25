import { deliverQueuedEmails } from './_shared/email.mjs';
import { runRetention } from './_shared/prospect-store.mjs';

// Retries queued emails (only once an email provider is configured) and
// applies the prospect retention rules.
export default async function prospectMaintenance() {
  const delivery = await deliverQueuedEmails().catch((error) => ({ error: error.message }));
  const retention = await runRetention();
  console.log('Prospect maintenance', JSON.stringify({ delivery, retention }));
}

export const config = { schedule: '@hourly' };
