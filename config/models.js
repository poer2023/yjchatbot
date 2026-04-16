const models = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    shortName: "GPT",
    description: "直接、清晰，适合快速推进 demo 思路。",
    accent: "#1f8d72",
    accentSoft: "#d8f0e7",
    badgeGradient: "linear-gradient(135deg, #1f8d72 0%, #59b698 100%)",
    prompts: [
      {
        title: "演示脚本",
        prompt: "帮我为这个 chatbot demo 写一个 30 秒演示脚本。",
      },
      {
        title: "首页文案",
        prompt: "给我 3 版更像 ChatGPT 风格的欢迎页文案。",
      },
      {
        title: "产品定位",
        prompt: "一句话解释这个 demo 的价值，语气克制一点。",
      },
    ],
  },
  {
    id: "claude",
    name: "Claude",
    shortName: "CLD",
    description: "结构化、克制，适合写方案和界面讲解。",
    accent: "#c27a2c",
    accentSoft: "#f5e4cd",
    badgeGradient: "linear-gradient(135deg, #c27a2c 0%, #d8a565 100%)",
    prompts: [
      {
        title: "体验动线",
        prompt: "从用户第一次打开小程序开始，帮我梳理完整体验动线。",
      },
      {
        title: "信息架构",
        prompt: "把聊天页、会话侧栏、设置页的关系讲清楚。",
      },
      {
        title: "欢迎语",
        prompt: "写一段更有陪伴感但不过分热情的欢迎语。",
      },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    shortName: "DS",
    description: "偏技术实现，适合讲 mock 数据流和代码结构。",
    accent: "#245f8f",
    accentSoft: "#dce8f5",
    badgeGradient: "linear-gradient(135deg, #245f8f 0%, #5a8fc8 100%)",
    prompts: [
      {
        title: "数据结构",
        prompt: "帮我定义这个 demo 里会话、消息、设置的前端数据结构。",
      },
      {
        title: "Mock 方案",
        prompt: "如何把假数据层设计成后续能替换真实接口？",
      },
      {
        title: "代码示例",
        prompt: "给我一个适合原生小程序的消息渲染思路和伪代码。",
      },
    ],
  },
];

const modelMap = models.reduce((accumulator, model) => {
  accumulator[model.id] = model;
  return accumulator;
}, {});

const defaultModelId = models[0].id;

function getModel(modelId) {
  return modelMap[modelId] || modelMap[defaultModelId];
}

module.exports = {
  defaultModelId,
  getModel,
  modelMap,
  models,
};
