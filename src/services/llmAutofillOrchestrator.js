/**
 * LLMAutofillOrchestrator
 * Coordinates all modules to perform LLM-powered autofill
 */

class LLMAutofillOrchestrator {
  constructor(apiKey) {
    this.apiKey = apiKey;

    // Initialize all services
    this.formCaptureService = new FormCaptureService();
    this.contextEnricher = new ContextEnricher();
    this.llmValueProvider = new LLMValueProvider(apiKey);
    this.universalFiller = new UniversalFiller();
    this.logger = new Logger();

    // State
    this.currentFormStructure = null;
    this.currentFieldValues = null;
    this.fillResult = null;
    this.currentSessionId = null;
  }

  /**
   * Main autofill workflow
   */
  async autofill(userProfile) {
    // Start logging session
    this.currentSessionId = this.logger.startSession(window.location.href);

    try {
      console.log('🚀 Starting LLM-powered autofill...');

      // Step 1: Capture form structure
      console.log('📝 Capturing form structure...');
      const rawFormStructure = this.formCaptureService.captureForm();

      if (!rawFormStructure || rawFormStructure.totalFields === 0) {
        throw new Error('No form fields detected on this page');
      }

      console.log(`Found ${rawFormStructure.totalFields} fields in ${rawFormStructure.sections.length} sections`);

      // Step 2: Enrich with semantic context
      console.log('🔍 Enriching with semantic context...');
      this.currentFormStructure = this.contextEnricher.enrich(rawFormStructure);

      // Log form capture and enrichment
      this.logger.logFormCapture(rawFormStructure, this.currentFormStructure);
      this.logger.logContextEnrichment(rawFormStructure, this.currentFormStructure);

      // Step 3: Get field values from LLM
      console.log('🤖 Calling LLM to get field values...');
      const { fieldValues, prompt, apiResponse } = await this.llmValueProvider.getFieldValuesWithDetails(
        this.currentFormStructure,
        userProfile
      );
      this.currentFieldValues = fieldValues;

      // Log LLM call
      this.logger.logLLMCall(prompt, apiResponse, fieldValues);

      console.log(`LLM returned values for ${this.currentFieldValues.length} fields`);

      // Log fields where LLM returned "none"
      const noneFields = this.currentFieldValues.filter(f => f.value === 'none');
      if (noneFields.length > 0) {
        console.log(`⚠️ ${noneFields.length} fields marked as "none" (human-in-loop):`);
        noneFields.forEach(f => {
          console.log(`  - Field: ${f.fieldId}, Reason: ${f.reasoning}`);
        });
      }

      // Step 4: Fill form fields
      console.log('✍️ Filling form fields...');
      this.fillResult = await this.universalFiller.fillForm(
        this.currentFieldValues,
        this.currentFormStructure
      );

      // Log field filling
      this.logger.logFieldFilling(this.currentFieldValues, this.fillResult);

      // Step 5: Show results
      console.log('✅ Autofill complete!');
      console.log(`  Filled: ${this.fillResult.filled} fields`);
      console.log(`  Skipped: ${this.fillResult.skipped} fields`);
      console.log(`  Total: ${this.fillResult.total} fields`);

      // Complete logging session
      const session = this.logger.completeSession(true);

      return {
        success: true,
        formStructure: this.currentFormStructure,
        fieldValues: this.currentFieldValues,
        fillResult: this.fillResult,
        summary: this.buildSummary(),
        sessionId: session.sessionId
      };

    } catch (error) {
      console.error('❌ Autofill failed:', error);

      // Complete logging session with error
      const session = this.logger.completeSession(false, error);

      return {
        success: false,
        error: error.message,
        formStructure: this.currentFormStructure,
        fieldValues: this.currentFieldValues,
        fillResult: this.fillResult,
        sessionId: session?.sessionId
      };
    }
  }

  /**
   * Preview what would be filled (without actually filling)
   */
  async preview(userProfile) {
    try {
      console.log('🔍 Generating autofill preview...');

      // Capture and enrich form
      const rawFormStructure = this.formCaptureService.captureForm();
      if (!rawFormStructure || rawFormStructure.totalFields === 0) {
        throw new Error('No form fields detected on this page');
      }

      this.currentFormStructure = this.contextEnricher.enrich(rawFormStructure);

      // Get LLM values
      this.currentFieldValues = await this.llmValueProvider.getFieldValues(
        this.currentFormStructure,
        userProfile
      );

      // Build preview (don't fill)
      const preview = this.buildPreview(this.currentFieldValues, this.currentFormStructure);

      return {
        success: true,
        preview,
        formStructure: this.currentFormStructure,
        fieldValues: this.currentFieldValues
      };

    } catch (error) {
      console.error('Preview generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build preview of what will be filled
   */
  buildPreview(fieldValues, formStructure) {
    const preview = {
      willFill: [],
      willSkip: [],
      sections: []
    };

    // Group by section
    for (const section of formStructure.sections) {
      const sectionPreview = {
        heading: section.heading,
        semanticType: section.semanticType,
        fields: []
      };

      for (const field of section.fields) {
        const fieldValue = fieldValues.find(fv => fv.fieldId === field.fieldId);

        if (!fieldValue) continue;

        const fieldPreview = {
          fieldId: field.fieldId,
          label: field.labels[0] || field.name || 'Unlabeled',
          type: field.type,
          currentValue: this.getCurrentValue(field),
          proposedValue: fieldValue.value,
          willFill: fieldValue.value !== 'none',
          confidence: fieldValue.confidence,
          reasoning: fieldValue.reasoning
        };

        sectionPreview.fields.push(fieldPreview);

        if (fieldValue.value !== 'none') {
          preview.willFill.push(fieldPreview);
        } else {
          preview.willSkip.push(fieldPreview);
        }
      }

      if (sectionPreview.fields.length > 0) {
        preview.sections.push(sectionPreview);
      }
    }

    return preview;
  }

  /**
   * Get current value of a field
   */
  getCurrentValue(field) {
    if (!field.element) return '';

    const element = field.element;
    const type = field.type;

    switch (type) {
      case 'checkbox':
        return element.checked ? 'checked' : 'unchecked';
      case 'radio':
        return element.checked ? element.value : '';
      case 'select':
        return element.selectedOptions[0]?.text || '';
      case 'contenteditable':
        return element.textContent;
      default:
        return element.value || '';
    }
  }

  /**
   * Build autofill summary
   */
  buildSummary() {
    if (!this.fillResult) return null;

    return {
      totalFields: this.fillResult.total,
      filled: this.fillResult.filled,
      skipped: this.fillResult.skipped,
      fillRate: (this.fillResult.filled / this.fillResult.total * 100).toFixed(1) + '%',

      // Fields filled by confidence level
      highConfidence: this.currentFieldValues.filter(
        f => f.value !== 'none' && f.confidence >= 0.9
      ).length,
      mediumConfidence: this.currentFieldValues.filter(
        f => f.value !== 'none' && f.confidence >= 0.7 && f.confidence < 0.9
      ).length,
      lowConfidence: this.currentFieldValues.filter(
        f => f.value !== 'none' && f.confidence < 0.7
      ).length,

      // Skipped fields breakdown
      skippedReasons: this.fillResult.skippedFields.map(f => ({
        fieldId: f.fieldId,
        reason: f.reason,
        confidence: f.confidence
      }))
    };
  }

  /**
   * Get detailed analytics data
   */
  getAnalytics() {
    if (!this.currentFormStructure || !this.currentFieldValues) {
      return null;
    }

    return {
      timestamp: new Date().toISOString(),
      url: this.currentFormStructure.url,
      formId: this.currentFormStructure.formId,

      // Form structure stats
      form: {
        totalSections: this.currentFormStructure.sections.length,
        totalFields: this.currentFormStructure.totalFields,
        sectionTypes: this.getSectionTypeCounts()
      },

      // Field type distribution
      fieldTypes: this.getFieldTypeCounts(),

      // LLM performance
      llm: {
        totalRequests: 1, // Single request per form
        fieldValuesReturned: this.currentFieldValues.length,
        noneCount: this.currentFieldValues.filter(f => f.value === 'none').length,
        averageConfidence: this.getAverageConfidence(),
        confidenceDistribution: this.getConfidenceDistribution()
      },

      // Fill results
      fill: this.fillResult ? {
        filled: this.fillResult.filled,
        skipped: this.fillResult.skipped,
        fillRate: (this.fillResult.filled / this.fillResult.total * 100).toFixed(1) + '%'
      } : null,

      // Summary
      summary: this.buildSummary()
    };
  }

  /**
   * Get section type counts
   */
  getSectionTypeCounts() {
    const counts = {};
    this.currentFormStructure.sections.forEach(section => {
      const type = section.semanticType || 'other';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }

  /**
   * Get field type counts
   */
  getFieldTypeCounts() {
    const counts = {};
    this.currentFormStructure.sections.forEach(section => {
      section.fields.forEach(field => {
        const type = field.type;
        counts[type] = (counts[type] || 0) + 1;
      });
    });
    return counts;
  }

  /**
   * Get average confidence
   */
  getAverageConfidence() {
    const confidences = this.currentFieldValues
      .filter(f => f.value !== 'none')
      .map(f => f.confidence);

    if (confidences.length === 0) return 0;

    const sum = confidences.reduce((a, b) => a + b, 0);
    return (sum / confidences.length).toFixed(2);
  }

  /**
   * Get confidence distribution
   */
  getConfidenceDistribution() {
    const distribution = {
      high: 0,    // >= 0.9
      medium: 0,  // 0.7 - 0.89
      low: 0      // < 0.7
    };

    this.currentFieldValues
      .filter(f => f.value !== 'none')
      .forEach(f => {
        if (f.confidence >= 0.9) distribution.high++;
        else if (f.confidence >= 0.7) distribution.medium++;
        else distribution.low++;
      });

    return distribution;
  }

  /**
   * Clear LLM cache
   */
  clearCache() {
    this.llmValueProvider.clearCache();
  }

  /**
   * Update API key
   */
  updateApiKey(newApiKey) {
    this.apiKey = newApiKey;
    this.llmValueProvider = new LLMValueProvider(newApiKey);
  }

  /**
   * Get logger for external access
   */
  getLogger() {
    return this.logger;
  }

  /**
   * Download session log
   */
  downloadSessionLog(sessionId) {
    this.logger.downloadSession(sessionId);
  }

  /**
   * Download all session logs
   */
  downloadAllLogs() {
    this.logger.downloadAllSessions();
  }

  /**
   * Get recent sessions
   */
  getRecentSessions(limit = 10) {
    return this.logger.getRecentSessions(limit);
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logger.clearSessions();
  }
}
