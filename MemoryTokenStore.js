class MemoryTokenStore {
  constructor() {
    this._store = new Map();
  }

  get(canvasId) {
    return Promise.resolve(this._store.get(canvasId));
  }

  set(canvasId, refreshToken) {
    this._store.set(canvasId, refreshToken);
    return Promise.resolve();
  }
}

module.exports = MemoryTokenStore;
