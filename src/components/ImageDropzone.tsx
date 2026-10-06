/*
 * Intent: Image upload dropzone with thumbnails (2026-10-06 R1 fix)
 * Deep theme, high-contrast add button (Gap #3)
 */

import { useRef, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import type { InputImageFile } from "../types";

export interface ImageDropzoneProps {
  images: InputImageFile[];
  onAdd: (files: FileList | File[]) => void | Promise<void>;
  onRemove: (id: string) => void;
  title: string;
  hint: string;
  addButtonLabel: string;
  removeLabel: string;
  accept?: string;
  badge?: string;
  warning?: string;
  error?: string;
  sizeLabel?: (width: number, height: number) => string;
  children?: ReactNode;
}

export function ImageDropzone({
  images,
  onAdd,
  onRemove,
  title,
  hint,
  addButtonLabel,
  removeLabel,
  accept = "image/png,image/jpeg,image/webp",
  badge,
  warning,
  error,
  sizeLabel = (width, height) => `${width}×${height}`,
  children,
}: ImageDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function onFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files.length > 0) {
      void onAdd(event.target.files);
    }
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      void onAdd(files);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  return (
    <div
      className="rounded border border-surface-3 bg-surface-2 p-3 transition-colors"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-text-secondary">{title}</p>
        {badge && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-surface-0">{badge}</span>}
      </div>
      <p className="mt-1 text-xs text-text-tertiary">{hint}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {images.map((item) => (
          <div
            key={item.id}
            className="group relative h-20 w-20 overflow-hidden rounded border border-surface-3 bg-surface-1"
            title={`${item.file.name} · ${item.width}×${item.height}`}
          >
            <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />
            <button
              type="button"
              className="absolute right-0 top-0 rounded-bl bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-colors group-hover:opacity-100"
              onClick={() => onRemove(item.id)}
            >
              {removeLabel}
            </button>
            <span className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 text-center text-[10px] text-white">
              {sizeLabel(item.width, item.height)}
            </span>
          </div>
        ))}

        {/* Contrast fix: neutral dashed tile, amber reserved for hover only */}
        <button
          type="button"
          className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded border border-dashed border-surface-4 bg-surface-1 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent"
          onClick={() => fileInputRef.current?.click()}
        >
          <span aria-hidden className="text-lg leading-none">+</span>
          {addButtonLabel}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          hidden
          onChange={onFileInputChange}
        />
      </div>

      {children}

      {warning && <p className="mt-2 text-xs text-text-secondary">{warning}</p>}
      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </div>
  );
}
