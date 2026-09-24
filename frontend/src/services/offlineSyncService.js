/**
 * offlineSyncService.js
 * Lightweight localStorage-backed queue & connectivity manager for offline sync.
 * Stores pending CREATE / UPDATE / DELETE actions and replays them
 * in order when the network/server reconnects.
 */

const QUEUE_KEY = 'mm_pending_sync_queue';
const MANUAL_OFFLINE_KEY = 'mm_manual_offline_mode';

let _backendReachable = true;

function _notifyQueueChange() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(
            new CustomEvent('mm-sync-queue-change', {
                detail: { count: getQueue().length, queue: getQueue() },
            }),
        );
    }
}

function _notifyConnectivityChange() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(
            new CustomEvent('mm-connectivity-change', {
                detail: {
                    isOnline: !isEffectivelyOffline(),
                    manualOffline: isManualOffline(),
                    backendReachable: _backendReachable,
                },
            }),
        );
    }
}

/** @returns {boolean} True if user toggled manual offline mode */
export function isManualOffline() {
    try {
        return localStorage.getItem(MANUAL_OFFLINE_KEY) === 'true';
    } catch {
        return false;
    }
}

/** @param {boolean} val */
export function setManualOffline(val) {
    try {
        if (val) {
            localStorage.setItem(MANUAL_OFFLINE_KEY, 'true');
        } else {
            localStorage.removeItem(MANUAL_OFFLINE_KEY);
            _backendReachable = true;
        }
    } catch {
        // ignore storage errors
    }
    _notifyConnectivityChange();
}

/** @param {boolean} reachable */
export function setBackendReachable(reachable) {
    if (_backendReachable !== reachable) {
        _backendReachable = reachable;
        _notifyConnectivityChange();
    }
}

/** @returns {boolean} True when browser is offline, backend is unreachable, or manual offline mode is active */
export function isEffectivelyOffline() {
    const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return browserOffline || isManualOffline() || !_backendReachable;
}

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
    _notifyQueueChange();
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
    _notifyQueueChange();
}

/** @returns {boolean} True if there are unsynced operations waiting */
export function hasPending() {
    return getQueue().length > 0;
}

/** @returns {number} Number of pending operations */
export function pendingCount() {
    return getQueue().length;
}