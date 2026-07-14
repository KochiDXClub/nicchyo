function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function reportReceivedTemplate(params: {
  targetName: string;
  reason: string;
  details?: string | null;
  adminUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `【nicchyo】新しい通報が届きました`;
  const text = [
    `新しい通報が届きました。`,
    `対象: ${params.targetName}`,
    `理由: ${params.reason}`,
    params.details ? `詳細: ${params.details}` : null,
    ``,
    `管理画面で確認してください: ${params.adminUrl}`,
  ].filter(Boolean).join("\n");

  const safeTargetName = esc(params.targetName);
  const safeReason = esc(params.reason);
  const safeDetails = params.details ? esc(params.details) : null;

  const html = `
<!DOCTYPE html><html lang="ja"><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h2 style="color:#e5620a;">🚩 新しい通報が届きました</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;background:#f8f8f8;font-weight:bold;width:100px;">対象</td><td style="padding:8px;">${safeTargetName}</td></tr>
  <tr><td style="padding:8px;background:#f8f8f8;font-weight:bold;">理由</td><td style="padding:8px;">${safeReason}</td></tr>
  ${safeDetails ? `<tr><td style="padding:8px;background:#f8f8f8;font-weight:bold;">詳細</td><td style="padding:8px;">${safeDetails}</td></tr>` : ""}
</table>
<a href="${params.adminUrl}" style="display:inline-block;background:#e5620a;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">管理画面で確認する</a>
<p style="color:#888;font-size:12px;margin-top:24px;">このメールは nicchyo 管理者向け自動送信メールです。</p>
</body></html>`;

  return { subject, html, text };
}

export function inquiryReceivedTemplate(params: {
  name: string | null;
  email: string;
  category: string;
  message: string;
  adminUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `【nicchyo】新しいお問い合わせが届きました`;
  const text = [
    `新しいお問い合わせが届きました。`,
    `送信者: ${params.name ?? "匿名"} <${params.email}>`,
    `カテゴリ: ${params.category}`,
    `内容:`,
    params.message,
    ``,
    `管理画面で確認してください: ${params.adminUrl}`,
  ].join("\n");

  const safeName = esc(params.name ?? "匿名");
  const safeEmail = esc(params.email);
  const safeCategory = esc(params.category);
  const safeMessage = esc(params.message);

  const html = `
<!DOCTYPE html><html lang="ja"><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h2 style="color:#e5620a;">✉️ 新しいお問い合わせが届きました</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;background:#f8f8f8;font-weight:bold;width:100px;">送信者</td><td style="padding:8px;">${safeName} &lt;${safeEmail}&gt;</td></tr>
  <tr><td style="padding:8px;background:#f8f8f8;font-weight:bold;">カテゴリ</td><td style="padding:8px;">${safeCategory}</td></tr>
  <tr><td style="padding:8px;background:#f8f8f8;font-weight:bold;">内容</td><td style="padding:8px;white-space:pre-wrap;">${safeMessage}</td></tr>
</table>
<a href="${params.adminUrl}" style="display:inline-block;background:#e5620a;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">管理画面で確認する</a>
<p style="color:#888;font-size:12px;margin-top:24px;">このメールは nicchyo 管理者向け自動送信メールです。</p>
</body></html>`;

  return { subject, html, text };
}
