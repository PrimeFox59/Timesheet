import { subscribeRealtimeEvents } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'connected', data: {} })}\n\n`));

      const unsubscribe = subscribeRealtimeEvents((msg) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
        } catch (e) {
          // Controller might be closed
        }
      });

      // Keepalive ping every 15s
      const timer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch (e) {
          clearInterval(timer);
        }
      }, 15000);

      // Clean up on stream close
      return () => {
        clearInterval(timer);
        unsubscribe();
      };
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}
