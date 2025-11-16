/**
 * Select Filler
 * Fills dropdown/select elements
 */

class SelectFiller extends BaseFiller {
  /**
   * Fill select field
   * @param {HTMLSelectElement} field
   * @param {string} value
   * @returns {boolean}
   */
  fill(field, value) {
    if (!this.validate(field, value)) {
      return false;
    }

    try {
      // Strategy 1: Exact value match
      if (this._selectByValue(field, value)) {
        this.triggerEvents(field);
        logger.debug(`Filled select field with exact match: ${value}`);
        return true;
      }

      // Strategy 2: Exact text match
      if (this._selectByText(field, value)) {
        this.triggerEvents(field);
        logger.debug(`Filled select field with text match: ${value}`);
        return true;
      }

      // Strategy 3: Fuzzy match
      if (this._selectByFuzzyMatch(field, value)) {
        this.triggerEvents(field);
        logger.debug(`Filled select field with fuzzy match: ${value}`);
        return true;
      }

      logger.warn(`Could not find matching option for: ${value}`);
      return false;
    } catch (error) {
      logger.error('Error filling select field:', error);
      return false;
    }
  }

  /**
   * Select by exact value match
   */
  _selectByValue(field, value) {
    const option = Array.from(field.options).find(opt => opt.value === value);
    if (option) {
      field.value = option.value;
      return true;
    }
    return false;
  }

  /**
   * Select by exact text match
   */
  _selectByText(field, value) {
    const option = Array.from(field.options).find(opt =>
      opt.textContent.trim().toLowerCase() === value.toLowerCase()
    );
    if (option) {
      field.value = option.value;
      return true;
    }
    return false;
  }

  /**
   * Select by fuzzy match
   */
  _selectByFuzzyMatch(field, value) {
    const options = Array.from(field.options).map(opt => ({
      element: opt,
      text: opt.textContent.trim(),
      value: opt.value
    }));

    // Try fuzzy matching on text content
    const bestMatch = StringMatcher.findBestMatch(
      value,
      options.map(o => o.text),
      0.7 // threshold
    );

    if (bestMatch) {
      const matchedOption = options.find(o => o.text === bestMatch.match);
      if (matchedOption) {
        field.value = matchedOption.value;
        logger.debug(`Fuzzy matched "${value}" to "${bestMatch.match}" (score: ${bestMatch.score})`);
        return true;
      }
    }

    // Try partial matching (contains)
    const partialMatch = options.find(opt =>
      StringMatcher.contains(opt.text, value) ||
      StringMatcher.contains(value, opt.text)
    );

    if (partialMatch) {
      field.value = partialMatch.value;
      logger.debug(`Partial matched "${value}" to "${partialMatch.text}"`);
      return true;
    }

    return false;
  }
}
