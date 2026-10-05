import { useTranslation } from "react-i18next";
import type { ImageCacheStats } from "../types";

interface ImageCacheSummaryProps {
  stats: ImageCacheStats;
  onClear: () => void;
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function ImageCacheSummary({ stats, onClear }: ImageCacheSummaryProps) {
  const { t } = useTranslation();

  function handleClear() {
    if (stats.count <= 0) {
      return;
    }

    if (window.confirm(t("tasks.cache.clearConfirm"))) {
      onClear();
    }
  }

  return (
    <div
      className={`rounded border px-4 py-3 text-sm ${
        stats.overWarning ? "border-accent/40 bg-accent/10 text-accent" : "border-surface-3 bg-surface-2 text-text-secondary"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="font-medium text-text-primary">{t("tasks.cache.title")}</div>
          <div className="mt-1 text-xs">
            {t("tasks.cache.summary", {
              count: stats.count,
              size: formatBytes(stats.size),
            })}
          </div>
          {stats.overWarning ? <div className="mt-1 text-xs">{t("tasks.cache.warning")}</div> : null}
        </div>
        <button
          type="button"
          className="shrink-0 self-start rounded border border-surface-3 bg-surface-1 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:cursor-not-allowed disabled:text-text-tertiary disabled:opacity-50"
          disabled={stats.count <= 0}
          onClick={handleClear}
        >
          {t("tasks.cache.clear")}
        </button>
      </div>
    </div>
  );
}
