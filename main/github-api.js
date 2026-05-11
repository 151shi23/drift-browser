const https = require('https');
const http = require('http');
const { Buffer } = require('buffer');

var _token = '';

function setToken(token) {
  _token = token;
}

function getToken() {
  return _token;
}

function encodeContentPath(p) {
  if (!p) return '';
  return p.split('/').map(function(seg) { return encodeURIComponent(seg); }).join('/');
}

function request(method, urlPath, body, extraHeaders, isRetry) {
  return new Promise(function(resolve, reject) {
    var headers = {
      'User-Agent': 'Drift-Cloud',
      'Accept': 'application/vnd.github.v3+json'
    };
    if (_token) {
      headers['Authorization'] = 'Bearer ' + _token;
    }
    if (extraHeaders) {
      var keys = Object.keys(extraHeaders);
      for (var i = 0; i < keys.length; i++) {
        headers[keys[i]] = extraHeaders[keys[i]];
      }
    }

    var bodyData = null;
    if (body !== undefined && body !== null) {
      bodyData = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    var options = {
      hostname: 'api.github.com',
      path: urlPath,
      method: method,
      headers: headers,
      timeout: 30000
    };

    var req = https.request(options, function(res) {
      var chunks = [];
      res.on('data', function(chunk) { chunks.push(chunk); });
      res.on('end', function() {
        var data = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode === 403 && !isRetry) {
          try {
            var parsed = JSON.parse(data);
            if (parsed.message && parsed.message.indexOf('rate limit') !== -1) {
              reject(new Error('操作过于频繁，请稍后重试'));
              return;
            }
            if (parsed.message && parsed.message.indexOf('abuse') !== -1) {
              setTimeout(function() {
                request(method, urlPath, body, extraHeaders, true).then(resolve).catch(reject);
              }, 2000);
              return;
            }
          } catch(e) {}
        }
        if (res.statusCode >= 400) {
          var errMsg = 'GitHub API error ' + res.statusCode;
          try { var parsed2 = JSON.parse(data); errMsg = parsed2.message || errMsg; } catch(e) {}
          var err = new Error(errMsg);
          err.statusCode = res.statusCode;
          reject(err);
          return;
        }
        if (res.statusCode === 204) {
          resolve({ success: true });
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve(data); }
      });
    });

    req.on('error', function(e) { reject(e); });
    req.on('timeout', function() { req.destroy(); reject(new Error('请求超时，请检查网络连接')); });
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

function getUser() {
  return request('GET', '/user');
}

function createRepo(name, isPrivate) {
  return request('POST', '/user/repos', {
    name: name,
    private: isPrivate !== false,
    description: 'Drift Cloud Storage',
    auto_init: true
  });
}

function listRepos(page, perPage) {
  page = page || 1;
  perPage = perPage || 100;
  return request('GET', '/user/repos?page=' + page + '&per_page=' + perPage + '&sort=updated');
}

function deleteRepo(owner, repo) {
  return request('DELETE', '/repos/' + owner + '/' + repo);
}

function getRepo(owner, repo) {
  return request('GET', '/repos/' + owner + '/' + repo);
}

function getContent(owner, repo, p) {
  var urlPath = '/repos/' + owner + '/' + repo + '/contents/' + encodeContentPath(p);
  return request('GET', urlPath);
}

function uploadFile(owner, repo, p, content, base64, message, sha) {
  var body = {
    message: message || 'Upload ' + p,
    content: base64 || content
  };
  if (sha) body.sha = sha;
  return request('PUT', '/repos/' + owner + '/' + repo + '/contents/' + encodeContentPath(p), body);
}

function deleteFile(owner, repo, p, sha, message) {
  return request('DELETE', '/repos/' + owner + '/' + repo + '/contents/' + encodeContentPath(p), {
    message: message || 'Delete ' + p,
    sha: sha
  });
}

function createBlob(owner, repo, content, encoding) {
  return request('POST', '/repos/' + owner + '/' + repo + '/git/blobs', {
    content: content,
    encoding: encoding || 'base64'
  });
}

function getRef(owner, repo, ref) {
  return request('GET', '/repos/' + owner + '/' + repo + '/git/refs/' + ref);
}

function createTree(owner, repo, baseTree, tree) {
  var body = { tree: tree };
  if (baseTree) body.base_tree = baseTree;
  return request('POST', '/repos/' + owner + '/' + repo + '/git/trees', body);
}

function createCommit(owner, repo, message, tree, parents) {
  return request('POST', '/repos/' + owner + '/' + repo + '/git/commits', {
    message: message,
    tree: tree,
    parents: parents || []
  });
}

function updateRef(owner, repo, ref, sha) {
  return request('PATCH', '/repos/' + owner + '/' + repo + '/git/refs/' + ref, {
    sha: sha
  });
}

function getBlob(owner, repo, sha) {
  return request('GET', '/repos/' + owner + '/' + repo + '/git/blobs/' + sha);
}

function createRelease(owner, repo, tag, name, body) {
  return request('POST', '/repos/' + owner + '/' + repo + '/releases', {
    tag_name: tag,
    name: name || tag,
    body: body || '',
    draft: false,
    prerelease: false
  });
}

function listReleases(owner, repo) {
  return request('GET', '/repos/' + owner + '/' + repo + '/releases?per_page=100');
}

function getRelease(owner, repo, releaseId) {
  return request('GET', '/repos/' + owner + '/' + repo + '/releases/' + releaseId);
}

function deleteRelease(owner, repo, releaseId) {
  return request('DELETE', '/repos/' + owner + '/' + repo + '/releases/' + releaseId);
}

function uploadReleaseAsset(owner, repo, releaseId, fileName, data, contentType) {
  return new Promise(function(resolve, reject) {
    var headers = {
      'User-Agent': 'Drift-Cloud',
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': 'Bearer ' + _token,
      'Content-Type': contentType || 'application/octet-stream'
    };
    var bodyData = typeof data === 'string' ? Buffer.from(data, 'base64') : data;
    headers['Content-Length'] = bodyData.length;

    var options = {
      hostname: 'uploads.github.com',
      path: '/repos/' + owner + '/' + repo + '/releases/' + releaseId + '/assets?name=' + encodeURIComponent(fileName),
      method: 'POST',
      headers: headers,
      timeout: 300000
    };

    var req = https.request(options, function(res) {
      var chunks = [];
      res.on('data', function(chunk) { chunks.push(chunk); });
      res.on('end', function() {
        var resp = Buffer.concat(chunks).toString('utf-8');
        try { resolve(JSON.parse(resp)); }
        catch (e) { resolve(resp); }
      });
    });
    req.on('error', function(e) { reject(e); });
    req.on('timeout', function() { req.destroy(); reject(new Error('上传超时')); });
    req.write(bodyData);
    req.end();
  });
}

function searchCode(owner, repo, query) {
  var q = encodeURIComponent(query + ' repo:' + owner + '/' + repo);
  return request('GET', '/search/code?q=' + q + '&per_page=30');
}

function getRateLimit() {
  return request('GET', '/rate_limit');
}

function getRepoSize(owner, repo) {
  return getRepo(owner, repo);
}

function getCommitList(owner, repo, p, since) {
  var urlPath = '/repos/' + owner + '/' + repo + '/commits?per_page=100';
  if (p) urlPath += '&path=' + encodeContentPath(p);
  if (since) urlPath += '&since=' + since;
  return request('GET', urlPath);
}

function exchangeOAuthCode(clientId, clientSecret, code) {
  return new Promise(function(resolve, reject) {
    var bodyData = JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: code
    });
    var options = {
      hostname: 'github.com',
      path: '/login/oauth/access_token',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyData)
      },
      timeout: 15000
    };
    var req = https.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          var parsed = JSON.parse(data);
          if (parsed.access_token) {
            resolve(parsed.access_token);
          } else {
            reject(new Error(parsed.error_description || 'OAuth failed'));
          }
        } catch(e) { reject(new Error('Parse OAuth response failed')); }
      });
    });
    req.on('error', function(e) { reject(e); });
    req.write(bodyData);
    req.end();
  });
}

function downloadFileFromUrl(url, targetPath, onProgress) {
  return new Promise(function(resolve, reject) {
    var fs = require('fs');
    var pathModule = require('path');
    var dir = pathModule.dirname(targetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    var fileStream = fs.createWriteStream(targetPath);

    var requester = url.startsWith('https') ? https : http;
    requester.get(url, { headers: { 'User-Agent': 'Drift-Cloud', 'Authorization': _token ? 'Bearer ' + _token : '' } }, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFileFromUrl(res.headers.location, targetPath, onProgress).then(resolve).catch(reject);
        return;
      }
      var total = parseInt(res.headers['content-length'], 10) || 0;
      var downloaded = 0;
      res.on('data', function(chunk) {
        downloaded += chunk.length;
        if (onProgress && total) {
          onProgress({ percent: Math.round((downloaded / total) * 100), downloaded: downloaded, total: total });
        }
      });
      res.pipe(fileStream);
      fileStream.on('finish', function() {
        fileStream.close();
        resolve({ success: true, path: targetPath, size: downloaded });
      });
    }).on('error', function(e) {
      try { fs.unlinkSync(targetPath); } catch(ex) {}
      reject(e);
    });
  });
}

module.exports = {
  setToken: setToken,
  getToken: getToken,
  getUser: getUser,
  createRepo: createRepo,
  listRepos: listRepos,
  deleteRepo: deleteRepo,
  getRepo: getRepo,
  getContent: getContent,
  uploadFile: uploadFile,
  deleteFile: deleteFile,
  createBlob: createBlob,
  getRef: getRef,
  createTree: createTree,
  createCommit: createCommit,
  updateRef: updateRef,
  getBlob: getBlob,
  createRelease: createRelease,
  listReleases: listReleases,
  getRelease: getRelease,
  deleteRelease: deleteRelease,
  uploadReleaseAsset: uploadReleaseAsset,
  searchCode: searchCode,
  getRateLimit: getRateLimit,
  getRepoSize: getRepoSize,
  getCommitList: getCommitList,
  exchangeOAuthCode: exchangeOAuthCode,
  downloadFileFromUrl: downloadFileFromUrl,
  request: request
};
