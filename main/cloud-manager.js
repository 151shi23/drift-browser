﻿﻿﻿﻿const { app, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const githubApi = require('./github-api');

var statePath = null;
var cacheDir = null;
var state = { auth: null, defaultRepo: 'drift-cloud', groups: [], syncFolders: [] };
var mainWindow = null;
var oauthClientId = '';
var oauthClientSecret = '';
var metadataCache = {};

function initCloudManager(win) {
  mainWindow = win;
  statePath = path.join(app.getPath('userData'), 'cloud-state.json');
  cacheDir = path.join(app.getPath('userData'), 'cloud-cache');
  try {
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  } catch (e) {
    console.error('[CloudManager] 创建缓存目录失败:', e.message);
    cacheDir = path.join(require('os').tmpdir(), 'drift-cloud-cache');
    try { if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true }); } catch(e2) {}
  }
  loadState();
  if (state.auth && state.auth.token) {
    var decrypted = decryptToken(state.auth.token);
    if (decrypted) {
      githubApi.setToken(decrypted);
    }
  }
  console.log('[CloudManager] 初始化完成, 认证状态:', !!state.auth);
}

function loadState() {
  try {
    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    }
  } catch (e) {
    console.error('[CloudManager] 加载状态失败:', e.message);
    state = { auth: null, defaultRepo: 'drift-cloud', groups: [], syncFolders: [] };
  }
}

function saveState() {
  try {
    var dir = path.dirname(statePath);
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch(e) {}
    }
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[CloudManager] 保存状态失败:', e.message);
  }
}

function getCached(key, ttlMs) {
  var entry = metadataCache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > (ttlMs || 30000)) {
    delete metadataCache[key];
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  metadataCache[key] = { value: value, ts: Date.now() };
}

function getMachineKey() {
  var machineId = require('os').hostname() + process.env.USERNAME + 'drift-cloud';
  return crypto.createHash('sha256').update(machineId).digest();
}

function encryptToken(text) {
  try {
    var iv = crypto.randomBytes(16);
    var cipher = crypto.createCipheriv('aes-256-gcm', getMachineKey(), iv);
    var encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    var authTag = cipher.getAuthTag().toString('hex');
    return iv.toString('hex') + ':' + authTag + ':' + encrypted;
  } catch (e) { return null; }
}

function decryptToken(text) {
  try {
    var parts = text.split(':');
    if (parts.length !== 3) return null;
    var iv = Buffer.from(parts[0], 'hex');
    var authTag = Buffer.from(parts[1], 'hex');
    var decipher = crypto.createDecipheriv('aes-256-gcm', getMachineKey(), iv);
    decipher.setAuthTag(authTag);
    var decrypted = decipher.update(parts[2], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) { return null; }
}

function generateId() {
  return 'g' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

function requireAuth() {
  if (!state.auth) return { error: '请先登录云盘账号' };
  return null;
}

function findGroup(groupId) {
  for (var i = 0; i < state.groups.length; i++) {
    if (state.groups[i].id === groupId) return state.groups[i];
  }
  return null;
}

async function authenticatePat(token) {
  try {
    githubApi.setToken(token);
    var user = await githubApi.getUser();
    state.auth = {
      method: 'pat',
      token: encryptToken(token),
      user: { login: user.login, avatar: user.avatar_url, name: user.name || user.login }
    };
    saveState();
    return { success: true, user: state.auth.user };
  } catch (e) {
    githubApi.setToken('');
    return { success: false, error: e.message };
  }
}

function startOAuth() {
  if (!oauthClientId) {
    return { success: false, error: 'OAuth 未配置，请使用连接密钥登录' };
  }
  var url = 'https://github.com/login/oauth/authorize?client_id=' + oauthClientId + '&scope=repo';
  shell.openExternal(url);
  return { success: true };
}

async function handleOAuthCallback(code) {
  try {
    var token = await githubApi.exchangeOAuthCode(oauthClientId, oauthClientSecret, code);
    githubApi.setToken(token);
    var user = await githubApi.getUser();
    state.auth = {
      method: 'oauth',
      token: encryptToken(token),
      user: { login: user.login, avatar: user.avatar_url, name: user.name || user.login }
    };
    saveState();
    return { success: true, user: state.auth.user };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getAuthStatus() {
  if (!state.auth) return { authenticated: false };
  return { authenticated: true, method: state.auth.method, user: state.auth.user };
}

function logout() {
  state.auth = null;
  githubApi.setToken('');
  metadataCache = {};
  saveState();
  return { success: true };
}

async function createGroup(name, useNewRepo) {
  var authErr = requireAuth();
  if (authErr) return authErr;

  var owner = state.auth.user.login;
  var groupId = generateId();

  if (useNewRepo) {
    var repoName = 'drift-cloud-' + name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    try {
      await githubApi.createRepo(repoName, true);
      state.groups.push({
        id: groupId, name: name, repo: repoName, path: '/', owner: owner, createdAt: Date.now()
      });
      saveState();
      return { success: true, group: state.groups[state.groups.length - 1] };
    } catch (e) {
      return { success: false, error: '创建存储空间失败: ' + e.message };
    }
  } else {
    var defaultRepoName = state.defaultRepo;
    try {
      await githubApi.getRepo(owner, defaultRepoName);
    } catch (e) {
      try {
        await githubApi.createRepo(defaultRepoName, true);
      } catch (e2) {
        return { success: false, error: '创建默认存储空间失败: ' + e2.message };
      }
    }
    var groupPath = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    state.groups.push({
      id: groupId, name: name, repo: defaultRepoName, path: groupPath, owner: owner, createdAt: Date.now()
    });
    saveState();
    return { success: true, group: state.groups[state.groups.length - 1] };
  }
}

async function deleteGroup(groupId, deleteRepo) {
  var authErr = requireAuth();
  if (authErr) return authErr;

  var group = null;
  var idx = -1;
  for (var i = 0; i < state.groups.length; i++) {
    if (state.groups[i].id === groupId) { group = state.groups[i]; idx = i; break; }
  }
  if (!group) return { success: false, error: '空间不存在' };

  if (deleteRepo && group.repo !== state.defaultRepo) {
    try {
      await githubApi.deleteRepo(group.owner, group.repo);
    } catch (e) {
      console.error('[CloudManager] 删除仓库失败:', e.message);
    }
  }

  state.groups.splice(idx, 1);
  state.syncFolders = state.syncFolders.filter(function(s) { return s.groupId !== groupId; });
  var cacheKey = 'files_' + groupId;
  delete metadataCache[cacheKey];
  saveState();
  return { success: true };
}

function listGroups() {
  return { success: true, groups: state.groups };
}

async function listFiles(groupId, filePath) {
  var authErr = requireAuth();
  if (authErr) return authErr;

  var group = findGroup(groupId);
  if (!group) return { success: false, error: '空间不存在' };

  var remotePath = group.path === '/' ? (filePath || '') : (group.path + '/' + (filePath || ''));
  remotePath = remotePath.replace(/\/+/g, '/').replace(/^\//, '');

  var cacheKey = 'files_' + groupId + '_' + remotePath;
  var cached = getCached(cacheKey, 30000);
  if (cached) return { success: true, files: cached, path: remotePath, cached: true };

  try {
    var contents = await githubApi.getContent(group.owner, group.repo, remotePath);
    if (!Array.isArray(contents)) contents = [contents];
    var files = contents.map(function(item) {
      return {
        name: item.name, path: item.path, type: item.type,
        size: item.size, sha: item.sha,
        downloadUrl: item.download_url,
        modified: item.updated_at || item.created_at
      };
    });
    setCached(cacheKey, files);
    return { success: true, files: files, path: remotePath };
  } catch (e) {
    if (e.statusCode === 404) {
      setCached(cacheKey, []);
      return { success: true, files: [], path: remotePath };
    }
    return { success: false, error: e.message };
  }
}

async function uploadFile(groupId, localPath, remotePath, mode, sendProgress) {
  var authErr = requireAuth();
  if (authErr) return authErr;

  var group = findGroup(groupId);
  if (!group) return { success: false, error: '空间不存在' };

  try {
    var fileBuffer = fs.readFileSync(localPath);
    var fileName = path.basename(localPath);
    var fileSize = fileBuffer.length;
    var fullPath = group.path === '/' ? (remotePath ? remotePath + '/' + fileName : fileName) : (group.path + '/' + (remotePath ? remotePath + '/' + fileName : fileName));
    fullPath = fullPath.replace(/\/+/g, '/');

    if (sendProgress) sendProgress({ percent: 5, status: 'reading' });

    if (mode === 'release' || (mode === 'auto' && fileSize > 50 * 1024 * 1024)) {
      return await uploadFileRelease(group, fullPath, fileBuffer, fileName, sendProgress);
    }

    if (fileSize > 50 * 1024 * 1024) {
      return await uploadLargeFile(group, fullPath, fileBuffer, fileName, sendProgress);
    }

    var base64Content = fileBuffer.toString('base64');

    var existingSha = null;
    try {
      var existing = await githubApi.getContent(group.owner, group.repo, fullPath);
      if (existing && existing.sha) existingSha = existing.sha;
    } catch (e) {}

    if (sendProgress) sendProgress({ percent: 50, status: 'uploading' });

    await githubApi.uploadFile(group.owner, group.repo, fullPath, null, base64Content, 'Upload ' + fileName, existingSha);

    var cacheKey = 'files_' + groupId + '_' + (remotePath || '');
    delete metadataCache[cacheKey];

    if (sendProgress) sendProgress({ percent: 100, status: 'done' });
    return { success: true, path: fullPath, size: fileSize };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function uploadLargeFile(group, fullPath, fileBuffer, fileName, sendProgress) {
  var CHUNK_SIZE = 40 * 1024 * 1024;
  var totalChunks = Math.ceil(fileBuffer.length / CHUNK_SIZE);
  var blobShas = [];

  for (var i = 0; i < totalChunks; i++) {
    var start = i * CHUNK_SIZE;
    var end = Math.min(start + CHUNK_SIZE, fileBuffer.length);
    var chunk = fileBuffer.slice(start, end);
    var base64Chunk = chunk.toString('base64');

    if (sendProgress) sendProgress({ percent: Math.round((i / totalChunks) * 80), status: '正在上传片段 ' + (i + 1) + '/' + totalChunks });

    var blob = await githubApi.createBlob(group.owner, group.repo, base64Chunk, 'base64');
    blobShas.push(blob.sha);
  }

  if (sendProgress) sendProgress({ percent: 85, status: '合并中' });

  var ref = await githubApi.getRef(group.owner, group.repo, 'heads/main');
  var latestCommitSha = ref.object.sha;
  var latestCommit = await githubApi.request('GET', '/repos/' + group.owner + '/' + group.repo + '/git/commits/' + latestCommitSha);
  var baseTreeSha = latestCommit.tree.sha;

  var treeItems = [];
  for (var j = 0; j < blobShas.length; j++) {
    treeItems.push({
      path: fullPath + '.part' + (j + 1),
      mode: '100644',
      type: 'blob',
      sha: blobShas[j]
    });
  }
  treeItems.push({
    path: fullPath + '.chunks.json',
    mode: '100644',
    type: 'blob',
    content: JSON.stringify({ totalChunks: totalChunks, fileName: fileName, fileSize: fileBuffer.length, chunkSize: CHUNK_SIZE })
  });

  var tree = await githubApi.createTree(group.owner, group.repo, baseTreeSha, treeItems);
  var commit = await githubApi.createCommit(group.owner, group.repo, 'Upload ' + fileName + ' (chunked)', tree.sha, [latestCommitSha]);
  await githubApi.updateRef(group.owner, group.repo, 'heads/main', commit.sha);

  if (sendProgress) sendProgress({ percent: 100, status: 'done' });
  return { success: true, path: fullPath, size: fileBuffer.length, chunked: true };
}

async function uploadFileRelease(group, fullPath, fileBuffer, fileName, sendProgress) {
  try {
    if (sendProgress) sendProgress({ percent: 10, status: '正在准备大文件上传' });

    var tag = 'cloud-' + Date.now();
    var release = await githubApi.createRelease(group.owner, group.repo, tag, fileName, 'Drift Cloud 大文件上传');

    if (sendProgress) sendProgress({ percent: 30, status: '上传文件' });

    await githubApi.uploadReleaseAsset(group.owner, group.repo, release.id, fileName, fileBuffer);

    var metaPath = fullPath + '.release.json';
    var metaContent = Buffer.from(JSON.stringify({
      releaseId: release.id,
      releaseTag: tag,
      assetName: fileName,
      assetSize: fileBuffer.length,
      assetUrl: release.assets && release.assets[0] ? release.assets[0].browser_download_url : ''
    })).toString('base64');
    await githubApi.uploadFile(group.owner, group.repo, metaPath, null, metaContent, 'Release meta for ' + fileName);

    if (sendProgress) sendProgress({ percent: 100, status: 'done' });
    return { success: true, path: fullPath, size: fileBuffer.length, release: true, tag: tag };
  } catch (e) {
    return { success: false, error: '大文件上传失败: ' + e.message };
  }
}

async function downloadFile(groupId, remotePath, localPath, sendProgress) {
  var authErr = requireAuth();
  if (authErr) return authErr;

  var group = findGroup(groupId);
  if (!group) return { success: false, error: '空间不存在' };

  try {
    if (remotePath.endsWith('.chunks.json')) {
      var chunksContent = await githubApi.getContent(group.owner, group.repo, remotePath);
      if (chunksContent.encoding === 'base64' && chunksContent.content) {
        var chunksInfo = JSON.parse(Buffer.from(chunksContent.content, 'base64').toString('utf-8'));
        return await downloadAndMergeChunks(group, chunksInfo, localPath, sendProgress);
      }
    }

    if (remotePath.endsWith('.release.json')) {
      var metaContent = await githubApi.getContent(group.owner, group.repo, remotePath);
      if (metaContent.encoding === 'base64' && metaContent.content) {
        var meta = JSON.parse(Buffer.from(metaContent.content, 'base64').toString('utf-8'));
        return await downloadFromRelease(group, meta, localPath, sendProgress);
      }
    }

    if (sendProgress) sendProgress({ percent: 10, status: '下载中' });

    var content = await githubApi.getContent(group.owner, group.repo, remotePath);

    if (content.encoding === 'base64' && content.content) {
      var fileBuffer = Buffer.from(content.content, 'base64');
      var dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(localPath, fileBuffer);
      if (sendProgress) sendProgress({ percent: 100, status: 'done' });
      return { success: true, path: localPath, size: fileBuffer.length };
    }

    if (content.download_url) {
      return await githubApi.downloadFileFromUrl(content.download_url, localPath, function(p) {
        if (sendProgress) sendProgress(p);
      });
    }

    return { success: false, error: '无法下载文件' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function downloadAndMergeChunks(group, chunksInfo, localPath, sendProgress) {
  var totalChunks = chunksInfo.totalChunks;
  var chunkBuffers = [];

  for (var i = 0; i < totalChunks; i++) {
    if (sendProgress) sendProgress({ percent: Math.round((i / totalChunks) * 90), status: '下载文件片段 ' + (i + 1) + '/' + totalChunks });
    var partPath = chunksInfo.fileName + '.part' + (i + 1);
    try {
      var partContent = await githubApi.getContent(group.owner, group.repo, partPath);
      if (partContent.encoding === 'base64' && partContent.content) {
        chunkBuffers.push(Buffer.from(partContent.content, 'base64'));
      }
    } catch (e) {
      return { success: false, error: '下载文件片段 ' + (i + 1) + ' 失败: ' + e.message };
    }
  }

  var merged = Buffer.concat(chunkBuffers);
  var dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(localPath, merged);

  if (sendProgress) sendProgress({ percent: 100, status: 'done' });
  return { success: true, path: localPath, size: merged.length };
}

async function downloadFromRelease(group, meta, localPath, sendProgress) {
  try {
    if (sendProgress) sendProgress({ percent: 10, status: '正在下载大文件' });
    var releases = await githubApi.listReleases(group.owner, group.repo);
    var targetRelease = null;
    for (var i = 0; i < releases.length; i++) {
      if (releases[i].id === meta.releaseId) {
        targetRelease = releases[i];
        break;
      }
    }
    if (!targetRelease || !targetRelease.assets || targetRelease.assets.length === 0) {
      return { success: false, error: '大文件资源不存在' };
    }
    var asset = targetRelease.assets[0];
    return await githubApi.downloadFileFromUrl(asset.url, localPath, function(p) {
      if (sendProgress) sendProgress(p);
    });
  } catch (e) {
    return { success: false, error: '大文件下载失败: ' + e.message };
  }
}

async function deleteCloudFile(groupId, remotePath) {
  var authErr = requireAuth();
  if (authErr) return authErr;

  var group = findGroup(groupId);
  if (!group) return { success: false, error: '空间不存在' };

  try {
    var content = await githubApi.getContent(group.owner, group.repo, remotePath);
    if (Array.isArray(content)) {
      for (var i = content.length - 1; i >= 0; i--) {
        try { await githubApi.deleteFile(group.owner, group.repo, content[i].path, content[i].sha, 'Delete ' + content[i].name); } catch(e) {}
      }
    } else {
      await githubApi.deleteFile(group.owner, group.repo, remotePath, content.sha, 'Delete ' + path.basename(remotePath));
    }
    var cacheKey = 'files_' + groupId;
    Object.keys(metadataCache).forEach(function(k) {
      if (k.indexOf(cacheKey) === 0) delete metadataCache[k];
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function createFolder(groupId, remotePath) {
  var authErr = requireAuth();
  if (authErr) return authErr;

  var group = findGroup(groupId);
  if (!group) return { success: false, error: '空间不存在' };

  var fullPath = group.path === '/' ? remotePath : (group.path + '/' + remotePath);
  fullPath = fullPath.replace(/\/+/g, '/');
  var gitkeepPath = fullPath + '/.gitkeep';

  try {
    await githubApi.uploadFile(group.owner, group.repo, gitkeepPath, null, '', 'Create folder ' + remotePath);
    var cacheKey = 'files_' + groupId;
    Object.keys(metadataCache).forEach(function(k) {
      if (k.indexOf(cacheKey) === 0) delete metadataCache[k];
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function shareFile(groupId, remotePath) {
  var authErr = requireAuth();
  if (authErr) return authErr;

  var group = findGroup(groupId);
  if (!group) return { success: false, error: '空间不存在' };

  try {
    var content = await githubApi.getContent(group.owner, group.repo, remotePath);
    if (content.download_url) {
      return { success: true, url: content.download_url, name: content.name };
    }
    var rawUrl = 'https://raw.githubusercontent.com/' + group.owner + '/' + group.repo + '/main/' + remotePath;
    return { success: true, url: rawUrl, name: path.basename(remotePath) };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getStorageInfo(groupId) {
  var authErr = requireAuth();
  if (authErr) return authErr;

  var group = findGroup(groupId);
  if (!group) return { success: false, error: '空间不存在' };

  var cacheKey = 'storage_' + groupId;
  var cached = getCached(cacheKey, 300000);
  if (cached) return { success: true, storage: cached };

  try {
    var repo = await githubApi.getRepo(group.owner, group.repo);
    var info = {
      size: repo.size * 1024,
      sizeFormatted: formatSize(repo.size * 1024),
      limit: 1024 * 1024 * 1024,
      limitFormatted: '1 GB',
      usagePercent: Math.min(100, Math.round((repo.size * 1024) / (1024 * 1024 * 1024) * 100)),
      fileCount: 0,
      repoUrl: repo.html_url,
      repoName: repo.name
    };

    try {
      var contents = await githubApi.getContent(group.owner, group.repo, group.path === '/' ? '' : group.path);
      if (Array.isArray(contents)) info.fileCount = contents.length;
    } catch (e) {}

    setCached(cacheKey, info);
    return { success: true, storage: info };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function searchFiles(groupId, query) {
  var authErr = requireAuth();
  if (authErr) return authErr;

  var group = findGroup(groupId);
  if (!group) return { success: false, error: '空间不存在' };

  try {
    var result = await githubApi.searchCode(group.owner, group.repo, query);
    var items = (result.items || []).map(function(item) {
      return {
        name: item.name,
        path: item.path,
        htmlUrl: item.html_url
      };
    });
    return { success: true, results: items, total: result.total_count || 0 };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getFileInfo(groupId, filePath) {
  var authErr = requireAuth();
  if (authErr) return authErr;

  var group = findGroup(groupId);
  if (!group) return { success: false, error: '空间不存在' };

  try {
    var content = await githubApi.getContent(group.owner, group.repo, filePath);
    return {
      success: true,
      file: {
        name: content.name,
        path: content.path,
        size: content.size,
        sha: content.sha,
        type: content.type,
        downloadUrl: content.download_url,
        modified: content.updated_at || content.created_at,
        encoding: content.encoding
      }
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getFileContent(groupId, filePath) {
  var authErr = requireAuth();
  if (authErr) return authErr;

  var group = findGroup(groupId);
  if (!group) return { success: false, error: '空间不存在' };

  try {
    var content = await githubApi.getContent(group.owner, group.repo, filePath);
    if (content.encoding === 'base64' && content.content) {
      var text = Buffer.from(content.content, 'base64').toString('utf-8');
      return { success: true, content: text, name: content.name, size: content.size };
    }
    return { success: false, error: '文件内容不可用' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getPreviewUrl(groupId, filePath) {
  var authErr = requireAuth();
  if (authErr) return authErr;

  var group = findGroup(groupId);
  if (!group) return { success: false, error: '空间不存在' };

  try {
    var content = await githubApi.getContent(group.owner, group.repo, filePath);
    var url = content.download_url || ('https://raw.githubusercontent.com/' + group.owner + '/' + group.repo + '/main/' + filePath);
    var ext = path.extname(filePath).toLowerCase();
    var type = 'other';
    var imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp', '.ico'];
    var audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'];
    var videoExts = ['.mp4', '.webm', '.mkv', '.avi', '.mov'];
    var textExts = ['.txt', '.js', '.ts', '.jsx', '.tsx', '.css', '.scss', '.less', '.html', '.htm', '.json', '.xml', '.yml', '.yaml', '.md', '.py', '.java', '.c', '.cpp', '.h', '.go', '.rs', '.rb', '.php', '.sh', '.bat', '.sql', '.ini', '.cfg', '.conf', '.log', '.csv'];
    if (imageExts.indexOf(ext) !== -1) type = 'image';
    else if (audioExts.indexOf(ext) !== -1) type = 'audio';
    else if (videoExts.indexOf(ext) !== -1) type = 'video';
    else if (ext === '.md') type = 'markdown';
    else if (textExts.indexOf(ext) !== -1) type = 'text';

    return { success: true, url: url, type: type, name: content.name || path.basename(filePath) };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function syncFolder(syncId) {
  var authErr = requireAuth();
  if (authErr) return authErr;

  var syncConfig = null;
  for (var i = 0; i < state.syncFolders.length; i++) {
    if (state.syncFolders[i].id === syncId) { syncConfig = state.syncFolders[i]; break; }
  }
  if (!syncConfig) return { success: false, error: '同步配置不存在' };

  var group = findGroup(syncConfig.groupId);
  if (!group) return { success: false, error: '空间不存在' };

  try {
    if (!fs.existsSync(syncConfig.localPath)) {
      return { success: false, error: '本地文件夹不存在' };
    }

    var remotePath = group.path === '/' ? '' : group.path;
    var remoteFiles = [];
    try {
      var contents = await githubApi.getContent(group.owner, group.repo, remotePath);
      if (Array.isArray(contents)) remoteFiles = contents;
    } catch (e) {}

    var localFiles = fs.readdirSync(syncConfig.localPath);
    var uploaded = 0, downloaded = 0, skipped = 0, conflicts = 0;

    var remoteMap = {};
    for (var r = 0; r < remoteFiles.length; r++) {
      remoteMap[remoteFiles[r].name] = remoteFiles[r];
    }

    for (var l = 0; l < localFiles.length; l++) {
      var localFile = localFiles[l];
      var localFilePath = path.join(syncConfig.localPath, localFile);
      var stat = fs.statSync(localFilePath);
      if (stat.isDirectory()) continue;

      var remoteFile = remoteMap[localFile];
      if (!remoteFile) {
        var base64Content = fs.readFileSync(localFilePath).toString('base64');
        var uploadPath = (remotePath ? remotePath + '/' : '') + localFile;
        await githubApi.uploadFile(group.owner, group.repo, uploadPath, null, base64Content, 'Sync upload ' + localFile);
        uploaded++;
      } else {
        var localMtime = stat.mtime.getTime();
        var remoteMtime = remoteFile.updated_at ? new Date(remoteFile.updated_at).getTime() : 0;
        if (localMtime > remoteMtime + 1000) {
          var base64Content2 = fs.readFileSync(localFilePath).toString('base64');
          var uploadPath2 = (remotePath ? remotePath + '/' : '') + localFile;
          await githubApi.uploadFile(group.owner, group.repo, uploadPath2, null, base64Content2, 'Sync update ' + localFile, remoteFile.sha);
          uploaded++;
        } else if (remoteMtime > localMtime + 1000) {
          var downloadPath = path.join(syncConfig.localPath, localFile);
          if (remoteFile.download_url) {
            await githubApi.downloadFileFromUrl(remoteFile.download_url, downloadPath);
            downloaded++;
          }
        } else {
          skipped++;
        }
      }
    }

    for (var d = 0; d < remoteFiles.length; d++) {
      if (remoteFiles[d].type !== 'file') continue;
      if (localFiles.indexOf(remoteFiles[d].name) === -1) {
        var downloadPath2 = path.join(syncConfig.localPath, remoteFiles[d].name);
        if (remoteFiles[d].download_url) {
          await githubApi.downloadFileFromUrl(remoteFiles[d].download_url, downloadPath2);
          downloaded++;
        }
      }
    }

    syncConfig.lastSync = Date.now();
    saveState();
    return { success: true, uploaded: uploaded, downloaded: downloaded, skipped: skipped, conflicts: conflicts };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getSyncStatus() {
  return { success: true, syncFolders: state.syncFolders };
}

function addSyncFolder(groupId, localPath) {
  var syncId = 's' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  state.syncFolders.push({
    id: syncId, localPath: localPath, groupId: groupId, enabled: true, lastSync: null
  });
  saveState();
  return { success: true, id: syncId };
}

function removeSyncFolder(syncId) {
  state.syncFolders = state.syncFolders.filter(function(s) { return s.id !== syncId; });
  saveState();
  return { success: true };
}

function selectFolder() {
  return dialog.showOpenDialog(mainWindow, {
    title: '选择文件夹',
    properties: ['openDirectory']
  });
}

function selectFile() {
  return dialog.showOpenDialog(mainWindow, {
    title: '选择文件',
    properties: ['openFile', 'multiSelections']
  });
}

function setOAuthConfig(clientId, clientSecret) {
  oauthClientId = clientId;
  oauthClientSecret = clientSecret;
}

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

module.exports = {
  initCloudManager: initCloudManager,
  authenticatePat: authenticatePat,
  startOAuth: startOAuth,
  handleOAuthCallback: handleOAuthCallback,
  getAuthStatus: getAuthStatus,
  logout: logout,
  createGroup: createGroup,
  deleteGroup: deleteGroup,
  listGroups: listGroups,
  listFiles: listFiles,
  uploadFile: uploadFile,
  downloadFile: downloadFile,
  deleteCloudFile: deleteCloudFile,
  createFolder: createFolder,
  shareFile: shareFile,
  syncFolder: syncFolder,
  getSyncStatus: getSyncStatus,
  addSyncFolder: addSyncFolder,
  removeSyncFolder: removeSyncFolder,
  selectFolder: selectFolder,
  selectFile: selectFile,
  setOAuthConfig: setOAuthConfig,
  getStorageInfo: getStorageInfo,
  searchFiles: searchFiles,
  getFileInfo: getFileInfo,
  getFileContent: getFileContent,
  getPreviewUrl: getPreviewUrl
};
