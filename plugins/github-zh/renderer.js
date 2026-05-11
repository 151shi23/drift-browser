(function() {
  var sdk = window.DriftPluginSDK.register(__pluginMeta);

  var injectCode = __pluginMeta.injectCode || '';

  function injectGitHubTranslation(webview) {
    if (!injectCode) return;
    try {
      webview.executeJavaScript(injectCode).catch(function(e) {
        console.error('[GitHub-zh] 注入失败:', e);
      });
    } catch (e) {
      console.error('[GitHub-zh] executeJavaScript 调用失败:', e);
    }
  }

  sdk.webview.onPageLoad(function(url, webview) {
    if (!url) return;
    var isGitHub = url.indexOf('github.com') !== -1 || url.indexOf('github.dev') !== -1;
    if (!isGitHub) return;

    setTimeout(function() {
      injectGitHubTranslation(webview);
    }, 500);

    setTimeout(function() {
      injectGitHubTranslation(webview);
    }, 2000);
  });

  console.log('[Plugin:GitHub-zh] GitHub 中文翻译插件已加载');
})();
