// ==================== 会话恢复模块 ====================
// 保存/恢复标签页状态，窗口关闭前持久化

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// 会话文件路径
function getSessionDir() {
  const dir = path.join(app.getPath('userData'), 'session');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getSessionFile() {
  return path.join(getSessionDir(), 'tabs.json');
}

function getWindowStateFile() {
  return path.join(getSessionDir(), 'window.json');
}

/**
 * 保存标签页会话
 */
function saveSession(tabs) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      tabs: tabs.map(t => ({
        url: t.url || '',
        title: t.title || '新标签页',
        isHome: t.isHome !== false,
        isSettings: t.isSettings || false,
      })),
    };
    fs.writeFileSync(getSessionFile(), JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[Session] 保存会话失败:', e);
    return false;
  }
}

/**
 * 恢复标签页会话
 */
function restoreSession() {
  try {
    if (!fs.existsSync(getSessionFile())) return null;
    const raw = fs.readFileSync(getSessionFile(), 'utf-8');
    const data = JSON.parse(raw);
    if (!data.tabs || !data.tabs.length) return null;
    // 检查是否过期（7天）
    if (Date.now() - data.savedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return data;
  } catch (e) {
    console.error('[Session] 恢复会话失败:', e);
    return null;
  }
}

/**
 * 保存窗口状态（位置、大小、最大化）
 */
function saveWindowState(state) {
  try {
    fs.writeFileSync(getWindowStateFile(), JSON.stringify(state, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[Session] 保存窗口状态失败:', e);
    return false;
  }
}

/**
 * 恢复窗口状态
 */
function restoreWindowState() {
  try {
    if (!fs.existsSync(getWindowStateFile())) return null;
    const raw = fs.readFileSync(getWindowStateFile(), 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * 清除会话文件
 */
function clearSession() {
  try {
    if (fs.existsSync(getSessionFile())) fs.unlinkSync(getSessionFile());
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  saveSession,
  restoreSession,
  saveWindowState,
  restoreWindowState,
  clearSession,
};
