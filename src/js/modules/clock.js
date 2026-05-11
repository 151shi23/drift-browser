// ==================== 时钟 & 问候语 ====================
(function() {
  'use strict';

  const homeTimeEl = document.getElementById('homeTime');
  const homeDateEl = document.getElementById('homeDate');
  const homeGreetingEl = document.getElementById('homeGreeting');

  function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    if (homeTimeEl) homeTimeEl.textContent = `${h}:${m}`;

    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const mon = now.getMonth() + 1;
    const day = now.getDate();
    if (homeDateEl) homeDateEl.textContent = `${mon}月${day}日 星期${days[now.getDay()]}`;

    const hour = now.getHours();
    let greeting = '夜深了';
    if (hour < 6) greeting = '夜深了';
    else if (hour < 9) greeting = '早安';
    else if (hour < 12) greeting = '上午好';
    else if (hour < 14) greeting = '午安';
    else if (hour < 18) greeting = '下午好';
    else if (hour < 22) greeting = '晚上好';
    if (homeGreetingEl) homeGreetingEl.textContent = greeting;
  }

  updateClock();
  setInterval(updateClock, 1000);

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.clock = { updateClock };
})();
