// ==================== AI 任务规划器 ====================
(function() {
  var TOOL_HINTS = {
    '搜索': 'browser_create_tab',
    '查找': 'browser_create_tab',
    '浏览': 'browser_create_tab',
    '打开': 'browser_create_tab',
    '访问': 'browser_create_tab',
    '读取': 'file_read',
    '查看': 'file_read',
    '写入': 'file_write',
    '保存': 'file_write',
    '创建': 'file_mkdir',
    '删除': 'file_delete',
    '列出': 'file_list',
    '截图': 'browser_screenshot',
    '点击': 'browser_click',
    '输入': 'browser_input',
    '运行': 'shell_exec',
    '执行': 'shell_exec'
  };

  var SEQUENTIAL_PATTERNS = [
    { pattern: /搜索.*(?:整理|总结|汇总)/, steps: ['搜索相关信息', '整理搜索结果', '生成总结报告'] },
    { pattern: /调研.*(?:报告|分析)/, steps: ['搜索调研资料', '分析收集的信息', '生成调研报告'] },
    { pattern: /对比.*(?:总结|分析)/, steps: ['收集对比数据', '分析差异', '生成对比总结'] },
    { pattern: /分析.*(?:生成|输出)/, steps: ['收集分析数据', '进行数据分析', '生成分析报告'] },
    { pattern: /查找.*(?:修改|更新)/, steps: ['查找目标文件', '读取文件内容', '修改并保存'] }
  ];

  function decomposeTask(userMessage, chatHistory) {
    if (!userMessage) return { steps: [], dag: {} };

    var steps = [];
    var matched = false;

    for (var i = 0; i < SEQUENTIAL_PATTERNS.length; i++) {
      var sp = SEQUENTIAL_PATTERNS[i];
      if (sp.pattern.test(userMessage)) {
        for (var j = 0; j < sp.steps.length; j++) {
          var toolHint = '';
          var stepDesc = sp.steps[j];
          var keys = Object.keys(TOOL_HINTS);
          for (var k = 0; k < keys.length; k++) {
            if (stepDesc.indexOf(keys[k]) !== -1) {
              toolHint = TOOL_HINTS[keys[k]];
              break;
            }
          }
          steps.push({
            id: 'step-' + (j + 1),
            description: stepDesc,
            toolHint: toolHint,
            dependsOn: j > 0 ? ['step-' + j] : [],
            status: 'pending'
          });
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      var sentences = userMessage.split(/[，。；,;]/);
      var filtered = sentences.filter(function(s) { return s.trim().length > 2; });
      if (filtered.length >= 2) {
        for (var fi = 0; fi < filtered.length; fi++) {
          var fToolHint = '';
          var fDesc = filtered[fi].trim();
          var fKeys = Object.keys(TOOL_HINTS);
          for (var fk = 0; fk < fKeys.length; fk++) {
            if (fDesc.indexOf(fKeys[fk]) !== -1) {
              fToolHint = TOOL_HINTS[fKeys[fk]];
              break;
            }
          }
          steps.push({
            id: 'step-' + (fi + 1),
            description: fDesc,
            toolHint: fToolHint,
            dependsOn: fi > 0 ? ['step-' + fi] : [],
            status: 'pending'
          });
        }
      } else {
        steps.push({
          id: 'step-1',
          description: userMessage,
          toolHint: '',
          dependsOn: [],
          status: 'pending'
        });
      }
    }

    var depResult = analyzeDependencies(steps);
    return { steps: steps, dag: depResult.dag, parallelGroups: depResult.parallelGroups };
  }

  function analyzeDependencies(steps) {
    var dag = {};
    var parallelGroups = [];
    var stepMap = {};

    for (var i = 0; i < steps.length; i++) {
      dag[steps[i].id] = steps[i].dependsOn || [];
      stepMap[steps[i].id] = steps[i];
    }

    // Topological sort to find parallel groups
    var remaining = steps.slice();
    var completed = {};
    var groupIndex = 0;

    while (remaining.length > 0) {
      var currentGroup = [];
      for (var ri = remaining.length - 1; ri >= 0; ri--) {
        var step = remaining[ri];
        var deps = dag[step.id] || [];
        var depsMet = true;
        for (var di = 0; di < deps.length; di++) {
          if (!completed[deps[di]]) { depsMet = false; break; }
        }
        if (depsMet) {
          currentGroup.push(step.id);
          remaining.splice(ri, 1);
        }
      }
      if (currentGroup.length === 0) {
        // Circular dependency or error, just add remaining as one group
        for (var ei = 0; ei < remaining.length; ei++) {
          parallelGroups.push([remaining[ei].id]);
        }
        break;
      }
      for (var ci = 0; ci < currentGroup.length; ci++) {
        completed[currentGroup[ci]] = true;
      }
      parallelGroups.push(currentGroup);
      groupIndex++;
      if (groupIndex > 20) break; // Safety limit
    }

    return { dag: dag, parallelGroups: parallelGroups };
  }

  function replanAfterFailure(steps, failedStepId, error) {
    var updatedSteps = steps.slice();
    for (var i = 0; i < updatedSteps.length; i++) {
      if (updatedSteps[i].id === failedStepId) {
        updatedSteps[i].status = 'failed';
        updatedSteps[i].error = error;
      }
    }
    // Mark dependent steps as blocked
    for (var j = 0; j < updatedSteps.length; j++) {
      if (updatedSteps[j].status === 'pending') {
        var deps = updatedSteps[j].dependsOn || [];
        for (var d = 0; d < deps.length; d++) {
          if (deps[d] === failedStepId) {
            updatedSteps[j].status = 'blocked';
            updatedSteps[j].blockedBy = failedStepId;
          }
        }
      }
    }
    return updatedSteps;
  }

  function getNextExecutableSteps(steps) {
    var completedIds = {};
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].status === 'completed') completedIds[steps[i].id] = true;
    }
    var executable = [];
    for (var j = 0; j < steps.length; j++) {
      if (steps[j].status !== 'pending') continue;
      var deps = steps[j].dependsOn || [];
      var depsMet = true;
      for (var d = 0; d < deps.length; d++) {
        if (!completedIds[deps[d]]) { depsMet = false; break; }
      }
      if (depsMet) executable.push(steps[j]);
    }
    return executable;
  }

  function parsePlanFromAIResponse(content) {
    if (!content) return [];
    var steps = [];
    var lines = content.split('\n');
    var inPlan = false;
    var stepNum = 1;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.match(/^##\s*执行计划/) || line.match(/^##\s*Execution Plan/i)) {
        inPlan = true;
        continue;
      }
      if (inPlan && line.match(/^##\s*/)) {
        break; // End of plan section
      }
      if (!inPlan) continue;

      // Match numbered steps: "1. xxx" or "1) xxx" or "- xxx"
      var stepMatch = line.match(/^\d+[\.\)]\s*(.+)/) || line.match(/^-\s*(.+)/);
      if (stepMatch && stepMatch[1].trim()) {
        var desc = stepMatch[1].trim();
        var toolHint = '';
        var keys = Object.keys(TOOL_HINTS);
        for (var k = 0; k < keys.length; k++) {
          if (desc.indexOf(keys[k]) !== -1) { toolHint = TOOL_HINTS[keys[k]]; break; }
        }
        steps.push({
          id: 'plan-step-' + stepNum,
          description: desc,
          toolHint: toolHint,
          dependsOn: stepNum > 1 ? ['plan-step-' + (stepNum - 1)] : [],
          status: 'pending'
        });
        stepNum++;
      }
    }

    return steps;
  }

  window.AIPlanner = {
    decomposeTask: decomposeTask,
    analyzeDependencies: analyzeDependencies,
    replanAfterFailure: replanAfterFailure,
    getNextExecutableSteps: getNextExecutableSteps,
    parsePlanFromAIResponse: parsePlanFromAIResponse
  };
})();
