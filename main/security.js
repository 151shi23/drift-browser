// ==================== 安全策略模块 ====================
// CSP 注入、证书错误处理、危险协议拦截

const { session, app } = require('electron');

// 已信任的证书指纹集合（运行时缓存）
const trustedCertificates = new Set();

/**
 * 初始化所有安全策略
 */
function initSecurity() {
  injectCSP();
  handleCertificateErrors();
  interceptDangerousProtocols();
}

/**
 * 注入 Content-Security-Policy（仅对渲染进程自身页面，不影响 webview 内的外部网站）
 */
function injectCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // 只对本地文件协议（渲染进程自身）注入严格 CSP
    // 外部网站（http/https）由其自己的 CSP 控制，不做覆盖
    const url = details.url;
    if (!url.startsWith('file://') && !url.startsWith('f://')) {
      callback({});
      return;
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: blob: https: http:; " +
          "font-src 'self' data:; " +
          "connect-src 'self' https: http: ws: wss:; " +
          "media-src 'self' blob: https: http:; " +
          "frame-src 'self' https: http:; " +
          "object-src 'none'; " +
          "base-uri 'self'"
        ],
      },
    });
  });
}

/**
 * HTTPS 证书错误处理
 */
function handleCertificateErrors() {
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();

    const fingerprint = certificate.fingerprint;

    // 已信任的证书直接放行
    if (trustedCertificates.has(fingerprint)) {
      callback(true);
      return;
    }

    // 通知渲染进程显示证书错误提示
    const data = {
      url,
      error,
      issuerName: certificate.issuerName || '未知',
      fingerprint,
    };

    // 向所有窗口发送证书错误事件
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('certificate-error', data);
    });

    // 默认拒绝，等待用户确认
    callback(false);
  });
}

/**
 * 信任证书（由渲染进程通过 IPC 调用）
 */
function trustCertificate(fingerprint, trust) {
  if (trust) {
    trustedCertificates.add(fingerprint);
  }
  return true;
}

/**
 * 拦截危险协议导航
 */
function interceptDangerousProtocols() {
  // 仅拦截主框架/子框架导航中的危险协议，不拦截 WebSocket/XHR/fetch 等资源请求
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url.toLowerCase();

    // 只拦截页面导航请求（mainFrame / subFrame），其他类型（websocket, xhr, fetch, media 等）放行
    const navTypes = ['mainFrame', 'subFrame', 'other'];
    if (!navTypes.includes(details.resourceType)) {
      callback({});
      return;
    }

    // 允许的协议
    const allowedProtocols = ['http:', 'https:', 'ftp:', 'file:', 'chrome-extension:', 'chrome:', 'devtools:', 'data:', 'blob:', 'f:', 'ws:', 'wss:', 'drift:'];
    const urlProtocol = url.split(':')[0] + ':';

    if (!allowedProtocols.includes(urlProtocol) && !url.startsWith('about:')) {
      // 阻止 javascript: 等危险协议导航
      console.warn(`[Security] 拦截危险协议导航: ${url}`);
      callback({ cancel: true });
      return;
    }

    callback({});
  });
}

module.exports = { initSecurity, trustCertificate };
