import { describe, it, expect } from 'vitest';
import { buildConsultGreeting, pickSalutation } from './consultGreeting';

describe('pickSalutation', () => {
  it('朝市の時間帯は「おはよう」', () => {
    expect(pickSalutation(5)).toBe('おはよう。');
    expect(pickSalutation(10)).toBe('おはよう。');
  });

  it('昼から夕方までは「こんにちは」', () => {
    expect(pickSalutation(11)).toBe('こんにちは。');
    expect(pickSalutation(17)).toBe('こんにちは。');
  });

  it('日が暮れてからは「こんばんは」', () => {
    expect(pickSalutation(18)).toBe('こんばんは。');
    expect(pickSalutation(23)).toBe('こんばんは。');
  });
});

describe('buildConsultGreeting', () => {
  const lines = ['今日はええ風やねぇ。', '今日はどこから歩こうかね。', 'お腹すいたら屋台ものぞいてみて。'];

  it('呼びかけとひとことをつないで返す', () => {
    const greeting = buildConsultGreeting({
      now: new Date('2026-09-06T08:30:00'),
      lines,
      random: 0,
    });

    expect(greeting).toBe('おはよう。今日はええ風やねぇ。');
  });

  it('引く値でひとことが変わる', () => {
    const first = buildConsultGreeting({ now: new Date('2026-09-06T13:00:00'), lines, random: 0 });
    const last = buildConsultGreeting({ now: new Date('2026-09-06T13:00:00'), lines, random: 0.99 });

    expect(first).toBe('こんにちは。今日はええ風やねぇ。');
    expect(last).toBe('こんにちは。お腹すいたら屋台ものぞいてみて。');
  });

  it('引く値が 1 でも範囲を外れない', () => {
    const greeting = buildConsultGreeting({ now: new Date('2026-09-06T13:00:00'), lines, random: 1 });

    expect(greeting).toBe('こんにちは。お腹すいたら屋台ものぞいてみて。');
  });

  it('ひとこと集が空でも黙らない', () => {
    const greeting = buildConsultGreeting({
      now: new Date('2026-09-06T20:00:00'),
      lines: [],
      random: 0.5,
    });

    expect(greeting).toBe('こんばんは。なんでも聞いてや。');
  });
});
