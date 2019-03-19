module.exports = {
  async checkForSuccess(location) {
    await this.visit(location);
    const pageJSON = await this.getJSON();
    const { success } = pageJSON;
    if (!success) {
      throw new Error(`Success could not be verified. An error occurred. ${pageJSON.message || ''}`);
    }
  },

  async changeSetup(config = {}) {
    // Deconstruct config
    const {
      invalidClientId,
      invalidClientSecret,
      simulateLaunchOnAuthorize,
      launchPath,
      defaultAuthorizedRedirect,
      allowAuthorizationWithoutLaunch,
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
      query += `launch_path=${launchPath}&`;
    }
    if (defaultAuthorizedRedirect) {
      query += `default_authorized_redirect=${defaultAuthorizedRedirect}&`;
    }
    if (allowAuthorizationWithoutLaunch) {
      query += 'allow_auth_without_launch=true&';
    }

    // Tell app to restart and create a new setup
    await this.visit(`https://localhost:8089/changesetup?${query}`);

    // Wait until new app has been started
    await this.wait(5000);
  },

  async checkAuthStatus(statusVars = {}) {
    // Get the auth status
    await this.visit('https://localhost:8089/authstatus');
    const status = await this.getJSON();

    // Make sure auth status is valid
    if (!status.authorized !== !statusVars.authorized) {
      throw new Error(`req.session.authorized should be ${!!statusVars.authorized} but it was ${status.authorized}`);
    }
    if (!status.authFailed !== !statusVars.authFailed) {
      throw new Error(`req.session.authFailed should be false but it was ${status.authFailed}`);
    }
    if (
      statusVars.authFailureReason
      && (status.authFailureReason !== statusVars.authFailureReason)
    ) {
      throw new Error(`req.session.authFailureReason should be defined and equal to "${statusVars.authFailureReason}". Instead, it was "${statusVars.authFailureReason}"`);
    } else if (!statusVars.authFailureReason && status.authFailureReason) {
      throw new Error(`req.session.authFailureReason should not be defined. Instead, it was equal to "${status.authFailureReason}"`);
    }
  },
};
