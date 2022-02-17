import TokenPack from './shared/types/TokenPack';
import TokenStore from './shared/types/TokenStore';
declare class MemoryTokenStore implements TokenStore {
    private store;
    /**
     * Create a new memory token store
     * @author Gabe Abrams
     */
    constructor();
    /**
     * Get the tokens for a user
     * @author Gabe Abrams
     * @param canvasHost the hostname for the associated canvas host
     * @param userId the canvasId for the user to look up
     * @returns token pack or undefined if not found
     */
    get(canvasHost: string, userId: number): Promise<TokenPack | undefined>;
    /**
     * Store tokens for a user
     * @author Gabe Abrams
     * @param canvasHost host name of associated Canvas instance
     * @param userId the canvasId for the user to store tokens for
     * @param tokenPack an object containing all token info to update
     */
    set(canvasHost: string, userId: number, tokenPack: TokenPack): Promise<void>;
}
export default MemoryTokenStore;
