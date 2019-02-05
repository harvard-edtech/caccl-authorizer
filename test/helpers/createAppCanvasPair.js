const initCACCL = require('caccl/script');
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const https = require('https');
const lti = require('ims-lti');
const initCanvasSimulation = require('caccl-canvas-partial-simulator');

const initAuthorizer = require('../..');
const addAppRoutes = require('./addAppRoutes');

/* eslint-disable no-console */

/*------------------------------------------------------------------------*/
/*                          Read dev environment                          */
/*------------------------------------------------------------------------*/

if (!fs.existsSync(path.join(__dirname, '..', 'devEnvironment.js'))) {
  // No dev environment
  console.log('Before running tests, you need to add the following config:');
  console.log('test/devEnvironment.js');
  console.log('See instructions at test/devEnvironment.md');
  process.exit(0);
}

const devEnvironment = require('../devEnvironment');

if (
  !devEnvironment.accessToken
  || !devEnvironment.canvasHost
  || !devEnvironment.courseId
) {
  // devEnvironment not valid
  console.log('Your test/devEnvironment.js config is not complete!');
  console.log('See instructions at test/devEnvironment.md');
  process.exit(0);
}

const {
  accessToken,
  canvasHost,
  courseId,
} = devEnvironment;

/*------------------------------------------------------------------------*/
/*                          Set up lti validator                          */
/*------------------------------------------------------------------------*/

const provider = new lti.Provider('consumer_key', 'consumer_secret');
const isValid = (req) => {
  return new Promise((resolve) => {
    provider.valid_request(req, (err, valid) => {
      resolve(!err && valid);
    });
  });
};


/*------------------------------------------------------------------------*/
/*                     Initialize and create constants                    */
/*------------------------------------------------------------------------*/

// Use self-signed certificates
// cy.log('- Reading in SSL certificates');
const sslKey = path.join(__dirname, 'ssl/key.pem');
const sslCertificate = path.join(__dirname, 'ssl/cert.pem');

// Read in files if they're not already read in
let key;
try {
  key = fs.readFileSync(sslKey, 'utf-8');
} catch (err) {
  key = sslKey;
}
let cert;
try {
  cert = fs.readFileSync(sslCertificate, 'utf-8');
} catch (err) {
  cert = sslCertificate;
}

/*------------------------------------------------------------------------*/
/*                         Fetch data from Canvas                         */
/*------------------------------------------------------------------------*/

let course;
let user;

const api = initCACCL({
  accessToken,
  canvasHost,
});

const fetchCanvasData = Promise.all([
  api.user.self.getProfile(),
  api.course.get({ courseId }),
])
  .then((data) => {
    ([user, course] = data);
  })
  .catch((err) => {
    console.log('Encountered an error while attempting to fetch test data from Canvas: ', err.message);
    process.exit(0);
  });

/*------------------------------------------------------------------------*/
/*                         Save previous instance                         */
/*------------------------------------------------------------------------*/

let canvasServer;
let appServer;

const killServers = () => {
  if (!canvasServer) {
    // No servers to kill
    return;
  }

  canvasServer.close();
  appServer.close();

  canvasServer = null;
  appServer = null;
};

/*------------------------------------------------------------------------*/
/*                       Create app and Canvas pair                       */
/*------------------------------------------------------------------------*/

/**
 * Initializes an app on port 8089 and a partial Canvas simulator on port 8088
 * @param {boolean} [invalidClientId] - if true, simulated LTI launches use an
 *   invalid client_id
 * @param {boolean} [invalidClientSecret] - if true, simulated LTI launches use
 *   an invalid client_secret
 * @param {boolean} [simulateLaunchOnAuthorize] - if true, caccl-authorizer is
 *   set to simulate an LTI launch on authorize
 * @param {string} [launchPath=/launch] - the launchPath to use when
 *   initializing caccl-authorizer and test app
 * @param {string} [defaultAuthorizedRedirect='/'] - the
 *   default route to visit after authorization is complete (you can override
 *   this value for a specific authorization call by including query.next or
 *   body.next, a path/url to visit after completion)
 * @param {boolean} [allowAuthorizationWithoutLaunch] - if true, allows user to
 *   be authorized even without a launch (when no LTI launch occurred and
 *   simulateLaunchOnAuthorize is false)
 * @param {boolean} [noSession] - if true, express session will not be enabled
 * @return {Promise} Promise that resolves when the app and Canvas are set up
 */
module.exports = (config = {}) => {
  // Kill previous servers
  killServers();

  const launchPath = config.launchPath || '/launch';

  /*------------------------------------------------------------------------*/
  /*                         Prep to wait for ready                         */
  /*------------------------------------------------------------------------*/

  // Keep track of everything that needs to be initialized
  let appInitialized;
  let simInitialized;

  return fetchCanvasData.then(() => {
    return new Promise((resolve) => {
      // Function to call to check if all initializations are done
      const checkIfReady = () => {
        if (!appInitialized || !simInitialized) {
          return;
        }
        // Ready! Resolve.
        resolve();
      };

      /*----------------------------------------------------------------------*/
      /*                           Initialize Fake App                        */
      /*----------------------------------------------------------------------*/

      const app = express();

      // Set up body json parsing
      app.use(bodyParser.json({
        limit: '5mb',
      }));

      // Set up body application/x-www-form-urlencoded parsing
      app.use(bodyParser.urlencoded({
        extended: true,
        limit: '5mb',
      }));

      if (!config.noSession) {
        // Create session secret
        const sessionSecret = `test-app-session-${new Date().getTime()}`;

        // Create cookie name
        const cookieName = `test-app-cookie-${new Date().getTime()}-53901`;

        // Set session duration to 6 hours
        const sessionDurationMillis = ((config.sessionMins || 360) * 60000);

        // Add session
        app.use(session({
          cookie: {
            maxAge: sessionDurationMillis,
          },
          resave: true,
          name: cookieName,
          saveUninitialized: false,
          secret: sessionSecret,
        }));
      }

      // Allow connections from localhost
      app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', 'localhost');
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.header(
          'Access-Control-Allow-Headers',
          'Origin, X-Requested-With, Content-Type, Accept'
        );
        next();
      });

      // Start HTTPS server
      appServer = https.createServer({
        key,
        cert,
      }, app);
      appServer.listen(8089, (err) => {
        if (err) {
          console.log('Could not start the test app server:', err);
          process.exit(0);
        } else {
          appInitialized = true;
          checkIfReady();
        }
      });

      // Add app routes

      // Keep track of nonces
      const nonceSeen = {};
      const nonceValid = (nonce) => {
        if (!nonce || nonce.trim().length === 0) {
          return false;
        }
        const seen = !!nonceSeen[nonce];
        nonceSeen[nonce] = true;
        return !seen;
      };

      // Track onLogin calls
      let lastOnLoginCall;
      const onLogin = () => {
        lastOnLoginCall = new Date().getTime();
      };
      const getOnLoginTimestamp = () => {
        return lastOnLoginCall;
      };

      /*----------------------------------------------------------------------*/
      /*                      Initialize Canvas Authorizer                    */
      /*----------------------------------------------------------------------*/

      // Create developer credentials
      const developerCredentials = {
        client_id: (
          config.invalidClientId
            ? 'wrong_client_id'
            : 'client_id'
        ),
        client_secret: (
          config.invalidClientSecret
            ? 'wrong_client_secret'
            : 'client_secret'
        ),
      };
      initAuthorizer({
        app,
        launchPath,
        developerCredentials,
        onLogin,
        allowAuthorizationWithoutLaunch: config.allowAuthorizationWithoutLaunch,
        defaultAuthorizedRedirect: config.defaultAuthorizedRedirect,
        simulateLaunchOnAuthorize: config.simulateLaunchOnAuthorize,
        canvasHost: 'localhost:8088',
        autoRefreshRoutes: ['/withapi*'],
      });

      /*----------------------------------------------------------------------*/
      /*                            Add routes to app                         */
      /*----------------------------------------------------------------------*/

      addAppRoutes(app, {
        launchPath,
        course,
        user,
        isValid,
        nonceValid,
        getOnLoginTimestamp,
      });

      /*----------------------------------------------------------------------*/
      /*                     Start Canvas Partial Simulator                   */
      /*----------------------------------------------------------------------*/

      const { server } = initCanvasSimulation({
        accessToken,
        canvasHost,
        launchURL: `https://localhost:8089${launchPath}`,
        onSuccess: () => {
          simInitialized = true;
          checkIfReady();
        },
        dontPrint: true,
      });
      canvasServer = server;
    });
  });
};
