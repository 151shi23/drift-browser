const { app, shell } = require('electron');
const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_OWNER = '151shi23';
const GITHUB_REPO = 'drift-browser';
const API_URL = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/releases?per_page=5';

var updateState = 'idle';
var latestRelease = null;
var downloadedFilePath = null;
var downloadRequest = null;
var autoCheckEnabled = true;
var skippedVersion = '';

var configPath = path.join(process.env.APPDATA || '', 'f-browser', 'config.json');
var updatesDir = path.join(process.env.APPDATA || '', 'f-browser', 'updates');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      var data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      autoCheckEnabled = data.autoCheckUpdate !== false;
      skippedVersion = data.skippedVersion || '';
    }
  } catch (e) {}
}

function saveConfig() {
  try {
    var data = {};
    if (fs.existsSync(configPath)) {
      data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    data.autoCheckUpdate = autoCheckEnabled;
    data.skippedVersion = skippedVersion;
    var dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[Updater] 保存配置失败:', e.message);
  }
}

function parseVersion(v) {
  var clean = (v || '').replace(/^v/i, '').trim();
  var parts = clean.split('.');
  var major = parseInt(parts[0]) || 0;
  var minor = parseInt(parts[1]) || 0;
  var patch = parseInt(parts[2]) || 0;
  return { major: major, minor: minor, patch: patch };
}

function isVersionNewer(remote, local) {
  var r = parseVersion(remote);
  var l = parseVersion(local);
  if (r.major !== l.major) return r.major > l.major;
  if (r.minor !== l.minor) return r.minor > l.minor;
  return r.patch > l.patch;
}

function fetchJSON(url) {
  return new Promise(function(resolve, reject) {
    var options = {
      hostname: 'api.github.com',
      path: url.replace('https://api.github.com', ''),
      method: 'GET',
      headers: {
        'User-Agent': 'Drift-Browser-Updater',
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 15000
    };
    var req = https.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('解析 GitHub 响应失败')); }
      });
    });
    req.on('error', function(e) { reject(e); });
    req.on('timeout', function() { req.destroy(); reject(new Error('请求超时')); });
    req.end();
  });
}

function checkForUpdate() {
  if (updateState === 'checking' || updateState === 'downloading') {
    return { success: false, error: '正在执行其他更新操作' };
  }

  updateState = 'checking';

  return fetchJSON(API_URL).then(function(releases) {
    updateState = 'idle';

    if (!Array.isArray(releases) || releases.length === 0) {
      return { success: true, hasUpdate: false, message: '当前已是最新版本' };
    }

    if (releases.message && releases.message.indexOf('API rate limit') !== -1) {
      return { success: false, error: 'GitHub API 请求频率受限，请稍后再试' };
    }

    var stableRelease = null;
    for (var i = 0; i < releases.length; i++) {
      var r = releases[i];
      if (!r.draft && !r.prerelease) {
        stableRelease = r;
        break;
      }
    }

    if (!stableRelease) {
      return { success: true, hasUpdate: false, message: '当前已是最新版本' };
    }

    var remoteVersion = (stableRelease.tag_name || '').replace(/^v/i, '').trim();
    var localVersion = app.getVersion();

    if (!isVersionNewer(remoteVersion, localVersion)) {
      return { success: true, hasUpdate: false, message: '当前已是最新版本 (v' + localVersion + ')' };
    }

    if (remoteVersion === skippedVersion) {
      return { success: true, hasUpdate: false, message: '已忽略 v' + remoteVersion + ' 的更新' };
    }

    var asset = null;
    var assets = stableRelease.assets || [];
    for (var j = 0; j < assets.length; j++) {
      var a = assets[j];
      if (a.name && a.name.indexOf('.exe') !== -1 && a.name.indexOf('Setup') !== -1) {
        asset = a;
        break;
      }
    }
    if (!asset) {
      for (var k = 0; k < assets.length; k++) {
        var a2 = assets[k];
        if (a2.name && a2.name.indexOf('.exe') !== -1) { asset = a2; break; }
      }
    }
    if (!asset) {
      for (var m = 0; m < assets.length; m++) {
        var a3 = assets[m];
        if (a3.name && (a3.name.indexOf('.zip') !== -1 || a3.name.indexOf('.7z') !== -1)) { asset = a3; break; }
      }
    }

    latestRelease = {
      version: remoteVersion,
      name: stableRelease.name || ('v' + remoteVersion),
      body: stableRelease.body || '',
      htmlUrl: stableRelease.html_url || '',
      publishedAt: stableRelease.published_at || '',
      asset: asset ? { name: asset.name, url: asset.browser_download_url, size: asset.size } : null
    };

    return { success: true, hasUpdate: true, release: latestRelease };
  }).catch(function(e) {
    updateState = 'idle';
    console.error('[Updater] 检查更新失败:', e.message);
    return { success: false, error: '检查更新失败: ' + e.message };
  });
}

function downloadRelease() {
  if (!latestRelease || !latestRelease.asset) {
    return Promise.resolve({ success: false, error: '没有可下载的更新' });
  }
  if (updateState === 'downloading') {
    return Promise.resolve({ success: false, error: '正在下载中' });
  }

  updateState = 'downloading';

  if (!fs.existsSync(updatesDir)) {
    try { fs.mkdirSync(updatesDir, { recursive: true }); } catch (e) {}
  }

  var assetName = latestRelease.asset.name;
  var filePath = path.join(updatesDir, assetName);
  var fileUrl = latestRelease.asset.url;

  return new Promise(function(resolve) {
    var parsedUrl = new URL(fileUrl);
    var options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname,
      method: 'GET',
      headers: { 'User-Agent': 'Drift-Browser-Updater', 'Accept': 'application/octet-stream' },
      timeout: 300000
    };

    var redirectCount = 0;
    function doRequest(reqOpts) {
      redirectCount++;
      if (redirectCount > 10) {
        updateState = 'idle';
        resolve({ success: false, error: '重定向次数过多' });
        return;
      }

      var req = https.request(reqOpts, function(res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          try {
            var redirectUrl = new URL(res.headers.location);
            var redirectOpts = {
              hostname: redirectUrl.hostname,
              port: redirectUrl.port || (redirectUrl.protocol === 'http:' ? 80 : 443),
              path: redirectUrl.pathname + redirectUrl.search,
              method: 'GET',
              headers: { 'User-Agent': 'Drift-Browser-Updater' },
              timeout: 300000
            };
            var redirectClient = redirectUrl.protocol === 'http:' ? require('http') : https;
            doRequest(redirectOpts);
          } catch (e) {
            updateState = 'idle';
            resolve({ success: false, error: '重定向 URL 无效' });
          }
          return;
        }

        if (res.statusCode !== 200) {
          updateState = 'idle';
          resolve({ success: false, error: '下载失败: HTTP ' + res.statusCode });
          return;
        }

        var totalSize = parseInt(res.headers['content-length']) || latestRelease.asset.size;
        var downloaded = 0;
        var lastPercent = 0;
        var fileStream = fs.createWriteStream(filePath);

        res.on('data', function(chunk) {
          downloaded += chunk.length;
          var percent = totalSize > 0 ? Math.round(downloaded / totalSize * 100) : 0;
          if (percent !== lastPercent) {
            lastPercent = percent;
            var mainWin = getMainWindow();
            if (mainWin && !mainWin.isDestroyed()) {
              mainWin.webContents.send('update-progress', { percent: percent, downloaded: downloaded, total: totalSize });
            }
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', function() {
          fileStream.close();
          downloadedFilePath = filePath;
          updateState = 'downloaded';
          var mainWin = getMainWindow();
          if (mainWin && !mainWin.isDestroyed()) {
            mainWin.webContents.send('update-downloaded', { filePath: filePath, version: latestRelease.version });
          }
          resolve({ success: true, filePath: filePath });
        });

        fileStream.on('error', function(e) {
          fs.unlink(filePath, function() {});
          updateState = 'idle';
          resolve({ success: false, error: '写入文件失败: ' + e.message });
        });
      });

      req.on('error', function(e) {
        updateState = 'idle';
        resolve({ success: false, error: '下载失败: ' + e.message });
      });

      req.on('timeout', function() {
        req.destroy();
        updateState = 'idle';
        resolve({ success: false, error: '下载超时' });
      });

      req.end();
      downloadRequest = req;
    }

    doRequest(options);
  });
}

function installUpdate() {
  if (!downloadedFilePath || !fs.existsSync(downloadedFilePath)) {
    return { success: false, error: '安装包不存在' };
  }

  try {
    var isExe = downloadedFilePath.indexOf('.exe') !== -1;
    if (isExe) {
      shell.openPath(downloadedFilePath);
      setTimeout(function() { app.isQuitting = true; app.quit(); }, 1000);
      return { success: true };
    } else {
      shell.showItemInFolder(downloadedFilePath);
      return { success: true, message: '已打开文件所在目录，请手动替换文件' };
    }
  } catch (e) {
    return { success: false, error: '启动安装失败: ' + e.message };
  }
}

function cancelDownload() {
  if (downloadRequest) {
    downloadRequest.destroy();
    downloadRequest = null;
  }
  updateState = 'idle';
  return { success: true };
}

function getUpdateStatus() {
  return {
    state: updateState,
    release: latestRelease,
    downloadedFilePath: downloadedFilePath,
    autoCheckEnabled: autoCheckEnabled
  };
}

function getAutoCheckEnabled() { return autoCheckEnabled; }

function setAutoCheckEnabled(enabled) {
  autoCheckEnabled = !!enabled;
  saveConfig();
  return autoCheckEnabled;
}

function dismissUpdate() {
  if (latestRelease) {
    skippedVersion = latestRelease.version;
    saveConfig();
  }
  latestRelease = null;
  updateState = 'idle';
  return { success: true };
}

function getMainWindow() {
  try {
    var wm = require('./window-manager');
    return wm.getMainWindow();
  } catch (e) { return null; }
}

function initUpdater() {
  loadConfig();

  if (autoCheckEnabled) {
    setTimeout(function() {
      console.log('[Updater] 启动时自动检查更新...');
      checkForUpdate().then(function(result) {
        if (result.success && result.hasUpdate) {
          console.log('[Updater] 发现新版本: v' + result.release.version);
          var mainWin = getMainWindow();
          if (mainWin && !mainWin.isDestroyed()) {
            mainWin.webContents.send('update-available', result.release);
          }
        } else if (result.success) {
          console.log('[Updater] ' + result.message);
        } else {
          console.log('[Updater] 检查更新失败:', result.error);
        }
      });
    }, 5000);
  }
}

module.exports = {
  checkForUpdate: checkForUpdate,
  downloadRelease: downloadRelease,
  installUpdate: installUpdate,
  cancelDownload: cancelDownload,
  getUpdateStatus: getUpdateStatus,
  getAutoCheckEnabled: getAutoCheckEnabled,
  setAutoCheckEnabled: setAutoCheckEnabled,
  dismissUpdate: dismissUpdate,
  initUpdater: initUpdater
};
