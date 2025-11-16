/**
 * Text Filler
 * Fills text inputs, textareas, and contenteditable elements
 */

class TextFiller extends BaseFiller {
  /**
   * Fill text field
   * @param {HTMLElement} field
   * @param {string} value
   * @returns {boolean}
   */
  fill(field, value) {
    if (!this.validate(field, value)) {
      return false;
    }

    try {
      if (field.hasAttribute('contenteditable')) {
        // Handle contenteditable
        field.textContent = value;
        field.innerHTML = value;
      } else {
        // Handle input/textarea
        field.value = value;
      }

      // Trigger events for framework compatibility
      this.triggerEvents(field);

      logger.debug(`Filled text field with: ${value.substring(0, 50)}...`);
      return true;
    } catch (error) {
      logger.error('Error filling text field:', error);
      return false;
    }
  }

  /**
   * Validate text input
   */
  validate(field, value) {
    if (!super.validate(field, value)) return false;

    // Check maxLength constraint
    if (field.maxLength && field.maxLength > 0) {
      if (value.length > field.maxLength) {
        logger.warn(`Value exceeds maxLength (${field.maxLength}), truncating`);
        // Could truncate here, but let's be safe and not fill
        return false;
      }
    }

    // Check pattern constraint
    if (field.pattern) {
      const regex = new RegExp(field.pattern);
      if (!regex.test(value)) {
        logger.warn(`Value doesn't match pattern: ${field.pattern}`);
        return false;
      }
    }

    return true;
  }
}
