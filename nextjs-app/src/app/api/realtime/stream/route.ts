import { subscribeRealtimeEvents } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  let timer: any = null;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'connected', data: {} })}\n\n`));
      } catch (e) {}

      unsubscribe = subscribeRealtimeEvents((msg) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
        } catch (e) {
          // Controller might be closed
        }
      });

      // Keepalive ping every 15s
      timer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch (e) {
          if (timer) clearInterval(timer);
        }
      }, 15000);
    },
    cancel() {
      if (timer) clearInterval(timer);
      if (unsubscribe) unsubscribe();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
