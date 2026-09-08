import { describe, it, expect } from 'vitest';
import { buildConsultGreeting, pickSalutation } from './consultGreeting';
import type { ConsultGreetingScript } from '@/app/(public)/consult/data/consultCharacters';
import { CONSULT_CHARACTERS } from '@/app/(public)/consult/data/consultCharacters';

const script: ConsultGreetingScript = {
  morning: 'おはよう。',
  afternoon: 'こんにちは。',
  evening: 'こんばんは。',
  lines: ['今日はええ風やねぇ。', '今日はどこから歩こうかね。', 'お腹すいたら屋台ものぞいてみて。'],
};

describe('pickSalutation', () => {
  it('朝市の時間帯は朝の呼びかけ', () => {
    expect(pickSalutation(script, 5)).toBe('おはよう。');
    expect(pickSalutation(script, 10)).toBe('おはよう。');
  });

  it('昼から夕方までは昼の呼びかけ', () => {
    expect(pickSalutation(script, 11)).toBe('こんにちは。');
    expect(pickSalutation(script, 17)).toBe('こんにちは。');
  });

  it('日が暮れてからは夜の呼びかけ', () => {
    expect(pickSalutation(script, 18)).toBe('こんばんは。');
    expect(pickSalutation(script, 23)).toBe('こんばんは。');
  });

  it('人ごとの言い方をそのまま使う', () => {
    const yosako: ConsultGreetingScript = { ...script, morning: 'おはよー！' };
    expect(pickSalutation(yosako, 8)).toBe('おはよー！');
  });
});

describe('buildConsultGreeting', () => {
  const now = new Date('2026-09-06T08:30:00');

  it('呼びかけとひとことをつないで返す', () => {
    expect(buildConsultGreeting({ now, script, index: 0 })).toBe('おはよう。今日はええ風やねぇ。');
  });

  it('番号を進めると次のひとことになる', () => {
    expect(buildConsultGreeting({ now, script, index: 1 })).toBe('おはよう。今日はどこから歩こうかね。');
    expect(buildConsultGreeting({ now, script, index: 2 })).toBe('おはよう。お腹すいたら屋台ものぞいてみて。');
  });

  it('台本を一周したら先頭に戻る', () => {
    expect(buildConsultGreeting({ now, script, index: 3 })).toBe('おはよう。今日はええ風やねぇ。');
    expect(buildConsultGreeting({ now, script, index: 7 })).toBe('おはよう。今日はどこから歩こうかね。');
  });

  it('番号が負でも落ちない', () => {
    expect(buildConsultGreeting({ now, script, index: -1 })).toBe('おはよう。お腹すいたら屋台ものぞいてみて。');
  });

  it('台本が空でも黙らない', () => {
    const greeting = buildConsultGreeting({
      now: new Date('2026-09-06T20:00:00'),
      script: { ...script, lines: [] },
      index: 0,
    });

    expect(greeting).toBe('こんばんは。なんでも聞いてね。');
  });
});

describe('話し手ごとの台本', () => {
  it('全員が呼びかけとひとことを持っている', () => {
    for (const character of CONSULT_CHARACTERS) {
      expect(character.greeting.morning).not.toBe('');
      expect(character.greeting.afternoon).not.toBe('');
      expect(character.greeting.evening).not.toBe('');
      expect(character.greeting.lines.length).toBeGreaterThan(1);
    }
  });

  it('人が違えば最初のひとことも違う（口調を分けている）', () => {
    const firstLines = CONSULT_CHARACTERS.map((character) =>
      buildConsultGreeting({ now: new Date('2026-09-06T08:30:00'), script: character.greeting, index: 0 })
    );

    expect(new Set(firstLines).size).toBe(CONSULT_CHARACTERS.length);
  });
});
