import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadKotodute,
  saveKotodute,
  KOTODUTE_UPDATED_EVENT,
  KotoduteNote,
} from './kotoduteStorage';

const STORAGE_KEY = 'nicchyo-kotodute-notes';

describe('kotoduteStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('loadKotodute', () => {
    it('returns default seed data when localStorage is empty', () => {
      const result = loadKotodute();
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('seed-1');
      expect(result[1].id).toBe('seed-2');
      expect(result[2].id).toBe('seed-3');
    });

    it('returns default seed data when localStorage contains invalid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid-json');
      const result = loadKotodute();
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('seed-1');
    });

    it('returns default seed data when localStorage contains valid JSON but not an array', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'an array' }));
      const result = loadKotodute();
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('seed-1');
    });

    it('returns default seed data when localStorage contains an empty array', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      const result = loadKotodute();
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('seed-1');
    });

    it('returns parsed data when localStorage contains valid data', () => {
      const validData: KotoduteNote[] = [
        {
          id: 'test-1',
          shopId: 100,
          text: 'Test note',
          createdAt: Date.now(),
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validData));

      const result = loadKotodute();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(validData[0]);
    });

    it('coerces invalid shopId (string) to "all"', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([
        { id: 'n1', shopId: '123', text: 'hello', createdAt: 1000 },
      ]));
      const result = loadKotodute();
      expect(result).toHaveLength(1);
      expect(result[0].shopId).toBe('all');
    });

    it('coerces negative shopId to "all"', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([
        { id: 'n1', shopId: -5, text: 'hello', createdAt: 1000 },
      ]));
      const result = loadKotodute();
      expect(result[0].shopId).toBe('all');
    });

    it('coerces fractional shopId to "all"', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([
        { id: 'n1', shopId: 1.5, text: 'hello', createdAt: 1000 },
      ]));
      const result = loadKotodute();
      expect(result[0].shopId).toBe('all');
    });

    it('drops notes missing id', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([
        { shopId: 1, text: 'no id', createdAt: 1000 },
        { id: 'valid', shopId: 1, text: 'ok', createdAt: 1000 },
      ]));
      const result = loadKotodute();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid');
    });

    it('drops notes missing text', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([
        { id: 'n1', shopId: 1, createdAt: 1000 },
        { id: 'n2', shopId: 1, text: 'ok', createdAt: 1000 },
      ]));
      const result = loadKotodute();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('n2');
    });

    it('keeps valid notes and drops invalid ones from mixed array', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([
        { id: 'good-1', shopId: 10, text: 'ok', createdAt: 1000 },
        { shopId: 10, text: 'missing id', createdAt: 1000 },
        { id: 'good-2', shopId: 'all', text: 'also ok', createdAt: 2000 },
        null,
        42,
      ]));
      const result = loadKotodute();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('good-1');
      expect(result[1].id).toBe('good-2');
    });

    it('falls back to seed when all notes are invalid', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([
        { shopId: 1, text: 'no id', createdAt: 1000 },
        { id: 'n2', text: 'no createdAt' },
      ]));
      const result = loadKotodute();
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('seed-1');
    });
  });

  describe('saveKotodute', () => {
    it('saves data to localStorage', () => {
      const notes: KotoduteNote[] = [
        {
          id: 'test-save',
          shopId: 'all',
          text: 'Saving test',
          createdAt: 1234567890,
        },
      ];

      saveKotodute(notes);

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual(notes);
    });

    it('dispatches update event', () => {
      const listener = vi.fn();
      window.addEventListener(KOTODUTE_UPDATED_EVENT, listener);

      const notes: KotoduteNote[] = [
        {
          id: 'test-event',
          shopId: 10,
          text: 'Event test',
          createdAt: 1234567890,
        },
      ];

      saveKotodute(notes);

      expect(listener).toHaveBeenCalledTimes(1);

      // Since the implementation does not pass data in the event detail (new Event(...)),
      // we just check that the event was fired.
      const event = listener.mock.calls[0][0] as Event;
      expect(event.type).toBe(KOTODUTE_UPDATED_EVENT);

      window.removeEventListener(KOTODUTE_UPDATED_EVENT, listener);
    });
  });
});
