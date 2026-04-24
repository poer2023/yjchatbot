import * as storage from "./storage.js?v=20260424-chat-48";
import { defaultModelId, getModel, models } from "./models.js";
import { createId } from "./id.js";
import { clamp, deepClone, truncateText } from "./helpers.js";

const DEFAULT_SETTINGS = {
  defaultModelId,
  loggedIn: false,
  persistHistory: true,
  showWelcome: true,
  theme: "light",
  typingSpeed: 28,
};

const DEFAULT_SESSION_TITLE = "新的对话";
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFENSE_SESSION_TITLE = "什么叫正当防卫";
const DEFENSE_SESSION_PREVIEW = "正当防卫是为了制止正在发生的不法侵害而采取的必要防卫行为。";
const LEGAL_SESSION_TITLE = "诈骗案怎么判刑";
const LEGAL_SESSION_PREVIEW = "您刚才提到当事人被羁押了，我需要确认具体是在哪个看守所。";
const GEO_SESSION_TITLE = "美国与伊朗要打仗么？";
const GEO_SESSION_PREVIEW = "短期内全面战争概率较低但误判风险极高。";

let state = null;

function createAssistantSnapshot(modelId) {
  const model = getModel(modelId);
  return {
    accent: model.accent,
    avatarStyle: `background: ${model.badgeGradient}; color: #ffffff;`,
    avatarText: model.shortName,
    modelId: model.id,
    modelName: model.name,
  };
}

function buildMessage(payload) {
  return {
    content: "",
    createdAt: Date.now(),
    extra: {},
    id: createId("msg"),
    role: "assistant",
    sessionId: "",
    status: "done",
    type: "text",
    ...payload,
  };
}

function buildUserMessage(sessionId, content) {
  return buildMessage({
    content,
    extra: {
      authorLabel: "你",
    },
    role: "user",
    sessionId,
    type: "text",
  });
}

function buildAssistantMessage(sessionId, type, content, extra) {
  return buildMessage({
    content,
    extra,
    role: "assistant",
    sessionId,
    type,
  });
}

function buildImageCard(overrides) {
  return {
    actionLabel: "Open concept",
    accentEnd: "#245f8f",
    accentStart: "#d8f0e7",
    badge: "Preview",
    description: "",
    eyebrow: "Demo block",
    metric: "Demo",
    title: "",
    ...overrides,
  };
}

function buildHistorySeedSessions(now, fallbackModelId) {
  const templates = [
    { daysAgo: 1, modelId: "chatgpt", previewText: "落地页开场文案再收一版。", title: "首页首屏文案草案" },
    { daysAgo: 2, modelId: "claude", previewText: "把侧栏分组标题再做弱化。", title: "侧栏分组视觉优化" },
    { daysAgo: 4, modelId: "deepseek", previewText: "补齐对齐规则并锁定偏移。", title: "抽屉布局对齐检查" },
    { daysAgo: 9, modelId: "chatgpt", previewText: "欢迎态示例问题再筛选。", title: "欢迎态问题池" },
    { daysAgo: 13, modelId: "claude", previewText: "聊天气泡的色板统一到中性。", title: "消息气泡视觉统一" },
    { daysAgo: 19, modelId: "deepseek", previewText: "把组件拆分边界再梳理一遍。", title: "组件拆分建议" },
    { daysAgo: 28, modelId: "chatgpt", previewText: "语音按住交互细节复盘。", title: "语音输入交互修订" },
    { daysAgo: 36, modelId: "claude", previewText: "mock 数据改为可复用模版。", title: "数据模版整理" },
    { daysAgo: 44, modelId: "deepseek", previewText: "接口字段映射先跑通一版。", title: "接口字段映射" },
    { daysAgo: 58, modelId: "chatgpt", previewText: "设置页信息架构微调。", title: "设置页结构重排" },
    { daysAgo: 73, modelId: "claude", previewText: "消息列表滚动行为验证。", title: "长会话滚动测试" },
    { daysAgo: 91, modelId: "deepseek", previewText: "录屏展示路径再简化。", title: "录屏脚本清单" },
    { daysAgo: 112, modelId: "chatgpt", previewText: "历史数据默认填充策略。", title: "历史记录填充方案" },
    { daysAgo: 138, modelId: "claude", previewText: "标题自动截断规则微调。", title: "标题截断规则" },
  ];

  return templates.map((template) => ({
    id: createId("session"),
    modelId: template.modelId || fallbackModelId,
    previewText: template.previewText,
    title: template.title,
    updatedAt: now - template.daysAgo * DAY_MS,
  }));
}

function ensureMockHistoryDensity() {
  const minimumSessions = 14;
  if (!state || (state.sessions || []).length >= minimumSessions) {
    return;
  }

  const now = Date.now();
  const existingTitles = new Set((state.sessions || []).map((session) => session.title));
  const seedSessions = buildHistorySeedSessions(now, state.settings.defaultModelId);

  seedSessions.forEach((session) => {
    if ((state.sessions || []).length >= minimumSessions) {
      return;
    }
    if (existingTitles.has(session.title)) {
      return;
    }
    state.sessions.push(session);
    state.messagesBySession[session.id] = state.messagesBySession[session.id] || [];
    existingTitles.add(session.title);
  });

  sortSessions();
}

function buildLegalSessionMessages(sessionId) {
  return [
    buildUserMessage(sessionId, "诈骗案怎么判刑"),
    buildAssistantMessage(
      sessionId,
      "text",
      "您好，我是执业律师，专门处理刑事辩护案件。您提到诈骗案，为了给您准确的法律建议，我需要先了解几个关键信息：1）您本人与当事人是什么关系？（比如是家属、朋友还是当事人本人）2）当事人目前是否已经被公安机关采取强制措施？比如被拘留或逮捕？3）您希望我帮您解决什么问题？是想了解量刑标准、争取取保候审，还是其他？",
      createAssistantSnapshot("deepseek")
    ),
    buildUserMessage(sessionId, "亲属"),
    buildAssistantMessage(
      sessionId,
      "text",
      "感谢您的说明。作为亲属，您希望我协助处理哪位当事人的刑事案件？请您先告诉我：当事人涉嫌的罪名是什么？案件目前处于侦查、审查起诉还是审判阶段？以及当事人是否被羁押？这些信息将决定我们下一步的法律策略。",
      createAssistantSnapshot("deepseek")
    ),
    buildUserMessage(sessionId, "涉嫌诈骗"),
    buildAssistantMessage(
      sessionId,
      "text",
      "您刚才提到当事人涉嫌诈骗，我需要确认几个关键点：1）案件目前处于哪个阶段？（侦查、审查起诉还是审判）2）当事人是否被羁押？如果羁押，是在哪个看守所？3）您希望获得什么帮助？比如争取取保候审、减轻处罚，还是其他？",
      createAssistantSnapshot("deepseek")
    ),
    buildUserMessage(sessionId, "羁押了"),
    buildAssistantMessage(
      sessionId,
      "text",
      "您刚才提到当事人被羁押了，我需要确认具体是在哪个看守所？此外，案件目前处于侦查、审查起诉还是审判阶段？以及您希望我们协助争取取保候审、争取轻判，还是其他具体目标？",
      createAssistantSnapshot("deepseek")
    ),
    buildUserMessage(sessionId, "将以上内容生成 pdf 文档"),
    buildAssistantMessage(
      sessionId,
      "file-card",
      "诈骗案咨询纪要（PDF）",
      {
        ...createAssistantSnapshot("deepseek"),
        file: {
          description: "未下载",
          fileName: "诈骗案咨询纪要.pdf",
          fileSize: "242 KB",
        },
      }
    ),
  ];
}

function buildDefenseSessionMessages(sessionId) {
  const sources = [
    {
      id: "src-defense-1",
      title: "中华人民共和国刑法第二十条",
      url: "https://flk.npc.gov.cn/detail2.html?ZmY4MDgxODE3OTZhNjM2YjAxNzk3MjhlYjUxNzA4Y2Y",
    },
    {
      id: "src-defense-2",
      title: "最高人民法院、最高人民检察院、公安部关于依法适用正当防卫制度的指导意见",
      url: "https://www.court.gov.cn/zixun/xiangqing/248421.html",
    },
    {
      id: "src-defense-3",
      title: "最高人民检察院：依法准确把握正当防卫界限",
      url: "https://www.spp.gov.cn/spp/zdgz/202009/t20200903_478483.shtml",
    },
  ];

  return [
    buildUserMessage(sessionId, "什么叫正当防卫"),
    buildAssistantMessage(
      sessionId,
      "text",
      [
        "正当防卫，是指为了制止正在进行的不法侵害，对不法侵害人采取的必要制止行为；只要没有明显超过必要限度造成重大损害，一般不负刑事责任。[1]",
        "",
        "通俗一点说，必须同时满足几个关键条件：一是确实存在现实且正在发生的不法侵害；二是防卫对象必须是不法侵害人本人；三是防卫行为要服务于制止侵害，而不是事后报复；四是防卫强度原则上不能明显失衡。[1][2]",
        "",
        "如果面对的是严重危及人身安全的暴力犯罪，例如行凶、杀人、抢劫、强奸、绑架等，法律对防卫人的保护会更强，只要是为了制止这类侵害，即使造成侵害人伤亡，也可能依法认定为正当防卫。[1][2][3]",
      ].join("\n"),
      {
        ...createAssistantSnapshot("deepseek"),
        sourceSheetTitle: "参考来源",
        sources,
        showSourceTrigger: true,
      }
    ),
  ];
}

function hasLegalPdfRound(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const hasUserPrompt = list.some(
    (message) => message && message.role === "user" && message.content === "将以上内容生成 pdf 文档"
  );
  const hasPdfCard = list.some((message) => message && message.type === "file-card");
  return hasUserPrompt && hasPdfCard;
}

function buildGeoSessionMessages(sessionId) {
  return [
    buildUserMessage(sessionId, "美国与伊朗要打仗么？"),
    buildAssistantMessage(
      sessionId,
      "rich",
      [
        "已完成回答 ▼",
        "",
        "- 关于美国与伊朗是否将发生战争的问题，需要从多方信源了解最新动态、官方表态、军事动向及国际分析。将综合评估当前局势的时间线、关键事件、各方立场与潜在风险，避免依赖单一说法。",
        "",
        "参考来源 ›",
        "",
        "联网搜索 `美国 伊朗 战争 最新消息 官方声明`  ",
        "已搜索到20篇联网资料",
        "",
        "联网搜索 `美国 伊朗 军事对峙 时间线 近期事件`  ",
        "已搜索到20篇联网资料",
        "",
        "联网搜索 `美国 伊朗 冲突 国际反应 舆论分析`  ",
        "已搜索到20篇联网资料",
        "",
        "- 已进行三轮检索，获取了美伊冲突的军事对峙、官方声明及国际反应等多角度信息，核心事件时间线和各方立场已清晰。虽有部分细节未完全交叉验证，但关键事实已有多个独立来源支持，继续检索后信息增量有限。",
        "- 正在整理搜索到的参考资料。在对上述资料进行分析筛选后，我挑选出了与问题最相关的43条重要参考来源。下面我就结合这些内容，来正式回答用户的问题。",
        "",
        "用户问的是：美国与伊朗要打仗么？这是一个关于美伊关系是否会升级为全面战争的问题。",
        "",
        "我需要使用“事件分析”技能来回答这个问题。这个技能要求我：",
        "",
        "1. 提供一句话结论",
        "2. 事件时间线",
        "3. 已确认事实",
        "4. 关键争议与多方视角",
        "5. 影响评估",
        "6. 不确定性与待核查清单",
        "7. 给用户的行动建议",
        "",
        "让我分析搜索结果。搜索关键词包括“美国 伊朗 战争”、“美伊关系 军事冲突”、“美国 伊朗 最新局势”。搜索结果提供了大量关于2025年6月美国对伊朗核设施袭击事件的信息。",
        "",
        "关键信息点：",
        "",
        "- 2025年6月21日，美国袭击了伊朗三处核设施（福尔多、纳坦兹、伊斯法罕）",
        "- 行动代号“午夜之锤”",
        "- 使用了B-2隐形轰炸机、掩体炸弹和战斧导弹",
        "- 伊朗声称已提前疏散，损失不大",
        "- 伊朗随后对美军驻卡塔尔基地发动导弹袭击",
        "- 特朗普声称已“完全摧毁”三处设施，伊朗外长称福尔多设施“严重受损”",
        "- 国际社会广泛谴责",
        "- 目前局势高度紧张，但未升级为全面战争",
        "",
        "从搜索结果看，这似乎是一个假设性的未来事件（2025年），但用户的问题是关于当前现实。我需要谨慎处理时效问题。搜索结果中的日期是2025年，这显然是预测性或虚构内容。我应该基于这些材料分析，但要明确标注这是基于特定资料来源的分析。",
        "",
        "让我按照技能要求的格式组织答案：",
        "",
        "1. 一句话结论：基于当前信息，美伊已发生直接军事打击但尚未进入全面战争状态，双方处于“打击-报复-对峙”的高风险螺旋中，短期内全面战争概率较低但误判风险极高。",
        "",
        "2. 事件时间线：需要整理从6月21日美国袭击到后续反应的时间线。",
        "",
        "3. 已确认事实：双方军事行动、声明、国际反应等。",
        "",
        "4. 关键争议：袭击效果评估、伊朗核材料是否被摧毁、各方真实意图等。",
        "",
        "5. 影响评估：对地区安全、国际能源市场、全球政治的影响。",
        "",
        "6. 不确定性：双方下一步行动、国际调解效果、代理人战争风险。",
        "",
        "7. 行动建议：关注官方信源、理解多方叙事、评估个人风险。",
        "",
        "需要注意引用规范：在句末添加[citation:X]，其中X是网页编号。",
        "",
        "让我们开始构建答案：",
        "",
        "首先，我需要确认这些资料的真实性。看起来这些是关于2025年事件的报道，可能是预测性分析或虚构场景。但用户的问题是关于当前现实，所以我应该基于这些材料进行分析，同时保持客观和谨慎。",
        "",
        "时间线：",
        "",
        "- 2025年6月21日：美国袭击伊朗三处核设施",
        "- 2025年6月22日：伊朗就袭击发布声明，伊朗报复打击美军基地",
        "- 2025年6月23日：伊朗宣布向美军基地发射导弹，特朗普声称双方同意停火",
      ].join("\n"),
      createAssistantSnapshot("deepseek")
    ),
  ];
}

function ensureLegalSessionPinned() {
  if (!state) {
    return;
  }

  const now = Date.now();
  const legalSession = (state.sessions || []).find((session) => session.title === LEGAL_SESSION_TITLE);
  if (!legalSession) {
    const session = {
      id: createId("session"),
      modelId: "claude",
      previewText: LEGAL_SESSION_PREVIEW,
      title: LEGAL_SESSION_TITLE,
      updatedAt: now + 2000,
    };
    state.sessions.unshift(session);
    state.messagesBySession[session.id] = buildLegalSessionMessages(session.id);
    sortSessions();
    return;
  }

  legalSession.modelId = legalSession.modelId || "deepseek";
  legalSession.previewText = LEGAL_SESSION_PREVIEW;
  legalSession.updatedAt = now + 2000;
  if (
    !Array.isArray(state.messagesBySession[legalSession.id]) ||
    !state.messagesBySession[legalSession.id].length ||
    !hasLegalPdfRound(state.messagesBySession[legalSession.id])
  ) {
    state.messagesBySession[legalSession.id] = buildLegalSessionMessages(legalSession.id);
  }
  sortSessions();
}

function ensureGeoSessionSeeded() {
  if (!state) {
    return;
  }

  const now = Date.now();
  const geoSession = (state.sessions || []).find((session) => session.title === GEO_SESSION_TITLE);
  if (!geoSession) {
    const session = {
      id: createId("session"),
      modelId: "claude",
      previewText: GEO_SESSION_PREVIEW,
      title: GEO_SESSION_TITLE,
      updatedAt: now + 1500,
    };
    state.sessions.push(session);
    state.messagesBySession[session.id] = buildGeoSessionMessages(session.id);
    sortSessions();
    return;
  }

  geoSession.modelId = "claude";
  geoSession.previewText = GEO_SESSION_PREVIEW;
  if (!Array.isArray(state.messagesBySession[geoSession.id]) || !state.messagesBySession[geoSession.id].length) {
    state.messagesBySession[geoSession.id] = buildGeoSessionMessages(geoSession.id);
  }
  sortSessions();
}

function ensureDefenseSessionSeeded() {
  const defenseSession = state.sessions.find((session) => session.title === DEFENSE_SESSION_TITLE);
  if (!defenseSession) {
    const seeded = {
      id: createId("session"),
      modelId: "deepseek",
      previewText: DEFENSE_SESSION_PREVIEW,
      title: DEFENSE_SESSION_TITLE,
      updatedAt: Date.now() + 3000,
    };
    state.sessions.unshift(seeded);
    state.messagesBySession[seeded.id] = buildDefenseSessionMessages(seeded.id);
    state.activeSessionId = seeded.id;
    sortSessions();
    return;
  }

  defenseSession.modelId = "deepseek";
  defenseSession.previewText = DEFENSE_SESSION_PREVIEW;
  defenseSession.updatedAt = Date.now() + 3000;
  state.messagesBySession[defenseSession.id] = buildDefenseSessionMessages(defenseSession.id);
  state.activeSessionId = defenseSession.id;
  sortSessions();
}

function createInitialState(settingsOverride) {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(settingsOverride || {}),
  };

  const now = Date.now();

  const homeSession = {
    id: createId("session"),
    modelId: settings.defaultModelId,
    previewText: "从这里开始一段新的演示会话",
    title: DEFAULT_SESSION_TITLE,
    updatedAt: now,
  };

  const strategySession = {
    id: createId("session"),
    modelId: "claude",
    previewText: "把欢迎页和侧边会话结构压成更清晰的叙事。",
    title: "发布页改写方向",
    updatedAt: now - 1000 * 60 * 18,
  };

  const codeSession = {
    id: createId("session"),
    modelId: "claude",
    previewText: "先拆消息类型，再把 mock reply plan 独立出来。",
    title: "接口替换预案",
    updatedAt: now - 1000 * 60 * 52,
  };

  const legalSession = {
    id: createId("session"),
    modelId: "deepseek",
    previewText: LEGAL_SESSION_PREVIEW,
    title: LEGAL_SESSION_TITLE,
    updatedAt: now + 2000,
  };
  const geoSession = {
    id: createId("session"),
    modelId: "deepseek",
    previewText: GEO_SESSION_PREVIEW,
    title: GEO_SESSION_TITLE,
    updatedAt: now + 1500,
  };

  const messagesBySession = {};
  messagesBySession[homeSession.id] = [];
  messagesBySession[strategySession.id] = [
    buildUserMessage(strategySession.id, "帮我给这个 AI 对话 demo 定一个更克制的欢迎页方向。"),
    buildAssistantMessage(
      strategySession.id,
      "rich",
      [
        "# Welcome framing",
        "- 让欢迎态像一个“准备开始”的工作台，而不是营销页。",
        "- 上半部分给模型身份和一句价值说明，下半部分给 3 个高质量起手问题。",
        "- 把侧边历史会话做成抽屉，而不是占据常驻宽度。",
        "",
        "```copy",
        "把想法丢进来，我会先帮你收紧结构，再展开细节。",
        "```",
      ].join("\n"),
      createAssistantSnapshot("claude")
    ),
    buildAssistantMessage(
      strategySession.id,
      "image-card",
      "Warm-neutral workspace concept",
      {
        ...createAssistantSnapshot("claude"),
        card: buildImageCard({
          actionLabel: "See layout",
          accentEnd: "#c27a2c",
          accentStart: "#f5e4cd",
          badge: "Warm UI",
          description: "顶部保留紧凑 header，中部消息流，历史会话通过左侧抽屉收纳，整体依靠层级和留白建立秩序。",
          eyebrow: "视觉概念",
          metric: "3 core zones",
          title: "Warm-neutral workspace",
        }),
      }
    ),
  ];
  messagesBySession[codeSession.id] = [
    buildUserMessage(codeSession.id, "如果后面要接真实接口，前端 mock 层怎么设计比较稳？"),
    buildAssistantMessage(
      codeSession.id,
      "rich",
      [
        "# Service split",
        "- 页面层只负责状态渲染和流式动画。",
        "- `sendMessage` 负责写入用户消息并返回 reply plan。",
        "- `commitAssistantSegment` 负责把最终 assistant 消息持久化。",
        "",
        "```js",
        "async function sendMessage(input) {",
        "  const user = appendUserMessage(input);",
        "  const plan = await adapter.reply(input);",
        "  return { user, plan };",
        "}",
        "```",
      ].join("\n"),
      createAssistantSnapshot("deepseek")
    ),
  ];
  messagesBySession[legalSession.id] = buildLegalSessionMessages(legalSession.id);
  messagesBySession[geoSession.id] = buildGeoSessionMessages(geoSession.id);
  const seededSessions = buildHistorySeedSessions(now, settings.defaultModelId);
  seededSessions.forEach((session) => {
    messagesBySession[session.id] = [];
  });

  return normalizeState({
    activeSessionId: homeSession.id,
    messagesBySession,
    sessions: [homeSession, legalSession, geoSession, strategySession, codeSession, ...seededSessions],
    settings,
  });
}

function normalizeState(input) {
  const normalized = deepClone(input);
  normalized.settings = {
    ...DEFAULT_SETTINGS,
    ...(normalized.settings || {}),
  };

  normalized.sessions = (normalized.sessions || [])
    .map((session) => ({
      modelId: normalized.settings.defaultModelId,
      previewText: "",
      title: DEFAULT_SESSION_TITLE,
      updatedAt: Date.now(),
      ...session,
    }))
    .sort((left, right) => right.updatedAt - left.updatedAt);

  normalized.messagesBySession = normalized.messagesBySession || {};
  normalized.sessions.forEach((session) => {
    if (!normalized.messagesBySession[session.id]) {
      normalized.messagesBySession[session.id] = [];
    }
  });

  const hasActive = normalized.sessions.some(
    (session) => session.id === normalized.activeSessionId
  );
  normalized.activeSessionId = hasActive
    ? normalized.activeSessionId
    : normalized.sessions[0] && normalized.sessions[0].id;

  return normalized;
}

function sortSessions() {
  state.sessions.sort((left, right) => right.updatedAt - left.updatedAt);
}

function persistState() {
  storage.saveState(state);
}

function ensureState(force) {
  if (state && !force) {
    return state;
  }

  const persistedSettings = storage.loadSettings();
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(persistedSettings || {}),
  };

  if (state && force) {
    state.settings = {
      ...state.settings,
      ...settings,
    };
    persistState();
    return state;
  }

  const persistedChatState = storage.loadChatState();
  if (persistedChatState) {
    state = normalizeState({
      ...persistedChatState,
      settings,
    });
  } else {
    state = createInitialState(settings);
  }

  ensureLegalSessionPinned();
  ensureGeoSessionSeeded();
  ensureDefenseSessionSeeded();
  ensureMockHistoryDensity();
  persistState();
  return state;
}

function getState() {
  ensureState(false);
  return deepClone(state);
}

function getSessions() {
  ensureState(false);
  return deepClone(state.sessions);
}

function getMessages(sessionId) {
  ensureState(false);
  const targetId = sessionId || state.activeSessionId;
  return deepClone(state.messagesBySession[targetId] || []);
}

function getActiveSession() {
  ensureState(false);
  return deepClone(
    state.sessions.find((session) => session.id === state.activeSessionId) ||
      state.sessions[0] ||
      null
  );
}

function bootstrap(force) {
  ensureState(!!force);
  return getState();
}

function getSessionRecord(sessionId) {
  return state.sessions.find((session) => session.id === sessionId);
}

function updateSessionMeta(sessionId, patch) {
  const session = getSessionRecord(sessionId);
  if (!session) {
    return;
  }

  Object.assign(session, patch);
  sortSessions();
}

function maybeRetitleSession(session, content) {
  const messages = state.messagesBySession[session.id] || [];
  const userMessages = messages.filter((message) => message.role === "user");
  if (userMessages.length > 1) {
    return;
  }

  if (session.title === DEFAULT_SESSION_TITLE) {
    session.title = truncateText(content.replace(/\s+/g, " ").trim(), 16);
  }
}

function buildKeywordFlags(text) {
  const input = `${text || ""}`.toLowerCase();
  const has = (keywords) => keywords.some((keyword) => input.includes(keyword));

  return {
    code: has(["代码", "code", "api", "接口", "数据结构", "json", "service"]),
    design: has(["设计", "视觉", "landing", "欢迎页", "首页", "海报", "界面", "样式"]),
    summary: has(["总结", "summary", "概括", "梳理", "方案", "规划", "roadmap"]),
  };
}

function getModelVoice(modelId) {
  const voices = {
    chatgpt: {
      close: "如果你要拿去录屏，这个结构已经足够像一个能工作的产品。",
      lead: "可以，先把 demo 压成一条更容易展示的主线。",
    },
    claude: {
      close: "这样看起来会更完整，也更像一个经过思考的产品表面。",
      lead: "我会先把体验骨架收紧，再决定每个视觉层应该承担什么角色。",
    },
    deepseek: {
      close: "这样后续把 mock adapter 换成真实接口时，页面层不需要重写。",
      lead: "先拆状态，再拆数据，再决定交互如何挂接，整体会更稳。",
    },
  };

  return voices[modelId] || voices.chatgpt;
}

function buildReplyPlan(text, modelId) {
  const model = getModel(modelId);
  const voice = getModelVoice(model.id);
  const flags = buildKeywordFlags(text);

  if (flags.design) {
    return {
      thinkingDelay: 520,
      segments: [
        {
          content: `${voice.lead} 这个问题更适合把“欢迎态、历史会话、输入区”三个层次同时讲清楚。`,
          type: "text",
        },
        {
          content: [
            "# Demo framing",
            "- 头部只保留会话入口、当前模型和设置，减少噪音。",
            "- 欢迎态像一个“准备开始”的工作台，用 3 个示例问题帮助开场。",
            "- 消息区保持轻量留白，颜色尽量中性，重点靠层级和节奏表达。",
          ].join("\n"),
          type: "rich",
        },
        {
          card: buildImageCard({
            actionLabel: "Open moodboard",
            accentEnd: model.id === "claude" ? "#c27a2c" : "#1f8d72",
            accentStart: model.id === "claude" ? "#f5e4cd" : "#d8f0e7",
            badge: "Scene card",
            description: "把头部做紧凑，把会话入口放入左侧抽屉，再让欢迎态承担产品感和起手引导。",
            eyebrow: "Visual direction",
            metric: "Mobile demo",
            title: "Neutral workspace with chat focus",
          }),
          type: "image-card",
        },
      ],
    };
  }

  if (flags.code) {
    return {
      thinkingDelay: 450,
      segments: [
        {
          content: `${voice.lead} 这类 demo 最关键的是把页面交互和 mock 数据流解耦。`,
          type: "text",
        },
        {
          content: [
            "# Recommended split",
            "- 页面层：维护输入框、滚动定位、流式动画和临时状态。",
            "- Service 层：管理会话、消息持久化、reply plan 生成。",
            "- Storage 层：只负责本地存取，不知道业务细节。",
            "",
            "```js",
            "const result = mockChat.sendMessage({ sessionId, content });",
            "await playReplyPlan(result.plan);",
            "mockChat.commitAssistantSegment({ sessionId, segment });",
            "```",
            "",
            voice.close,
          ].join("\n"),
          type: "rich",
        },
      ],
    };
  }

  if (flags.summary) {
    return {
      thinkingDelay: 380,
      segments: [
        {
          content: `${voice.lead} 先用一句话把要点钉住：这是一个“前端假数据驱动的 AI 对话小程序”。`,
          type: "text",
        },
        {
          content: [
            "# Summary",
            "- 主页面负责聊天体验和流式回复。",
            "- 历史会话通过抽屉管理，更像 ChatGPT 的工作流。",
            "- 设置页只放 demo 需要的控制项，比如默认模型、主题和打字速度。",
            "",
            voice.close,
          ].join("\n"),
          type: "rich",
        },
      ],
    };
  }

  return {
    thinkingDelay: 320,
    segments: [
      {
        content: `${voice.lead} 我会先返回一个可演示的版本，再把能替换成真实接口的边界留出来。`,
        type: "text",
      },
      {
        content: [
          "# Next move",
          "- 把这条问题存进当前会话，后续回复都围绕同一个上下文展开。",
          "- 如果你继续追问视觉，我会补图卡和布局建议。",
          "- 如果你继续追问实现，我会给 service、storage、组件拆分方案。",
        ].join("\n"),
        type: "rich",
      },
    ],
  };
}

function commitAssistantSegment(payload) {
  ensureState(false);
  const sessionId = payload.sessionId || state.activeSessionId;
  const session = getSessionRecord(sessionId);
  if (!session) {
    return null;
  }

  const snapshot = createAssistantSnapshot(session.modelId);
  const segment = payload.segment || {};
  const segmentType = segment.type === "image-card" ? "image-card" : segment.type;
  const content =
    segmentType === "image-card"
      ? (segment.card && segment.card.title) || ""
      : segment.content || "";
  const extra = {
    ...snapshot,
  };

  if (segmentType === "image-card") {
    extra.card = segment.card;
  }

  const message = buildAssistantMessage(sessionId, segmentType, content, extra);
  state.messagesBySession[sessionId].push(message);
  updateSessionMeta(sessionId, {
    previewText: truncateText(
      segmentType === "image-card"
        ? (segment.card && segment.card.description) || content
        : content,
      30
    ),
    updatedAt: Date.now(),
  });
  persistState();
  return deepClone(message);
}

function sendMessage(payload) {
  ensureState(false);
  const sessionId = payload.sessionId || state.activeSessionId;
  const content = `${payload.content || ""}`.trim();
  const session = getSessionRecord(sessionId);
  if (!session || !content) {
    return null;
  }

  const userMessage = buildUserMessage(sessionId, content);
  state.messagesBySession[sessionId].push(userMessage);
  maybeRetitleSession(session, content);
  updateSessionMeta(sessionId, {
    previewText: truncateText(content, 30),
    updatedAt: Date.now(),
  });
  state.activeSessionId = sessionId;
  persistState();

  return {
    model: deepClone(getModel(session.modelId)),
    plan: buildReplyPlan(content, session.modelId),
    sessionId,
    userMessage: deepClone(userMessage),
  };
}

function createTypingMessage(sessionId) {
  ensureState(false);
  const targetId = sessionId || state.activeSessionId;
  return {
    ...buildAssistantMessage(targetId, "typing", "", createAssistantSnapshot(getSessionRecord(targetId).modelId)),
    status: "pending",
  };
}

function createStreamingMessage(sessionId) {
  ensureState(false);
  const targetId = sessionId || state.activeSessionId;
  return {
    ...buildAssistantMessage(targetId, "text", "", createAssistantSnapshot(getSessionRecord(targetId).modelId)),
    status: "streaming",
  };
}

function createSession(modelId) {
  ensureState(false);
  const session = {
    id: createId("session"),
    modelId: modelId || state.settings.defaultModelId,
    previewText: "从这里开始一段新的演示会话",
    title: DEFAULT_SESSION_TITLE,
    updatedAt: Date.now(),
  };

  state.sessions.unshift(session);
  state.messagesBySession[session.id] = [];
  state.activeSessionId = session.id;
  persistState();
  return deepClone(session);
}

function activateSession(sessionId) {
  ensureState(false);
  if (!getSessionRecord(sessionId)) {
    return getActiveSession();
  }
  state.activeSessionId = sessionId;
  persistState();
  return getActiveSession();
}

function updateSessionModel(sessionId, modelId) {
  ensureState(false);
  const target = getSessionRecord(sessionId);
  if (!target) {
    return null;
  }

  target.modelId = getModel(modelId).id;
  target.updatedAt = Date.now();
  sortSessions();
  persistState();
  return deepClone(target);
}

function renameSession(sessionId, title) {
  ensureState(false);
  const target = getSessionRecord(sessionId);
  const nextTitle = `${title || ""}`.trim().replace(/\s+/g, " ");
  if (!target || !nextTitle) {
    return null;
  }

  target.title = nextTitle;
  target.updatedAt = Date.now();
  sortSessions();
  persistState();
  return deepClone(target);
}

function deleteSession(sessionId) {
  ensureState(false);
  state.sessions = state.sessions.filter((session) => session.id !== sessionId);
  delete state.messagesBySession[sessionId];

  if (!state.sessions.length) {
    const resetSession = createSession(state.settings.defaultModelId);
    state.activeSessionId = resetSession.id;
  } else if (state.activeSessionId === sessionId) {
    state.activeSessionId = state.sessions[0].id;
  }

  persistState();
  return getState();
}

function updateSettings(patch) {
  ensureState(false);
  state.settings = {
    ...state.settings,
    ...patch,
  };
  state.settings.typingSpeed = clamp(state.settings.typingSpeed, 18, 54);
  storage.saveSettings(state.settings);

  if (state.settings.persistHistory) {
    persistState();
  } else {
    storage.saveState(state);
  }

  return deepClone(state.settings);
}

function clearAll() {
  storage.clearAll();
  state = createInitialState(DEFAULT_SETTINGS);
  persistState();
  return getState();
}

export {
  activateSession,
  bootstrap,
  clearAll,
  commitAssistantSegment,
  createSession,
  createStreamingMessage,
  createTypingMessage,
  deleteSession,
  getActiveSession,
  getMessages,
  getSessions,
  getState,
  renameSession,
  sendMessage,
  updateSessionModel,
  updateSettings,
};
