# Drift 浏览器 — 首次启动欢迎页 V5 震撼版

> **目标**: 真正震撼、令人过目不忘的首次启动体验
> **核心哲学**: "以不诱于誉，不恐于诽，率道而行，端然正己，不为物倾侧"
> **设计理念**: 全屏视频级视觉 + 3D 空间感 + 声音设计

---

## 一、视觉概念："虚空中的碑"

想象用户打开浏览器，看到的不是网页，而是一块**悬浮在虚空中的巨大石碑**。

- 背景：深邃的宇宙星空（真实的 NASA 星空图或 Shader 生成）
- 中央：一块半透明的黑色石碑，表面有细微的纹理
- 石碑上：Drift Logo 以金属质感呈现
- 石碑下方：五句哲学文字逐字刻出，发出微弱的蓝光
- 石碑底部：一个发光的圆环，像传送门

---

## 二、技术实现：WebGL + Three.js

使用 Three.js 创建真正的 3D 场景：

```
Scene
├── Camera (缓慢环绕)
├── Starfield (10000 颗星星，Shader 生成)
├── Monolith (石碑，BoxGeometry + 自定义 Shader)
│   ├── Logo Texture (Canvas 生成金属质感文字)
│   └── Glow Effect (边缘发光)
├── Philosophy Text (5 个 PlaneGeometry，逐字显现)
└── Portal Ring (TorusGeometry，旋转发光)
```

### 动画时间线

```
0s      → 黑屏
0.5s    → 星空从中心爆发展开
2s      → 石碑从虚空中凝聚（粒子汇聚）
4s      → Logo 金属质感显现
6s      → 哲学文字逐字刻出（带火花粒子）
10s     → 底部传送门开始旋转
12s     → "触摸石碑进入" 提示出现
```

### 交互

- **鼠标移动**: 视角轻微偏移（视差效果）
- **鼠标滚轮**: 摄像机推进/拉远
- **点击石碑**: 石碑碎裂成粒子，露出背后的浏览器界面
- **键盘任意键**: 跳过动画

---

## 三、声音设计（可选）

- 星空展开：低沉的宇宙嗡鸣
- 石碑凝聚：金属撞击声
- 文字刻出：刻刀刮石声
- 传送门旋转：能量流动声

---

## 四、文件结构

```
src/
├── css/
│   └── welcome.css          ← 极简，仅基础样式
├── js/
│   └── modules/
│       ├── welcome-three.js  ← Three.js 3D 场景
│       ├── welcome-shaders.js ← 自定义 Shader
│       └── welcome.js        ← 逻辑控制
├── assets/
│   └── starfield.jpg         ← 星空纹理（或程序生成）
```

---

## 五、代码核心

### 石碑 Shader

```glsl
// Vertex Shader
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// Fragment Shader
uniform float uTime;
uniform sampler2D uLogoTexture;
uniform vec3 uGlowColor;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  // 基础颜色
  vec3 baseColor = vec3(0.02, 0.02, 0.03);
  
  // Logo 纹理
  vec4 logo = texture2D(uLogoTexture, vUv);
  
  // 边缘发光
  float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
  vec3 glow = uGlowColor * fresnel * 0.5;
  
  // 脉冲效果
  float pulse = sin(uTime * 0.5) * 0.1 + 0.9;
  
  // 最终颜色
  vec3 finalColor = baseColor + logo.rgb * pulse + glow;
  
  gl_FragColor = vec4(finalColor, 1.0);
}
```

### 星空 Shader

```glsl
// 程序生成星空
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
  vec2 st = gl_FragCoord.xy / uResolution;
  float star = random(st) > 0.999 ? 1.0 : 0.0;
  gl_FragColor = vec4(vec3(star), 1.0);
}
```

---

## 六、性能优化

- 使用 `requestAnimationFrame`
- 限制粒子数量（石碑碎裂时最多 5000 个）
- 使用 `BufferGeometry` 而非普通 `Geometry`
- 纹理压缩（使用 WebP 或 KTX2）
- 移动端降级：静态图片 + CSS 动画

---

## 七、回退方案

如果 Three.js 加载失败或设备不支持 WebGL：
- 显示静态版本：星空背景图 + CSS 动画
- 保持相同的视觉风格，只是没有 3D 交互

---

## 八、实施步骤

1. 引入 Three.js（CDN 或本地）
2. 创建基础 3D 场景
3. 实现星空背景
4. 创建石碑模型 + Shader
5. 实现 Logo 金属质感
6. 实现哲学文字逐字显现
7. 实现传送门动画
8. 添加交互（鼠标/点击）
9. 添加退出动画（石碑碎裂）
10. 性能优化 + 回退方案

---

## 九、验收标准

- [ ] 打开瞬间有"哇"的感觉
- [ ] 3D 场景流畅 60fps
- [ ] 石碑有真实的金属质感
- [ ] 哲学文字逐字显现有仪式感
- [ ] 点击石碑有震撼的碎裂效果
- [ ] 整体风格高端、神秘、有深度
