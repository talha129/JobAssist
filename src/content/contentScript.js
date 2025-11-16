/**
 * JobAssist Content Script
 * Detects input fields and highlights their related text
 */

class FieldHighlighter {
  constructor() {
    this.highlightedElements = new Set();
    this.isEnabled = true;
  }

  /**
   * Initialize the highlighter
   */
  init() {
    console.log('[JobAssist] Initializing field highlighter...');
    this.detectAndHighlightFields();
    this.observeDOMChanges();
  }

  /**
   * Detect all input fields on the page and highlight related text
   */
  detectAndHighlightFields() {
    // Clear previous highlights
    this.clearHighlights();

    // Find all input fields
    const fields = this.findAllInputFields();
    console.log(`[JobAssist] Found ${fields.length} input fields`);

    // Highlight text related to each field
    fields.forEach(field => {
      this.highlightFieldText(field);
    });
  }

  /**
   * Find all input fields on the page
   * @returns {HTMLElement[]} Array of input field elements
   */
  findAllInputFields() {
    const fields = [];

    // Standard input elements
    fields.push(...document.querySelectorAll('input:not([type="hidden"])'));

    // Textareas
    fields.push(...document.querySelectorAll('textarea'));

    // Select dropdowns
    fields.push(...document.querySelectorAll('select'));

    // Custom inputs with contenteditable
    fields.push(...document.querySelectorAll('[contenteditable="true"]'));

    // ARIA combobox (search dropdowns)
    fields.push(...document.querySelectorAll('[role="combobox"]'));
    fields.push(...document.querySelectorAll('[role="textbox"]'));

    // ARIA searchbox
    fields.push(...document.querySelectorAll('[role="searchbox"]'));

    return fields;
  }

  /**
   * Highlight all text related to a specific field
   * @param {HTMLElement} field - The input field element
   */
  highlightFieldText(field) {
    const relatedElements = this.findRelatedTextElements(field);

    relatedElements.forEach(element => {
      if (element && !this.highlightedElements.has(element)) {
        element.classList.add('jobassist-highlight');
        this.highlightedElements.add(element);
      }
    });

    // Also highlight the field itself
    if (!this.highlightedElements.has(field)) {
      field.classList.add('jobassist-highlight-field');
      this.highlightedElements.add(field);
    }
  }

  /**
   * Find all text elements related to an input field
   * @param {HTMLElement} field - The input field element
   * @returns {HTMLElement[]} Array of related text elements
   */
  findRelatedTextElements(field) {
    const relatedElements = [];

    // 1. Find associated label via 'for' attribute
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`);
      if (label) {
        relatedElements.push(label);
      }
    }

    // 2. Find parent label (input nested inside label)
    const parentLabel = field.closest('label');
    if (parentLabel) {
      relatedElements.push(parentLabel);
    }

    // 3. Find labels via aria-labelledby
    const ariaLabelledBy = field.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      ariaLabelledBy.split(' ').forEach(id => {
        const element = document.getElementById(id);
        if (element) {
          relatedElements.push(element);
        }
      });
    }

    // 4. Find aria-describedby (helper text)
    const ariaDescribedBy = field.getAttribute('aria-describedby');
    if (ariaDescribedBy) {
      ariaDescribedBy.split(' ').forEach(id => {
        const element = document.getElementById(id);
        if (element) {
          relatedElements.push(element);
        }
      });
    }

    // 5. Find adjacent text elements (common pattern: <span>Label</span><input>)
    const previousSibling = field.previousElementSibling;
    if (previousSibling && this.isTextElement(previousSibling)) {
      relatedElements.push(previousSibling);
    }

    // 6. Find next sibling (helper text often comes after)
    const nextSibling = field.nextElementSibling;
    if (nextSibling && this.isTextElement(nextSibling)) {
      relatedElements.push(nextSibling);
    }

    // 7. Find parent container with common class patterns
    const parentContainer = field.closest('.form-group, .field, .input-group, [class*="field"], [class*="form"]');
    if (parentContainer) {
      // Look for labels, helper text, error messages within the container
      const containerLabels = parentContainer.querySelectorAll('label, .label, [class*="label"]');
      containerLabels.forEach(label => {
        if (!label.contains(field) || label === parentLabel) {
          relatedElements.push(label);
        }
      });

      const helperTexts = parentContainer.querySelectorAll('.helper-text, .help-text, .description, [class*="helper"], [class*="hint"], [class*="error"]');
      helperTexts.forEach(text => relatedElements.push(text));
    }

    // 8. Find fieldset legend (section heading)
    const fieldset = field.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) {
        relatedElements.push(legend);
      }
    }

    // 9. Placeholder text handling (we'll highlight the field itself to show this)
    // The placeholder is part of the field, so it gets highlighted with the field

    return relatedElements;
  }

  /**
   * Check if an element is a text-containing element
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  isTextElement(element) {
    const textTags = ['SPAN', 'DIV', 'P', 'LABEL', 'SMALL', 'STRONG', 'EM', 'B', 'I', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
    return textTags.includes(element.tagName) && element.textContent.trim().length > 0;
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
        console.log('[JobAssist] DOM changed, re-scanning fields...');
        this.detectAndHighlightFields();
      }, 500);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Toggle highlighting on/off
   */
  toggle() {
    this.isEnabled = !this.isEnabled;
    if (this.isEnabled) {
      this.detectAndHighlightFields();
    } else {
      this.clearHighlights();
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const highlighter = new FieldHighlighter();
    highlighter.init();
  });
} else {
  const highlighter = new FieldHighlighter();
  highlighter.init();
}
