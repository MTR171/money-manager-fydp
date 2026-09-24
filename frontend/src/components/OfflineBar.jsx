import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { isEffectivelyOffline, getQueue } from '../services/offlineSyncService';

/**
 * OfflineBar — shows a persistent banner when the device loses connectivity
 * or when Offline Mode is active. Removes itself automatically when reconnected.
 */
const OfflineBar = () => {
  const [isOnline, setIsOnline] = useState(() => !isEffectivelyOffline());
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(() => getQueue().length);

  useEffect(() => {
    let timer = null;
    const syncConnectivity = () => {
      const onlineNow = !isEffectivelyOffline();
      setIsOnline(onlineNow);
      setPendingCount(getQueue().length);
      if (!onlineNow) {
        setWasOffline(true);
        setShowReconnected(false);
      } else if (wasOffline) {
        setShowReconnected(true);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          setShowReconnected(false);
          setWasOffline(false);
        }, 3000);
      }
    };

    window.addEventListener('online', syncConnectivity);
    window.addEventListener('offline', syncConnectivity);
    window.addEventListener('mm-connectivity-change', syncConnectivity);
    window.addEventListener('mm-sync-queue-change', syncConnectivity);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', syncConnectivity);
      window.removeEventListener('offline', syncConnectivity);
      window.removeEventListener('mm-connectivity-change', syncConnectivity);
      window.removeEventListener('mm-sync-queue-change', syncConnectivity);
    };
  }, [wasOffline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`offline-bar flex items-center justify-center gap-2 transition-colors ${
        isOnline ? 'bg-green-500' : 'bg-amber-600'
      }`}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <>
          <Wifi size={13} />
          Back online — syncing pending changes with cloud.
        </>
      ) : (
        <>
          <WifiOff size={13} />
          Offline Mode active — viewing cached data{pendingCount > 0 ? ` (${pendingCount} pending sync)` : ''}.
        </>
      )}
    </div>
  );
};

export default OfflineBar;
