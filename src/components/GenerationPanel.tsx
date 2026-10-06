/*
 * Intent: prompt-first generation form — size picked via ratio chips with
 * precise controls collapsed (2026-10-05, R3 convergence 2026-10-06)
 * Original requirement: prompt as hero, secondary controls in deep space,
 * img2img input images + mask preserved from main branch
 */

import { useEffect, useMemo, useRef, useState, memo, type ChangeEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Minus, Plus } from "lucide-react";
import type { GenerateFormState, InputImageFile } from "../types";
import {
  assertMaskMatchesImage,
  InputImageError,
  modelLikelySupportsMultipleImages,
  modelRequiresStrictPng,
  prepareInputImage,
} from "../lib/imageInput";
import { getModelSizingProfile, getRatioChipGroups, defaultSizeForGroup, getSizePresetGroupsForModel } from "../lib/imageSizing";
import { Notice } from "./Notice";
import { ImageDropzone } from "./ImageDropzone";

const SIZE_STEP = 64;
const MIN_SIZE = 256;
const MAX_SIZE = 4096;
const DEFAULT_SIZE = 1024;
const RECENT_SIZE_LIMIT = 6;
const RECENT_SIZE_STORAGE_KEY = "openai-image-webui:recent-sizes";




interface GenerationPanelProps {
  form: GenerateFormState;
  error: string;
  /** Used to decide strict PNG enforcement and multi-image warnings. */
  model?: string;
  onChange: (next: Partial<GenerateFormState>) => void;
  onSubmit: () => void;
}

function roundToSizeStep(value: number, step = SIZE_STEP) {
  return Math.max(step, Math.round(value / step) * step);
}

function clampDimension(value: number, step = SIZE_STEP) {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, roundToSizeStep(value, step)));
}

/**
 * Clamp without rounding to SIZE_STEP — preserves exact pixel values
 * typed by the user or chosen from presets (e.g. 1280x720).
 */
function clampDimensionExact(value: number) {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, value));
}

function normalizeSize(value: string) {
  const cleaned = value.trim().replace(/×/g, "x").replace(/\s+/g, "");

  if (!/^\d+x\d+$/i.test(cleaned)) {
    return "";
  }

  return cleaned.toLowerCase();
}

function parseSize(value: string) {
  const normalized = normalizeSize(value);
  if (!normalized) {
    return null;
  }

  const [widthPart, heightPart] = normalized.split("x");
  const width = Number(widthPart);
  const height = Number(heightPart);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    width: clampDimensionExact(width),
    height: clampDimensionExact(height),
  };
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }

  return x || 1;
}

function getRatioLabel(size: string) {
  const parsed = parseSize(size);

  if (!parsed) {
    return "";
  }

  const divisor = greatestCommonDivisor(parsed.width, parsed.height);
  return `${Math.round(parsed.width / divisor)}:${Math.round(parsed.height / divisor)}`;
}

function loadRecentSizes() {
  try {
    const raw = localStorage.getItem(RECENT_SIZE_STORAGE_KEY);
    if (!raw) {
      return [] as string[];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [] as string[];
    }

    return parsed
      .map((item) => (typeof item === "string" ? normalizeSize(item) : ""))
      .filter(Boolean)
      .slice(0, RECENT_SIZE_LIMIT);
  } catch {
    return [] as string[];
  }
}

function saveRecentSizes(sizes: string[]) {
  try {
    localStorage.setItem(RECENT_SIZE_STORAGE_KEY, JSON.stringify(sizes.slice(0, RECENT_SIZE_LIMIT)));
  } catch {
    // Ignore localStorage quota or privacy-mode failures.
  }
}

export const GenerationPanel = memo(function GenerationPanel({ form, error, model, onChange, onSubmit }: GenerationPanelProps) {
  const { t } = useTranslation();
  const initialParsedSize = parseSize(form.size);
  const [sliderWidth, setSliderWidth] = useState(initialParsedSize?.width ?? DEFAULT_SIZE);
  const [sliderHeight, setSliderHeight] = useState(initialParsedSize?.height ?? DEFAULT_SIZE);
  const [recentSizes, setRecentSizes] = useState<string[]>(() => loadRecentSizes());
  const [inputImageError, setInputImageError] = useState("");
  const maskFileInputRef = useRef<HTMLInputElement>(null);

  const strictPng = modelRequiresStrictPng(model ?? "");
  const supportsMultiImage = modelLikelySupportsMultipleImages(model ?? "");
  const isEditMode = form.inputImages.length > 0;
  const modelSizingProfile = useMemo(() => getModelSizingProfile(model ?? ""), [model]);
  const sizePresetGroups = useMemo(() => getSizePresetGroupsForModel(model ?? ""), [model]);
  const ratioChipGroups = useMemo(() => getRatioChipGroups(model ?? ""), [model]);
  // gpt-image-2: 16px alignment required; gemini: free input (only aspect_ratio matters); others: 64px slider step (cosmetic)
  const sliderStep = modelSizingProfile.mode === "gptImage2" ? 16 : modelSizingProfile.mode === "geminiAspect" ? 8 : SIZE_STEP;

  useEffect(() => {
    const parsed = parseSize(form.size);
    if (!parsed) {
      return;
    }

    setSliderWidth((current) => (current === parsed.width ? current : parsed.width));
    setSliderHeight((current) => (current === parsed.height ? current : parsed.height));
  }, [form.size]);

  const currentSize = useMemo(() => `${sliderWidth}x${sliderHeight}`, [sliderHeight, sliderWidth]);
  const currentRatioLabel = useMemo(() => getRatioLabel(currentSize), [currentSize]);

  function isSizeActive(size: string) {
    const normalizedCurrent = normalizeSize(form.size);
    const normalizedSize = normalizeSize(size);
    if (normalizedSize) {
      return normalizedCurrent === normalizedSize;
    }
    return form.size.trim().toLowerCase() === size.trim().toLowerCase();
  }

  function rememberSize(value: string) {
    const normalized = normalizeSize(value);

    if (!normalized) {
      return;
    }

    setRecentSizes((current) => {
      const next = [normalized, ...current.filter((item) => item !== normalized)].slice(
        0,
        RECENT_SIZE_LIMIT,
      );
      saveRecentSizes(next);
      return next;
    });
  }

  function applySize(value: string) {
    const parsed = parseSize(value);
    if (!parsed) {
      onChange({ size: value });
      return;
    }

    const normalizedSize = `${parsed.width}x${parsed.height}`;
    setSliderWidth(parsed.width);
    setSliderHeight(parsed.height);
    onChange({ size: normalizedSize });
    rememberSize(normalizedSize);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    rememberSize(form.size);
    onSubmit();
  }

  async function handleAddInputImages(files: FileList | File[]) {
    setInputImageError("");
    const list = Array.from(files);
    const prepared: InputImageFile[] = [];
    for (const file of list) {
      try {
        const item = await prepareInputImage(file, { strictPngOnly: strictPng });
        prepared.push(item);
      } catch (err) {
        const reason = err instanceof InputImageError ? err.message : String(err);
        setInputImageError(t("generation.inputImages.title") + ": " + reason);
        prepared.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return;
      }
    }
    if (prepared.length === 0) return;

    // If this is the first input image being added, auto-fill size with the
    // image's native resolution so the user gets pixel-perfect defaults.
    const isFirstImage = form.inputImages.length === 0;
    const updates: Partial<GenerateFormState> = {
      inputImages: [...form.inputImages, ...prepared],
    };
    if (isFirstImage && prepared[0]) {
      const nativeSize = `${prepared[0].width}x${prepared[0].height}`;
      updates.size = nativeSize;
      setSliderWidth(prepared[0].width);
      setSliderHeight(prepared[0].height);
      rememberSize(nativeSize);
    }
    onChange(updates);
  }

  async function handleAddMask(file: File) {
    setInputImageError("");
    if (form.inputImages.length === 0) {
      setInputImageError(t("generation.inputImages.mask") + ": requires at least one input image first.");
      return;
    }
    try {
      const mask = await prepareInputImage(file, { strictPngOnly: true });
      assertMaskMatchesImage(mask, form.inputImages[0]);
      if (form.maskImage) URL.revokeObjectURL(form.maskImage.previewUrl);
      onChange({ maskImage: mask });
    } catch (err) {
      const reason = err instanceof InputImageError ? err.message : String(err);
      setInputImageError(t("generation.inputImages.mask") + ": " + reason);
    }
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
    // Mask must be dropped if its reference (first image) is gone.
    if (next.length === 0 && form.maskImage) {
      URL.revokeObjectURL(form.maskImage.previewUrl);
      onChange({ maskImage: null });
    }
  }

  function removeMask() {
    if (form.maskImage) URL.revokeObjectURL(form.maskImage.previewUrl);
    onChange({ maskImage: null });
  }

  function onMaskInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void handleAddMask(file);
    }
    event.target.value = "";
  }

  const acceptMime = strictPng ? "image/png" : "image/png,image/jpeg,image/webp";
  const showMultiImageWarning =
    form.inputImages.length > 1 && !!model && !supportsMultiImage;

  return (
    <section className="rounded border border-surface-3 bg-surface-1 p-4 shadow-soft">
      <form className="space-y-3.5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-text-secondary">
            {t("generation.prompt")}
          </span>
          <textarea
            className="min-h-24 w-full resize-y rounded border border-surface-3 bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent"
            placeholder={t("generation.promptPlaceholder")}
            value={form.prompt}
            onChange={(event) => onChange({ prompt: event.target.value })}
          />
        </label>

        <ImageDropzone
          images={form.inputImages}
          onAdd={handleAddInputImages}
          onRemove={removeInputImage}
          title={t("generation.inputImages.title")}
          hint={t("generation.inputImages.hint")}
          addButtonLabel={t("generation.inputImages.addButton")}
          removeLabel={t("generation.inputImages.remove")}
          accept={acceptMime}
          badge={isEditMode ? t("generation.inputImages.editModeBadge") : undefined}
          warning={showMultiImageWarning ? t("generation.inputImages.multipleImagesWarning") : undefined}
          error={inputImageError || undefined}
          sizeLabel={(width, height) => t("generation.inputImages.size", { width, height })}
        >
          {isEditMode ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-text-secondary">{t("generation.inputImages.mask")}</p>
              <p className="mt-1 text-xs text-text-tertiary">{t("generation.inputImages.maskHint")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {form.maskImage ? (
                  <div
                    className="group relative h-20 w-20 overflow-hidden rounded-lg border border-surface-3 bg-surface-2"
                    title={`${form.maskImage.file.name} · ${form.maskImage.width}×${form.maskImage.height}`}
                  >
                    <img
                      src={form.maskImage.previewUrl}
                      alt={form.maskImage.file.name}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute right-0 top-0 rounded-bl-lg bg-surface-0/80 px-1.5 py-0.5 text-[10px] font-semibold text-text-primary opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={removeMask}
                    >
                      {t("generation.inputImages.remove")}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-surface-3 bg-surface-2 p-1 text-xs font-medium text-text-tertiary transition-colors hover:border-accent/50 hover:text-accent"
                      onClick={() => maskFileInputRef.current?.click()}
                    >
                      {t("generation.inputImages.addMaskButton")}
                    </button>
                    <input
                      ref={maskFileInputRef}
                      type="file"
                      accept="image/png"
                      hidden
                      onChange={onMaskInputChange}
                    />
                  </>
                )}
              </div>
            </div>
          ) : null}
        </ImageDropzone>

        {/* Image count — compact stepper (value domain is tiny: 1-20) */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-text-secondary">{t("generation.imageCount")}</span>
          <div className="inline-flex items-center rounded border border-surface-3 bg-surface-2">
            <button
              type="button"
              className="inline-flex min-h-9 items-center justify-center px-2.5 py-1.5 text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:text-text-tertiary max-sm:min-h-11 max-sm:min-w-11"
              onClick={() => onChange({ count: Math.max(1, form.count - 1) })}
              disabled={form.count <= 1}
              aria-label="-"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              className="w-12 border-x border-surface-3 bg-transparent py-1.5 text-center text-sm tabular-nums text-text-primary outline-none"
              type="number"
              min={1}
              max={20}
              value={form.count}
              onChange={(event) => onChange({ count: Math.min(20, Math.max(1, Number(event.target.value) || 1)) })}
              aria-label={t("generation.imageCount")}
            />
            <button
              type="button"
              className="inline-flex min-h-9 items-center justify-center px-2.5 py-1.5 text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:text-text-tertiary max-sm:min-h-11 max-sm:min-w-11"
              onClick={() => onChange({ count: Math.min(20, form.count + 1) })}
              disabled={form.count >= 20}
              aria-label="+"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* --- Size section: ratio presets first, precise controls collapsed --- */}
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-text-primary">{t("generation.size")}</p>
            <p className="text-xs tabular-nums text-text-tertiary">
              {currentSize} · {currentRatioLabel || "-"}
            </p>
          </div>

          {/* One-tap ratio presets */}
          <div className="flex flex-wrap gap-1.5">
            {ratioChipGroups.map((group) => {
              const active = currentRatioLabel === group.ratio;
              return (
                <button
                  key={group.ratio}
                  type="button"
                  className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors max-sm:min-h-11 ${
                    active
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-surface-3 bg-surface-1 text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                  }`}
                  onClick={() => applySize(defaultSizeForGroup(group))}
                  title={group.sizes.join(" · ")}
                >
                  {group.ratio}
                </button>
              );
            })}
          </div>

          {/* Reference image native resolution (edit-mode quick action) */}
          {form.inputImages.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-text-secondary">{t("generation.refImageSize")}</span>
              {Array.from(new Map(form.inputImages.map((img) => [`${img.width}x${img.height}`, img])).values()).map(
                (img) => {
                  const sizeStr = `${img.width}x${img.height}`;
                  const isActive = isSizeActive(sizeStr);
                  return (
                    <button
                      key={sizeStr}
                      type="button"
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium tabular-nums transition-colors ${
                        isActive
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-surface-3 bg-surface-1 text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                      }`}
                      onClick={() => applySize(sizeStr)}
                      title={t("generation.refImageSizeHint")}
                    >
                      {sizeStr} · {getRatioLabel(sizeStr)}
                    </button>
                  );
                },
              )}
            </div>
          ) : null}

          {/* Custom size: precise inputs, sliders, model compatibility notes */}
          <details className="group rounded border border-surface-3 bg-surface-2 p-3 outline-none [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer select-none list-none items-center justify-between text-xs font-medium text-text-secondary focus:outline-none">
              <span>{t("generation.customSize")}</span>
              <ChevronDown className="h-3.5 w-3.5 text-text-tertiary transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2.5 space-y-3">
              <p className="rounded border border-surface-3 bg-surface-1 px-2.5 py-1.5 text-xs leading-5 text-text-tertiary">
                {t(`generation.sizeCompatibility.${modelSizingProfile.mode}`)}
              </p>

              {/* Free width × height number inputs */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-text-secondary">{t("generation.widthPixels")}</span>
                  <input
                    className="w-full rounded border border-surface-3 bg-surface-1 px-3 py-2 text-sm tabular-nums text-text-primary outline-none transition-colors focus:border-accent"
                    type="number"
                    min={MIN_SIZE}
                    max={MAX_SIZE}
                    step="any"
                    value={sliderWidth}
                    onChange={(event) => {
                      const raw = Number(event.target.value);
                      if (!Number.isFinite(raw) || raw <= 0) return;
                      setSliderWidth(raw);
                    }}
                    onBlur={() => {
                      const clamped = clampDimensionExact(sliderWidth);
                      setSliderWidth(clamped);
                      applySize(`${clamped}x${sliderHeight}`);
                    }}
                  />
                </label>
                <span className="pb-2 text-sm font-medium text-text-tertiary">×</span>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-text-secondary">{t("generation.heightPixels")}</span>
                  <input
                    className="w-full rounded border border-surface-3 bg-surface-1 px-3 py-2 text-sm tabular-nums text-text-primary outline-none transition-colors focus:border-accent"
                    type="number"
                    min={MIN_SIZE}
                    max={MAX_SIZE}
                    step="any"
                    value={sliderHeight}
                    onChange={(event) => {
                      const raw = Number(event.target.value);
                      if (!Number.isFinite(raw) || raw <= 0) return;
                      setSliderHeight(raw);
                    }}
                    onBlur={() => {
                      const clamped = clampDimensionExact(sliderHeight);
                      setSliderHeight(clamped);
                      applySize(`${sliderWidth}x${clamped}`);
                    }}
                  />
                </label>
              </div>

              {/* Sliders */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-text-secondary">
                  <span className="mb-1 block">{t("generation.widthPixels")}: {sliderWidth}</span>
                  <input
                    type="range"
                    min={MIN_SIZE}
                    max={MAX_SIZE}
                    step={sliderStep}
                    value={sliderWidth}
                    className="w-full accent-accent"
                    onChange={(event) => {
                      const nextWidth = clampDimension(Number(event.target.value), sliderStep);
                      setSliderWidth(nextWidth);
                      applySize(`${nextWidth}x${sliderHeight}`);
                    }}
                  />
                </label>
                <label className="block text-xs text-text-secondary">
                  <span className="mb-1 block">{t("generation.heightPixels")}: {sliderHeight}</span>
                  <input
                    type="range"
                    min={MIN_SIZE}
                    max={MAX_SIZE}
                    step={sliderStep}
                    value={sliderHeight}
                    className="w-full accent-accent"
                    onChange={(event) => {
                      const nextHeight = clampDimension(Number(event.target.value), sliderStep);
                      setSliderHeight(nextHeight);
                      applySize(`${sliderWidth}x${nextHeight}`);
                    }}
                  />
                </label>
              </div>

              {/* Raw "WxH" text input — paste any size */}
              <input
                className="w-full rounded border border-surface-3 bg-surface-1 px-3 py-2 text-xs text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent"
                placeholder={t("generation.sizePlaceholder")}
                value={form.size}
                onChange={(event) => onChange({ size: event.target.value })}
                onBlur={() => applySize(form.size)}
              />

              {/* Common sizes grouped by aspect ratio */}
              <div>
                <p className="text-xs font-medium text-text-secondary">{t("generation.commonSizes")}</p>
                <p className="mb-2 mt-1 text-xs text-text-tertiary">{t("generation.commonSizesHint")}</p>
                <div className="space-y-2">
                  {sizePresetGroups.map((group) => (
                    <div key={group.ratio}>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                        {group.ratio}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.sizes.map((size) => (
                          <button
                            key={size}
                            type="button"
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums transition-colors ${
                              isSizeActive(size)
                                ? "border-accent bg-accent/10 text-accent"
                                : "border-surface-3 bg-surface-1 text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                            }`}
                            onClick={() => applySize(size)}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent sizes */}
              <div>
                <p className="mb-2 text-xs font-medium text-text-secondary">{t("generation.recentSizes")}</p>
                {recentSizes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {recentSizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium tabular-nums transition-colors ${
                          isSizeActive(size)
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-surface-3 bg-surface-1 text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                        }`}
                        onClick={() => applySize(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-tertiary">{t("generation.recentSizesEmpty")}</p>
                )}
              </div>
            </div>
          </details>
        </div>

        {/* Advanced JSON Params */}
        <details className="group rounded border border-surface-3 bg-surface-2 p-3 outline-none [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer select-none list-none items-center justify-between text-xs font-medium text-text-secondary focus:outline-none">
            <span>{t("generation.advancedJsonParams")}</span>
            <ChevronDown className="h-3.5 w-3.5 text-text-tertiary transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2.5">
            <textarea
              className="min-h-24 w-full resize-y rounded border border-surface-3 bg-surface-1 px-3 py-2 font-mono text-xs text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent"
              placeholder={'{\n  "quality": "high",\n  "style": "vivid"\n}'}
              value={form.advancedJson}
              onChange={(event) => onChange({ advancedJson: event.target.value })}
            />
          </div>
        </details>

        {error ? <Notice variant="error">{error}</Notice> : null}

        <button
          className="inline-flex w-full items-center justify-center rounded bg-accent px-5 py-3 text-sm font-semibold text-surface-0 shadow-sm transition-colors hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-tertiary disabled:shadow-none"
          type="submit"
          disabled={!form.prompt.trim()}
        >
          {isEditMode ? t("generation.edit") : t("generation.generate")}
        </button>
        {form.prompt.trim() ? null : (
          <p className="mt-2 text-center text-xs text-text-tertiary">{t("generation.disabledHint")}</p>
        )}
      </form>
    </section>
  );
});
