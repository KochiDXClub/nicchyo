"use client";

/**
 * 現場登録の「英語版」の状態と操作。FieldShopEditor から使う。
 * 英語版は、AI の訳を見せて直させ、日本語の保存のあとに PUT で保存する。保存するまで来訪者には出ない。
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { showToast } from "@/lib/admin/toast";
import { isEnglishEmpty, type EnglishDraft } from "./FieldEnglishCard";
import { readError } from "./fieldFormParts";

/** 訳す原文（日本語）を持つフォームの形。FieldShopEditor の FormState のうち、翻訳に関わる部分 */
export type TranslationForm = { shop_name: string; strength: string; style: string; products: { name: string }[] };

export type StoredTranslation = {
  translation: { name: string | null; strength: string | null; style: string | null; products: Record<string, string> };
  status: "auto" | "reviewed";
  stale: boolean;
};

type EnglishStatus = "auto" | "reviewed" | null;

export type EnglishSnapshot = { english: EnglishDraft | null; status: EnglishStatus; translatedFrom: string | null; dirty: boolean; stale: boolean };

/** 訳す原文（日本語）の印。英語版を作ったときの日本語から変わったかを見分ける。商品は名前の集合で見る */
function sourceKey(form: TranslationForm): string {
  const names = [...new Set(form.products.map((p) => p.name.trim()).filter(Boolean))].sort();
  return JSON.stringify([form.shop_name.trim(), form.strength.trim(), form.style.trim(), names]);
}

/** 訳したときの日本語が分からない（日本語を直したあと保存済みの英語版）ことを表す。どの日本語とも一致しない */
const STALE_SOURCE = "\u0000";

function toEnglishDraft(stored: StoredTranslation): EnglishDraft {
  return {
    name: stored.translation.name ?? "",
    strength: stored.translation.strength ?? "",
    style: stored.translation.style ?? "",
    products: stored.translation.products ?? {},
  };
}

export function useFieldEnglish(shopId: string, form: TranslationForm | null, markDirty: () => void) {
  const [english, setEnglish] = useState<EnglishDraft | null>(null);
  const [status, setStatus] = useState<EnglishStatus>(null);
  /** 英語版を作った（または読み込んだ）時点の日本語の印 */
  const [translatedFrom, setTranslatedFrom] = useState<string | null>(null);
  /** 画面の英語版が、保存済みの英語版から変わっている（保存のとき書き込む） */
  const [dirty, setDirty] = useState(false);
  const [translating, setTranslating] = useState(false);
  /** 日本語（訳す原文）を直すたびに進める。翻訳中に日本語が変わったら、古い原文の訳は捨てる */
  const sourceVersionRef = useRef(0);

  const productNames = useMemo(() => [...new Set((form?.products ?? []).map((p) => p.name.trim()).filter(Boolean))], [form?.products]);
  const hasEnglish = !isEnglishEmpty(english);
  const state: "none" | "fresh" | "stale" = !hasEnglish ? "none" : translatedFrom !== null && form && translatedFrom !== sourceKey(form) ? "stale" : "fresh";
  const canTranslate = !!form && (form.shop_name.trim() !== "" || form.strength.trim() !== "" || form.style.trim() !== "" || productNames.length > 0);

  /** 日本語（店名・ひとこと・出店スタイル・商品）を直したときに呼ぶ */
  const bumpSource = useCallback(() => {
    sourceVersionRef.current += 1;
  }, []);

  /** 保存済みの英語版（無ければ null）を読み込んだとき */
  const applyLoaded = useCallback((stored: StoredTranslation | null, loadedForm: TranslationForm) => {
    setEnglish(stored ? toEnglishDraft(stored) : null);
    setStatus(stored ? stored.status : null);
    setTranslatedFrom(stored ? (stored.stale ? STALE_SOURCE : sourceKey(loadedForm)) : null);
    setDirty(false);
    sourceVersionRef.current += 1;
  }, []);

  const snapshot = (): EnglishSnapshot => ({ english, status, translatedFrom, dirty, stale: state === "stale" });

  const restore = (s: EnglishSnapshot) => {
    setEnglish(s.english);
    setStatus(s.status);
    setTranslatedFrom(s.translatedFrom);
    setDirty(true);
    markDirty();
  };

  /** 画面に入っている日本語を英語にする（サーバーで AI を呼ぶ）。結果は英語欄に入れるだけで、保存はしない */
  const translate = async () => {
    if (!form || !canTranslate) return;
    if (hasEnglish && status === "reviewed" && dirty && !window.confirm("手直しした英語版は、新しい翻訳で置き換わります。よろしいですか？")) return;
    const version = sourceVersionRef.current;
    const requestedKey = sourceKey(form);
    setTranslating(true);
    try {
      const res = await fetch("/api/admin/shop-translations/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.shop_name, strength: form.strength, style: form.style, products: productNames }),
      });
      if (!res.ok) throw new Error((await readError(res, "翻訳できませんでした")).message);
      const data = (await res.json()) as { name: string | null; strength: string | null; style: string | null; products: Record<string, string> };
      // 翻訳中に日本語を直したら、古い原文の訳は入れない
      if (version !== sourceVersionRef.current) {
        showToast.error("翻訳している間に日本語が変わりました。もう一度翻訳してください");
        return;
      }
      setEnglish({
        name: data.name ?? "",
        strength: data.strength ?? "",
        style: data.style ?? "",
        // 商品名の欄に無い商品（写真つきなど）の訳は、そのまま残す
        products: { ...english?.products, ...Object.fromEntries(productNames.map((n) => [n, data.products?.[n] ?? ""])) },
      });
      setStatus("auto");
      setTranslatedFrom(requestedKey);
      setDirty(true);
      markDirty();
      showToast.success("英語に翻訳しました。内容を確認してから保存してください");
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "翻訳できませんでした");
    } finally {
      setTranslating(false);
    }
  };

  const edit = (draft: EnglishDraft) => {
    setEnglish(draft);
    setStatus("reviewed");
    setDirty(true);
    markDirty();
  };

  const clear = () => {
    if (hasEnglish && !window.confirm("英語版を消します。保存すると、あとで自動の翻訳が作り直します。よろしいですか？")) return;
    setEnglish(null);
    setStatus(null);
    setTranslatedFrom(null);
    setDirty(true);
    markDirty();
  };

  /** 日本語を直したあとの英語版を、運営が確認して「日本語に合っている」とする（保存で、いまの日本語に合わせて記録する） */
  const confirmFresh = () => {
    if (!form) return;
    setTranslatedFrom(sourceKey(form));
    setStatus("reviewed");
    setDirty(true);
    markDirty();
  };

  /** 日本語を保存したあとに、英語版を保存する。失敗したときはメッセージを返す（日本語は保存済み） */
  const saveToServer = async (s: EnglishSnapshot, sourceUpdatedAt: string | null): Promise<string | null> => {
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/translation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // 日本語を直したあと確認していない英語は、日本語に合うものとして保存しない
          stale: s.stale,
          // 日本語を保存した時点の印。そのあとほかの人が日本語を変えていたら、サーバーが「確認していない英語」として保存する
          sourceUpdatedAt,
          name: s.english?.name ?? "",
          strength: s.english?.strength ?? "",
          style: s.english?.style ?? "",
          // 写真つきの商品など、商品名の欄に無くても公開されている名前の訳は残す。無くなった商品はサーバーが捨てる
          products: s.english?.products ?? {},
        }),
      });
      return res.ok ? null : (await readError(res, "英語版を保存できませんでした")).message;
    } catch {
      return "英語版を保存できませんでした";
    }
  };

  return { english, status, state, translating, canTranslate, productNames, dirty, bumpSource, applyLoaded, snapshot, restore, translate, edit, clear, confirmFresh, saveToServer };
}
