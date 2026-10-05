/*
 * Intent: Main app shell - dual-mode canvas (Generate/Batch), drawer navigation (2026-10-05)
 * New IA: prompt-first, inline results, secondary panels in drawer
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Menu } from "lucide-react";
import { GenerationPanel } from "./components/GenerationPanel";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { ImageLibrary } from "./components/ImageLibrary";
import { ImagePreviewModal } from "./components/ImagePreviewModal";
import { SettingsPanel } from "./components/SettingsPanel";
import { VisionPanel } from "./components/VisionPanel";
import { BatchRenamePanel } from "./components/BatchRenamePanel";
import { BatchGenerationPanel } from "./components/BatchGenerationPanel";
import { StorageHealthBanner } from "./components/StorageHealthBanner";
import { Drawer } from "./components/Drawer";
import { ResultGallery } from "./components/ResultGallery";

import { useImageTasks } from "./hooks/useImageTasks";
import { useSettings } from "./hooks/useSettings";
import { useFormPersistence } from "./hooks/useFormPersistence";
import { shouldRunMigration, runMigration } from "./lib/storageMigration";
import { requestPersistence } from "./lib/storageNew";
import { toFriendlyError } from "./lib/errors";
import { parseAdvancedJson } from "./lib/parseAdvancedJson";
import { stripGeminiSizeArtifacts } from "./lib/imageSizing";
import { DEFAULT_BATCH_FORM, DEFAULT_FORM, DEFAULT_VISION_FORM, loadBatchPrompts, saveBatchPrompts } from "./lib/storage";
import { toInputImageFile } from "./lib/imageInput";
import { createBatchId, parsePromptList } from "./lib/promptList";
import { downloadBatchZip, getTaskBatchId } from "./lib/batchExport";
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
  const { settings, setSettings, resetSettings, loaded: settingsLoaded } = useSettings();
  const [migrationStatus, setMigrationStatus] = useState<'checking' | 'running' | 'done' | 'error'>('checking');
  const [form, setForm] = useState<GenerateFormState>(DEFAULT_FORM);
  const [visionForm, setVisionForm] = useState<VisionFormState>(DEFAULT_VISION_FORM);
  const [batchForm, setBatchForm] = useState<BatchFormState>(() => ({
    ...DEFAULT_BATCH_FORM,
    promptsText: loadBatchPrompts(),
  }));
  const [formError, setFormError] = useState("");
  const [visionError, setVisionError] = useState("");
  const [batchError, setBatchError] = useState("");
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("openai-image-webui:current-batch-id");
    } catch {
      return null;
    }
  });
  const [isExportingBatch, setIsExportingBatch] = useState(false);

  useEffect(() => {
    try {
      if (currentBatchId) {
        localStorage.setItem("openai-image-webui:current-batch-id", currentBatchId);
      } else {
        localStorage.removeItem("openai-image-webui:current-batch-id");
      }
    } catch {
      // Ignore localStorage failures.
    }
  }, [currentBatchId]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<AppMode>("generate");
  const [drawerPanel, setDrawerPanel] = useState<DrawerPanel>(null);

  // Form drafts (prompt/size/advancedJson) persist to IDB kv. The ref keeps
  // the setters callable from memo-stable callbacks without re-creating them.
  const formPersistence = useFormPersistence();
  const formPersistenceRef = useRef(formPersistence);
  formPersistenceRef.current = formPersistence;

  // One-shot seeding once the persisted draft arrives — only fields the user
  // has not touched this session get restored.
  useEffect(() => {
    if (!formPersistence.loaded) return;
    const { lastPrompt, lastSize, lastAdvancedJson } = formPersistenceRef.current.draft;
    setForm((current) => ({
      ...current,
      prompt: current.prompt || lastPrompt || "",
      size: lastSize || current.size,
      advancedJson: current.advancedJson || lastAdvancedJson || "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot seed on load
  }, [formPersistence.loaded]);

  // Run migration on mount and request persistent storage
  useEffect(() => {
    shouldRunMigration().then(shouldRun => {
      if (!shouldRun) return;
      
      runMigration().then(result => {
        if (result.success) {
          console.log('✅ Storage migration completed successfully');
        } else {
          console.error('❌ Storage migration failed:', result.error);
          setToast(t('settings.migrationFailed') || 'Storage migration failed');
        }
      });
    });
    
    requestPersistence().then(granted => {
      if (granted) {
        console.log('✅ Persistent storage granted');
      }
    });
  }, [t]);

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

  const activeTaskCount = tasks.filter(
    (task) => task.status === "pending" || task.status === "running",
  ).length;

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

  const updateVisionForm = useCallback((next: Partial<VisionFormState>) => {
    setVisionForm((current) => ({ ...current, ...next }));
  }, []);

  const updateBatchForm = useCallback((next: Partial<BatchFormState>) => {
    setBatchForm((current) => {
      const merged = { ...current, ...next };
      if (typeof next.promptsText === "string") {
        saveBatchPrompts(next.promptsText);
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
      payload.size,
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
    const hasInputs = isEdit && pending && pending.images.length > 0;

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
      // Keep inputImages/maskImage in the form — user may want to tweak the
      // prompt and re-submit. Revoking their object URLs here would break
      // the in-flight task's preview data too. They get cleared when the
      // user explicitly removes them.
      setForm((current) => ({ ...current, count: normalizedForm.count, size: normalizedForm.size }));

    } catch (error) {
      setFormError(
        toFriendlyError(error, {
          unknown: t("errors.unknown"),
          requestFailed: t("errors.requestFailed"),
        }),
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
        toFriendlyError(error, {
          unknown: t("errors.unknown"),
          requestFailed: t("errors.requestFailed"),
        }),
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
        toFriendlyError(error, {
          unknown: t("errors.unknown"),
          requestFailed: t("errors.requestFailed"),
        }),
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
        toFriendlyError(error, {
          unknown: t("errors.unknown"),
          requestFailed: t("errors.requestFailed"),
        }),
      );
    } finally {
      setIsExportingBatch(false);
    }
  }, [currentBatchId, t, tasks]);

  const handleExportBatchClick = useCallback(() => {
    void handleExportBatch();
  }, [handleExportBatch]);

  return (
    <div className="min-h-screen bg-surface-0 text-text-primary">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Header
          onOpenMenu={() => setDrawerPanel("settings")}
          onOpenSettings={() => setDrawerPanel("settings")}
          isConnected={!!(settings.apiKey.trim() && settings.baseUrl.trim())}
        />

        <StorageHealthBanner />

        {/* Mode switcher */}
        <nav className="mb-6 flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          <button
            type="button"
            onClick={() => setActiveMode("generate")}
            className={`whitespace-nowrap rounded px-4 py-2 text-sm font-medium transition ${
              activeMode === "generate"
                ? "bg-accent text-surface-0 shadow-sm"
                : "bg-surface-1 text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            }`}
          >
            {t("workspace.modes.generate")}
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("batch")}
            className={`whitespace-nowrap rounded px-4 py-2 text-sm font-medium transition ${
              activeMode === "batch"
                ? "bg-accent text-surface-0 shadow-sm"
                : "bg-surface-1 text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            }`}
          >
            {t("workspace.modes.batch")}
          </button>
          <button
            type="button"
            onClick={() => setDrawerPanel("vision")}
            className="ml-auto whitespace-nowrap rounded border border-surface-3 bg-surface-1 px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-2 hover:text-text-primary"
          >
            {t("workspace.modes.vision")}
          </button>
          <button
            type="button"
            onClick={() => setDrawerPanel("rename")}
            className="whitespace-nowrap rounded border border-surface-3 bg-surface-1 px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-2 hover:text-text-primary"
          >
            {t("workspace.modes.rename")}
          </button>
          <button
            type="button"
            onClick={() => setDrawerPanel("library")}
            className="whitespace-nowrap rounded border border-surface-3 bg-surface-1 px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-2 hover:text-text-primary"
          >
            {t("library.title")}
          </button>
        </nav>

        {/* Main canvas */}
        <main>
          {activeMode === "generate" ? (
            <div className="space-y-6">
              <GenerationPanel
                form={form}
                error={formError}
                model={settings.model}
                onChange={updateForm}
                onSubmit={handleGenerate}
              />
              <ResultGallery
                tasks={tasks}
                onPreview={setPreviewUrl}
                onRetry={retryTask}
                onCancel={cancelTask}
                onRemove={removeTask}
                onClearTaskImage={clearTaskImage}
                onReuseParams={handleReuseTask}
              />
            </div>
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
            />
          )}
        </main>

        <Footer />
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

      <ImagePreviewModal imageUrl={previewUrl} onClose={closePreview} />

      {/* Toast */}
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded border border-success/30 bg-surface-1 px-4 py-3 text-sm text-success shadow-soft">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
