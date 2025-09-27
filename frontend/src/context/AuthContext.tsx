import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { fetchProfile, login as loginRequest, setAuthToken, UserProfile } from '../services/api';

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (token) {
      setAuthToken(token);
      fetchProfile()
        .then(setUser)
        .catch(() => logout());
    } else {
      setAuthToken(undefined);
      setUser(null);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const { access_token } = await loginRequest(email, password);
    localStorage.setItem('accessToken', access_token);
    setToken(access_token);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
    }),
    [user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
