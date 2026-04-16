const { parseMarkdownToNodes } = require("../../utils/rich-text");

Component({
  properties: {
    content: {
      type: String,
      value: "",
    },
    theme: {
      type: String,
      value: "light",
    },
  },

  data: {
    nodes: [],
  },

  observers: {
    "content, theme": function observeContent(content, theme) {
      this.setData({
        nodes: parseMarkdownToNodes(content, theme),
      });
    },
  },
});
