/**
 * PostgREST は既定で 1 リクエストあたり max_rows (1000) 件までしか返さず、
 * 超過分はエラーなしで黙って切り詰める。`.limit()` / 無指定の全件取得は件数が増えると
 * 行が欠けるため、`.range()` で最後まで読み切る。
 *
 * 呼び出し側は決定的な `.order()`（一意な列を最後に含める）を必ず付けること。
 * order が無い／重複があると、ページ境界で行が重複・欠落する。
 *
 * 次の取得位置は「受け取った件数」ぶんだけ進め、0 件のページが来たら終わる。
 * 「件数が pageSize 未満なら終わり」にすると、サーバー側の max_rows が pageSize より小さい設定のとき
 * 1 ページ目で終わってしまい、また黙って切り詰められる（そのぶん、最後に空ページを 1 回余分に取りに行く）。
 */

export const FETCH_ALL_PAGE_SIZE = 1000;
/** 暴走防止の上限（既定 50 ページ = 5 万行）。到達したら切り詰めとして警告する */
const DEFAULT_MAX_PAGES = 50;

type PageResult<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

export type FetchAllRowsOptions = {
  /** 警告ログ用のテーブル名など */
  label: string;
  pageSize?: number;
  maxPages?: number;
};

export type FetchAllRowsResult<T> = {
  data: T[];
  error: { message: string } | null;
  /** maxPages に達して打ち切った（取り切れていない可能性がある） */
  truncated: boolean;
};

export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PageResult<T>,
  { label, pageSize = FETCH_ALL_PAGE_SIZE, maxPages = DEFAULT_MAX_PAGES }: FetchAllRowsOptions
): Promise<FetchAllRowsResult<T>> {
  const all: T[] = [];
  let from = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) {
      // 途中までの行を成功扱いで返すと「古い/欠けた一覧」になるので、呼び出し側には空で失敗を伝える
      return { data: [], error, truncated: false };
    }
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      return { data: all, error: null, truncated: false };
    }
    all.push(...rows);
    from += rows.length;
  }
  console.warn(
    `[fetchAllRows] ${label} が ${maxPages} ページ (${all.length} 件) に達したため取得を打ち切りました`
  );
  return { data: all, error: null, truncated: true };
}
