/**
 * Base Filler
 * Base class for all fill strategies
 */

class BaseFiller {
  /**
   * Fill a field with a value
   * @param {HTMLElement} field
   * @param {*} value
   * @returns {boolean} Success status
   */
  fill(field, value) {
    throw new Error('fill() must be implemented by subclass');
  }

  /**
   * Trigger events to ensure framework compatibility
   * @param {HTMLElement} field
   */
  triggerEvents(field) {
    // Trigger input event (for React, Vue, etc.)
    field.dispatchEvent(new Event('input', { bubbles: true }));

    // Trigger change event
    field.dispatchEvent(new Event('change', { bubbles: true }));

    // Trigger blur event
    field.dispatchEvent(new Event('blur', { bubbles: true }));

    // For React specifically
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(field, field.value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /**
   * Check if field is readonly or disabled
   * @param {HTMLElement} field
   * @returns {boolean}
   */
  isFieldEditable(field) {
    return !field.disabled && !field.readOnly;
  }

  /**
   * Validate value before filling
   * @param {HTMLElement} field
   * @param {*} value
   * @returns {boolean}
   */
  validate(field, value) {
    if (!value) return false;
    if (!this.isFieldEditable(field)) return false;
    return true;
  }
}
