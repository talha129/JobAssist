/**
 * Feedback Collector
 * Collects user feedback on autofill accuracy for improvement
 */

class FeedbackCollector {
  constructor() {
    this.feedbackData = [];
    this.sessionId = null;
  }

  /**
   * Initialize with session ID
   */
  init(sessionId) {
    this.sessionId = sessionId;
  }

  /**
   * Collect feedback for an autofilled field
   * @param {Object} fieldData - Original field data
   * @param {Object} classification - How field was classified
   * @param {*} autofilledValue - Value that was autofilled
   * @param {HTMLElement} element - The DOM element
   */
  collectFieldFeedback(fieldData, classification, autofilledValue, element) {
    const feedback = {
      // Field identification
      fieldId: this.generateFieldId(element),
      elementType: element.tagName.toLowerCase(),
      inputType: element.type || element.tagName.toLowerCase(),

      // Field context (section)
      section: this.determineSection(fieldData),
      subsection: this.determineSubsection(fieldData),

      // Field labels and context
      labels: fieldData.labels,
      placeholder: fieldData.placeholder,
      ariaLabel: fieldData.ariaLabel,
      name: fieldData.name,
      id: fieldData.id,
      sectionHeading: fieldData.context?.sectionHeading || '',
      nearbyLabels: fieldData.context?.nearbyLabels || [],
      helperText: fieldData.context?.helperText || '',

      // Classification details
      classification: {
        type: classification.type,
        confidence: classification.confidence,
        strategy: classification.strategy,
        matchedText: classification.matchedText || classification.matchedPattern
      },

      // Autofill details
      autofill: {
        value: autofilledValue,
        valuePreview: this.truncateValue(autofilledValue),
        currentValue: this.getCurrentValue(element),
        timestamp: new Date().toISOString()
      },

      // User feedback (to be filled later)
      userFeedback: {
        status: 'pending', // 'correct', 'incorrect', 'removed'
        correctedValue: null,
        correctClassification: null,
        notes: ''
      }
    };

    this.feedbackData.push(feedback);

    // Log to analytics
    analytics.logToFile({
      event: 'feedback_field_captured',
      data: feedback
    });

    return feedback;
  }

  /**
   * Determine which section the field belongs to
   */
  determineSection(fieldData) {
    const sectionHeading = (fieldData.context?.sectionHeading || '').toLowerCase();
    const nearbyText = (fieldData.context?.nearbyLabels || []).join(' ').toLowerCase();
    const allText = (sectionHeading + ' ' + nearbyText).toLowerCase();

    // Check for common sections
    if (allText.includes('personal') || allText.includes('contact') || allText.includes('about')) {
      return 'personal_info';
    }

    if (allText.includes('education') || allText.includes('academic') || allText.includes('school') || allText.includes('university')) {
      return 'education';
    }

    if (allText.includes('experience') || allText.includes('work') || allText.includes('employment') || allText.includes('job')) {
      return 'work_experience';
    }

    if (allText.includes('address') || allText.includes('location')) {
      return 'address';
    }

    if (allText.includes('skill') || allText.includes('competenc')) {
      return 'skills';
    }

    if (allText.includes('preference') || allText.includes('availability')) {
      return 'preferences';
    }

    if (allText.includes('demographic') || allText.includes('veteran') || allText.includes('disability') || allText.includes('race') || allText.includes('gender')) {
      return 'demographics';
    }

    if (allText.includes('cover letter') || allText.includes('why') || allText.includes('tell us')) {
      return 'cover_letter';
    }

    return 'other';
  }

  /**
   * Determine subsection (e.g., "current job" vs "previous job")
   */
  determineSubsection(fieldData) {
    const allLabels = [...fieldData.labels, fieldData.placeholder, fieldData.ariaLabel].join(' ').toLowerCase();
    const sectionHeading = (fieldData.context?.sectionHeading || '').toLowerCase();

    // Education subsections
    if (allLabels.includes('current') || allLabels.includes('most recent')) {
      return 'most_recent';
    }

    if (allLabels.includes('previous') || allLabels.includes('prior')) {
      return 'previous';
    }

    // Work experience subsections
    if (sectionHeading.includes('experience')) {
      if (allLabels.includes('current') || allLabels.includes('present')) {
        return 'current_job';
      }
      if (allLabels.includes('previous') || allLabels.includes('last')) {
        return 'previous_job';
      }
    }

    return null;
  }

  /**
   * Get current value from element
   */
  getCurrentValue(element) {
    if (element.tagName === 'SELECT') {
      return element.options[element.selectedIndex]?.text || '';
    }
    if (element.hasAttribute('contenteditable')) {
      return element.textContent;
    }
    return element.value;
  }

  /**
   * Truncate value for display
   */
  truncateValue(value) {
    const str = String(value || '');
    return str.length > 100 ? str.substring(0, 100) + '...' : str;
  }

  /**
   * Generate unique field ID
   */
  generateFieldId(element) {
    if (element.id) return element.id;
    if (element.name) return element.name;

    // Generate based on position
    const xpath = this.getXPath(element);
    return `field_${this.hashCode(xpath)}`;
  }

  /**
   * Get XPath of element
   */
  getXPath(element) {
    if (element.id) return `//*[@id="${element.id}"]`;

    const parts = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = element.previousSibling;

      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }

      const tagName = element.nodeName.toLowerCase();
      const pathIndex = index ? `[${index + 1}]` : '';
      parts.unshift(tagName + pathIndex);

      element = element.parentNode;
    }

    return parts.length ? '/' + parts.join('/') : '';
  }

  /**
   * Simple hash function
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Update feedback for a field
   */
  updateFeedback(fieldId, userFeedback) {
    const feedback = this.feedbackData.find(f => f.fieldId === fieldId);

    if (feedback) {
      feedback.userFeedback = {
        ...feedback.userFeedback,
        ...userFeedback,
        updatedAt: new Date().toISOString()
      };

      // Log update
      analytics.logToFile({
        event: 'feedback_updated',
        data: {
          fieldId,
          userFeedback: feedback.userFeedback
        }
      });
    }
  }

  /**
   * Generate feedback report
   */
  generateReport() {
    // Update all fields with current values (what user manually changed)
    this.feedbackData.forEach(feedback => {
      const element = this.findElementById(feedback.fieldId);
      if (element) {
        const currentValue = this.getCurrentValue(element);
        const autofilledValue = String(feedback.autofill.value || '');

        // Determine if user changed the value
        if (currentValue !== autofilledValue) {
          feedback.userFeedback.status = 'corrected';
          feedback.userFeedback.correctedValue = currentValue;
          feedback.userFeedback.notes = 'User manually updated the value';
        } else if (currentValue === autofilledValue && currentValue) {
          // Value unchanged and not empty - likely correct
          feedback.userFeedback.status = 'unchanged';
        } else if (!currentValue && autofilledValue) {
          // User cleared the value - probably wrong
          feedback.userFeedback.status = 'removed';
          feedback.userFeedback.notes = 'User removed the autofilled value';
        }

        // Update current value snapshot
        feedback.autofill.currentValueAtDownload = currentValue;
      }
    });

    const report = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      totalFields: this.feedbackData.length,

      // Summary stats
      summary: this.generateSummary(),

      // Group by section
      bySection: this.groupBySection(),

      // Group by accuracy
      byAccuracy: this.groupByAccuracy(),

      // Group by classification type
      byClassification: this.groupByClassification(),

      // All feedback data
      fields: this.feedbackData
    };

    return report;
  }

  /**
   * Find element by field ID
   */
  findElementById(fieldId) {
    // Try by ID first
    let element = document.getElementById(fieldId);
    if (element) return element;

    // Try by name
    element = document.querySelector(`[name="${fieldId}"]`);
    if (element) return element;

    // Search all form fields
    const allFields = document.querySelectorAll('input, select, textarea, [contenteditable="true"]');
    for (const field of allFields) {
      if (this.generateFieldId(field) === fieldId) {
        return field;
      }
    }

    return null;
  }

  /**
   * Generate summary statistics
   */
  generateSummary() {
    const summary = {
      total: this.feedbackData.length,
      unchanged: 0,
      corrected: 0,
      removed: 0,
      pending: 0,
      accuracyRate: 0
    };

    this.feedbackData.forEach(feedback => {
      const status = feedback.userFeedback.status;
      if (summary[status] !== undefined) {
        summary[status]++;
      }
    });

    // Calculate accuracy: unchanged / (total - pending)
    const reviewed = summary.total - summary.pending;
    if (reviewed > 0) {
      summary.accuracyRate = ((summary.unchanged / reviewed) * 100).toFixed(1);
    }

    return summary;
  }

  /**
   * Group feedback by section
   */
  groupBySection() {
    const grouped = {};

    this.feedbackData.forEach(feedback => {
      const section = feedback.section;
      if (!grouped[section]) {
        grouped[section] = {
          total: 0,
          correct: 0,
          incorrect: 0,
          removed: 0,
          pending: 0,
          fields: []
        };
      }

      grouped[section].total++;
      grouped[section][feedback.userFeedback.status]++;
      grouped[section].fields.push(feedback);
    });

    return grouped;
  }

  /**
   * Group by accuracy
   */
  groupByAccuracy() {
    const accuracy = {
      correct: [],
      incorrect: [],
      removed: [],
      pending: []
    };

    this.feedbackData.forEach(feedback => {
      const status = feedback.userFeedback.status;
      if (accuracy[status]) {
        accuracy[status].push(feedback);
      }
    });

    return accuracy;
  }

  /**
   * Group by classification type
   */
  groupByClassification() {
    const grouped = {};

    this.feedbackData.forEach(feedback => {
      const type = feedback.classification.type;
      if (!grouped[type]) {
        grouped[type] = {
          total: 0,
          correct: 0,
          incorrect: 0,
          removed: 0,
          accuracy: 0
        };
      }

      grouped[type].total++;

      const status = feedback.userFeedback.status;
      if (status === 'correct') grouped[type].correct++;
      if (status === 'incorrect') grouped[type].incorrect++;
      if (status === 'removed') grouped[type].removed++;

      if (grouped[type].total > 0) {
        grouped[type].accuracy = (grouped[type].correct / grouped[type].total * 100).toFixed(1);
      }
    });

    return grouped;
  }

  /**
   * Export feedback to JSON file
   */
  exportFeedback() {
    const report = this.generateReport();
    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `feedback_${this.sessionId}.json`);
    linkElement.click();

    console.log(`%c✅ Feedback exported: feedback_${this.sessionId}.json`, 'color: #4CAF50; font-weight: bold');

    return report;
  }
}

// Export singleton
const feedbackCollector = new FeedbackCollector();
