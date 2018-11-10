const CACCLError = require('../caccl-error/index.js'); // TODO: switch to actual library
const MemoryTokenStore = require('./MemoryTokenStore.js');
const errorCodes = require('./errorCodes.js');
const sendRequest = require('./sendRequest.js');

/**
 * Initializes the token manager on the given express app
 * @author Gabriel Abrams
 * @param {object} app - express app
 * @param {string} canvasHost - canvas host to use for oauth exchange
 * @param {object} developerCredentials - canvas app developer credentials in
 *   the form { client_id, client_secret }
 * @param {string} [launchPath=/launch] - the route to add to the express
 *   app (when a user visits this route, we will attempt to refresh their token
 *   and if we can't, we will prompt them to authorize the tool). We listen on
 *   GET
 * @param {string} [defaultAuthorizedRedirect='/'] - the
 *   default route to visit after authorization is complete (you can override
 *   this value for a specific authorization call by including query.next or
 *   body.next, a path/url to visit after completion)
 * @param {array.<string>} [autoRefreshRoutes=['*']] - the list of routes to
 *   automatically refresh the access token for (if the access token has
 *   expired)
 * @param {object|null} [tokenStore=memory token store] - null to turn off
 *   storage of refresh tokens, exclude parameter to use memory token store,
 *   or include a custom token store of form { get(key), set(key, val) } where
 *   both functions return promises
 * @param {function} [onManualLogin] - a function to call with params (req, res)
 *   after req.logInManually is called and finishes manually logging in
 */
module.exports = (config) => {
  // Check if required config are included
  if (
    !config
    || !config.app
    || !config.canvasHost
    || !config.developerCredentials
  ) {
    throw new CACCLError({
      message: 'Token manager initialized improperly: at least one required option was not included. We require app, canvasHost, developerCredentials',
      code: errorCodes.requiredOptionExcluded,
    });
  }

  // Initialize launchPath
  const launchPath = config.launchPath || '/launch';

  // Initialize autoRefreshRoutes
  const autoRefreshRoutes = config.autoRefreshRoutes || ['*'];

  // Initialize the default authorized redirect path
  const defaultAuthorizedRedirect = config.defaultAuthorizedRedirect || '/';

  // Initialize token store
  let tokenStore;
  if (config.tokenStore === null) {
    // Null specifically included, do not use a token store
    tokenStore = null;
  } else if (config.tokenStore === undefined) {
    // No token store included, use memory store
    tokenStore = new MemoryTokenStore();
  } else {
    // Custom token store included
    // Validate its functionality
    if (!config.tokenStore.get || !config.tokenStore.set) {
      throw new CACCLError({
        message: 'Token manager initialized improperly: your custom token store is invalid. It must include a get and a set function.',
        code: errorCodes.tokenStoreInvalidWrongFunctions,
      });
    }
    // Custom token store valid
    ({ tokenStore } = config.tokenStore);
  }

  // Create refresh function
  const refreshAuthorization = (req, refreshToken) => {
    if (
      !refreshToken
      || !req
      || !req.session
    ) {
      // No refresh token or no session to save to, resolve with false
      return Promise.resolve(false);
    }
    return sendRequest({
      host: config.canvasHost,
      path: '/login/oauth2/token',
      method: 'POST',
      params: {
        grant_type: 'refresh_token',
        client_id: config.developerCredentials.client_id,
        client_secret: config.developerCredentials.client_secret,
        refresh_token: refreshToken,
      },
    })
      .then((response) => {
        // Parse to get token
        const body = JSON.parse(response.text);
        const accessToken = body.access_token;
        const accessTokenExpiry = new Date().getTime() + 3540000;
        // Save credentials
        req.session.accessToken = accessToken;
        req.session.accessTokenExpiry = accessTokenExpiry;
        req.session.refreshToken = refreshToken;
        return new Promise((resolve) => {
          req.session.save((err) => {
            if (err) {
              // An error occurred. Resolve with false
              return resolve(false);
            }
            // Success! Resolve with true
            return resolve(true);
          });
        });
      })
      .catch(() => {
        // An error occurred. Resolve with false
        return Promise.resolve(false);
      });
  };

  /*------------------------------------------------------------------------*/
  /*                      Manual Authorization Process                      */
  /*------------------------------------------------------------------------*/

  config.app.use((req, res, next) => {
    req.logInManually = (accessToken, refreshToken, expiry) => {
      // Save in session
      req.session.accessToken = accessToken;
      req.session.accessTokenExpiry = expiry;
      req.session.refreshToken = refreshToken;

      // Send callback
      if (config.onManualLogin) {
        config.onManualLogin(req, res);
      }

      // Save session
      return new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            return reject(err);
          }
          return resolve({
            accessToken,
            refreshToken,
          });
        });
      });
    };

    next();
  });

  /*------------------------------------------------------------------------*/
  /*                          Authorization Process                         */
  /*------------------------------------------------------------------------*/

  // Step 1: Try to refresh, if not possible, redirect to authorization screen

  config.app.use(launchPath, (req, res, next) => {
    // Skip if not GET
    if (req.method !== 'GET') {
      return next();
    }

    // Skip if not step 1
    if (req.query.code && req.query.state) {
      return next();
    }

    // Extract the next path
    const nextPath = (
      req.query.next
      || req.body.next
      || defaultAuthorizedRedirect
    );

    // Look for a refresh token
    let getRefreshTokenPromise;
    if (req.session && req.session.refreshToken) {
      // Refresh token is in session
      getRefreshTokenPromise = Promise.resolve(req.session.refreshToken);
    } else if (
      tokenStore
      && req.session
      && req.session.currentUserCanvasId
    ) {
      // Look for refresh token in the token store
      getRefreshTokenPromise = tokenStore.get(req.session.currentUserCanvasId);
    } else {
      // Can't refresh! Return null to jump to authorization
      getRefreshTokenPromise = Promise.resolve(null);
    }
    // Use refresh token to refresh, or jump to auth if no refresh token
    return getRefreshTokenPromise
      .then((refreshToken) => {
        // Attempt to refresh
        return refreshAuthorization(refreshToken);
      })
      .then((refreshSuccessful) => {
        if (refreshSuccessful) {
          // Refresh succeeded! Redirect to next path
          return res.redirect(nextPath);
        }
        // Refresh failed. Redirect to start authorization process
        const authURL = 'https://' + config.canvasHost + '/login/oauth2/auth?client_id=' + config.developerCredentials.client_id + '&response_type=code&redirect_uri=https://' + req.headers.host + launchPath + '&state=' + nextPath;
        return res.redirect(authURL);
      });
  });

  // Step 2: Receive code or denial
  config.app.use(launchPath, (req, res, next) => {
    // Skip unless we have a code OR error and a state
    if (
      !req.query
      || !req.query.state
      || (!req.query.code && !req.query.error)
    ) {
      return next();
    }

    // Parse the response
    const nextPath = req.query.state;
    const { code, error } = req.query;

    // Check for invalid Canvas response
    if (
      nextPath
      && !code
      && !error
    ) {
      // Canvas responded weirdly
      return res.redirect(nextPath + '?success=false&reason=error');
    }

    // Check if access was denied
    if (!code || (error && error === 'access_denied')) {
      // Access was denied! Redirect with success=false and message
      return res.redirect(nextPath + '?success=false&reason=denied');
    }

    // Attempt to trade access token for actual access token
    let launchUserId;
    sendRequest({
      host: config.canvasHost,
      path: '/login/oauth2/token',
      method: 'POST',
      params: {
        code,
        client_id: config.developerCredentials.client_id,
        client_secret: config.developerCredentials.client_secret,
        redirect_uri: 'https://' + req.headers.host + launchPath,
      },
    })
      .then((response) => {
        const { body } = response;

        // Extract token
        const accessToken = body.access_token;
        const refreshToken = body.refresh_token;
        const expiresInMs = (body.expires_in * 0.99 * 1000);
        const accessTokenExpiry = new Date().getTime() + expiresInMs;

        // Extract user info
        launchUserId = body.user.id;

        // Save in session
        return req.logInManually(
          accessToken,
          refreshToken,
          accessTokenExpiry
        );
      })
      .then((tokens) => {
        // Store in token store (if applicable)
        if (tokenStore) {
          return tokenStore.set(launchUserId, tokens.refreshToken);
        }
        // Nothing to save. Just continue
        return Promise.resolve();
      })
      .then(() => {
        return res.redirect(nextPath + '?success=true');
      })
      .catch(() => {
        return res.redirect(nextPath + '?success=false&reason=error');
      });
  });

  // We use middleware to handle authorization. If we get to the actual route,
  // we've failed
  config.app.get(launchPath, (req, res) => {
    return res.status(500).send('Oops! Something went wrong during authorization. Please re-launch this app.');
  });

  /*------------------------------------------------------------------------*/
  /*                          Token Refresh Process                         */
  /*------------------------------------------------------------------------*/

  autoRefreshRoutes.forEach((autoRefreshRoute) => {
    // Add middleware to automatically refresh the access token upon expiry
    config.app.use(autoRefreshRoute, (req, res, next) => {
      // Check if we have a token
      if (
        !req.session
        || !req.session.accessToken
        || !req.session.accessTokenExpiry
        || !req.session.refreshToken
      ) {
        // No token. Nothing to refresh
        return next();
      }

      // Check if token has expired
      if (new Date().getTime() < req.session.accessTokenExpiry) {
        // Not expired yet. Don't need to refresh
        return next();
      }

      // Refresh the token
      refreshAuthorization(req, req.session.refreshToken)
        .then((refreshSuccessful) => {
          if (refreshSuccessful) {
            return next();
          }
          throw new Error();
        })
        .catch(() => {
          return res.status(500).send('Internal server error: your Canvas authorization has expired and we could not refresh your credentials.');
        });
    });
  });
};
