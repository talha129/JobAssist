/**
 * Analytics & Telemetry
 * Writes structured logs to local filesystem for later analysis
 */

class Analytics {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.logFilePath = null;
    this.events = [];
    this.metrics = {
      fieldsDetected: 0,
      fieldsClassified: 0,
      fieldsFilled: 0,
      fieldsFailed: 0,
      fieldsSkipped: 0,
      classificationsByStrategy: {},
      classificationsByType: {},
      fillsByStrategy: {},
      errors: []
    };
    this.startTime = Date.now();
    this.initLogFile();
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substr(2, 6);
    return `${timestamp}_${random}`;
  }

  /**
   * Initialize log file
   */
  async initLogFile() {
    this.logFilePath = `/Users/talhaazaz/Documents/DePaul/Job/JobAssist/logs/session_${this.sessionId}.json`;

    // Log session start
    this.logToFile({
      event: 'session_start',
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      domain: window.location.hostname,
      userAgent: navigator.userAgent
    });

    console.log(`[JobAssist] Analytics session started: ${this.sessionId}`);
    console.log(`[JobAssist] Log file: ${this.logFilePath}`);
  }

  /**
   * Write to log file
   */
  async logToFile(data) {
    const logEntry = {
      ...data,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId
    };

    this.events.push(logEntry);

    // Also log to console for immediate visibility
    console.log(`[Analytics] ${data.event}:`, data);

    // Send message to background script to write to file
    try {
      await chrome.runtime.sendMessage({
        action: 'writeLog',
        data: logEntry,
        sessionId: this.sessionId
      });
    } catch (error) {
      // Fallback: log to console only
      console.warn('[Analytics] Could not write to file:', error);
    }
  }

  /**
   * Track field detection
   */
  async trackFieldDetection(fields) {
    this.metrics.fieldsDetected = fields.length;

    const fieldTypes = fields.reduce((acc, field) => {
      const type = field.element.tagName.toLowerCase();
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const labeling = {
      withLabels: fields.filter(f => f.labels.length > 0).length,
      withPlaceholder: fields.filter(f => f.placeholder).length,
      withAriaLabel: fields.filter(f => f.ariaLabel).length,
      withContext: fields.filter(f => f.context && f.context.sectionHeading).length
    };

    await this.logToFile({
      event: 'field_detection',
      data: {
        total: fields.length,
        fieldTypes,
        labeling,
        fields: fields.map(f => ({
          type: f.element.tagName,
          inputType: f.type,
          labels: f.labels,
          placeholder: f.placeholder,
          ariaLabel: f.ariaLabel,
          name: f.name,
          id: f.id
        }))
      }
    });
  }

  /**
   * Track field classification
   */
  async trackClassification(fieldData, classification) {
    this.metrics.fieldsClassified++;

    // Track strategy usage
    const strategy = classification.strategy;
    this.metrics.classificationsByStrategy[strategy] =
      (this.metrics.classificationsByStrategy[strategy] || 0) + 1;

    // Track classification types
    const type = classification.type;
    this.metrics.classificationsByType[type] =
      (this.metrics.classificationsByType[type] || 0) + 1;

    await this.logToFile({
      event: 'field_classification',
      data: {
        field: {
          type: fieldData.element.tagName,
          labels: fieldData.labels,
          placeholder: fieldData.placeholder,
          name: fieldData.name,
          id: fieldData.id
        },
        classification: {
          type: classification.type,
          confidence: classification.confidence,
          strategy: classification.strategy,
          matchedText: classification.matchedText,
          matchedPattern: classification.matchedPattern
        }
      }
    });
  }

  /**
   * Track autofill attempt
   */
  async trackAutofill(fieldData, classification, value, status, reason = null) {
    if (status === 'filled') {
      this.metrics.fieldsFilled++;
    } else if (status === 'skipped') {
      this.metrics.fieldsSkipped++;
    } else {
      this.metrics.fieldsFailed++;
    }

    // Track fill strategy
    const fillStrategy = fieldData.element.tagName.toLowerCase();
    this.metrics.fillsByStrategy[fillStrategy] =
      (this.metrics.fillsByStrategy[fillStrategy] || 0) + 1;

    await this.logToFile({
      event: 'autofill_attempt',
      data: {
        field: {
          type: fieldData.element.tagName,
          inputType: fieldData.type,
          labels: fieldData.labels,
          name: fieldData.name,
          id: fieldData.id
        },
        classification: {
          type: classification.type,
          confidence: classification.confidence
        },
        result: {
          status,
          reason,
          valuePreview: value ? String(value).substring(0, 100) : null,
          valueLength: value ? String(value).length : 0
        }
      }
    });
  }

  /**
   * Track errors
   */
  async trackError(error, context = {}) {
    this.metrics.errors.push({
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });

    await this.logToFile({
      event: 'error',
      data: {
        message: error.message,
        stack: error.stack,
        context
      }
    });
  }

  /**
   * Track performance
   */
  async trackPerformance(operation, duration) {
    await this.logToFile({
      event: 'performance',
      data: {
        operation,
        duration,
        durationMs: duration
      }
    });
  }

  /**
   * Create performance timer
   */
  startTimer(operation) {
    const start = Date.now();
    return {
      end: async () => {
        const duration = Date.now() - start;
        await this.trackPerformance(operation, duration);
        return duration;
      }
    };
  }

  /**
   * Write final summary and close session
   */
  async finishSession() {
    const duration = Date.now() - this.startTime;

    const summary = {
      event: 'session_end',
      duration: duration,
      durationSeconds: (duration / 1000).toFixed(2),
      metrics: {
        ...this.metrics,
        fillRate: this.metrics.fieldsDetected > 0
          ? ((this.metrics.fieldsFilled / this.metrics.fieldsDetected) * 100).toFixed(1)
          : 0,
        classificationRate: this.metrics.fieldsDetected > 0
          ? ((this.metrics.fieldsClassified / this.metrics.fieldsDetected) * 100).toFixed(1)
          : 0
      },
      url: window.location.href,
      domain: window.location.hostname
    };

    await this.logToFile(summary);

    console.log('[JobAssist] Session ended. Summary:', summary);
    console.log(`[JobAssist] Full log available at: ${this.logFilePath}`);
  }
}

// Export singleton
const analytics = new Analytics();
