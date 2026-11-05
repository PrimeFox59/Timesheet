import { EventEmitter } from 'events';

// Global Event Emitter for Next.js internal real-time broadcasting
const globalEventEmitter = (global as any).realtimeEmitter || new EventEmitter();
globalEventEmitter.setMaxListeners(0); // Unlimited listeners for mass concurrent user presence
(global as any).realtimeEmitter = globalEventEmitter;

export function emitRealtimeEvent(event: string, data: any) {
  globalEventEmitter.emit('realtime-event', { event, data });
}

export function subscribeRealtimeEvents(listener: (data: { event: string; data: any }) => void) {
  globalEventEmitter.on('realtime-event', listener);
  return () => {
    globalEventEmitter.off('realtime-event', listener);
  };
}
