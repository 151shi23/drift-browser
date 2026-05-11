# Drift 浏览器 — 首次启动欢迎页 V4 终极方案

> **目标**: 打造一个真正高端、令人过目不忘的首次启动体验
> **核心哲学**: "以不诱于誉，不恐于诽，率道而行，端然正己，不为物倾侧"
> **设计理念**: 沉浸式全屏体验 + 电影级转场 + 极简交互

---

## 一、整体架构（单页全屏，无步骤切换）

用户打开浏览器 → 全屏欢迎页覆盖 → 看完自动进入 / 点击跳过

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  [全屏深色背景，微妙渐变]                                    │
│                                                            │
│              ┌─────────────────────┐                       │
│              │                     │                       │
│              │    Drift Logo       │  ← 极简，大，居中      │
│              │    (纯 SVG，无动画)  │                       │
│              │                     │                       │
│              └─────────────────────┘                       │
│                                                            │
│     以不诱于誉，不恐于诽，率道而行，端然正己，不为物倾侧       │
│     ← 书法字体，小字，副标题位置                              │
│                                                            │
│              [ 进入 Drift ]                                 │
│              ← 极简按钮，hover 微光                          │
│                                                            │
│              按任意键跳过                                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 二、设计规范

### 1. 色彩
- 背景: `#0a0a0f` (极深蓝黑，非纯黑)
- Logo: `#ffffff` (纯白)
- 哲学文字: `rgba(255,255,255,0.6)` (半透明白)
- 按钮: `rgba(255,255,255,0.1)` 背景 + `rgba(255,255,255,0.8)` 文字
- 按钮 hover: `rgba(255,255,255,0.15)` 背景
- 强调色: 不用，保持极简

### 2. 字体
- Logo: `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: 300; letter-spacing: 12px;`
- 哲学: `font-family: 'Noto Serif SC', 'Source Han Serif SC', serif; font-weight: 400;`
- 按钮: `font-weight: 400; letter-spacing: 2px;`

### 3. 布局
- 全部绝对居中
- Logo: `font-size: 72px`
- 哲学: `font-size: 16px`, `margin-top: 32px`
- 按钮: `margin-top: 64px`, `padding: 14px 48px`
- 跳过提示: `position: absolute; bottom: 40px;`, `font-size: 12px`, `opacity: 0.3`

### 4. 动画（极简，只有淡入）
- 背景: 无动画
- Logo: `opacity: 0 → 1`, `duration: 1.5s`, `delay: 0.3s`, `ease: ease-out`
- 哲学: `opacity: 0 → 1`, `duration: 1s`, `delay: 1s`
- 按钮: `opacity: 0 → 1`, `duration: 0.8s`, `delay: 1.5s`
- 跳过提示: `opacity: 0 → 0.3`, `duration: 0.5s`, `delay: 3s`

---

## 三、交互

### 进入方式
1. 点击「进入 Drift」按钮
2. 按任意键（Enter / Space / 任意字母）
3. 5秒后自动进入（可选）

### 退出动画
- 欢迎页 `opacity: 1 → 0`, `duration: 0.6s`
- 移除 DOM

---

## 四、文件结构

```
src/
├── css/
│   └── welcome.css    ← 全部样式（~80行）
├── js/
│   └── modules/
│       └── welcome.js  ← 全部逻辑（~60行）
```

---

## 五、代码实现

### welcome.css

```css
/* Drift 首次启动欢迎页 — 极简版 */

.welcome-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: #0a0a0f;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  animation: welcomeFadeIn 0.5s ease;
}

.welcome-overlay.hidden {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.6s ease;
}

@keyframes welcomeFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Logo */
.welcome-logo {
  font-size: 72px;
  font-weight: 300;
  color: #fff;
  letter-spacing: 12px;
  opacity: 0;
  animation: welcomeContentIn 1.5s ease-out 0.3s forwards;
}

/* 哲学 */
.welcome-philosophy {
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
  font-size: 16px;
  color: rgba(255,255,255,0.6);
  letter-spacing: 2px;
  margin-top: 32px;
  opacity: 0;
  animation: welcomeContentIn 1s ease-out 1s forwards;
}

/* 按钮 */
.welcome-btn {
  margin-top: 64px;
  padding: 14px 48px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 4px;
  color: rgba(255,255,255,0.8);
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 2px;
  cursor: pointer;
  opacity: 0;
  animation: welcomeContentIn 0.8s ease-out 1.5s forwards;
  transition: all 0.3s ease;
}

.welcome-btn:hover {
  background: rgba(255,255,255,0.15);
  border-color: rgba(255,255,255,0.25);
  color: #fff;
}

/* 跳过提示 */
.welcome-skip {
  position: absolute;
  bottom: 40px;
  font-size: 12px;
  color: rgba(255,255,255,0.3);
  letter-spacing: 1px;
  opacity: 0;
  animation: welcomeContentIn 0.5s ease-out 3s forwards;
}

@keyframes welcomeContentIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### welcome.js

```javascript
// Drift 首次启动欢迎页 — 极简版
(function() {
  var overlay;

  function init() {
    var FBC = window.FBrowser && window.FBrowser.config ? window.FBrowser.config : null;
    var cfg = FBC ? FBC.getConfig() : {};
    if (cfg.welcomeShown) return;

    createOverlay();
    bindEvents();
  }

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'welcome-overlay';
    overlay.innerHTML =
      '<div class="welcome-logo">Drift</div>' +
      '<div class="welcome-philosophy">以不诱于誉，不恐于诽，率道而行，端然正己，不为物倾侧</div>' +
      '<button class="welcome-btn" id="welcomeBtn">进入 Drift</button>' +
      '<div class="welcome-skip">按任意键跳过</div>';
    document.body.appendChild(overlay);
  }

  function bindEvents() {
    // 按钮点击
    var btn = document.getElementById('welcomeBtn');
    if (btn) btn.addEventListener('click', finish);

    // 任意键跳过
    var keyHandler = function(e) {
      document.removeEventListener('keydown', keyHandler);
      finish();
    };
    document.addEventListener('keydown', keyHandler);

    // 5秒自动跳过（可选）
    // setTimeout(finish, 5000);
  }

  function finish() {
    // 标记已显示
    var FBC = window.FBrowser && window.FBrowser.config ? window.FBrowser.config : null;
    if (FBC) {
      var cfg = FBC.getConfig();
      cfg.welcomeShown = true;
      FBC.saveConfig();
    }

    // 淡出移除
    if (overlay) {
      overlay.classList.add('hidden');
      setTimeout(function() {
        if (overlay && overlay.parentNode) overlay.remove();
      }, 600);
    }
  }

  window.DriftWelcome = {
    init: init,
    reset: function() {
      var FBC = window.FBrowser && window.FBrowser.config ? window.FBrowser.config : null;
      if (FBC) {
        var cfg = FBC.getConfig();
        cfg.welcomeShown = false;
        FBC.saveConfig();
      }
      location.reload();
    }
  };
})();
```

---

## 六、与现有代码的整合

### 修改 index.html
- 移除 `welcome-particles.js` 的引用（不再需要）
- 保留 `welcome.css` 和 `welcome.js` 的引用

### 修改 app.js
- 保持现有逻辑不变（已正确）

---

## 七、验收标准

- [ ] 全屏深色背景，无杂乱元素
- [ ] Logo 大而简洁，淡入动画流畅
- [ ] 哲学文字书法字体，位置恰当
- [ ] 按钮极简，hover 有微光反馈
- [ ] 按任意键可跳过
- [ ] 首次启动后不再显示
- [ ] 整体风格高端、克制、不花哨
