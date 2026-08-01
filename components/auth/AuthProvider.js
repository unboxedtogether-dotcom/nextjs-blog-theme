import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getUser, onAuthChange } from '@netlify/identity';

const AuthContext = createContext({ user: null, loading: true, refresh: async () => {} });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const value = useMemo(() => ({ user, loading, refresh }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
