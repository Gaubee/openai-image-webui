function getFileExtension(imageUrl: string, mimeType?: string): string {
  const type = mimeType || imageUrl.match(/^data:([^;,]+)/)?.[1] || "";

  if (type.includes("jpeg") || imageUrl.startsWith("data:image/jpeg")) {
    return "jpg";
  }

  if (type.includes("webp") || imageUrl.startsWith("data:image/webp")) {
    return "webp";
  }

  return "png";
}

function clickDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function downloadImage(imageUrl: string, filenameBase: string, mimeType?: string) {
  // Always convert to a blob: object URL first — data: URLs (b64_json results)
  // and cross-origin images can fall back to navigation instead of saving when
  // clicked directly. Revoke late so the download has time to start.
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    clickDownload(objectUrl, `${filenameBase}.${getFileExtension(imageUrl, blob.type || mimeType)}`);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    return;
  } catch {
    // CORS-blocked remote image: last resort, click the raw URL
    clickDownload(imageUrl, `${filenameBase}.${getFileExtension(imageUrl, mimeType)}`);
  }
}

export function downloadText(text: string, filenameBase: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  clickDownload(objectUrl, `${filenameBase}.txt`);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

export async function copyText(text: string) {

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
