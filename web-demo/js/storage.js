import { deepClone } from "./helpers.js";

const SETTINGS_KEY = "yjchatbot:settings:v1";
const STATE_KEY = "yjchatbot:state:v1";

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadChatState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveState(state) {
  const snapshot = deepClone(state);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(snapshot.settings));
  if (snapshot.settings.persistHistory) {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        activeSessionId: snapshot.activeSessionId,
        messagesBySession: snapshot.messagesBySession,
        sessions: snapshot.sessions,
      })
    );
  } else {
    localStorage.removeItem(STATE_KEY);
  }
  return snapshot;
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(deepClone(settings)));
}

export function clearAll() {
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(STATE_KEY);
}
