import { describe, it, expect } from 'vitest';
import { getRoleTheme, ROLE_THEMES, DEFAULT_THEME } from '../../../lib/theme/roleTheme';

describe('getRoleTheme', () => {
  it('returns admin theme for admin role', () => {
    expect(getRoleTheme('admin')).toEqual(ROLE_THEMES.admin);
  });

  it('returns vendor theme for vendor role', () => {
    expect(getRoleTheme('vendor')).toEqual(ROLE_THEMES.vendor);
  });

  it('returns general_user theme for general_user role', () => {
    expect(getRoleTheme('general_user')).toEqual(ROLE_THEMES.general_user);
  });

  it('returns moderator theme for moderator role', () => {
    expect(getRoleTheme('moderator')).toEqual(ROLE_THEMES.moderator);
  });

  it('returns DEFAULT_THEME for null role', () => {
    expect(getRoleTheme(null)).toEqual(DEFAULT_THEME);
  });

  it('returns DEFAULT_THEME for undefined role', () => {
    expect(getRoleTheme(undefined)).toEqual(DEFAULT_THEME);
  });

  it('returns DEFAULT_THEME for unknown role', () => {
    // @ts-expect-error: Testing invalid input
    expect(getRoleTheme('unknown_role')).toEqual(DEFAULT_THEME);
  });
});
