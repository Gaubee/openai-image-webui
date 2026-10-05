/*
 * Intent: Image library with virtual scrolling, marquee selection, and ZIP export
 * Deep theme applied in R1 redesign (2026-10-06)
 */

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { listCachedImages, type CachedImageRecord } from "../lib/imageCache";
import { copyText, downloadImage } from "../lib/download";
import { downloadLibraryZip } from "../lib/libraryExport";
import type { ImageCacheStats, ReuseParamsPayload } from "../types";
import { ImageCacheSummary } from "./ImageCacheSummary";

const PAGE_SIZE = 50;
const CARD_MIN_WIDTH = 160;
const GRID_GAP = 16;
const VIRTUAL_ROW_HEIGHT = 500;
const OVERSCAN_ROWS = 2;
const MARQUEE_THRESHOLD = 4;
const AUTO_SCROLL_MARGIN = 80;
const AUTO_SCROLL_SPEED = 14;

interface MarqueeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  origin: Set<string>;
  additive: boolean;
}

function rectsIntersect(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

type LibraryImage = CachedImageRecord & {
  objectUrl: string;
};

interface ImageLibraryProps {
  stats: ImageCacheStats;
  onPreview: (imageUrl: string) => void;
  onDeleteImage: (id: string) => void;
  onClearImageCache: () => void;
  onReuseParams: (payload: ReuseParamsPayload) => void;
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

function getColumnCount(width: number) {
  if (width <= 0) {
    return 1;
  }

  return Math.max(1, Math.floor((width + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP)));
}

export const ImageLibrary = memo(function ImageLibrary({ stats, onPreview, onDeleteImage, onClearImageCache, onReuseParams }: ImageLibraryProps) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<LibraryImage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messageKey, setMessageKey] = useState("");
  const [gridWidth, setGridWidth] = useState(0);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0, gridTop: 0 });
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const objectUrlsRef = useRef(new Set<string>());
  const virtualGridRef = useRef<HTMLDivElement | null>(null);
  // The grid element mounts only after items load — state so the measurement
  // effect can re-attach its ResizeObserver when it appears.
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  const lastClickedIdRef = useRef<string | null>(null);
  const autoScrollRef = useRef<{ direction: -1 | 0 | 1; raf: number }>({ direction: 0, raf: 0 });

  const revokeObjectUrl = useCallback((url: string) => {
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  }, []);

  const clearObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  }, []);

  const toLibraryImage = useCallback((record: CachedImageRecord): LibraryImage => {
    const objectUrl = URL.createObjectURL(record.blob);
    objectUrlsRef.current.add(objectUrl);
    return { ...record, objectUrl };
  }, []);

  const gridTopRef = useRef(0);

  /** The Drawer scrolls this library — fall back to the document when standalone. */
  const resolveScrollParent = useCallback((): HTMLElement | null => {
    return (virtualGridRef.current?.closest("aside") as HTMLElement | null) ?? null;
  }, []);

  const updateGridTop = useCallback(() => {
    const grid = virtualGridRef.current;
    if (!grid) {
      return;
    }
    const scrollParent = resolveScrollParent();
    if (scrollParent) {
      gridTopRef.current =
        grid.getBoundingClientRect().top +
        scrollParent.scrollTop -
        scrollParent.getBoundingClientRect().top;
    } else {
      gridTopRef.current = grid.getBoundingClientRect().top + window.scrollY;
    }
  }, [resolveScrollParent]);

  const updateViewport = useCallback(() => {
    const scrollParent = resolveScrollParent();
    const scrollTop = scrollParent ? scrollParent.scrollTop : window.scrollY;
    const height = scrollParent ? scrollParent.clientHeight : window.innerHeight;

    if (gridTopRef.current === 0) {
      updateGridTop();
    }

    const rowStride = VIRTUAL_ROW_HEIGHT + GRID_GAP;
    const gridScrollTop = scrollTop - gridTopRef.current;
    const gridScrollBottom = gridScrollTop + height;

    const startRow = Math.max(0, Math.floor(gridScrollTop / rowStride) - OVERSCAN_ROWS);
    const endRow = Math.max(startRow, Math.ceil(gridScrollBottom / rowStride) + OVERSCAN_ROWS);

    setViewport((prev) => {
      const oldGridScrollTop = prev.scrollTop - prev.gridTop;
      const oldGridScrollBottom = oldGridScrollTop + prev.height;
      const oldStartRow = Math.max(0, Math.floor(oldGridScrollTop / rowStride) - OVERSCAN_ROWS);
      const oldEndRow = Math.max(oldStartRow, Math.ceil(oldGridScrollBottom / rowStride) + OVERSCAN_ROWS);

      if (
        oldStartRow !== startRow ||
        oldEndRow !== endRow ||
        Math.abs(prev.gridTop - gridTopRef.current) > 2 ||
        prev.height !== height
      ) {
        return {
          scrollTop,
          height,
          gridTop: gridTopRef.current,
        };
      }
      return prev;
    });
  }, [updateGridTop, resolveScrollParent]);

  const loadFirstPage = useCallback(async () => {
    setIsLoading(true);
    setMessageKey("");

    try {
      const page = await listCachedImages(0, PAGE_SIZE);
      clearObjectUrls();
      setItems(page.images.map(toLibraryImage));
      setHasMore(page.hasMore);
      return true;
    } catch (error) {
      console.warn("[openai-image-webui] Failed to load image library", error);
      setMessageKey("library.messages.loadFailed");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [clearObjectUrls, toLibraryImage]);

  // Snapshot of the cache size at the time of the last load, so we can tell
  // the user how many images arrived since then.
  const [loadedCount, setLoadedCount] = useState<number | null>(null);
  const pendingNewCount = loadedCount === null ? 0 : Math.max(0, stats.count - loadedCount);

  const refreshLibrary = useCallback(async () => {
    if (await loadFirstPage()) {
      setLoadedCount(stats.count);
    }
  }, [loadFirstPage, stats.count]);

  const statsCountRef = useRef(stats.count);
  statsCountRef.current = stats.count;

  useEffect(() => {
    void loadFirstPage().then((ok) => {
      if (ok) {
        setLoadedCount(statsCountRef.current);
      }
    });
    // Deliberately runs once on mount. Reloading whenever `stats` changes would
    // yank the user back to page 1 every time a background generation finishes,
    // which makes the library unusable during batch runs. New images are
    // surfaced through the refresh hint instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => clearObjectUrls();
  }, [clearObjectUrls]);

  useEffect(() => {
    updateGridTop();
    updateViewport();
  }, [items.length, updateGridTop, updateViewport]);

  useEffect(() => {
    let frame = 0;

    function scheduleUpdate(forceMeasure = false) {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (forceMeasure) {
          updateGridTop();
        }
        updateViewport();
      });
    }

    const observer = new ResizeObserver(([entry]) => {
      setGridWidth(entry?.contentRect.width ?? 0);
      scheduleUpdate(true);
    });

    // The grid mounts only after items load (async) — re-attach whenever the
    // element appears, or gridWidth stays 0 and the grid is stuck at 1 column.
    if (gridEl) {
      observer.observe(gridEl);
    }

    // The library scrolls inside its Drawer (overflow-y-auto), not the window —
    // virtualization must listen to the nearest scrollable ancestor.
    const scrollParent = (gridEl?.closest("aside") as HTMLElement | null) ?? null;

    const handleScroll = () => scheduleUpdate(false);
    const handleResize = () => scheduleUpdate(true);

    scrollParent?.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);
    scheduleUpdate(true);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }

      observer.disconnect();
      scrollParent?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [gridEl, updateGridTop, updateViewport]);


  const virtualGrid = useMemo(() => {
    const columnCount = getColumnCount(gridWidth);
    const rowCount = Math.ceil(items.length / columnCount);
    const rowStride = VIRTUAL_ROW_HEIGHT + GRID_GAP;
    const gridScrollTop = viewport.scrollTop - viewport.gridTop;
    const gridScrollBottom = gridScrollTop + viewport.height;
    const startRow = Math.max(0, Math.floor(gridScrollTop / rowStride) - OVERSCAN_ROWS);
    const endRow = Math.min(
      rowCount,
      Math.max(startRow, Math.ceil(gridScrollBottom / rowStride) + OVERSCAN_ROWS),
    );
    const rows = Array.from({ length: Math.max(0, endRow - startRow) }, (_, index) => {
      const rowIndex = startRow + index;
      const startIndex = rowIndex * columnCount;
      return {
        rowIndex,
        items: items.slice(startIndex, startIndex + columnCount),
      };
    });

    return {
      columnCount,
      rowCount,
      rows,
      totalHeight: rowCount > 0 ? rowCount * VIRTUAL_ROW_HEIGHT + (rowCount - 1) * GRID_GAP : 0,
    };
  }, [gridWidth, items, viewport]);

  const layout = useMemo(() => {
    const columnCount = getColumnCount(gridWidth);
    const columnWidth =
      columnCount > 0 && gridWidth > 0
        ? (gridWidth - (columnCount - 1) * GRID_GAP) / columnCount
        : CARD_MIN_WIDTH;
    return { columnCount, columnWidth };
  }, [gridWidth]);

  const computeMarqueeHits = useCallback(
    (m: MarqueeState): Set<string> => {
      const { columnCount, columnWidth } = layout;
      const r = {
        left: Math.min(m.startX, m.currentX),
        right: Math.max(m.startX, m.currentX),
        top: Math.min(m.startY, m.currentY),
        bottom: Math.max(m.startY, m.currentY),
      };
      const hits = new Set<string>();
      const colStride = columnWidth + GRID_GAP;
      const rowStride = VIRTUAL_ROW_HEIGHT + GRID_GAP;
      for (let i = 0; i < items.length; i += 1) {
        const row = Math.floor(i / columnCount);
        const col = i % columnCount;
        const box = {
          left: col * colStride,
          right: col * colStride + columnWidth,
          top: row * rowStride,
          bottom: row * rowStride + VIRTUAL_ROW_HEIGHT,
        };
        if (rectsIntersect(r, box)) {
          hits.add(items[i].id);
        }
      }
      return hits;
    },
    [items, layout],
  );

  const previewSelection = useMemo<Set<string> | null>(() => {
    if (!marquee) {
      return null;
    }
    const dx = Math.abs(marquee.currentX - marquee.startX);
    const dy = Math.abs(marquee.currentY - marquee.startY);
    if (dx < MARQUEE_THRESHOLD && dy < MARQUEE_THRESHOLD) {
      return marquee.origin;
    }
    const hits = computeMarqueeHits(marquee);
    if (marquee.additive) {
      const merged = new Set(marquee.origin);
      hits.forEach((id) => merged.add(id));
      return merged;
    }
    return hits;
  }, [marquee, computeMarqueeHits]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current.raf) {
      cancelAnimationFrame(autoScrollRef.current.raf);
      autoScrollRef.current.raf = 0;
    }
    autoScrollRef.current.direction = 0;
  }, []);

  const updateAutoScroll = useCallback((clientY: number) => {
    let dir: -1 | 0 | 1 = 0;
    if (clientY < AUTO_SCROLL_MARGIN) {
      dir = -1;
    } else if (clientY > window.innerHeight - AUTO_SCROLL_MARGIN) {
      dir = 1;
    }
    if (dir === autoScrollRef.current.direction) {
      return;
    }
    autoScrollRef.current.direction = dir;
    if (dir === 0) {
      if (autoScrollRef.current.raf) {
        cancelAnimationFrame(autoScrollRef.current.raf);
        autoScrollRef.current.raf = 0;
      }
      return;
    }
    if (autoScrollRef.current.raf) {
      return;
    }
    const tick = () => {
      if (autoScrollRef.current.direction === 0) {
        autoScrollRef.current.raf = 0;
        return;
      }
      window.scrollBy(0, autoScrollRef.current.direction * AUTO_SCROLL_SPEED);
      autoScrollRef.current.raf = requestAnimationFrame(tick);
    };
    autoScrollRef.current.raf = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!marquee) {
      return;
    }

    function onMove(e: MouseEvent) {
      const grid = virtualGridRef.current;
      if (!grid) return;
      const rect = grid.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMarquee((current) => (current ? { ...current, currentX: x, currentY: y } : current));
      updateAutoScroll(e.clientY);
    }

    function onUp() {
      stopAutoScroll();
      setMarquee((current) => {
        if (!current) return null;
        const dx = Math.abs(current.currentX - current.startX);
        const dy = Math.abs(current.currentY - current.startY);
        if (dx < MARQUEE_THRESHOLD && dy < MARQUEE_THRESHOLD) {
          return null;
        }
        const hits = computeMarqueeHits(current);
        if (current.additive) {
          const merged = new Set(current.origin);
          hits.forEach((id) => merged.add(id));
          setSelectedIds(merged);
        } else {
          setSelectedIds(hits);
        }
        return null;
      });
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        stopAutoScroll();
        setMarquee(null);
      }
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [marquee, computeMarqueeHits, stopAutoScroll, updateAutoScroll]);

  useEffect(() => {
    return () => stopAutoScroll();
  }, [stopAutoScroll]);

  function handleGridMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!selectionMode || e.button !== 0) {
      return;
    }
    const target = e.target as HTMLElement;
    // Skip when clicking inside a card; card click handles selection toggle.
    if (target.closest("article")) {
      return;
    }
    const grid = virtualGridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.preventDefault();
    setMarquee({
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      origin: new Set(selectedIds),
      additive: e.shiftKey || e.ctrlKey || e.metaKey,
    });
  }

  function toggleSelectOne(id: string, e: React.MouseEvent) {
    if (e.shiftKey && lastClickedIdRef.current && lastClickedIdRef.current !== id) {
      const ids = items.map((i) => i.id);
      const a = ids.indexOf(lastClickedIdRef.current);
      const b = ids.indexOf(id);
      if (a >= 0 && b >= 0) {
        const [from, to] = a < b ? [a, b] : [b, a];
        setSelectedIds((current) => {
          const next = new Set(current);
          for (let i = from; i <= to; i += 1) {
            next.add(ids[i]);
          }
          return next;
        });
        lastClickedIdRef.current = id;
        return;
      }
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    lastClickedIdRef.current = id;
  }

  function enterSelectionMode() {
    setSelectionMode(true);
    setSelectedIds(new Set());
    lastClickedIdRef.current = null;
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setMarquee(null);
    lastClickedIdRef.current = null;
    stopAutoScroll();
  }

  function selectAllLoaded() {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleDownloadSelectedZip() {
    if (isExporting) return;
    const list = items.filter((i) => selectedIds.has(i.id));
    if (list.length === 0) return;
    setIsExporting(true);
    setMessageKey("");
    try {
      await downloadLibraryZip(list);
      setMessageKey("library.messages.zipDownloadStarted");
    } catch (error) {
      console.warn("[openai-image-webui] Failed to export ZIP", error);
      setMessageKey("library.messages.zipFailed");
    } finally {
      setIsExporting(false);
    }
  }


  async function handleLoadMore() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setMessageKey("");

    try {
      const page = await listCachedImages(items.length, PAGE_SIZE);
      setItems((current) => [...current, ...page.images.map(toLibraryImage)]);
      setHasMore(page.hasMore);
      updateViewport();
    } catch (error) {
      console.warn("[openai-image-webui] Failed to load more images", error);
      setMessageKey("library.messages.loadFailed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopyPrompt(item: LibraryImage) {
    await copyText(item.prompt || "");
    setMessageKey("library.messages.promptCopied");
  }

  async function handleDownload(item: LibraryImage) {
    await downloadImage(item.objectUrl, `openai-image-${item.id.slice(0, 8)}`, item.mimeType);
    setMessageKey("library.messages.downloadStarted");
  }

  function handleDelete(item: LibraryImage) {
    if (!window.confirm(t("library.deleteConfirm"))) {
      return;
    }

    revokeObjectUrl(item.objectUrl);
    onDeleteImage(item.id);
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    setMessageKey("library.messages.imageDeleted");
    // Keep the "new images" counter aligned with what we actually show, so a
    // deletion does not look like an incoming image.
    setLoadedCount((current) => (current === null ? current : Math.max(0, current - 1)));
  }

  function handleClearAll() {
    clearObjectUrls();
    setItems([]);
    setHasMore(false);
    onClearImageCache();
    setMessageKey("library.messages.cacheCleared");
    setLoadedCount(0);
  }

  function handleReuseFromLibrary(item: LibraryImage) {
    const payload: ReuseParamsPayload = {
      model: item.model || "",
      prompt: item.prompt || "",
      size: item.generationSize || "1024x1024",
      responseFormat: (item.responseFormat as "url" | "b64_json") || "b64_json",
      // Library images never have in-memory references
      inputImagesLost: false,
    };
    onReuseParams(payload);
  }

  return (
    <section className="rounded border border-surface-3 bg-surface-1 p-5">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-secondary">{t("library.subtitle")}</p>
        </div>
      </div>

      <div className="mb-5">
        <ImageCacheSummary stats={stats} onClear={handleClearAll} />
      </div>

      {pendingNewCount > 0 ? (
        <button
          type="button"
          className="mb-4 flex w-full items-center justify-center gap-2 rounded border border-accent bg-accent px-4 py-2.5 text-sm font-medium text-surface-0 transition-colors hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading}
          onClick={() => void refreshLibrary()}
        >
          {t("library.newImages", { count: pendingNewCount })}
        </button>
      ) : null}

      {messageKey ? <div className="mb-4 text-xs text-success">{t(messageKey)}</div> : null}

      {items.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {!selectionMode ? (
            <button
              type="button"
              className="rounded border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-3"
              onClick={enterSelectionMode}
            >
              {t("library.selection.enter")}
            </button>
          ) : (
            <>
              <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-text-primary">
                {t("library.selection.count", { count: selectedIds.size })}
              </span>
              <button
                type="button"
                className="rounded border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-3"
                onClick={selectAllLoaded}
              >
                {t("library.selection.selectAll")}
              </button>
              <button
                type="button"
                className="rounded border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:text-text-tertiary"
                disabled={selectedIds.size === 0}
                onClick={clearSelection}
              >
                {t("library.selection.clear")}
              </button>
              <button
                type="button"
                className="rounded border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-surface-0 transition-colors hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-text-tertiary"
                disabled={selectedIds.size === 0 || isExporting}
                onClick={() => void handleDownloadSelectedZip()}
              >
                {isExporting
                  ? t("library.selection.zipPacking")
                  : t("library.selection.downloadZip", { count: selectedIds.size })}
              </button>
              <button
                type="button"
                className="ml-auto rounded border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3"
                onClick={exitSelectionMode}
              >
                {t("library.selection.exit")}
              </button>
              <p className="basis-full text-xs text-text-tertiary">{t("library.selection.hint")}</p>
            </>
          )}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded border border-dashed border-surface-3 bg-surface-2 px-6 py-14 text-center text-sm text-text-secondary">
          {isLoading ? t("library.loading") : t("library.empty")}
        </div>
      ) : (
        <>
          <div
            ref={(el) => {
              virtualGridRef.current = el;
              setGridEl(el);
            }}
            className={`relative ${selectionMode ? "select-none" : ""}`}
            style={{ height: virtualGrid.totalHeight }}
            onMouseDown={handleGridMouseDown}
          >
            {virtualGrid.rows.map((row) => (
              <div
                key={row.rowIndex}
                className="absolute left-0 grid w-full"
                style={{
                  top: row.rowIndex * (VIRTUAL_ROW_HEIGHT + GRID_GAP),
                  height: VIRTUAL_ROW_HEIGHT,
                  gap: GRID_GAP,
                  gridTemplateColumns: `repeat(${virtualGrid.columnCount}, minmax(0, 1fr))`,
                }}
              >
                {row.items.map((item) => {
                  const isSelected = selectedIds.has(item.id) || (previewSelection ? previewSelection.has(item.id) : false);
                  return (
                    <ImageCard
                      key={item.id}
                      item={item}
                      isSelected={isSelected}
                      selectionMode={selectionMode}
                      t={t}
                      onPreview={onPreview}
                      onDownload={handleDownload}
                      onCopyPrompt={handleCopyPrompt}
                      onReuse={handleReuseFromLibrary}
                      onDelete={handleDelete}
                      onToggleSelect={toggleSelectOne}
                    />
                  );
                })}
              </div>
            ))}
            {marquee ? (
              <div
                className="pointer-events-none absolute z-20 rounded-sm border-2 border-accent bg-accent/20"
                style={{
                  left: Math.min(marquee.startX, marquee.currentX),
                  top: Math.min(marquee.startY, marquee.currentY),
                  width: Math.abs(marquee.currentX - marquee.startX),
                  height: Math.abs(marquee.currentY - marquee.startY),
                }}
              />
            ) : null}
          </div>

          {hasMore ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                className="rounded border border-surface-3 bg-surface-2 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:text-text-tertiary"
                disabled={isLoading}
                onClick={() => void handleLoadMore()}
              >
                {isLoading ? t("library.loading") : t("library.loadMore")}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
});

interface ImageCardProps {
  item: LibraryImage;
  isSelected: boolean;
  selectionMode: boolean;
  t: TFunction;
  onPreview: (url: string) => void;
  onDownload: (item: LibraryImage) => void;
  onCopyPrompt: (item: LibraryImage) => void;
  onReuse: (item: LibraryImage) => void;
  onDelete: (item: LibraryImage) => void;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
}

const ImageCard = memo(function ImageCard({
  item,
  isSelected,
  selectionMode,
  t,
  onPreview,
  onDownload,
  onCopyPrompt,
  onReuse,
  onDelete,
  onToggleSelect,
}: ImageCardProps) {
  const { i18n } = useTranslation();
  const cardClass = [
    "relative flex h-full flex-col overflow-hidden rounded border bg-surface-2 transition-colors",
    isSelected ? "border-accent ring-2 ring-accent/30" : "border-surface-3",
    selectionMode ? "cursor-pointer select-none" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const onCardClick = selectionMode
    ? (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault();
        e.stopPropagation();
        onToggleSelect(item.id, e);
      }
    : undefined;

  return (
    <article
      className={cardClass}
      onClickCapture={onCardClick}
      onMouseDownCapture={selectionMode ? (e) => e.stopPropagation() : undefined}
    >
      {selectionMode ? (
        <div
          className={`pointer-events-none absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold ${
            isSelected ? "border-accent bg-accent text-surface-0" : "border-surface-4 bg-surface-4/70 text-transparent"
          }`}
          aria-hidden
        >
          ✓
        </div>
      ) : null}
      <button
        type="button"
        className="block h-56 w-full shrink-0 bg-surface-3"
        onClick={() => onPreview(item.objectUrl)}
        aria-label={t("library.previewImage")}
        tabIndex={selectionMode ? -1 : 0}
      >
        <img
          className="h-full w-full object-cover"
          src={item.objectUrl}
          alt={item.prompt || t("library.unknownPrompt")}
          loading="lazy"
          draggable={false}
        />
      </button>
      <div className="flex min-h-0 flex-1 flex-col space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
          <span>{new Date(item.taskCreatedAt || item.cachedAt).toLocaleString(i18n.resolvedLanguage)}</span>
          <span>{formatBytes(item.size)}</span>
        </div>
        <p className="line-clamp-2 min-h-10 text-sm leading-5 text-text-primary">
          {item.prompt || t("library.unknownPrompt")}
        </p>
        <dl className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
          <div className="rounded bg-surface-3 p-2">
            <dt className="font-medium text-text-primary">{t("tasks.fields.model")}</dt>
            <dd className="mt-1 truncate">{item.model || t("library.unknownModel")}</dd>
          </div>
          <div className="rounded bg-surface-3 p-2">
            <dt className="font-medium text-text-primary">{t("tasks.fields.size")}</dt>
            <dd className="mt-1">{item.generationSize || "-"}</dd>
          </div>
        </dl>
        <div className="mt-auto flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-surface-3 bg-surface-1 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
            onClick={() => onPreview(item.objectUrl)}
            tabIndex={selectionMode ? -1 : 0}
          >
            {t("tasks.actions.preview")}
          </button>
          <button
            type="button"
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-surface-0 transition-colors hover:bg-accent-dim"
            onClick={() => void onDownload(item)}
            tabIndex={selectionMode ? -1 : 0}
          >
            {t("tasks.actions.download")}
          </button>
          <button
            type="button"
            className="rounded border border-surface-3 bg-surface-1 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary disabled:cursor-not-allowed disabled:text-text-tertiary"
            disabled={!item.prompt}
            onClick={() => void onCopyPrompt(item)}
            tabIndex={selectionMode ? -1 : 0}
          >
            {t("tasks.actions.copyPrompt")}
          </button>
          <button
            type="button"
            className="rounded border border-surface-3 bg-surface-1 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
            onClick={() => onReuse(item)}
            tabIndex={selectionMode ? -1 : 0}
          >
            {t("tasks.actions.reuseParams")}
          </button>
          <button
            type="button"
            className="rounded border border-error/30 bg-surface-1 px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error/10"
            onClick={() => onDelete(item)}
            tabIndex={selectionMode ? -1 : 0}
          >
            {t("tasks.actions.delete")}
          </button>
        </div>
      </div>
    </article>
  );
});
