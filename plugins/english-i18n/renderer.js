(function() {
  var sdk = window.DriftPluginSDK.register(__pluginMeta);

  if (sdk.i18n && __pluginMeta.i18n) {
    var locales = Object.keys(__pluginMeta.i18n);
    for (var i = 0; i < locales.length; i++) {
      sdk.i18n.register(locales[i], __pluginMeta.i18n[locales[i]]);
    }

    sdk.i18n.setLocale('en');
  }

  console.log('[Plugin:English-i18n] English language pack loaded, locale switched to en');
})();
