import express from 'express';
import TokenStore from './shared/types/TokenStore.js';
import DeveloperCredentials from './shared/types/DeveloperCredentials';
declare let tokenStore: TokenStore;
declare let developerCredentials: DeveloperCredentials;
/**
 * Initializes the token manager on the given express app
 * @author Gabriel Abrams
 * @param {object} opts object containing all arguments
 * @param {object} opts.app - express app
 * @param {DeveloperCredentials} opts.developerCredentials canvas app developer
 *   credentials map
 * @param {TokenStore} [opts.tokenStore=memory token store] - exclude parameter to
 *   use memory token store,
 *   or include a custom token store of form { get(key), set(key, val) } where
 *   both functions return promises
 * @param {object[]} [opts.scopes] list of scope strings
 *   (e.g. url:GET|/api/v1/courses). These scopes will be included
 *   in all authorization requests
 */
declare const initAuth: (opts: {
    app: express.Application;
    developerCredentials: DeveloperCredentials;
    canvasHost?: string;
    tokenStore?: TokenStore;
    autoReauthPaths?: string[];
    scopes?: string[];
}) => void;
/**
 * Get the user's current access token
 * @author Gabe Abrams
 * @async
 * @param {express.Request} req express request instance
 * @returns {Promise<string>} user's current access token
 */
declare const getAccessToken: (req: express.Request) => Promise<string>;
export default initAuth;
export { getAccessToken };
