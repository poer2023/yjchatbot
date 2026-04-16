const { modelMap, models } = require("../../config/models");
const mockChat = require("../../services/mock-chat/index");

const MODE_CONFIG = {
  expert: {
    hint: "适合复杂问题，输出更完整",
    modelId: "claude",
    title: "研究模式",
  },
  quick: {
    hint: "适合日常咨询，即时响应",
    modelId: "chatgpt",
    title: "咨询模式",
  },
};

const ATTACH_SHEET_OPTIONS_EXPERT = [
  { key: "pick-file", label: "选择文件" },
  { key: "pick-album-image", label: "选择相册中的图片" },
];

const ATTACH_SHEET_OPTIONS_QUICK = [{ key: "pick-album-image", label: "选择相册中的图片" }];

function getAttachSheetOptionsByMode(modeId) {
  return modeId === "quick" ? ATTACH_SHEET_OPTIONS_QUICK : ATTACH_SHEET_OPTIONS_EXPERT;
}

function formatHistoryGroup(timestamp) {
  const date = new Date(timestamp || Date.now());
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function hasSessionHistory(session, messagesBySession) {
  const sessionId = session && session.id;
  if (!sessionId) {
    return false;
  }
  const messages = (messagesBySession && messagesBySession[sessionId]) || [];
  return Array.isArray(messages) && messages.length > 0;
}

function groupSessionsByMonth(sessions, messagesBySession) {
  const groups = [];
  const map = {};

  (sessions || []).forEach((session) => {
    if (!hasSessionHistory(session, messagesBySession)) {
      return;
    }
    const label = formatHistoryGroup(session.updatedAt);
    if (!map[label]) {
      map[label] = {
        items: [],
        label,
      };
      groups.push(map[label]);
    }

    map[label].items.push(session);
  });

  return groups;
}

function inferModeFromModel(modelId) {
  return modelId === "claude" ? "expert" : "quick";
}

Page({
  data: {
    activeMode: "quick",
    activeSessionId: "",
    appearanceLabel: "系统",
    capsuleHeight: 32,
    capsuleMenuTop: 96,
    capsuleRight: 12,
    capsuleWidth: 88,
    currentModel: models[0],
    draft: "",
    headerEdgePadding: 16,
    headerPadTop: 48,
    headerSafeHeight: 20,
    historyGroups: [],
    inputPlaceholder: "想了解什么知识，快来问问我！",
    isResponding: false,
    languageLabel: "简体中文",
    messages: [],
    navBarHeight: 44,
    commonActionSheetOptions: ATTACH_SHEET_OPTIONS_QUICK,
    profileInitial: "凡",
    profileName: "凡 x",
    scrollIntoView: "welcome-anchor",
    settings: {
      theme: "light",
      typingSpeed: 28,
    },
    showCapsuleMenu: false,
    showCommonActionSheet: false,
    showDrawer: false,
    showSettingsSheet: false,
    showWelcome: true,
    statusBarHeight: 20,
    titleSafeLeft: 112,
    titleSafeRight: 120,
    versionLabel: "1.8.3(2)",
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    let capsuleHeight = 32;
    let capsuleMenuTop = statusBarHeight + 54;
    let capsuleRight = 12;
    let capsuleWidth = 88;
    let headerPadTop = statusBarHeight + 52;
    const headerEdgePadding = 16;
    let headerSafeHeight = statusBarHeight;
    let navBarHeight = 44;
    let titleSafeLeft = 112;
    let titleSafeRight = capsuleRight + capsuleWidth + 12;

    try {
      const menuButton = wx.getMenuButtonBoundingClientRect();
      if (menuButton && menuButton.top) {
        const navGap = Math.max(menuButton.top - statusBarHeight, 4);
        capsuleHeight = menuButton.height;
        capsuleMenuTop = Math.round(menuButton.bottom + 12);
        capsuleRight = Math.max(systemInfo.screenWidth - menuButton.right, 8);
        capsuleWidth = menuButton.width;
        navBarHeight = Math.round(menuButton.height + navGap * 2);
        headerPadTop = Math.round(statusBarHeight + navBarHeight + 8);
        titleSafeRight = Math.round(capsuleRight + capsuleWidth + 12);
      }
    } catch (error) {
      // Ignore and fall back to status-bar-only spacing.
    }

    this.replyToken = "";
    this.timerBag = [];
    this.setData({
      capsuleHeight,
      capsuleMenuTop,
      capsuleRight,
      capsuleWidth,
      headerEdgePadding,
      headerPadTop,
      headerSafeHeight,
      navBarHeight,
      statusBarHeight,
      titleSafeLeft,
      titleSafeRight,
    });
    this.refreshFromService(true);
  },

  onShow() {
    if (!this.data.isResponding) {
      this.refreshFromService(true);
    }
  },

  onUnload() {
    this.cancelPendingPlayback();
  },

  cancelPendingPlayback() {
    this.replyToken = "";
    (this.timerBag || []).forEach((timer) => clearTimeout(timer));
    this.timerBag = [];
  },

  delay(duration) {
    const timeout = duration || 0;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.timerBag = (this.timerBag || []).filter((item) => item !== timer);
        resolve();
      }, timeout);
      this.timerBag.push(timer);
    });
  },

  getCurrentState(sessionId) {
    const state = mockChat.getState();
    const currentSession =
      state.sessions.find((session) => session.id === (sessionId || state.activeSessionId)) ||
      state.sessions[0] ||
      null;
    const messages = currentSession ? mockChat.getMessages(currentSession.id) : [];
    const currentModel =
      modelMap[(currentSession && currentSession.modelId) || state.settings.defaultModelId] ||
      models[0];

    return {
      currentModel,
      currentSession,
      messages,
      state,
    };
  },

  applySnapshot(snapshot) {
    const currentMode = inferModeFromModel(
      snapshot.currentSession ? snapshot.currentSession.modelId : snapshot.state.settings.defaultModelId
    );

    this.setData({
      activeMode: currentMode,
      activeSessionId: snapshot.currentSession ? snapshot.currentSession.id : "",
      currentModel: snapshot.currentModel,
      historyGroups: groupSessionsByMonth(snapshot.state.sessions, snapshot.state.messagesBySession),
      inputPlaceholder: "想了解什么知识，快来问问我！",
      messages: snapshot.messages,
      settings: snapshot.state.settings,
      showWelcome: snapshot.state.settings.showWelcome && snapshot.messages.length === 0,
    });

    this.scrollToLatest(snapshot.messages);
  },

  refreshFromService(force) {
    mockChat.bootstrap(!!force);
    this.applySnapshot(this.getCurrentState());
  },

  syncSession(sessionId) {
    this.applySnapshot(this.getCurrentState(sessionId));
  },

  scrollToLatest(messages, anchorId) {
    const lastMessage = messages && messages[messages.length - 1];
    this.setData({
      scrollIntoView: anchorId || (lastMessage ? `msg-${lastMessage.id}` : "welcome-anchor"),
    });
  },

  showBusyToast() {
    wx.showToast({
      icon: "none",
      title: "回复生成中，请稍候",
    });
  },

  openDrawer() {
    if (this.data.isResponding) {
      this.showBusyToast();
      return;
    }

    this.setData({
      showCapsuleMenu: false,
      showCommonActionSheet: false,
      showDrawer: true,
      showSettingsSheet: false,
    });
  },

  closeDrawer() {
    this.setData({
      showCapsuleMenu: false,
      showCommonActionSheet: false,
      showDrawer: false,
    });
  },

  openSettingsSheet() {
    this.setData({
      showCapsuleMenu: false,
      showCommonActionSheet: false,
      showDrawer: false,
      showSettingsSheet: true,
    });
  },

  closeSettingsSheet() {
    this.setData({
      showCapsuleMenu: false,
      showCommonActionSheet: false,
      showSettingsSheet: false,
    });
  },

  toggleCapsuleMenu() {
    this.setData({
      showCapsuleMenu: !this.data.showCapsuleMenu,
      showCommonActionSheet: false,
      showDrawer: false,
      showSettingsSheet: false,
    });
  },

  closeCapsuleMenu() {
    if (!this.data.showCapsuleMenu) {
      return;
    }

    this.setData({
      showCapsuleMenu: false,
    });
  },

  handleCapsuleAction(event) {
    const action = event.currentTarget.dataset.action;
    this.closeCapsuleMenu();

    if (action === "share") {
      return;
    }

    if (action === "new") {
      this.handleCreateSession();
      return;
    }

    if (action === "settings") {
      this.openSettingsSheet();
    }
  },

  handleCapsuleCloseTap() {
    this.closeCapsuleMenu();

    const fallback = () => {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.showToast({
            icon: "none",
            title: "当前环境不支持直接退出",
          });
        },
      });
    };

    if (typeof wx.exitMiniProgram === "function") {
      wx.exitMiniProgram({
        fail: fallback,
      });
      return;
    }

    fallback();
  },

  handleDrawerBlocked() {
    this.showBusyToast();
  },

  handleCreateSession() {
    if (this.data.isResponding) {
      this.showBusyToast();
      return;
    }

    const session = mockChat.createSession();
    this.setData({
      draft: "",
      showCapsuleMenu: false,
      showCommonActionSheet: false,
      showDrawer: false,
      showSettingsSheet: false,
    });
    this.syncSession(session.id);
  },

  handleDraftChange(event) {
    this.setData({
      draft: event.detail.value || "",
    });
  },

  switchMode(modeId) {
    const target = MODE_CONFIG[modeId];
    if (!target || this.data.isResponding) {
      return;
    }

    mockChat.updateSessionModel(this.data.activeSessionId, target.modelId);
    this.syncSession(this.data.activeSessionId);
  },

  handleModeChange(event) {
    const modeId = event.currentTarget.dataset.mode;
    if (!modeId || modeId === this.data.activeMode) {
      return;
    }

    this.switchMode(modeId);
  },

  handleFeatureStub(event) {
    const kind = event.detail && event.detail.kind;
    const enabled = !!(event.detail && event.detail.enabled);
    const titles = {
      legal: "法律搜索",
      web: "联网搜索",
      academic: "学术搜索",
      knowledge: "知识库搜索",
      voice: "语音输入",
      "voice-cancel": "松手取消",
      "voice-send": "语音输入仅做演示",
    };

    if (kind === "legal" || kind === "web" || kind === "academic" || kind === "knowledge") {
      wx.showToast({
        icon: "none",
        title: `${titles[kind]}已${enabled ? "开启" : "关闭"}`,
      });
      return;
    }

    if (titles[kind]) {
      wx.showToast({
        icon: "none",
        title: titles[kind],
      });
      return;
    }

    if (kind === "attach") {
      this.setData({
        commonActionSheetOptions: getAttachSheetOptionsByMode(this.data.activeMode),
        showCommonActionSheet: true,
      });
      return;
    }

    wx.showToast({
      icon: "none",
      title: "功能仅做演示",
    });
  },

  handleSessionSelect(event) {
    if (this.data.isResponding) {
      this.showBusyToast();
      return;
    }

    const sessionId = event.detail.sessionId;
    mockChat.activateSession(sessionId);
    this.setData({
      draft: "",
      showCapsuleMenu: false,
      showCommonActionSheet: false,
      showDrawer: false,
    });
    this.syncSession(sessionId);
  },

  handleCommonActionSheetClose() {
    if (!this.data.showCommonActionSheet) {
      return;
    }
    this.setData({
      showCommonActionSheet: false,
    });
  },

  handleCommonActionSheetSelect(event) {
    const label = (event.detail && event.detail.label) || "该选项";
    this.setData({
      showCommonActionSheet: false,
    });
    wx.showToast({
      icon: "none",
      title: `${label}仅做演示`,
    });
  },

  async handleSend(event) {
    if (this.data.isResponding) {
      return;
    }

    const content = `${(event.detail && event.detail.value) || this.data.draft || ""}`.trim();
    if (!content) {
      return;
    }

    const response = mockChat.sendMessage({
      content,
      sessionId: this.data.activeSessionId,
    });

    if (!response) {
      return;
    }

    this.setData({
      draft: "",
      isResponding: true,
      showCapsuleMenu: false,
      showCommonActionSheet: false,
      showDrawer: false,
      showSettingsSheet: false,
      showWelcome: false,
    });
    this.syncSession(response.sessionId);

    try {
      await this.playReplyPlan(response);
    } finally {
      if (!this.replyToken) {
        this.setData({
          isResponding: false,
        });
      }
    }
  },

  async playReplyPlan(response) {
    const token = `reply_${Date.now()}`;
    const sessionId = response.sessionId;
    this.replyToken = token;

    const typingMessage = mockChat.createTypingMessage(sessionId);
    const pendingMessages = [...mockChat.getMessages(sessionId), typingMessage];
    this.setData({
      messages: pendingMessages,
    });
    this.scrollToLatest(pendingMessages, `msg-${typingMessage.id}`);

    await this.delay(response.plan.thinkingDelay);
    if (this.replyToken !== token) {
      return;
    }

    for (const segment of response.plan.segments) {
      if (this.replyToken !== token) {
        return;
      }

      if (segment.type === "text") {
        await this.playStreamingTextSegment(sessionId, segment, token);
        continue;
      }

      this.setData({
        messages: mockChat.getMessages(sessionId),
      });
      this.scrollToLatest(mockChat.getMessages(sessionId));
      await this.delay(segment.type === "image-card" ? 220 : 160);
      if (this.replyToken !== token) {
        return;
      }

      mockChat.commitAssistantSegment({
        segment,
        sessionId,
      });
      this.syncSession(sessionId);
    }

    if (this.replyToken === token) {
      this.replyToken = "";
      this.setData({
        isResponding: false,
      });
      this.syncSession(sessionId);
    }
  },

  async playStreamingTextSegment(sessionId, segment, token) {
    const liveMessage = mockChat.createStreamingMessage(sessionId);
    const fullText = segment.content || "";
    const chunkSize = fullText.length > 80 ? 3 : 2;

    this.setData({
      messages: [...mockChat.getMessages(sessionId), liveMessage],
    });
    this.scrollToLatest([...mockChat.getMessages(sessionId), liveMessage], `msg-${liveMessage.id}`);

    for (let cursor = 0; cursor < fullText.length; cursor += chunkSize) {
      if (this.replyToken !== token) {
        return;
      }

      liveMessage.content = fullText.slice(0, cursor + chunkSize);
      this.setData({
        messages: [...mockChat.getMessages(sessionId), liveMessage],
      });
      this.scrollToLatest([...mockChat.getMessages(sessionId), liveMessage], `msg-${liveMessage.id}`);
      await this.delay(this.data.settings.typingSpeed);
    }

    if (this.replyToken !== token) {
      return;
    }

    mockChat.commitAssistantSegment({
      segment: {
        content: fullText,
        type: "text",
      },
      sessionId,
    });
    this.syncSession(sessionId);
  },

  handleSettingsAction(event) {
    const action = event.currentTarget.dataset.action;

    if (action === "language") {
      wx.showToast({
        icon: "none",
        title: "当前仅提供简体中文",
      });
      return;
    }

    if (action === "appearance") {
      wx.showToast({
        icon: "none",
        title: "外观跟随系统，仅做演示",
      });
      return;
    }

    if (action === "account") {
      wx.showToast({
        icon: "none",
        title: "未接入真实账号系统",
      });
      return;
    }

    if (action === "data") {
      this.handleClearAll();
      return;
    }

    if (action === "update") {
      wx.showToast({
        icon: "none",
        title: "当前已是最新版本",
      });
      return;
    }

    if (action === "agreement") {
      wx.showToast({
        icon: "none",
        title: "服务协议仅做静态展示",
      });
      return;
    }

    wx.showToast({
      icon: "none",
      title: "帮助与反馈未接入",
    });
  },

  handleClearAll() {
    wx.showModal({
      cancelText: "取消",
      confirmText: "重置",
      content: "清空本地会话和演示数据？",
      title: "数据管理",
      success: (result) => {
        if (!result.confirm) {
          return;
        }

        mockChat.clearAll();
        this.closeSettingsSheet();
        this.refreshFromService(true);
      },
    });
  },

  handleLogoutTap() {
    wx.showToast({
      icon: "none",
      title: "演示模式未接入登录",
    });
  },

  onShareAppMessage() {
    const groups = this.data.historyGroups || [];
    let session = null;

    groups.some((group) => {
      const match = (group.items || []).find((item) => item.id === this.data.activeSessionId);
      if (!match) {
        return false;
      }

      session = match;
      return true;
    });

    this.closeCapsuleMenu();

    return {
      path: "/pages/chat/index",
      title: session && session.title ? `一起看这段对话：${session.title}` : "YJ Chatbot Demo",
    };
  },

  noop() {},
});
