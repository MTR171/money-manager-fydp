import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * OfflineBar — shows a persistent banner when the device loses connectivity.
 * Removes itself automatically when the network comes back.
 * Uses the browser's native online/offline events which work perfectly inside
 * a PWA service worker context.
 */
const OfflineBar = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Briefly show "reconnected" message before hiding
        setShowReconnected(true);
        const t = setTimeout(() => {
          setShowReconnected(false);
          setWasOffline(false);
        }, 3000);
        return () => clearTimeout(t);
      }
    };

    const goOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [wasOffline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`offline-bar flex items-center justify-center gap-2 transition-colors ${
        isOnline ? 'bg-green-500' : 'bg-red-500'
      }`}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <>
          <Wifi size={13} />
          Back online — data will sync automatically.
        </>
      ) : (
        <>
          <WifiOff size={13} />
          You're offline — viewing cached data.
        </>
      )}
    </div>
  );
};

export default OfflineBar;
