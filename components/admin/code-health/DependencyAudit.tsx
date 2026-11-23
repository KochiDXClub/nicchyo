import type { SnapshotSummary } from "@/lib/code-health/types";

export function DependencyAudit({ audit }: { audit: SnapshotSummary["dependencyAudit"] }) {
  return (
    <section className="rounded-card bg-white p-4 shadow-card ring-1 ring-line">
      <h2 className="font-semibold">本番依存パッケージの既知の脆弱性</h2>
      {audit && <p className="text-sm">照合日時 {new Date(audit.checkedAt).toLocaleString("ja-JP")}</p>}
      {!audit ? <p>この記録では未検査です。</p> : audit.status === "unavailable" ?
        <p>npm audit の結果を取得できませんでした。</p> : (
          <>
            <p>影響が報告されたパッケージ {audit.packages.length}件</p>
            {audit.packages.map(item => (
              <details key={item.name} className="mt-2 text-sm">
                <summary>{item.severity} · {item.name} · {item.fix}</summary>
                <p>対象バージョン {item.range}</p>
                <ul>{item.advisories.map((v, i) => <li key={i}>{v.url ?
                  <a className="underline" href={v.url}>{v.title}</a> : v.title}</li>)}</ul>
              </details>
            ))}
          </>
        )}
    </section>
  );
}
