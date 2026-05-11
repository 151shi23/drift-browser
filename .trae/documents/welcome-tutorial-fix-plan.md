# 欢迎页新手教程及界面样式全面优化计划

## 一、问题诊断

### 1.1 新手教程交互故障（核心 BUG）

**根因分析**：欢迎页 overlay 的 z-index 为 99999，完全覆盖了浏览器 UI 元素（标题栏、工具栏等）。虽然 `.tutorial-spotlight` 设了 `pointer-events: none`，但 `.tutorial-spotlight-hole` 也设了 `pointer-events: none`，导致聚光灯镂空区域也无法穿透点击。

**问题链**：
- `.tutorial-spotlight` (z-index:1, pointer-events:none) → 遮罩层不拦截点击 ✅
- `.tutorial-spotlight-hole` (pointer-events:none) → 镂空区域也不拦截 ✅
- **但** `.welcome-tutorial` (z-index:99998) 本身覆盖全屏 → 它的背景 `rgba(0,0,0,0.88)` 拦截了所有点击 ❌
- 被引导的 UI 元素（#btnNewTab 等）在 `.welcome-tutorial` 下方 → 点击事件被 tutorial 层吃掉 ❌

**修复方案**：
1. `.welcome-tutorial` 设 `pointer-events: none`，让点击穿透到下层 UI
2. `.tutorial-header` 和 `.tutorial-hint` 设 `pointer-events: auto`，保持自身可交互
3. 在聚光灯镂空区域创建一个透明的"点击桥接"层，将点击事件转发到下方的真实 UI 元素
4. 或者更简单：直接在目标元素上添加高 z-index 的透明覆盖按钮

### 1.2 开屏动画二次打开问题

**根因分析**：`init()` 函数中 `if (cfg.welcomeShown) return;` 直接跳过，所以第二次打开不会显示动画。这是**设计如此**——欢迎页只显示一次。但用户期望每次启动都看到动画。

**修复方案**：
- 将 `welcomeShown` 改为 `welcomeCompleted`，区分"看过动画"和"完成全部引导"
- 每次启动都播放开屏动画，但只首次显示新手教程
- 或：增加 `welcomeAnimPlayed` 标记，每次启动重置为 false

### 1.3 新手教程视觉效果不足

**问题**：
- 聚光灯效果太简单，只有半透明遮罩 + 边框
- 步骤切换没有过渡动画
- 成功动画太朴素（只是白色粒子扩散）
- 提示文字样式与开屏页风格不统一

### 1.4 个性化设置界面视觉不足

**问题**：
- config-card 太朴素，像表单
- 选项按钮没有视觉层次
- 启动按钮不够震撼
- 缺少动画过渡

---

## 二、修复与优化方案

### 2.1 修复新手教程交互（关键 BUG）

**方案：pointer-events 穿透 + 点击桥接**

1. `.welcome-tutorial` 设 `pointer-events: none`
2. 子元素 `.tutorial-header`、`.tutorial-hint` 设 `pointer-events: auto`
3. 在 `positionSpotlight()` 时，动态创建一个与目标元素位置大小相同的透明按钮（z-index 高于 tutorial），点击时触发目标元素的 click
4. 对于没有 target 的步骤（AI助手、快捷操作），不需要桥接按钮

**代码改动**（welcome.js）：
- `startTutorial()` 中降低 overlay 的 z-index 或隐藏 overlay
- `positionSpotlight()` 中创建桥接按钮
- `hideSpotlight()` 中移除桥接按钮
- CSS 中 `.welcome-tutorial` 添加 `pointer-events: none`

### 2.2 修复开屏动画二次打开问题

**方案：每次启动播放动画，仅首次显示教程**

1. config 中新增 `welcomeTutorialDone` 标记
2. `init()` 不再检查 `welcomeShown`，改为始终创建并播放动画
3. 动画结束后：
   - 如果 `welcomeTutorialDone === false`：显示"进入"按钮 → 进入教程
   - 如果 `welcomeTutorialDone === true`：自动淡出，进入浏览器
4. `finishWelcome()` 仍设置 `welcomeShown = true`（兼容旧逻辑）

### 2.3 强化新手教程视觉效果

**CSS 改动**（welcome.css）：
1. 聚光灯效果升级：
   - 遮罩层使用 `backdrop-filter: blur(8px)` 增强模糊
   - 镂空区域添加脉冲光环动画（多层 box-shadow）
   - 镂空区域添加呼吸式发光边框

2. 步骤切换动画：
   - 提示文字添加滑入/滑出动画
   - 进度点添加涟漪效果
   - 步骤标题添加打字机效果

3. 成功动画升级：
   - 粒子从白色改为冷蓝色调
   - 添加环形冲击波效果
   - 添加文字反馈（"完成！"）

4. 整体风格统一：
   - 使用与开屏页相同的冷色调
   - 提示文字使用与哲学文字相同的衬线字体
   - 添加微妙的星云背景延续

### 2.4 优化个性化设置界面

**CSS 改动**（welcome.css）：
1. config-card 升级：
   - 添加玻璃拟态效果（更强的 backdrop-filter + 边框发光）
   - 标题添加渐入动画
   - 卡片添加微妙的悬浮阴影

2. 选项按钮升级：
   - 选中状态添加发光边框 + 内部渐变
   - hover 添加光扫效果
   - 添加选中时的缩放弹跳动画

3. 启动按钮升级：
   - 添加光晕脉动效果
   - hover 时添加扫光效果
   - 添加点击时的涟漪效果

4. 整体添加入场动画：
   - 各组依次淡入
   - 启动按钮最后出现并有呼吸效果

---

## 三、实施步骤

### Step 1: 修复新手教程交互 BUG
- 修改 welcome.css：`.welcome-tutorial` 添加 `pointer-events: none`
- 修改 welcome.css：`.tutorial-header`、`.tutorial-hint` 添加 `pointer-events: auto`
- 修改 welcome.js：`positionSpotlight()` 创建桥接按钮
- 修改 welcome.js：`hideSpotlight()` 移除桥接按钮
- 修改 welcome.js：`startTutorial()` 中隐藏 overlay 背景层（nebula/sparks等）

### Step 2: 修复开屏动画二次打开问题
- 修改 welcome.js：`init()` 改为始终播放动画
- 修改 welcome.js：动画结束后根据 `welcomeTutorialDone` 决定是否显示教程
- 修改 welcome.js：`finishWelcome()` 设置 `welcomeTutorialDone = true`
- 修改 config.js：新增 `welcomeTutorialDone` 默认值

### Step 3: 强化新手教程视觉效果
- 修改 welcome.css：升级聚光灯效果
- 修改 welcome.css：添加步骤切换动画
- 修改 welcome.css：升级成功动画
- 修改 welcome.js：增强成功动画逻辑

### Step 4: 优化个性化设置界面
- 修改 welcome.css：升级 config-card 样式
- 修改 welcome.css：升级选项按钮样式
- 修改 welcome.css：升级启动按钮样式
- 修改 welcome.css：添加入场动画

### Step 5: 测试验证
- 测试新手教程每一步的点击交互
- 测试二次打开动画
- 测试各种屏幕尺寸
- 测试浅色/深色主题

---

## 四、文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/css/welcome.css` | 修改 | 教程视觉升级 + 配置页升级 + 交互修复 |
| `src/js/modules/welcome.js` | 修改 | 交互修复 + 动画逻辑修复 + 教程增强 |
| `src/js/modules/config.js` | 修改 | 新增 welcomeTutorialDone 字段 |

---

## 五、验收标准

- [ ] 新手教程中所有按钮可正常点击（#btnNewTab、#urlBar、#btnMenu）
- [ ] 聚光灯正确高亮目标元素，点击可穿透
- [ ] 每次启动浏览器都播放开屏动画
- [ ] 仅首次启动显示新手教程
- [ ] 教程视觉效果与开屏页风格统一
- [ ] 个性化设置界面视觉震撼
- [ ] 浅色/深色主题均正常
- [ ] 无卡顿、无延迟
