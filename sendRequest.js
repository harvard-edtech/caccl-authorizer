const querystring = require('querystring');
const https = require('https');
const CACCLError = require('../caccl-error/index.js'); // TODO: switch to actual library
const errorCodes = require('./errorCodes.js');

// Function that sends (and retries) an https request
function sendRequest(options) {
  return new Promise((resolve, reject) => {
    // Set max number of retries if not defined
    const numRetries = (options.numRetries ? options.numRetries : 0);

    // Encode content
    const content = querystring.stringify(options.params || {});
    const request = {
      host: options.host,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': content.length,
      },
    };

    // Send request
    const req = https.request(request, (res) => {
      let text = '';

      // Save a chunk of the response
      res.on('data', (chunk) => {
        text += chunk;
      });

      // Upon finishing, resolve with full response
      res.on('end', () => {
        resolve({
          body: text,
          status: res.statusCode,
          headers: res.headers,
        });
      });
    });

    // Try again if we received an error
    req.on('error', () => {
      if (numRetries > 0) {
        const newOptions = options;
        newOptions.numRetries = numRetries - 1;
        sendRequest(newOptions).then((results) => {
          resolve(results);
        });
      } else {
        // No tries left
        return reject(new CACCLError({
          message: 'We could not connect with Canvas. This happens when Canvas is down or when Canvas throttles requests. If this issue persists, contact an admin.',
          code: errorCodes.notConnected,
        }));
      }
    });

    // Write and close connection
    req.write(content);
    req.end();
  });
}

module.exports = sendRequest;
