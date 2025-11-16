/**
 * ContextEnricher
 * Adds semantic context to form structure for better LLM understanding
 */

class ContextEnricher {
  constructor() {
    // Section keywords for classification
    this.sectionKeywords = {
      personal_info: ['personal', 'contact', 'about', 'profile', 'basic'],
      education: ['education', 'academic', 'school', 'university', 'college', 'degree'],
      experience: ['experience', 'work', 'employment', 'job', 'position', 'career'],
      skills: ['skill', 'competenc', 'technolog', 'expertise'],
      address: ['address', 'location', 'residence'],
      preferences: ['preference', 'availability', 'desired', 'looking for'],
      demographics: ['demographic', 'veteran', 'disability', 'race', 'gender', 'ethnicity'],
      cover_letter: ['cover letter', 'why', 'tell us', 'motivation', 'essay']
    };

    // Temporal indicators
    this.temporalIndicators = {
      current: ['current', 'present', 'now', 'today'],
      previous: ['previous', 'prior', 'last', 'former', 'past'],
      most_recent: ['most recent', 'latest', 'recent']
    };
  }

  /**
   * Enrich form structure with semantic context
   */
  enrich(formStructure) {
    const enrichedSections = formStructure.sections.map(section => {
      return {
        ...section,
        semanticType: this.classifySection(section.heading),
        fields: section.fields.map(field => this.enrichField(field, section))
      };
    });

    return {
      ...formStructure,
      sections: enrichedSections
    };
  }

  /**
   * Enrich individual field with semantic context
   */
  enrichField(field, section) {
    const allText = this.getAllText(field);

    return {
      ...field,
      semanticContext: {
        // Section classification
        parentSection: this.classifySection(section.heading),
        sectionType: section.semanticType,

        // Temporal context
        temporal: this.detectTemporal(allText),

        // Field purpose
        fieldPurpose: this.detectFieldPurpose(field, allText),

        // Disambiguation
        isWorkLocation: this.isWorkLocation(field, section),
        isPersonalAddress: this.isPersonalAddress(field, section),

        // Related field detection
        relatedFields: this.findRelatedFields(field, section),

        // Complete context string for LLM
        contextSummary: this.buildContextSummary(field, section)
      }
    };
  }

  /**
   * Classify section type
   */
  classifySection(heading) {
    const headingLower = heading.toLowerCase();

    for (const [sectionType, keywords] of Object.entries(this.sectionKeywords)) {
      for (const keyword of keywords) {
        if (headingLower.includes(keyword)) {
          return sectionType;
        }
      }
    }

    return 'other';
  }

  /**
   * Detect temporal context
   */
  detectTemporal(text) {
    const textLower = text.toLowerCase();

    for (const [temporal, keywords] of Object.entries(this.temporalIndicators)) {
      for (const keyword of keywords) {
        if (textLower.includes(keyword)) {
          return temporal;
        }
      }
    }

    return null;
  }

  /**
   * Detect field purpose
   */
  detectFieldPurpose(field, allText) {
    const text = allText.toLowerCase();

    // Check for common patterns
    if (text.includes('first name') || text.includes('given name')) return 'first_name';
    if (text.includes('last name') || text.includes('surname') || text.includes('family name')) return 'last_name';
    if (text.includes('email')) return 'email';
    if (text.includes('phone') || text.includes('mobile') || text.includes('telephone')) return 'phone';
    if (text.includes('company') || text.includes('employer')) return 'company';
    if (text.includes('position') || text.includes('title') || text.includes('role')) return 'position';
    if (text.includes('location') || text.includes('city')) return 'location';
    if (text.includes('start date') || text.includes('from')) return 'start_date';
    if (text.includes('end date') || text.includes('to') || text.includes('until')) return 'end_date';
    if (text.includes('school') || text.includes('university') || text.includes('college')) return 'institution';
    if (text.includes('degree') || text.includes('qualification')) return 'degree';

    return 'unknown';
  }

  /**
   * Determine if this is a work location field
   */
  isWorkLocation(field, section) {
    const sectionType = this.classifySection(section.heading);
    const allText = this.getAllText(field).toLowerCase();

    return (
      sectionType === 'experience' &&
      (allText.includes('location') || allText.includes('city'))
    );
  }

  /**
   * Determine if this is a personal address field
   */
  isPersonalAddress(field, section) {
    const sectionType = this.classifySection(section.heading);
    const allText = this.getAllText(field).toLowerCase();

    return (
      sectionType === 'address' ||
      (sectionType === 'personal_info' && allText.includes('address'))
    );
  }

  /**
   * Find related fields (fields that are part of the same logical group)
   */
  findRelatedFields(field, section) {
    const related = [];

    // Find fields within a certain distance in the same section
    const fieldIndex = section.fields.indexOf(field);
    if (fieldIndex === -1) return related;

    // Check 2 fields before and after
    for (let i = Math.max(0, fieldIndex - 2); i <= Math.min(section.fields.length - 1, fieldIndex + 2); i++) {
      if (i !== fieldIndex) {
        const relatedField = section.fields[i];
        related.push({
          fieldId: relatedField.fieldId,
          label: relatedField.labels[0] || relatedField.name,
          purpose: this.detectFieldPurpose(relatedField, this.getAllText(relatedField))
        });
      }
    }

    return related;
  }

  /**
   * Build context summary for LLM
   */
  buildContextSummary(field, section) {
    const parts = [];

    // Section info
    if (section.heading) {
      parts.push(`Section: "${section.heading}"`);
    }

    // Subsection
    if (field.context.subsectionHeading) {
      parts.push(`Subsection: "${field.context.subsectionHeading}"`);
    }

    // Field label
    if (field.labels.length > 0) {
      parts.push(`Label: "${field.labels[0]}"`);
    }

    // Temporal context
    const temporal = this.detectTemporal(this.getAllText(field));
    if (temporal) {
      parts.push(`Temporal: ${temporal}`);
    }

    // Special context
    if (this.isWorkLocation(field, section)) {
      parts.push(`Note: This is a work/job location, not personal address`);
    }

    return parts.join(' | ');
  }

  /**
   * Get all text related to field
   */
  getAllText(field) {
    const parts = [
      ...field.labels,
      field.placeholder,
      field.ariaLabel,
      field.context.sectionHeading,
      field.context.subsectionHeading,
      field.context.helperText,
      ...field.context.nearbyLabels
    ];

    return parts.filter(Boolean).join(' ');
  }
}
