import { render, screen, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App';

const authState = {
  isAuthenticated: false,
  user: null as any,
  login: vi.fn(),
  logout: vi.fn()
};

vi.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => authState
}));

afterEach(() => {
  cleanup();
  authState.isAuthenticated = false;
  authState.user = null;
});

describe('App routing', () => {
  it('renders login page when unauthenticated', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /Weather Alerts/i })).toBeInTheDocument();
  });

  it('allows admin route when user has admin role', () => {
    authState.isAuthenticated = true;
    authState.user = { roles: ['admin'] };

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText(/Admin Overview/i)).toBeInTheDocument();
  });

  it('renders registration page', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Create Account/i })).toBeInTheDocument();
  });
});
