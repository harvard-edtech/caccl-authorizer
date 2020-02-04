class MemoryTokenStore {
  constructor() {
    this._store = new Map();
  }

  /**
   * Get the tokens for a user
   * @param {number} canvasId - the canvasId for the user to look up
   * @return {object} token object in the following form:
   *   { refreshToken, accessToken, accessTokenExpiry } where refreshToken and
   *   accessToken are string tokens and accessTokenExpiry is a ms since epoch
   *   expiry timestamp for the accessToken. The refreshToken is assumed to not
   *   expire OR returns {} if no entry yet.
   */
  async get(canvasId) {
    return this._store.get(canvasId) || {};
  }

  /**
   * Store tokens for a user
   * @param {number} canvasId - the canvasId for the user to store tokens for
   * @param {object} tokens - an object containing all token info to update
   * @param {string} [tokens.refreshToken] - if included, updates the user's
   *   current value for their refreshToken
   * @param {string} [tokens.accessToken] - if included, updates the user's
   *   current value for their accessToken
   * @param {number} [tokens.accessTokenExpiry] - if included, updates the
   *   user's current accessToken expiry
   */
  async set(canvasId, tokens) {
    // First get the user's current info
    const prevTokens = await this.get(canvasId);

    // Merge values
    const newTokens = {
      refreshToken: tokens.refreshToken || prevTokens.refreshToken,
      accessToken: tokens.accessToken || prevTokens.accessToken,
      accessTokenExpiry: (
        tokens.accessTokenExpiry
        || prevTokens.accessTokenExpiry
      ),
    };

    // Store
    this._store.set(canvasId, newTokens);

    // Return resolve
    return Promise.resolve();
  }
}

module.exports = MemoryTokenStore;
