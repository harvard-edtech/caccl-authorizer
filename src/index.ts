// Import express
import express from 'express';

// Import CACCL modules
import CACCLError from 'caccl-error';
import sendRequest from 'caccl-send-request';
import { getLaunchInfo } from 'caccl-lti';

// Import token store
import MemoryTokenStore from './MemoryTokenStore.js';

// Import shared types
import ErrorCode from './shared/types/ErrorCode.js';
import TokenStore from './shared/types/TokenStore.js';
import DeveloperCredentials from './shared/types/DeveloperCredentials';
import TokenPack from './shared/types/TokenPack.js';

// Import shared constants
import CACCL_PATHS from './shared/constants/CACCL_PATHS';

// Constants
const FIVE_MINS_MS = 300000;

// Store a copy of the token store
let tokenStore: TokenStore;

// Store a copy of the developer credentials
let developerCredentials: DeveloperCredentials;

/*------------------------------------------------------------------------*/
/*                                 Helpers                                */
/*------------------------------------------------------------------------*/

/**
 * Refresh the user's authorization
 * @author Gabe Abrams
 * @async
 * @returns the new token pack
 */
const refreshAuth = async (
  req: express.Request,
): Promise<TokenPack> => {
  // Make sure caccl has been initialized
  if (!tokenStore || !developerCredentials) {
    throw new CACCLError({
      message: 'We could not extend your Canvas authorization because CACCL Authorizer has not been initialized yet.',
      code: ErrorCode.NotInitialized,
    });
  }

  // Get info on the user's session
  const {
    launched,
    launchInfo,
  } = getLaunchInfo(req);
  if (!launched) {
    throw new CACCLError({
      message: 'We could not extend your Canvas authorization because your session has expired.',
      code: ErrorCode.RefreshFailedDueToSessionExpiry,
    });
  }

  // Get the current user's token pack
  const tokenPack = await tokenStore.get(
    launchInfo.canvasHost,
    launchInfo.userId,
  );
  if (!tokenPack) {
    throw new CACCLError({
      message: 'We could not extend your Canvas authorization because your refresh credentials could not be found.',
      code: ErrorCode.RefreshFailedDueToTokenMissing,
    });
  }

  // Try reauthorization process
  try {
    const { body } = await sendRequest({
      host: launchInfo.canvasHost,
      path: '/login/oauth2/token',
      method: 'POST',
      params: {
        grant_type: 'refresh_token',
        refresh_token: tokenPack.refreshToken,
        client_id: developerCredentials.client_id,
        client_secret: developerCredentials.client_secret,
      },
    });

    // Parse to get new tokenPack
    const expiresIn = (body.expires_in * 0.99 * 1000);
    const newTokenPack = {
      accessToken: body.access_token,
      refreshToken: (body.refresh_token || tokenPack.refreshToken),
      accessTokenExpiry: (Date.now() + expiresIn),
      canvasHost: launchInfo.canvasHost,
    };

    // Save in the store
    await tokenStore.set(
      launchInfo.canvasHost,
      launchInfo.userId,
      newTokenPack,
    );

    // Return new token pack
    return newTokenPack;
  } catch (err) {
    throw new CACCLError({
      message: 'Your Canvas session could not be extended. Please contact support.',
      code: ErrorCode.RefreshFailed,
    });
  }
};

/*------------------------------------------------------------------------*/
/*                           Main Functionality                           */
/*------------------------------------------------------------------------*/

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
const initAuth = (
  opts: {
    app: express.Application,
    developerCredentials: DeveloperCredentials,
    canvasHost?: string,
    tokenStore?: TokenStore,
    autoReauthPaths?: string[],
    scopes?: string[],
  },
) => {
  // Check if required opts are included
  if (
    !opts
    || !opts.app
    || !opts.developerCredentials
  ) {
    throw new CACCLError({
      message: 'Token manager initialized improperly: at least one required option was not included. We require app, developerCredentials',
      code: ErrorCode.RequiredOptionExcluded,
    });
  }

  // Make sure init isn't called more than once
  if (tokenStore || developerCredentials) {
    throw new CACCLError({
      message: 'CACCL Authorizer cannot be initialized more than one.',
      code: ErrorCode.InitializedMoreThanOnce,
    });
  }

  // Initialize scopes
  const scopesQueryAddon = (
    opts.scopes
      ? `&scopes=${encodeURIComponent(opts.scopes.join(' '))}`
      : undefined
  );

  // Initialize token store
  tokenStore = (
    opts.tokenStore
      ? opts.tokenStore
      : new MemoryTokenStore()
  );

  // Save copy of credentials
  developerCredentials = opts.developerCredentials;

  /*------------------------------------------------------------------------*/
  /*                          Authorization Process                         */
  /*------------------------------------------------------------------------*/

  // Step 0: Intercept errors
  opts.app.get(
    CACCL_PATHS.AUTHORIZE,
    async (req, res, next) => {
      if (req.query.error || req.query.error_description) {
        const error = (
          String(req.query.error || 'unknown_error')
            .split('_')
            .map((word) => {
              if (word.length <= 1) {
                return word.toUpperCase();
              }
              // Capitalize the word
              return `${word.substring(0, 1).toUpperCase()}${word.substring(1)}`;
            })
            .join(' ')
        );
        const description = decodeURIComponent(String(
          req.query.error_description
          || 'No+further+description+could+be+found.'
        )).replace(/\+/g, ' ');

        return res.status(403).send(`A launch error occurred: ${error}. ${description}`);
      }

      // No error occurred. Continue
      return next();
    },
  );

  // Step 1: Try to refresh, if not possible, redirect to authorization screen
  opts.app.get(
    CACCL_PATHS.AUTHORIZE,
    async (req, res, next) => {
      const {
        launched,
        launchInfo,
      } = getLaunchInfo(req);
      if (!launched) {
        // No session! Cannot authorize without session
        return res.status(403).send('We could not authorize you with Canvas because your session has expired.');
      }

      // Skip if not step 1
      if (req.query.code && req.query.state) {
        return next();
      }

      // Only allow auth if LTI launch occurred
      if (!launched) {
        // Cannot authorize
        return res.status(403).send('Your session has expired. Please launch this app again via Canvas.');
      }

      // Look for a current tokenPack
      const tokenPack = await tokenStore.get(
        launchInfo.canvasHost,
        launchInfo.userId,
      );

      // Try to refresh the current session
      if (tokenPack) {
        // Refresh the token
        try {
          await refreshAuth(req);
        } catch (err) {
          // Refresh failed. Show error to user
          return res.status(403).send('Your Canvas authorization has expired and we could not refresh your credentials.');
        }
      }

      // Refresh failed. Redirect to authorization process
      const authURL = `https://${launchInfo.canvasHost}/login/oauth2/auth?client_id=${opts.developerCredentials.client_id}&response_type=code&redirect_uri=https://${req.hostname}${CACCL_PATHS.AUTHORIZE}&state=caccl${scopesQueryAddon}`;
      return res.redirect(authURL);
    },
  );

  // Step 2: Receive code or denial
  opts.app.get(
    CACCL_PATHS.AUTHORIZE,
    async (req, res, next) => {
      // Skip unless we have a code OR error and state indicates this is CACCL
      if (
        !req.query
        || !req.query.state
        || req.query.state !== 'caccl'
        || (!req.query.code && !req.query.error)
      ) {
        return next();
      }

      // Parse the response
      const { code, error } = req.query;

      // Check for invalid Canvas response
      if (!code && !error) {
        // Canvas responded weirdly
        return res.status(403).send('We could not get your authorization with Canvas because Canvas responded in an unexpected way.');
      }

      // Get session info
      const {
        launched,
        launchInfo,
      } = getLaunchInfo(req);
      if (!launched) {
        // No session
        return res.status(403).send('We could not get your authorization with Canvas because your session has expired.');
      }

      // Check if we encountered an internal error
      if (
        !code
        && error
        && error === 'unsupported_response_type'
      ) {
        return res.status(403).send('We could not get your authorization with Canvas because Canvas would not start the authorization process.');
      }

      // Check if access was denied
      if (!code) {
        // Access was denied
        return res.status(403).send('We could not get your authorization with Canvas because your access was denied. Please contact your Canvas support team.');
      }

      // Get credentials
      const specificCanvasCreds = developerCredentials[launchInfo.canvasHost];
      if (!specificCanvasCreds) {
        // No credentials for this Canvas host
        return res.status(403).send('We could not get your authorization with Canvas because this app is not ready to integrate with your instance of Canvas.');
      }

      // Attempt to trade auth code for actual access token
      let response;
      try {
        response = await sendRequest({
          host: launchInfo.canvasHost,
          path: '/login/oauth2/token',
          method: 'POST',
          params: {
            code,
            grant_type: 'authorization_code',
            client_id: opts.developerCredentials.client_id,
            client_secret: opts.developerCredentials.client_secret,
            redirect_uri: `https://${req.hostname}${CACCL_PATHS.AUTHORIZE}`,
          },
          ignoreSSLIssues: launchInfo.canvasHost.startsWith('localhost'),
        });
      } catch (err) {
        // Could not trade auth code for tokens
        return res.status(403).send('We could not get your authorization with Canvas because Canvas did not respond to our request for tokens.');
      }

      // Parse the response body
      const { body } = response;

      // Detect invalid client_secret error
      if (body.error && body.error === 'invalid_client') {
        // Save status
        return res.status(403).send('We could not get your authorization with Canvas because Canvas would not recognize this app.');
      }

      // Extract token
      const expiresIn = (body.expires_in * 0.99 * 1000);
      const newTokenPack: TokenPack = {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        accessTokenExpiry: (Date.now() + expiresIn),
        canvasHost: launchInfo.canvasHost,
      };

      // Store new pack
      try {
        await tokenStore.set(
          launchInfo.canvasHost,
          launchInfo.userId,
          newTokenPack,
        );
      } catch (err) {
        return res.status(403).send('We could not get your authorization with Canvas because your credentials could not be stored.');
      }

      // We're done authorizing. Redirect to homepage
      return res.redirect(CACCL_PATHS.HOME);
    },
  );
};

/*------------------------------------------------------------------------*/
/*                            Get Access Token                            */
/*------------------------------------------------------------------------*/

/**
 * Get the user's current access token
 * @author Gabe Abrams
 * @async
 * @param {express.Request} req express request instance
 * @returns {Promise<string>} user's current access token
 */
const getAccessToken = async (req: express.Request): Promise<string> => {
  // Get LTI launch status
  const {
    launched,
    launchInfo,
  } = getLaunchInfo(req);

  // Show an error if user has not launched
  if (!launched) {
    throw new CACCLError({
      message: 'We could not find the current user\'s access token because the current user has no session.',
      code: ErrorCode.GetFailedNoSession,
    });
  }

  // Check if we need to refresh
  let tokenPack = await tokenStore.get(
    launchInfo.canvasHost,
    launchInfo.userId,
  );
  if (!tokenPack) {
    // User is not authorized
    throw new CACCLError({
      message: 'We could not find the current user\'s access token because the current user is not authorized.',
      code: ErrorCode.GetFailedNoAuthorization,
    });
  }

  // Refresh if needed
  if (Date.now() >= tokenPack.accessTokenExpiry - FIVE_MINS_MS) {
    // Need to refresh!
    tokenPack = await refreshAuth(req);
  }

  // Return the access token
  return tokenPack.accessToken;
};

/*------------------------------------------------------------------------*/
/*                                 Exports                                */
/*------------------------------------------------------------------------*/

export default initAuth;

export { getAccessToken };
