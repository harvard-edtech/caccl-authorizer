require('dce-selenium');

itd('Valid - Refresh on Expiry - Refreshes on expiration', async function (driver) {
  // Successfully launch the app

  // Pretend that the app was launched
  await driver.checkForSuccess('https://localhost:8089/addlaunchinfo');

  // Visit /launch and get redirect to auth page
  await driver.visit(
    'https://localhost:8089/launch',
    'https://localhost:8088/login/oauth2/auth'
  );

  // Click "Authorize"
  await driver.clickByContents('Authorize', 'a');
  driver.log('enforce launch was successful.');
  await driver.waitForLocation('https://localhost:8089/?success=true');

  // Check API
  driver.log('check that API access works');
  await driver.checkForSuccess('https://localhost:8089/withapi/verifyapi');

  // Force token to expire
  await driver.checkForSuccess('https://localhost:8089/expirenow');

  // Check that the token has expired
  await driver.visit('https://localhost:8089/tokentimeleft');
  const { ms } = await driver.getJSON();
  if (ms >= 0) {
    // Token still has time left! Forced expiration failed
    throw new Error('Token couldn\'t be forced to expire');
  }

  // Try to visit a refreshed path
  driver.log('check that API access works even with expired token (refresh occurs)');
  await driver.checkForSuccess('https://localhost:8089/withapi/verifyapi');
});
