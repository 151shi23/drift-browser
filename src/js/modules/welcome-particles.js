// ==================== Drift 欢迎页火花粒子系统 V6 ====================
// 用于哲学文字显现时的刻字火花效果
(function() {
  var canvas, ctx;
  var sparks = [];
  var animationId = null;
  var isActive = false;

  var CONFIG = {
    gravity: 0.08,
    friction: 0.98,
    colors: [
      '255, 255, 255',
      '200, 210, 230',
      '150, 170, 200',
      '180, 190, 210'
    ]
  };

  function init() {
    canvas = document.getElementById('welcomeSparks');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    isActive = true;
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createSparks(x, y, count, options) {
    if (!ctx || !isActive) return;
    options = options || {};
    count = count || 6;

    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      var speed = 1.5 + Math.random() * 3;
      var color = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];

      sparks.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 1,
        decay: 0.015 + Math.random() * 0.02,
        size: 1 + Math.random() * 2,
        color: color,
        trail: []
      });
    }

    if (sparks.length > 0 && !animationId) {
      animate();
    }
  }

  function animate() {
    if (!isActive || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (var i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i];

      // 保存轨迹
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 5) s.trail.shift();

      // 物理更新
      s.x += s.vx;
      s.y += s.vy;
      s.vy += CONFIG.gravity;
      s.vx *= CONFIG.friction;
      s.vy *= CONFIG.friction;
      s.life -= s.decay;

      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }

      // 绘制轨迹
      if (s.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(s.trail[0].x, s.trail[0].y);
        for (var j = 1; j < s.trail.length; j++) {
          ctx.lineTo(s.trail[j].x, s.trail[j].y);
        }
        ctx.strokeStyle = 'rgba(' + s.color + ',' + s.life * 0.3 + ')';
        ctx.lineWidth = s.size * 0.5;
        ctx.stroke();
      }

      // 绘制粒子
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + s.color + ',' + s.life * 0.9 + ')';
      ctx.fill();

      // 绘制光晕
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * s.life * 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + s.color + ',' + s.life * 0.15 + ')';
      ctx.fill();
    }

    if (sparks.length > 0) {
      animationId = requestAnimationFrame(animate);
    } else {
      animationId = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function destroy() {
    isActive = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    window.removeEventListener('resize', resize);
    sparks = [];
  }

  // 暴露全局接口
  window.WelcomeSparks = {
    init: init,
    create: createSparks,
    destroy: destroy
  };
})();
