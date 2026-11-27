import { redirect } from "next/navigation";

/**
 * 質問に答えるページ（/my-shop/ask）は、店舗の編集（/vendor/store）に一本化した。
 * 出店者トップの吹き出しからの道は残すので、そこから「続きを答える」を開いた状態で送る。
 */
export default function VendorAskRedirectPage() {
  redirect("/vendor/store?continue=1");
}
