const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const API = require('caccl-api');
const getScopes = require('caccl-api/getScopes');
const CACCLError = require('caccl-error');
const sendRequest = require('caccl-send-request');
const parseLaunch = require('caccl-lti/parseLaunch');

const MemoryTokenStore = require('./MemoryTokenStore.js');
const errorCodes = require('./errorCodes.js');
const genLTILaunch = require('./genLTILaunch.js');

// EJS template for course chooser
const courseChooserTemplate = ejs.compile(
  fs.readFileSync(
    path.join(__dirname, '/courseChooser.ejs'),
    'utf-8'
  )
);

const FIVE_MINS_MS = 300000;

/**
 * Creates the HTML for a course chooser page
 * @author Gabriel Abrams
 * @param {object} courses - the list of Canvas course objects to render
 * @return html of a course chooser page
 */
const renderCourseChooser = (options) => {
  const {
    res,
    launchPath,
    courses,
    nextPath,
  } = options;

  return res.send(
    courseChooserTemplate({
      launchPath,
      courses,
      nextPath,
    })
  );
};

/**
 * Saves authorizations status to session
 */
// Create a function that saves success/failure and reason
const saveAndContinue = (opts) => {
  const {
    req,
    res,
    nextPath,
    failureReason,
  } = opts;

  const success = !failureReason;
  // Update the session
  req.session.authorized = success;
  req.session.authFailed = !success;
  req.session.authFailureReason = failureReason;
  // Save the session
  req.session.save((err) => {
    // If an error occurred, we cannot continue
    if (err) {
      return res.send('Oops! An error occurred while saving authorization information. Please try launching the app again. If this issue continues, contact an admin.');
    }
    // Session save was a success! Continue
    return res.redirect(nextPath);
  });
};

/**
 * Initializes the token manager on the given express app
 * @author Gabriel Abrams
 * @param {object} app - express app
 * @param {object} developerCredentials - canvas app developer credentials in
 *   the form { client_id, client_secret }
 * @param {string} [canvasHost=canvas.instructure.com] - canvas host to use for
 *   oauth exchange
 * @param {string} [appName=this app] - the name of the current app
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
 * @param {function} [onLogin] - a function to call with params (req, res)
 *   after req.logInManually is called and finishes manually logging in
 * @param {boolean} [allowAuthorizationWithoutLaunch] - if true, allows user to
 *   be authorized even without a launch (when no LTI launch occurred and
 *   simulateLaunchOnAuthorize is false)
 * @param {boolean} [simulateLaunchOnAuthorize] - if truthy, simulates an LTI
 *   launch upon successful authorization (if the user hasn't already launched
 *   via LTI), essentially allowing users to either launch via LTI or launch
 *   the tool by visiting launchPath (GET). If falsy, when a user visits
 *   launchPath and has not launched via LTI, they will be given an error
 * @param {object[]} [scopes] - list of caccl-api functions
 *   (e.g. api.course.listStudents), caccl-api endpoint categories
 *   (e.g. api.course), or scope strings (e.g. url:GET|/api/v1/courses). You
 *   may mix and match any of the types above. These scopes will be included
 *   in all authorization requests
 */
module.exports = (config) => {
  // Check if required config are included
  if (
    !config
    || !config.app
    || !config.developerCredentials
  ) {
    throw new CACCLError({
      message: 'Token manager initialized improperly: at least one required option was not included. We require app, developerCredentials',
      code: errorCodes.requiredOptionExcluded,
    });
  }

  // App name
  const appName = config.appName || 'this app';

  // Initialize canvasHost
  const canvasHost = config.canvasHost || 'canvas.instructure.com';

  // Initialize launchPath
  const launchPath = config.launchPath || '/launch';

  // Initialize autoRefreshRoutes
  const autoRefreshRoutes = (
    config.autoRefreshRoutes === null
      ? []
      : config.autoRefreshRoutes || ['*']
  );

  // Initialize scopes
  let scopeAuthPageQueryAddon = '';
  let scopesParam;
  if (config.scopes) {
    const scopeLists = config.scopes.map((scope) => {
      return getScopes(scope);
    });
    const scopes = [].concat(...scopeLists);
    const scopeString = scopes.join(' ');
    scopeAuthPageQueryAddon = `&scopes=${encodeURIComponent(scopeString)}`;
    scopesParam = scopes;
  }

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
    // Validate its functionality:
    // Make sure get/set functions were included
    if (!config.tokenStore.get || !config.tokenStore.set) {
      throw new CACCLError({
        message: 'Token manager initialized improperly: your custom token store is invalid. It must include a get and a set function.',
        code: errorCodes.tokenStoreInvalidWrongFunctions,
      });
    }
    // Make sure get/set are functions
    if (
      !(config.tokenStore.get instanceof Function)
      || !(config.tokenStore.set instanceof Function)
    ) {
      throw new CACCLError({
        message: 'Token manager initialized improperly: your custom token store is invalid. The token store\'s get and set properties must be functions.',
        code: errorCodes.tokenStoreInvalidNotFunctions,
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
      host: canvasHost,
      path: '/login/oauth2/token',
      method: 'POST',
      params: {
        scopesParam,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.developerCredentials.client_id,
        client_secret: config.developerCredentials.client_secret,
      },
    })
      .then((response) => {
        // Parse to get token
        const { body } = response;
        const accessToken = body.access_token;
        const expiresIn = (body.expires_in * 1000);
        const accessTokenExpiry = Date.now() + expiresIn;
        // Save credentials
        return req.logInManually(accessToken, refreshToken, accessTokenExpiry);
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
      if (config.onLogin) {
        config.onLogin(req, res);
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
  /*                          Token Refresh Process                         */
  /*------------------------------------------------------------------------*/

  autoRefreshRoutes.forEach((autoRefreshRoute) => {
    // Add middleware to automatically refresh the access token upon expiry
    config.app.use(autoRefreshRoute, (req, res, next) => {
      // Check if we have a token
      if (
        !req.session
        || !req.session.accessToken
        || !req.session.refreshToken
      ) {
        // No token. Nothing to refresh
        return next();
      }

      // Check if token has expired
      if (
        req.session.accessTokenExpiry
        && Date.now() < req.session.accessTokenExpiry - FIVE_MINS_MS
      ) {
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

  /*------------------------------------------------------------------------*/
  /*                          Authorization Process                         */
  /*------------------------------------------------------------------------*/

  // Step 1: Try to refresh, if not possible, redirect to authorization screen
  config.app.get(launchPath, (req, res, next) => {
    if (!req.session) {
      // No session! Cannot authorize without session
      return res.status(403).send('Internal error: cannot authorize without express-session initialized on the app.');
    }

    // Skip if not step 1
    if (req.query.code && req.query.state) {
      return next();
    }

    // Skip if choosing course
    if (req.query.course) {
      return next();
    }

    // Only allow auth if LTI launch occurred or we're allowed to simulate
    // LTI launches
    const launchOccurred = (
      req.session
      && req.session.launchInfo
      && Object.keys(req.session.launchInfo).length > 0
    );
    if (
      !launchOccurred
      && !config.simulateLaunchOnAuthorize
      && !config.allowAuthorizationWithoutLaunch
    ) {
      // Cannot authorize
      return res.status(403).send(`Please launch ${appName} via Canvas.`);
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
        return refreshAuthorization(req, refreshToken);
      })
      .then((refreshSuccessful) => {
        if (refreshSuccessful) {
          // Refresh succeeded! Save status and redirect to homepage
          return saveAndContinue({
            req,
            res,
            nextPath,
          });
        }
        // Refresh failed. Redirect to start authorization process
        const authURL = `https://${canvasHost}/login/oauth2/auth?client_id=${config.developerCredentials.client_id}&response_type=code&redirect_uri=https://${req.hostname}${launchPath}&state=${nextPath}${scopeAuthPageQueryAddon}`;
        return res.redirect(authURL);
      });
  });

  // Step 2: Receive code or denial
  config.app.get(launchPath, (req, res, next) => {
    // Skip unless we have a code OR error and a state
    if (
      !req.query
      || !req.query.state
      || (!req.query.code && !req.query.error)
    ) {
      return next();
    }

    // Skip if choosing a course
    if (req.query.course) {
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
      // Canvas responded weirdly. Save status and redirect to homepage
      return saveAndContinue({
        req,
        res,
        nextPath,
        failureReason: 'error',
      });
    }

    // Check if we encountered an internal error
    if (!code && (error && error === 'unsupported_response_type')) {
      // Save status and redirect to homepage
      return saveAndContinue({
        req,
        res,
        nextPath,
        failureReason: 'internal_error',
      });
    }

    // Check if access was denied
    if (!code) {
      // Access was denied! Save status and redirect to homepage
      return saveAndContinue({
        req,
        res,
        nextPath,
        failureReason: 'denied',
      });
    }

    // Attempt to trade access token for actual access token
    let launchUserId;
    let accessToken;
    sendRequest({
      host: canvasHost,
      path: '/login/oauth2/token',
      method: 'POST',
      params: {
        code,
        scopesParam,
        grant_type: 'authorization_code',
        client_id: config.developerCredentials.client_id,
        client_secret: config.developerCredentials.client_secret,
        redirect_uri: `https://${req.hostname}${launchPath}`,
      },
      ignoreSSLIssues: canvasHost.startsWith('localhost'),
    })
      .then((response) => {
        const { body } = response;

        // Detect invalid client_secret error
        if (body.error && body.error === 'invalid_client') {
          // Save status and redirect to homepage
          saveAndContinue({
            req,
            res,
            nextPath,
            failureReason: 'invalid_client',
          });
          throw new Error('break');
        }

        // Extract token
        accessToken = body.access_token;
        const refreshToken = body.refresh_token;
        const expiresInMs = (body.expires_in * 0.99 * 1000);
        const accessTokenExpiry = Date.now() + expiresInMs;

        // Extract user info
        launchUserId = body.user.id;

        // Store in token store:
        // - if we have a token store
        // - if not: simulating a launch while we already have the user's
        //   refresh token
        if (tokenStore) {
          if (config.simulateLaunchOnAuthorize && !req.session.launchInfo) {
            // Simulating a launch. Check if we already have the user's
            // refresh token. If we do, try to refresh using that refresh token.
            // If that works, don't save this access token. Just
            // use it to kill the current authorization login (the one we used
            // to identify the user) and then perform a refresh using the saved
            // token. If that doesn't work, overwrite the old refresh token with
            // our new one.

            // Lookup user's refresh token
            return tokenStore.get(launchUserId)
              .then((storedRefreshToken) => {
                if (!storedRefreshToken) {
                  // No refresh token
                  return Promise.resolve(false);
                }
                // Attempt to refresh
                return refreshAuthorization(req, refreshToken);
              })
              .then((refreshSuccessful) => {
                if (refreshSuccessful) {
                  // Kill the current authorization (the one we used to identify
                  // the user)

                } else {
                  // Refresh failed
                  // - Save current tokens
                  // - Login using these tokens
                  return tokenStore.set(launchUserId, refreshToken)
                    .then(() => {
                      // Save in session
                      return req.logInManually(
                        accessToken,
                        refreshToken,
                        accessTokenExpiry
                      );
                    });
                }
              });
          }

          // Not simulating a launch. Just save the refresh token and log in
          return tokenStore.set(launchUserId, refreshToken)
            .then(() => {
              return req.logInManually(
                accessToken,
                refreshToken,
                accessTokenExpiry
              );
            });
        }

        // Nothing to save or look up. Just log in and continue
        return req.logInManually(
          accessToken,
          refreshToken,
          accessTokenExpiry
        );
      })
      .then(() => {
        // If simulating a launch, do that now
        if (config.simulateLaunchOnAuthorize && !req.session.launchInfo) {
          // Get API
          const api = new API({
            accessToken,
            canvasHost,
            cacheType: null,
          });

          // Pull list of courses, ask user to choose a course
          return api.user.self.listCourses({ includeTerm: true })
            .then((courses) => {
              return renderCourseChooser({
                res,
                launchPath,
                courses,
                nextPath,
              });
            });
        }

        // Not simulating a launch. We're done authorizing.
        // Save status and redirect to homepage
        return saveAndContinue({
          req,
          res,
          nextPath,
        });
      })
      .catch((err) => {
        if (err.message === 'break') {
          return;
        }
        // Save status and redirect to homepage
        return saveAndContinue({
          req,
          res,
          nextPath,
          failureReason: 'error',
        });
      });
  });

  // Step 3: Choose course (only required for simulated launch)
  config.app.get(launchPath, (req, res, next) => {
    if (
      !req.query.course
      || !req.session
      || !req.session.accessToken
    ) {
      return next();
    }

    const courseId = req.query.course;
    const nextPath = (req.query.next || defaultAuthorizedRedirect);

    // Create API
    const api = new API({
      canvasHost,
      accessToken: req.session.accessToken,
      cacheType: null,
    });

    // Simulate the launch

    // Get the course information
    Promise.all([
      api.course.get({ courseId }),
      api.user.self.getProfile(),
    ])
      .then(([course, profile]) => {
        // Create a simulated launch
        const simulatedLTILaunchBody = genLTILaunch({
          course,
          profile,
          appName,
          canvasHost,
        });

        // Parse and save the simulated launch
        return parseLaunch(simulatedLTILaunchBody, req);
      })
      .then(() => {
        // Simulated launch saved

        // Save status and redirect to homepage
        return saveAndContinue({
          req,
          res,
          nextPath,
        });
      })
      .catch((err) => {
        return res.status(500).send(`Oops! We encountered an error while launching ${appName}. Try starting over. If this error happens again, contact an admin. Error: ${err.message}`);
      });
  });

  // We use middleware to handle authorization. If we get to this handler, an
  // error has occurred
  config.app.get(launchPath, (req, res) => {
    return res.status(500).send(`Oops! Something went wrong during authorization. Please re-launch ${appName}.`);
  });
};
