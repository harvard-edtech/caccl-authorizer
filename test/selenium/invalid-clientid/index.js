require('dce-selenium');

itS('Invalid Client Id - Rejects launch request', async function (driver) {
  // Pretend that the app was launched
  await driver.checkForSuccess('https://localhost:8089/addlaunchinfo');

  // Visit /launch and get redirect to auth page
  await driver.visit(
    'https://localhost:8089/launch',
    'https://localhost:8088/login/oauth2/auth'
  );

  // Verify query information
  const query = await driver.getQuery();
  if (
    query.client_id !== 'wrong_client_id'
    || query.redirect_uri !== 'https://localhost:8089/launch'
    || query.response_type !== 'code'
    || query.state !== '/'
  ) {
    throw new Error('Invalid query string');
  }

  // Verify body
  const body = await driver.getBody();
  if (!body.includes('{"error":"invalid_client","error_description":"unknown client"}')) {
    throw new Error('Invalid body');
  }
});
