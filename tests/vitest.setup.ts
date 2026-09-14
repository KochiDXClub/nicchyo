import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: actual.cache ?? (<T extends (...args: unknown[]) => unknown>(fn: T): T => fn),
  };
});
