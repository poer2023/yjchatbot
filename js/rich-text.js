const CHAT_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif";

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
    text: "#1a1a1a",
    muted: "#555b66",
    heading: "#1a1a1a",
    border: "rgba(26, 26, 26, 0.08)",
    soft: "rgba(26, 26, 26, 0.04)",
    strong: "rgba(26, 26, 26, 0.06)",
    codeBackground: "#f4f4f5",
    codeText: "#17304a",
  };
}

function textNode(text) {
  return { type: "text", text };
}

function inlineNodes(text) {
  const source = String(text || "");
  const parts = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push(textNode(source.slice(lastIndex, match.index)));
    }
    parts.push({
      name: "strong",
      attrs: {
        style: "font-weight: 650; color: inherit;",
      },
      children: [textNode(match[1])],
    });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < source.length) {
    parts.push(textNode(source.slice(lastIndex)));
  }
  return parts.length ? parts : [textNode(source)];
}

function paragraphNode(text, palette) {
  return {
    name: "p",
    attrs: {
      style: `margin: 0 0 calc(14 * var(--u)); color: ${palette.text}; line-height: 1.78; font-size: calc(28 * var(--u)); font-weight: 400; font-family: ${CHAT_FONT_FAMILY}; letter-spacing: 0.01em;`,
    },
    children: inlineNodes(text),
  };
}

function headingNode(text, palette) {
  return {
    name: "h3",
    attrs: {
      style: `margin: calc(4 * var(--u)) 0 calc(10 * var(--u)); color: ${palette.heading}; font-size: calc(32 * var(--u)); font-weight: 650; line-height: 1.45; font-family: ${CHAT_FONT_FAMILY}; letter-spacing: 0.01em;`,
    },
    children: inlineNodes(text),
  };
}

function listNode(items, palette, ordered) {
  return {
    name: ordered ? "ol" : "ul",
    attrs: {
      style: `margin: 0 0 calc(14 * var(--u)); padding-left: calc(34 * var(--u)); color: ${palette.text}; font-family: ${CHAT_FONT_FAMILY};`,
    },
    children: items.map((item) => ({
      name: "li",
      attrs: {
        style: `margin: 0 0 calc(10 * var(--u)); line-height: 1.78; font-size: calc(28 * var(--u)); letter-spacing: 0.01em;`,
      },
      children: inlineNodes(item),
    })),
  };
}

function codeNode(text, palette) {
  return {
    name: "pre",
    attrs: {
      style: `margin: 0 0 calc(14 * var(--u)); padding: calc(18 * var(--u)); border-radius: calc(16 * var(--u)); border: 1px solid ${palette.border}; background: ${palette.codeBackground}; color: ${palette.codeText}; font-size: calc(24 * var(--u)); line-height: 1.65; white-space: pre-wrap; word-break: break-all;`,
    },
    children: [
      {
        name: "code",
        attrs: {
          style: "font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;",
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

export function parseMarkdownToNodes(content, theme) {
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

function escapeHtml(s) {
  return `${s || ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nodeToHtml(node) {
  if (node.type === "text") {
    return escapeHtml(node.text);
  }
  const children = (node.children || []).map(nodeToHtml).join("");
  const tag = node.name;
  const style = node.attrs?.style ? ` style="${escapeHtml(node.attrs.style)}"` : "";
  return `<${tag}${style}>${children}</${tag}>`;
}

export function markdownToHtml(content, theme) {
  return parseMarkdownToNodes(content, theme).map(nodeToHtml).join("");
}
