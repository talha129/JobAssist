/**
 * Popup Script
 * Handles UI interactions and communicates with content script
 */

// DOM elements
const autofillBtn = document.getElementById('autofillBtn');
const clearBtn = document.getElementById('clearBtn');
const downloadLogsBtn = document.getElementById('downloadLogsBtn');
const fieldsDetectedEl = document.getElementById('fieldsDetected');
const canFillEl = document.getElementById('canFill');
const resultEl = document.getElementById('result');
const resultSuccessEl = document.getElementById('resultSuccess');
const resultErrorEl = document.getElementById('resultError');
const successMessageEl = document.getElementById('successMessage');
const errorMessageEl = document.getElementById('errorMessage');

// Load statistics on popup open
loadStatistics();

// Event listeners
autofillBtn.addEventListener('click', handleAutofill);
clearBtn.addEventListener('click', handleClear);
downloadLogsBtn.addEventListener('click', handleDownloadLogs);

/**
 * Load statistics from content script
 */
async function loadStatistics() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: 'getStatistics' }, (response) => {
      if (chrome.runtime.lastError) {
        showError('Extension not loaded on this page');
        return;
      }

      if (response && response.success) {
        const stats = response.stats;
        fieldsDetectedEl.textContent = stats.totalFields || 0;
        canFillEl.textContent = stats.canFill || 0;
      }
    });
  } catch (error) {
    console.error('Error loading statistics:', error);
  }
}

/**
 * Handle autofill button click
 */
async function handleAutofill() {
  try {
    autofillBtn.classList.add('loading');
    hideResult();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: 'autofillAll' }, (response) => {
      autofillBtn.classList.remove('loading');

      if (chrome.runtime.lastError) {
        showError('Failed to connect to page');
        return;
      }

      if (response && response.success) {
        const { results } = response;
        showSuccess(`Filled ${results.filled} fields! (${results.skipped} skipped, ${results.failed} failed)`);

        // Reload statistics
        loadStatistics();
      } else {
        showError(response?.error || 'Autofill failed');
      }
    });
  } catch (error) {
    autofillBtn.classList.remove('loading');
    showError(error.message);
  }
}

/**
 * Handle clear button click
 */
async function handleClear() {
  try {
    clearBtn.classList.add('loading');
    hideResult();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: 'clearAll' }, (response) => {
      clearBtn.classList.remove('loading');

      if (chrome.runtime.lastError) {
        showError('Failed to connect to page');
        return;
      }

      if (response && response.success) {
        showSuccess('All fields cleared!');
      } else {
        showError(response?.error || 'Clear failed');
      }
    });
  } catch (error) {
    clearBtn.classList.remove('loading');
    showError(error.message);
  }
}

/**
 * Handle download logs button click
 */
async function handleDownloadLogs() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: 'downloadLogs' }, (response) => {
      if (chrome.runtime.lastError) {
        showError('Failed to connect to page');
        return;
      }

      if (response && response.success) {
        showSuccess('Logs downloaded!');
      } else {
        showError(response?.error || 'Download failed');
      }
    });
  } catch (error) {
    showError(error.message);
  }
}

/**
 * Show success message
 */
function showSuccess(message) {
  hideResult();
  resultEl.style.display = 'block';
  resultSuccessEl.style.display = 'flex';
  successMessageEl.textContent = message;

  setTimeout(() => {
    hideResult();
  }, 3000);
}

/**
 * Show error message
 */
function showError(message) {
  hideResult();
  resultEl.style.display = 'block';
  resultErrorEl.style.display = 'flex';
  errorMessageEl.textContent = message;

  setTimeout(() => {
    hideResult();
  }, 3000);
}

/**
 * Hide result message
 */
function hideResult() {
  resultEl.style.display = 'none';
  resultSuccessEl.style.display = 'none';
  resultErrorEl.style.display = 'none';
}
