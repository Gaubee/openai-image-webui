/*
 * Intent: Settings panel for API credentials, model selection, and concurrency
 * Deep theme applied in R1 redesign (2026-10-06)
 */

import { useEffect, useId, useRef, useState, memo } from "react";
import { useTranslation } from "react-i18next";
import { fetchModels, type ModelCapability, type ModelInfo } from "../api/openaiModels";
import { toFriendlyError } from "../lib/errors";
import type { AppSettings, ImageResponseFormat } from "../types";
import { Notice } from "./Notice";

const PROVIDER_PRESETS: Array<{
  name: string;
  descriptionKey: string;
  settings: Pick<AppSettings, "baseUrl" | "model" | "visionModel" | "responseFormat">;

}> = [
  {
    name: "OpenAI",
    descriptionKey: "settings.presets.openai.description",
    settings: {
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-image-1",
      visionModel: "gpt-4.1-mini",
      responseFormat: "url",

    },
  },
  {
    name: "LaoZhang API",
    descriptionKey: "settings.presets.laozhang.description",
    settings: {
      baseUrl: "https://api.laozhang.ai/v1",
      model: "gpt-image-1",
      visionModel: "gpt-4.1-mini",
      responseFormat: "url",

    },
  },
  {
    name: "LaoZhang VIP",
    descriptionKey: "settings.presets.laozhangVip.description",
    settings: {
      baseUrl: "https://api-vip.laozhang.ai/v1",
      model: "gpt-image-1",
      visionModel: "gpt-4.1-mini",
      responseFormat: "url",

    },
  },
];

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (next: Partial<AppSettings>) => void;
  onReset: () => void;
}

interface ModelsState {
  status: "idle" | "loading" | "success" | "error";
  list: ModelInfo[];
  error: string;
}

const INITIAL_MODELS_STATE: ModelsState = {
  status: "idle",
  list: [],
  error: "",
};

type ModelFilter = "all" | ModelCapability;

const MODEL_FILTER_OPTIONS: Array<{ value: ModelFilter; labelKey: string }> = [
  { value: "image", labelKey: "settings.models.filters.image" },
  { value: "non-image", labelKey: "settings.models.filters.non-image" },
  { value: "all", labelKey: "settings.models.filters.all" },
];

const MODEL_CATEGORY_LABEL_KEYS: Record<ModelCapability, string> = {
  image: "settings.models.filters.image",
  "non-image": "settings.models.filters.non-image",
};


export const SettingsPanel = memo(function SettingsPanel({ settings, onChange, onReset }: SettingsPanelProps) {
  const { t } = useTranslation();
  const datalistId = useId();
  const visionDatalistId = useId();
  const [modelsState, setModelsState] = useState<ModelsState>(INITIAL_MODELS_STATE);
  const [modelFilter, setModelFilter] = useState<ModelFilter>("image");
  const [isCollapsed, setIsCollapsed] = useState(() => !!settings.apiKey.trim());
  const abortRef = useRef<AbortController | null>(null);
  const lastFetchedKeyRef = useRef<string>("");

  // Reset the model suggestions whenever the credential pair changes,
  // so the user does not see stale results from a different provider.
  useEffect(() => {
    const currentKey = `${settings.baseUrl.trim()}::${settings.apiKey.trim()}`;
    if (lastFetchedKeyRef.current && lastFetchedKeyRef.current !== currentKey) {
      setModelsState(INITIAL_MODELS_STATE);
      lastFetchedKeyRef.current = "";
    }
  }, [settings.apiKey, settings.baseUrl]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function handleFetchModels() {
    if (!settings.apiKey.trim()) {
      setModelsState({ status: "error", list: [], error: t("errors.apiKeyRequiredToFetchModels") });
      return;
    }

    if (!settings.baseUrl.trim()) {
      setModelsState({ status: "error", list: [], error: t("errors.apiBaseUrlRequiredToFetchModels") });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setModelsState({ status: "loading", list: [], error: "" });

    try {
      const list = await fetchModels({
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        signal: controller.signal,
      });
      lastFetchedKeyRef.current = `${settings.baseUrl.trim()}::${settings.apiKey.trim()}`;
      setModelsState({ status: "success", list, error: "" });
    } catch (error) {
      if (controller.signal.aborted) return;
      setModelsState({
        status: "error",
        list: [],
        error: toFriendlyError(error, {
          unknown: t("errors.unknown"),
          requestFailed: t("errors.requestFailed"),
        }),
      });
    }
  }

  const imageModels = modelsState.list.filter((item) => item.isImageModel);
  const filteredModels = modelsState.list.filter((item) => {
    if (modelFilter === "all") return true;
    return item.category === modelFilter;
  });
  const categoryCounts = MODEL_FILTER_OPTIONS.reduce<Record<ModelFilter, number>>(
    (counts, option) => {
      counts[option.value] = modelsState.list.filter((item) => {
        if (option.value === "all") return true;
        return item.category === option.value;
      }).length;
      return counts;
    },
    {
      all: 0,
      image: 0,
      "non-image": 0,
    },
  );


  if (isCollapsed) {
    return (
      <section className="rounded border border-surface-3 bg-surface-1 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold leading-tight text-text-primary">
              <span>{t("settings.title")}</span>
              <span className="inline-block rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-normal text-text-tertiary max-w-[120px] truncate" title={settings.model}>
                {settings.model || "openai"}
              </span>
            </p>
            <p className="mt-0.5 truncate text-[11px] text-text-tertiary max-w-[240px]" title={settings.baseUrl}>
              {settings.baseUrl.replace(/^https?:\/\//i, "")}
            </p>
          </div>
          <button
            type="button"
            className="rounded border border-surface-3 bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-3"
            onClick={() => setIsCollapsed(false)}
          >
            {t("settings.edit")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded border border-surface-3 bg-surface-1 p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <p className="text-sm text-text-secondary">{t("settings.subtitle")}</p>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            className="rounded border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
            onClick={onReset}
          >
            {t("settings.reset")}
          </button>
          {settings.apiKey.trim() && (
            <button
              type="button"
              className="rounded border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
              onClick={() => setIsCollapsed(true)}
            >
              {t("settings.fold")}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <span className="mb-2 block text-sm font-medium text-text-primary">
            {t("settings.providerPresets")}
          </span>
          <div className="grid gap-2 sm:grid-cols-2">
            {PROVIDER_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className="rounded border border-surface-3 bg-surface-2 p-3 text-left transition-colors hover:border-accent hover:bg-surface-3"
                onClick={() => onChange(preset.settings)}
              >
                <span className="block text-sm font-semibold text-text-primary">{preset.name}</span>
                <span className="mt-1 block text-xs text-text-secondary">{t(preset.descriptionKey)}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-text-secondary">{t("settings.presetsNote")}</p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-text-primary">{t("settings.apiBaseUrl")}</span>
          <input
            className="w-full rounded border border-surface-3 bg-surface-1 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/30"
            placeholder="https://api.openai.com/v1"
            value={settings.baseUrl}
            onChange={(event) => onChange({ baseUrl: event.target.value })}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-text-primary">{t("settings.apiKey")}</span>
          <input
            className="w-full rounded border border-surface-3 bg-surface-1 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/30"
            type="password"
            placeholder="sk-..."
            autoComplete="off"
            value={settings.apiKey}
            onChange={(event) => onChange({ apiKey: event.target.value })}
          />
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-text-primary">{t("settings.model")}</span>
            <div className="flex items-center gap-2">
              <select
                className="rounded border border-surface-3 bg-surface-2 px-2 py-1 text-xs font-medium text-text-primary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
                value={modelFilter}
                onChange={(event) => setModelFilter(event.target.value as ModelFilter)}
              >
                {MODEL_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {modelsState.status === "success"
                      ? `${t(option.labelKey)} (${categoryCounts[option.value]})`
                      : t(option.labelKey)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded border border-surface-3 bg-surface-2 px-2 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleFetchModels}
                disabled={modelsState.status === "loading"}
              >
                {modelsState.status === "loading"
                  ? t("settings.models.fetching")
                  : t("settings.models.fetchModels")}
              </button>
            </div>
          </div>
          <input
            list={datalistId}
            className="w-full rounded border border-surface-3 bg-surface-1 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/30"
            placeholder="gpt-image-1 or gpt-4o-image"
            value={settings.model}
            onChange={(event) => onChange({ model: event.target.value })}
          />
          <datalist id={datalistId}>
            {filteredModels.map((item) => {
              const categoryLabel = t(MODEL_CATEGORY_LABEL_KEYS[item.category]);
              return (
                <option key={`${item.category}-${item.id}`} value={item.id}>
                  {item.ownedBy
                    ? t("settings.models.optionWithOwner", {
                        category: categoryLabel,
                        owner: item.ownedBy,
                      })
                    : categoryLabel}
                </option>
              );
            })}
          </datalist>
          {modelsState.status === "success" && (
            <p className="mt-1.5 text-xs text-text-secondary">
              {t("settings.models.loaded", {
                total: modelsState.list.length,
                image: imageModels.length,
                shown: filteredModels.length,
              })}
            </p>
          )}
          {modelsState.status === "error" && (
            <p className="mt-1.5 text-xs text-error">{modelsState.error}</p>
          )}
          {modelsState.status === "idle" && (
            <p className="mt-1.5 text-xs text-text-secondary">{t("settings.models.idle")}</p>
          )}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-text-primary">
            {t("settings.visionModel")}
          </span>
          <input
            list={visionDatalistId}
            className="w-full rounded border border-surface-3 bg-surface-1 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/30"
            placeholder="gpt-4.1-mini or gpt-4o-mini"
            value={settings.visionModel}
            onChange={(event) => onChange({ visionModel: event.target.value })}
          />
          <datalist id={visionDatalistId}>
            {modelsState.list.map((item) => {
              const categoryLabel = t(MODEL_CATEGORY_LABEL_KEYS[item.category]);
              return (
                <option key={`vision-${item.category}-${item.id}`} value={item.id}>
                  {item.ownedBy
                    ? t("settings.models.optionWithOwner", {
                        category: categoryLabel,
                        owner: item.ownedBy,
                      })
                    : categoryLabel}
                </option>
              );
            })}
          </datalist>
          <p className="mt-1.5 text-xs text-text-secondary">{t("settings.visionModelHint")}</p>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-text-primary">
            {t("settings.responseFormat")}
          </span>
          <select

            className="w-full rounded border border-surface-3 bg-surface-1 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
            value={settings.responseFormat}
            onChange={(event) =>
              onChange({ responseFormat: event.target.value as ImageResponseFormat })
            }
          >
            <option value="url">url</option>
            <option value="b64_json">b64_json</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-text-primary">
            {t("settings.concurrency")}
          </span>
          <input
            className="w-full rounded border border-surface-3 bg-surface-1 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
            type="number"
            min={1}
            max={10}
            value={settings.concurrency}
            onChange={(event) => onChange({ concurrency: Number(event.target.value) })}
          />
        </label>

        <Notice variant="warning">{t("settings.apiKeyNotice")}</Notice>
      </div>
    </section>
  );
});
