import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: actual.cache ?? (<T extends (...args: unknown[]) => unknown>(fn: T): T => fn),
  };
});

// タブのあいだだけ覚えておく仕組み（sessionStorage）が、前のテストの内容を次のテストへ持ち越さないようにする
afterEach(() => {
  if (typeof window !== 'undefined') window.sessionStorage.clear();
});
