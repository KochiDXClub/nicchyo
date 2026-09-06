"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 音声入力（Web Speech API）
 *
 * ブラウザ内蔵の認識器を使うので API 課金はかからない。
 * 対応していない端末では isSupported が false になるので、呼び出し側で
 * 文字入力へ逃がすこと。
 *
 * 日曜市は屋外で騒がしく、認識はかなり失敗する。そのため確定した文字列は
 * onSettled で呼び出し側へ渡すだけにして、「そのまま送信」はしない。
 * 送るかどうかは利用者に確認させる。
 */

type SpeechResultEvent = {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

type SpeechRecognitionLike = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeechInputOptions {
  /** 認識が終わったときに、確定した文字列を受け取る（空文字なら聞き取れなかった） */
  onSettled?: (transcript: string) => void;
  /** マイクを拒否された・回線が無いなど、認識が始められなかったとき */
  onError?: () => void;
  lang?: string;
}

export interface UseSpeechInput {
  isSupported: boolean;
  isListening: boolean;
  /** 認識中の暫定テキスト。話している内容がその場で見えるようにするため */
  interim: string;
  start: () => void;
  stop: () => void;
}

export function useSpeechInput({
  onSettled,
  onError,
  lang = "ja-JP",
}: UseSpeechInputOptions = {}): UseSpeechInput {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState("");

  const constructorRef = useRef<SpeechRecognitionConstructor | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  // onSettled を ref に逃がしておかないと、認識中に再レンダリングが挟まったとき
  // 古いクロージャを呼んでしまう
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  // エラーの直後は onend も来る。二重に知らせないための印
  const erroredRef = useRef(false);

  useEffect(() => {
    const speechConstructor = getSpeechConstructor();
    constructorRef.current = speechConstructor;
    setIsSupported(!!speechConstructor);
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const speechConstructor = constructorRef.current;
    if (!speechConstructor) return;
    if (recognitionRef.current && isListening) {
      stop();
      return;
    }

    const recognition = recognitionRef.current ?? new speechConstructor();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = true;
    transcriptRef.current = "";
    erroredRef.current = false;
    setInterim("");

    recognition.onresult = (event) => {
      const text = Array.from(event.results ?? [])
        .map((result) => result[0]?.transcript ?? "")
        .join("");
      transcriptRef.current = text;
      setInterim(text);
    };
    recognition.onerror = () => {
      erroredRef.current = true;
      setIsListening(false);
      onErrorRef.current?.();
    };
    recognition.onend = () => {
      setIsListening(false);
      if (erroredRef.current) {
        erroredRef.current = false;
        return;
      }
      onSettledRef.current?.(transcriptRef.current.trim());
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, [isListening, lang, stop]);

  return { isSupported, isListening, interim, start, stop };
}
