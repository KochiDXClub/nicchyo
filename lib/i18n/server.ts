import { headers } from "next/headers";
import { LOCALE_HEADER, toLocale, type Locale } from "./config";

/** proxy.ts が決めたこのリクエストのロケール（サーバーコンポーネント用） */
export async function getLocale(): Promise<Locale> {
  return toLocale((await headers()).get(LOCALE_HEADER));
}
