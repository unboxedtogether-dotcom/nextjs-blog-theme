import { getStore } from '@netlify/blobs';

// Private store: blobs are never public and are only read through member-avatar.
export const avatarStore = () => getStore({ name: 'member-avatars', consistency: 'strong' });
export const avatarKey = (userId) => `avatars/${userId}`;
