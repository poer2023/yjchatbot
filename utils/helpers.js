function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function truncateText(text, limit) {
  if (!text) {
    return "";
  }

  const maxLength = limit || 32;
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}…`;
}

function formatSessionTime(timestamp) {
  if (!timestamp) {
    return "刚刚";
  }

  const now = Date.now();
  const gap = now - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (gap < minute) {
    return "刚刚";
  }

  if (gap < hour) {
    return `${Math.floor(gap / minute)} 分钟前`;
  }

  if (gap < day) {
    return `${Math.floor(gap / hour)} 小时前`;
  }

  if (gap < day * 7) {
    return `${Math.floor(gap / day)} 天前`;
  }

  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const dayValue = `${date.getDate()}`.padStart(2, "0");
  return `${month}-${dayValue}`;
}

function getThemeClass(theme) {
  return `theme-${theme || "light"}`;
}

function getThemeLabel(theme) {
  const labels = {
    light: "Warm Light",
    mist: "Mist",
    graphite: "Graphite",
  };

  return labels[theme] || labels.light;
}

function getTypingSpeedLabel(speed) {
  if (speed <= 24) {
    return "快";
  }

  if (speed <= 38) {
    return "平衡";
  }

  return "慢";
}

module.exports = {
  clamp,
  deepClone,
  formatSessionTime,
  getThemeClass,
  getThemeLabel,
  getTypingSpeedLabel,
  truncateText,
};
