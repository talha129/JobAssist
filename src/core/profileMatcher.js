/**
 * Profile Matcher
 * Matches classified fields to user profile data
 */

class ProfileMatcher {
  constructor(profile) {
    this.profile = profile;
  }

  /**
   * Get value from profile based on field classification
   * @param {Object} classification - Field classification result
   * @param {HTMLElement} field - The input element
   * @returns {*} Value from profile or null
   */
  getValue(classification, field) {
    const { type } = classification;

    if (!type || type === 'unknown') {
      return null;
    }

    // Handle different field types
    if (type.startsWith('personalInfo.')) {
      return this._getPersonalInfo(type, field);
    }

    if (type.startsWith('address.')) {
      return this._getAddress(type, field);
    }

    if (type.startsWith('education.')) {
      return this._getEducation(type, field);
    }

    if (type.startsWith('experience.')) {
      return this._getExperience(type, field);
    }

    if (type.startsWith('skills.')) {
      return this._getSkills(type, field);
    }

    if (type.startsWith('preferences.')) {
      return this._getPreferences(type, field);
    }

    if (type.startsWith('demographics.')) {
      return this._getDemographics(type, field);
    }

    if (type.startsWith('summary.')) {
      return this._getSummary(type, field);
    }

    // Special cases
    if (type === 'coverLetter') {
      return this.profile.summary?.long || '';
    }

    return null;
  }

  /**
   * Get personal information
   */
  _getPersonalInfo(type, field) {
    const key = type.replace('personalInfo.', '');
    return this.profile.personalInfo?.[key] || null;
  }

  /**
   * Get address information
   */
  _getAddress(type, field) {
    const key = type.replace('address.', '');

    // Handle full address
    if (key === 'full') {
      return this.profile.address?.current?.full || '';
    }

    // Handle specific address components
    if (key === 'state') {
      // Check if field is dropdown (might need state code vs full name)
      if (field.tagName === 'SELECT') {
        // Try to match with options
        const options = Array.from(field.options).map(opt => opt.value);
        if (options.includes(this.profile.address?.current?.stateCode)) {
          return this.profile.address?.current?.stateCode;
        }
        return this.profile.address?.current?.stateFull;
      }
      return this.profile.address?.current?.state;
    }

    return this.profile.address?.current?.[key] || null;
  }

  /**
   * Get education information
   */
  _getEducation(type, field) {
    const key = type.replace('education.', '');

    // Get most recent education (first in array)
    const edu = this.profile.education?.[0];
    if (!edu) return null;

    if (key === 'graduationDate') {
      return edu.endDate?.formatted || null;
    }

    return edu[key] || null;
  }

  /**
   * Get experience/work information
   */
  _getExperience(type, field) {
    const key = type.replace('experience.', '');

    // Special case: years of experience
    if (key === 'yearsOfExperience') {
      return this._getYearsOfExperience(field);
    }

    // Get current job (or most recent)
    const currentJob = this.profile.experience?.find(exp => exp.current);
    const mostRecent = currentJob || this.profile.experience?.[0];

    if (!mostRecent) return null;

    if (key === 'current') {
      return mostRecent.current ? 'Yes' : 'No';
    }

    if (key === 'startDate') {
      return mostRecent.startDate?.formatted || null;
    }

    if (key === 'endDate') {
      return mostRecent.endDate?.formatted || null;
    }

    return mostRecent[key] || null;
  }

  /**
   * Calculate years of experience
   */
  _getYearsOfExperience(field) {
    const totalYears = this.profile.metadata?.yearsOfExperience;

    // If field is dropdown, match to closest option
    if (field.tagName === 'SELECT') {
      const options = Array.from(field.options).map(opt => ({
        value: opt.value,
        text: opt.textContent
      }));

      // Try to find matching range
      for (const option of options) {
        const text = option.text.toLowerCase();

        // Match patterns like "3-5", "3 to 5", "3-5 years"
        const rangeMatch = text.match(/(\d+)\s*[-to]+\s*(\d+)/);
        if (rangeMatch) {
          const min = parseInt(rangeMatch[1]);
          const max = parseInt(rangeMatch[2]);
          if (totalYears >= min && totalYears <= max) {
            return option.value;
          }
        }

        // Match patterns like "5+", "10+"
        const plusMatch = text.match(/(\d+)\s*\+/);
        if (plusMatch) {
          const min = parseInt(plusMatch[1]);
          if (totalYears >= min) {
            return option.value;
          }
        }
      }
    }

    return totalYears?.toString() || null;
  }

  /**
   * Get skills
   */
  _getSkills(type, field) {
    const key = type.replace('skills.', '');

    if (key === 'primary') {
      return this.profile.skills?.primarySkills?.join(', ') || null;
    }

    if (key === 'languages') {
      return this.profile.skills?.categories?.languages?.join(', ') || null;
    }

    return null;
  }

  /**
   * Get preferences
   */
  _getPreferences(type, field) {
    const key = type.replace('preferences.', '');

    if (key === 'salary') {
      const salary = this.profile.preferences?.salaryExpectation;
      if (!salary) return null;

      // Return appropriate format based on field type
      if (field.tagName === 'SELECT') {
        // Match to dropdown range
        return this._matchSalaryRange(field, salary);
      }

      // Return min or average
      return salary.min?.toString() || null;
    }

    if (key === 'jobType') {
      return this._getMultipleChoice(field, this.profile.preferences?.jobTypes);
    }

    if (key === 'workArrangement') {
      return this._getMultipleChoice(field, this.profile.preferences?.workArrangement);
    }

    if (key === 'startDate') {
      return this.profile.preferences?.startDate?.earliest || null;
    }

    if (key === 'sponsorship') {
      return this.profile.preferences?.sponsorshipRequired ? 'Yes' : 'No';
    }

    if (key === 'relocation') {
      return this.profile.preferences?.willingToRelocate ? 'Yes' : 'No';
    }

    return this.profile.preferences?.[key] || null;
  }

  /**
   * Get demographics (optional)
   */
  _getDemographics(type, field) {
    const key = type.replace('demographics.', '');
    return this.profile.demographics?.[key] || 'Prefer not to answer';
  }

  /**
   * Get summary/bio
   */
  _getSummary(type, field) {
    const key = type.replace('summary.', '');

    // Determine which length to use based on field constraints
    if (field.maxLength) {
      const maxLen = parseInt(field.maxLength);
      if (maxLen < 200) {
        return this.profile.summary?.elevator || '';
      } else if (maxLen < 500) {
        return this.profile.summary?.short || '';
      } else if (maxLen < 1000) {
        return this.profile.summary?.medium || '';
      }
    }

    return this.profile.summary?.[key] || this.profile.summary?.short || '';
  }

  /**
   * Match salary to dropdown range
   */
  _matchSalaryRange(field, salaryExpectation) {
    const options = Array.from(field.options);
    const targetSalary = salaryExpectation.min;

    for (const option of options) {
      const text = option.textContent.toLowerCase();
      const numbers = text.match(/\d+/g);

      if (numbers && numbers.length >= 2) {
        const min = parseInt(numbers[0]) * 1000; // Assume in thousands
        const max = parseInt(numbers[1]) * 1000;

        if (targetSalary >= min && targetSalary <= max) {
          return option.value;
        }
      }
    }

    return null;
  }

  /**
   * Handle multiple choice fields (checkboxes, multi-select, radio)
   */
  _getMultipleChoice(field, values) {
    if (!values || values.length === 0) return null;

    // For dropdowns and radio buttons, return first value
    if (field.tagName === 'SELECT' || field.type === 'radio') {
      // Try to match profile value to option value
      const options = Array.from(field.tagName === 'SELECT' ? field.options :
                                 document.querySelectorAll(`input[name="${field.name}"]`));

      for (const value of values) {
        const match = options.find(opt => {
          const optText = (opt.textContent || opt.value).toLowerCase();
          return optText.includes(value.toLowerCase()) || value.toLowerCase().includes(optText);
        });

        if (match) {
          return match.value;
        }
      }

      return values[0];
    }

    // For checkboxes, return array
    if (field.type === 'checkbox') {
      return values;
    }

    // Default: return as comma-separated
    return values.join(', ');
  }
}
