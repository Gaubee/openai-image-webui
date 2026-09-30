import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { InputImageFile } from "../types";

const PAINT_COLOR = "rgb(244, 63, 94)";

interface MaskEditorProps {
  image: InputImageFile;
  initialMask: InputImageFile | null;
  /** Receives the mask PNG, or null when nothing is painted. */
  onApply: (mask: File | null) => void;
  onCancel: () => void;
}

/**
 * Paint the region to redraw on top of the first reference image. The painted
 * layer lives at the image's native resolution; on apply it becomes an OpenAI
 * style mask: opaque everywhere except the painted (editable) areas.
 */
export function MaskEditor({ image, initialMask, onApply, onCancel }: MaskEditorProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [brushSize, setBrushSize] = useState(() => Math.round(Math.max(image.width, image.height) / 20));
  const [erasing, setErasing] = useState(false);
  const maxBrush = Math.round(Math.max(image.width, image.height) / 4);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!initialMask || !ctx) return;

    // Painted = where the existing mask is transparent.
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = PAINT_COLOR;
      ctx.fillRect(0, 0, image.width, image.height);
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(img, 0, 0, image.width, image.height);
      ctx.globalCompositeOperation = "source-over";
    };
    img.src = initialMask.previewUrl;
  }, [image.height, image.width, initialMask]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  function toCanvasPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    };
  }

  function paint(from: { x: number; y: number }, to: { x: number; y: number }) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    ctx.fillStyle = PAINT_COLOR;
    ctx.strokeStyle = PAINT_COLOR;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (from.x === to.x && from.y === to.y) {
      ctx.arc(to.x, to.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toCanvasPoint(event);
    lastPointRef.current = point;
    paint(point, point);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const last = lastPointRef.current;
    if (!last) return;
    const point = toCanvasPoint(event);
    paint(last, point);
    lastPointRef.current = point;
  }

  function handlePointerUp() {
    lastPointRef.current = null;
  }

  function clear() {
    canvasRef.current?.getContext("2d")?.clearRect(0, 0, image.width, image.height);
  }

  function apply() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let painted = false;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] > 0) {
        painted = true;
        break;
      }
    }
    if (!painted) {
      onApply(null);
      return;
    }

    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const outCtx = out.getContext("2d");
    if (!outCtx) return;
    outCtx.fillStyle = "#000";
    outCtx.fillRect(0, 0, out.width, out.height);
    outCtx.globalCompositeOperation = "destination-out";
    outCtx.drawImage(canvas, 0, 0);
    out.toBlob((blob) => {
      if (blob) onApply(new File([blob], "mask.png", { type: "image/png" }));
    }, "image/png");
  }

  const toolClass = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
      active
        ? "border-slate-950 bg-slate-950 text-white"
        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
    }`;

  // Portal: the panel's backdrop-filter would otherwise trap this fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("maskEditor.title")}
        className="flex max-h-full w-full max-w-5xl flex-col gap-3 overflow-auto rounded-3xl bg-white p-4 shadow-2xl"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-950">{t("maskEditor.title")}</h2>
          <p className="mt-1 text-xs text-slate-500">{t("maskEditor.hint")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={toolClass(!erasing)} aria-pressed={!erasing} onClick={() => setErasing(false)}>
            {t("maskEditor.brush")}
          </button>
          <button type="button" className={toolClass(erasing)} aria-pressed={erasing} onClick={() => setErasing(true)}>
            {t("maskEditor.eraser")}
          </button>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            {t("maskEditor.brushSize", { size: brushSize })}
            <input
              type="range"
              min={1}
              max={maxBrush}
              value={brushSize}
              className="w-32 accent-sky-500"
              onChange={(event) => setBrushSize(Number(event.target.value))}
            />
          </label>
          <button type="button" className={toolClass(false)} onClick={clear}>
            {t("maskEditor.clear")}
          </button>
        </div>

        <div className="flex justify-center rounded-2xl bg-slate-100 p-2">
          <div className="relative inline-block">
            <img
              src={image.previewUrl}
              alt={image.file.name}
              className="block max-h-[65vh] max-w-full select-none"
              draggable={false}
            />
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={t("maskEditor.canvasLabel")}
              width={image.width}
              height={image.height}
              className="absolute inset-0 h-full w-full cursor-crosshair touch-none opacity-50"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className={toolClass(false)} onClick={onCancel}>
            {t("maskEditor.cancel")}
          </button>
          <button
            type="button"
            className="rounded-lg bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-600"
            onClick={apply}
          >
            {t("maskEditor.apply")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
