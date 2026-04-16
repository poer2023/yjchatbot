/**
 * @typedef {Object} ModelConfig
 * @property {string} id
 * @property {string} name
 * @property {string} shortName
 * @property {string} description
 * @property {string} accent
 * @property {string} accentSoft
 * @property {string} badgeGradient
 */

/**
 * @typedef {Object} ChatSession
 * @property {string} id
 * @property {string} title
 * @property {string} modelId
 * @property {number} updatedAt
 * @property {string} previewText
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {string} sessionId
 * @property {'user' | 'assistant' | 'system'} role
 * @property {'text' | 'rich' | 'image-card' | 'typing'} type
 * @property {string} content
 * @property {'done' | 'streaming' | 'pending'} status
 * @property {number} createdAt
 * @property {Object} extra
 */

/**
 * @typedef {Object} DemoSettings
 * @property {string} defaultModelId
 * @property {'light' | 'mist' | 'graphite'} theme
 * @property {number} typingSpeed
 * @property {boolean} showWelcome
 * @property {boolean} persistHistory
 */

module.exports = {};
