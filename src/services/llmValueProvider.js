/**
 * LLMValueProvider
 * Gets field values directly from LLM via OpenRouter
 * OPTIMIZED for minimal token usage
 */

class LLMValueProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.openai.com/v1/chat/completions';
    this.model = 'gpt-5-nano';  // Using GPT-4o Nano
    this.cache = new Map();
  }

  /**
   * Get field values from LLM
   */
  async getFieldValues(formStructure, userProfile) {
    const result = await this.getFieldValuesWithDetails(formStructure, userProfile);
    return result.fieldValues;
  }

  /**
   * Get field values from LLM with detailed response (for logging)
   */
  async getFieldValuesWithDetails(formStructure, userProfile) {
    const cacheKey = this.getCacheKey(formStructure);
    if (this.cache.has(cacheKey)) {
      console.log('Using cached LLM response');
      return this.cache.get(cacheKey);
    }

    try {
      const prompt = await this.buildCompactPrompt(formStructure, userProfile);
      const response = await this.callLLM(prompt);
      const fieldValues = this.parseResponse(response);

      const fullResponse = {
        fieldValues,
        prompt,
        apiResponse: response,
        fromCache: false
      };

      this.cache.set(cacheKey, fullResponse);
      return fullResponse;
    } catch (error) {
      console.error('LLM API call failed:', error);
      throw new Error(`Failed to get field values: ${error.message}`);
    }
  }

  /**
   * Build minimal readable prompt for LLM with nested sections
   */
  async buildCompactPrompt(formStructure, userProfile) {
    const sections = [];

    formStructure.sections.forEach(section => {
      // Only include sections that have fields
      if (!section.fields || section.fields.length === 0) {
        return;
      }

      const sectionData = {
        heading: section.heading || 'Unlabeled Section',
        fields: []
      };

      // Add semantic type if available and meaningful
      if (section.semanticType && section.semanticType !== 'unknown') {
        sectionData.type = section.semanticType;
      }

      section.fields.forEach(field => {
        const f = {
          id: field.fieldId,
          label: field.labels[0] || field.name || field.placeholder || 'unlabeled',
          type: field.type
        };

        // Add dropdown options if present
        if (field.options && field.options.length > 0 && field.options.length < 30) {
          f.options = field.options.map(opt => opt.text);
        }

        sectionData.fields.push(f);
      });

      sections.push(sectionData);
    });

    // Load simplified profile directly from user-profile.talha.json
    let profile;
    try {
      const response = await fetch(chrome.runtime.getURL('src/data/user-profile.talha.json'));
      profile = await response.json();
    } catch (error) {
      console.error('Failed to load user-profile.talha.json:', error);
      // Fallback to empty profile
      profile = {
        profile: "",
        summary: "",
        experience: [],
        education: [],
        skills: ""
      };
    }

    return JSON.stringify({
      sections,
      profile
    });
  }

  /**
   * Call OpenRouter API
   */
  async callLLM(prompt) {
    console.log('🔗 Calling OpenAI API...', {
      model: this.model,
      promptLength: prompt.length,
      estimatedTokens: Math.ceil(prompt.length / 4)
    });

    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        reasoning_effort: "minimal",
        // reasoning: { effort: "disabled" },
        // max_tokens: 300,
        response_format: { type: 'json_object' },
        // temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 500)
      });
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    try {
      const data = await response.json();
      console.log('✓ API Response received', {
        usage: data.usage
      });
      return data;
    } catch (error) {
      console.error('Failed to parse API response:', error);
      throw new Error(`Invalid API response: ${error.message}`);
    }
  }

  /**
   * System prompt - simple instructions for LLM
   */
  getSystemPrompt() {
    return `Fill form fields using the profile data. The form is organized into sections with headings. Use the section heading to understand the context of each field.


Return ONLY a JSON object with this format: {"values":[{"id":"field_id","value":"field_value"}]}.
Only use values from the profile. Do not hallucinate.

Rules:
- Use section headings to determine context (e.g., "Current Position" vs "Previous Position")
- For work experience: experience[0] is current job, experience[1] is previous job
- For address fields under "Address" heading: use profile.address
- For location fields under work headings: use the job's location (experience[0].location or experience[1].location)
- Match dropdown options exactly from the "options" array
- Return "none" if no matching data exists`;
  }

  /**
   * Parse LLM response - expects simple {"values": [...]} format
   */
  parseResponse(apiResponse) {
    try {
      const content = apiResponse.choices[0].message.content;
      const parsed = JSON.parse(content);

      if (!parsed.values || !Array.isArray(parsed.values)) {
        throw new Error('Invalid response format - expected {"values": [...]}');
      }

      // Convert to internal format with confidence
      return parsed.values.map(item => ({
        fieldId: item.id,
        value: item.value || 'none',
        confidence: item.value && item.value !== 'none' ? 0.9 : 0,
        reasoning: 'LLM'
      }));
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      console.log('Raw response:', apiResponse);
      throw new Error(`Response parsing failed: ${error.message}`);
    }
  }

  /**
   * Generate cache key from form structure
   */
  getCacheKey(formStructure) {
    return `${formStructure.url}_${formStructure.totalFields}`;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}
