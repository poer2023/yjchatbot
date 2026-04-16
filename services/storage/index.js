const { deepClone } = require("../../utils/helpers");

const SETTINGS_KEY = "yjchatbot:settings:v1";
const STATE_KEY = "yjchatbot:state:v1";

function loadSettings() {
  try {
    const settings = wx.getStorageSync(SETTINGS_KEY);
    return settings || null;
  } catch (error) {
    return null;
  }
}

function loadChatState() {
  try {
    const state = wx.getStorageSync(STATE_KEY);
    return state || null;
  } catch (error) {
    return null;
  }
}

function saveState(state) {
  const snapshot = deepClone(state);
  wx.setStorageSync(SETTINGS_KEY, snapshot.settings);
  if (snapshot.settings.persistHistory) {
    wx.setStorageSync(STATE_KEY, {
      activeSessionId: snapshot.activeSessionId,
      messagesBySession: snapshot.messagesBySession,
      sessions: snapshot.sessions,
    });
  } else {
    wx.removeStorageSync(STATE_KEY);
  }
  return snapshot;
}

function saveSettings(settings) {
  wx.setStorageSync(SETTINGS_KEY, deepClone(settings));
}

function clearAll() {
  wx.removeStorageSync(SETTINGS_KEY);
  wx.removeStorageSync(STATE_KEY);
}

module.exports = {
  clearAll,
  loadChatState,
  loadSettings,
  saveSettings,
  saveState,
};
