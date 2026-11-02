import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import ConsultClient from "./ConsultClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("AIに相談する"),
    description: t(
      "AIキャラクター「にちよさん」が高知・日曜市のお店をご案内します。食べ物・工芸品・体験など何でも聞いてみてください。"
    ),
    openGraph: {
      title: `${t("AIに相談する")} | nicchyo`,
      description: t("AIキャラクター「にちよさん」が高知・日曜市のお店をご案内します。"),
    },
  };
}

export default async function ConsultPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-[var(--consult-bg)]" />}>
      <ConsultClient />
    </Suspense>
  );
}
