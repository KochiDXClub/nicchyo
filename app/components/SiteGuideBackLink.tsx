import Link from "next/link";
import { Info } from "lucide-react";

export default function SiteGuideBackLink() {
  return (
    <Link
      href="/about/site"
      className="inline-flex min-h-11 items-center gap-2 rounded-btn text-sm font-semibold text-nicchyo-ink/75 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nicchyo-primary"
    >
      <Info aria-hidden className="h-4 w-4" />
      このサイトの運営とデータ
    </Link>
  );
}
