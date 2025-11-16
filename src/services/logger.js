/**
 * Logger
 * Comprehensive logging for autofill sessions
 * Logs all inputs/outputs for analysis and improvement
 */

class Logger {
  constructor() {
    this.currentSession = null;
    this.sessions = [];
  }

  /**
   * Start a new logging session
   */
  startSession(url) {
    this.currentSession = {
      sessionId: this.generateSessionId(),
      timestamp: new Date().toISOString(),
      url: url,
      userAgent: navigator.userAgent,
      steps: [],
      metadata: {}
    };

    console.log(`📝 Logging session started: ${this.currentSession.sessionId}`);
    return this.currentSession.sessionId;
  }

  /**
   * Log form capture step
   */
  logFormCapture(rawFormStructure, enrichedFormStructure) {
    if (!this.currentSession) return;

    this.currentSession.steps.push({
      step: 'form_capture',
      timestamp: new Date().toISOString(),
      input: null,
      output: {
        raw: this.sanitizeFormStructure(rawFormStructure),
        enriched: this.sanitizeFormStructure(enrichedFormStructure)
      },
      metadata: {
        totalFields: rawFormStructure.totalFields,
        totalSections: rawFormStructure.sections.length,
        fieldTypes: this.getFieldTypeCounts(rawFormStructure)
      }
    });

    console.log('📝 Logged: Form Capture');
  }

  /**
   * Log context enrichment step
   */
  logContextEnrichment(beforeEnrichment, afterEnrichment) {
    if (!this.currentSession) return;

    this.currentSession.steps.push({
      step: 'context_enrichment',
      timestamp: new Date().toISOString(),
      input: {
        formStructure: this.sanitizeFormStructure(beforeEnrichment)
      },
      output: {
        enrichedStructure: this.sanitizeFormStructure(afterEnrichment)
      },
      metadata: {
        sectionsClassified: this.getSectionClassifications(afterEnrichment),
        temporalFieldsDetected: this.countTemporalFields(afterEnrichment)
      }
    });

    console.log('📝 Logged: Context Enrichment');
  }

  /**
   * Log LLM API call
   */
  logLLMCall(prompt, apiResponse, parsedResponse) {
    if (!this.currentSession) return;

    this.currentSession.steps.push({
      step: 'llm_api_call',
      timestamp: new Date().toISOString(),
      input: {
        prompt: prompt,
        model: 'anthropic/claude-3.5-sonnet',
        temperature: 0.1
      },
      output: {
        rawResponse: apiResponse,
        parsedFields: parsedResponse
      },
      metadata: {
        totalFields: parsedResponse.length,
        noneCount: parsedResponse.filter(f => f.value === 'none').length,
        averageConfidence: this.calculateAverageConfidence(parsedResponse),
        confidenceDistribution: this.getConfidenceDistribution(parsedResponse)
      }
    });

    console.log('📝 Logged: LLM API Call');
  }

  /**
   * Log field filling results
   */
  logFieldFilling(fieldValues, fillResults) {
    if (!this.currentSession) return;

    this.currentSession.steps.push({
      step: 'field_filling',
      timestamp: new Date().toISOString(),
      input: {
        fieldValues: fieldValues.map(fv => ({
          fieldId: fv.fieldId,
          value: fv.value,
          confidence: fv.confidence,
          reasoning: fv.reasoning
        }))
      },
      output: {
        filled: fillResults.filledFields,
        skipped: fillResults.skippedFields
      },
      metadata: {
        totalAttempted: fieldValues.length,
        successfullyFilled: fillResults.filled,
        skipped: fillResults.skipped,
        fillRate: (fillResults.filled / fillResults.total * 100).toFixed(1) + '%'
      }
    });

    console.log('📝 Logged: Field Filling');
  }

  /**
   * Complete the session
   */
  completeSession(success, error = null) {
    if (!this.currentSession) return;

    this.currentSession.completed = new Date().toISOString();
    this.currentSession.success = success;
    this.currentSession.duration = this.calculateDuration(
      this.currentSession.timestamp,
      this.currentSession.completed
    );

    if (error) {
      this.currentSession.error = {
        message: error.message,
        stack: error.stack
      };
    }

    // Add summary
    this.currentSession.summary = this.generateSummary();

    // Save to sessions array
    this.sessions.push(this.currentSession);

    console.log(`📝 Logging session completed: ${this.currentSession.sessionId}`);
    console.log(`   Duration: ${this.currentSession.duration}ms`);
    console.log(`   Success: ${success}`);

    const completedSession = this.currentSession;
    this.currentSession = null;

    return completedSession;
  }

  /**
   * Generate session summary
   */
  generateSummary() {
    const steps = this.currentSession.steps;

    const formCaptureStep = steps.find(s => s.step === 'form_capture');
    const llmStep = steps.find(s => s.step === 'llm_api_call');
    const fillStep = steps.find(s => s.step === 'field_filling');

    return {
      totalSteps: steps.length,
      formFields: formCaptureStep?.metadata.totalFields || 0,
      llmNoneCount: llmStep?.metadata.noneCount || 0,
      llmAverageConfidence: llmStep?.metadata.averageConfidence || 0,
      fieldsFilled: fillStep?.metadata.successfullyFilled || 0,
      fieldsSkipped: fillStep?.metadata.skipped || 0,
      fillRate: fillStep?.metadata.fillRate || '0%'
    };
  }

  /**
   * Export session as JSON (for download)
   */
  exportSession(sessionId) {
    const session = this.sessions.find(s => s.sessionId === sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return JSON.stringify(session, null, 2);
  }

  /**
   * Export all sessions
   */
  exportAllSessions() {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      totalSessions: this.sessions.length,
      sessions: this.sessions
    }, null, 2);
  }

  /**
   * Get sessions for a specific URL
   */
  getSessionsByUrl(url) {
    return this.sessions.filter(s => s.url === url);
  }

  /**
   * Get recent sessions
   */
  getRecentSessions(limit = 10) {
    return this.sessions.slice(-limit).reverse();
  }

  /**
   * Clear all sessions
   */
  clearSessions() {
    this.sessions = [];
    this.currentSession = null;
    console.log('📝 All logging sessions cleared');
  }

  /**
   * Download session as JSON file
   */
  downloadSession(sessionId) {
    const json = this.exportSession(sessionId);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `jobassist_session_${sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`📥 Downloaded session: ${sessionId}`);
  }

  /**
   * Download all sessions
   */
  downloadAllSessions() {
    const json = this.exportAllSessions();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobassist_all_sessions_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`📥 Downloaded all sessions (${this.sessions.length} sessions)`);
  }

  // ==================== Helper Methods ====================

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize form structure (remove DOM elements)
   */
  sanitizeFormStructure(formStructure) {
    if (!formStructure) return null;

    return {
      ...formStructure,
      sections: formStructure.sections.map(section => ({
        ...section,
        fields: section.fields.map(field => {
          const { element, ...fieldWithoutElement } = field;
          return {
            ...fieldWithoutElement,
            // Include current value if available
            currentValue: element ? this.getElementValue(element, field.type) : null
          };
        })
      }))
    };
  }

  /**
   * Get element value based on type
   */
  getElementValue(element, type) {
    if (!element) return null;

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
   * Get field type counts
   */
  getFieldTypeCounts(formStructure) {
    const counts = {};
    formStructure.sections.forEach(section => {
      section.fields.forEach(field => {
        counts[field.type] = (counts[field.type] || 0) + 1;
      });
    });
    return counts;
  }

  /**
   * Get section classifications
   */
  getSectionClassifications(formStructure) {
    const classifications = {};
    formStructure.sections.forEach(section => {
      const type = section.semanticType || 'other';
      classifications[type] = (classifications[type] || 0) + 1;
    });
    return classifications;
  }

  /**
   * Count temporal fields
   */
  countTemporalFields(formStructure) {
    let count = 0;
    formStructure.sections.forEach(section => {
      section.fields.forEach(field => {
        if (field.semanticContext?.temporal) {
          count++;
        }
      });
    });
    return count;
  }

  /**
   * Calculate average confidence
   */
  calculateAverageConfidence(fieldValues) {
    const values = fieldValues.filter(f => f.value !== 'none');
    if (values.length === 0) return 0;

    const sum = values.reduce((acc, f) => acc + (f.confidence || 0), 0);
    return (sum / values.length).toFixed(2);
  }

  /**
   * Get confidence distribution
   */
  getConfidenceDistribution(fieldValues) {
    const dist = { high: 0, medium: 0, low: 0 };

    fieldValues
      .filter(f => f.value !== 'none')
      .forEach(f => {
        if (f.confidence >= 0.9) dist.high++;
        else if (f.confidence >= 0.7) dist.medium++;
        else dist.low++;
      });

    return dist;
  }

  /**
   * Calculate duration in milliseconds
   */
  calculateDuration(start, end) {
    return new Date(end) - new Date(start);
  }
}
