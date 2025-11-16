/**
 * FormCaptureService
 * Captures form fields with hierarchical structure and context
 */

class FormCaptureService {
  constructor() {
    this.fields = new Map(); // fieldId -> field data
    this.formStructure = null;
  }

  /**
   * Capture all form fields with hierarchical context
   */
  captureForm() {
    const allFields = this.detectAllFields();
    const sections = this.buildHierarchy(allFields);

    this.formStructure = {
      formId: this.getFormId(),
      url: window.location.href,
      timestamp: new Date().toISOString(),
      totalFields: allFields.length,
      sections
    };

    return this.formStructure;
  }

  /**
   * Detect all interactive form elements
   */
  detectAllFields() {
    const fields = [];
    const fieldId = 0;

    // Query all form-related elements
    const selectors = [
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
      'textarea',
      'select',
      '[contenteditable="true"]',
      '[role="textbox"]',
      '[role="combobox"]'
    ];

    const elements = document.querySelectorAll(selectors.join(', '));

    elements.forEach((element, index) => {
      // Skip if element is not visible
      if (!this.isVisible(element)) return;

      const field = this.extractFieldData(element, `field_${index}`);
      fields.push(field);

      // Store in map for quick lookup
      this.fields.set(field.fieldId, field);
    });

    return fields;
  }

  /**
   * Extract comprehensive field data
   */
  extractFieldData(element, fieldId) {
    return {
      fieldId,
      element, // Keep reference to DOM element
      type: this.getFieldType(element),
      inputType: element.type || element.tagName.toLowerCase(),

      // Labels and identifiers
      labels: this.extractLabels(element),
      placeholder: element.placeholder || '',
      ariaLabel: element.getAttribute('aria-label') || '',
      name: element.name || '',
      id: element.id || '',

      // Attributes
      required: element.required || element.getAttribute('aria-required') === 'true',

      // Context
      context: this.extractContext(element),

      // For dropdowns, capture options
      options: this.getOptions(element)
    };
  }

  /**
   * Get normalized field type
   */
  getFieldType(element) {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'select') {
      return element.multiple ? 'select-multiple' : 'select';
    }

    if (tagName === 'textarea') {
      return 'textarea';
    }

    if (element.hasAttribute('contenteditable')) {
      return 'contenteditable';
    }

    if (tagName === 'input') {
      return element.type || 'text';
    }

    // ARIA roles
    const role = element.getAttribute('role');
    if (role === 'textbox') return 'text';
    if (role === 'combobox') return 'select';

    return 'text';
  }

  /**
   * Extract all labels for a field
   */
  extractLabels(element) {
    const labels = [];

    // 1. Label element using 'for' attribute
    if (element.id) {
      const labelElement = document.querySelector(`label[for="${element.id}"]`);
      if (labelElement) {
        labels.push(this.cleanText(labelElement.textContent));
      }
    }

    // 2. Parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      labels.push(this.cleanText(parentLabel.textContent));
    }

    // 3. Previous sibling label
    let prev = element.previousElementSibling;
    if (prev && prev.tagName === 'LABEL') {
      labels.push(this.cleanText(prev.textContent));
    }

    // 4. aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) {
        labels.push(this.cleanText(labelElement.textContent));
      }
    }

    return [...new Set(labels)]; // Remove duplicates
  }

  /**
   * Extract contextual information
   */
  extractContext(element) {
    return {
      sectionHeading: this.findSectionHeading(element),
      subsectionHeading: this.findSubsectionHeading(element),
      nearbyLabels: this.getNearbyLabels(element),
      helperText: this.getHelperText(element),
      xpath: this.getXPath(element)
    };
  }

  /**
   * Find section heading (h1, h2, h3, etc.)
   */
  findSectionHeading(element) {
    let current = element;

    // Traverse up looking for a heading
    while (current && current !== document.body) {
      // Check previous siblings for headings
      let sibling = current.previousElementSibling;
      while (sibling) {
        if (/^H[1-6]$/.test(sibling.tagName)) {
          return this.cleanText(sibling.textContent);
        }
        sibling = sibling.previousElementSibling;
      }

      current = current.parentElement;
    }

    return '';
  }

  /**
   * Find subsection heading (smaller heading closer to field)
   */
  findSubsectionHeading(element) {
    let current = element;
    let foundFirstHeading = false;
    let firstHeadingLevel = 0;

    while (current && current !== document.body) {
      let sibling = current.previousElementSibling;
      while (sibling) {
        const match = sibling.tagName.match(/^H([1-6])$/);
        if (match) {
          const level = parseInt(match[1]);

          if (!foundFirstHeading) {
            foundFirstHeading = true;
            firstHeadingLevel = level;
            return this.cleanText(sibling.textContent);
          } else if (level > firstHeadingLevel) {
            return this.cleanText(sibling.textContent);
          }
        }
        sibling = sibling.previousElementSibling;
      }

      current = current.parentElement;
    }

    return '';
  }

  /**
   * Get nearby text labels
   */
  getNearbyLabels(element) {
    const labels = [];
    const container = element.closest('div, fieldset, section, form');

    if (container) {
      // Get all text nodes in container
      const textNodes = this.getTextNodes(container);
      textNodes.slice(0, 5).forEach(text => {
        if (text.length > 2 && text.length < 100) {
          labels.push(text);
        }
      });
    }

    return labels;
  }

  /**
   * Get helper text (usually small text near field)
   */
  getHelperText(element) {
    // Check for aria-describedby
    const describedBy = element.getAttribute('aria-describedby');
    if (describedBy) {
      const helperElement = document.getElementById(describedBy);
      if (helperElement) {
        return this.cleanText(helperElement.textContent);
      }
    }

    // Check for next sibling with class containing 'help', 'hint', 'description'
    let next = element.nextElementSibling;
    if (next) {
      const className = next.className || '';
      if (/help|hint|description|note/i.test(className)) {
        return this.cleanText(next.textContent);
      }
    }

    return '';
  }

  /**
   * Get XPath of element
   */
  getXPath(element) {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    const parts = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = current.previousSibling;

      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }

      const tagName = current.nodeName.toLowerCase();
      const pathIndex = index ? `[${index + 1}]` : '';
      parts.unshift(tagName + pathIndex);

      current = current.parentNode;
    }

    return parts.length ? '/' + parts.join('/') : '';
  }

  /**
   * Build hierarchical structure
   */
  buildHierarchy(fields) {
    const sections = [];
    let currentSection = null;

    fields.forEach(field => {
      const sectionHeading = field.context.sectionHeading || 'Other';

      // Find or create section
      if (!currentSection || currentSection.heading !== sectionHeading) {
        currentSection = {
          sectionId: `section_${sections.length}`,
          heading: sectionHeading,
          fields: []
        };
        sections.push(currentSection);
      }

      currentSection.fields.push(field);
    });

    return sections;
  }

  /**
   * Get options for select elements
   */
  getOptions(element) {
    if (element.tagName !== 'SELECT') return [];

    return Array.from(element.options).map(option => ({
      value: option.value,
      text: this.cleanText(option.textContent)
    }));
  }

  /**
   * Get text nodes from element
   */
  getTextNodes(element) {
    const texts = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      const text = this.cleanText(node.textContent);
      if (text) texts.push(text);
    }

    return texts;
  }

  /**
   * Check if element is visible
   */
  isVisible(element) {
    return element.offsetWidth > 0 &&
           element.offsetHeight > 0 &&
           getComputedStyle(element).visibility !== 'hidden';
  }

  /**
   * Clean text (trim, remove extra whitespace)
   */
  cleanText(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Get form ID
   */
  getFormId() {
    const form = document.querySelector('form');
    return form?.id || form?.name || 'unknown_form';
  }

  /**
   * Get field by ID
   */
  getFieldById(fieldId) {
    return this.fields.get(fieldId);
  }
}
