/**
 * Logger Utility
 * Centralized logging for JobAssist extension
 */

class Logger {
  constructor(prefix = '[JobAssist]') {
    this.prefix = prefix;
    this.enabled = true;
    this.logLevel = 'info'; // 'debug', 'info', 'warn', 'error'
  }

  /**
   * Set log level
   * @param {string} level - 'debug', 'info', 'warn', 'error'
   */
  setLevel(level) {
    this.logLevel = level;
  }

  /**
   * Enable/disable logging
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Debug level logging
   */
  debug(...args) {
    if (this.enabled && this._shouldLog('debug')) {
      console.log(`${this.prefix} [DEBUG]`, ...args);
    }
  }

  /**
   * Info level logging
   */
  info(...args) {
    if (this.enabled && this._shouldLog('info')) {
      console.log(`${this.prefix} [INFO]`, ...args);
    }
  }

  /**
   * Warning level logging
   */
  warn(...args) {
    if (this.enabled && this._shouldLog('warn')) {
      console.warn(`${this.prefix} [WARN]`, ...args);
    }
  }

  /**
   * Error level logging
   */
  error(...args) {
    if (this.enabled && this._shouldLog('error')) {
      console.error(`${this.prefix} [ERROR]`, ...args);
    }
  }

  /**
   * Check if current level should be logged
   */
  _shouldLog(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }
}

// Export singleton instance
const logger = new Logger();
