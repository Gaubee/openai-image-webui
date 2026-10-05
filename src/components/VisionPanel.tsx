import { memo, useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { InputImageError, prepareInputImage } from "../lib/imageInput";
import type { InputImageFile, VisionDetail, VisionFormState } from "../types";
import { Notice } from "./Notice";
import { ImageDropzone } from "./ImageDropzone";

interface VisionPanelProps {
  form: VisionFormState;
  error: string;
  visionModel: string;
  onChange: (next: Partial<VisionFormState>) => void;
  onSubmit: () => void;
}

export const VisionPanel = memo(function VisionPanel({ form, error, visionModel, onChange, onSubmit }: VisionPanelProps) {
  const { t, i18n } = useTranslation();
  const [inputImageError, setInputImageError] = useState("");
  // Remembers the default we injected so that switching UI language also
  // switches the prompt — but only while the user has not written their own.
  // Note: the panel unmounts when another workspace is active, so a language
  // switch while away re-localizes on the next visit rather than immediately.
  const injectedDefaultRef = useRef<string | null>(null);

  useEffect(() => {
    const localizedDefault = t("vision.defaultPrompt");
    const isUntouched = form.prompt === "" || form.prompt === injectedDefaultRef.current;

    if (isUntouched && form.prompt !== localizedDefault) {
      injectedDefaultRef.current = localizedDefault;
      onChange({ prompt: localizedDefault });
    }
    // Reacts to language only. `form.prompt` is read but deliberately excluded:
    // including it would re-run this on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage, t]);

  async function handleAddInputImages(files: FileList | File[]) {
    setInputImageError("");
    const list = Array.from(files);
    const prepared: InputImageFile[] = [];

    for (const file of list) {
      try {
        prepared.push(await prepareInputImage(file));
      } catch (err) {
        const reason = err instanceof InputImageError ? err.message : String(err);
        setInputImageError(t("vision.inputImages.title") + ": " + reason);
        prepared.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return;
      }
    }

    if (prepared.length === 0) {
      return;
    }

    onChange({ inputImages: [...form.inputImages, ...prepared] });
  }

  function removeInputImage(id: string) {
    const next = form.inputImages.filter((item) => {
      if (item.id === id) {
        URL.revokeObjectURL(item.previewUrl);
        return false;
      }
      return true;
    });
    onChange({ inputImages: next });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="p-1">
      <p className="mb-4 text-sm text-text-secondary">{t("vision.subtitle")}</p>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <ImageDropzone
          images={form.inputImages}
          onAdd={handleAddInputImages}
          onRemove={removeInputImage}
          title={t("vision.inputImages.title")}
          hint={t("vision.inputImages.hint")}
          addButtonLabel={t("vision.inputImages.addButton")}
          removeLabel={t("vision.inputImages.remove")}
          badge={
            form.inputImages.length > 0
              ? t("vision.inputImages.badge", { count: form.inputImages.length })
              : undefined
          }
          error={inputImageError || undefined}
          sizeLabel={(width, height) => t("vision.inputImages.size", { width, height })}
        />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-text-secondary">{t("vision.prompt")}</span>
          <textarea
            className="min-h-28 w-full resize-y rounded border border-surface-3 bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent"
            placeholder={t("vision.promptPlaceholder")}
            value={form.prompt}
            onChange={(event) => onChange({ prompt: event.target.value })}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-text-secondary">{t("vision.detail")}</span>
          <select
            className="w-full rounded border border-surface-3 bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent"
            value={form.detail}
            onChange={(event) => onChange({ detail: event.target.value as VisionDetail })}
          >
            <option value="auto">auto</option>
            <option value="high">high</option>
            <option value="low">low</option>
          </select>
          <p className="mt-1 text-xs text-text-tertiary">{t("vision.detailHint")}</p>
        </label>

        <details className="group rounded border border-surface-3 bg-surface-2 p-3 outline-none [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer select-none list-none items-center justify-between text-xs font-medium text-text-secondary focus:outline-none">
            <span>{t("vision.advancedJsonParams")}</span>
            <ChevronDown className="h-3.5 w-3.5 text-text-tertiary transition-transform group-open:rotate-180" />
          </summary>
          <textarea
            className="mt-2.5 min-h-24 w-full resize-y rounded border border-surface-3 bg-surface-1 px-3 py-2 font-mono text-xs text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent"
            placeholder={'{\n  "max_output_tokens": 3000\n}'}
            value={form.advancedJson}
            onChange={(event) => onChange({ advancedJson: event.target.value })}
          />
        </details>

        <p className="px-1 text-xs leading-5 text-text-tertiary">
          {t("vision.modelHint", { model: visionModel || "-" })}
        </p>

        {error ? <Notice variant="error">{error}</Notice> : null}

        <button
          className="inline-flex w-full items-center justify-center rounded bg-accent px-5 py-3 text-sm font-semibold text-surface-0 shadow-sm transition-colors hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-text-tertiary disabled:shadow-none"
          type="submit"
          disabled={form.inputImages.length === 0}
        >
          {t("vision.analyze")}
        </button>
      </form>
    </section>
  );
});
