/**
 * Field Detector
 * Detects all input fields on the page
 */

class FieldDetector {
  /**
   * Find all input fields on the page
   * @returns {HTMLElement[]} Array of input field elements
   */
  static findAllFields() {
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

    return Array.from(fields);
  }

  /**
   * Check if element is a form field
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  static isFormField(element) {
    if (element.tagName === 'INPUT' && element.type !== 'hidden') return true;
    if (element.tagName === 'TEXTAREA') return true;
    if (element.tagName === 'SELECT') return true;
    if (element.hasAttribute('contenteditable')) return true;
    if (element.getAttribute('role') === 'combobox') return true;
    if (element.getAttribute('role') === 'textbox') return true;
    if (element.getAttribute('role') === 'searchbox') return true;
    return false;
  }
}
