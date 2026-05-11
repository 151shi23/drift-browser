// ==================== 主页聚光跟随鼠标效果 ====================
(function() {
  'use strict';

  const homeSpotlightEl = document.getElementById('homeSpotlight');
  const homePageEl = document.getElementById('homePage');

  if (homePageEl && homeSpotlightEl) {
    homePageEl.addEventListener('mousemove', e => {
      const rect = homePageEl.getBoundingClientRect();
      homeSpotlightEl.style.left = (e.clientX - rect.left) + 'px';
      homeSpotlightEl.style.top = (e.clientY - rect.top) + 'px';
      homeSpotlightEl.classList.add('visible');
    });

    homePageEl.addEventListener('mouseleave', () => {
      homeSpotlightEl.classList.remove('visible');
    });
  }
})();
