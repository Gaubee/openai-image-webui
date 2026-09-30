import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { downloadImage } from "../lib/download";

export interface PreviewState {
  urls: string[];
  index: number;
}

interface ImagePreviewModalProps {
  preview: PreviewState | null;
  onNavigate: (index: number) => void;
  onClose: () => void;
}

const navButtonClass =
  "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/70 text-2xl leading-none text-white transition hover:bg-slate-800";

export function ImagePreviewModal({ preview, onNavigate, onClose }: ImagePreviewModalProps) {
  const { t } = useTranslation();
  const count = preview?.urls.length ?? 0;
  const index = preview?.index ?? 0;

  useEffect(() => {
    if (!preview) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft" && count > 1) {
        onNavigate((index - 1 + count) % count);
      } else if (event.key === "ArrowRight" && count > 1) {
        onNavigate((index + 1) % count);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [preview, count, index, onClose, onNavigate]);

  if (!preview) {
    return null;
  }

  const imageUrl = preview.urls[index];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur">
      <button
        className="absolute inset-0 h-full w-full"
        type="button"
        onClick={onClose}
        aria-label={t("preview.closePreview")}
      />
      <div className="relative max-h-full max-w-6xl overflow-hidden rounded-3xl bg-white p-3 shadow-2xl">
        <div className="absolute right-4 top-4 z-10 flex gap-2">
          <button
            className="rounded-full bg-slate-950/80 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
            type="button"
            onClick={() => void downloadImage(imageUrl, `openai-image-${Date.now()}`)}
          >
            {t("tasks.actions.download")}
          </button>
          <button
            className="rounded-full bg-slate-950/80 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
            type="button"
            onClick={onClose}
          >
            {t("preview.close")}
          </button>
        </div>
        {count > 1 ? (
          <>
            <button
              className={`${navButtonClass} left-4`}
              type="button"
              onClick={() => onNavigate((index - 1 + count) % count)}
              aria-label={t("preview.previous")}
            >
              ‹
            </button>
            <button
              className={`${navButtonClass} right-4`}
              type="button"
              onClick={() => onNavigate((index + 1) % count)}
              aria-label={t("preview.next")}
            >
              ›
            </button>
            <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-950/70 px-3 py-1 text-xs font-medium text-white">
              {index + 1} / {count}
            </div>
          </>
        ) : null}
        <img
          className="max-h-[85vh] max-w-full rounded-2xl object-contain"
          src={imageUrl}
          alt={t("preview.alt")}
        />
      </div>
    </div>
  );
}
