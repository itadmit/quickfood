/**
 * SSE helper for Vercel-compatible Server-Sent Events streams.
 *
 * Usage in a Route Handler:
 *
 *   export async function GET(req: Request) {
 *     return createSseStream(req, async function* () {
 *       while (true) {
 *         const events = await pollSomething();
 *         for (const e of events) yield e;
 *         await wait(2000);
 *       }
 *     });
 *   }
 */

export interface SseEvent {
  id?: string;
  event?: string;
  data: unknown;
}

const HEARTBEAT_MS = 15_000;

export function createSseStream(
  req: Request,
  generator: () => AsyncGenerator<SseEvent, void, unknown>,
): Response {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SseEvent) => {
        if (closed) return;
        const lines: string[] = [];
        if (event.id) lines.push(`id: ${event.id}`);
        if (event.event) lines.push(`event: ${event.event}`);
        const dataStr =
          typeof event.data === "string" ? event.data : JSON.stringify(event.data);
        for (const line of dataStr.split("\n")) lines.push(`data: ${line}`);
        lines.push("", "");
        try {
          controller.enqueue(encoder.encode(lines.join("\n")));
        } catch {
          closed = true;
        }
      };

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          closed = true;
        }
      }, HEARTBEAT_MS);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });

      // Initial connection event
      send({ event: "open", data: { ok: true } });

      try {
        for await (const event of generator()) {
          if (closed) break;
          send(event);
        }
      } catch (err) {
        try {
          send({ event: "error", data: { message: (err as Error).message } });
        } catch {
          /* ignore */
        }
      } finally {
        closed = true;
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
