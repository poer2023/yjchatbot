import * as mockChat from "./mock-chat.js";
import { models, modelMap } from "./models.js";
import { markdownToHtml } from "./rich-text.js?v=20260417-chat-8";
import { getThemeClass, getThemeLabel, getTypingSpeedLabel } from "./helpers.js";

const ICON = "./assets/icons";

const ATTACH_ACTION_OPTIONS = [{ key: "pick-album-image", label: "选择相册中的图片" }];
const SESSION_ACTION_OPTIONS = [
  { key: "rename-session", label: "重命名" },
  { key: "delete-session", label: "删除" },
];
const MOCK_SOURCE_LINKS = [
  {
    title: "Reuters | Iran and US tensions latest updates",
    url: "https://www.reuters.com/world/middle-east/",
  },
  {
    title: "AP News | Middle East conflict live tracker",
    url: "https://apnews.com/hub/middle-east",
  },
  {
    title: "BBC | Iran profile and regional timeline",
    url: "https://www.bbc.com/news/topics/cq23pdgvxqwt/iran",
  },
  {
    title: "Al Jazeera | Iran-US relations analysis",
    url: "https://www.aljazeera.com/tag/iran/",
  },
  {
    title: "UN News | Security Council statements",
    url: "https://news.un.org/en/news/topic/peace-and-security",
  },
];

function getAttachActionOptionsByMode(modeId) {
  return ATTACH_ACTION_OPTIONS;
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
      map[label] = { items: [], label };
      groups.push(map[label]);
    }
    map[label].items.push(session);
  });
  return groups;
}

function inferModeFromModel(modelId) {
  return "quick";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

const DEFAULT_INPUT_PLACEHOLDER = "输入问题，开始咨询吧~";
const LONG_CHAT_INPUT_PLACEHOLDER = "耐心聊完更准，输1直接出结果";

function countCompletedDialogRounds(messages) {
  const list = Array.isArray(messages) ? messages : [];
  let rounds = 0;
  for (let i = 0; i < list.length; i += 1) {
    const cur = list[i];
    if (!cur || cur.role !== "user") {
      continue;
    }
    for (let j = i + 1; j < list.length; j += 1) {
      const next = list[j];
      if (!next) {
        break;
      }
      if (next.role === "user") {
        break;
      }
      if (next.role !== "assistant") {
        continue;
      }
      if (next.type === "typing") {
        continue;
      }
      if (next.status && next.status !== "done") {
        continue;
      }
      rounds += 1;
      break;
    }
  }
  return rounds;
}

function getChatDraftPlaceholder(messages) {
  return countCompletedDialogRounds(messages) > 3 ? LONG_CHAT_INPUT_PLACEHOLDER : ui.inputPlaceholder;
}

const ui = {
  activeMode: "quick",
  activeSessionId: "",
  appearanceLabel: "系统",
  capsuleHeight: 32,
  capsuleMenuTop: 96,
  capsuleRight: 14,
  capsuleWidth: 68,
  commonSheetCancelText: "取消",
  commonSheetContext: "",
  commonSheetOptions: [],
  commonSheetSessionId: "",
  commonSheetVisible: false,
  currentModel: models[0],
  draft: "",
  headerEdgePadding: 14,
  headerPadTop: 48,
  headerSafeHeight: 44,
  historyGroups: [],
  inputPlaceholder: DEFAULT_INPUT_PLACEHOLDER,
  isLoggedIn: false,
  isResponding: false,
  languageLabel: "简体中文",
  loginAgreementAccepted: false,
  keyboardVisible: false,
  inappSettingsPage: "main",
  messages: [],
  navBarHeight: 42,
  profileInitial: "凡",
  profileName: "用户",
  sourceSheetLinks: [],
  sourceSheetTitle: "参考来源",
  sourceSheetVisible: false,
  richFoldState: {},
  renameDialogSessionId: "",
  renameDialogValue: "",
  renameDialogVisible: false,
  searchToggles: {
    academic: false,
    knowledge: false,
    legal: false,
    web: false,
  },
  settings: { theme: "light", typingSpeed: 28 },
  voiceMode: false,
  voicePressActive: false,
  voicePressCancel: false,
  voiceToTextActive: false,
  showCapsuleMenu: false,
  showDrawer: false,
  showSettingsSheet: false,
  showWelcome: true,
  titleSafeLeft: 112,
  titleSafeRight: 120,
  versionLabel: "1.8.3(2)",
};

let replyToken = "";
let timerBag = [];

function cancelPendingPlayback() {
  replyToken = "";
  timerBag.forEach(clearTimeout);
  timerBag = [];
}

function delay(ms) {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      timerBag = timerBag.filter((x) => x !== t);
      resolve();
    }, ms || 0);
    timerBag.push(t);
  });
}

function getCurrentState(sessionId) {
  const state = mockChat.getState();
  const currentSession =
    state.sessions.find((s) => s.id === (sessionId || state.activeSessionId)) ||
    state.sessions[0] ||
    null;
  const messages = currentSession ? mockChat.getMessages(currentSession.id) : [];
  const currentModel =
    modelMap[(currentSession && currentSession.modelId) || state.settings.defaultModelId] || models[0];
  return { currentModel, currentSession, messages, state };
}

function applySnapshot(snapshot) {
  Object.assign(ui, {
    activeMode: "quick",
    activeSessionId: snapshot.currentSession ? snapshot.currentSession.id : "",
    currentModel: snapshot.currentModel,
    historyGroups: groupSessionsByMonth(snapshot.state.sessions, snapshot.state.messagesBySession),
    isLoggedIn: snapshot.state.settings.loggedIn !== false,
    messages: snapshot.messages,
    settings: snapshot.state.settings,
    showWelcome: snapshot.state.settings.showWelcome && snapshot.messages.length === 0,
  });
}

function refreshFromService(force) {
  mockChat.bootstrap(!!force);
  applySnapshot(getCurrentState());
}

function syncSession(sessionId) {
  applySnapshot(getCurrentState(sessionId));
}

function scrollToAnchor(id) {
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  });
}

function scrollToLatest(messages, anchorId) {
  const last = messages && messages[messages.length - 1];
  scrollToAnchor(anchorId || (last ? `msg-${last.id}` : "welcome-anchor"));
}

let toastTimer;
function showToast(title) {
  const node = document.getElementById("toast");
  if (!node) return;
  node.textContent = title;
  node.classList.add("toast-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("toast-visible"), 2200);
}

function showBusyToast() {
  showToast("回复生成中，请稍候");
}

function parseFoldableRichContent(content) {
  const text = `${content || ""}`;
  const toggleLabel = "已完成回答";
  const anchor = "用户问的是：美国与伊朗要打仗么？";
  const labelIndex = text.indexOf(toggleLabel);
  const anchorIndex = text.indexOf(anchor);
  if (labelIndex < 0 || anchorIndex <= labelIndex) {
    return null;
  }

  const beforeAnchor = text.slice(labelIndex + toggleLabel.length, anchorIndex).replace(/^ *▼?/, "").trim();
  const afterAnchor = text.slice(anchorIndex).trim();
  if (!afterAnchor) {
    return null;
  }

  return {
    afterAnchor,
    beforeAnchor,
    label: toggleLabel,
  };
}

function enhanceRichSourceTrigger(html, messageId) {
  if (!html || !messageId) {
    return html;
  }
  return html.replace(
    /<p([^>]*)>\s*参考来源\s*[›>]\s*<\/p>/g,
    `<button type="button" class="rich-source-trigger" data-action="open-source-sheet" data-message-id="${escapeAttr(
      messageId
    )}"><span>参考来源</span><span class="rich-source-arrow">›</span></button>`
  );
}

function renderMessageBubble(message) {
  const theme = ui.settings.theme || "light";
  const isUser = message.role === "user";
  const meta = isUser ? "我" : "涌见AI";
  const avatar =
    message.role !== "user"
      ? `<div class="assistant-avatar"><img class="assistant-avatar-image" src="./assets/images/welcome-balance.png" alt="" /></div>`
      : "";

  let inner = "";
  if (message.type === "text" || (message.type === "rich" && message.status === "streaming")) {
    inner = `<div class="message-text">${escapeHtml(message.content || "")}</div>`;
  } else if (message.type === "rich") {
    const foldPayload = parseFoldableRichContent(message.content || "");
    if (foldPayload) {
      const isExpanded = !!ui.richFoldState[message.id];
      const beforeHtml = enhanceRichSourceTrigger(markdownToHtml(foldPayload.beforeAnchor || "", theme), message.id);
      const afterHtml = enhanceRichSourceTrigger(markdownToHtml(foldPayload.afterAnchor, theme), message.id);
      inner = `<div class="message-rich">
        <button
          type="button"
          class="rich-fold-toggle"
          data-action="toggle-rich-fold"
          data-message-id="${escapeAttr(message.id)}"
          aria-expanded="${isExpanded ? "true" : "false"}"
        >
          <span>${escapeHtml(foldPayload.label)}</span>
          <span class="rich-fold-arrow ${isExpanded ? "rich-fold-arrow-expanded" : ""}">▼</span>
        </button>
        <div class="rich-fold-body ${isExpanded ? "rich-fold-body-expanded" : ""}">${beforeHtml}</div>
        <div class="rich-fold-after">${afterHtml}</div>
      </div>`;
    } else {
      inner = `<div class="message-rich">${enhanceRichSourceTrigger(markdownToHtml(
        message.content || "",
        theme
      ), message.id)}</div>`;
    }
  } else if (message.type === "image-card") {
    const c = message.extra?.card || {};
    const grad = `linear-gradient(135deg, ${c.accentStart || "#d8f0e7"} 0%, ${c.accentEnd || "#245f8f"} 100%)`;
    inner = `
      <div class="image-card">
        <div class="image-cover" style="background: ${escapeAttr(grad)}">
          <div class="cover-grid"></div>
          <div class="cover-pill"><span>${escapeHtml(c.badge)}</span></div>
          <div class="cover-caption"><span>${escapeHtml(c.eyebrow)}</span></div>
        </div>
        <div class="image-copy">
          <span class="image-title">${escapeHtml(c.title)}</span>
          <span class="image-description">${escapeHtml(c.description)}</span>
          <div class="image-footer">
            <div class="image-action"><span>${escapeHtml(c.actionLabel)}</span></div>
            <span class="image-metric">${escapeHtml(c.metric)}</span>
          </div>
        </div>
      </div>`;
  } else if (message.type === "typing") {
    inner = `<div class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
  } else if (message.type === "file-card") {
    const file = message.extra?.file || {};
    inner = `
      <div class="file-card" role="group" aria-label="PDF 附件">
        <span class="file-card-main">
          <span class="file-card-title">${escapeHtml(file.fileName || message.content || "会话文档.pdf")}</span>
          <span class="file-card-meta">${escapeHtml(file.fileSize || "128 KB")}\u00a0\u00a0${escapeHtml(
            file.description || "未下载"
          )}</span>
        </span>
        <span class="file-card-icon" aria-hidden="true"><span class="file-card-icon-label">PDF</span></span>
      </div>`;
  }

  const bubbleClass =
    `message-bubble ${isUser ? "message-bubble-user" : "message-bubble-assistant"}` +
    (message.type === "typing" ? " message-bubble-typing" : "") +
    (message.type === "file-card" ? " message-bubble-plain-card" : "");

  return `
    <div class="message-row ${isUser ? "message-row-user" : ""}">
      ${avatar}
      <div class="message-main ${isUser ? "message-main-user" : ""}">
        <div class="message-meta">${meta}</div>
        <div class="${bubbleClass}">${inner}</div>
      </div>
    </div>`;
}

function renderChat() {
  const showLoginStage = ui.isLoggedIn === false;
  const showHomeStage = !showLoginStage && ui.messages.length === 0;
  const stageClass = `${showLoginStage || showHomeStage ? "message-stack-welcome" : ""} ${
    showHomeStage ? "message-stack-home" : ""
  }`.trim();
  const messagesHtml = showLoginStage
    ? ""
    : (ui.messages || [])
        .map(
          (m) =>
            `<div id="msg-${escapeAttr(m.id)}" class="message-anchor">${renderMessageBubble(m)}</div>`
        )
        .join("");

  const loginBlock = showLoginStage
    ? `<section class="login-stage">
        <div class="login-stage-upper">
          <div class="login-brand-row">
            <div class="login-brand-logo">
              <img class="login-brand-logo-icon" src="./assets/images/welcome-balance.png" alt="涌见AI logo" />
            </div>
            <div class="login-brand-copy">
              <h1 class="login-title">您好，我是您的AI法律顾问</h1>
            </div>
          </div>
          <div class="login-feature-list" aria-label="功能说明">
            <div class="login-feature-item"><strong>案情咨询：</strong><span>自然语言对话，了解案情</span></div>
            <div class="login-feature-item"><strong>法律搜索：</strong><span>搜索法律法规及相似司法案例</span></div>
            <div class="login-feature-item"><strong>出具意见：</strong><span>深入分析，生成法律意见书</span></div>
          </div>
        </div>
        <div class="login-actions">
          <button type="button" class="login-button login-button-primary" data-action="settings-row" data-settings="mock-login">
            微信授权登录
          </button>
        </div>
        <div class="login-agreement ${ui.loginAgreementAccepted ? "login-agreement-checked" : ""}">
          <button type="button" class="login-agreement-toggle" data-action="toggle-login-agreement" aria-label="同意协议">
            <span class="login-agreement-indicator" aria-hidden="true"></span>
          </button>
          <span>我已阅读并同意 <button type="button" class="login-inline-link" data-action="settings-row" data-settings="user-agreement">用户协议</button> 与 <button type="button" class="login-inline-link" data-action="settings-row" data-settings="privacy-policy">隐私政策</button></span>
        </div>
        <div class="login-stage-spacer" aria-hidden="true"></div>
        <p class="login-footer-note">北大法律人工智能实验室提供技术支持</p>
      </section>`
    : "";
  const drawerGroups = (ui.historyGroups || [])
    .map((group) => {
      const items = group.items
        .map(
          (session) => `
        <button type="button" class="history-item ${session.id === ui.activeSessionId ? "history-item-active" : ""}"
          data-action="pick-session" data-session-id="${escapeAttr(session.id)}">
          <span class="history-item-title">${escapeHtml(session.title)}</span>
        </button>`
        )
        .join("");
      return `<div class="history-group">
        <span class="history-group-label">${escapeHtml(group.label)}</span>
        ${items}
      </div>`;
    })
    .join("");

  const canSend = ui.draft.trim().length > 0;
  const sendCircleClass =
    "input-circle-btn input-circle-send" + (canSend && !ui.isResponding ? " input-circle-send-active" : "");
  const sendInner =
    canSend && !ui.isResponding
      ? `<img class="send-plane-icon" src="${ICON}/send-plane-light.svg" alt="" />`
      : ui.isResponding
        ? `<span class="send-loading">…</span>`
        : `<img class="send-plane-icon" src="${ICON}/send-plane.svg" alt="" />`;

  const searchChips = [
    { kind: "legal", label: "法律搜索", icon: `${ICON}/legal-search.svg` },
    { kind: "web", label: "联网搜索", icon: `${ICON}/globe-blue.svg` },
    { kind: "academic", label: "学术搜索", icon: `${ICON}/academic-search.svg` },
    { kind: "knowledge", label: "知识库搜索", icon: `${ICON}/knowledge-search.svg` },
  ];
  const chipsHtml = searchChips
    .map(
      (c) => `
    <button type="button" class="search-chip ${
      ui.searchToggles[c.kind] ? "search-chip-active" : ""
    }" data-action="stub" data-kind="${escapeAttr(c.kind)}" ${
      ui.isResponding ? "disabled" : ""
    }>
      <img class="search-chip-icon" src="${escapeAttr(c.icon)}" alt="" /><span>${escapeHtml(c.label)}</span>
    </button>`
    )
    .join("");
  const hasSearchChips = ui.activeMode === "expert";
  const searchChipsSection = hasSearchChips ? `<div class="input-search-chips">${chipsHtml}</div>` : "";
  const voiceWaveHtml = new Array(26)
    .fill(0)
    .map((_, index) => `<span class="voice-wave-bar" style="--i:${index}"></span>`)
    .join("");
  const voiceWaveSectionTop =
    ui.voiceMode && hasSearchChips
      ? `<div class="voice-record-panel ${ui.voicePressActive ? "voice-record-panel-active" : ""} voice-record-panel-top"><div class="voice-wave-row">${voiceWaveHtml}</div></div>`
      : "";
  const voiceWaveSectionInline =
    ui.voiceMode && !hasSearchChips
      ? `<div class="voice-record-panel ${ui.voicePressActive ? "voice-record-panel-active" : ""} voice-record-panel-top"><div class="voice-wave-row">${voiceWaveHtml}</div></div>`
      : "";
  const voiceHoldClass =
    "voice-hold-btn" +
    (ui.voicePressActive ? " voice-hold-btn-recording" : "") +
    (ui.voicePressCancel ? " voice-hold-btn-cancel" : "");
  const voiceHoldText = ui.voicePressCancel ? "松手 取消" : "按住 说话";
  const chatDraftPlaceholder = getChatDraftPlaceholder(ui.messages || []);
  const commonSheetOptionsHtml = (ui.commonSheetOptions || [])
    .map(
      (item, index, list) => `
        <button type="button" class="common-sheet-option" data-action="common-sheet-option" data-key="${escapeAttr(
          item.key
        )}" data-label="${escapeAttr(item.label)}">
          <span>${escapeHtml(item.label)}</span>
        </button>
        ${index < list.length - 1 ? '<span class="common-sheet-separator" aria-hidden="true"></span>' : ""}`
    )
    .join("");
  const commonActionSheetHtml = `
    <div class="common-sheet-layer ${ui.commonSheetVisible ? "common-sheet-layer-visible" : ""}">
      <div class="common-sheet-mask" data-action="close-common-sheet"></div>
      <div class="common-sheet-panel" data-stop="1">
        <div class="common-sheet-card">
          ${commonSheetOptionsHtml}
          <span class="common-sheet-separator" aria-hidden="true"></span>
          <button type="button" class="common-sheet-cancel" data-action="close-common-sheet">
            ${escapeHtml(ui.commonSheetCancelText || "取消")}
          </button>
        </div>
      </div>
    </div>`;
  const renameDialogHtml = `
    <div class="rename-dialog-layer ${ui.renameDialogVisible ? "rename-dialog-layer-visible" : ""}">
      <div class="rename-dialog-mask" data-action="close-rename-dialog"></div>
      <div class="rename-dialog-panel" data-stop="1">
        <div class="rename-dialog-card">
          <div class="rename-dialog-title">重命名会话</div>
          <input
            id="rename-session-input"
            class="rename-dialog-input"
            type="text"
            maxlength="32"
            value="${escapeAttr(ui.renameDialogValue || "")}"
            placeholder="请输入会话名称"
          />
          <div class="rename-dialog-actions">
            <button type="button" class="rename-dialog-btn" data-action="close-rename-dialog">取消</button>
            <button type="button" class="rename-dialog-btn rename-dialog-btn-primary" data-action="confirm-rename-dialog">
              确认
            </button>
          </div>
        </div>
      </div>
    </div>`;
  const sourceSheetLinksHtml = (ui.sourceSheetLinks || [])
    .map(
      (item) => `<button
        type="button"
        class="source-sheet-item"
        data-action="copy-source-link"
        data-url="${escapeAttr(item.url)}"
      >
        <span class="source-sheet-item-title">${escapeHtml(item.title)}</span>
        <span class="source-sheet-item-url">${escapeHtml(item.url)}</span>
      </button>`
    )
    .join("");
  const sourceSheetHtml = `
    <div class="source-sheet-layer ${ui.sourceSheetVisible ? "source-sheet-layer-visible" : ""}">
      <div class="source-sheet-mask" data-action="close-source-sheet"></div>
      <div class="source-sheet-panel" data-stop="1">
        <div class="source-sheet-card">
          <div class="source-sheet-head">
            <span class="source-sheet-title">${escapeHtml(ui.sourceSheetTitle || "参考来源")}</span>
            <button type="button" class="source-sheet-close" data-action="close-source-sheet">完成</button>
          </div>
          <div class="source-sheet-list">${sourceSheetLinksHtml}</div>
        </div>
      </div>
    </div>`;
  const capsuleTopActions = [
    { key: "capsule-forward-disabled", label: "当前页面不可转发", icon: "↪" },
    { key: "capsule-share-disabled", label: "当前页面不可分享", icon: "◌" },
    { key: "capsule-favorite", label: "星标", icon: "☆" },
    { key: "capsule-collect", label: "收藏", icon: "◼" },
    { key: "capsule-add-mini", label: "添加到我的小程序", icon: "◔" },
    { key: "capsule-add-desktop", label: "添加到桌面", icon: "▮" },
    { key: "capsule-use-browser", label: "用手机浏览器打开", icon: "▯" },
  ];
  const capsuleUtilityActions = [
    { key: "capsule-float", label: "浮窗", icon: "▢" },
    { key: "capsule-settings", label: "设置", icon: "⚙" },
    { key: "capsule-feedback", label: "反馈与投诉", icon: "⚠" },
    { key: "capsule-relaunch", label: "重新进入小程序", icon: "↻" },
    { key: "capsule-copy-link", label: "复制链接", icon: "⛓" },
    { key: "capsule-translate", label: "翻译", icon: "A" },
    { key: "capsule-security", label: "成长守护", icon: "◍" },
  ];
  const capsuleActionItemHtml = (item) => `<button
      type="button"
      class="capsule-popup-action"
      data-action="capsule-popup-item"
      data-key="${escapeAttr(item.key)}"
      data-label="${escapeAttr(item.label)}"
    >
      <span class="capsule-popup-action-icon">${escapeHtml(item.icon)}</span>
      <span class="capsule-popup-action-label">${escapeHtml(item.label)}</span>
    </button>`;
  const capsulePopupHtml = `
    <div class="capsule-popup-layer ${ui.showCapsuleMenu ? "capsule-popup-layer-visible" : ""}">
      <div class="capsule-popup-mask" data-action="close-capsule-popup"></div>
      <div class="capsule-popup-panel" data-stop="1">
        <div class="capsule-popup-app-card">
          <span class="capsule-popup-app-icon">🐋</span>
          <span class="capsule-popup-app-meta">
            <span class="capsule-popup-app-name">涌见AI <span class="capsule-popup-app-arrow">›</span></span>
            <span class="capsule-popup-app-sub">涌见智能助手演示版本</span>
          </span>
        </div>
        <div class="capsule-popup-actions-row">
          ${capsuleTopActions.map(capsuleActionItemHtml).join("")}
        </div>
        <div class="capsule-popup-actions-row">
          ${capsuleUtilityActions.map(capsuleActionItemHtml).join("")}
        </div>
        <button type="button" class="capsule-popup-cancel" data-action="close-capsule-popup">取消</button>
      </div>
    </div>`;
  const mockImeHtml = `
    <div class="mock-ime-layer ${ui.keyboardVisible ? "mock-ime-layer-visible" : ""}">
      <div class="mock-ime-panel" aria-hidden="true">
        <div class="mock-ime-candidate-row">
          <span class="mock-ime-candidate">我</span>
          <span class="mock-ime-candidate">你</span>
          <span class="mock-ime-candidate">在</span>
          <span class="mock-ime-candidate">这</span>
          <span class="mock-ime-candidate">不</span>
          <span class="mock-ime-candidate">是</span>
          <span class="mock-ime-candidate">一</span>
          <span class="mock-ime-candidate">好</span>
          <span class="mock-ime-candidate">他</span>
          <span class="mock-ime-candidate">那</span>
          <span class="mock-ime-candidate-arrow"><img class="mock-ime-icon mock-ime-icon-chevron" src="${ICON}/keyboard-chevron.svg" alt="" /></span>
        </div>
        <div class="mock-ime-row">
          <span class="mock-ime-key">q</span><span class="mock-ime-key">w</span><span class="mock-ime-key">e</span>
          <span class="mock-ime-key">r</span><span class="mock-ime-key">t</span><span class="mock-ime-key">y</span>
          <span class="mock-ime-key">u</span><span class="mock-ime-key">i</span><span class="mock-ime-key">o</span>
          <span class="mock-ime-key">p</span>
        </div>
        <div class="mock-ime-row mock-ime-row-offset">
          <span class="mock-ime-key">a</span><span class="mock-ime-key">s</span><span class="mock-ime-key">d</span>
          <span class="mock-ime-key">f</span><span class="mock-ime-key">g</span><span class="mock-ime-key">h</span>
          <span class="mock-ime-key">j</span><span class="mock-ime-key">k</span><span class="mock-ime-key">l</span>
        </div>
        <div class="mock-ime-row">
          <span class="mock-ime-key mock-ime-key-func mock-ime-key-icon"><img class="mock-ime-icon mock-ime-icon-shift" src="${ICON}/keyboard-shift.svg" alt="" /></span>
          <span class="mock-ime-key">z</span><span class="mock-ime-key">x</span><span class="mock-ime-key">c</span>
          <span class="mock-ime-key">v</span><span class="mock-ime-key">b</span><span class="mock-ime-key">n</span>
          <span class="mock-ime-key">m</span>
          <span class="mock-ime-key mock-ime-key-func mock-ime-key-icon"><img class="mock-ime-icon mock-ime-icon-backspace" src="${ICON}/keyboard-backspace.svg" alt="" /></span>
        </div>
        <div class="mock-ime-row mock-ime-row-bottom">
          <span class="mock-ime-key mock-ime-key-func mock-ime-key-compact">123</span>
          <span class="mock-ime-key mock-ime-key-func mock-ime-key-compact mock-ime-key-icon"><img class="mock-ime-icon mock-ime-icon-smile" src="${ICON}/keyboard-smile.svg" alt="" /></span>
          <span class="mock-ime-key mock-ime-key-space">空格</span>
          <span class="mock-ime-key mock-ime-key-send">发送</span>
        </div>
        <div class="mock-ime-toolbar">
          <span class="mock-ime-toolbar-icon"><img class="mock-ime-icon mock-ime-icon-toolbar" src="${ICON}/keyboard-globe.svg" alt="" /></span>
          <span class="mock-ime-toolbar-spacer"></span>
          <span class="mock-ime-toolbar-icon"><img class="mock-ime-icon mock-ime-icon-toolbar mock-ime-icon-toolbar-mic" src="${ICON}/keyboard-mic.svg" alt="" /></span>
        </div>
      </div>
    </div>`;
  const inputAreaHtml = !ui.voiceMode
    ? `<div class="input-main-capsule">
          <button type="button" class="input-mic-wrap" data-action="stub" data-kind="voice" aria-label="语音输入" ${
            ui.isResponding ? "disabled" : ""
          }>
            <img class="input-mic-icon" src="${ICON}/voice-wave.svg" alt="" />
          </button>
          <textarea class="chat-textarea-flex" id="chat-draft" maxlength="2000" rows="1"
            placeholder="${escapeAttr(chatDraftPlaceholder)}" ${ui.isResponding ? "disabled" : ""}>${escapeHtml(
              ui.draft
            )}</textarea>
          <div class="input-trailing-actions">
            <button type="button" class="input-circle-btn input-circle-voice${ui.voiceToTextActive ? " input-circle-voice-active" : ""}" data-action="toggle-voice-to-text" aria-label="语音转文字" ${
              ui.isResponding ? "disabled" : ""
            }><img class="input-voice-icon" src="${ICON}/mic.svg" alt="" /></button>
            <button type="button" class="input-circle-btn input-circle-plus" data-action="stub" data-kind="attach" aria-label="附件" ${
              ui.isResponding ? "disabled" : ""
            }><img class="input-plus-icon" src="${ICON}/attach-image.svg" alt="" /></button>
            <button type="button" class="${sendCircleClass}" data-action="send" aria-label="发送" ${ui.isResponding ? "disabled" : ""}>
              ${sendInner}
            </button>
          </div>
        </div>`
    : `<div class="voice-mode-shell">
          ${voiceWaveSectionInline}
          <button type="button" id="voice-hold-btn" class="${voiceHoldClass}" aria-label="按住说话">
            <span class="voice-hold-leading" aria-hidden="true">
              <img class="voice-hold-leading-icon" src="${ICON}/voice-text.svg" alt="" />
            </span>
            <span class="voice-hold-text">${voiceHoldText}</span>
            <span class="voice-hold-trailing" aria-hidden="true">
              <img class="voice-hold-trailing-icon" src="${ICON}/send-plane.svg" alt="" />
            </span>
          </button>
        </div>`;

  const sessionToolbarChat = "";

  const homeBlock = showHomeStage
    ? `<section class="home-stage">
        <div class="home-stage-upper">
          <div class="login-brand-row">
            <div class="login-brand-logo">
              <img class="login-brand-logo-icon" src="./assets/images/welcome-balance.png" alt="涌见AI logo" />
            </div>
            <div class="login-brand-copy">
              <h2 class="login-title">您好，我是您的AI法律顾问</h2>
            </div>
          </div>
          <p class="login-intro">我会先问您几个具体问题，了解清楚案情，然后再出具法律意见书。耐心聊完，结果更准确喔~</p>
        </div>
        <div class="home-composer-card">
          <div class="home-input-wrap">${inputAreaHtml}</div>
        </div>
        <div class="home-stage-spacer" aria-hidden="true"></div>
        <p class="login-footer-note">北大法律人工智能实验室提供技术支持</p>
      </section>`
    : "";

  return `
  <div class="chat-page">
    <div class="chat-shell ${ui.keyboardVisible ? "chat-shell-keyboard-visible" : ""}">
      <header class="chat-header">
        <div class="header-safe" style="height:${ui.headerSafeHeight}px"></div>
        <div class="header-row" style="height:${ui.navBarHeight}px;padding-left:${ui.headerEdgePadding}px">
          <div class="header-left-actions ${showLoginStage ? "header-left-actions-hidden" : ""}">
            ${
              showLoginStage
                ? ""
                : `<button type="button" class="nav-icon-button" data-action="open-drawer" aria-label="菜单">
                    <span class="menu-bars"><span class="menu-bar menu-bar-top"></span><span class="menu-bar menu-bar-bottom"></span></span>
                  </button>
                  ${
                    showHomeStage
                      ? ""
                      : `<button type="button" class="header-new-session-btn" data-action="new-session" aria-label="新建会话">
                          <span class="header-new-session-plus" aria-hidden="true">+</span>
                        </button>`
                  }`
            }
          </div>
          <div class="header-center" style="left:${ui.titleSafeLeft}px;right:${ui.titleSafeRight}px">
            <span class="header-title">
              <span>弥渡AI法律顾问</span>
            </span>
          </div>
          <div class="header-capsule" style="right:${ui.capsuleRight}px;width:${ui.capsuleWidth}px;height:${ui.capsuleHeight}px">
            <button type="button" class="capsule-action" data-action="toggle-capsule-menu" aria-label="更多">
              <img class="capsule-more-icon" src="${ICON}/capsule-more.svg" alt="" />
            </button>
            <span class="capsule-divider" aria-hidden="true"></span>
            <button type="button" class="capsule-action" data-action="close-mini-program" aria-label="关闭">
              <img class="capsule-close-icon" src="${ICON}/capsule-close.svg" alt="" />
            </button>
          </div>
        </div>
      </header>

      <div class="chat-scroll" id="chat-scroll">
        <span class="drawer-scroll-indicator chat-scroll-indicator" aria-hidden="true"></span>
        <div class="message-stack ${stageClass}">
          <div id="welcome-anchor"></div>
          ${loginBlock}
          ${homeBlock}
          ${messagesHtml}
        </div>
      </div>

      <div class="chat-input ${showLoginStage || showHomeStage ? "chat-input-hidden" : ""}">
        ${sessionToolbarChat}
        ${voiceWaveSectionTop}
        ${searchChipsSection}
        ${inputAreaHtml}
        <div class="input-disclaimer">内容由AI生成，仅供参考</div>
      </div>
      ${mockImeHtml}
      <input id="attach-image-input" type="file" accept="image/*" hidden />
    </div>

    ${capsulePopupHtml}

    <div class="drawer-shell ${ui.showDrawer ? "drawer-visible" : ""}" id="drawer-root">
      <div class="drawer-mask" data-action="close-drawer"></div>
      <div class="drawer-panel" data-stop="1">
        <div class="drawer-list" style="padding-top:${ui.headerPadTop}px">
          <span class="drawer-scroll-indicator" aria-hidden="true"></span>
          ${drawerGroups}
        </div>
        <div class="drawer-footer" data-action="open-settings-sheet">
          <div class="profile-avatar"><span>${escapeHtml(ui.profileInitial)}</span></div>
          <span class="profile-name">${escapeHtml(ui.profileName)}</span>
          <span class="profile-more">···</span>
        </div>
      </div>
    </div>

    ${commonActionSheetHtml}
    ${renameDialogHtml}
    ${sourceSheetHtml}

  </div>`;
}

function renderInAppSettings() {
  const isLoggedIn = ui.isLoggedIn !== false;
  const isSecurityPage = ui.inappSettingsPage === "security";
  const pageTitle = isSecurityPage ? "账户与安全" : "账户信息";
  const backAction = isSecurityPage ? "back-inapp-main" : "close-settings-sheet";
  const securityPageHtml = `
      <div class="inapp-settings-panel inapp-page-slide-in">
        <div class="inapp-settings-section">
          <div class="inapp-card-list">
            <button type="button" class="inapp-row inapp-row-action inapp-row-border" data-action="settings-row" data-settings="delete-account">
              <span class="inapp-row-label inapp-row-label-danger">删除账户</span>
              <span class="inapp-row-arrow">›</span>
            </button>
            <button type="button" class="inapp-row inapp-row-action" data-action="settings-row" data-settings="logout">
              <span class="inapp-row-label">退出登录</span>
              <span class="inapp-row-arrow">›</span>
            </button>
          </div>
        </div>
      </div>`;
  const accountBlockHtml = isLoggedIn
    ? `
        <div class="inapp-avatar-wrap">
          <div class="inapp-avatar"></div>
        </div>

        <div class="inapp-settings-section">
          <span class="inapp-section-title">账户</span>
          <div class="inapp-card-list">
            <div class="inapp-row inapp-row-border">
              <span class="inapp-row-label">手机号</span>
              <span class="inapp-row-value">188******30</span>
            </div>
            <div class="inapp-row inapp-row-border">
              <span class="inapp-row-label">用户 id</span>
              <span class="inapp-row-value">2000516763502120962</span>
            </div>
            <div class="inapp-row">
              <span class="inapp-row-label">微信</span>
              <span class="inapp-row-value">已绑定</span>
            </div>
          </div>
        </div>`
    : `
        <div class="inapp-settings-section inapp-settings-section-login-cta">
          <button type="button" class="inapp-login-cta" data-action="settings-row" data-settings="mock-login">登录</button>
        </div>`;

  const mainPageHtml = `
      <div class="inapp-settings-panel">
        ${accountBlockHtml}

        <div class="inapp-settings-section">
          <span class="inapp-section-title">关于</span>
          <div class="inapp-card-list">
            <button type="button" class="inapp-row inapp-row-action inapp-row-border" data-action="settings-row" data-settings="user-agreement">
              <span class="inapp-row-label">用户协议</span>
              <span class="inapp-row-arrow">›</span>
            </button>
            <button type="button" class="inapp-row inapp-row-action" data-action="settings-row" data-settings="privacy-policy">
              <span class="inapp-row-label">隐私政策</span>
              <span class="inapp-row-arrow">›</span>
            </button>
          </div>
        </div>

        <div class="inapp-settings-section">
          <button type="button" class="inapp-single-row" data-action="settings-row" data-settings="contact">联系客服</button>
        </div>

        <div class="inapp-settings-section">
          <button type="button" class="inapp-single-row inapp-single-row-chevron" data-action="open-security-page">
            <span>账户与安全</span><span class="inapp-row-arrow">›</span>
          </button>
        </div>

        <div class="inapp-filing">
          <span class="inapp-filing-line">沪ICP备20022513号-6</span>
          <span class="inapp-filing-line">沪公网安备：31010402333815号</span>
          <span class="inapp-filing-line">网信算备：310115124334401240013号</span>
        </div>
      </div>`;

  return `
  <div class="inapp-settings-page">
    <div class="inapp-settings-topbar">
      <button type="button" class="inapp-nav-back" data-action="${backAction}" aria-label="返回">‹</button>
      <span class="inapp-settings-title">${pageTitle}</span>
      <div class="header-capsule inapp-header-capsule" aria-hidden="true" style="width:${ui.capsuleWidth}px;height:${ui.capsuleHeight}px">
        <button type="button" class="capsule-action" tabindex="-1" aria-label="更多">
          <img class="capsule-more-icon" src="${ICON}/capsule-more.svg" alt="" />
        </button>
        <span class="capsule-divider" aria-hidden="true"></span>
        <button type="button" class="capsule-action" tabindex="-1" aria-label="关闭">
          <img class="capsule-close-icon" src="${ICON}/capsule-close.svg" alt="" />
        </button>
      </div>
    </div>

    <div class="inapp-settings-content">
      ${isSecurityPage ? securityPageHtml : mainPageHtml}
    </div>
  </div>`;
}

const themeOptions = [
  { description: "暖色中性，最像日常工作台。", id: "light", title: "Warm Light" },
  { description: "偏雾面和浅青，更柔和。", id: "mist", title: "Mist" },
  { description: "深色石墨，适合录屏或夜间演示。", id: "graphite", title: "Graphite" },
];

function renderSettingsFull() {
  const st = mockChat.bootstrap(true);
  const themeClass = getThemeClass(st.settings.theme);
  const themeLabel = getThemeLabel(st.settings.theme);
  const typingSpeedLabel = getTypingSpeedLabel(st.settings.typingSpeed);

  const modelCards = models
    .map(
      (m) => `
    <button type="button" class="option-card ${st.settings.defaultModelId === m.id ? "option-card-active" : ""}"
      data-action="pick-model" data-model-id="${escapeAttr(m.id)}">
      <div class="option-leading">
        <span class="option-accent" style="background:${escapeAttr(m.accent)}"></span>
        <span class="option-title">${escapeHtml(m.name)}</span>
      </div>
      <span class="option-description">${escapeHtml(m.description)}</span>
    </button>`
    )
    .join("");

  const themeCards = themeOptions
    .map(
      (t) => `
    <button type="button" class="option-card ${st.settings.theme === t.id ? "option-card-active" : ""}"
      data-action="pick-theme" data-theme-id="${escapeAttr(t.id)}">
      <div class="option-leading"><span class="option-title">${escapeHtml(t.title)}</span></div>
      <span class="option-description">${escapeHtml(t.description)}</span>
    </button>`
    )
    .join("");

  return `
  <div class="settings-page theme-shell ${themeClass}">
    <div class="page-glow glow-a"></div>
    <div class="page-glow glow-b"></div>
    <div class="settings-shell-full">
      <header class="settings-header-full">
        <div class="header-safe" style="height:44px"></div>
        <div class="settings-top">
          <button type="button" class="back-button" data-action="settings-back">Back</button>
          <div class="settings-heading">
            <span class="settings-title">Demo Settings</span>
            <span class="settings-subtitle">控制默认模型、主题、流式速度和本地缓存。</span>
          </div>
        </div>
      </header>
      <div class="settings-scroll-full">
        <div class="settings-stack">
          <div class="settings-card shell-panel">
            <span class="card-eyebrow">DEFAULT MODEL</span>
            <span class="card-title">新会话默认模型</span>
            <span class="card-copy">当前设置只影响后续新建会话，不会强制改写已有会话。</span>
            <div class="option-list">${modelCards}</div>
          </div>
          <div class="settings-card shell-panel">
            <span class="card-eyebrow">LOOK &amp; FEEL</span>
            <span class="card-title">界面主题</span>
            <span class="card-copy">当前主题：${escapeHtml(themeLabel)}</span>
            <div class="option-list">${themeCards}</div>
          </div>
          <div class="settings-card shell-panel">
            <span class="card-eyebrow">PLAYBACK</span>
            <span class="card-title">流式回复速度</span>
            <span class="card-copy">当前节奏：${escapeHtml(typingSpeedLabel)} · ${st.settings.typingSpeed} ms / step</span>
            <input type="range" class="speed-slider" min="18" max="54" step="2" value="${st.settings.typingSpeed}"
              data-action="typing-speed" />
          </div>
          <div class="settings-card shell-panel">
            <span class="card-eyebrow">BEHAVIOR</span>
            <span class="card-title">演示行为</span>
            <div class="switch-row">
              <div><span class="switch-title">显示欢迎态</span><span class="switch-copy">空白会话时展示起手提示和推荐问题。</span></div>
              <input type="checkbox" data-action="toggle-welcome" ${st.settings.showWelcome ? "checked" : ""} />
            </div>
            <div class="switch-row">
              <div><span class="switch-title">本地持久化</span><span class="switch-copy">关闭后仅保留设置，不保存会话历史。</span></div>
              <input type="checkbox" data-action="toggle-persist" ${st.settings.persistHistory ? "checked" : ""} />
            </div>
          </div>
          <div class="settings-card shell-panel danger-card">
            <span class="card-eyebrow">RESET</span>
            <span class="card-title">重置本地 Demo</span>
            <span class="card-copy">删除会话、消息、模型偏好和主题设置，恢复到初始演示状态。</span>
            <button type="button" class="danger-button" data-action="settings-clear-all">Clear local data</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function getRoute() {
  if (location.hash === "#/settings" || location.hash === "#/app-settings") {
    return "app-settings";
  }
  return "chat";
}

function mount() {
  const root = document.getElementById("app-root");
  if (!root) return;
  root.classList.toggle("device-screen-keyboard-visible", getRoute() !== "app-settings" && !!ui.keyboardVisible);
  if (getRoute() === "app-settings") {
    refreshFromService(false);
    if (ui.isLoggedIn === false) {
      ui.inappSettingsPage = "main";
    }
    root.innerHTML = renderInAppSettings();
    bindInAppSettings(root);
  } else {
    refreshFromService(false);
    root.innerHTML = renderChat();
    bindChat(root);
    scrollToLatest(ui.messages);
  }
}

function bindSettingsFull(root) {
  root.onclick = (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "settings-back") {
      location.hash = "#/chat";
      return;
    }
    if (action === "pick-model") {
      mockChat.updateSettings({ defaultModelId: btn.dataset.modelId });
      mount();
      return;
    }
    if (action === "pick-theme") {
      mockChat.updateSettings({ theme: btn.dataset.themeId });
      mount();
      return;
    }
    if (action === "typing-speed") {
      return;
    }
    if (action === "toggle-welcome") {
      return;
    }
    if (action === "toggle-persist") {
      return;
    }
    if (action === "settings-clear-all") {
      if (confirm("清空本地会话、设置和演示数据？")) {
        mockChat.clearAll();
        showToast("已重置");
        mount();
      }
    }
  };

  const slider = root.querySelector('[data-action="typing-speed"]');
  if (slider) {
    slider.oninput = () => {
      mockChat.updateSettings({ typingSpeed: Number(slider.value) || 28 });
      const label = root.querySelector(".settings-card .card-copy");
      const st = mockChat.getState();
      if (label && label.textContent.includes("ms / step")) {
        label.textContent = `当前节奏：${getTypingSpeedLabel(st.settings.typingSpeed)} · ${st.settings.typingSpeed} ms / step`;
      }
    };
  }

  const tw = root.querySelector('[data-action="toggle-welcome"]');
  if (tw) {
    tw.addEventListener("change", (ev) => {
      mockChat.updateSettings({ showWelcome: !!ev.target.checked });
    });
  }
  const tp = root.querySelector('[data-action="toggle-persist"]');
  if (tp) {
    tp.addEventListener("change", (ev) => {
      mockChat.updateSettings({ persistHistory: !!ev.target.checked });
    });
  }
}

function bindInAppSettings(root) {
  root.onclick = (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === "close-settings-sheet") {
      location.hash = "#/chat";
      return;
    }
    if (action === "back-inapp-main") {
      ui.inappSettingsPage = "main";
      mount();
      return;
    }
    if (action === "open-security-page") {
      ui.inappSettingsPage = "security";
      mount();
      return;
    }
    if (action === "settings-row") {
      handleSettingsRow(btn.dataset.settings);
    }
  };
}

async function playReplyPlan(response) {
  const token = `reply_${Date.now()}`;
  const sessionId = response.sessionId;
  replyToken = token;

  const typingMessage = mockChat.createTypingMessage(sessionId);
  const pendingMessages = [...mockChat.getMessages(sessionId), typingMessage];
  ui.messages = pendingMessages;
  ui.isResponding = true;
  mount();
  scrollToLatest(pendingMessages, `msg-${typingMessage.id}`);

  await delay(response.plan.thinkingDelay);
  if (replyToken !== token) return;

  for (const segment of response.plan.segments) {
    if (replyToken !== token) return;

    if (segment.type === "text") {
      await playStreamingTextSegment(sessionId, segment, token);
      continue;
    }

    ui.messages = mockChat.getMessages(sessionId);
    mount();
    scrollToLatest(mockChat.getMessages(sessionId));
    await delay(segment.type === "image-card" ? 220 : 160);
    if (replyToken !== token) return;

    mockChat.commitAssistantSegment({ segment, sessionId });
    syncSession(sessionId);
    mount();
  }

  if (replyToken === token) {
    replyToken = "";
    ui.isResponding = false;
    syncSession(sessionId);
    mount();
  }
}

async function playStreamingTextSegment(sessionId, segment, token) {
  const liveMessage = mockChat.createStreamingMessage(sessionId);
  const fullText = segment.content || "";
  const chunkSize = fullText.length > 80 ? 3 : 2;

  ui.messages = [...mockChat.getMessages(sessionId), liveMessage];
  mount();
  scrollToLatest([...mockChat.getMessages(sessionId), liveMessage], `msg-${liveMessage.id}`);

  for (let cursor = 0; cursor < fullText.length; cursor += chunkSize) {
    if (replyToken !== token) return;
    liveMessage.content = fullText.slice(0, cursor + chunkSize);
    ui.messages = [...mockChat.getMessages(sessionId), liveMessage];
    mount();
    scrollToLatest([...mockChat.getMessages(sessionId), liveMessage], `msg-${liveMessage.id}`);
    await delay(ui.settings.typingSpeed);
  }

  if (replyToken !== token) return;

  mockChat.commitAssistantSegment({
    segment: { content: fullText, type: "text" },
    sessionId,
  });
  syncSession(sessionId);
  mount();
}

function switchMode(modeId) {
  const target = MODE_CONFIG[modeId];
  if (!target || ui.isResponding) return;
  mockChat.updateSessionModel(ui.activeSessionId, target.modelId);
  syncSession(ui.activeSessionId);
  mount();
}

function bindChat(root) {
  let suppressPickSessionId = "";
  let sessionPressTimer = null;
  let sessionPressTriggered = false;
  let syncingKeyboardFocus = false;

  const hideMockKeyboard = () => {
    if (!ui.keyboardVisible) {
      return;
    }
    ui.keyboardVisible = false;
    const active = document.activeElement;
    if (active && typeof active.blur === "function") {
      active.blur();
    }
    mount();
  };

  const showMockKeyboard = () => {
    if (ui.keyboardVisible || ui.isResponding) {
      return;
    }
    ui.keyboardVisible = true;
    mount();
    const next = document.getElementById("chat-draft");
    if (!next) {
      return;
    }
    syncingKeyboardFocus = true;
    next.focus();
    const length = next.value.length;
    if (typeof next.setSelectionRange === "function") {
      next.setSelectionRange(length, length);
    }
    requestAnimationFrame(() => {
      syncingKeyboardFocus = false;
    });
  };

  const clearSessionPress = () => {
    if (sessionPressTimer) {
      clearTimeout(sessionPressTimer);
      sessionPressTimer = null;
    }
  };

  const openSessionManageSheet = (sessionId) => {
    if (!sessionId) {
      return;
    }
    sessionPressTriggered = true;
    suppressPickSessionId = sessionId;
    ui.commonSheetContext = "session-manage";
    ui.commonSheetSessionId = sessionId;
    ui.commonSheetOptions = SESSION_ACTION_OPTIONS;
    ui.commonSheetCancelText = "取消";
    ui.commonSheetVisible = true;
    mount();
  };

  const ta = root.querySelector("#chat-draft");
  const attachImageInput = root.querySelector("#attach-image-input");
  if (attachImageInput) {
    attachImageInput.addEventListener("change", () => {
      const file = attachImageInput.files && attachImageInput.files[0];
      if (!file) {
        return;
      }
      if (!file.type || !file.type.startsWith("image/")) {
        showToast("仅支持选择图片");
        attachImageInput.value = "";
        return;
      }
      showToast(`已选择图片：${file.name}`);
      attachImageInput.value = "";
    });
  }

  if (ta) {
    ta.addEventListener("focus", () => {
      if (syncingKeyboardFocus) {
        return;
      }
      showMockKeyboard();
    });
    ta.addEventListener("input", () => {
      ui.draft = ta.value;
      const sendBtn = root.querySelector('[data-action="send"]');
      if (sendBtn) {
        const can = ui.draft.trim().length > 0;
        sendBtn.className =
          "input-circle-btn input-circle-send" + (can && !ui.isResponding ? " input-circle-send-active" : "");
        sendBtn.innerHTML =
          can && !ui.isResponding
            ? `<img class="send-plane-icon" src="${ICON}/send-plane-light.svg" alt="" />`
            : ui.isResponding
              ? `<span class="send-loading">…</span>`
              : `<img class="send-plane-icon" src="${ICON}/send-plane.svg" alt="" />`;
      }
    });
    ta.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        doSend();
      }
    });
  }

  const holdBtn = root.querySelector("#voice-hold-btn");
  if (holdBtn) {
    let holdRect = null;
    let pointerActive = false;

    const syncVoiceHoldVisual = () => {
      const current = root.querySelector("#voice-hold-btn");
      if (!current) {
        return;
      }
      current.classList.toggle("voice-hold-btn-recording", !!ui.voicePressActive);
      current.classList.toggle("voice-hold-btn-cancel", !!ui.voicePressCancel);
      const textNode = current.querySelector(".voice-hold-text");
      if (textNode) {
        textNode.textContent = ui.voicePressCancel ? "松手 取消" : "按住 说话";
      }
      const panel = root.querySelector(".voice-record-panel");
      if (panel) {
        panel.classList.toggle("voice-record-panel-active", !!ui.voicePressActive);
      }
    };

    const getClientPoint = (event) => {
      if (event.touches && event.touches[0]) {
        return {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
      }
      if (event.changedTouches && event.changedTouches[0]) {
        return {
          x: event.changedTouches[0].clientX,
          y: event.changedTouches[0].clientY,
        };
      }
      return {
        x: event.clientX,
        y: event.clientY,
      };
    };

    const finishVoicePress = () => {
      if (!pointerActive) {
        return;
      }
      pointerActive = false;
      const shouldCancel = ui.voicePressCancel;
      ui.voicePressActive = false;
      ui.voicePressCancel = false;
      syncVoiceHoldVisual();
      showToast(shouldCancel ? "松手取消" : "语音输入仅做演示");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
      window.removeEventListener("touchcancel", handlePointerUp);
    };

    const handlePointerMove = (event) => {
      if (!pointerActive || !holdRect) {
        return;
      }
      const point = getClientPoint(event);
      const outside =
        point.x < holdRect.left ||
        point.x > holdRect.right ||
        point.y < holdRect.top ||
        point.y > holdRect.bottom;
      if (outside !== ui.voicePressCancel) {
        ui.voicePressCancel = outside;
        syncVoiceHoldVisual();
      }
    };

    const handlePointerUp = () => {
      finishVoicePress();
    };

    const startVoicePress = (event) => {
      if (event.target.closest(".voice-hold-leading")) {
        event.preventDefault();
        ui.voiceMode = false;
        ui.voicePressActive = false;
        ui.voicePressCancel = false;
        mount();
        return;
      }
      event.preventDefault();
      holdRect = holdBtn.getBoundingClientRect();
      pointerActive = true;
      ui.voicePressActive = true;
      ui.voicePressCancel = false;
      syncVoiceHoldVisual();
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
      window.addEventListener("mousemove", handlePointerMove);
      window.addEventListener("mouseup", handlePointerUp);
      window.addEventListener("touchmove", handlePointerMove, { passive: false });
      window.addEventListener("touchend", handlePointerUp);
      window.addEventListener("touchcancel", handlePointerUp);
    };

    holdBtn.addEventListener("pointerdown", startVoicePress);
    holdBtn.addEventListener("mousedown", startVoicePress);
    holdBtn.addEventListener("touchstart", startVoicePress, { passive: false });
  }

  const chatScroll = root.querySelector(".chat-scroll");
  const chatIndicator = root.querySelector(".chat-scroll-indicator");
  if (chatScroll && chatIndicator) {
    let chatScrollHideTimer;
    const updateChatIndicator = () => {
      const scrollable = chatScroll.scrollHeight - chatScroll.clientHeight;
      if (scrollable <= 0) {
        chatIndicator.style.transform = "translateY(0)";
        return;
      }
      const maxTravel = Math.max(chatScroll.clientHeight - chatIndicator.offsetHeight - 4, 0);
      const progress = Math.min(Math.max(chatScroll.scrollTop / scrollable, 0), 1);
      chatIndicator.style.transform = `translateY(${Math.round(maxTravel * progress)}px)`;
    };
    const markChatScrolling = () => {
      updateChatIndicator();
      chatScroll.classList.add("chat-scroll-scrolling");
      clearTimeout(chatScrollHideTimer);
      chatScrollHideTimer = setTimeout(() => {
        chatScroll.classList.remove("chat-scroll-scrolling");
      }, 560);
    };
    updateChatIndicator();
    chatScroll.addEventListener("scroll", markChatScrolling, { passive: true });
    window.addEventListener("resize", updateChatIndicator);
  }

  const drawerList = root.querySelector(".drawer-list");
  const drawerIndicator = root.querySelector(".drawer-list .drawer-scroll-indicator");
  if (drawerList) {
    let scrollHideTimer;
    const updateDrawerIndicator = () => {
      if (!drawerIndicator) {
        return;
      }
      const scrollable = drawerList.scrollHeight - drawerList.clientHeight;
      if (scrollable <= 0) {
        drawerIndicator.style.transform = "translateY(0)";
        return;
      }
      const maxTravel = Math.max(drawerList.clientHeight - drawerIndicator.offsetHeight - 4, 0);
      const progress = Math.min(Math.max(drawerList.scrollTop / scrollable, 0), 1);
      drawerIndicator.style.transform = `translateY(${Math.round(maxTravel * progress)}px)`;
    };
    const markScrolling = () => {
      updateDrawerIndicator();
      drawerList.classList.add("drawer-list-scrolling");
      clearTimeout(scrollHideTimer);
      scrollHideTimer = setTimeout(() => {
        drawerList.classList.remove("drawer-list-scrolling");
      }, 560);
    };
    updateDrawerIndicator();
    drawerList.addEventListener("scroll", markScrolling, { passive: true });
    window.addEventListener("resize", updateDrawerIndicator);
  }

  root.addEventListener("pointerdown", (event) => {
    if (
      ui.keyboardVisible &&
      !event.target.closest(".chat-input") &&
      !event.target.closest(".mock-ime-panel") &&
      !event.target.closest("[data-action]")
    ) {
      hideMockKeyboard();
      return;
    }

    const historyItem = event.target.closest('[data-action="pick-session"]');
    if (!historyItem) {
      return;
    }
    clearSessionPress();
    sessionPressTriggered = false;
    const sessionId = historyItem.dataset.sessionId;
    sessionPressTimer = setTimeout(() => {
      sessionPressTimer = null;
      openSessionManageSheet(sessionId);
    }, 460);
  });

  const cancelSessionPress = () => {
    clearSessionPress();
    if (!sessionPressTriggered) {
      return;
    }
    sessionPressTriggered = false;
  };
  root.addEventListener("pointerup", cancelSessionPress);
  root.addEventListener("pointercancel", cancelSessionPress);
  root.addEventListener("pointermove", (event) => {
    if (!sessionPressTimer) {
      return;
    }
    if (Math.abs(event.movementX) > 2 || Math.abs(event.movementY) > 2) {
      clearSessionPress();
    }
  });

  const renameInput = root.querySelector("#rename-session-input");
  if (renameInput) {
    renameInput.addEventListener("input", () => {
      ui.renameDialogValue = renameInput.value || "";
    });
  }

  root.onclick = async (e) => {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const action = t.dataset.action;

    if (action === "open-drawer") {
      if (ui.isResponding) {
        showBusyToast();
        return;
      }
      ui.showCapsuleMenu = false;
      ui.commonSheetVisible = false;
      ui.keyboardVisible = false;
      ui.showDrawer = true;
      ui.showSettingsSheet = false;
      mount();
      return;
    }
    if (action === "close-drawer") {
      ui.showCapsuleMenu = false;
      ui.commonSheetVisible = false;
      ui.keyboardVisible = false;
      ui.showDrawer = false;
      mount();
      return;
    }
    if (action === "toggle-capsule-menu") {
      ui.showCapsuleMenu = true;
      ui.commonSheetVisible = false;
      ui.commonSheetContext = "";
      ui.commonSheetSessionId = "";
      ui.keyboardVisible = false;
      ui.showDrawer = false;
      ui.showSettingsSheet = false;
      mount();
      return;
    }
    if (action === "close-capsule-menu" || action === "close-capsule-popup") {
      ui.showCapsuleMenu = false;
      ui.keyboardVisible = false;
      mount();
      return;
    }
    if (action === "close-common-sheet") {
      ui.commonSheetVisible = false;
      ui.commonSheetContext = "";
      ui.commonSheetSessionId = "";
      ui.keyboardVisible = false;
      suppressPickSessionId = "";
      mount();
      return;
    }
    if (action === "close-rename-dialog") {
      ui.renameDialogVisible = false;
      ui.renameDialogSessionId = "";
      ui.renameDialogValue = "";
      ui.keyboardVisible = false;
      mount();
      return;
    }
    if (action === "open-source-sheet") {
      ui.keyboardVisible = false;
      ui.sourceSheetTitle = "参考来源";
      ui.sourceSheetLinks = MOCK_SOURCE_LINKS;
      ui.sourceSheetVisible = true;
      mount();
      return;
    }
    if (action === "close-source-sheet") {
      ui.sourceSheetVisible = false;
      mount();
      return;
    }
    if (action === "copy-source-link") {
      const url = t.dataset.url || "";
      if (!url) {
        showToast("链接不存在");
        return;
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          const tmp = document.createElement("textarea");
          tmp.value = url;
          document.body.appendChild(tmp);
          tmp.select();
          document.execCommand("copy");
          tmp.remove();
        }
        showToast("已复制链接");
      } catch (error) {
        showToast("复制失败，请手动复制");
      }
      return;
    }
    if (action === "confirm-rename-dialog") {
      const targetSessionId = ui.renameDialogSessionId;
      const nextTitle = ui.renameDialogValue;
      ui.renameDialogVisible = false;
      ui.renameDialogSessionId = "";
      ui.renameDialogValue = "";
      ui.keyboardVisible = false;
      if (!targetSessionId) {
        mount();
        return;
      }
      const renamed = mockChat.renameSession(targetSessionId, nextTitle);
      syncSession((renamed && renamed.id) || ui.activeSessionId);
      mount();
      showToast(renamed ? "已重命名" : "名称不能为空");
      return;
    }
    if (action === "common-sheet-option") {
      const key = t.dataset.key || "";
      const label = t.dataset.label || "该选项";
      if (ui.commonSheetContext === "session-manage") {
        const targetSessionId = ui.commonSheetSessionId;
        ui.commonSheetVisible = false;
        ui.commonSheetContext = "";
        ui.commonSheetSessionId = "";
        ui.keyboardVisible = false;
        suppressPickSessionId = "";
        if (!targetSessionId) {
          mount();
          return;
        }
        if (key === "rename-session") {
          const session = mockChat.getSessions().find((item) => item.id === targetSessionId);
          mount();
          setTimeout(() => {
            ui.renameDialogSessionId = targetSessionId;
            ui.renameDialogValue = (session && session.title) || "";
            ui.renameDialogVisible = true;
            mount();
            const input = document.getElementById("rename-session-input");
            if (input) {
              input.focus();
              input.select();
            }
          }, 180);
          return;
        }
        if (key === "delete-session") {
          mockChat.deleteSession(targetSessionId);
          ui.draft = "";
          syncSession();
          mount();
          showToast("已删除");
          return;
        }
        mount();
        return;
      }
      ui.commonSheetVisible = false;
      ui.commonSheetContext = "";
      ui.commonSheetSessionId = "";
      ui.keyboardVisible = false;
      suppressPickSessionId = "";
      mount();
      showToast(`${label}仅做演示`);
      return;
    }
    if (action === "capsule-popup-item") {
      const key = t.dataset.key || "";
      const label = t.dataset.label || "该操作";
      ui.showCapsuleMenu = false;
      if (key === "capsule-settings") {
        ui.showDrawer = false;
        ui.inappSettingsPage = "main";
        mount();
        location.hash = "#/app-settings";
        return;
      }
      if (key === "capsule-forward-disabled") {
        mount();
        showToast("当前页面不可转发");
        return;
      }
      if (key === "capsule-share-disabled") {
        mount();
        showToast("当前页面不可分享");
        return;
      }
      mount();
      showToast(`${label}仅做演示`);
      return;
    }
    if (action === "toggle-rich-fold") {
      const messageId = t.dataset.messageId;
      if (!messageId) {
        return;
      }
      ui.richFoldState = {
        ...ui.richFoldState,
        [messageId]: !ui.richFoldState[messageId],
      };
      mount();
      return;
    }
    if (action === "close-mini-program") {
      ui.showCapsuleMenu = false;
      ui.keyboardVisible = false;
      showToast("Web Demo 预览壳不支持直接关闭");
      mount();
      return;
    }
    if (action === "new-session") {
      if (ui.isResponding) {
        showBusyToast();
        return;
      }
      const createdSession = mockChat.createSession();
      mockChat.commitAssistantSegment({
        sessionId: createdSession && createdSession.id,
        segment: {
          type: "text",
          content: "已经帮你开启新对话了，现在输入新的问题吧~",
        },
      });
      ui.draft = "";
      ui.showCapsuleMenu = false;
      ui.keyboardVisible = false;
      ui.showDrawer = false;
      ui.showSettingsSheet = false;
      syncSession(createdSession && createdSession.id);
      mount();
      return;
    }
    if (action === "pick-session") {
      if (suppressPickSessionId && suppressPickSessionId === t.dataset.sessionId) {
        suppressPickSessionId = "";
        return;
      }
      if (ui.isResponding) {
        showBusyToast();
        return;
      }
      mockChat.activateSession(t.dataset.sessionId);
      ui.draft = "";
      ui.showCapsuleMenu = false;
      ui.showDrawer = false;
      syncSession(t.dataset.sessionId);
      mount();
      return;
    }
    if (action === "open-settings-sheet") {
      ui.showCapsuleMenu = false;
      ui.keyboardVisible = false;
      ui.showDrawer = false;
      ui.inappSettingsPage = "main";
      location.hash = "#/app-settings";
      return;
    }
    if (action === "goto-full-settings") {
      ui.showCapsuleMenu = false;
      ui.keyboardVisible = false;
      ui.showSettingsSheet = false;
      location.hash = "#/settings";
      return;
    }
    if (action === "mode") {
      const modeId = t.dataset.mode;
      if (modeId && modeId !== ui.activeMode) switchMode(modeId);
      ui.keyboardVisible = false;
      mount();
      return;
    }
    if (action === "stub") {
      const kind = t.dataset.kind;
      if (kind === "legal" || kind === "web" || kind === "academic" || kind === "knowledge") {
        const nextEnabled = !ui.searchToggles[kind];
        ui.searchToggles = {
          ...ui.searchToggles,
          [kind]: nextEnabled,
        };
        const labels = {
          legal: "法律搜索",
          web: "联网搜索",
          academic: "学术搜索",
          knowledge: "知识库搜索",
        };
        showToast(`${labels[kind]}已${nextEnabled ? "开启" : "关闭"}`);
        mount();
        return;
      }

      const stubTitles = {
        thinking: "深度思考已开启",
        voice: "语音输入模式已开启",
      };
      if (stubTitles[kind]) {
        if (kind === "voice") {
          ui.voiceMode = true;
          ui.voicePressActive = false;
          ui.voicePressCancel = false;
          mount();
          return;
        }
        showToast(stubTitles[kind]);
        return;
      }
      if (kind === "attach") {
        const picker = root.querySelector("#attach-image-input");
        if (!picker) {
          showToast("未找到图片选择器");
          return;
        }
        picker.value = "";
        picker.click();
        return;
      }
      showToast("功能仅做演示");
      return;
    }
    if (action === "voice-exit") {
      ui.voiceMode = false;
      ui.voicePressActive = false;
      ui.voicePressCancel = false;
      ui.keyboardVisible = false;
      mount();
      return;
    }
    if (action === "toggle-voice-to-text") {
      ui.voiceToTextActive = !ui.voiceToTextActive;
      showToast(ui.voiceToTextActive ? "语音转文字已开启（演示）" : "语音转文字已关闭");
      mount();
      return;
    }
    if (action === "send") {
      await doSend();
      return;
    }
    if (action === "toggle-login-agreement") {
      ui.loginAgreementAccepted = !ui.loginAgreementAccepted;
      mount();
      return;
    }
    if (action === "login-code") {
      showToast("验证码登录暂未接入");
      return;
    }
    if (action === "login-password") {
      showToast("密码登录暂未接入");
      return;
    }
    if (action === "settings-row") {
      handleSettingsRow(t.dataset.settings);
    }
  };
}

async function doSend() {
  if (ui.isResponding) return;
  const ta = document.getElementById("chat-draft");
  const content = `${(ta && ta.value) || ui.draft || ""}`.trim();
  if (!content) return;

  const response = mockChat.sendMessage({ content, sessionId: ui.activeSessionId });
  if (!response) return;

  ui.draft = "";
  ui.isResponding = true;
  ui.showCapsuleMenu = false;
  ui.showDrawer = false;
  ui.showSettingsSheet = false;
  ui.showWelcome = false;
  syncSession(response.sessionId);
  mount();

  try {
    await playReplyPlan(response);
  } finally {
    if (!replyToken) {
      ui.isResponding = false;
      mount();
    }
  }
}

function handleSettingsRow(key) {
  if (key === "mock-login") {
    if (!ui.loginAgreementAccepted) {
      showToast("请先勾选用户协议与隐私政策");
      return;
    }
    mockChat.updateSettings({ loggedIn: true });
    ui.isLoggedIn = true;
    ui.draft = "";
    ui.showWelcome = true;
    if (ui.messages && ui.messages.length > 0) {
      const freshSession = mockChat.createSession();
      syncSession(freshSession && freshSession.id);
    }
    showToast("已登录（Mock）");
    mount();
    return;
  }
  if (key === "user-agreement") {
    showToast("用户协议页面未接入，当前为演示");
    return;
  }
  if (key === "privacy-policy") {
    showToast("隐私政策页面未接入，当前为演示");
    return;
  }
  if (key === "contact") {
    showToast("联系我们功能未接入");
    return;
  }
  if (key === "delete-account") {
    showToast("删除账户仅做静态展示");
    return;
  }
  if (key === "language") {
    showToast("当前仅提供简体中文");
    return;
  }
  if (key === "appearance") {
    showToast("外观跟随系统，仅做演示");
    return;
  }
  if (key === "account") {
    showToast("未接入真实账号系统");
    return;
  }
  if (key === "data") {
    if (confirm("清空本地会话和演示数据？")) {
      mockChat.clearAll();
      ui.showSettingsSheet = false;
      refreshFromService(true);
      mount();
    }
    return;
  }
  if (key === "update") {
    showToast("当前已是最新版本");
    return;
  }
  if (key === "agreement") {
    showToast("服务协议仅做静态展示");
    return;
  }
  if (key === "help") {
    showToast("帮助与反馈未接入");
    return;
  }
  if (key === "logout") {
    mockChat.updateSettings({ loggedIn: false });
    ui.isLoggedIn = false;
    ui.inappSettingsPage = "main";
    ui.draft = "";
    ui.showDrawer = false;
    ui.showSettingsSheet = false;
    ui.keyboardVisible = false;
    ui.showWelcome = true;
    const freshSession = mockChat.createSession();
    syncSession(freshSession && freshSession.id);
    showToast("已退出登录（Mock）");
    location.hash = "#/chat";
    mount();
  }
}

function initLayout() {
  const w = document.querySelector(".device-screen")?.clientWidth || 390;
  ui.capsuleHeight = Math.round(w * 0.074);
  ui.capsuleWidth = Math.round(ui.capsuleHeight * 2.08);
  ui.capsuleRight = Math.max(Math.round(w * 0.033), 12);
  ui.headerEdgePadding = Math.max(Math.round(w * 0.033), 12);
  ui.titleSafeLeft = Math.round(ui.headerEdgePadding + ui.capsuleHeight * 2 + w * 0.036 + 12);
  ui.titleSafeRight = Math.round(ui.capsuleRight + ui.capsuleWidth + 12);
  ui.headerSafeHeight = 50;
  ui.navBarHeight = Math.round(ui.capsuleHeight + 10);
  ui.headerPadTop = ui.headerSafeHeight + Math.round((ui.navBarHeight - ui.capsuleHeight) / 2);
  ui.capsuleMenuTop = ui.headerSafeHeight + ui.navBarHeight + 8;
}

function tickClock() {
  const el = document.getElementById("device-time");
  if (!el) return;
  const d = new Date();
  el.textContent = `${d.getHours()}:${`${d.getMinutes()}`.padStart(2, "0")}`;
}

function init() {
  mockChat.bootstrap(true);
  mockChat.updateSettings({ loggedIn: false, showWelcome: true });
  refreshFromService(false);
  ui.draft = "";
  initLayout();
  window.addEventListener("resize", () => {
    initLayout();
    mount();
  });
  window.addEventListener("hashchange", () => mount());
  tickClock();
  setInterval(tickClock, 30_000);
  mount();
}

init();
