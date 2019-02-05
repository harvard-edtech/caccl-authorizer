require('dce-selenium');

itd('Valid - onLogin - Calls onLogin upon login', async function (driver) {
  // Successfully launch the app

  // Pretend that the app was launched
  await driver.checkForSuccess('https://localhost:8089/addlaunchinfo');

  // Visit /launch and get redirect to auth page
  await driver.visit(
    'https://localhost:8089/launch',
    'https://localhost:8088/login/oauth2/auth'
  );

  // Click "Authorize"
  const beforeLoginTimestamp = new Date().getTime();
  await driver.clickByContents('Authorize', 'a');
  driver.log('enforce launch was successful.');
  await driver.waitForLocation('https://localhost:8089/?success=true');

  // Check API
  driver.log('check that API access works');
  await driver.checkForSuccess('https://localhost:8089/withapi/verifyapi');

  // Check that onLogin was called
  driver.log('checking that onLogin was called properly');
  await driver.visit('https://localhost:8089/timesinceonlogin');
  const { timestamp } = await driver.getJSON();
  if (!timestamp) {
    throw new Error('onLogin was never called');
  }
  if (timestamp < beforeLoginTimestamp) {
    throw new Error('onLogin was called too early');
  }
});
