import TokenPack from './TokenPack';
interface TokenStore {
    get: (canvasHost: string, userId: number) => Promise<TokenPack | undefined>;
    set: (canvasHost: string, userId: number, token: TokenPack) => Promise<void>;
}
export default TokenStore;
