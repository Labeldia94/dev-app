/**
 * Wrapper Firebase Crashlytics — fonctionne en build natif uniquement.
 * En Expo Go ou dev, les erreurs sont juste loggées en console.
 */

let _crashlytics: any = null;

// Chargement conditionnel : ne crashe pas en Expo Go
try {
  _crashlytics = require('@react-native-firebase/crashlytics').default;
} catch {
  // Pas de module natif disponible (Expo Go)
}

function getInstance() {
  try { return _crashlytics?.(); } catch { return null; }
}

/** Enregistre une erreur dans Crashlytics */
export function logError(error: unknown, context?: string): void {
  const err = error instanceof Error ? error : new Error(String(error));
  if (context) err.message = `[${context}] ${err.message}`;

  if (__DEV__) {
    console.warn('[Crashlytics DEV]', err.message);
    return;
  }
  try { getInstance()?.recordError(err); } catch {}
}

/** Identifie l'utilisateur dans les rapports de crash */
export function setCrashlyticsUser(uid: string, name?: string): void {
  if (__DEV__) return;
  try {
    getInstance()?.setUserId(uid);
    if (name) getInstance()?.setAttribute('userName', name);
  } catch {}
}

/** Log une action utilisateur pour contextualiser les crashs */
export function logEvent(message: string): void {
  if (__DEV__) return;
  try { getInstance()?.log(message); } catch {}
}
