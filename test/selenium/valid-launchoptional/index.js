require('dce-selenium');

itS('Valid - Launch Optional - Accepts valid launch requests without launch', async function (driver) {
  // Visit /launch and get redirect to auth page
  await driver.visit(
    'https://localhost:8089/launch',
    'https://localhost:8088/login/oauth2/auth'
  );

  // Click "Authorize"
  await driver.clickByContents('Authorize', 'a');
  driver.log('enforce launch was successful.');
  await driver.waitForLocation('https://localhost:8089/');

  // Get the auth status
  await driver.visit('https://localhost:8089/authstatus');
  const status = await driver.getJSON();

  // Make sure auth status is valid
  if (!status.authorized) {
    throw new Error(`req.session.authorized should be true but it was ${status.authorized}`);
  }
  if (status.authFailed) {
    throw new Error(`req.session.authFailed should be false but it was ${status.authFailed}`);
  }
  if (status.authFailureReason) {
    throw new Error(`req.session.authFailureReason should have been undefined but it was ${status.authFailureReason} instead`);
  }

  // Check API
  driver.log('check that API access works');
  await driver.checkForSuccess('https://localhost:8089/withapi/verifyapi');
});

itS('Valid - Launch Optional - Refreshes authorization on successive launches', async function (driver) {
  // --- Initial launch ---
  driver.log('Initial launch:');

  // Visit /launch and get redirect to auth page
  await driver.visit(
    'https://localhost:8089/launch',
    'https://localhost:8088/login/oauth2/auth'
  );

  // Click "Authorize"
  await driver.clickByContents('Authorize', 'a');
  driver.log('enforce launch was successful.');
  await driver.waitForLocation('https://localhost:8089/');

  // Check that auth status was successful
  await driver.checkAuthStatus({
    authorized: true,
    authFailed: false,
    authFailureReason: undefined,
  });

  // Check API
  driver.log('check that API access works');
  await driver.checkForSuccess('https://localhost:8089/withapi/verifyapi');

  // --- Successive Launch ---
  driver.log('Successive launch:');

  // Visit /launch and get redirect to auth page
  await driver.visit(
    'https://localhost:8089/launch',
    'https://localhost:8089/'
  );
});

itS('Valid - Launch Optional - Accepts valid launch requests with launch', async function (driver) {
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
  await driver.waitForLocation('https://localhost:8089/');

  // Check that auth status was successful
  await driver.checkAuthStatus({
    authorized: true,
    authFailed: false,
    authFailureReason: undefined,
  });

  // Check API
  driver.log('check that API access works');
  await driver.checkForSuccess('https://localhost:8089/withapi/verifyapi');
});
