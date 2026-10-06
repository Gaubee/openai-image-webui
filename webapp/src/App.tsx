/*
 * Intent: Main app shell - dual-mode canvas (Generate/Batch), drawer navigation (2026-10-05)
 * New IA: prompt-first, inline results, secondary panels in drawer
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Images } from "lucide-react";
import { CanvasGrid } from "./components/CanvasGrid";
import { GenerationPanel } from "./components/GenerationPanel";
import { TaskLightbox } from "./components/TaskLightbox";
import { Header } from "./components/Header";
import { ImageLibrary } from "./components/ImageLibrary";
import { ImagePreviewModal } from "./components/ImagePreviewModal";
import { SettingsPanel } from "./components/SettingsPanel";
import { VisionPanel } from "./components/VisionPanel";
import { BatchRenamePanel } from "./components/BatchRenamePanel";
import { BatchGenerationPanel } from "./components/BatchGenerationPanel";
import { StorageHealthBanner } from "./components/StorageHealthBanner";
import { Drawer } from "./components/Drawer";

import { useImageTasks } from "./hooks/useImageTasks";
import { useSettings } from "./hooks/useSettings";
import { useFormPersistence } from "./hooks/useFormPersistence";
import { isI18nErrorKey, toI18nError } from "./lib/errors";
import { parseAdvancedJson } from "./lib/parseAdvancedJson";
import { stripGeminiSizeArtifacts } from "./lib/imageSizing";
import { DEFAULT_BATCH_FORM, DEFAULT_FORM, DEFAULT_VISION_FORM } from "./lib/storage";
import { toInputImageFile } from "./lib/imageInput";
import { createBatchId, parsePromptList } from "./lib/promptList";
import { downloadBatchZip, getTaskBatchId } from "./lib/batchExport";
import { getCachedInputs } from "./lib/imageCache";
import type { AppSettings, BatchFormState, GenerateFormState, ImageTask, InputImageFile, ReuseParamsPayload, VisionFormState } from "./types";


function validateRequest(
  settings: AppSettings,
  form: GenerateFormState,
  messages: {
    apiKeyRequired: string;
    apiBaseUrlRequired: string;
    modelRequired: string;
    promptRequired: string;
  },
) {
  if (!settings.apiKey.trim()) {
    throw new Error(messages.apiKeyRequired);
  }

  if (!settings.baseUrl.trim()) {
    throw new Error(messages.apiBaseUrlRequired);
  }

  if (!settings.model.trim()) {
    throw new Error(messages.modelRequired);
  }

  if (!form.prompt.trim()) {
    throw new Error(messages.promptRequired);
  }
}

function normalizeForm(form: GenerateFormState): GenerateFormState {
  return {
    ...form,
    prompt: form.prompt.trim(),
    count: Math.max(1, Math.floor(Number.isFinite(form.count) ? form.count : 1)),
    size: form.size.trim() || "1024x1024",
  };
}

function validateVisionRequest(
  settings: AppSettings,
  form: VisionFormState,
  messages: {
    apiKeyRequired: string;
    apiBaseUrlRequired: string;
    visionModelRequired: string;
    promptRequired: string;
    imageRequired: string;
  },
) {
  if (!settings.apiKey.trim()) {
    throw new Error(messages.apiKeyRequired);
  }

  if (!settings.baseUrl.trim()) {
    throw new Error(messages.apiBaseUrlRequired);
  }

  if (!settings.visionModel.trim()) {
    throw new Error(messages.visionModelRequired);
  }

  if (!form.prompt.trim()) {
    throw new Error(messages.promptRequired);
  }

  if (form.inputImages.length === 0) {
    throw new Error(messages.imageRequired);
  }
}

type AppMode = "generate" | "batch";
type DrawerPanel = "settings" | "library" | "vision" | "rename" | null;

/** Build an {@link InputImageFile} from a File with a fresh object URL. */
function makeInputImageFile(file: File, width = 0, height = 0): InputImageFile {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    width,
    height,
  };
}

export default function App() {
  const { i18n, t } = useTranslation();
  // Maps thrown errors to localized copy; i18n keys from toI18nError resolve here.
  const showFriendlyError = useCallback(
    (error: unknown) => {
      const value = toI18nError(error, {
        unknown: t("errors.unknown"),
        requestFailed: t("errors.requestFailed"),
      });
      return isI18nErrorKey(value) ? t(value) : value;
    },
    [t],
  );
  const { settings, setSettings, resetSettings } = useSettings();
  const [form, setForm] = useState<GenerateFormState>(DEFAULT_FORM);
  const [visionForm, setVisionForm] = useState<VisionFormState>(DEFAULT_VISION_FORM);
  const [batchForm, setBatchForm] = useState<BatchFormState>(DEFAULT_BATCH_FORM);
  const [formError, setFormError] = useState("");
  const [visionError, setVisionError] = useState("");
  const [batchError, setBatchError] = useState("");
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [isExportingBatch, setIsExportingBatch] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lightboxTask, setLightboxTask] = useState<ImageTask | null>(null);
  const [activeMode, setActiveMode] = useState<AppMode>("generate");
  const [drawerPanel, setDrawerPanel] = useState<DrawerPanel>(null);

  // Form drafts (prompt/size/advancedJson/batch state) persist to IDB kv. The
  // ref keeps the setters callable from memo-stable callbacks.
  const formPersistence = useFormPersistence();
  const formPersistenceRef = useRef(formPersistence);
  formPersistenceRef.current = formPersistence;

  // One-shot seeding once the persisted draft arrives — only fields the user
  // has not touched this session get restored. Batch prompts live in the same
  // kv store (migrated from localStorage by storageMigration).
  useEffect(() => {
    if (!formPersistence.loaded) return;
    const { lastPrompt, lastSize, lastAdvancedJson, lastBatchPrompts, currentBatchId: draftBatchId } =
      formPersistenceRef.current.draft;
    setForm((current) => ({
      ...current,
      prompt: current.prompt || lastPrompt || "",
      size: lastSize || current.size,
      advancedJson: current.advancedJson || lastAdvancedJson || "",
    }));
    if (lastBatchPrompts !== undefined) {
      setBatchForm((current) => ({ ...current, promptsText: current.promptsText || lastBatchPrompts }));
    }
    if (draftBatchId !== undefined) {
      setCurrentBatchId((current) => current ?? draftBatchId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot seed on load
  }, [formPersistence.loaded]);

  // Keep the batch id in the kv draft store (survives reloads without
  // localStorage; storageMigration seeds it from the legacy key).
  useEffect(() => {
    if (currentBatchId) {
      formPersistenceRef.current.setCurrentBatchId(currentBatchId);
    }
  }, [currentBatchId]);

  const {
    tasks,
    cacheStats,
    addTasks,
    addVisionTask,
    addBatchTasks,
    retryBatchErrors,
    retryTask,

    cancelTask,
    removeTask,
    clearTaskImage,
    clearCachedImages,
    clearTasks,
    getPendingInputs,
  } = useImageTasks(settings);

  const [toast, setToast] = useState<string>("");

  const closePreview = useCallback(() => setPreviewUrl(null), []);

  // "Clear tasks" is a destructive low-frequency action — ghost icon in the
  // header with a confirm gate, disabled while there is nothing to clear.
  const handleClearTasks = useCallback(() => {
    if (tasks.length === 0) return;
    if (window.confirm(t("headerExtras.clearTasksConfirm"))) {
      clearTasks();
    }
  }, [clearTasks, t, tasks.length]);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const language = i18n.resolvedLanguage?.startsWith("zh") ? "zh-CN" : "en";
    document.documentElement.lang = language;
    document.title = t("meta.title");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", t("meta.description"));
  }, [i18n.resolvedLanguage, t]);

  // These are passed to memo()-wrapped panels, so they must be stable —
  // otherwise every App render defeats the memoization entirely.
  const updateForm = useCallback((next: Partial<GenerateFormState>) => {
    setForm((current) => ({ ...current, ...next }));
    if (typeof next.prompt === "string") formPersistenceRef.current.setPrompt(next.prompt);
    if (typeof next.size === "string") formPersistenceRef.current.setSize(next.size);
    if (typeof next.advancedJson === "string") formPersistenceRef.current.setAdvancedJson(next.advancedJson);
  }, []);

  // Global drag-and-drop: dropping files anywhere routes them to the active
  // panel's input-images handler (panels register via registerPanelDropHandler,
  // so validation, model rules, and error display stay single-sourced there).
  const [isFileDragging, setIsFileDragging] = useState(false);
  const dragDepthRef = useRef(0);
  const panelDropHandlerRef = useRef<((files: FileList | File[]) => void) | null>(null);

  const registerPanelDropHandler = useCallback(
    (handler: ((files: FileList | File[]) => void) | null) => {
      panelDropHandlerRef.current = handler;
    },
    [],
  );

  useEffect(() => {
    function carriesFiles(event: DragEvent) {
      return Array.from(event.dataTransfer?.types ?? []).includes("Files");
    }

    function handleDragEnter(event: DragEvent) {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setIsFileDragging(true);
    }

    function handleDragOver(event: DragEvent) {
      if (!carriesFiles(event)) return;
      // Preventing default on dragover is what allows drop to fire at all.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    }

    function handleDragLeave(event: DragEvent) {
      if (!carriesFiles(event)) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsFileDragging(false);
    }

    function handleDrop(event: DragEvent) {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsFileDragging(false);
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) panelDropHandlerRef.current?.(files);
    }

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  const updateVisionForm = useCallback((next: Partial<VisionFormState>) => {
    setVisionForm((current) => ({ ...current, ...next }));
  }, []);

  const updateBatchForm = useCallback((next: Partial<BatchFormState>) => {
    setBatchForm((current) => {
      const merged = { ...current, ...next };
      if (typeof next.promptsText === "string") {
        formPersistenceRef.current.setBatchPrompts(next.promptsText);
      }
      return merged;
    });
  }, []);

const handleReuseParams = useCallback((payload: ReuseParamsPayload) => {
    // Gemini models store auto-derived aspect_ratio / image_size in
    // extraParams and an auto-appended "--ar X:Y" in the prompt. Restoring
    // them verbatim locks the size — subsequent form.size changes get
    // ignored by buildCompatibleImageRequest (the "改尺寸都无效" bug). Strip
    // them here so form.size stays the single source of truth. No-op for
    // non-Gemini models.
    const { prompt: cleanPrompt, extraParams: cleanExtra } = stripGeminiSizeArtifacts(
      payload.model,
      payload.prompt,
      payload.extraParams,
    );

    console.log("[reuseParams] handleReuseParams", {
      model: payload.model,
      inputImageCount: payload.inputImages?.length ?? 0,
      hasMask: !!payload.maskImage,
      inputImagesLost: payload.inputImagesLost,
      strippedGeminiArtifacts: cleanPrompt !== payload.prompt || cleanExtra !== payload.extraParams,
    });

    // Update settings (model + responseFormat)
    setSettings({
      model: payload.model,
      responseFormat: payload.responseFormat,
    });

// Update form (prompt + size + advancedJson + inputImages + maskImage).
    // The functional form lets us revoke the object URLs of the images we are
    // replacing — otherwise repeated "reuse params" leaks a blob every time.
    setForm((current) => {
      const nextImages = payload.inputImages ?? [];
      const nextMask = payload.maskImage ?? null;
      const keptUrls = new Set(nextImages.map((image) => image.previewUrl));

      if (nextMask) {
        keptUrls.add(nextMask.previewUrl);
      }

      for (const image of current.inputImages) {
        if (!keptUrls.has(image.previewUrl)) {
          URL.revokeObjectURL(image.previewUrl);
        }
      }

      if (current.maskImage && !keptUrls.has(current.maskImage.previewUrl)) {
        URL.revokeObjectURL(current.maskImage.previewUrl);
      }

      return {
        prompt: cleanPrompt,
        count: 1,
        size: payload.size,
        advancedJson: cleanExtra && Object.keys(cleanExtra).length > 0
          ? JSON.stringify(cleanExtra, null, 2)
          : "",
        inputImages: nextImages,
        maskImage: nextMask,
      };
    });

    // Switch to Generate mode to show the applied params
    setActiveMode("generate");
    setDrawerPanel(null);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Show toast
    if (payload.inputImagesLost) {
      setToast(t("tasks.messages.paramsAppliedInputsLost"));
    } else {
      setToast(t("tasks.messages.paramsApplied"));
    }
  }, [setSettings, t]);

  /**
   * Build a ReuseParamsPayload from an ImageTask, checking in-memory inputs.
   * Async because recovered File blobs need decoding to recover their real
   * dimensions — GenerationPanel uses those for the native-resolution button
   * and for mask size validation.
   */
  const buildReusePayloadFromTask = useCallback(async (task: ImageTask): Promise<ReuseParamsPayload> => {
    const pending = getPendingInputs(task.id);
    const isEdit = task.mode === "edit";
    // In-memory inputs are dropped once a task succeeds; the persisted copy
    // stored with the cached result survives that and page reloads.
    const persisted = isEdit && !pending?.images.length
      ? await getCachedInputs(task.id).catch(() => null)
      : null;
    const hasInputs = isEdit && ((pending?.images.length ?? 0) + (persisted?.images.length ?? 0)) > 0;

    // The generate and batch forms both keep their inputImages after a
    // successful submit (so the user can tweak & re-submit). The in-memory
    // File blobs held in pendingInputs are released once the task succeeds,
    // so when reusing an edit task whose blobs are gone, fall back to the
    // form that originally supplied the images before declaring them "lost".
    // Batch tasks were created from the batch form; single edits from the
    // generate form. In the common "just uploaded, just generated, now
    // reuse" flow the images are still right there - no reason to tell the
    // user they're gone.
    const isBatchTask = !!getTaskBatchId(task);
    const fallbackSource = isBatchTask ? batchForm.inputImages : form.inputImages;
    const fallbackAvailable = isEdit && !hasInputs && fallbackSource.length > 0;

    // Only truly lost when there are neither in-memory inputs nor a form
    // fallback.
    const inputImagesLost = isEdit && !hasInputs && !fallbackAvailable;

    console.log("[reuseParams] buildReusePayloadFromTask", {
      taskId: task.id,
      taskMode: task.mode,
      taskStatus: task.status,
      hasPendingInputs: !!pending,
      pendingImageCount: pending?.images.length ?? 0,
      isBatchTask,
      fallbackImageCount: fallbackSource.length,
      hasFormMask: !!form.maskImage,
      hasInputs,
      fallbackAvailable,
      inputImagesLost,
    });

    let inputImages: InputImageFile[] | undefined;
    let maskImage: InputImageFile | null | undefined;

    if (hasInputs && pending) {
      inputImages = await Promise.all(pending.images.map((file: File) => toInputImageFile(file)));
      maskImage = pending.mask ? await toInputImageFile(pending.mask) : null;
    } else if (hasInputs && persisted) {
      // Restored from the cache that traveled with the result.
      inputImages = await Promise.all(persisted.images.map((file: File) => toInputImageFile(file)));
      maskImage = persisted.mask ? await toInputImageFile(persisted.mask) : null;
    } else if (fallbackAvailable) {
      if (isBatchTask) {
        // The batch form's images are about to move into the generate form.
        // Clone them with fresh object URLs so they don't share previewUrl
        // lifetime with the batch form - revoking one when removed from the
        // generate form must not break the batch form's copy.
        inputImages = fallbackSource.map((item) =>
          makeInputImageFile(item.file, item.width, item.height),
        );
        maskImage = null; // batch tasks never carry a mask
      } else {
        // Reuse the generate form's existing InputImageFile entries as-is -
        // their previewUrls are already valid, and they stay in the same
        // form, so no need to mint new object URLs (which would also leak
        // the old ones).
        inputImages = form.inputImages;
        maskImage = form.maskImage;
      }
    }

    return {
      model: task.model,
      prompt: task.prompt,
      size: task.size,
      responseFormat: task.responseFormat,
      extraParams: task.extraParams,
      inputImages,
      maskImage,
      inputImagesLost,
    };
  }, [getPendingInputs]);

  const handleReuseTask = useCallback(
    (task: ImageTask) => {
      void buildReusePayloadFromTask(task).then(handleReuseParams);
    },
    [buildReusePayloadFromTask, handleReuseParams],
  );

  const handleGenerate = useCallback(() => {
    setFormError("");

    try {
      const normalizedForm = normalizeForm(form);
      validateRequest(settings, normalizedForm, {
        apiKeyRequired: t("errors.apiKeyRequired"),
        apiBaseUrlRequired: t("errors.apiBaseUrlRequired"),
        modelRequired: t("errors.modelRequired"),
        promptRequired: t("errors.promptRequired"),
      });
      const extraParams = parseAdvancedJson(normalizedForm.advancedJson, {
        invalidJson: t("errors.advancedJsonInvalid"),
        mustBeObject: t("errors.advancedJsonObject"),
      });
      addTasks(normalizedForm, extraParams);
      // Bring the materializing result into view — the payoff moment should
      // not require hunting for it below the fold.
      requestAnimationFrame(() => {
        document.getElementById("result-gallery")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      // Keep inputImages/maskImage in the form — user may want to tweak the
      // prompt and re-submit. Revoking their object URLs here would break
      // the in-flight task's preview data too. They get cleared when the
      // user explicitly removes them.
      setForm((current) => ({ ...current, count: normalizedForm.count, size: normalizedForm.size }));

    } catch (error) {
      setFormError(
        showFriendlyError(error),
      );
    }
  }, [addTasks, form, settings, t]);

  const handleAnalyzeImages = useCallback(() => {
    setVisionError("");

    try {
      const normalizedForm = {
        ...visionForm,
        prompt: visionForm.prompt.trim(),
      };
      validateVisionRequest(settings, normalizedForm, {
        apiKeyRequired: t("errors.apiKeyRequired"),
        apiBaseUrlRequired: t("errors.apiBaseUrlRequired"),
        visionModelRequired: t("errors.visionModelRequired"),
        promptRequired: t("errors.promptRequired"),
        imageRequired: t("errors.visionImageRequired"),
      });
      const extraParams = parseAdvancedJson(normalizedForm.advancedJson, {
        invalidJson: t("errors.advancedJsonInvalid"),
        mustBeObject: t("errors.advancedJsonObject"),
      });
      addVisionTask(normalizedForm, extraParams);
      setVisionForm((current) => ({ ...current, prompt: normalizedForm.prompt }));
    } catch (error) {
      setVisionError(
        showFriendlyError(error),
      );
    }
  }, [addVisionTask, settings, t, visionForm]);

  const handleBatchGenerate = useCallback(() => {
    setBatchError("");

    try {
      if (!settings.apiKey.trim()) throw new Error(t("errors.apiKeyRequired"));
      if (!settings.baseUrl.trim()) throw new Error(t("errors.apiBaseUrlRequired"));
      if (!settings.model.trim()) throw new Error(t("errors.modelRequired"));

      const parsed = parsePromptList(batchForm.promptsText);
      if (parsed.prompts.length === 0) {
        throw new Error(t("errors.batchPromptsRequired"));
      }

      const extraParams = parseAdvancedJson(batchForm.advancedJson, {
        invalidJson: t("errors.advancedJsonInvalid"),
        mustBeObject: t("errors.advancedJsonObject"),
      });

      const batchId = createBatchId();
      addBatchTasks({
        prompts: parsed.prompts,
        inputImages: batchForm.inputImages,
        size: batchForm.size.trim() || "1024x1024",
        countPerPrompt: Math.max(1, Math.floor(batchForm.countPerPrompt || 1)),
        extraParams,
        batchId,
      });
      setCurrentBatchId(batchId);
    } catch (error) {
      setBatchError(
        showFriendlyError(error),
      );
    }
  }, [addBatchTasks, batchForm, settings, t]);

  const handleRetryBatchErrors = useCallback(() => {
    if (!currentBatchId) return;
    const restoreFiles = batchForm.inputImages.map((item) => item.file);
    retryBatchErrors(currentBatchId, restoreFiles.length > 0 ? restoreFiles : undefined);
  }, [batchForm.inputImages, currentBatchId, retryBatchErrors]);

  const handleExportBatch = useCallback(async () => {
    if (!currentBatchId) return;
    setIsExportingBatch(true);
    try {
      const result = await downloadBatchZip(tasks, currentBatchId);
      setToast(t("batch.actions.exportDone", { exported: result.exported, missing: result.missing }));
    } catch (error) {
      setBatchError(
        showFriendlyError(error),
      );
    } finally {
      setIsExportingBatch(false);
    }
  }, [currentBatchId, t, tasks]);

  const handleExportBatchClick = useCallback(() => {
    void handleExportBatch();
  }, [handleExportBatch]);

  return (
    <div className="flex min-h-dvh flex-col bg-surface-0 text-text-primary xl:h-dvh xl:overflow-hidden">
      <Header
        onOpenVision={() => setDrawerPanel("vision")}
        onOpenRename={() => setDrawerPanel("rename")}
        onOpenLibrary={() => setDrawerPanel("library")}
        onOpenSettings={() => setDrawerPanel("settings")}
        isConnected={!!(settings.apiKey.trim() && settings.baseUrl.trim())}
        hasTasks={tasks.length > 0}
        onClearTasks={handleClearTasks}
      />

      <StorageHealthBanner />

      {/* App shell: control rail + canvas. The page itself never scrolls on
          desktop — each pane scrolls internally, like a native workbench. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4 xl:flex-row xl:overflow-hidden xl:pt-4">
        {/* Control rail: mode switch on top, panel below, CTA pinned by panel */}
        <section
          className="flex w-full shrink-0 flex-col gap-3 xl:w-[340px]"
          aria-label={t("workspace.modes.generate")}
        >
          <div className="flex shrink-0 rounded border border-surface-3 bg-surface-1 p-0.5" role="group" aria-label={t("workspace.modes.generate")}>
            {(["generate", "batch"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setActiveMode(mode)}
                aria-pressed={activeMode === mode}
                className={`min-h-9 flex-1 whitespace-nowrap rounded px-4 py-1.5 text-sm font-medium transition-colors max-sm:min-h-11 ${
                  activeMode === mode
                    ? "bg-accent/10 text-accent ring-1 ring-accent/40 ring-inset"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {t(`workspace.modes.${mode}`)}
              </button>
            ))}
          </div>
          <div className="min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-0.5">
            {activeMode === "generate" ? (
              <GenerationPanel
                form={form}
                error={formError}
                model={settings.model}
                onChange={updateForm}
                onSubmit={handleGenerate}
                registerDropHandler={registerPanelDropHandler}
              />
            ) : (
              <BatchGenerationPanel
                form={batchForm}
                error={batchError}
                model={settings.model}
                tasks={tasks}
                currentBatchId={currentBatchId}
                isExporting={isExportingBatch}
                onChange={updateBatchForm}
                onSubmit={handleBatchGenerate}
                onRetryBatchErrors={handleRetryBatchErrors}
                onExportBatch={handleExportBatchClick}
                registerDropHandler={registerPanelDropHandler}
              />
            )}
          </div>
        </section>

        {/* Canvas: imagery first — grid of tiles, click for the full story */}
        <section className="flex min-w-0 flex-1 flex-col xl:overflow-hidden" aria-label={t("canvas.title")}>
          {(() => {
            const visibleTasks =
              activeMode === "batch" && currentBatchId
                ? tasks.filter((task) => getTaskBatchId(task) === currentBatchId)
                : tasks;
            if (visibleTasks.length === 0) {
              return (
                <div className="brushed flex min-h-[45vh] flex-1 flex-col items-center justify-center gap-3 rounded border border-dashed border-surface-3 bg-surface-1/40 px-6 text-center">
                  <Images className="h-8 w-8 text-text-tertiary" aria-hidden />
                  <p className="text-sm font-medium text-text-secondary">{t("canvas.empty.title")}</p>
                  <p className="max-w-xs text-xs leading-5 text-text-tertiary">{t("canvas.empty.hint")}</p>
                </div>
              );
            }
            return (
              <div className="min-h-0 flex-1 xl:overflow-y-auto xl:pr-0.5">
                <CanvasGrid
                  tasks={visibleTasks}
                  onOpenTask={setLightboxTask}
                  onRetry={retryTask}
                />
              </div>
            );
          })()}
        </section>
      </div>

      {/* Drawer navigation */}
      <Drawer
        open={drawerPanel === "settings"}
        onClose={() => setDrawerPanel(null)}
        title={t("settings.title")}
      >
        <SettingsPanel settings={settings} onChange={setSettings} onReset={resetSettings} />
      </Drawer>

      <Drawer
        open={drawerPanel === "library"}
        onClose={() => setDrawerPanel(null)}
        title={t("library.title")}
        size="lg"
      >
        <ImageLibrary
          stats={cacheStats}
          onPreview={setPreviewUrl}
          onDeleteImage={clearTaskImage}
          onReuseParams={handleReuseParams}
          onClearImageCache={clearCachedImages}
        />
      </Drawer>

      <Drawer
        open={drawerPanel === "vision"}
        onClose={() => setDrawerPanel(null)}
        title={t("vision.title")}
        size="lg"
      >
        <VisionPanel
          form={visionForm}
          error={visionError}
          visionModel={settings.visionModel}
          onChange={updateVisionForm}
          onSubmit={handleAnalyzeImages}
        />
      </Drawer>

      <Drawer
        open={drawerPanel === "rename"}
        onClose={() => setDrawerPanel(null)}
        title={t("batchRename.title")}
      >
        <BatchRenamePanel settings={settings} />
      </Drawer>

      <TaskLightbox
        task={lightboxTask}
        onClose={() => setLightboxTask(null)}
        onRetry={retryTask}
        onCancel={cancelTask}
        onRemove={removeTask}
        onClearImage={clearTaskImage}
        onReuseParams={handleReuseTask}
      />

      <ImagePreviewModal imageUrl={previewUrl} onClose={closePreview} />

      {/* Toast */}
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded border border-success/30 bg-surface-1 px-4 py-3 text-sm text-success shadow-soft">
          {toast}
        </div>
      ) : null}

      {/* Global drop highlight — shown while files are dragged over the page */}
      {isFileDragging ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-surface-0/80 p-6"
        >
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded border-2 border-dashed border-accent/60 text-accent">
            <ImagePlus className="h-10 w-10" aria-hidden />
            <p className="text-sm font-medium">{t("workspace.dropToAdd")}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
