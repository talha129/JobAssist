/**
 * UniversalFiller
 * Handles filling all types of form fields with proper event triggering
 */

class UniversalFiller {
  constructor() {
    // Track filled fields for analytics
    this.filledFields = [];
    this.skippedFields = [];
  }

  /**
   * Fill form fields with LLM-provided values
   */
  async fillForm(fieldValues, formStructure) {
    this.filledFields = [];
    this.skippedFields = [];

    for (const fieldValue of fieldValues) {
      // Skip fields where LLM returned "none" (human-in-loop)
      if (fieldValue.value === 'none' || fieldValue.value === null) {
        this.skippedFields.push({
          fieldId: fieldValue.fieldId,
          reason: fieldValue.reasoning || 'LLM returned none',
          confidence: fieldValue.confidence
        });
        continue;
      }

      // Find the field in form structure
      const field = this.findField(fieldValue.fieldId, formStructure);
      if (!field) {
        console.warn(`Field not found: ${fieldValue.fieldId}`);
        continue;
      }

      // Fill based on field type
      try {
        const filled = await this.fillField(field, fieldValue.value);
        if (filled) {
          this.filledFields.push({
            fieldId: fieldValue.fieldId,
            value: fieldValue.value,
            confidence: fieldValue.confidence
          });
        }
      } catch (error) {
        console.error(`Failed to fill field ${fieldValue.fieldId}:`, error);
        this.skippedFields.push({
          fieldId: fieldValue.fieldId,
          reason: `Error: ${error.message}`,
          confidence: fieldValue.confidence
        });
      }
    }

    return {
      filled: this.filledFields.length,
      skipped: this.skippedFields.length,
      total: fieldValues.length,
      filledFields: this.filledFields,
      skippedFields: this.skippedFields
    };
  }

  /**
   * Fill individual field based on type
   */
  async fillField(field, value) {
    const element = field.element;
    if (!element || !this.isVisible(element)) {
      return false;
    }

    const type = field.type;

    switch (type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
      case 'number':
      case 'search':
        return this.fillTextInput(element, value);

      case 'textarea':
        return this.fillTextarea(element, value);

      case 'select':
        return this.fillSelect(element, value, field.options);

      case 'date':
      case 'datetime-local':
      case 'month':
      case 'week':
        return this.fillDateInput(element, value);

      case 'radio':
        return this.fillRadio(element, value, field);

      case 'checkbox':
        return this.fillCheckbox(element, value);

      case 'contenteditable':
        return this.fillContentEditable(element, value);

      default:
        console.warn(`Unsupported field type: ${type}`);
        return false;
    }
  }

  /**
   * Fill text input with proper event triggering
   */
  fillTextInput(element, value) {
    // Set value
    element.value = value;

    // Trigger events for React/Vue/Angular compatibility
    this.triggerEvents(element, ['input', 'change', 'blur']);

    return true;
  }

  /**
   * Fill textarea
   */
  fillTextarea(element, value) {
    element.value = value;
    this.triggerEvents(element, ['input', 'change', 'blur']);
    return true;
  }

  /**
   * Fill select dropdown with fuzzy matching
   */
  fillSelect(element, value, availableOptions) {
    // Try exact match first
    let option = Array.from(element.options).find(
      opt => opt.text.trim().toLowerCase() === value.toLowerCase()
    );

    // If no exact match, try fuzzy matching
    if (!option && availableOptions) {
      const fuzzyMatch = this.fuzzyMatchOption(value, availableOptions);
      if (fuzzyMatch) {
        option = Array.from(element.options).find(
          opt => opt.text.trim() === fuzzyMatch.text
        );
      }
    }

    if (option) {
      element.value = option.value;
      this.triggerEvents(element, ['change', 'blur']);
      return true;
    }

    console.warn(`Could not find option "${value}" in select dropdown`);
    return false;
  }

  /**
   * Fill date input (handles YYYY-MM-DD format)
   */
  fillDateInput(element, value) {
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      console.warn(`Invalid date format: ${value}. Expected YYYY-MM-DD`);
      return false;
    }

    element.value = value;
    this.triggerEvents(element, ['input', 'change', 'blur']);
    return true;
  }

  /**
   * Fill radio button
   */
  fillRadio(element, value, field) {
    // For radio buttons, we need to find all radios with the same name
    const radioGroup = document.querySelectorAll(`input[name="${element.name}"][type="radio"]`);

    for (const radio of radioGroup) {
      const label = this.getRadioLabel(radio);
      if (label && label.toLowerCase().includes(value.toLowerCase())) {
        radio.checked = true;
        this.triggerEvents(radio, ['change', 'click']);
        return true;
      }
    }

    console.warn(`Could not find radio option for value: ${value}`);
    return false;
  }

  /**
   * Fill checkbox (handles yes/no values)
   */
  fillCheckbox(element, value) {
    const valueLower = value.toLowerCase();
    const shouldCheck = valueLower === 'yes' || valueLower === 'true' || valueLower === '1';

    element.checked = shouldCheck;
    this.triggerEvents(element, ['change', 'click']);
    return true;
  }

  /**
   * Fill contenteditable element
   */
  fillContentEditable(element, value) {
    element.textContent = value;
    this.triggerEvents(element, ['input', 'change', 'blur']);
    return true;
  }

  /**
   * Fuzzy match option (handles slight variations)
   */
  fuzzyMatchOption(value, options) {
    const valueLower = value.toLowerCase().trim();

    // First try: exact match
    let match = options.find(opt => opt.text.toLowerCase().trim() === valueLower);
    if (match) return match;

    // Second try: starts with
    match = options.find(opt => opt.text.toLowerCase().trim().startsWith(valueLower));
    if (match) return match;

    // Third try: contains
    match = options.find(opt => opt.text.toLowerCase().trim().includes(valueLower));
    if (match) return match;

    // Fourth try: Levenshtein distance (for typos)
    const distances = options.map(opt => ({
      option: opt,
      distance: this.levenshteinDistance(valueLower, opt.text.toLowerCase().trim())
    }));

    distances.sort((a, b) => a.distance - b.distance);

    // If closest match is within 3 characters difference, use it
    if (distances[0] && distances[0].distance <= 3) {
      return distances[0].option;
    }

    return null;
  }

  /**
   * Levenshtein distance for fuzzy matching
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Trigger DOM events for framework compatibility
   */
  triggerEvents(element, eventTypes) {
    eventTypes.forEach(eventType => {
      // Native event
      const event = new Event(eventType, { bubbles: true, cancelable: true });
      element.dispatchEvent(event);

      // Input event with data (for React)
      if (eventType === 'input') {
        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          data: element.value
        });
        element.dispatchEvent(inputEvent);
      }
    });

    // Also trigger React's internal event system
    this.triggerReactEvent(element);
  }

  /**
   * Trigger React event (for React forms)
   */
  triggerReactEvent(element) {
    // Get React internal instance
    const reactProp = Object.keys(element).find(key =>
      key.startsWith('__reactProps') || key.startsWith('__reactEventHandlers')
    );

    if (reactProp) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;

      nativeInputValueSetter.call(element, element.value);

      const inputEvent = new Event('input', { bubbles: true });
      element.dispatchEvent(inputEvent);
    }
  }

  /**
   * Get label for radio button
   */
  getRadioLabel(radio) {
    // Check for associated label
    const id = radio.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent.trim();
    }

    // Check for parent label
    const parentLabel = radio.closest('label');
    if (parentLabel) {
      return parentLabel.textContent.trim();
    }

    // Check for next sibling text
    if (radio.nextSibling && radio.nextSibling.nodeType === Node.TEXT_NODE) {
      return radio.nextSibling.textContent.trim();
    }

    return '';
  }

  /**
   * Find field in form structure by fieldId
   */
  findField(fieldId, formStructure) {
    for (const section of formStructure.sections) {
      for (const field of section.fields) {
        if (field.fieldId === fieldId) {
          return field;
        }
      }
    }
    return null;
  }

  /**
   * Check if element is visible
   */
  isVisible(element) {
    return !!(
      element.offsetWidth ||
      element.offsetHeight ||
      element.getClientRects().length
    ) && window.getComputedStyle(element).visibility !== 'hidden';
  }

  /**
   * Get fill summary
   */
  getSummary() {
    return {
      filled: this.filledFields.length,
      skipped: this.skippedFields.length,
      total: this.filledFields.length + this.skippedFields.length,
      filledFields: this.filledFields,
      skippedFields: this.skippedFields
    };
  }
}
