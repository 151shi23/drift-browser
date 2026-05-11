// ==================== Drift 首次启动欢迎页 V7 核心 ====================
// 虚空创世 - 极简克制 + 极致光影 + 空间纵深感 + 电影级动画
(function() {
  var overlay, monolithContainer, monolith, tutorial, complete, config;
  var currentStep = 0;
  var stepScores = [0, 0, 0, 0, 0];
  var isRunning = false;
  var parallaxEnabled = false;
  var sparkCanvas, sparkCtx;
  var nebulaCanvas, nebulaGl;
  var startTime = 0;
  var bridgeBtn = null;
  var tutorialDone = false;
  var skipBtn = null;
  var stepCompleted = false;
  var activeListeners = [];
  var activeIntervals = [];
  var activeObservers = [];
  var tutorialCanvas, tutorialCanvasCtx;
  var spotLightRect = null;
  var spotLightAnimId = null;

  var PHILOSOPHY_TEXT = [
    ['行', '远', '必', '自', '迩'],
    ['登', '高', '必', '自', '卑'],
    ['合', '抱', '之', '木', '生'],
    ['九', '层', '之', '台', '起'],
    ['千', '里', '之', '行', '始']
  ];

  var STEPS = [
    { id: 'nav', title: '智能导航', hint: '点击地址栏，输入任意内容搜索', target: '#urlBar' },
    { id: 'tab', title: '标签管理', hint: '点击 "+" 按钮新建标签页', target: '#btnNewTab' },
    { id: 'ai', title: 'AI 助手', hint: '按 <span class="hint-key">Ctrl</span>+<span class="hint-key">Shift</span>+<span class="hint-key">A</span> 打开 AI 对话', target: null },
    { id: 'shortcut', title: '快捷操作', hint: '按 <span class="hint-key">Ctrl</span>+<span class="hint-key">Shift</span>+<span class="hint-key">P</span> 打开命令面板', target: null },
    { id: 'theme', title: '主题切换', hint: '点击菜单，切换深色/浅色主题', target: '#btnMenu' }
  ];

  function init() {
    var FBC = window.FBrowser && window.FBrowser.config ? window.FBrowser.config : null;
    var cfg = FBC ? FBC.getConfig() : {};
    tutorialDone = cfg.welcomeTutorialDone || false;
    var welcomeAnimEnabled = cfg.welcomeAnimation !== false;

    createElements();
    initNebula();
    initSparks();
    bindEvents();

    if (!welcomeAnimEnabled) {
      finishWelcomeDirect();
    } else {
      startIntro();
    }
  }

  function createElements() {
    overlay = document.createElement('div');
    overlay.id = 'welcomeOverlay';
    overlay.className = 'welcome-overlay';

    var nebulaCanvasEl = document.createElement('canvas');
    nebulaCanvasEl.id = 'welcomeNebula';
    overlay.appendChild(nebulaCanvasEl);
    nebulaCanvas = nebulaCanvasEl;

    var singularity = document.createElement('div');
    singularity.className = 'welcome-singularity';
    overlay.appendChild(singularity);

    sparkCanvas = document.createElement('canvas');
    sparkCanvas.id = 'welcomeSparks';
    overlay.appendChild(sparkCanvas);

    monolithContainer = document.createElement('div');
    monolithContainer.className = 'welcome-monolith-container';

    monolith = document.createElement('div');
    monolith.className = 'welcome-monolith';

    var content = document.createElement('div');
    content.className = 'monolith-content';

    var logo = document.createElement('div');
    logo.className = 'monolith-logo';
    logo.textContent = 'DRIFT';
    content.appendChild(logo);

    var sub = document.createElement('div');
    sub.className = 'monolith-logo-sub';
    sub.textContent = 'Browser';
    content.appendChild(sub);

    var divider = document.createElement('div');
    divider.className = 'monolith-divider';
    content.appendChild(divider);

    var philosophy = document.createElement('div');
    philosophy.className = 'monolith-philosophy';
    PHILOSOPHY_TEXT.forEach(function(column, colIndex) {
      var col = document.createElement('div');
      col.className = 'philosophy-column';
      column.forEach(function(char, charIndex) {
        var span = document.createElement('span');
        span.className = 'philosophy-char';
        span.textContent = char;
        span.dataset.col = colIndex;
        span.dataset.idx = charIndex;
        col.appendChild(span);
      });
      philosophy.appendChild(col);
    });
    content.appendChild(philosophy);
    monolith.appendChild(content);

    var glow = document.createElement('div');
    glow.className = 'monolith-glow';
    monolith.appendChild(glow);

    var aura = document.createElement('div');
    aura.className = 'monolith-aura';
    monolithContainer.appendChild(aura);

    monolithContainer.appendChild(monolith);
    overlay.appendChild(monolithContainer);

    var enterWrap = document.createElement('div');
    enterWrap.className = 'welcome-enter-wrap';
    var enterBtn = document.createElement('button');
    enterBtn.className = 'welcome-enter-btn';
    enterBtn.id = 'welcomeEnterBtn';
    enterBtn.textContent = '欢 迎';
    enterWrap.appendChild(enterBtn);
    overlay.appendChild(enterWrap);



    document.body.appendChild(overlay);

    // 教程 Canvas 遮罩 — 用 canvas 绘制四块遮罩区域，中间留透明洞
    tutorialCanvas = document.createElement('canvas');
    tutorialCanvas.id = 'tutorialOverlayCanvas';
    tutorialCanvas.className = 'tutorial-overlay-canvas';
    document.body.appendChild(tutorialCanvas);

    tutorial = document.createElement('div');
    tutorial.className = 'welcome-tutorial';
    tutorial.id = 'welcomeTutorial';
    tutorial.innerHTML =
      '<div class="tutorial-header">' +
        '<div class="tutorial-progress" id="tutorialProgress"></div>' +
        '<div class="tutorial-step-title" id="tutorialStepTitle"></div>' +
      '</div>' +
      '<div class="tutorial-hint" id="tutorialHint"></div>' +
      '<div class="tutorial-bottom-bar">' +
        '<button class="tutorial-skip-tutorial-btn" id="tutorialSkipTutorialBtn">跳过教程</button>' +
        '<button class="tutorial-skip-btn" id="tutorialSkipBtn">跳过此步</button>' +
      '</div>';
    document.body.appendChild(tutorial);

    complete = document.createElement('div');
    complete.className = 'welcome-complete';
    complete.id = 'welcomeComplete';
    complete.innerHTML =
      '<div class="complete-title">实战演练完成</div>' +
      '<div class="complete-stars" id="completeStars"></div>' +
      '<div class="complete-actions">' +
        '<button class="welcome-enter-btn" id="welcomeConfigBtn">个性化设置</button>' +
        '<button class="complete-got-it-btn" id="welcomeGotItBtn">知道了</button>' +
      '</div>';
    document.body.appendChild(complete);

    config = document.createElement('div');
    config.className = 'welcome-config';
    config.id = 'welcomeConfig';
    config.innerHTML =
      '<div class="config-card">' +
        '<div class="config-title">让 Drift 成为你的专属浏览器</div>' +
        '<div class="config-group">' +
          '<div class="config-label">选择主题</div>' +
          '<div class="config-options" data-config="theme">' +
            '<button class="config-option active" data-value="dark">深色</button>' +
            '<button class="config-option" data-value="light">浅色</button>' +
          '</div>' +
        '</div>' +
        '<div class="config-group">' +
          '<div class="config-label">主页风格</div>' +
          '<div class="config-options" data-config="homeStyle">' +
            '<button class="config-option active" data-value="classic">经典</button>' +
            '<button class="config-option" data-value="cyber">仪表盘</button>' +
          '</div>' +
        '</div>' +
        '<div class="config-group">' +
          '<div class="config-label">默认搜索引擎</div>' +
          '<div class="config-options" data-config="engine">' +
            '<button class="config-option active" data-value="baidu">百度</button>' +
            '<button class="config-option" data-value="google">Google</button>' +
            '<button class="config-option" data-value="bing">Bing</button>' +
          '</div>' +
        '</div>' +
        '<button class="config-launch-btn" id="welcomeLaunchBtn">启动 Drift</button>' +
      '</div>';
    document.body.appendChild(config);
  }

  // ==================== WebGL 星云背景 ====================
  function initNebula() {
    if (!nebulaCanvas) return;
    var gl = nebulaCanvas.getContext('webgl') || nebulaCanvas.getContext('experimental-webgl');
    if (!gl) {
      nebulaCanvas.style.background = '#000';
      return;
    }
    nebulaGl = gl;
    resizeNebula();
    window.addEventListener('resize', resizeNebula);

    var vsSource = 'attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.0,1.0);}';
    var fsSource =
      'precision highp float;' +
      'uniform float u_time;uniform vec2 u_resolution;' +
      'vec2 rot(vec2 p,float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c)*p;}' +
      'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}' +
      'float noise(vec2 p){' +
      'vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);' +
      'float a=hash(i);float b=hash(i+vec2(1,0));float c=hash(i+vec2(0,1));float d=hash(i+vec2(1,1));' +
      'return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}' +
      'float fbm(vec2 p){' +
      'float v=0.0;float a=0.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);' +
      'for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=0.5;}return v;}' +
      'void main(){' +
      'vec2 uv=(gl_FragCoord.xy-0.5*u_resolution)/min(u_resolution.x,u_resolution.y);' +
      'float t=u_time*0.15;' +
      'uv=rot(uv,t*0.12);' +
      'float d=length(uv);' +
      'float n1=fbm(uv*2.0+vec2(t*0.3,t*0.2));' +
      'float n2=fbm(uv*3.5-t*0.15+vec2(n1*0.8));' +
      'float n3=fbm(uv*6.0+vec2(t*0.1,n2*1.5));' +
      'float aurora=smoothstep(0.2,0.7,n1)*smoothstep(0.9,0.3,d);' +
      'aurora*=pow(abs(sin(d*4.0-n2*3.0+t*2.0)),0.5);' +
      'aurora+=n3*0.15*smoothstep(0.7,0.0,d);' +
      'float ring=pow(abs(sin(d*12.0-u_time*0.3+n1*5.0)),8.0)*0.06;' +
      'ring*=smoothstep(1.0,0.3,d);' +
      'vec3 colDeep=vec3(0.005,0.02,0.01);' +
      'vec3 colGreen=vec3(0.03,0.5,0.15);' +
      'vec3 colEmerald=vec3(0.02,0.28,0.1);' +
      'vec3 colTeal=vec3(0.01,0.08,0.12);' +
      'vec3 colCyan=vec3(0.02,0.2,0.18);' +
      'vec3 col=colDeep;' +
      'col=mix(col,colEmerald,aurora*0.6);' +
      'col=mix(col,colGreen,aurora*aurora*0.8*pow(n2+0.5,2.0));' +
      'col=mix(col,colTeal,(1.0-d)*n3*0.35);' +
      'col+=colCyan*ring;' +
      'float centerGlow=exp(-d*d*5.0)*0.12;' +
      'col+=vec3(0.03,0.25,0.08)*centerGlow;' +
      'float vignette=1.0-dot(uv,uv)*0.6;col*=vignette;' +
      'float star=hash(floor(gl_FragCoord.xy/3.0));' +
      'if(star>0.985){float twinkle=pow(sin((star*100.0+u_time*3.0))*0.5+0.5,8.0);col+=vec3(0.3,0.7,0.4)*twinkle*0.5;}' +
      'gl_FragColor=vec4(col,1.0);}';

    function compileShader(source, type) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    var vs = compileShader(vsSource, gl.VERTEX_SHADER);
    var fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    gl.useProgram(program);
    var positions = new Float32Array([-1, -1, 3, -1, -1, 3]);
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    var aPosition = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    var uTime = gl.getUniformLocation(program, 'u_time');
    var uResolution = gl.getUniformLocation(program, 'u_resolution');
    startTime = Date.now();

    function renderNebula() {
      if (!isRunning || !nebulaGl) return;
      var time = (Date.now() - startTime) / 1000;
      gl.uniform1f(uTime, time);
      gl.uniform2f(uResolution, nebulaCanvas.width, nebulaCanvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(renderNebula);
    }
    requestAnimationFrame(renderNebula);
  }

  function resizeNebula() {
    if (!nebulaCanvas || !nebulaGl) return;
    var dpr = window.devicePixelRatio || 1;
    nebulaCanvas.width = window.innerWidth * dpr;
    nebulaCanvas.height = window.innerHeight * dpr;
    nebulaCanvas.style.width = window.innerWidth + 'px';
    nebulaCanvas.style.height = window.innerHeight + 'px';
    nebulaGl.viewport(0, 0, nebulaCanvas.width, nebulaCanvas.height);
  }

  // ==================== 火花粒子系统 ====================
  var ambientParticles = [];
  function initSparks() {
    if (!sparkCanvas) return;
    sparkCtx = sparkCanvas.getContext('2d');
    resizeSparks();
    window.addEventListener('resize', resizeSparks);
    for (var i = 0; i < 40; i++) {
      ambientParticles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 1.5 + 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: -Math.random() * 0.4 - 0.1,
        opacity: Math.random() * 0.4 + 0.1,
        pulse: Math.random() * Math.PI * 2
      });
    }
    animateAmbientParticles();
  }

  function resizeSparks() {
    if (!sparkCanvas) return;
    sparkCanvas.width = window.innerWidth;
    sparkCanvas.height = window.innerHeight;
  }

  function animateAmbientParticles() {
    if (!sparkCtx || !isRunning) return;
    var t = Date.now() / 1000;
    sparkCtx.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height);
    for (var i = 0; i < ambientParticles.length; i++) {
      var p = ambientParticles[i];
      p.x += p.speedX + Math.sin(t + p.pulse) * 0.15;
      p.y += p.speedY;
      if (p.y < -10) { p.y = sparkCanvas.height + 10; p.x = Math.random() * sparkCanvas.width; }
      if (p.x < -10) p.x = sparkCanvas.width + 10;
      if (p.x > sparkCanvas.width + 10) p.x = -10;
      var flicker = Math.sin(t * 3 + p.pulse) * 0.3 + 0.7;
      sparkCtx.beginPath();
      sparkCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      sparkCtx.fillStyle = 'rgba(' + Math.floor(60 + flicker * 40) + ',' + Math.floor(200 + flicker * 55) + ',' + Math.floor(100 + flicker * 80) + ',' + (p.opacity * flicker) + ')';
      sparkCtx.fill();
    }
    requestAnimationFrame(animateAmbientParticles);
  }

  function createSparks(x, y, count) {
    if (!sparkCtx) return;
    var sparks = [];
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 1 + Math.random() * 3;
      sparks.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        decay: 0.02 + Math.random() * 0.03,
        size: 1 + Math.random() * 2.5,
        color: Math.random() > 0.4 ? '80,220,120' : '150,255,180'
      });
    }
    animateSparks(sparks);
  }

  function animateSparks(sparks) {
    if (!sparkCtx || sparks.length === 0) return;
    sparkCtx.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height);
    for (var i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i];
      s.x += s.vx; s.y += s.vy; s.vy += 0.05; s.life -= s.decay;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      sparkCtx.beginPath();
      sparkCtx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
      sparkCtx.fillStyle = 'rgba(' + s.color + ',' + s.life * 0.8 + ')';
      sparkCtx.fill();
    }
    if (sparks.length > 0) {
      requestAnimationFrame(function() { animateSparks(sparks); });
    } else {
      sparkCtx.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height);
    }
  }

  // ==================== 哲学文字逐字显现 ====================
  function revealPhilosophy() {
    PHILOSOPHY_TEXT.forEach(function(column, colIndex) {
      column.forEach(function(char, charIndex) {
        var el = overlay.querySelector('.philosophy-char[data-col="' + colIndex + '"][data-idx="' + charIndex + '"]');
        if (el) {
          var charDelay = (colIndex * 4 + charIndex) * 300;
          setTimeout(function() {
            el.classList.add('revealed');
            var rect = el.getBoundingClientRect();
            createSparks(rect.left + rect.width / 2, rect.top + rect.height / 2, 4);
          }, charDelay);
        }
      });
    });
  }

  // ==================== 鼠标视差 ====================
  function bindParallax() {
    document.addEventListener('mousemove', function(e) {
      if (!parallaxEnabled || !monolith) return;
      var x = (e.clientX / window.innerWidth - 0.5) * 2;
      var y = (e.clientY / window.innerHeight - 0.5) * 2;
      monolith.style.transform =
        'perspective(1200px) rotateX(' + (5 + y * 3) + 'deg) rotateY(' + (x * 5) + 'deg) translateY(0)';
      monolith.style.transition = 'transform 0.3s ease-out';
    });
  }

  // ==================== 石碑碎裂 ====================
  function shatterMonolith() {
    if (!monolith || !monolithContainer) return;
    var rect = monolith.getBoundingClientRect();
    var cols = 12, rows = 18;
    var shardW = rect.width / cols, shardH = rect.height / rows;
    var shardsContainer = document.createElement('div');
    shardsContainer.className = 'monolith-shards';
    shardsContainer.style.width = rect.width + 'px';
    shardsContainer.style.height = rect.height + 'px';
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var shard = document.createElement('div');
        shard.className = 'monolith-shard shatter';
        shard.style.width = shardW + 'px';
        shard.style.height = shardH + 'px';
        shard.style.left = (c * shardW) + 'px';
        shard.style.top = (r * shardH) + 'px';
        shard.style.setProperty('--tx', ((Math.random() - 0.5) * 800) + 'px');
        shard.style.setProperty('--ty', ((Math.random() - 0.5) * 800) + 'px');
        shard.style.setProperty('--rot', ((Math.random() - 0.5) * 720) + 'deg');
        shard.style.animationDelay = (Math.random() * 0.3) + 's';
        shardsContainer.appendChild(shard);
      }
    }
    monolithContainer.appendChild(shardsContainer);
    monolith.style.opacity = '0';
    monolith.style.transition = 'opacity 0.1s';
    setTimeout(function() { if (monolith) monolith.style.display = 'none'; }, 100);
  }

  // ==================== Canvas 遮罩层（真正的透明挖洞） ====================
  function initTutorialCanvas() {
    if (!tutorialCanvas) return;
    tutorialCanvasCtx = tutorialCanvas.getContext('2d');
    resizeTutorialCanvas();
    window.addEventListener('resize', resizeTutorialCanvas);
  }

  function resizeTutorialCanvas() {
    if (!tutorialCanvas) return;
    var dpr = window.devicePixelRatio || 1;
    tutorialCanvas.width = window.innerWidth * dpr;
    tutorialCanvas.height = window.innerHeight * dpr;
    tutorialCanvas.style.width = window.innerWidth + 'px';
    tutorialCanvas.style.height = window.innerHeight + 'px';
    drawTutorialMask();
  }

  function drawTutorialMask() {
    if (!tutorialCanvasCtx) return;
    var ctx = tutorialCanvasCtx;
    var w = tutorialCanvas.width;
    var h = tutorialCanvas.height;
    var dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, w, h);

    if (!spotLightRect) return;

    var pad = 12 * dpr;
    var x = (spotLightRect.left - 12) * dpr;
    var y = (spotLightRect.top - 12) * dpr;
    var rw = (spotLightRect.width + 24) * dpr;
    var rh = (spotLightRect.height + 24) * dpr;
    var radius = 12 * dpr;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + rw - radius, y);
    ctx.quadraticCurveTo(x + rw, y, x + rw, y + radius);
    ctx.lineTo(x + rw, y + rh - radius);
    ctx.quadraticCurveTo(x + rw, y + rh, x + rw - radius, y + rh);
    ctx.lineTo(x + radius, y + rh);
    ctx.quadraticCurveTo(x, y + rh, x, y + rh - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(42, 77, 110, 0.35)';
    ctx.lineWidth = 2 * dpr;
    ctx.shadowColor = 'rgba(42, 77, 110, 0.4)';
    ctx.shadowBlur = 30 * dpr;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + rw - radius, y);
    ctx.quadraticCurveTo(x + rw, y, x + rw, y + radius);
    ctx.lineTo(x + rw, y + rh - radius);
    ctx.quadraticCurveTo(x + rw, y + rh, x + rw - radius, y + rh);
    ctx.lineTo(x + radius, y + rh);
    ctx.quadraticCurveTo(x, y + rh, x, y + rh - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    var outerGlow = 8 * dpr;
    var grd = ctx.createRadialGradient(
      x + rw / 2, y + rh / 2, Math.max(rw, rh) / 2,
      x + rw / 2, y + rh / 2, Math.max(rw, rh) / 2 + outerGlow * 3
    );
    grd.addColorStop(0, 'rgba(42, 77, 110, 0.15)');
    grd.addColorStop(1, 'rgba(42, 77, 110, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(x - outerGlow * 3, y - outerGlow * 3, rw + outerGlow * 6, rh + outerGlow * 6);
  }

  function showTutorialCanvas() {
    if (!tutorialCanvas) return;
    tutorialCanvas.style.display = 'block';
  }

  function hideTutorialCanvas() {
    if (!tutorialCanvas) return;
    tutorialCanvas.style.display = 'none';
    spotLightRect = null;
  }

  function positionSpotlightCanvas(target) {
    if (!target) return;
    spotLightRect = target.getBoundingClientRect();
    showTutorialCanvas();
    drawTutorialMask();
  }

  // ==================== 桥接按钮（完整事件转发） ====================
  function createBridgeBtn(targetEl) {
    removeBridgeBtn();
    if (!targetEl) return;
    var rect = targetEl.getBoundingClientRect();
    var padding = 10;

    bridgeBtn = document.createElement('div');
    bridgeBtn.className = 'tutorial-bridge-btn';
    bridgeBtn.style.left = (rect.left - padding) + 'px';
    bridgeBtn.style.top = (rect.top - padding) + 'px';
    bridgeBtn.style.width = (rect.width + padding * 2) + 'px';
    bridgeBtn.style.height = (rect.height + padding * 2) + 'px';

    var forwardEvents = ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'pointerdown', 'pointerup'];
    forwardEvents.forEach(function(evtName) {
      bridgeBtn.addEventListener(evtName, function(e) {
        e.preventDefault();
        e.stopPropagation();
        var evt;
        if (evtName.indexOf('pointer') === 0) {
          evt = new PointerEvent(evtName, { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY });
        } else {
          evt = new MouseEvent(evtName, { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY, button: e.button, buttons: e.buttons });
        }
        targetEl.dispatchEvent(evt);
      });
    });

    bridgeBtn.addEventListener('mousedown', function() {
      targetEl.focus();
    });

    bridgeBtn.addEventListener('click', function() {
      targetEl.focus();
    });

    bridgeBtn.style.cursor = 'pointer';
    document.body.appendChild(bridgeBtn);
  }

  function removeBridgeBtn() {
    if (bridgeBtn) {
      bridgeBtn.remove();
      bridgeBtn = null;
    }
  }

  // ==================== 步骤监听器管理 ====================
  function addStepListener(el, event, handler) {
    if (el && el.addEventListener) {
      el.addEventListener(event, handler);
      activeListeners.push({ el: el, event: event, handler: handler });
    }
  }

  function addStepInterval(fn, ms) {
    var id = setInterval(fn, ms);
    activeIntervals.push(id);
    return id;
  }

  function addStepTimeout(fn, ms) {
    return setTimeout(fn, ms);
  }

  function addStepObserver(observer) {
    activeObservers.push(observer);
  }

  function cleanupStepListeners() {
    activeListeners.forEach(function(item) {
      item.el.removeEventListener(item.event, item.handler);
    });
    activeListeners = [];
    activeIntervals.forEach(function(id) { clearInterval(id); });
    activeIntervals = [];
    activeObservers.forEach(function(obs) { obs.disconnect(); });
    activeObservers = [];
    removeBridgeBtn();
  }

  // ==================== 事件绑定 ====================
  function bindEvents() {
    var enterBtn = document.getElementById('welcomeEnterBtn');
    if (enterBtn) {
      enterBtn.addEventListener('click', function() {
        if (tutorialDone) {
          finishWelcomeDirect();
        } else {
          shatterMonolith();
          setTimeout(startTutorial, 800);
        }
      });
    }

    var configBtn = document.getElementById('welcomeConfigBtn');
    if (configBtn) configBtn.addEventListener('click', showConfig);

    var gotItBtn = document.getElementById('welcomeGotItBtn');
    if (gotItBtn) gotItBtn.addEventListener('click', finishWelcomeDirect);

    var launchBtn = document.getElementById('welcomeLaunchBtn');
    if (launchBtn) launchBtn.addEventListener('click', finishWelcome);

    if (config) {
      config.querySelectorAll('.config-options').forEach(function(group) {
        group.addEventListener('click', function(e) {
          var btn = e.target.closest('.config-option');
          if (!btn) return;
          group.querySelectorAll('.config-option').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
        });
      });
    }



    var skipBtnEl = document.getElementById('tutorialSkipBtn');
    if (skipBtnEl) {
      skipBtnEl.addEventListener('click', function() {
        nextStep();
      });
    }

    var skipTutorialBtnEl = document.getElementById('tutorialSkipTutorialBtn');
    if (skipTutorialBtnEl) {
      skipTutorialBtnEl.addEventListener('click', function() {
        skipTutorial();
      });
    }

    bindParallax();
  }

  function skipToEnd() {
    var singularity = overlay.querySelector('.welcome-singularity');
    if (singularity) singularity.style.display = 'none';
    if (monolith) {
      monolith.style.animation = 'none';
      monolith.style.transform = 'perspective(1200px) rotateX(5deg) translateY(0)';
      monolith.style.opacity = '1';
    }
    var logo = overlay.querySelector('.monolith-logo');
    if (logo) { logo.style.animation = 'none'; logo.style.opacity = '1'; logo.style.transform = 'translateZ(0)'; logo.style.filter = 'blur(0)'; logo.style.color = '#e8e8e8'; }
    var sub = overlay.querySelector('.monolith-logo-sub');
    if (sub) sub.style.opacity = '1';
    var divider = overlay.querySelector('.monolith-divider');
    if (divider) divider.style.opacity = '1';
    var philosophy = overlay.querySelector('.monolith-philosophy');
    if (philosophy) philosophy.style.opacity = '1';
    overlay.querySelectorAll('.philosophy-char').forEach(function(ch) { ch.classList.add('revealed'); });
    var glow = overlay.querySelector('.monolith-glow');
    if (glow) { glow.style.animation = 'none'; glow.style.opacity = '1'; }
    var enterWrap = overlay.querySelector('.welcome-enter-wrap');
    if (enterWrap) { enterWrap.style.animation = 'none'; enterWrap.style.opacity = '1'; }
  }

  // ==================== 动画序列 ====================
  function startIntro() {
    isRunning = true;
    startTime = Date.now();
    setTimeout(revealPhilosophy, 8000);
    setTimeout(function() { parallaxEnabled = true; }, 5500);
  }

  // ==================== 演练系统 ====================
  function startTutorial() {
    overlay.classList.add('dismissed');
    isRunning = false;
    nebulaGl = null;

    initTutorialCanvas();
    tutorial.classList.add('active');
    currentStep = 0;
    stepCompleted = false;
    renderProgress();
    runStep(0);
  }

  function skipTutorial() {
    cleanupStepListeners();
    hideTutorialCanvas();
    tutorial.classList.remove('active');
    window.removeEventListener('resize', resizeTutorialCanvas);
    showComplete();
  }

  function renderProgress() {
    var progress = document.getElementById('tutorialProgress');
    if (!progress) return;
    progress.innerHTML = '';
    for (var i = 0; i < STEPS.length; i++) {
      var dot = document.createElement('div');
      dot.className = 'tutorial-progress-dot';
      if (i < currentStep) dot.classList.add('completed');
      else if (i === currentStep) dot.classList.add('active');
      progress.appendChild(dot);
    }
  }

  function runStep(index) {
    if (index >= STEPS.length) { showComplete(); return; }
    currentStep = index;
    stepCompleted = false;
    cleanupStepListeners();

    var step = STEPS[index];

    var title = document.getElementById('tutorialStepTitle');
    if (title) title.textContent = '第 ' + (index + 1) + '/5 步 · ' + step.title;

    var hint = document.getElementById('tutorialHint');
    if (hint) {
      hint.innerHTML = step.hint + (step.target ? ' <span class="hint-arrow">→</span>' : '');
      hint.style.animation = 'none';
      hint.offsetHeight;
      hint.style.animation = 'hintIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
    }

    if (step.target) {
      var target = document.querySelector(step.target);
      if (target) {
        positionSpotlightCanvas(target);
        createBridgeBtn(target);
      }
    } else {
      hideTutorialCanvas();
      removeBridgeBtn();
    }

    renderProgress();
    listenForStepCompletion(step);
  }

  function markStepDone(scoreIndex) {
    if (stepCompleted) return;
    stepCompleted = true;
    cleanupStepListeners();
    hideTutorialCanvas();
    showSuccessAnimation();
    stepScores[scoreIndex] = 3;
    addStepTimeout(nextStep, 1500);
  }

  function listenForStepCompletion(step) {
    switch (step.id) {
      case 'nav': listenForNav(); break;
      case 'tab': listenForTab(); break;
      case 'ai': listenForAI(); break;
      case 'shortcut': listenForShortcut(); break;
      case 'theme': listenForTheme(); break;
    }
  }

  function listenForNav() {
    var addressBar = document.getElementById('urlBar');
    if (!addressBar) { markStepDone(0); return; }
    var handler = function() { markStepDone(0); };
    addStepListener(addressBar, 'keydown', handler);
    addStepListener(addressBar, 'input', handler);
  }

  function listenForTab() {
    var btnNewTab = document.getElementById('btnNewTab');
    if (!btnNewTab) { markStepDone(1); return; }
    var handler = function() { markStepDone(1); };
    addStepListener(btnNewTab, 'click', handler);
  }

  function listenForAI() {
    var handler = function(e) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        markStepDone(2);
      }
    };
    addStepListener(document, 'keydown', handler);

    var checkInterval = addStepInterval(function() {
      if (window.FBrowser && window.FBrowser.floatChat && window.FBrowser.floatChat.isVisible && window.FBrowser.floatChat.isVisible()) {
        markStepDone(2);
      }
    }, 500);
    addStepTimeout(function() {
      var idx = activeIntervals.indexOf(checkInterval);
      if (idx !== -1) { clearInterval(checkInterval); activeIntervals.splice(idx, 1); }
    }, 60000);
  }

  function listenForShortcut() {
    var handler = function(e) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        markStepDone(3);
      }
    };
    addStepListener(document, 'keydown', handler);
  }

  function listenForTheme() {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName === 'data-theme') {
          markStepDone(4);
        }
      });
    });
    observer.observe(document.body, { attributes: true });
    addStepObserver(observer);
  }

  function nextStep() {
    runStep(currentStep + 1);
  }

  function showSuccessAnimation() {
    var successOverlay = document.createElement('div');
    successOverlay.className = 'tutorial-success-overlay active';
    successOverlay.style.position = 'fixed';
    successOverlay.style.inset = '0';
    successOverlay.style.zIndex = '100002';
    successOverlay.style.pointerEvents = 'none';

    var centerX = window.innerWidth / 2;
    var centerY = window.innerHeight / 2;

    var shockwave = document.createElement('div');
    shockwave.className = 'success-shockwave';
    shockwave.style.left = centerX + 'px';
    shockwave.style.top = centerY + 'px';
    successOverlay.appendChild(shockwave);

    var particleColors = ['rgba(200,210,230,', 'rgba(150,170,200,', 'rgba(42,77,110,', 'rgba(255,255,255,'];
    for (var i = 0; i < 36; i++) {
      var particle = document.createElement('div');
      particle.className = 'success-particle';
      particle.style.left = centerX + 'px';
      particle.style.top = centerY + 'px';
      particle.style.background = particleColors[Math.floor(Math.random() * particleColors.length)] + (0.4 + Math.random() * 0.5) + ')';
      particle.style.width = (3 + Math.random() * 4) + 'px';
      particle.style.height = particle.style.width;
      var angle = (Math.PI * 2 * i) / 36;
      var distance = 80 + Math.random() * 180;
      particle.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
      particle.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
      successOverlay.appendChild(particle);
    }

    var successText = document.createElement('div');
    successText.className = 'success-text';
    successText.textContent = '完成';
    successText.style.left = centerX + 'px';
    successText.style.top = (centerY - 40) + 'px';
    successText.style.transform = 'translate(-50%, -50%)';
    successOverlay.appendChild(successText);

    document.body.appendChild(successOverlay);
    setTimeout(function() { successOverlay.remove(); }, 1800);
  }

  function showComplete() {
    cleanupStepListeners();
    hideTutorialCanvas();
    if (tutorialCanvas) tutorialCanvas.remove();
    window.removeEventListener('resize', resizeTutorialCanvas);
    tutorial.classList.remove('active');
    if (overlay) overlay.remove();
    complete.classList.add('active');
    var starsContainer = document.getElementById('completeStars');
    if (starsContainer) {
      starsContainer.innerHTML = '';
      STEPS.forEach(function(step, i) {
        var item = document.createElement('div');
        item.className = 'complete-star-item';
        var icon = document.createElement('div');
        icon.className = 'complete-star-icon' + (stepScores[i] > 0 ? ' completed' : '');
        icon.innerHTML = stepScores[i] > 0 ? '&#10003;' : '&#8211;';
        var label = document.createElement('div');
        label.className = 'complete-star-label';
        label.textContent = step.title;
        item.appendChild(icon);
        item.appendChild(label);
        starsContainer.appendChild(item);
      });
    }
  }

  function showConfig() {
    complete.classList.remove('active');
    hideTutorialCanvas();
    if (tutorialCanvas) tutorialCanvas.remove();
    config.classList.add('active');
  }

  function finishWelcome() {
    var settings = {};
    config.querySelectorAll('.config-options').forEach(function(group) {
      var key = group.dataset.config;
      var active = group.querySelector('.config-option.active');
      if (active) settings[key] = active.dataset.value;
    });
    if (settings.theme) document.body.setAttribute('data-theme', settings.theme);
    if (settings.homeStyle && window.HomeGrid) window.HomeGrid.applyHomeStyle(settings.homeStyle);

    var FBC = window.FBrowser && window.FBrowser.config ? window.FBrowser.config : null;
    if (FBC) {
      var cfg = FBC.getConfig();
      cfg.welcomeShown = true;
      cfg.welcomeTutorialDone = true;
      if (settings.theme) cfg.theme = settings.theme;
      if (settings.homeStyle) cfg.homeStyle = settings.homeStyle;
      if (settings.engine) cfg.searchEngine = settings.engine;
      FBC.saveConfig();
    }
    cleanup();
  }

  function finishWelcomeDirect() {
    var FBC = window.FBrowser && window.FBrowser.config ? window.FBrowser.config : null;
    if (FBC) {
      var cfg = FBC.getConfig();
      cfg.welcomeShown = true;
      cfg.welcomeTutorialDone = true;
      FBC.saveConfig();
    }
    if (overlay && overlay.parentNode) {
      overlay.classList.add('hidden');
      setTimeout(function() { cleanup(); }, 1200);
    } else {
      cleanup();
    }
    isRunning = false;
  }

  function cleanup() {
    isRunning = false;
    parallaxEnabled = false;
    cleanupStepListeners();
    hideTutorialCanvas();
    window.removeEventListener('resize', resizeTutorialCanvas);
    window.removeEventListener('resize', resizeNebula);
    window.removeEventListener('resize', resizeSparks);
    nebulaGl = null;
    sparkCtx = null;
    if (overlay) overlay.remove();
    if (tutorialCanvas) tutorialCanvas.remove();
    if (tutorial) tutorial.remove();
    if (complete) complete.remove();
    if (config) config.remove();
  }

  window.DriftWelcome = {
    init: init,
    isRunning: function() { return isRunning; },
    reset: function() {
      var FBC = window.FBrowser && window.FBrowser.config ? window.FBrowser.config : null;
      if (FBC) {
        var cfg = FBC.getConfig();
        cfg.welcomeShown = false;
        cfg.welcomeTutorialDone = false;
        FBC.saveConfig();
      }
      location.reload();
    }
  };
})();
