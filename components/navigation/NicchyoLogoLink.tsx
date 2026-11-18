import Image from "next/image";
import Link from "next/link";

const LOGO_SIZES = {
  compact: { width: 69, height: 32, className: "h-8 w-auto" },
  large: { width: 172, height: 80, className: "h-auto max-w-full" },
};

export function NicchyoLogo({
  alt = "nicchyo",
  size = "compact",
}: {
  alt?: string;
  size?: keyof typeof LOGO_SIZES;
}) {
  return <Image src="/images/nicchyo-logo.webp" alt={alt} {...LOGO_SIZES[size]} />;
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
