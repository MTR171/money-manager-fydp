/**
 * offlineSyncService.js
 * Lightweight localStorage-backed queue for offline transaction sync.
 * Stores pending CREATE / UPDATE / DELETE actions and replays them
 * in order when the network reconnects.
 */

const QUEUE_KEY = 'mm_pending_sync_queue';

/** @returns {Array} The current pending queue */
export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function _saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Add an action to the tail of the queue.
 * @param {{ op: 'CREATE'|'UPDATE'|'DELETE', payload: object, localId?: string }} action
 * @returns {object} The queued entry (includes generated localId + timestamp)
 */
export function enqueue(action) {
  const entry = {
    localId: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    enqueuedAt: Date.now(),
    ...action,
  };
  _saveQueue([...getQueue(), entry]);
  return entry;
}

/**
 * Remove a single entry by its localId (called after successful server sync).
 * @param {string} localId
 */
export function removeFromQueue(localId) {
  _saveQueue(getQueue().filter(e => e.localId !== localId));
}

/** Wipe the entire queue (e.g. after full re-sync). */
export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

/** @returns {boolean} True if there are unsynced operations waiting */
export function hasPending() {
  return getQueue().length > 0;
}

/** @returns {number} Number of pending operations */
export function pendingCount() {
  return getQueue().length;
}
