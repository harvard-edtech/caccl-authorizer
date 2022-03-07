import express from 'express';
import InitCACCLStore from 'caccl-memory-store/lib/InitCACCLStore';
import DeveloperCredentials from './shared/types/DeveloperCredentials';
declare let developerCredentials: DeveloperCredentials;
/**
 * Initializes the token manager on the given express app
 * @author Gabriel Abrams
 * @param {object} opts object containing all arguments
 * @param {object} opts.app - express app
 * @param {DeveloperCredentials} opts.developerCredentials canvas app developer
 *   credentials map
 * @param {InitCACCLStore} [opts.initTokenStore=memory store factory] a function
 *   that creates a store for keeping track of user's API tokens and auth status
 * @param {string[]} [opts.scopes] list of scope strings
 *   (e.g. url:GET|/api/v1/courses). These scopes will be included
 *   in all authorization requests
 */
declare const initAuth: (opts: {
    app: express.Application;
    developerCredentials: DeveloperCredentials;
    initTokenStore?: InitCACCLStore;
    scopes?: string[];
}) => Promise<void>;
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
