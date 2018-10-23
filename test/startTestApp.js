// Server dependencies
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const http = require('http');

// Prepare SSL info
const sessionSecret = new Date().getTime() + '-secret-pineapple';
const key = fs.readFileSync('./ssl/key.pem', 'utf-8');
const cert = fs.readFileSync('./ssl/cert.pem', 'utf-8');

// 

/**
 * Initializes a new Canvas App Server.
 * NOTE: pass in an options object. options = {defaultCanvasHost: , ...}
 * App developer credentials:
 * @param {string} appCredentials.client_id The Canvas app developer ID
 * @param {string} appCredentials.client_secret The Canvas app developer secret
 * Client credentials:
 * @param {string} clientCredentials.consumer_key The installation consumer key
 * @param {string} clientCredentials.consumer_secret The installation consumer
 *   secret
 * Canvas information
 * @param {string} defaultCanvasHost Optional default Canvas hostname to use.
 *   Defaults to "canvas.instructure.com"
 * Token store:
 * @param {function} tokenStore.lookup Optional token store lookup function
 * @param {function} tokenStore.save Optional token store save function
 * Session information:
 * @param {string} secret Optional session secret. If excluded, secret is
 *   randomly generated
 * @param {number} mins Optional number of mins for the session duration.
 *   Defaults to 12 hours
 * @param {string} name Optional cookie name for the session. Defaults to a
 *   randomly generated cookie
 * Error handlers:
 * @param {function} onUncaughtException Optional function called on an uncaught
 *   exception. Defaults to a console log
 * @param {function} onUnhandledRejection Optional function called on an
 *   unhandled rejection. Defaults to a console log
 * Manual launch info:
 * @param {string} defaultCanvasInstanceName Optional, defaults to "Canvas"
 * Port:
 * @param {number} port Optional port to listen on, defaults to 8080
 */

module.exports = (config) => {
  // Canvas config
  let defaultCanvasHost = config.defaultCanvasHost || 'canvas.instructure.com';

  ////// Create express server
  let app = express();
  let port = config.port || 8080;
  app.use(bodyParser.json({
    limit: '5mb'
  }));
  app.use(bodyParser.urlencoded({
    extended: true,
    limit: '5mb'
  }));
  // > Session
  config.session = config.session || {};
  let sessionSecret = (
    config.session.secret ||
    (new Date().getTime()*Math.random())
  )
  let cookieName = (
    config.session.name ||
    'canvas-app-server-session-' + (new Date().getTime())
  );
  let sessionDurationMillis = (config.session.mins || 720) * 60000;
  app.use(session({
    cookie: {
      maxAge: sessionDurationMillis
    },
    resave: true,
    name: cookieName,
    saveUninitialized: false,
    secret: sessionSecret
  }));
  // > Listen
  let server = http.createServer(app);
  server.listen(port).on('listening', () => {
    if (onListening) {
      onListening();
    } else {
      console.log('Listening on port ' + port);
    }
  });

  ///// Error handlers
  let onUncaughtException = config.onUncaughtException;
  process.on('uncaughtException', (err) => {
    if (onUncaughtException) {
      onUncaughtException(err);
    } else {
      console.log('Uncaught exception thrown at ' + (new Date().getTime()) +
        ':\n' + err.stack);
    }
  });
  let onUnhandledRejection = config.onUnhandledRejection;
  process.on('unhandledRejection', (err) => {
    if (onUnhandledRejection) {
      onUnhandledRejection(err);
    } else {
      console.log('Unhandled rejection at ' + (new Date().getTime()) +
        ':\n' + err.message, err, err.stack);
    }
  });


  ///// Set up spine
  spine({
    type: 'server',

    expressApp: app,
    defaultHost: defaultCanvasHost,

    api: {
      serve: true,
      install: true,
      pathPrefix: '/canvas/api/v1',
      authPath: '/canvas/authenticate',
      authSuccessPath: '/launch/authorized',
      appCredentials: config.appCredentials,
      tokenStore: config.tokenStore
    },

    launches: {
      accepted: true,
      launchPath: '/launch',
      clientCredentials: config.clientCredentials
    },

    manualLaunches: {
      install: true,
      defaultCanvasInstanceName: config.defaultCanvasInstanceName
    }
  });

  // Return
  return {
    expressApp: app
  };
};
