import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
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
  const [user, setUser] = useState<UserProfile | null>(() => {
    const raw = localStorage.getItem('currentUser');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserProfile;
    } catch (error) {
      console.warn('Failed to parse stored user', error);
      return null;
    }
  });

  useEffect(() => {
    if (token) {
      setAuthToken(token);
      fetchProfile()
        .then((profile) => {
          setUser(profile);
          localStorage.setItem('currentUser', JSON.stringify(profile));
        })
        .catch((error: AxiosError | Error) => {
          const status = 'response' in error ? error.response?.status : undefined;
          if (status === 401) {
            logout();
          } else {
            console.error('Failed to refresh profile', error);
          }
        });
    } else {
      setAuthToken(undefined);
      setUser(null);
      localStorage.removeItem('currentUser');
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const { access_token } = await loginRequest(email, password);
    localStorage.setItem('accessToken', access_token);
    setToken(access_token);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentUser');
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
