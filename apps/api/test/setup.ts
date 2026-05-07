// Test-only polyfills.
//
// 1. @worker-tools/html-rewriter ships its lol-html WASM as a sibling file and
//    loads it lazily via `fetch(new URL('./html_rewriter_bg.wasm', import.meta.url))`.
//    In Node that URL is a `file://` — and undici's fetch returns "not implemented"
//    for the file: scheme. Patch globalThis.fetch to read local files via fs.
//
// 2. Parsers reference the global `HTMLRewriter` (provided by the Workers runtime
//    in production). For Node-side unit tests we install the API-compatible
//    WASM port from @worker-tools/html-rewriter as a global.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { HTMLRewriter } from "@worker-tools/html-rewriter";

const originalFetch = globalThis.fetch;

const fetchWithFileScheme: typeof fetch = async (input, init) => {
  const urlStr =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;
  if (urlStr.startsWith("file://")) {
    const data = await readFile(fileURLToPath(urlStr));
    return new Response(data);
  }
  return originalFetch(input, init);
};

globalThis.fetch = fetchWithFileScheme;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).HTMLRewriter = HTMLRewriter;
