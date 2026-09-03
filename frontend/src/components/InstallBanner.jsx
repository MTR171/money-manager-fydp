import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Download, X, Share, Plus, Smartphone, Check } from 'lucide-react';

// ── Platform detection utilities ──────────────────────────────────────────────
const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !window.MSStream;

const isSafari = () =>
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const isInStandaloneMode = () =>
  // iOS standalone flag
  window.navigator.standalone === true ||
  // Android / Chrome standalone flag
  window.matchMedia('(display-mode: standalone)').matches ||
  // Generic PWA flag (Chromium Edge, Samsung Browser)
  window.matchMedia('(display-mode: fullscreen)').matches;

const DISMISS_KEY = 'mm-pwa-install-dismissed-until';

// ── iOS Step Component ─────────────────────────────────────────────────────────
const IOSStep = ({ number, children }) => (
  <div className="flex items-start gap-3">
    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">
      {number}
    </span>
    <div className="flex-1 text-sm text-gray-700 leading-relaxed pt-0.5">
      {children}
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
const InstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [bannerVisible, setBannerVisible]   = useState(false);
  const [iosGuideOpen,  setIosGuideOpen]    = useState(false);
  const [installed,     setInstalled]       = useState(false);
  const [installing,    setInstalling]      = useState(false);
  const promptRef = useRef(null);   // keep a ref to avoid stale closure

  useEffect(() => {
    // ── Already running as an installed PWA — never show the prompt ────────
    if (isInStandaloneMode()) return;

    // ── Respect a 7-day dismissal window ──────────────────────────────────
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;

    const isIOSDevice = isIOS();

    // ── Android / Desktop Chrome — capture beforeinstallprompt ────────────
    if (!isIOSDevice) {
      const onBeforeInstall = (e) => {
        e.preventDefault();
        promptRef.current = e;
        setDeferredPrompt(e);
        // Slight delay so the banner doesn't appear at the same instant as page load
        setTimeout(() => setBannerVisible(true), 2500);
      };

      const onAppInstalled = () => {
        setInstalled(true);
        setBannerVisible(false);
        setDeferredPrompt(null);
        promptRef.current = null;
      };

      window.addEventListener('beforeinstallprompt', onBeforeInstall);
      window.addEventListener('appinstalled', onAppInstalled);

      return () => {
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
        window.removeEventListener('appinstalled', onAppInstalled);
      };
    }

    // ── iOS Safari — no beforeinstallprompt; show manual guide ───────────
    // Only show on Safari (not Chrome-on-iOS, which uses its own mechanism)
    if (isIOSDevice && isSafari()) {
      const timer = setTimeout(() => setBannerVisible(true), 3500);
      return () => clearTimeout(timer);
    }
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleInstall = useCallback(async () => {
    if (isIOS()) {
      // Show the manual iOS guide
      setIosGuideOpen(true);
      return;
    }

    const prompt = promptRef.current;
    if (!prompt) return;

    setInstalling(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        setBannerVisible(false);
        setInstalled(true);
      }
    } catch (err) {
      console.warn('[PWA] Install prompt error:', err);
    } finally {
      setInstalling(false);
      promptRef.current = null;
      setDeferredPrompt(null);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setBannerVisible(false);
    // Suppress for 7 days so we don't nag on every visit
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  }, []);

  const handleIOSGuideDone = useCallback(() => {
    setIosGuideOpen(false);
    handleDismiss();
  }, [handleDismiss]);

  // ── Nothing to render ──────────────────────────────────────────────────────
  if (!bannerVisible || installed) return null;

  const isIOSDevice = isIOS();

  return (
    <>
      {/* ── Install Banner (bottom sheet) ──────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2 animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-label="Install Money Manager App"
      >
        {/* Safe area padding for iOS home indicator */}
        <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl overflow-hidden max-w-sm mx-auto">

            {/* Accent bar */}
            <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500" />

            <div className="p-4">
              {/* Header row */}
              <div className="flex items-start gap-3 mb-3">
                {/* App icon thumbnail */}
                <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center shadow-lg">
                  <img
                    src="/icon.svg"
                    alt="Money Manager icon"
                    className="w-10 h-10"
                    onError={(e) => {
                      // SVG failed (unlikely) — show a fallback dollar sign
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentNode.innerHTML = '<span class="text-2xl font-black text-white">$</span>';
                    }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="font-bold text-sm leading-tight">Money Manager AI</p>
                    {/* Green "app" badge */}
                    <span className="flex items-center gap-0.5 bg-green-500/20 text-green-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-green-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot inline-block" />
                      Free
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">
                    {isIOSDevice
                      ? 'Add to Home Screen for offline access'
                      : 'Install for a native-app experience — works offline'}
                  </p>
                </div>

                <button
                  onClick={handleDismiss}
                  className="flex-shrink-0 p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                  aria-label="Dismiss install prompt"
                >
                  <X size={15} className="text-slate-400" />
                </button>
              </div>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {['Works Offline', 'No App Store', 'Fast & Lightweight'].map(f => (
                  <span
                    key={f}
                    className="text-[10px] text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full"
                  >
                    {f}
                  </span>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleDismiss}
                  className="flex-1 py-2.5 text-xs text-slate-400 hover:text-slate-200 rounded-xl border border-slate-700 hover:border-slate-500 transition-colors"
                >
                  Not now
                </button>
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="flex-[2] py-2.5 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 active:scale-[0.98] shadow-sm shadow-blue-900/40"
                >
                  {installing ? (
                    <span className="animate-pulse">Installing…</span>
                  ) : isIOSDevice ? (
                    <>
                      <Share size={13} />
                      How to install
                    </>
                  ) : (
                    <>
                      <Download size={13} />
                      Install App
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── iOS "Add to Home Screen" Guide Modal ───────────────────────── */}
      {iosGuideOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-4 animate-fade-in"
          onClick={() => setIosGuideOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="iOS installation guide"
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <Smartphone size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Add to Home Screen</p>
                  <p className="text-slate-400 text-[11px]">Safari on iPhone / iPad</p>
                </div>
              </div>
              <button
                onClick={() => setIosGuideOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={16} className="text-slate-300" />
              </button>
            </div>

            {/* Steps */}
            <div className="px-5 py-5 space-y-4">
              <IOSStep number="1">
                Tap the{' '}
                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-lg text-xs border border-blue-100">
                  <Share size={11} />
                  Share
                </span>{' '}
                button in the Safari toolbar{' '}
                <span className="text-gray-400 text-xs">(bottom centre on iPhone)</span>.
              </IOSStep>

              <IOSStep number="2">
                Scroll down in the share sheet and tap{' '}
                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 font-semibold px-2 py-0.5 rounded-lg text-xs border border-gray-200">
                  <Plus size={11} />
                  Add to Home Screen
                </span>.
              </IOSStep>

              <IOSStep number="3">
                Confirm the name{' '}
                <strong className="text-gray-900">"MoneyManager"</strong> and tap{' '}
                <span className="text-blue-600 font-semibold">Add</span>{' '}
                in the top-right corner.
              </IOSStep>

              <IOSStep number="4">
                <span className="flex items-center gap-1">
                  <Check size={14} className="text-green-500 flex-shrink-0" />
                  The app icon appears on your home screen — tap it to launch
                  in full-screen mode!
                </span>
              </IOSStep>
            </div>

            {/* Divider + note */}
            <div className="mx-5 border-t border-gray-100 pt-3 pb-2">
              <p className="text-xs text-gray-400 text-center">
                💡 Must be opened in <strong>Safari</strong> — Chrome on iOS does not
                support Add to Home Screen for PWAs.
              </p>
            </div>

            {/* CTA */}
            <div className="px-5 pb-5 pt-2">
              <button
                onClick={handleIOSGuideDone}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl font-semibold text-sm active:scale-[0.98] transition-transform"
              >
                Got it — I'll try now!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallBanner;
