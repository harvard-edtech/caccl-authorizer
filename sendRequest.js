const axios = require('axios');
const querystring = require('querystring');
const CACCLError = require('../caccl-error/index.js'); // TODO: switch to actual library
const errorCodes = require('./errorCodes.js');

const paramsSerializer = (params) => {
  return querystring.stringify(params, { arrayFormat: 'bracket' });
};

// Function that sends (and retries) an https request
const sendRequest = (options) => {
  // Set max number of retries if not defined
  const numRetries = (options.numRetries ? options.numRetries : 0);

  // Use default method if applicable
  const method = options.method || 'GET';

  return axios({
    method,
    paramsSerializer,
    params: (method === 'GET' ? options.params : null),
    data: (method !== 'GET' ? options.params : null),
    url: 'https://' + options.host + options.path,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
    .catch(() => {
      // Request failed! Check if we have more attempts
      if (numRetries > 0) {
        // Update options with one less retry
        const newOptions = options;
        newOptions.numRetries -= 1;
        return sendRequest(newOptions);
      }

      // No tries left
      throw new CACCLError({
        message: 'We encountered an error when trying to send a network request. If this issue persists, contact an admin.',
        code: errorCodes.notConnected,
      });
    });
};
module.exports = sendRequest;
