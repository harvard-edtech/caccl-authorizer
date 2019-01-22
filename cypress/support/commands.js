/**
 * Initializes an app on port 8089 and a partial Canvas simulator on port 8088
 * @param {boolean} invalidClientId - if true, simulated LTI launches use an
 *   invalid client_id
 * @param {boolean} invalidClientSecret - if true, simulated LTI launches use an
 *   invalid client_secret
 * @param {boolean} simulateLaunchOnAuthorize - if true, caccl-authorizer is set
 *   to simulate an LTI launch on authorize
 * @param {function} onLogin - a function to call when login occurs
 * @param {string} [launchPath=/launch] - the launchPath to use when
 *   initializing caccl-authorizer and test app
 * @param {string} [defaultAuthorizedRedirect='/'] - the
 *   default route to visit after authorization is complete (you can override
 *   this value for a specific authorization call by including query.next or
 *   body.next, a path/url to visit after completion)
 */
Cypress.Commands.add('changeSetup', (config) => {
  // Deconstruct config
  const {
    invalidClientId,
    invalidClientSecret,
    simulateLaunchOnAuthorize,
    launchPath,
    defaultAuthorizedRedirect,
  } = config;

  // Build query string
  let query = '';
  if (invalidClientId) {
    query += 'invalid_client_id=true&';
  }
  if (invalidClientSecret) {
    query += 'invalid_client_secret=true&';
  }
  if (simulateLaunchOnAuthorize) {
    query += 'simulate_launch_on_authorize=true&';
  }
  if (launchPath) {
    query += `launch_path=${launchPath}`;
  }
  if (defaultAuthorizedRedirect) {
    query += `default_authorized_redirect=${defaultAuthorizedRedirect}`;
  }

  // Tell app to restart and create a new setup
  cy.visit(`https://localhost:8089/changesetup?${query}`);

  // Wait for server to stop
  cy.wait(1000);

  // Wait for server to start
  cy.visit('https://localhost:8089/alive');

  // Wait for good measure
  cy.wait(500);
});

Cypress.Commands.add('hasBody', (body = true) => {
  cy.get('body').invoke('text')
    .then((bodyStr) => {
      if (bodyStr.trim() !== String(body)) {
        throw new Error(`Body was:\n${bodyStr}\nBut we expected:\n${body}`);
      }
    });
});
