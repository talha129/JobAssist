/**
 * JobAssist Content Script (Refactored)
 * Main orchestrator for field detection, highlighting, and autofill
 */

class JobAssist {
  constructor() {
    this.highlightedElements = new Set();
    this.detectedFields = [];
    this.autofillController = null;
    this.isEnabled = true;
    this.observerTimeout = null;
    this.analytics = analytics; // Use global analytics instance
  }

  /**
   * Initialize JobAssist
   */
  async init() {
    logger.info('Initializing JobAssist...');
    const timer = this.analytics.startTimer('initialization');

    try {
      // Initialize feedback collector with session ID
      feedbackCollector.init(analytics.sessionId);

      // Track page load
      analytics.logToFile({
        event: 'jobassist_init_start',
        data: { url: window.location.href }
      });

      // Load profile and synonyms
      const [profile, synonyms] = await Promise.all([
        this.loadProfile(),
        this.loadSynonyms()
      ]);

      // Initialize autofill controller
      this.autofillController = new AutofillController(profile, synonyms);

      // Detect and process fields
      this.detectAndProcessFields();

      // Observe DOM changes for dynamic content
      this.observeDOMChanges();

      // Listen for messages (for future UI controls)
      this.setupMessageListener();

      await timer.end();
      logger.info('JobAssist initialized successfully');

      analytics.logToFile({
        event: 'jobassist_init_complete',
        data: { success: true }
      });
    } catch (error) {
      logger.error('Failed to initialize JobAssist:', error);
      analytics.trackError(error, { phase: 'initialization' });
    }
  }

  /**
   * Load user profile
   */
  async loadProfile() {
    try {
      const response = await fetch(chrome.runtime.getURL('src/data/user-profile.json'));
      return await response.json();
    } catch (error) {
      logger.error('Failed to load profile:', error);
      throw error;
    }
  }

  /**
   * Load field synonyms
   */
  async loadSynonyms() {
    try {
      const response = await fetch(chrome.runtime.getURL('src/data/fieldSynonyms.json'));
      return await response.json();
    } catch (error) {
      logger.error('Failed to load synonyms:', error);
      throw error;
    }
  }

  /**
   * Detect and process all fields on the page
   */
  detectAndProcessFields() {
    const timer = this.analytics.startTimer('field_detection');

    // Clear previous data
    this.clearHighlights();
    this.detectedFields = [];

    // Find all fields
    const fields = FieldDetector.findAllFields();
    logger.info(`Found ${fields.length} input fields`);

    // Extract data for each field
    this.detectedFields = fields.map(field => TextExtractor.extractFieldData(field));

    // Track field detection
    this.analytics.trackFieldDetection(this.detectedFields);

    // Highlight fields and related text
    this.highlightFields();

    // Log autofill statistics
    if (this.autofillController) {
      const stats = this.autofillController.getStatistics(this.detectedFields);
      logger.info('Autofill Statistics:', stats);
      logger.info(`Can autofill ${stats.canFill} out of ${stats.totalFields} fields`);

      // Track statistics
      this.analytics.logToFile({
        event: 'autofill_statistics',
        data: stats
      });
    }

    timer.end();
  }

  /**
   * Highlight detected fields and their related text
   */
  highlightFields() {
    this.detectedFields.forEach(fieldData => {
      const { element, labels, context } = fieldData;

      // Highlight the field itself
      if (!this.highlightedElements.has(element)) {
        element.classList.add('jobassist-highlight-field');
        this.highlightedElements.add(element);
      }

      // Highlight related text elements
      const relatedElements = this.findRelatedElements(fieldData);
      relatedElements.forEach(el => {
        if (el && !this.highlightedElements.has(el)) {
          el.classList.add('jobassist-highlight');
          this.highlightedElements.add(el);
        }
      });
    });
  }

  /**
   * Find related DOM elements for highlighting
   */
  findRelatedElements(fieldData) {
    const { element } = fieldData;
    const relatedElements = [];

    // Find associated label via 'for' attribute
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) relatedElements.push(label);
    }

    // Find parent label
    const parentLabel = element.closest('label');
    if (parentLabel) relatedElements.push(parentLabel);

    // Find aria-labelledby
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      ariaLabelledBy.split(' ').forEach(id => {
        const el = document.getElementById(id);
        if (el) relatedElements.push(el);
      });
    }

    // Find aria-describedby
    const ariaDescribedBy = element.getAttribute('aria-describedby');
    if (ariaDescribedBy) {
      ariaDescribedBy.split(' ').forEach(id => {
        const el = document.getElementById(id);
        if (el) relatedElements.push(el);
      });
    }

    // Find adjacent elements
    const previousSibling = element.previousElementSibling;
    if (previousSibling && TextExtractor.isTextElement(previousSibling)) {
      relatedElements.push(previousSibling);
    }

    const nextSibling = element.nextElementSibling;
    if (nextSibling && TextExtractor.isHelperElement(nextSibling)) {
      relatedElements.push(nextSibling);
    }

    // Find fieldset legend
    const fieldset = element.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) relatedElements.push(legend);
    }

    return relatedElements;
  }

  /**
   * Clear all highlights
   */
  clearHighlights() {
    this.highlightedElements.forEach(element => {
      element.classList.remove('jobassist-highlight', 'jobassist-highlight-field');
    });
    this.highlightedElements.clear();
  }

  /**
   * Observe DOM changes for dynamically loaded content
   */
  observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
      // Debounce to avoid too many re-scans
      clearTimeout(this.observerTimeout);
      this.observerTimeout = setTimeout(() => {
        logger.debug('DOM changed, re-scanning fields...');
        this.detectAndProcessFields();
      }, 500);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Setup message listener for commands
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      logger.debug('Received message:', message);

      switch (message.action) {
        case 'autofillAll':
          this.handleAutofillAll(sendResponse);
          return true; // Async response

        case 'clearAll':
          this.handleClearAll(sendResponse);
          return true;

        case 'getPreview':
          this.handleGetPreview(sendResponse);
          return true;

        case 'getStatistics':
          this.handleGetStatistics(sendResponse);
          return true;

        case 'downloadLogs':
          this.handleDownloadLogs(sendResponse);
          return true;

        default:
          sendResponse({ error: 'Unknown action' });
      }
    });
  }

  /**
   * Handle autofill all command
   */
  handleAutofillAll(sendResponse) {
    if (!this.autofillController) {
      sendResponse({ error: 'Autofill controller not initialized' });
      return;
    }

    try {
      const results = this.autofillController.autofillAll(this.detectedFields);
      sendResponse({ success: true, results });
    } catch (error) {
      logger.error('Autofill failed:', error);
      sendResponse({ error: error.message });
    }
  }

  /**
   * Handle clear all command
   */
  handleClearAll(sendResponse) {
    if (!this.autofillController) {
      sendResponse({ error: 'Autofill controller not initialized' });
      return;
    }

    try {
      this.autofillController.clearAll();
      sendResponse({ success: true });
    } catch (error) {
      logger.error('Clear failed:', error);
      sendResponse({ error: error.message });
    }
  }

  /**
   * Handle get preview command
   */
  handleGetPreview(sendResponse) {
    if (!this.autofillController) {
      sendResponse({ error: 'Autofill controller not initialized' });
      return;
    }

    try {
      const preview = this.autofillController.getPreview(this.detectedFields);
      sendResponse({ success: true, preview });
    } catch (error) {
      logger.error('Get preview failed:', error);
      sendResponse({ error: error.message });
    }
  }

  /**
   * Handle get statistics command
   */
  handleGetStatistics(sendResponse) {
    if (!this.autofillController) {
      sendResponse({ error: 'Autofill controller not initialized' });
      return;
    }

    try {
      const stats = this.autofillController.getStatistics(this.detectedFields);
      sendResponse({ success: true, stats });
    } catch (error) {
      logger.error('Get statistics failed:', error);
      sendResponse({ error: error.message });
    }
  }

  /**
   * Handle download logs command
   */
  handleDownloadLogs(sendResponse) {
    try {
      // Finish session and generate final summary
      analytics.finishSession();

      // Generate feedback report
      const feedbackReport = feedbackCollector.generateReport();

      // Download combined log file with analytics AND feedback
      const logData = {
        sessionId: analytics.sessionId,
        createdAt: new Date().toISOString(),
        url: window.location.href,
        domain: window.location.hostname,

        // Analytics data
        analytics: {
          events: analytics.events,
          eventCount: analytics.events.length,
          metrics: analytics.metrics
        },

        // Feedback data (this is what you'll review!)
        feedback: feedbackReport
      };

      const dataStr = JSON.stringify(logData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', `jobassist_${analytics.sessionId}.json`);
      linkElement.click();

      logger.info(`Logs downloaded: jobassist_${analytics.sessionId}.json`);
      logger.info(`Feedback fields: ${feedbackReport.totalFields}`);

      sendResponse({
        success: true,
        feedbackCount: feedbackReport.totalFields
      });
    } catch (error) {
      logger.error('Download logs failed:', error);
      sendResponse({ error: error.message });
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const jobAssist = new JobAssist();
    jobAssist.init();

    // Make it globally accessible for debugging
    window.jobAssist = jobAssist;
  });
} else {
  const jobAssist = new JobAssist();
  jobAssist.init();
  window.jobAssist = jobAssist;
}
