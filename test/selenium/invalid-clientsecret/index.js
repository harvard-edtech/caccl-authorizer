require('dce-selenium');

itS('Invalid Client Secret - Rejects launch request', async function (driver) {
  // Pretend that the app was launched
  await driver.checkForSuccess('https://localhost:8089/addlaunchinfo');

  // Visit /launch and get redirect to auth page
  await driver.visit(
    'https://localhost:8089/launch',
    'https://localhost:8088/login/oauth2/auth'
  );

  // Click "Authorize"
  await driver.clickByContents('Authorize', 'a');

  // Wait for app page to load
  await driver.waitForLocation('https://localhost:8089/');

  // Verify query information
  const query = await driver.getQuery();
  if (
    query.success !== 'false'
    || query.reason !== 'invalid_client'
  ) {
    throw new Error('Invalid query string (should be: invalid_client)');
  }
});
