const CACCLError = require('../caccl-error/index.js'); // TODO: switch to actual library
const MemoryTokenStore = require('./MemoryTokenStore.js');
const errorCodes = require('./errorCodes.js');
const sendRequest = require('./sendRequest.js');

function genExpiryTimestamp() {
  return new Date(new Date().getTime() + 3540000);
}

module.exports = {
  init: (options) => {
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

    // Initialize the default authorized redirect path
    const defaultAuthorizedRedirect = (
      options.defaultAuthorizedRedirect || authorizePath + '/done'
    );

    // Initialize token store
    if (options.tokenStore === null) {
      // Null specifically included, do not use a token store
      this.tokenStore = null;
    } else if (options.tokenStore === undefined) {
      // No token store included, use memory store
      this.tokenStore = new MemoryTokenStore();
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
      this.tokenStore = options.tokenStore;
    }

    /*------------------------------------------------------------------------*/
    /*              Step 1: Redirect user to authorization screen             */
    /*------------------------------------------------------------------------*/

    function genAuthorizeURL(host, nextPath) {
      return 'https://' + options.canvasHost + '/login/oauth2/auth?client_id=' + options.developerCredentials.client_id + '&response_type=code&redirect_uri=https://' + host + authorizePath + '/responded?state=' + nextPath;
    }

    // Authorize when visiting the authorization path
    options.app.get(authorizePath, (req, res) => {
      // Step 1: redirect user to authorization screen
      const nextPath = req.query.next || defaultAuthorizedRedirect;
      return res.redirect(genAuthorizeURL(req.headers.host, nextPath));
    });
    options.app.post(authorizePath, (req, res) => {
      // Step 1: redirect user to authorization screen
      const nextPath = req.body.next || defaultAuthorizedRedirect;
      return res.redirect(genAuthorizeURL(req.headers.host, nextPath));
    });

    /*------------------------------------------------------------------------*/
    /*                     Step 2: Receive code or denial                     */
    /*------------------------------------------------------------------------*/

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

      // TODO: automatically look up in session and then token store for refresh token, refresh if possible and skip authorization process if possible
      // TODO: turn module back into class and use tokenStore to retrieve refreshToken if not in the session


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
          const expiry = genExpiryTimestamp();

          // Yes, save in session
          req.session.accessToken = accessToken;
          req.session.accessTokenExpiry = expiry;
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
          if (this.tokenStore) {
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
                return this.tokenStore.set(canvasId, tokens.refreshToken);
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
  },

  refresh: (req) => {
    const refreshToken = req.refreshToken;
    if (!refreshToken) {
      // Cannot refresh without a refresh token
      return null;
    }


  },
};
