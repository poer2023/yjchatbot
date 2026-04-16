function getPalette(theme) {
  if (theme === "graphite") {
    return {
      text: "#f5f0e8",
      muted: "#d0c8be",
      heading: "#ffffff",
      border: "rgba(255, 255, 255, 0.12)",
      soft: "rgba(255, 255, 255, 0.05)",
      strong: "rgba(75, 177, 145, 0.18)",
      codeBackground: "#111111",
      codeText: "#ecf4ff",
    };
  }

  return {
    text: "#231f1b",
    muted: "#675f57",
    heading: "#1b1815",
    border: "rgba(35, 31, 27, 0.1)",
    soft: "rgba(35, 31, 27, 0.04)",
    strong: "rgba(31, 141, 114, 0.12)",
    codeBackground: "#f4f1ea",
    codeText: "#17304a",
  };
}

function textNode(text) {
  return {
    type: "text",
    text,
  };
}

function paragraphNode(text, palette) {
  return {
    name: "p",
    attrs: {
      style: `margin: 0 0 12px; color: ${palette.text}; line-height: 1.7; font-size: 15px;`,
    },
    children: [textNode(text)],
  };
}

function headingNode(text, palette) {
  return {
    name: "h3",
    attrs: {
      style: `margin: 0 0 12px; color: ${palette.heading}; font-size: 16px; font-weight: 700; line-height: 1.4;`,
    },
    children: [textNode(text)],
  };
}

function listNode(items, palette, ordered) {
  return {
    name: ordered ? "ol" : "ul",
    attrs: {
      style: `margin: 0 0 12px; padding-left: 18px; color: ${palette.text};`,
    },
    children: items.map((item) => ({
      name: "li",
      attrs: {
        style: "margin: 0 0 8px; line-height: 1.65; font-size: 15px;",
      },
      children: [textNode(item)],
    })),
  };
}

function codeNode(text, palette) {
  return {
    name: "pre",
    attrs: {
      style: `margin: 0 0 12px; padding: 14px; border-radius: 14px; border: 1px solid ${palette.border}; background: ${palette.codeBackground}; color: ${palette.codeText}; font-size: 13px; line-height: 1.65; white-space: pre-wrap; word-break: break-all;`,
    },
    children: [
      {
        name: "code",
        attrs: {
          style: "font-family: Menlo, Monaco, monospace;",
        },
        children: [textNode(text)],
      },
    ],
  };
}

function isListLine(line) {
  return /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line);
}

function isSpecialLine(line) {
  return /^#\s+/.test(line) || /^```/.test(line) || isListLine(line);
}

function parseMarkdownToNodes(content, theme) {
  const palette = getPalette(theme);
  const lines = `${content || ""}`.replace(/\r\n/g, "\n").split("\n");
  const nodes = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const line = lines[cursor];
    const trimmed = line.trim();

    if (!trimmed) {
      cursor += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const codeLines = [];
      cursor += 1;
      while (cursor < lines.length && !/^```/.test(lines[cursor].trim())) {
        codeLines.push(lines[cursor]);
        cursor += 1;
      }
      cursor += 1;
      nodes.push(codeNode(codeLines.join("\n"), palette));
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      nodes.push(headingNode(trimmed.replace(/^#\s+/, ""), palette));
      cursor += 1;
      continue;
    }

    if (isListLine(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed);
      const items = [];
      while (cursor < lines.length && isListLine(lines[cursor].trim())) {
        items.push(lines[cursor].trim().replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""));
        cursor += 1;
      }
      nodes.push(listNode(items, palette, ordered));
      continue;
    }

    const paragraphLines = [trimmed];
    cursor += 1;
    while (cursor < lines.length) {
      const next = lines[cursor].trim();
      if (!next || isSpecialLine(next)) {
        break;
      }
      paragraphLines.push(next);
      cursor += 1;
    }
    nodes.push(paragraphNode(paragraphLines.join(" "), palette));
  }

  if (!nodes.length) {
    nodes.push(paragraphNode(" ", palette));
  }

  return nodes;
}

module.exports = {
  parseMarkdownToNodes,
};
