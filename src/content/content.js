/**
 * Content Script
 * Main entry point for JobAssist extension
 * Listens for messages from popup and executes autofill
 */

// Global orchestrator instance
let orchestrator = null;

/**
 * Initialize orchestrator with API key
 */
async function initializeOrchestrator() {
  // Get API key from storage
  const data = await chrome.storage.local.get(['openRouterApiKey']);

  if (!data.openRouterApiKey) {
    throw new Error('OpenRouter API key not configured. Please set it in the extension popup.');
  }

  // Load user profile from JSON file
  const userProfile = await loadUserProfile();

  if (!userProfile) {
    throw new Error('User profile not found. Please ensure src/data/user-profile.json exists.');
  }

  // Create orchestrator
  orchestrator = new LLMAutofillOrchestrator(data.openRouterApiKey);

  return userProfile;
}

/**
 * Load user profile from JSON file
 */
async function loadUserProfile() {
  try {
    const response = await fetch(chrome.runtime.getURL('src/data/user-profile.json'));
    if (!response.ok) {
      throw new Error('Failed to load user profile');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading user profile:', error);
    return null;
  }
}

/**
 * Handle autofill request
 */
async function handleAutofill() {
  try {
    console.log('📨 Received autofill request');

    // Initialize orchestrator
    const userProfile = await initializeOrchestrator();

    // Run autofill
    const result = await orchestrator.autofill(userProfile);

    if (result.success) {
      console.log('✅ Autofill successful');

      // Save analytics
      await saveAnalytics(result);

      // Send success message
      return {
        success: true,
        summary: result.summary,
        analytics: orchestrator.getAnalytics()
      };
    } else {
      console.error('❌ Autofill failed:', result.error);
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.error('❌ Autofill error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handle preview request
 */
async function handlePreview() {
  try {
    console.log('📨 Received preview request');

    // Initialize orchestrator
    const userProfile = await initializeOrchestrator();

    // Generate preview
    const result = await orchestrator.preview(userProfile);

    if (result.success) {
      console.log('✅ Preview generated');
      return {
        success: true,
        preview: result.preview
      };
    } else {
      console.error('❌ Preview failed:', result.error);
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.error('❌ Preview error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Save analytics to storage
 */
async function saveAnalytics(result) {
  try {
    const analytics = orchestrator.getAnalytics();

    // Get existing logs
    const { analyticsLogs = [] } = await chrome.storage.local.get('analyticsLogs');

    // Add new log
    analyticsLogs.push(analytics);

    // Keep only last 50 logs to prevent storage bloat
    const trimmedLogs = analyticsLogs.slice(-50);

    // Save to storage
    await chrome.storage.local.set({ analyticsLogs: trimmedLogs });

    console.log('📊 Analytics saved');
  } catch (error) {
    console.error('Failed to save analytics:', error);
  }
}

/**
 * Handle clear cache request
 */
function handleClearCache() {
  if (orchestrator) {
    orchestrator.clearCache();
    return { success: true, message: 'Cache cleared' };
  }
  return { success: false, error: 'Orchestrator not initialized' };
}

/**
 * Handle download logs request
 */
function handleDownloadLogs() {
  if (orchestrator) {
    orchestrator.downloadAllLogs();
    const sessions = orchestrator.getRecentSessions(100);
    return { success: true, count: sessions.length };
  }
  return { success: false, error: 'Orchestrator not initialized' };
}

/**
 * Handle clear logs request
 */
function handleClearLogs() {
  if (orchestrator) {
    orchestrator.clearLogs();
    return { success: true, message: 'All logs cleared' };
  }
  return { success: false, error: 'Orchestrator not initialized' };
}

/**
 * Listen for messages from popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message received:', request.action);

  switch (request.action) {
    case 'autofill':
      handleAutofill()
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response

    case 'preview':
      handlePreview()
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response

    case 'clearCache':
      sendResponse(handleClearCache());
      return false;

    case 'downloadLogs':
      sendResponse(handleDownloadLogs());
      return false;

    case 'clearLogs':
      sendResponse(handleClearLogs());
      return false;

    default:
      console.warn('Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});

/**
 * Log when content script loads
 */
console.log('🚀 JobAssist content script loaded');
