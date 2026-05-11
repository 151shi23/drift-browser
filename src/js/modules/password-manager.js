// ==================== 密码管理提示模块 ====================
// 检测登录表单，提示保存密码
(function() {
  'use strict';

  let passwords = [];
  try {
    passwords = JSON.parse(localStorage.getItem('f-passwords') || '[]');
    if (!Array.isArray(passwords)) passwords = [];
  } catch (e) { passwords = []; }
  let savePromptEl = null;
  let currentFormData = null;

  // 使用 Web Crypto API 进行密码加密（比 XOR 更安全）
  const KEY = 'F-Browser-2024-SecureKey';

  async function secureEncrypt(text) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const keyData = encoder.encode(KEY);
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      return btoa(String.fromCharCode(...combined));
    } catch (e) {
      // 降级到简单 XOR
      return simpleEncrypt(text);
    }
  }

  async function secureDecrypt(encoded) {
    try {
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const data = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      const iv = data.slice(0, 12);
      const encrypted = data.slice(12);
      const keyData = encoder.encode(KEY);
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
      );
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encrypted);
      return decoder.decode(decrypted);
    } catch (e) {
      // 降级到简单 XOR
      return simpleDecrypt(encoded);
    }
  }

  // 保留旧版简单加密用于降级兼容

  function simpleEncrypt(text) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
    }
    return btoa(result);
  }

  function simpleDecrypt(encoded) {
    try {
      const text = atob(encoded);
      let result = '';
      for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
      }
      return result;
    } catch(e) {
      return '';
    }
  }

  function getPasswords() {
    return passwords;
  }

  async function savePassword(url, username, password) {
    // 检查是否已存在
    const idx = passwords.findIndex(p => p.url === url && p.username === username);
    const record = {
      url,
      username,
      password: await secureEncrypt(password),
      time: Date.now(),
    };

    if (idx >= 0) {
      passwords[idx] = record;
    } else {
      passwords.push(record);
    }
    localStorage.setItem('f-passwords', JSON.stringify(passwords));
  }

  function deletePassword(index) {
    passwords.splice(index, 1);
    localStorage.setItem('f-passwords', JSON.stringify(passwords));
  }

  function clearPasswords() {
    passwords = [];
    localStorage.setItem('f-passwords', JSON.stringify(passwords));
  }

  function findPassword(url) {
    try {
      const u = new URL(url);
      return passwords.filter(p => {
        try {
          const pu = new URL(p.url);
          return pu.hostname === u.hostname;
        } catch(e) { return false; }
      });
    } catch(e) {
      return [];
    }
  }

  // 注入表单检测脚本到 webview
  const FORM_DETECT_SCRIPT = `
    (function() {
      function findLoginForm() {
        const forms = document.querySelectorAll('form');
        for (const form of forms) {
          const passwordInput = form.querySelector('input[type="password"]');
          if (passwordInput) {
            const usernameInput = form.querySelector(
              'input[type="email"], input[type="text"][name*="user"], input[type="text"][name*="email"], ' +
              'input[type="text"][name*="login"], input[name*="account"], input[autocomplete="username"]'
            );
            return {
              hasForm: true,
              hasPassword: true,
              hasUsername: !!usernameInput
            };
          }
        }
        // 检查独立的密码输入框
        const standalonePassword = document.querySelector('input[type="password"]');
        if (standalonePassword) {
          return { hasForm: false, hasPassword: true, hasUsername: false };
        }
        return null;
      }

      // 监听表单提交
      document.addEventListener('submit', function(e) {
        const form = e.target;
        const passwordInput = form.querySelector('input[type="password"]');
        if (!passwordInput) return;

        const usernameInput = form.querySelector(
          'input[type="email"], input[type="text"][name*="user"], input[type="text"][name*="email"], ' +
          'input[type="text"][name*="login"], input[name*="account"], input[autocomplete="username"]'
        );

        const data = {
          url: window.location.href,
          username: usernameInput ? usernameInput.value : '',
          password: passwordInput.value,
          type: 'form-submit'
        };

        // 通过自定义事件通知渲染进程
        window.postMessage({ type: 'fb-password-capture', data: data }, '*');
      }, true);

      // 检测页面加载时的登录表单
      const loginForm = findLoginForm();
      if (loginForm) {
        window.postMessage({
          type: 'fb-login-form-detected',
          data: { url: window.location.href, ...loginForm }
        }, '*');
      }
    })();
  `;

  // 在 webview 加载后注入表单检测
  function injectFormDetector(wv, tabId) {
    try {
      wv.addEventListener('dom-ready', () => {
        wv.executeJavaScript(FORM_DETECT_SCRIPT).catch(() => {});
      });
    } catch(e) {}
  }

  // 显示保存密码提示
  function showSavePrompt(url, username) {
    ensurePromptEl();
    currentFormData = { url, username };
    savePromptEl.querySelector('.pm-username').textContent = username || '(无用户名)';
    savePromptEl.querySelector('.pm-url').textContent = new URL(url).hostname;
    savePromptEl.classList.add('visible');

    // 5秒后自动隐藏
    setTimeout(() => {
      hideSavePrompt();
    }, 15000);
  }

  function hideSavePrompt() {
    ensurePromptEl();
    savePromptEl.classList.remove('visible');
    currentFormData = null;
  }

  function ensurePromptEl() {
    if (!savePromptEl) {
      savePromptEl = document.getElementById('passwordPrompt');
    }
    if (!savePromptEl) {
      savePromptEl = document.createElement('div');
      savePromptEl.id = 'passwordPrompt';
      savePromptEl.className = 'password-prompt';
      savePromptEl.innerHTML = `
        <div class="pm-icon">🔑</div>
        <div class="pm-info">
          <div class="pm-title">是否保存密码？</div>
          <div class="pm-username"></div>
          <div class="pm-url"></div>
        </div>
        <div class="pm-actions">
          <button class="pm-btn pm-save">保存</button>
          <button class="pm-btn pm-never">永不</button>
          <button class="pm-btn pm-dismiss">✕</button>
        </div>
      `;
      document.body.appendChild(savePromptEl);

      savePromptEl.querySelector('.pm-save').addEventListener('click', async () => {
        if (currentFormData) {
          // 需要从 webview 获取密码值
          const wv = window.FBrowser.tabs.getActiveWebview();
          if (wv) {
            try {
              const result = await wv.executeJavaScript(`
                (function() {
                  const pi = document.querySelector('input[type="password"]');
                  const ui = document.querySelector('input[type="email"], input[type="text"][name*="user"], input[type="text"][name*="email"], input[type="text"][name*="login"], input[autocomplete="username"]');
                  return { password: pi ? pi.value : '', username: ui ? ui.value : '' };
                })()
              `);
              await savePassword(currentFormData.url, result.username, result.password);
              hideSavePrompt();
            } catch (e) {
              hideSavePrompt();
            }
          }
        }
      });

      savePromptEl.querySelector('.pm-never').addEventListener('click', hideSavePrompt);
      savePromptEl.querySelector('.pm-dismiss').addEventListener('click', hideSavePrompt);
    }
  }

  // 自动填充
  async function autoFill(url) {
    const matches = findPassword(url);
    if (matches.length === 0) return;

    const wv = window.FBrowser.tabs.getActiveWebview();
    if (!wv) return;

    const match = matches[0];
    const password = await secureDecrypt(match.password);

    wv.executeJavaScript(`
      (function() {
        const pi = document.querySelector('input[type="password"]');
        const ui = document.querySelector('input[type="email"], input[type="text"][name*="user"], input[type="text"][name*="email"], input[type="text"][name*="login"], input[autocomplete="username"]');
        if (ui) { ui.value = ${JSON.stringify(match.username)}; ui.dispatchEvent(new Event('input', {bubbles:true})); }
        if (pi) { pi.value = ${JSON.stringify(password)}; pi.dispatchEvent(new Event('input', {bubbles:true})); }
      })()
    `).catch(() => {});
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.passwordManager = {
    getPasswords, savePassword, deletePassword, clearPasswords,
    findPassword, showSavePrompt, hideSavePrompt, autoFill,
    injectFormDetector, simpleEncrypt, simpleDecrypt,
  };
})();
