function createId(prefix) {
  const name = prefix || "id";
  return `${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
  createId,
};
