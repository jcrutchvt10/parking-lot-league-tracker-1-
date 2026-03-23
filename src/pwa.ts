interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type InstallListener = (isInstallable: boolean) => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<InstallListener>();

const isClient = typeof window !== 'undefined';

function notifyListeners() {
  const installable = Boolean(deferredPrompt);
  listeners.forEach((listener) => listener(installable));
}

if (isClient) {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyListeners();
  });
}

export function registerServiceWorker() {
  if (!isClient || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

export function onInstallAvailabilityChange(listener: InstallListener) {
  listeners.add(listener);
  listener(Boolean(deferredPrompt));
  return () => listeners.delete(listener);
}

export async function promptInstallApp() {
  if (!deferredPrompt) return false;

  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notifyListeners();
  return choice.outcome === 'accepted';
}

export function getInstallContext() {
  if (!isClient) {
    return { isIos: false, isStandalone: false };
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;

  return { isIos, isStandalone };
}
