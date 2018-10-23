const CACCLError = require('../caccl-error/index.js'); // TODO: switch to actual library
const MemoryTokenStore = require('./MemoryTokenStore.js');
const errorCodes = require('./errorCodes.js');
const sendRequest = require('./sendRequest.js');

module.exports = (options) => {
  // Check if required options are included
  if (
    !options
    || !options.app
    || !options.canvasHost
    || !options.developerCredentials
  ) {
    throw new CACCLError({
      message: 'Token manager initialized improperly: at least one required option was not included. We require app, canvasHost, developerCredentials',
      code: errorCodes.requiredOptionExcluded,
    });
  }

  // Initialize authorizePath
  const authorizePath = options.authorizePath || '/authorize';

  // Initialize autoRefreshRoutes
  const autoRefreshRoutes = options.autoRefreshRoutes || ['*'];

  // Initialize the default authorized redirect path
  const defaultAuthorizedRedirect = (
    options.defaultAuthorizedRedirect || authorizePath + '/done'
  );

  // Initialize token store
  let tokenStore;
  if (options.tokenStore === null) {
    // Null specifically included, do not use a token store
    tokenStore = null;
  } else if (options.tokenStore === undefined) {
    // No token store included, use memory store
    tokenStore = new MemoryTokenStore();
  } else {
    // Custom token store included
    // Validate its functionality
    if (!options.tokenStore.get || !options.tokenStore.set) {
      throw new CACCLError({
        message: 'Token manager initialized improperly: your custom token store is invalid. It must include a get and a set function.',
        code: errorCodes.tokenStoreInvalidWrongFunctions,
      });
    }
    // Custom token store valid
    ({ tokenStore } = options.tokenStore);
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
      host: options.canvasHost,
      path: '/login/oauth2/token',
      method: 'POST',
      params: {
        grant_type: 'refresh_token',
        client_id: options.developerCredentials.client_id,
        client_secret: options.developerCredentials.client_secret,
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
  /*                          Authorization Process                         */
  /*------------------------------------------------------------------------*/

  // Step 1: Try to refresh, if not possible, redirect to authorization screen

  options.app.all(authorizePath, (req, res) => {
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
        return res.redirect('https://' + options.canvasHost + '/login/oauth2/auth?client_id=' + options.developerCredentials.client_id + '&response_type=code&redirect_uri=https://' + req.headers.host + authorizePath + '/responded?state=' + nextPath);
      });
  });

  // Step 2: Receive code or denial
  options.app.get(authorizePath + '/responded', (req, res) => {
    // Make sure we have the correct response from Canvas
    if (!req.query.state) {
      // Authorization failed
      return res.send('Oops! Something went wrong during authorization. Please re-launch this app.');
    }

    // Parse the response
    const nextPath = req.query.state;
    const { code, error } = req.query.code;

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
    sendRequest({
      host: options.canvasHost,
      path: '/login/oauth2/token',
      params: {
        code,
        client_id: options.developerCredentials.client_id,
        client_secret: options.developerCredentials.client_secret,
        redirect_uri: 'https://' + req.headers.host + nextPath,
      },
    })
      .then((response) => {
        // Process Canvas' response
        const body = JSON.parse(response.text);

        // Extract token
        const accessToken = body.access_token;
        const refreshToken = body.refresh_token;
        const accessTokenExpiry = new Date().getTime() + 3540000;

        // Save in session
        req.session.accessToken = accessToken;
        req.session.accessTokenExpiry = accessTokenExpiry;
        req.session.refreshToken = refreshToken;
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
      })
      .then((tokens) => {
        // Store in token store (if applicable)
        if (tokenStore) {
          // Lookup current user's Canvas ID, to use as a key in the store
          return sendRequest({
            host: options.canvasHost,
            path: '/api/v1/users/self/profile',
            params: {
              access_token: tokens.accessToken,
            },
          })
            .then((response) => {
              // Store in token store
              const body = JSON.parse(response);
              const canvasId = body.id;
              return tokenStore.set(canvasId, tokens.refreshToken);
            });
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

  /*------------------------------------------------------------------------*/
  /*                          Token Refresh Process                         */
  /*------------------------------------------------------------------------*/

  autoRefreshRoutes.forEach((autoRefreshRoute) => {
    // Add middleware to automatically refresh the access token upon expiry
    options.app.use(autoRefreshRoute, (req, res, next) => {
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
