# 欢迎页动画强化 + 新手教程交互全面修复计划

## 一、问题诊断

### 1.1 开屏动画效果不如以前
**现象**：动画不够震撼，效果比之前版本差
**根因**：
- WebGL 星云 shader 可能编译失败（Electron 环境兼容性），导致背景全黑
- 奇点爆发动画只有 2px 白点放大，视觉冲击不够
- 石碑升起后缺少持续的动态效果
- 每次启动都播放完整 16s 动画，用户会觉得慢

### 1.2 右键网页/主页没法右键
**现象**：教程中提示"右键网页，选择 AI Chat"，但右键完全没反应
**根因**：
- `overlay`（z-index:99999）覆盖全屏，拦截了所有鼠标事件
- 教程虽然设了 `pointer-events: none`，但 overlay 本身仍然拦截事件
- 右键菜单（contextmenu）事件被 overlay 吃掉，无法到达 webview

### 1.3 点击地址栏没有光标
**现象**：教程引导点击地址栏，点击后没有光标，无法输入
**根因**：
- 桥接按钮 `createBridgeBtn()` 只转发了 `click` 事件
- 没有转发 `focus` 事件，地址栏没有获得焦点
- 即使地址栏获得焦点，overlay 仍然拦截键盘输入
- 用户无法在地址栏中输入任何文字

### 1.4 教程流程混乱
**现象**：还没输入文字就提示按新建标签页按钮，点击了没有图标引导就提示右键但不能右键
**根因**：
- 教程步骤没有等待用户完成当前操作就自动跳到下一步
- 步骤提示不够清晰，缺少视觉引导
- AI 步骤要求右键，但右键被 overlay 阻挡

---

## 二、核心修复方案

### 2.1 架构重构：教程独立于 overlay

**关键改变**：将 tutorial、complete、config 从 overlay 中移出，作为独立元素挂到 document.body

**原因**：
- overlay 覆盖全屏（z-index:99999），所有事件被它拦截
- 即使设 `pointer-events: none`，overlay 的子元素（nebula canvas 等）仍可能拦截事件
- 教程需要与浏览器 UI 直接交互，必须完全脱离 overlay

**实现**：
```
startTutorial() 时：
1. 将 tutorial、complete、config 从 overlay 移到 document.body
2. 完全隐藏 overlay（display: none）
3. tutorial 独立运行，z-index: 99998
4. tutorial 设 pointer-events: none
5. tutorial-header、tutorial-hint 设 pointer-events: auto
```

### 2.2 右键菜单修复

**方案**：教程进行时，允许右键事件穿透到浏览器 UI

**实现**：
- tutorial 的 `pointer-events: none` 让右键事件穿透
- 在 AI 步骤中，监听 `contextmenu` 事件，当用户右键时显示一个自定义的简易菜单（包含"AI Chat"选项）
- 或者：在 AI 步骤中，改为提示用户使用快捷键 `Ctrl+Shift+A` 打开 AI 浮窗（更可靠）

### 2.3 地址栏交互修复

**方案**：桥接按钮同时转发 click + focus + mousedown 事件

**实现**：
```javascript
bridgeBtn.addEventListener('click', function(e) {
  e.preventDefault();
  targetEl.click();
  targetEl.focus();
});

bridgeBtn.addEventListener('mousedown', function(e) {
  // 先触发 mousedown 让地址栏进入编辑状态
  targetEl.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
});
```

同时确保 overlay 已隐藏，键盘事件不被拦截。

### 2.4 开屏动画强化

**强化方向**：
1. **奇点爆发升级**：从 2px 白点改为更大的初始光球 + 多层爆发
2. **增加粒子流**：石碑升起时，周围有粒子流汇聚效果
3. **Logo 出现升级**：增加金属光泽扫过效果
4. **哲学文字升级**：每个字出现时有更强的光效
5. **增加环境光效**：石碑周围有缓慢旋转的光环
6. **WebGL 回退**：如果 shader 编译失败，使用 Canvas 2D 绘制星云

### 2.5 教程步骤重新设计

**新步骤**：
1. **智能导航** — 点击地址栏输入搜索 → 聚光灯高亮地址栏 + 桥接按钮
2. **标签管理** — 点击"+"新建标签页 → 聚光灯高亮按钮 + 桥接按钮
3. **AI 助手** — 按 Ctrl+Shift+A 打开 AI 对话（**改为快捷键**，不再要求右键）
4. **快捷操作** — 按 Ctrl+Shift+P 打开命令面板
5. **主题切换** — 点击菜单切换主题 → 聚光灯高亮菜单 + 桥接按钮

**关键改变**：AI 步骤从"右键选择 AI Chat"改为"按 Ctrl+Shift+A"，避免右键交互问题。

---

## 三、详细实施步骤

### Step 1: 重构教程架构 — 脱离 overlay
- 修改 `createElements()`：tutorial、complete、config 直接挂到 document.body
- 修改 `startTutorial()`：完全隐藏 overlay（display:none）
- 修改 `finishWelcome()`：清理所有独立元素

### Step 2: 修复右键交互
- 修改 AI 步骤：从"右键选择 AI Chat"改为"按 Ctrl+Shift+A 打开 AI 对话"
- 修改 `listenForAI()`：监听 Ctrl+Shift+A 快捷键
- 保留右键检测作为备选（如果 contextmenu 事件能穿透）

### Step 3: 修复地址栏交互
- 修改 `createBridgeBtn()`：同时转发 mousedown + click + focus
- 确保桥接按钮点击后地址栏获得焦点和光标
- 添加输入检测：监听地址栏的 input 事件

### Step 4: 强化开屏动画
- 升级奇点爆发：更大的初始光球 + 多层 box-shadow 爆发
- 添加石碑升起粒子流：Canvas 2D 粒子从四周汇聚到石碑
- Logo 出现增加光泽扫过效果
- 哲学文字出现增加更强的光效
- 添加 WebGL 编译失败的回退方案

### Step 5: 优化教程流程
- 每个步骤增加更明确的视觉引导
- 添加"跳过此步"按钮（30秒无操作自动出现）
- 步骤间增加过渡动画

---

## 四、文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/js/modules/welcome.js` | 修改 | 教程脱离overlay + 右键修复 + 地址栏修复 + 动画强化 |
| `src/css/welcome.css` | 修改 | 动画强化 + 教程样式调整 |

---

## 五、验收标准

- [ ] 开屏动画视觉冲击力强，奇点爆发震撼
- [ ] 教程中右键可以正常弹出浏览器右键菜单
- [ ] 点击地址栏后出现光标，可以输入文字
- [ ] AI 步骤使用 Ctrl+Shift+A 快捷键，不再依赖右键
- [ ] 新建标签页按钮可以正常点击
- [ ] 教程各步骤有明确的视觉引导
- [ ] 每个步骤都有"跳过"选项
- [ ] overlay 在教程期间完全不影响浏览器交互
