import type { Locale } from "@/lib/i18n";

interface LanguageFlagProps {
  locale: Locale;
}

export function LanguageFlag({ locale }: LanguageFlagProps): React.JSX.Element {
  const commonProps = {
    "aria-hidden": true,
    className: "language-flag-icon",
    "data-language-flag": locale,
    focusable: "false",
    viewBox: "0 0 30 18",
  } as const;

  switch (locale) {
    case "en":
      return (
        <svg {...commonProps} data-flag-variant="united-kingdom">
          <rect fill="#012169" height="18" width="30" />
          <path d="M0 0 30 18M30 0 0 18" stroke="#fff" strokeWidth="4" />
          <path d="M0 0 30 18M30 0 0 18" stroke="#c8102e" strokeWidth="2" />
          <path d="M15 0v18M0 9h30" stroke="#fff" strokeWidth="6" />
          <path d="M15 0v18M0 9h30" stroke="#c8102e" strokeWidth="3.5" />
        </svg>
      );
    case "ru":
      return (
        <svg {...commonProps}>
          <rect fill="#fff" height="6" width="30" />
          <rect fill="#0039a6" height="6" width="30" y="6" />
          <rect fill="#d52b1e" height="6" width="30" y="12" />
        </svg>
      );
    case "uk":
      return (
        <svg {...commonProps}>
          <rect fill="#0057b7" height="9" width="30" />
          <rect fill="#ffd700" height="9" width="30" y="9" />
        </svg>
      );
    case "be":
      return (
        <svg {...commonProps}>
          <rect fill="#d22730" height="12" width="30" />
          <rect fill="#00af66" height="6" width="30" y="12" />
          <rect fill="#fff" height="18" width="5" />
          <path
            d="M2.5 0 4.5 2.25 2.5 4.5.5 2.25Zm0 4.5 2 2.25-2 2.25-2-2.25Zm0 4.5 2 2.25-2 2.25-2-2.25Zm0 4.5 2 2.25L2.5 18l-2-2.25Z"
            fill="#d22730"
          />
        </svg>
      );
  }
}
