import Image from "next/image";
import Link from "next/link";

export function NicchyoLogo({ alt = "nicchyo" }: { alt?: string }) {
  return (
    <Image
      src="/images/nicchyo-logo.webp"
      alt={alt}
      width={69}
      height={32}
      className="h-8 w-auto"
    />
  );
}

export function NicchyoLogoLink({
  href = "/",
  label = "nicchyo トップへ",
  onClick,
}: {
  href?: string;
  label?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      onClick={onClick}
      className="inline-flex min-h-11 shrink-0 items-center rounded-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-nicchyo-primary"
    >
      <NicchyoLogo alt="" />
    </Link>
  );
}
