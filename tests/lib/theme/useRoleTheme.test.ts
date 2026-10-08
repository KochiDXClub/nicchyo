import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRoleTheme } from '../../../lib/theme/useRoleTheme';
import { useAuth } from '../../../lib/auth/AuthContext';
import { ROLE_THEMES, DEFAULT_THEME } from '../../../lib/theme/roleTheme';

// Mock useAuth hook
vi.mock('../../../lib/auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

function mockUser(user: Partial<NonNullable<ReturnType<typeof useAuth>['user']>> | null | undefined) {
  vi.mocked(useAuth).mockReturnValue({ user } as unknown as ReturnType<typeof useAuth>);
}

describe('useRoleTheme hook', () => {
  it('returns admin theme when user role is admin', () => {
    mockUser({ role: 'admin' });
    const { result } = renderHook(() => useRoleTheme());
    expect(result.current).toEqual(ROLE_THEMES.admin);
  });

  it('returns vendor theme when user role is vendor', () => {
    mockUser({ role: 'vendor' });
    const { result } = renderHook(() => useRoleTheme());
    expect(result.current).toEqual(ROLE_THEMES.vendor);
  });

  it('returns general_user theme when user role is general_user', () => {
    mockUser({ role: 'general_user' });
    const { result } = renderHook(() => useRoleTheme());
    expect(result.current).toEqual(ROLE_THEMES.general_user);
  });

  it('returns DEFAULT_THEME when user is null', () => {
    mockUser(null);
    const { result } = renderHook(() => useRoleTheme());
    expect(result.current).toEqual(DEFAULT_THEME);
  });

  it('returns DEFAULT_THEME when user is undefined', () => {
    mockUser(undefined);
    const { result } = renderHook(() => useRoleTheme());
    expect(result.current).toEqual(DEFAULT_THEME);
  });
});
