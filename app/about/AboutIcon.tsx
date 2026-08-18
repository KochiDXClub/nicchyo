import React from "react";

export type AboutIconName =
  | "map"
  | "spark"
  | "chat"
  | "notebook"
  | "event"
  | "route"
  | "discover"
  | "store"
  | "compass";

type AboutIconProps = {
  name: AboutIconName | string; // Allow string to be flexible, but typed for known ones
  className?: string;
};

export function AboutIcon({ name, className }: AboutIconProps) {
  const props = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  } as const;

  switch (name) {
    case "map":
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 6.75 5.25 5.25 3 6.75v11.5l3.75-1.5 6 2.25 5.25-2.25V5.25L12.75 7.5 9 6.75Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75v11.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 7.5v11.25" />
        </svg>
      );
    case "spark":
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m12 3 1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 16.5 6.5 18 8 19" />
        </svg>
      );
    case "chat":
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5A2.25 2.25 0 0 1 19.5 6.75v6A2.25 2.25 0 0 1 17.25 15H9l-3.75 3v-3H6.75A2.25 2.25 0 0 1 4.5 12.75v-6Z"
          />
        </svg>
      );
    case "notebook":
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 5.25h10.5A1.5 1.5 0 0 1 18.75 6.75v11.5A1.5 1.5 0 0 1 17.25 19.75H6.75A1.5 1.5 0 0 1 5.25 18.25V6.75A1.5 1.5 0 0 1 6.75 5.25Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9h7.5M8.25 12h7.5M8.25 15h4.5" />
        </svg>
      );
    case "event":
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 4.5v3M17.25 4.5v3M4.5 8.25h15"
          />
          <rect
            x="4.5"
            y="6.75"
            width="15"
            height="12.75"
            rx="2.25"
            ry="2.25"
            stroke="currentColor"
            fill="none"
          />
        </svg>
      );
    case "route":
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18a2 2 0 1 0 0.01 0" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 6a2 2 0 1 0 0.01 0" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 17c4-1 4-6 8-7"
          />
        </svg>
      );
    case "discover":
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5 4.5 9l7.5 10.5L19.5 9 12 4.5Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="m9.5 12 2.5 1.5 2.5-4.5" />
        </svg>
      );
    case "store":
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 9.75 6 5.25h12l1.5 4.5"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9.75v7.5h12v-7.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25V12h6v5.25" />
        </svg>
      );
    case "compass":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.25" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m14.5 9.5-1.25 3.75-3.75 1.25 1.25-3.75 3.75-1.25Z"
          />
        </svg>
      );
    default:
      return null;
  }
}
