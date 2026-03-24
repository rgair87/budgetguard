import { useCallback, useEffect, useRef } from 'react';
import api from '../api/client';

// ─── Queue + batch flush ─────────────────────────────────────
// Events are queued in memory and flushed every 5 seconds (or on page hide)
// to avoid spamming the server with individual requests.

interface QueuedEvent {
  feature: string;
  action: string;
  metadata?: Record<string, any>;
}

const queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  api.post('/analytics/track-batch', { events: batch }).catch(() => {
    // Silent fail - analytics should never break the app
  });
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 5000);
}

// Flush on page hide (tab close, navigate away)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

// ─── Hook ────────────────────────────────────────────────────

/**
 * Track feature usage. Call `track('feature_name', 'action')` from anywhere.
 *
 * Auto-tracks a 'view' event when the component mounts (pass feature to hook).
 * Use the returned `track` function for specific actions (click, submit, etc.).
 *
 * @example
 * // Auto-track page view + manual action tracking
 * const track = useTrack('goals');
 * track('add_goal');  // track a specific action
 *
 * @example
 * // Just get the track function without auto page view
 * const track = useTrack();
 * track('chat', 'send_message');
 */
export function useTrack(pageFeature?: string) {
  const tracked = useRef(false);

  // Auto-track page/feature view on mount
  useEffect(() => {
    if (pageFeature && !tracked.current) {
      tracked.current = true;
      queue.push({ feature: pageFeature, action: 'view' });
      scheduleFlush();
    }
  }, [pageFeature]);

  const track = useCallback((feature: string, action: string = 'click', metadata?: Record<string, any>) => {
    queue.push({ feature, action, metadata });
    scheduleFlush();
  }, []);

  return track;
}

export default useTrack;
