import { CircleAlert } from "lucide-react";

import { useI18n } from "@/lib/i18n";

export function ErrorState({ message }: { message: string }): React.JSX.Element {
  const { t } = useI18n();
  const translatedMessage = message === "Backend is unavailable"
    ? t("error.backendUnavailable")
    : message === "API request failed"
      ? t("error.apiFailed")
      : message === "Unknown error"
        ? t("error.unknown")
        : message;

  return (
    <div className="error-state" role="alert">
      <CircleAlert aria-hidden="true" size={20} />
      <div>
        <strong>{t("error.title")}</strong>
        <p>{translatedMessage}. {t("error.guidance")}</p>
      </div>
    </div>
  );
}
