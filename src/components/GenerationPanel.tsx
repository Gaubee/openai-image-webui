/*
 * Intent: Simplified prompt-first generation panel (2026-10-05)
 * Redesigned: large prompt input, collapsed secondary controls, applies design tokens
 */

import { useMemo, memo, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { GenerateFormState } from "../types/index";

interface GenerationPanelProps {
  form: GenerateFormState;
  error: string;
  model?: string;
  onChange: (next: Partial<GenerateFormState>) => void;
  onSubmit: () => void;
}

export const GenerationPanel = memo(function GenerationPanel({
  form,
  error,
  model,
  onChange,
  onSubmit,
}: GenerationPanelProps) {
  const { t } = useTranslation();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  const isEditMode = form.inputImages.length > 0;

  return (
    <div className="space-y-6">
      {/* Prompt input - center stage */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-text-secondary">
            {t("generation.prompt")}
          </span>
          <textarea
            className="min-h-[120px] w-full resize-y rounded border border-surface-3 bg-surface-2 px-4 py-3 text-base text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-accent focus:bg-surface-1"
            placeholder={t("generation.promptPlaceholder")}
            value={form.prompt}
            onChange={(event) => onChange({ prompt: event.target.value })}
          />
        </label>

        {/* Size and advanced controls - collapsed */}
        <details className="group rounded border border-surface-3 bg-surface-1 p-4">
          <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-text-secondary">
            <span>
              {t("generation.size")}: {form.size || "1024x1024"}
            </span>
            <span className="text-xs text-text-tertiary transition group-open:rotate-180">
              ▼
            </span>
          </summary>
          <div className="mt-4">
            <input
              type="text"
              className="w-full rounded border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent focus:bg-surface-1"
              placeholder="1024x1024"
              value={form.size}
              onChange={(event) => onChange({ size: event.target.value })}
            />
          </div>
        </details>

        {error ? (
          <div className="rounded border border-error/30 bg-surface-1 px-4 py-3 text-sm text-error">
            {error}
          </div>
        ) : null}

        {/* Generate button - amber accent */}
        <button
          type="submit"
          disabled={!form.prompt.trim()}
          className="w-full rounded bg-accent px-6 py-3 text-base font-semibold text-surface-0 shadow-sm transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isEditMode ? t("generation.edit") : t("generation.generate")}
        </button>
      </form>
    </div>
  );
});
