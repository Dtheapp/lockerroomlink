import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// Mock all lazy-loaded components
vi.mock('../components/AuthScreen', () => ({
  default: () => <div data-testid="auth-screen">Auth Screen</div>,
}));
vi.mock('../components/Dashboard', () => ({
  default: () => <div data-testid="dashboard">Dashboard</div>,
}));
vi.mock('../components/Profile', () => ({
  default: () => <div data-testid="profile">Profile</div>,
}));
vi.mock('../components/Roster', () => ({
  default: () => <div data-testid="roster">Roster</div>,
}));
vi.mock('../components/Stats', () => ({
  default: () => <div data-testid="stats">Stats</div>,
}));
vi.mock('../components/Playbook', () => ({
  default: () => <div data-testid="playbook">Playbook</div>,
}));
vi.mock('../components/VideoLibrary', () => ({
  default: () => <div data-testid="video-library">Video Library</div>,
}));
vi.mock('../components/Messenger', () => ({
  default: () => <div data-testid="messenger">Messenger</div>,
}));
vi.mock('../components/Chat', () => ({
  default: () => <div data-testid="chat">Chat</div>,
}));
vi.mock('../components/admin/AdminDashboard', () => ({
  default: () => <div data-testid="admin-dashboard">Admin Dashboard</div>,
}));
vi.mock('../components/admin/ManageUsers', () => ({
  default: () => <div data-testid="manage-users">Manage Users</div>,
}));
vi.mock('../components/admin/ManageTeams', () => ({
  default: () => <div data-testid="manage-teams">Manage Teams</div>,
}));
vi.mock('../components/admin/UserReport', () => ({
  default: () => <div data-testid="user-report">User Report</div>,
}));

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: null,
    isAdmin: false,
    loading: false,
    userData: null,
  }),
}));

// Mock Layout
vi.mock('../layout/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));
vi.mock('../layout/AdminLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="admin-layout">{children}</div>,
}));

describe('App', () => {
  it('should be importable', async () => {
    // This is a basic smoke test to ensure the app module can be imported
    const module = await import('../App');
    expect(module.default).toBeDefined();
  });
});

describe('Application Structure', () => {
  it('should have types defined', async () => {
    const typesModule = await import('../types');
    expect(typesModule).toBeDefined();
  });
});
