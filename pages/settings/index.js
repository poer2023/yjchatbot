const { models } = require("../../config/models");
const mockChat = require("../../services/mock-chat/index");
const {
  getThemeClass,
  getThemeLabel,
  getTypingSpeedLabel,
} = require("../../utils/helpers");

const themeOptions = [
  {
    description: "暖色中性，最像日常工作台。",
    id: "light",
    title: "Warm Light",
  },
  {
    description: "偏雾面和浅青，更柔和。",
    id: "mist",
    title: "Mist",
  },
  {
    description: "深色石墨，适合录屏或夜间演示。",
    id: "graphite",
    title: "Graphite",
  },
];

Page({
  data: {
    models,
    settings: {
      defaultModelId: models[0].id,
      persistHistory: true,
      showWelcome: true,
      theme: "light",
      typingSpeed: 28,
    },
    statusBarHeight: 20,
    themeClass: getThemeClass("light"),
    themeLabel: getThemeLabel("light"),
    themeOptions,
    typingSpeedLabel: getTypingSpeedLabel(28),
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 20,
    });
    this.refreshSettings(true);
  },

  onShow() {
    this.refreshSettings(true);
  },

  refreshSettings(force) {
    const state = mockChat.bootstrap(!!force);
    this.setData({
      settings: state.settings,
      themeClass: getThemeClass(state.settings.theme),
      themeLabel: getThemeLabel(state.settings.theme),
      typingSpeedLabel: getTypingSpeedLabel(state.settings.typingSpeed),
    });
  },

  handleBack() {
    wx.navigateBack({
      delta: 1,
    });
  },

  handleModelPick(event) {
    const modelId = event.currentTarget.dataset.id;
    mockChat.updateSettings({
      defaultModelId: modelId,
    });
    this.refreshSettings(true);
  },

  handleThemePick(event) {
    const theme = event.currentTarget.dataset.id;
    mockChat.updateSettings({
      theme,
    });
    this.refreshSettings(true);
  },

  handleTypingSpeedChange(event) {
    mockChat.updateSettings({
      typingSpeed: Number(event.detail.value) || 28,
    });
    this.refreshSettings(true);
  },

  handleWelcomeChange(event) {
    mockChat.updateSettings({
      showWelcome: !!event.detail.value,
    });
    this.refreshSettings(true);
  },

  handlePersistChange(event) {
    mockChat.updateSettings({
      persistHistory: !!event.detail.value,
    });
    this.refreshSettings(true);
  },

  handleClearAll() {
    wx.showModal({
      cancelText: "取消",
      confirmText: "重置",
      content: "清空本地会话、设置和演示数据？",
      title: "重置 Demo",
      success: (result) => {
        if (!result.confirm) {
          return;
        }

        mockChat.clearAll();
        this.refreshSettings(true);
        wx.showToast({
          title: "已重置",
        });
      },
    });
  },
});
