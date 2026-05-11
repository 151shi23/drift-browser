const os = require('os');
const { webContents } = require('electron');

const SAMPLE_INTERVAL = 5000;
let monitorTimer = null;
let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();

function startMonitor() {
  if (monitorTimer) return;
  monitorTimer = setInterval(collectAndPush, SAMPLE_INTERVAL);
  collectAndPush();
}

function stopMonitor() {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
}

function collectAndPush() {
  const data = collectData();
  const { getMainWindow } = require('./window-manager');
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('resource-monitor-update', data);
  }
}

function collectData() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsage = process.memoryUsage();

  const currentCpu = process.cpuUsage();
  const now = Date.now();
  const elapsed = now - lastCpuTime;
  const cpuPercent = elapsed > 0
    ? Math.min(100, ((currentCpu.user + currentCpu.system - lastCpuUsage.user - lastCpuUsage.system) / 1000) / elapsed * 100)
    : 0;
  lastCpuUsage = currentCpu;
  lastCpuTime = now;

  const rendererCount = 0;
  try {
    const allWC = webContents.getAllWebContents();
    const count = allWC.filter(wc => !wc.isDestroyed()).length;
    return {
      timestamp: Date.now(),
      system: {
        totalMemoryMB: Math.round(totalMem / 1024 / 1024),
        freeMemoryMB: Math.round(freeMem / 1024 / 1024),
        memoryPressure: 1 - (freeMem / totalMem),
        cpuUsage: cpuPercent / 100
      },
      browser: {
        mainProcessMemoryMB: Math.round(memUsage.rss / 1024 / 1024),
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        rendererCount: count
      }
    };
  } catch (e) {
    return {
      timestamp: Date.now(),
      system: {
        totalMemoryMB: Math.round(totalMem / 1024 / 1024),
        freeMemoryMB: Math.round(freeMem / 1024 / 1024),
        memoryPressure: 1 - (freeMem / totalMem),
        cpuUsage: cpuPercent / 100
      },
      browser: {
        mainProcessMemoryMB: Math.round(memUsage.rss / 1024 / 1024),
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        rendererCount: rendererCount
      }
    };
  }
}

function getResourceData() {
  return collectData();
}

module.exports = { startMonitor, stopMonitor, getResourceData };
