/**
 * Field Classifier
 * Classifies form fields based on their labels, placeholders, and context
 */

class FieldClassifier {
  constructor(synonyms) {
    this.synonyms = synonyms;
  }

  /**
   * Classify a field based on its metadata
   * @param {Object} fieldData - Field metadata (labels, placeholder, etc.)
   * @returns {Object} Classification result with type and confidence
   */
  classify(fieldData) {
    const { labels, placeholder, name, id, type, ariaLabel, context } = fieldData;

    // Combine all text sources for analysis
    const allText = [
      ...labels,
      placeholder,
      ariaLabel,
      name,
      id,
      context.sectionHeading
    ].filter(Boolean).join(' ');

    // Try multiple classification strategies
    const results = [
      this._classifyByExactMatch(allText),
      this._classifyByKeywords(allText),
      this._classifyByPatterns(allText),
      this._classifyByContext(fieldData)
    ].filter(result => result !== null);

    // Return best result or unknown
    if (results.length === 0) {
      return {
        type: 'unknown',
        confidence: 0,
        strategy: 'none',
        fieldType: type
      };
    }

    // Sort by confidence and return best match
    results.sort((a, b) => b.confidence - a.confidence);
    return results[0];
  }

  /**
   * Exact match strategy
   */
  _classifyByExactMatch(text) {
    const normalized = StringMatcher.normalize(text);

    for (const [fieldType, config] of Object.entries(this.synonyms)) {
      for (const keyword of config.keywords) {
        if (normalized === StringMatcher.normalize(keyword)) {
          return {
            type: fieldType,
            confidence: config.confidence,
            strategy: 'exact',
            matchedText: keyword
          };
        }
      }
    }

    return null;
  }

  /**
   * Keyword-based classification
   */
  _classifyByKeywords(text) {
    const normalized = StringMatcher.normalize(text);
    let bestMatch = null;
    let bestScore = 0;

    for (const [fieldType, config] of Object.entries(this.synonyms)) {
      for (const keyword of config.keywords) {
        if (StringMatcher.contains(normalized, keyword)) {
          const score = config.confidence * 0.9; // Slightly lower than exact match
          if (score > bestScore) {
            bestScore = score;
            bestMatch = {
              type: fieldType,
              confidence: score,
              strategy: 'keyword',
              matchedText: keyword
            };
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Pattern-based classification (regex)
   */
  _classifyByPatterns(text) {
    const normalized = StringMatcher.normalize(text);
    let bestMatch = null;
    let bestScore = 0;

    for (const [fieldType, config] of Object.entries(this.synonyms)) {
      for (const pattern of config.patterns || []) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(normalized)) {
          const score = config.confidence * 0.85;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = {
              type: fieldType,
              confidence: score,
              strategy: 'pattern',
              matchedPattern: pattern
            };
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Context-based classification
   * Use surrounding fields and section headings
   */
  _classifyByContext(fieldData) {
    const { context, type } = fieldData;

    // Education section context
    if (StringMatcher.containsAny(context.sectionHeading, ['education', 'academic', 'school'])) {
      // Increase confidence for education-related fields
      if (StringMatcher.containsAny(context.nearbyLabels.join(' '), ['school', 'university', 'college'])) {
        return {
          type: 'education.institution',
          confidence: 0.8,
          strategy: 'context',
          context: 'education-section'
        };
      }
    }

    // Experience/Work section context
    if (StringMatcher.containsAny(context.sectionHeading, ['experience', 'work', 'employment'])) {
      if (StringMatcher.containsAny(context.nearbyLabels.join(' '), ['company', 'employer'])) {
        return {
          type: 'experience.company',
          confidence: 0.8,
          strategy: 'context',
          context: 'experience-section'
        };
      }
    }

    // Address section context
    if (StringMatcher.containsAny(context.sectionHeading, ['address', 'location', 'contact'])) {
      const nearbyText = context.nearbyLabels.join(' ');

      if (StringMatcher.contains(nearbyText, 'city') ||
          context.nearbyLabels.some(label => StringMatcher.normalize(label) === 'city')) {
        return {
          type: 'address.city',
          confidence: 0.85,
          strategy: 'context',
          context: 'address-section'
        };
      }

      if (StringMatcher.contains(nearbyText, 'state')) {
        return {
          type: 'address.state',
          confidence: 0.85,
          strategy: 'context',
          context: 'address-section'
        };
      }
    }

    return null;
  }

  /**
   * Classify multiple fields together (for multi-field scenarios)
   * E.g., "First Name" and "Last Name" appearing together
   * @param {Array} fieldsData - Array of field metadata
   * @returns {Array} Array of classifications
   */
  classifyMultiple(fieldsData) {
    const classifications = fieldsData.map(fieldData => ({
      fieldData,
      classification: this.classify(fieldData)
    }));

    // Post-process to handle multi-field scenarios
    this._adjustForMultiField(classifications);

    return classifications;
  }

  /**
   * Adjust classifications when multiple related fields detected
   */
  _adjustForMultiField(classifications) {
    // Check for First Name + Last Name pattern
    const hasFirstName = classifications.some(c => c.classification.type === 'personalInfo.firstName');
    const hasLastName = classifications.some(c => c.classification.type === 'personalInfo.lastName');

    if (hasFirstName && hasLastName) {
      // If we have both first and last name fields, boost their confidence
      classifications.forEach(c => {
        if (c.classification.type === 'personalInfo.firstName' ||
            c.classification.type === 'personalInfo.lastName') {
          c.classification.confidence = Math.min(0.98, c.classification.confidence + 0.05);
        }
        // Reduce confidence of fullName fields
        if (c.classification.type === 'personalInfo.fullName') {
          c.classification.confidence *= 0.7;
        }
      });
    }

    // Check for address fields (City + State + Zip pattern)
    const hasCity = classifications.some(c => c.classification.type === 'address.city');
    const hasState = classifications.some(c => c.classification.type === 'address.state');
    const hasZip = classifications.some(c => c.classification.type === 'address.zip');

    if (hasCity && hasState && hasZip) {
      classifications.forEach(c => {
        if (c.classification.type?.startsWith('address.')) {
          c.classification.confidence = Math.min(0.98, c.classification.confidence + 0.05);
        }
      });
    }
  }
}
