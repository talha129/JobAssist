/**
 * Background Service Worker
 * Handles log file writing and other background tasks
 */

// Store logs in memory, write periodically
const logBuffer = new Map(); // sessionId -> array of log entries

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'writeLog') {
    handleLogWrite(message.data, message.sessionId);
    sendResponse({ success: true });
    return true;
  }
});

/**
 * Handle log writing
 */
function handleLogWrite(logEntry, sessionId) {
  // Buffer logs
  if (!logBuffer.has(sessionId)) {
    logBuffer.set(sessionId, []);
  }

  logBuffer.get(sessionId).push(logEntry);

  // Log to console for immediate visibility
  console.log(`[Background] Log entry buffered for session ${sessionId}:`, logEntry.event);

  // If session ended, write all logs to file
  if (logEntry.event === 'session_end') {
    writeLogsToFile(sessionId);
  }
}

/**
 * Write buffered logs to file
 */
async function writeLogsToFile(sessionId) {
  const logs = logBuffer.get(sessionId);
  if (!logs || logs.length === 0) return;

  const logFileName = `session_${sessionId}.json`;
  const logData = {
    sessionId,
    events: logs,
    eventCount: logs.length,
    createdAt: new Date().toISOString()
  };

  // Log to console with download instructions
  console.log('═══════════════════════════════════════════════');
  console.log('%cJobAssist Session Log Ready', 'color: #4CAF50; font-weight: bold; font-size: 16px');
  console.log('═══════════════════════════════════════════════');
  console.log(`Session ID: ${sessionId}`);
  console.log(`Events logged: ${logs.length}`);
  console.log('');
  console.log('%cTo save log file, run:', 'color: #2196F3; font-weight: bold');
  console.log(`%cwindow.downloadSessionLog('${sessionId}')`, 'background: #f0f0f0; padding: 5px; font-family: monospace');
  console.log('');
  console.log('%cOr view logs:', 'color: #2196F3; font-weight: bold');
  console.log(`%cwindow.viewSessionLogs('${sessionId}')`, 'background: #f0f0f0; padding: 5px; font-family: monospace');
  console.log('═══════════════════════════════════════════════');

  // Make download function globally available
  if (typeof window !== 'undefined') {
    window.downloadSessionLog = (sid) => downloadLog(sid || sessionId);
    window.viewSessionLogs = (sid) => viewLogs(sid || sessionId);
  }
}

/**
 * Download log file
 */
function downloadLog(sessionId) {
  const logs = logBuffer.get(sessionId);
  if (!logs) {
    console.error(`No logs found for session: ${sessionId}`);
    return;
  }

  const logData = {
    sessionId,
    events: logs,
    eventCount: logs.length,
    createdAt: new Date().toISOString()
  };

  const dataStr = JSON.stringify(logData, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', `jobassist_${sessionId}.json`);
  linkElement.click();

  console.log(`%c✅ Log file downloaded: jobassist_${sessionId}.json`, 'color: #4CAF50; font-weight: bold');
}

/**
 * View logs in console
 */
function viewLogs(sessionId) {
  const logs = logBuffer.get(sessionId);
  if (!logs) {
    console.error(`No logs found for session: ${sessionId}`);
    return;
  }

  console.log('═══════════════════════════════════════════════');
  console.log(`%cSession Logs: ${sessionId}`, 'color: #4CAF50; font-weight: bold; font-size: 14px');
  console.log('═══════════════════════════════════════════════');

  logs.forEach((log, index) => {
    console.log(`\n[${index + 1}] ${log.event} @ ${log.timestamp}`);
    console.log(log.data || log);
  });

  console.log('\n═══════════════════════════════════════════════');
}
