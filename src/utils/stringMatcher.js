/**
 * String Matcher Utility
 * Provides fuzzy matching and string similarity functions
 */

class StringMatcher {
  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1
   * @param {string} str2
   * @returns {number} Edit distance
   */
  static levenshteinDistance(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    const m = s1.length;
    const n = s2.length;

    if (m === 0) return n;
    if (n === 0) return m;

    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1,      // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return dp[m][n];
  }

  /**
   * Calculate similarity score between two strings (0-1)
   * @param {string} str1
   * @param {string} str2
   * @returns {number} Similarity score (0 = completely different, 1 = identical)
   */
  static similarity(str1, str2) {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1.0;

    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }

  /**
   * Fuzzy match: check if str1 matches str2 within threshold
   * @param {string} str1
   * @param {string} str2
   * @param {number} threshold - Similarity threshold (0-1), default 0.8
   * @returns {boolean}
   */
  static fuzzyMatch(str1, str2, threshold = 0.8) {
    return this.similarity(str1, str2) >= threshold;
  }

  /**
   * Check if text contains keyword (case-insensitive)
   * @param {string} text
   * @param {string} keyword
   * @returns {boolean}
   */
  static contains(text, keyword) {
    return text.toLowerCase().includes(keyword.toLowerCase());
  }

  /**
   * Check if text contains any of the keywords
   * @param {string} text
   * @param {string[]} keywords
   * @returns {boolean}
   */
  static containsAny(text, keywords) {
    return keywords.some(keyword => this.contains(text, keyword));
  }

  /**
   * Check if text contains all of the keywords
   * @param {string} text
   * @param {string[]} keywords
   * @returns {boolean}
   */
  static containsAll(text, keywords) {
    return keywords.every(keyword => this.contains(text, keyword));
  }

  /**
   * Normalize text for matching (lowercase, trim, remove special chars)
   * @param {string} text
   * @returns {string}
   */
  static normalize(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Extract words from text
   * @param {string} text
   * @returns {string[]}
   */
  static extractWords(text) {
    return this.normalize(text).split(' ').filter(w => w.length > 0);
  }

  /**
   * Find best match from a list of options
   * @param {string} text - Text to match
   * @param {string[]} options - List of possible matches
   * @param {number} threshold - Minimum similarity threshold
   * @returns {{match: string, score: number} | null}
   */
  static findBestMatch(text, options, threshold = 0.6) {
    let bestMatch = null;
    let bestScore = 0;

    for (const option of options) {
      const score = this.similarity(text, option);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestMatch = option;
      }
    }

    return bestMatch ? { match: bestMatch, score: bestScore } : null;
  }

  /**
   * Calculate Jaccard similarity (for word-based matching)
   * @param {string} str1
   * @param {string} str2
   * @returns {number} Similarity score (0-1)
   */
  static jaccardSimilarity(str1, str2) {
    const words1 = new Set(this.extractWords(str1));
    const words2 = new Set(this.extractWords(str2));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }
}
