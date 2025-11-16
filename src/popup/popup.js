/**
 * Popup Script
 * Handles user interactions in the extension popup
 */

// DOM Elements
let autofillBtn, previewBtn, confirmFillBtn, cancelPreviewBtn;
let apiKeyInput, toggleApiKeyBtn, saveConfigBtn;
let clearCacheBtn, viewAnalyticsBtn, downloadLogsBtn, clearLogsBtn;
let statusMessage, previewPanel, previewContent, profileStatus, analyticsSection;

// State
let currentPreview = null;

/**
 * Initialize popup
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  initializeElements();

  // Load configuration
  await loadConfiguration();

  // Setup event listeners
  setupEventListeners();

  // Load analytics
  await loadAnalytics();
});

/**
 * Initialize DOM elements
 */
function initializeElements() {
  autofillBtn = document.getElementById('autofillBtn');
  previewBtn = document.getElementById('previewBtn');
  confirmFillBtn = document.getElementById('confirmFillBtn');
  cancelPreviewBtn = document.getElementById('cancelPreviewBtn');

  apiKeyInput = document.getElementById('apiKeyInput');
  toggleApiKeyBtn = document.getElementById('toggleApiKeyBtn');
  saveConfigBtn = document.getElementById('saveConfigBtn');

  clearCacheBtn = document.getElementById('clearCacheBtn');
  viewAnalyticsBtn = document.getElementById('viewAnalyticsBtn');
  downloadLogsBtn = document.getElementById('downloadLogsBtn');
  clearLogsBtn = document.getElementById('clearLogsBtn');

  statusMessage = document.getElementById('statusMessage');
  previewPanel = document.getElementById('previewPanel');
  previewContent = document.getElementById('previewContent');
  profileStatus = document.getElementById('profileStatus');
  analyticsSection = document.getElementById('analyticsSection');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  autofillBtn.addEventListener('click', handleAutofill);
  previewBtn.addEventListener('click', handlePreview);
  confirmFillBtn.addEventListener('click', handleConfirmFill);
  cancelPreviewBtn.addEventListener('click', handleCancelPreview);

  toggleApiKeyBtn.addEventListener('click', toggleApiKeyVisibility);
  saveConfigBtn.addEventListener('click', saveConfiguration);

  clearCacheBtn.addEventListener('click', handleClearCache);
  viewAnalyticsBtn.addEventListener('click', openAnalyticsPage);
  downloadLogsBtn.addEventListener('click', handleDownloadLogs);
  clearLogsBtn.addEventListener('click', handleClearLogs);
}

/**
 * Load configuration from storage
 */
async function loadConfiguration() {
  const data = await chrome.storage.local.get(['openRouterApiKey']);

  // Load API key
  if (data.openRouterApiKey) {
    apiKeyInput.value = data.openRouterApiKey;
  }

  // Check if user profile file exists
  try {
    const response = await fetch(chrome.runtime.getURL('src/data/user-profile.json'));
    if (response.ok) {
      profileStatus.textContent = '✓ Profile file found';
      profileStatus.className = 'profile-status configured';

      if (data.openRouterApiKey) {
        setStatus('ready', 'Ready to autofill');
      } else {
        setStatus('error', 'Please configure API key');
      }
    } else {
      throw new Error('Profile not found');
    }
  } catch (error) {
    profileStatus.textContent = '✗ Profile file not found (src/data/user-profile.json)';
    profileStatus.className = 'profile-status not-configured';
    setStatus('error', 'Please ensure user-profile.json exists');
  }
}

/**
 * Save configuration to storage
 */
async function saveConfiguration() {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    setStatus('error', 'Please enter an API key');
    return;
  }

  // Accept both OpenAI (sk-...) and OpenRouter (sk-or-...) API keys
  if (!apiKey.startsWith('sk-')) {
    setStatus('error', 'Invalid API key format. Should start with sk-');
    return;
  }

  try {
    await chrome.storage.local.set({ openRouterApiKey: apiKey });
    setStatus('success', 'Configuration saved!');

    // Reload configuration
    await loadConfiguration();
  } catch (error) {
    setStatus('error', `Failed to save: ${error.message}`);
  }
}

/**
 * Handle autofill button click
 */
async function handleAutofill() {
  try {
    setStatus('loading', 'Autofilling form...');
    autofillBtn.disabled = true;
    previewBtn.disabled = true;

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Send autofill message to content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'autofill' });

    if (response.success) {
      setStatus('success', `Filled ${response.summary.filled} fields!`);

      // Reload analytics
      await loadAnalytics();
    } else {
      setStatus('error', response.error || 'Autofill failed');
    }
  } catch (error) {
    setStatus('error', error.message);
  } finally {
    autofillBtn.disabled = false;
    previewBtn.disabled = false;
  }
}

/**
 * Handle preview button click
 */
async function handlePreview() {
  try {
    setStatus('loading', 'Generating preview...');
    previewBtn.disabled = true;
    autofillBtn.disabled = true;

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Send preview message to content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'preview' });

    if (response.success) {
      currentPreview = response.preview;
      displayPreview(response.preview);
      setStatus('ready', 'Preview ready');
    } else {
      setStatus('error', response.error || 'Preview failed');
    }
  } catch (error) {
    setStatus('error', error.message);
  } finally {
    previewBtn.disabled = false;
    autofillBtn.disabled = false;
  }
}

/**
 * Display preview
 */
function displayPreview(preview) {
  previewContent.innerHTML = '';

  if (!preview.sections || preview.sections.length === 0) {
    previewContent.innerHTML = '<p class="help-text">No fields to preview</p>';
    return;
  }

  // Show summary
  const summary = document.createElement('div');
  summary.className = 'preview-summary';
  summary.innerHTML = `
    <p><strong>${preview.willFill.length}</strong> fields will be filled</p>
    <p><strong>${preview.willSkip.length}</strong> fields will be skipped</p>
  `;
  previewContent.appendChild(summary);

  // Show sections
  preview.sections.forEach(section => {
    if (section.fields.length === 0) return;

    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'preview-section';

    const sectionHeading = document.createElement('h4');
    sectionHeading.textContent = section.heading || 'Unlabeled Section';
    sectionDiv.appendChild(sectionHeading);

    section.fields.forEach(field => {
      const fieldDiv = document.createElement('div');
      fieldDiv.className = `preview-field ${field.willFill ? 'will-fill' : 'will-skip'}`;

      const label = document.createElement('span');
      label.className = 'preview-field-label';
      label.textContent = field.label;

      const value = document.createElement('span');
      value.className = 'preview-field-value';
      value.textContent = field.proposedValue === 'none' ? '(skip)' : field.proposedValue;
      value.title = field.reasoning || '';

      fieldDiv.appendChild(label);
      fieldDiv.appendChild(value);
      sectionDiv.appendChild(fieldDiv);
    });

    previewContent.appendChild(sectionDiv);
  });

  // Show preview panel
  previewPanel.style.display = 'block';
}

/**
 * Handle confirm fill
 */
async function handleConfirmFill() {
  previewPanel.style.display = 'none';
  await handleAutofill();
}

/**
 * Handle cancel preview
 */
function handleCancelPreview() {
  previewPanel.style.display = 'none';
  currentPreview = null;
  setStatus('ready', 'Ready to autofill');
}

/**
 * Toggle API key visibility
 */
function toggleApiKeyVisibility() {
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    toggleApiKeyBtn.textContent = '🙈';
  } else {
    apiKeyInput.type = 'password';
    toggleApiKeyBtn.textContent = '👁️';
  }
}

/**
 * Handle clear cache
 */
async function handleClearCache() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'clearCache' });

    if (response.success) {
      setStatus('success', 'Cache cleared!');
    } else {
      setStatus('error', 'Failed to clear cache');
    }
  } catch (error) {
    setStatus('error', error.message);
  }
}

/**
 * Handle download logs
 */
async function handleDownloadLogs() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'downloadLogs' });

    if (response.success) {
      setStatus('success', `Downloaded ${response.count} session logs!`);
    } else {
      setStatus('error', response.error || 'Failed to download logs');
    }
  } catch (error) {
    setStatus('error', error.message);
  }
}

/**
 * Handle clear logs
 */
async function handleClearLogs() {
  if (!confirm('Are you sure you want to clear all session logs? This cannot be undone.')) {
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'clearLogs' });

    if (response.success) {
      setStatus('success', 'All logs cleared!');
    } else {
      setStatus('error', 'Failed to clear logs');
    }
  } catch (error) {
    setStatus('error', error.message);
  }
}

/**
 * Load analytics
 */
async function loadAnalytics() {
  const data = await chrome.storage.local.get('analyticsLogs');
  const logs = data.analyticsLogs || [];

  if (logs.length === 0) {
    analyticsSection.innerHTML = '<p class="help-text">No recent autofill activity</p>';
    return;
  }

  // Show last 3 logs
  const recentLogs = logs.slice(-3).reverse();

  analyticsSection.innerHTML = '';
  recentLogs.forEach(log => {
    const item = document.createElement('div');
    item.className = 'analytics-item';

    const url = new URL(log.url);
    const domain = url.hostname;

    item.innerHTML = `
      <div class="analytics-stat">
        <span class="analytics-stat-label">Domain:</span>
        <span class="analytics-stat-value">${domain}</span>
      </div>
      <div class="analytics-stat">
        <span class="analytics-stat-label">Filled:</span>
        <span class="analytics-stat-value">${log.fill ? log.fill.filled : 0} fields</span>
      </div>
      <div class="analytics-stat">
        <span class="analytics-stat-label">Fill Rate:</span>
        <span class="analytics-stat-value">${log.fill ? log.fill.fillRate : '0%'}</span>
      </div>
      <div class="analytics-stat">
        <span class="analytics-stat-label">Time:</span>
        <span class="analytics-stat-value">${new Date(log.timestamp).toLocaleString()}</span>
      </div>
    `;

    analyticsSection.appendChild(item);
  });
}

/**
 * Open analytics page
 */
function openAnalyticsPage() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('src/analytics/analytics.html')
  });
}

/**
 * Set status message
 */
function setStatus(type, message) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}
