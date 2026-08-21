import { emitRealtimeEvent } from '@/lib/events';

export async function broadcastRealtimeEvent(event: string, data: any) {
  try {
    emitRealtimeEvent(event, data);
  } catch (e) {
    console.error(`[Realtime Broadcaster] Failed to emit event '${event}'`, e);
  }
}
