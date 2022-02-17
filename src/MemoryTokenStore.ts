import TokenPack from './shared/types/TokenPack';
import TokenStore from './shared/types/TokenStore';

class MemoryTokenStore implements TokenStore {
  private store: Map<string, Map<number, TokenPack>>;

  /**
   * Create a new memory token store
   * @author Gabe Abrams
   */
  constructor() {
    this.store = new Map<string, Map<number, TokenPack>>();
  }

  /**
   * Get the tokens for a user
   * @author Gabe Abrams
   * @param canvasHost the hostname for the associated canvas host
   * @param userId the canvasId for the user to look up
   * @returns token pack or undefined if not found
   */
  async get(
    canvasHost: string,
    userId: number,
  ): Promise<TokenPack | undefined> {
    // Look up by host
    const hostStore = this.store.get(canvasHost);
    if (!hostStore) {
      return undefined;
    }

    // Look up by id
    return (hostStore.get(userId) || undefined);
  }

  /**
   * Store tokens for a user
   * @author Gabe Abrams
   * @param canvasHost host name of associated Canvas instance
   * @param userId the canvasId for the user to store tokens for
   * @param tokenPack an object containing all token info to update
   */
  async set(canvasHost: string, userId: number, tokenPack: TokenPack) {
    // Get host map
    let hostStore = this.store.get(canvasHost);
    if (!hostStore) {
      hostStore = new Map<number, TokenPack>();
      this.store.set(canvasHost, hostStore);
    }

    // Store tokenPack
    hostStore.set(userId, tokenPack);
  }
}

export default MemoryTokenStore;
