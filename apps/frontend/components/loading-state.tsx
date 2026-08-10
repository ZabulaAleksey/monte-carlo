import { useI18n } from "@/lib/i18n";

export function LoadingState(): React.JSX.Element {
  const { t } = useI18n();
  return (
    <div className="loading-grid" aria-label={t("loading.label")}>
      {Array.from({ length: 4 }, (_, index) => (
        <div className="skeleton" key={index} />
      ))}
    </div>
  );
}
