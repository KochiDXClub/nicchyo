import { Button } from "@/components/ui";

/** 一覧の CSV / JSON 出力ボタン（ページ見出しの actions に置く） */
export function ExportActions({
  onCsv,
  onJson,
  loading = false,
}: {
  onCsv: () => void;
  onJson: () => void;
  loading?: boolean;
}) {
  return (
    <>
      <Button variant="quiet" size="sm" onClick={onCsv} disabled={loading} aria-label="CSVファイルをエクスポート">
        CSV出力
      </Button>
      <Button variant="quiet" size="sm" onClick={onJson} disabled={loading} aria-label="JSONファイルをエクスポート">
        JSON出力
      </Button>
    </>
  );
}
