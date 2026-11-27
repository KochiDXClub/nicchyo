import React from "react";
import Link from "next/link";

interface MenuCardProps {
  title: string;
  description: string;
  icon: string;
  href: string;
  bgColor: string;
}

export const MenuCard = React.memo(function MenuCard({
  title,
  description,
  icon,
  href,
  bgColor,
}: MenuCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-lg bg-white p-6 shadow transition hover:shadow-lg"
    >
      <div
        className={`inline-flex h-12 w-12 items-center justify-center rounded-lg ${bgColor} mb-4`}
      >
        <span className="text-2xl" aria-hidden="true">
          {icon}
        </span>
      </div>
      <h3 className="text-lg font-bold text-nicchyo-ink">{title}</h3>
      <p className="mt-2 text-sm text-nicchyo-ink/70">{description}</p>
    </Link>
  );
});
