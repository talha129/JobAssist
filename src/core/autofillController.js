/**
 * Autofill Controller
 * Orchestrates the entire autofill process
 */

class AutofillController {
  constructor(profile, synonyms) {
    this.profile = profile;
    this.synonyms = synonyms;
    this.classifier = new FieldClassifier(synonyms);
    this.matcher = new ProfileMatcher(profile);
    this.fillers = {
      text: new TextFiller(),
      select: new SelectFiller()
    };
    this.fieldMappings = new Map(); // Store field -> classification mappings
  }

  /**
   * Autofill all fields on the page
   * @param {Array} detectedFields - Array of field data from field detector
   * @returns {Object} Results summary
   */
  autofillAll(detectedFields) {
    logger.info(`Starting autofill for ${detectedFields.length} fields`);

    const results = {
      total: detectedFields.length,
      filled: 0,
      skipped: 0,
      failed: 0,
      details: []
    };

    // Classify all fields first
    const classifications = this.classifier.classifyMultiple(detectedFields);

    // Process each field
    for (const { fieldData, classification } of classifications) {
      const result = this.autofillField(fieldData, classification);
      results.details.push(result);

      if (result.status === 'filled') {
        results.filled++;
      } else if (result.status === 'skipped') {
        results.skipped++;
      } else {
        results.failed++;
      }
    }

    logger.info(`Autofill complete: ${results.filled} filled, ${results.skipped} skipped, ${results.failed} failed`);
    return results;
  }

  /**
   * Autofill a single field
   * @param {Object} fieldData - Field metadata
   * @param {Object} classification - Classification result
   * @returns {Object} Fill result
   */
  autofillField(fieldData, classification) {
    const { element } = fieldData;

    // Track classification
    analytics.trackClassification(fieldData, classification);

    // Skip low confidence classifications
    if (classification.confidence < 0.6) {
      logger.debug(`Skipping field due to low confidence (${classification.confidence}):`, classification.type);

      // Track skip
      analytics.trackAutofill(fieldData, classification, null, 'skipped', 'low_confidence');

      return {
        element,
        status: 'skipped',
        reason: 'low_confidence',
        classification,
        value: null
      };
    }

    // Get value from profile
    const value = this.matcher.getValue(classification, element);

    if (!value) {
      logger.debug(`No value found in profile for:`, classification.type);
      return {
        element,
        status: 'skipped',
        reason: 'no_value',
        classification,
        value: null
      };
    }

    // Select appropriate filler based on field type
    const filler = this._selectFiller(element);

    if (!filler) {
      logger.warn(`No filler available for field type:`, element.tagName, element.type);
      return {
        element,
        status: 'failed',
        reason: 'no_filler',
        classification,
        value
      };
    }

    // Attempt to fill
    const success = filler.fill(element, value);

    // Track autofill attempt
    analytics.trackAutofill(fieldData, classification, value, success ? 'filled' : 'failed', success ? null : 'fill_failed');

    // Collect feedback data for successful fills
    if (success && typeof feedbackCollector !== 'undefined') {
      feedbackCollector.collectFieldFeedback(fieldData, classification, value, element);
    }

    // Store mapping for future reference
    if (success) {
      this.fieldMappings.set(element, {
        classification,
        value,
        timestamp: Date.now()
      });
    }

    return {
      element,
      status: success ? 'filled' : 'failed',
      reason: success ? null : 'fill_failed',
      classification,
      value
    };
  }

  /**
   * Select appropriate filler for field type
   */
  _selectFiller(element) {
    if (element.tagName === 'SELECT') {
      return this.fillers.select;
    }

    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' ||
        element.hasAttribute('contenteditable')) {
      return this.fillers.text;
    }

    return null;
  }

  /**
   * Clear all autofilled fields
   */
  clearAll() {
    logger.info(`Clearing ${this.fieldMappings.size} autofilled fields`);

    for (const [element, mapping] of this.fieldMappings.entries()) {
      try {
        if (element.tagName === 'SELECT') {
          element.selectedIndex = 0;
        } else if (element.hasAttribute('contenteditable')) {
          element.textContent = '';
          element.innerHTML = '';
        } else {
          element.value = '';
        }

        // Trigger events
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (error) {
        logger.error('Error clearing field:', error);
      }
    }

    this.fieldMappings.clear();
  }

  /**
   * Get autofill preview (without actually filling)
   * @param {Array} detectedFields
   * @returns {Array} Preview of what would be filled
   */
  getPreview(detectedFields) {
    logger.info(`Generating autofill preview for ${detectedFields.length} fields`);

    const classifications = this.classifier.classifyMultiple(detectedFields);
    const preview = [];

    for (const { fieldData, classification } of classifications) {
      const { element } = fieldData;

      if (classification.confidence < 0.6) {
        continue;
      }

      const value = this.matcher.getValue(classification, element);

      if (value) {
        preview.push({
          element,
          fieldData,
          classification,
          value,
          confidence: classification.confidence
        });
      }
    }

    return preview;
  }

  /**
   * Get statistics about autofill capability for current page
   */
  getStatistics(detectedFields) {
    const classifications = this.classifier.classifyMultiple(detectedFields);

    const stats = {
      totalFields: detectedFields.length,
      classifiedFields: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      hasValue: 0,
      canFill: 0,
      typeBreakdown: {}
    };

    for (const { fieldData, classification } of classifications) {
      if (classification.type !== 'unknown') {
        stats.classifiedFields++;

        // Track by confidence
        if (classification.confidence >= 0.8) {
          stats.highConfidence++;
        } else if (classification.confidence >= 0.6) {
          stats.mediumConfidence++;
        } else {
          stats.lowConfidence++;
        }

        // Check if we have value
        const value = this.matcher.getValue(classification, fieldData.element);
        if (value) {
          stats.hasValue++;

          if (classification.confidence >= 0.6) {
            stats.canFill++;
          }
        }

        // Type breakdown
        const baseType = classification.type.split('.')[0];
        stats.typeBreakdown[baseType] = (stats.typeBreakdown[baseType] || 0) + 1;
      }
    }

    return stats;
  }
}
