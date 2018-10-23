class MemoryTokenStore {
  constructor() {
    this._store = {};
  }

  get(canvasId) {
    return Promise.resolve(this._store[canvasId]);
  }

  set(canvasId, refreshToken) {
    this._store[canvasId] = refreshToken;
    return Promise.resolve();
  }
}

module.exports = MemoryTokenStore;
