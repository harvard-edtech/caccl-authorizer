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
};
