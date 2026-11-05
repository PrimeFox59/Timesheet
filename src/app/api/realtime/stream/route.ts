import { subscribeRealtimeEvents } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  let timer: any = null;
  let unsubscribe: (() => void) | null = null;

  const cleanup = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'connected', data: {} })}\n\n`));
      } catch (e) {
        cleanup();
        return;
      }

      unsubscribe = subscribeRealtimeEvents((msg) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
        } catch (e) {
          cleanup();
        }
      });

      // Keepalive ping every 15s
      timer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch (e) {
          cleanup();
        }
      }, 15000);
    },
    cancel() {
      cleanup();
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
