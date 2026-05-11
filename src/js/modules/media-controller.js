(function() {
  function pauseTabMedia(tab) {
    if (!tab?.webview) return;
    tab.webview.executeJavaScript(`
      (function() {
        document.querySelectorAll('video').forEach(function(v) {
          if (!v.paused) {
            v.pause();
            v.dataset._driftWasPlaying = 'true';
          }
        });
        document.querySelectorAll('audio').forEach(function(a) {
          if (!a.paused) {
            a.pause();
            a.dataset._driftWasPlaying = 'true';
          }
        });
        document.querySelectorAll('iframe').forEach(function(f) {
          f.dataset._driftDisplay = f.style.display || '';
          f.style.display = 'none';
        });
      })();
    `).catch(function() {});
  }

  function resumeTabMedia(tab) {
    if (!tab?.webview) return;
    tab.webview.executeJavaScript(`
      (function() {
        document.querySelectorAll('video').forEach(function(v) {
          if (v.dataset._driftWasPlaying === 'true') {
            v.play().catch(function() {});
            delete v.dataset._driftWasPlaying;
          }
        });
        document.querySelectorAll('audio').forEach(function(a) {
          if (a.dataset._driftWasPlaying === 'true') {
            a.play().catch(function() {});
            delete a.dataset._driftWasPlaying;
          }
        });
        document.querySelectorAll('iframe').forEach(function(f) {
          if (f.dataset._driftDisplay !== undefined) {
            f.style.display = f.dataset._driftDisplay;
            delete f.dataset._driftDisplay;
          }
        });
      })();
    `).catch(function() {});
  }

  function pauseTabVideoKeepAudio(tab) {
    if (!tab?.webview) return;
    tab.webview.executeJavaScript(`
      (function() {
        document.querySelectorAll('video').forEach(function(v) {
          if (!v.paused) {
            v.pause();
            v.dataset._driftWasPlaying = 'true';
          }
        });
        document.querySelectorAll('iframe').forEach(function(f) {
          f.dataset._driftDisplay = f.style.display || '';
          f.style.display = 'none';
        });
      })();
    `).catch(function() {});
  }

  function suspendTabTimers(tab) {
    if (!tab?.webview) return;
    tab.webview.executeJavaScript(`
      (function() {
        var maxId = setTimeout(function(){}, 0);
        for (var i = 0; i <= maxId; i++) {
          clearTimeout(i);
          clearInterval(i);
        }
      })();
    `).catch(function() {});
  }

  function isTabPlayingMedia(tab) {
    if (!tab?.webview) return Promise.resolve(false);
    return tab.webview.executeJavaScript(`
      (function() {
        var videos = document.querySelectorAll('video');
        var audios = document.querySelectorAll('audio');
        for (var i = 0; i < videos.length; i++) {
          if (!videos[i].paused && !videos[i].muted) return true;
        }
        for (var i = 0; i < audios.length; i++) {
          if (!audios[i].paused && !audios[i].muted) return true;
        }
        return false;
      })();
    `).catch(function() { return false; });
  }

  window.MediaController = {
    pauseTabMedia: pauseTabMedia,
    resumeTabMedia: resumeTabMedia,
    pauseTabVideoKeepAudio: pauseTabVideoKeepAudio,
    suspendTabTimers: suspendTabTimers,
    isTabPlayingMedia: isTabPlayingMedia
  };
})();
