const isClient = typeof window !== 'undefined';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function currentThemeMode() {
  if (!isClient) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function computeDynamicHue(now: Date) {
  const monthShift = ((now.getMonth() + 1) / 12) * 28;
  const dayWave = Math.sin((now.getHours() / 24) * Math.PI * 2) * 11;
  return clamp(Math.round(136 + monthShift + dayWave), 118, 196);
}

function applyVisualTokens() {
  if (!isClient) return;

  const root = document.documentElement;
  const now = new Date();
  const mode = currentThemeMode();
  const hue = computeDynamicHue(now);

  root.dataset.theme = mode;
  root.style.setProperty('--dynamic-hue', String(hue));
  root.style.setProperty('--dynamic-accent', String(clamp(hue + 24, 150, 222)));
}

export function initializeAdaptiveVisuals() {
  if (!isClient) return;

  applyVisualTokens();

  const modeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleModeChange = () => applyVisualTokens();
  modeQuery.addEventListener('change', handleModeChange);

  const intervalId = window.setInterval(() => applyVisualTokens(), 15 * 60 * 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      applyVisualTokens();
    }
  });

  return () => {
    modeQuery.removeEventListener('change', handleModeChange);
    window.clearInterval(intervalId);
  };
}
