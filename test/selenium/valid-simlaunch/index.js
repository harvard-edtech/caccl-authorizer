const API = require('caccl-api');
require('dce-selenium');

// Get
const {
  accessToken,
  courseId,
  canvasHost,
} = require('../../devEnvironment');

itS('Valid - Sim Launch - Does not simulate launch if launch already occurred', async function (driver) {
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

itS('Valid - Sim Launch - Simulates launch with course picker', async function (driver) {
  // Visit /launch and get redirect to auth page
  await driver.visit(
    'https://localhost:8089/launch',
    'https://localhost:8088/login/oauth2/auth'
  );

  // Click "Authorize"
  await driver.clickByContents('Authorize', 'a');
  driver.log('enforce launch was successful.');

  // Get info on the test course so we can click it
  const api = new API({
    accessToken,
    canvasHost,
  });
  const courseInfo = await api.course.get({ courseId });
  const courseName = courseInfo.name;

  // Click course to launch
  await driver.clickByContents(courseName, 'div');

  // Wait for successful launch
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

  // Get user's name
  const { name } = await api.user.self.getProfile();

  // Check launch info
  driver.log('check launch info');
  await driver.visit('https://localhost:8089/launchinfo');
  const launchInfo = await driver.getJSON();
  if (
    launchInfo.canvasHost !== 'localhost:8088'
    || launchInfo.courseId !== courseId
    || launchInfo.userFullName !== name
  ) {
    throw new Error('Launch info saved incorrectly');
  }
});
