// ==================== 认证桥接模块 ====================
// 支持网站通过 drift://auth 协议传递登录凭证，实现快捷登录

const { ipcMain } = require('electron');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// 存储路径
function getAuthDir() {
  const userData = path.join(process.env.APPDATA || '', 'f-browser');
  const dir = path.join(userData, 'auth');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getAuthFile(domain) {
  const hash = crypto.createHash('sha256').update(domain).digest('hex').substring(0, 16);
  return path.join(getAuthDir(), `${hash}.json`);
}

// 白名单域名（只允许这些域名传递登录凭证）
const ALLOWED_DOMAINS = new Set([
  // 用户可配置，默认允许所有（生产环境建议限制）
]);

// 加密密钥（使用机器标识生成，每次重启相同）
function getMachineKey() {
  const machineId = require('os').hostname() + process.env.USERNAME;
  return crypto.createHash('sha256').update(machineId).digest();
}

function encrypt(text) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', getMachineKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return iv.toString('hex') + ':' + authTag + ':' + encrypted;
  } catch (e) {
    return null;
  }
}

function decrypt(text) {
  try {
    const parts = text.split(':');
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', getMachineKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return null;
  }
}

// 保存登录凭证
function saveAuthToken(domain, data) {
  try {
    const filePath = getAuthFile(domain);
    const payload = JSON.stringify({
      domain,
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7天过期
    });
    const encrypted = encrypt(payload);
    if (!encrypted) return false;
    fs.writeFileSync(filePath, encrypted, 'utf-8');
    console.log(`[AuthBridge] 已保存 ${domain} 的登录凭证`);
    return true;
  } catch (e) {
    console.error('[AuthBridge] 保存凭证失败:', e.message);
    return false;
  }
}

// 读取登录凭证
function getAuthToken(domain) {
  try {
    const filePath = getAuthFile(domain);
    if (!fs.existsSync(filePath)) return null;
    const encrypted = fs.readFileSync(filePath, 'utf-8');
    const decrypted = decrypt(encrypted);
    if (!decrypted) return null;
    const payload = JSON.parse(decrypted);
    if (payload.expiresAt && payload.expiresAt < Date.now()) {
      fs.unlinkSync(filePath);
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

// 清除登录凭证
function clearAuthToken(domain) {
  try {
    const filePath = getAuthFile(domain);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[AuthBridge] 已清除 ${domain} 的登录凭证`);
    }
    return true;
  } catch (e) {
    return false;
  }
}

// 解析 drift://auth 协议 URL
function parseAuthUrl(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith('/auth')) return null;

    const params = Object.fromEntries(parsed.searchParams);
    const domain = params.domain;
    const token = params.token;
    const redirect = params.redirect;
    const method = params.method || 'token'; // token / cookie / session

    if (!domain) {
      console.warn('[AuthBridge] 缺少 domain 参数');
      return null;
    }

    return { domain, token, redirect, method, raw: params };
  } catch (e) {
    console.error('[AuthBridge] 解析 URL 失败:', e.message);
    return null;
  }
}

// 处理认证协议
function handleAuthProtocol(url, mainWindow) {
  const auth = parseAuthUrl(url);
  if (!auth) return false;

  console.log(`[AuthBridge] 收到 ${auth.domain} 的认证请求，方法: ${auth.method}`);

  // 保存凭证
  if (auth.token) {
    saveAuthToken(auth.domain, {
      token: auth.token,
      method: auth.method,
      extra: auth.raw
    });
  }

  // 打开目标页面
  if (auth.redirect) {
    const redirectUrl = decodeURIComponent(auth.redirect);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth-login-ready', {
        domain: auth.domain,
        url: redirectUrl,
        method: auth.method
      });
    }
  }

  return true;
}

// 注册 IPC 处理器
function registerAuthHandlers() {
  ipcMain.handle('auth:get-token', (_, domain) => {
    const auth = getAuthToken(domain);
    return auth ? { success: true, data: auth.data } : { success: false };
  });

  ipcMain.handle('auth:clear-token', (_, domain) => {
    return { success: clearAuthToken(domain) };
  });

  ipcMain.handle('auth:list-domains', () => {
    try {
      const dir = getAuthDir();
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
      const domains = [];
      for (const file of files) {
        try {
          const encrypted = fs.readFileSync(path.join(dir, file), 'utf-8');
          const decrypted = decrypt(encrypted);
          if (decrypted) {
            const payload = JSON.parse(decrypted);
            domains.push({
              domain: payload.domain,
              createdAt: payload.createdAt,
              expiresAt: payload.expiresAt
            });
          }
        } catch (e) {}
      }
      return { success: true, domains };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

module.exports = {
  handleAuthProtocol,
  registerAuthHandlers,
  saveAuthToken,
  getAuthToken,
  clearAuthToken,
  parseAuthUrl
};
