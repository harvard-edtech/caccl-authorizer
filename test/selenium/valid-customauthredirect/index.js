require('dce-selenium');

itd('Valid - Custom Launch Path - Accepts valid launch requests', async function (driver) {
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
  await driver.waitForLocation('https://localhost:8089/dummypage?success=true');

  // Check API
  driver.log('check that API access works');
  await driver.checkForSuccess('https://localhost:8089/withapi/verifyapi');
});
