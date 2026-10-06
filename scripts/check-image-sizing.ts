// Run: node scripts/check-image-sizing.ts
import { buildCompatibleImageRequest, stripGeminiSizeArtifacts } from "../src/lib/imageSizing.ts";

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `\n     got ${JSON.stringify(actual)}\n     want ${JSON.stringify(expected)}`}`);
  if (!ok) process.exitCode = 1;
}

const gemini = "gemini-2.5-flash-image";

// A reused / copied prompt carries the old auto-appended --ar; the UI size must win.
const stale = buildCompatibleImageRequest({ model: gemini, prompt: "a cat --ar 1:1", size: "1344x768" });
check("gemini: stale trailing --ar is replaced by the size ratio", stale.prompt, "a cat --ar 16:9");
check("gemini: aspect_ratio follows the size", stale.extraParams.aspect_ratio, "16:9");

const fresh = buildCompatibleImageRequest({ model: gemini, prompt: "a cat", size: "768x1344" });
check("gemini: --ar appended once", fresh.prompt, "a cat --ar 9:16");
const again = buildCompatibleImageRequest({ model: gemini, prompt: fresh.prompt, size: "768x1344" });
check("gemini: rebuilding is idempotent", again.prompt, "a cat --ar 9:16");

// A stray "size" in advanced JSON must not override the UI size.
const free = buildCompatibleImageRequest({ model: "flux-dev", prompt: "x", size: "1280x720", extraParams: { size: "1024x1024", quality: "high" } });
check("advanced JSON size is dropped", free.extraParams, { quality: "high" });
check("UI size is kept", free.size, "1280x720");

// Reusing a Gemini task: any trailing --ar and derived size params are stripped.
const reused = stripGeminiSizeArtifacts(gemini, "a cat --ar 3:2", { aspect_ratio: "3:2", seed: 1 });
check("reuse strips trailing --ar even if it mismatches size", reused.prompt, "a cat");
check("reuse strips aspect_ratio but keeps other params", reused.extraParams, { seed: 1 });
