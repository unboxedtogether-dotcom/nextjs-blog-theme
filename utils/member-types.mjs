// Member types shown under the member's name. Free and Subscribed are
// membership tiers, Moderator is a profile flag, and Admin and Owner come from
// the database admin allowlist. Free and Subscribed members currently see and
// can do the same things.
export const memberTypes = {
  free: 'Free Member',
  subscribed: 'Subscribed Member',
  moderator: 'Moderator',
  admin: 'Admin',
  owner: 'Owner',
};

// Types that can be assigned from the team area. Admin and Owner are managed
// through the admin allowlist instead.
export const assignableMemberTypes = ['free', 'subscribed', 'moderator'];

// `adminRole` is the allowlist role ('admin' or 'owner') of an authorised
// admin, or null for everyone else.
export function resolveMemberType({ membershipTier, isModerator, adminRole }) {
  if (adminRole === 'owner' || adminRole === 'admin') return adminRole;
  if (isModerator) return 'moderator';
  return membershipTier === 'subscribed' ? 'subscribed' : 'free';
}
