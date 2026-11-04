"use client";

import { useState } from "react";
import { AdminTabs, type AdminTab } from "@/components/admin/AdminTabs";
import { SiteAnnouncementSection } from "@/app/(public)/admin/outbox/components/SiteAnnouncementSection";
import { VendorNoticeSection } from "@/app/(public)/admin/outbox/components/VendorNoticeSection";

type TabKey = "site" | "vendor";

const TABS: readonly AdminTab<TabKey>[] = [
  { key: "site", label: "サイト内のお知らせ" },
  { key: "vendor", label: "出店者へのお知らせ" },
];

/**
 * 運営の /admin/outbox と同じ部品・同じ操作で、読み書きする API だけが /api/city/*。
 * 高知市は、メール配信は使えない。出店者へのお知らせは、差出人が「高知市から」に固定される。
 */
export function CityOutbox() {
  const [tab, setTab] = useState<TabKey>("site");

  return (
    <>
      <AdminTabs tabs={TABS} value={tab} onChange={setTab} ariaLabel="お知らせの送り先" />
      <div className="mx-auto max-w-3xl px-4 py-8">
        {tab === "site" && <SiteAnnouncementSection apiBase="/api/city" />}
        {tab === "vendor" && <VendorNoticeSection apiBase="/api/city" fixedSender="city" />}
      </div>
    </>
  );
}
