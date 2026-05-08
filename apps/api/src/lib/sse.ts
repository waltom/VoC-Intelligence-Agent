/**
 * Tiny SSE helper. Returns a Response that streams events from an async generator.
 * Caller is responsible for terminating the generator (e.g. on completion or abort).
 */
export function sseResponse(generator: AsyncGenerator<SseEvent, void, unknown>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of generator) {
          controller.enqueue(encoder.encode(formatSse(ev)));
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(formatSse({ event: "error", data: { message: (e as Error).message } })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}

export interface SseEvent {
  event?: string;
  id?: string | number;
  data: unknown;
}

function formatSse(ev: SseEvent): string {
  const payload = typeof ev.data === "string" ? ev.data : JSON.stringify(ev.data);
  let out = "";
  if (ev.event) out += `event: ${ev.event}\n`;
  if (ev.id !== undefined) out += `id: ${ev.id}\n`;
  for (const line of payload.split("\n")) out += `data: ${line}\n`;
  out += "\n";
  return out;
}
