/**
 * Text Extractor
 * Extracts all text related to an input field
 */

class TextExtractor {
  /**
   * Extract all related text for a field
   * @param {HTMLElement} field - The input field element
   * @returns {Object} Field data with labels, placeholder, context, etc.
   */
  static extractFieldData(field) {
    const labels = this.findLabels(field);
    const placeholder = field.placeholder || field.getAttribute('placeholder') || '';
    const ariaLabel = field.getAttribute('aria-label') || '';
    const name = field.name || field.getAttribute('name') || '';
    const id = field.id || field.getAttribute('id') || '';
    const type = field.type || field.tagName.toLowerCase();

    const context = {
      sectionHeading: this.findSectionHeading(field),
      nearbyLabels: this.findNearbyLabels(field),
      helperText: this.findHelperText(field)
    };

    return {
      element: field,
      labels,
      placeholder,
      ariaLabel,
      name,
      id,
      type,
      context
    };
  }

  /**
   * Find all labels associated with a field
   * @param {HTMLElement} field
   * @returns {string[]} Array of label texts
   */
  static findLabels(field) {
    const labels = [];

    // 1. Find associated label via 'for' attribute
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`);
      if (label) {
        labels.push(label.textContent.trim());
      }
    }

    // 2. Find parent label (input nested inside label)
    const parentLabel = field.closest('label');
    if (parentLabel) {
      // Get text content excluding the input itself
      const labelText = this.getTextExcludingElement(parentLabel, field);
      if (labelText) {
        labels.push(labelText);
      }
    }

    // 3. Find labels via aria-labelledby
    const ariaLabelledBy = field.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      ariaLabelledBy.split(' ').forEach(id => {
        const element = document.getElementById(id);
        if (element) {
          labels.push(element.textContent.trim());
        }
      });
    }

    // 4. Find adjacent text elements (common pattern: <span>Label</span><input>)
    const previousSibling = field.previousElementSibling;
    if (previousSibling && this.isTextElement(previousSibling)) {
      labels.push(previousSibling.textContent.trim());
    }

    // 5. Look for labels within parent container
    const parentContainer = field.closest('.form-group, .field, .input-group, [class*="field"], [class*="form"]');
    if (parentContainer) {
      const containerLabels = parentContainer.querySelectorAll('label, .label, [class*="label"]');
      containerLabels.forEach(label => {
        if (!label.contains(field) && label !== parentLabel) {
          const text = label.textContent.trim();
          if (text && !labels.includes(text)) {
            labels.push(text);
          }
        }
      });
    }

    return labels;
  }

  /**
   * Find section heading (fieldset legend or section title)
   * @param {HTMLElement} field
   * @returns {string}
   */
  static findSectionHeading(field) {
    // 1. Check for fieldset legend
    const fieldset = field.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) {
        return legend.textContent.trim();
      }
    }

    // 2. Check for section heading
    const section = field.closest('section, [role="group"]');
    if (section) {
      const heading = section.querySelector('h1, h2, h3, h4, h5, h6, [class*="heading"], [class*="title"]');
      if (heading) {
        return heading.textContent.trim();
      }
    }

    return '';
  }

  /**
   * Find nearby labels (for context)
   * @param {HTMLElement} field
   * @returns {string[]}
   */
  static findNearbyLabels(field) {
    const labels = [];
    const container = field.closest('.form-group, .field, fieldset, section, form');

    if (container) {
      const allLabels = container.querySelectorAll('label, .label, legend, [class*="label"]');
      allLabels.forEach(label => {
        const text = label.textContent.trim();
        if (text && !labels.includes(text)) {
          labels.push(text);
        }
      });
    }

    return labels.slice(0, 10); // Limit to 10 to avoid noise
  }

  /**
   * Find helper text
   * @param {HTMLElement} field
   * @returns {string}
   */
  static findHelperText(field) {
    const helperTexts = [];

    // 1. Check aria-describedby
    const ariaDescribedBy = field.getAttribute('aria-describedby');
    if (ariaDescribedBy) {
      ariaDescribedBy.split(' ').forEach(id => {
        const element = document.getElementById(id);
        if (element) {
          helperTexts.push(element.textContent.trim());
        }
      });
    }

    // 2. Check next sibling for helper text
    const nextSibling = field.nextElementSibling;
    if (nextSibling && this.isHelperElement(nextSibling)) {
      helperTexts.push(nextSibling.textContent.trim());
    }

    // 3. Check parent container for helper text
    const parentContainer = field.closest('.form-group, .field, .input-group');
    if (parentContainer) {
      const helpers = parentContainer.querySelectorAll('.helper-text, .help-text, .description, [class*="helper"], [class*="hint"]');
      helpers.forEach(helper => {
        const text = helper.textContent.trim();
        if (text && !helperTexts.includes(text)) {
          helperTexts.push(text);
        }
      });
    }

    return helperTexts.join(' ');
  }

  /**
   * Check if element is a text-containing element
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  static isTextElement(element) {
    const textTags = ['SPAN', 'DIV', 'P', 'LABEL', 'SMALL', 'STRONG', 'EM', 'B', 'I', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
    return textTags.includes(element.tagName) && element.textContent.trim().length > 0;
  }

  /**
   * Check if element is likely helper text
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  static isHelperElement(element) {
    const className = element.className || '';
    const helperPatterns = ['helper', 'help', 'hint', 'description', 'error', 'note'];
    return helperPatterns.some(pattern => className.toLowerCase().includes(pattern));
  }

  /**
   * Get text content of element excluding a child element
   * @param {HTMLElement} parent
   * @param {HTMLElement} exclude
   * @returns {string}
   */
  static getTextExcludingElement(parent, exclude) {
    const clone = parent.cloneNode(true);
    const excludeClone = clone.querySelector(exclude.tagName + (exclude.id ? `#${exclude.id}` : ''));
    if (excludeClone) {
      excludeClone.remove();
    }
    return clone.textContent.trim();
  }
}
