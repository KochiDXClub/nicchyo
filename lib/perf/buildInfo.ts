/**
 * 「どのコードで計測したか」を表すビルド情報
 *
 * Vercel 上では環境変数から、ローカルでは git から取る。
 * サーバー側（Server Component / API）でのみ呼ぶこと。
 */

import { execSync } from "node:child_process";

export type BuildEnvironment = "production" | "preview" | "local" | "unknown";

export interface BuildInfo {
  branch: string;
  commitSha: string;
  environment: BuildEnvironment;
  deploymentUrl: string;
}

function git(args: string): string {
  try {
    return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"], timeout: 3000 })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

export function getBuildInfo(): BuildInfo {
  const vercelEnv = process.env.VERCEL_ENV;
  const environment: BuildEnvironment =
    vercelEnv === "production"
      ? "production"
      : vercelEnv === "preview"
        ? "preview"
        : process.env.VERCEL
          ? "unknown"
          : "local";

  const branch = process.env.VERCEL_GIT_COMMIT_REF || git("rev-parse --abbrev-ref HEAD");
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || git("rev-parse HEAD");
  const deploymentUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";

  return { branch, commitSha, environment, deploymentUrl };
}
