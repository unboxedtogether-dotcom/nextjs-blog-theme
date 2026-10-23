import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getUser, onAuthChange, refreshSession } from '@netlify/identity';

const AuthContext = createContext({ user: null, loading: true, member: null, refresh: async () => {}, updateMember: () => {} });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Display name and avatar version shown in the site header.
  const [memberState, setMemberState] = useState(null);

  const refresh = async () => {
    const currentUser = await getUser();
    setUser(currentUser);
    setLoading(false);
    return currentUser;
  };


  useEffect(() => {
    const callbackHash = window.location.hash;
    const isAuthCallback = /(?:confirmation|recovery|invite|access)_token=/.test(callbackHash);
    if (isAuthCallback && window.location.pathname !== '/auth/confirm') {
      window.location.replace(`/auth/confirm${callbackHash}`);
      return undefined;
    }

    getUser().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return onAuthChange((_event, nextUser) => {
      setUser(nextUser || null);
      setLoading(false);
    });
  }, []);

  const userId = user?.id;
  // Ignore details left over from a previous login.
  const member = memberState && memberState.userId === userId ? memberState : null;
  // Works even if the header lookup has not finished (or failed), so a new photo always reaches the header.
  const updateMember = useCallback((patch) => setMemberState((current) => (
    userId ? { ...(current?.userId === userId ? current : { userId }), ...patch } : current
  )), [userId]);
  useEffect(() => {
    if (!userId) return undefined;
    const controller = new AbortController();
    const load = () => fetch('/api/member?summary=1', { signal: controller.signal });
    load()
      // An expired session cookie (e.g. after a long break) is refreshed once and the lookup retried.
      .then(async (response) => (response.status === 401 && await refreshSession().catch(() => null) ? load() : response))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (data) updateMember({ name: data.displayName, avatarVersion: data.avatarUpdatedAt }); })
      .catch(() => {});
    return () => controller.abort();
  }, [userId, updateMember]);

  const value = useMemo(() => ({ user, loading, member, refresh, updateMember }), [user, loading, member, updateMember]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
