(function() {
  'use strict';

  var _state = {
    chats: [],
    activeChatId: null,
    isGenerating: false,
    streamingContent: '',
    streamingMsgId: null,
    agentRunning: false,
    agentMode: 'react',
    agentSteps: { current: 0, total: 0 },
    agentLog: [],
    agentCurrentTaskId: null,
    sidebarOpen: true,
    settingsOpen: false,
    searchOpen: false,
    activeProvider: '',
    activeModel: '',
    modelList: [],
    config: {},
    executionMode: 'instant',
    executionMeta: { plan: null, currentStep: 0, totalSteps: 0, retryCount: 0, lastError: null }
  };

  var _listeners = {};

  function get(key) {
    if (key.indexOf('.') > -1) {
      var parts = key.split('.');
      var val = _state;
      for (var i = 0; i < parts.length; i++) {
        if (val == null) return undefined;
        val = val[parts[i]];
      }
      return val;
    }
    return _state[key];
  }

  function set(key, value) {
    if (key.indexOf('.') > -1) {
      var parts = key.split('.');
      var obj = _state;
      for (var i = 0; i < parts.length - 1; i++) {
        if (obj[parts[i]] == null) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
    } else {
      _state[key] = value;
    }
    _notify(key, value);
  }

  function batch(updates) {
    var keys = Object.keys(updates);
    for (var i = 0; i < keys.length; i++) {
      set(keys[i], updates[keys[i]]);
    }
  }

  function subscribe(key, callback) {
    if (!_listeners[key]) _listeners[key] = [];
    _listeners[key].push(callback);
    return function() {
      var list = _listeners[key];
      if (list) {
        var idx = list.indexOf(callback);
        if (idx > -1) list.splice(idx, 1);
      }
    };
  }

  function subscribeAll(callback) {
    return subscribe('*', callback);
  }

  function _notify(key, value) {
    var list = _listeners[key];
    if (list) {
      for (var i = 0; i < list.length; i++) {
        try { list[i](value, key); } catch(e) { console.error('[AIState] listener error:', e); }
      }
    }
    var all = _listeners['*'];
    if (all) {
      for (var j = 0; j < all.length; j++) {
        try { all[j](value, key); } catch(e) { console.error('[AIState] wildcard listener error:', e); }
      }
    }
  }

  function getState() {
    return JSON.parse(JSON.stringify(_state));
  }

  function reset() {
    _state.chats = [];
    _state.activeChatId = null;
    _state.isGenerating = false;
    _state.streamingContent = '';
    _state.streamingMsgId = null;
    _state.agentRunning = false;
    _state.agentMode = 'react';
    _state.agentSteps = { current: 0, total: 0 };
    _state.agentLog = [];
    _state.executionMode = 'instant';
    _state.executionMeta = { plan: null, currentStep: 0, totalSteps: 0, retryCount: 0, lastError: null };
  }

  window.AIState = {
    get: get,
    set: set,
    batch: batch,
    subscribe: subscribe,
    subscribeAll: subscribeAll,
    getState: getState,
    reset: reset
  };
})();
