# Drift 浏览器 — 首次启动欢迎页 V6 终极震撼版

> **目标**: 在当前版本基础上全面升级，打造真正令人震撼的首次启动体验
> **核心哲学**: "以不诱于誉，不恐于诽，率道而行，端然正己，不为物倾侧"
> **设计理念**: 极简克制 + 极致光影 + 空间纵深感 + 电影级动画

---

## 一、问题诊断：为什么之前的设计"垃圾"

### 1.1 视觉层面
- **粒子效果太廉价**：普通 Canvas 2D 粒子，像 2015 年的网站
- **颜色太花哨**：蓝紫渐变 + 发光，显得轻浮不高级
- **Logo 太小气**：140px 的 SVG，没有视觉冲击力
- **哲学文字排版平庸**：简单的居中排列，没有仪式感
- **按钮样式过时**：圆角渐变按钮，像 Bootstrap 模板

### 1.2 动画层面
- **大爆炸动画太卡通**：一个白点放大，像 Flash 动画
- **动画节奏单一**：全部使用 ease，没有层次
- **没有空间感**：所有元素都在一个平面上
- **缺少悬念**：一上来就展示所有内容

### 1.3 体验层面
- **没有沉浸感**：用户知道自己在看一个"欢迎页"
- **交互反馈弱**：hover 效果太简单
- **退出动画缺失**：直接 fade out，没有仪式感

---

## 二、V6 设计概念："虚空创世"

### 2.1 核心意象
用户打开浏览器，看到的不是"欢迎页"，而是**一片正在诞生的宇宙**。

**场景描述**：
- 绝对的黑暗中，一个极小的光点出现
- 光点爆发，形成星云漩涡（不是简单的粒子，而是流体效果）
- 漩涡中心，一块巨大的黑色石碑缓缓升起
- 石碑表面有细微的纹理，像黑曜石
- 石碑正面，Drift Logo 以冷冽的金属质感浮现
- Logo 下方，五句哲学文字以刻字的方式逐字显现
- 石碑底部，一圈微弱的光晕缓缓脉动
- 整个场景有真实的 3D 透视，鼠标移动时视角微变

### 2.2 情绪曲线
```
0s      绝对黑暗 —— 寂静，期待
1s      奇点爆发 —— 震撼，视觉冲击
3s      星云旋转 —— 沉浸，被吸入
6s      石碑升起 —— 敬畏，庄严感
9s      Logo 浮现 —— 品牌认知
12s     文字刻出 —— 哲学共鸣
16s     光晕脉动 —— 生命力
18s     提示出现 —— 行动召唤
```

---

## 三、技术方案：纯 CSS/Canvas，零依赖

**放弃 Three.js**，原因：
1. 增加 600KB+ 加载
2. 在 Electron 中可能有兼容问题
3. 纯 CSS/Canvas 完全可以实现震撼效果

**核心技术**：
- **WebGL 流体模拟**：自定义 shader 实现星云效果
- **Canvas 2D 粒子系统**：石碑碎裂效果
- **CSS 3D 变换**：石碑和文字的 3D 呈现
- **CSS 动画编排**：精确的时间线控制

---

## 四、视觉规范

### 4.1 色彩体系
```css
/* 主色调 - 极致克制 */
--void-black: #000000;           /* 绝对黑暗 */
--deep-void: #030305;            /* 深邃背景 */
--monolith: #0a0a0f;             /* 石碑底色 */
--monolith-edge: #151520;        /* 石碑边缘 */
--accent-cold: #2a4d6e;          /* 冷色微光 */
--accent-glow: #3d6a99;          /* 微弱发光 */
--text-primary: #e8e8e8;         /* 主文字 */
--text-muted: #555555;           /* 次要文字 */
```

**原则**：
- 不使用任何饱和色
- 不使用渐变（除了极 subtle 的 glow）
- 所有光效都是单色的（冷蓝色调）
- 对比度极高：黑 vs 白，没有中间灰

### 4.2 字体规范
```css
/* Logo */
font-family: 'Inter', -apple-system, sans-serif;
font-weight: 900;
font-size: 72px;
letter-spacing: 0.15em;

/* 哲学文字 */
font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
font-weight: 300;
font-size: 24px;
letter-spacing: 0.3em;
writing-mode: vertical-rl;  /* 竖排！ */
```

**关键改变**：哲学文字改为**竖排**！从右向左，增加东方哲学韵味。

### 4.3 空间规范
- 石碑占据画面 60% 高度
- Logo 在石碑上半部分，偏上
- 哲学文字竖排在石碑右侧
- 底部提示在石碑下方 80px
- 所有元素有真实的 z 轴深度

---

## 五、动画详细设计

### 5.1 阶段一：奇点爆发 (0-3s)

**效果**：屏幕中央一个极亮的白点，瞬间爆发成星云漩涡

**实现**：
```css
/* 奇点 */
.singularity {
  position: absolute;
  width: 2px;
  height: 2px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(255,255,255,1);
  animation: singularityBurst 3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes singularityBurst {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(255,255,255,1);
    opacity: 1;
  }
  30% {
    transform: scale(300);
    box-shadow: 
      0 0 100px 50px rgba(255,255,255,0.8),
      0 0 200px 100px rgba(42,77,110,0.4);
    opacity: 0.9;
  }
  100% {
    transform: scale(800);
    box-shadow: 
      0 0 200px 100px rgba(42,77,110,0.2),
      0 0 400px 200px rgba(10,10,15,0.8);
    opacity: 0;
  }
}
```

**星云背景**：使用 WebGL shader 实现流体噪声漩涡

### 5.2 阶段二：石碑升起 (3-6s)

**效果**：一块巨大的黑色长方体从下方缓缓升起，有 3D 透视

**实现**：
```css
.monolith {
  width: 400px;
  height: 600px;
  background: linear-gradient(
    180deg,
    #0a0a0f 0%,
    #0d0d14 50%,
    #0a0a0f 100%
  );
  transform: perspective(1000px) rotateX(5deg) translateY(100vh);
  animation: monolithRise 3s cubic-bezier(0.16, 1, 0.3, 1) 3s forwards;
  box-shadow:
    /* 顶部边缘微光 */
    0 -2px 20px rgba(42,77,110,0.3),
    /* 底部发光 */
    0 20px 60px rgba(42,77,110,0.15),
    /* 内部深度 */
    inset 0 0 100px rgba(0,0,0,0.8);
}

@keyframes monolithRise {
  from {
    transform: perspective(1000px) rotateX(15deg) translateY(100vh);
    opacity: 0;
  }
  to {
    transform: perspective(1000px) rotateX(5deg) translateY(0);
    opacity: 1;
  }
}
```

**石碑纹理**：使用 CSS `::before` 伪元素叠加细微的噪点纹理

### 5.3 阶段三：Logo 浮现 (6-9s)

**效果**：Drift Logo 以金属质感从石碑表面"浮"出来

**实现**：
```css
.welcome-logo {
  font-size: 72px;
  font-weight: 900;
  letter-spacing: 0.15em;
  color: #1a1a24;
  text-shadow:
    /* 内凹效果 */
    -1px -1px 1px rgba(0,0,0,0.8),
    1px 1px 1px rgba(255,255,255,0.05);
  animation: logoEmerge 3s cubic-bezier(0.16, 1, 0.3, 1) 6s forwards;
  opacity: 0;
}

@keyframes logoEmerge {
  0% {
    opacity: 0;
    transform: translateZ(-50px);
    filter: blur(10px);
  }
  50% {
    opacity: 0.5;
    color: #2a2a3a;
  }
  100% {
    opacity: 1;
    transform: translateZ(0);
    filter: blur(0);
    color: #e8e8e8;
    text-shadow:
      0 0 40px rgba(42,77,110,0.3),
      0 0 80px rgba(42,77,110,0.1);
  }
}
```

### 5.4 阶段四：哲学文字刻出 (9-14s)

**效果**：五句文字逐字显现，像被刻刀刻在石碑上，带火花粒子

**实现**：
```css
.philosophy-line {
  writing-mode: vertical-rl;
  text-orientation: upright;
  font-family: 'Noto Serif SC', serif;
  font-size: 20px;
  font-weight: 300;
  letter-spacing: 0.5em;
  color: transparent;
  background: linear-gradient(180deg, #888 0%, #444 100%);
  -webkit-background-clip: text;
  background-clip: text;
  opacity: 0;
}

/* 逐字动画 */
.philosophy-char {
  display: inline-block;
  opacity: 0;
  transform: translateY(10px);
  animation: charReveal 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes charReveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**火花效果**：每个字显现时，在字的边缘生成 3-5 个金色粒子向外飞溅

### 5.5 阶段五：光晕脉动 (14s+)

**效果**：石碑底部有一圈微弱的光晕，像呼吸一样缓慢脉动

**实现**：
```css
.monolith-glow {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  width: 300px;
  height: 40px;
  background: radial-gradient(
    ellipse at center,
    rgba(42,77,110,0.3) 0%,
    transparent 70%
  );
  animation: glowPulse 4s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.3; transform: translateX(-50%) scale(1); }
  50% { opacity: 0.6; transform: translateX(-50%) scale(1.1); }
}
```

### 5.6 交互：鼠标视差

**效果**：鼠标移动时，整个场景有轻微的 3D 视差偏移

**实现**：
```javascript
document.addEventListener('mousemove', function(e) {
  var x = (e.clientX / window.innerWidth - 0.5) * 2;
  var y = (e.clientY / window.innerHeight - 0.5) * 2;
  
  var monolith = document.querySelector('.monolith');
  if (monolith) {
    monolith.style.transform = 
      'perspective(1000px) ' +
      'rotateX(' + (5 + y * 3) + 'deg) ' +
      'rotateY(' + (x * 5) + 'deg) ' +
      'translateY(0)';
  }
});
```

### 5.7 退出：石碑碎裂

**效果**：点击"进入"按钮后，石碑从中心裂开，碎片向四周飞散，露出背后的浏览器界面

**实现**：
- 将石碑分成 20x30 个小块
- 每个小块有随机的飞散方向和旋转
- 使用 CSS 3D transform 实现碎片飞散
- 背景从黑色渐变为浏览器主题色

---

## 六、星云背景 Shader

```glsl
// 顶点着色器
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}

// 片段着色器
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;

// Simplex noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 center = vec2(0.5, 0.5);
  vec2 toCenter = uv - center;
  float dist = length(toCenter);
  float angle = atan(toCenter.y, toCenter.x);
  
  // 旋转的星云
  float noise1 = snoise(vec2(
    dist * 3.0 - u_time * 0.1,
    angle * 2.0 + u_time * 0.05
  ));
  float noise2 = snoise(vec2(
    dist * 5.0 + u_time * 0.08,
    angle * 3.0 - u_time * 0.03
  ));
  
  float nebula = noise1 * 0.5 + noise2 * 0.3;
  nebula = smoothstep(-0.5, 0.5, nebula);
  
  // 颜色：极深的蓝黑色
  vec3 color1 = vec3(0.01, 0.01, 0.02);
  vec3 color2 = vec3(0.02, 0.03, 0.05);
  vec3 color3 = vec3(0.04, 0.06, 0.1);
  
  vec3 finalColor = mix(color1, color2, nebula);
  finalColor = mix(finalColor, color3, noise2 * 0.5);
  
  // 中心微光
  float centerGlow = exp(-dist * dist * 4.0) * 0.1;
  finalColor += vec3(0.05, 0.08, 0.12) * centerGlow;
  
  gl_FragColor = vec4(finalColor, 1.0);
}
```

---

## 七、文件变更计划

### 7.1 修改文件

1. **`src/css/welcome.css`** — 完全重写
   - 移除所有旧样式
   - 实现新的视觉规范
   - 添加 3D 变换和动画

2. **`src/js/modules/welcome.js`** — 完全重写
   - 移除旧逻辑
   - 实现新的时间线控制
   - 添加 WebGL 星云背景
   - 添加鼠标视差交互
   - 添加石碑碎裂退出动画

3. **`src/js/modules/welcome-particles.js`** — 删除或重写
   - 旧粒子系统太简单，替换为火花粒子系统

4. **`src/index.html`** — 可选修改
   - 如需引入新字体，添加 Google Fonts 链接

### 7.2 新增文件

1. **`src/js/modules/welcome-shader.js`** — WebGL 星云背景

---

## 八、实施步骤

### Step 1: 重写 CSS
- 创建新的视觉基础（色彩、字体、空间）
- 实现石碑 3D 样式
- 实现所有动画 keyframes

### Step 2: 重写 welcome.js
- 实现动画时间线控制器
- 实现哲学文字逐字显现
- 实现鼠标视差
- 实现退出碎裂动画

### Step 3: 实现 WebGL 星云
- 创建 shader 程序
- 实现流体噪声动画
- 与 CSS 动画同步

### Step 4: 实现火花粒子
- 在文字显现时生成粒子
- 粒子有重力、衰减、颜色变化

### Step 5: 测试与优化
- 测试动画流畅度
- 测试低端设备兼容性
- 添加静态回退方案

---

## 九、验收标准

- [ ] 打开瞬间有"震撼"感，不是"花哨"感
- [ ] 整体色调极致克制，没有饱和色
- [ ] 石碑有真实的 3D 质感和重量感
- [ ] Logo 有金属/石刻质感，不是简单的文字
- [ ] 哲学文字竖排，逐字显现时有仪式感
- [ ] 鼠标移动时有微妙的视差效果
- [ ] 退出时有石碑碎裂的震撼动画
- [ ] 60fps 流畅运行
- [ ] 低端设备有静态回退
- [ ] 整体风格：高端、神秘、克制、有深度

---

## 十、关键改进点总结

| 方面 | V5 (旧) | V6 (新) |
|------|---------|---------|
| 技术 | Three.js (600KB) | 纯 CSS/Canvas/WebGL |
| 色彩 | 蓝紫渐变，花哨 | 单色冷调，克制 |
| Logo | 140px SVG，小气 | 72px 大字，金属质感 |
| 文字 | 横排，普通 | 竖排，刻字效果 |
| 背景 | 简单粒子 | 流体星云 Shader |
| 石碑 | 无 | 3D 黑色石碑 |
| 动画 | 大爆炸(卡通) | 奇点爆发(电影感) |
| 退出 | Fade out | 石碑碎裂 |
| 交互 | 无 | 鼠标视差 |
| 整体感觉 | 花哨、轻浮 | 高端、神秘 |
