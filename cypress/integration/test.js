describe('caccl-authorizer', function () {
  describe('Self-certificates', function () {
    it('App certs accepted', function () {
      cy.visit('https://localhost:8089/verifycert');
    });

    it('Canvas partial simulator certs accepted', function () {
      cy.visit('https://localhost:8089/verifycert');
    });
  });

  describe('Authorization request - get code', function () {
    it('Accepts valid requests', function () {
      cy.changeSetup({
        invalidClientId: false,
        invalidClientSecret: false,
        simulateLaunchOnAuthorize: false,
        launchPath: undefined,
        defaultAuthorizedRedirect: undefined,
      });

      // TODO: write test
    });

    it('Rejects with invalid client_id', function () {
      cy.changeSetup({
        invalidClientId: true,
        invalidClientSecret: false,
        simulateLaunchOnAuthorize: false,
        launchPath: undefined,
        defaultAuthorizedRedirect: undefined,
      });

      // TODO: write test
    });

    it('Rejects with invalid client_secret', function () {
      cy.changeSetup({
        invalidClientId: false,
        invalidClientSecret: true,
        simulateLaunchOnAuthorize: false,
        launchPath: undefined,
        defaultAuthorizedRedirect: undefined,
      });

      // TODO: write test
    });

    it('Rejects with both invalid client_id and client_secret', function () {
      cy.changeSetup({
        invalidClientId: true,
        invalidClientSecret: true,
        simulateLaunchOnAuthorize: false,
        launchPath: undefined,
        defaultAuthorizedRedirect: undefined,
      });

      // TODO: write test
    });
  });

  describe('Authorization request - swap code for tokens', function () {
    beforeEach(function () {
      cy.changeSetup({
        invalidClientId: false,
        invalidClientSecret: false,
        simulateLaunchOnAuthorize: false,
        launchPath: undefined,
        defaultAuthorizedRedirect: undefined,
      });
    });

    it('Accepts valid code', function () {

    });

    it('Rejects excluded code', function () {

    });

    it('Rejects empty code', function () {

    });

    it('Rejects invalid code', function () {

    });

    it('Rejects code after it has been used', function () {

    });
  });

  describe('Simulated launch', function () {
    it('Simulates a launch on authorization', function () {
      cy.changeSetup({
        invalidClientId: false,
        invalidClientSecret: false,
        simulateLaunchOnAuthorize: true,
        launchPath: undefined,
        defaultAuthorizedRedirect: undefined,
      });
    });

    it('Refuses to simulate a launch when config is off', function () {
      cy.changeSetup({
        invalidClientId: false,
        invalidClientSecret: false,
        simulateLaunchOnAuthorize: false,
        launchPath: undefined,
        defaultAuthorizedRedirect: undefined,
      });
    });
  });

  describe('Configuration', function () {
    it('Uses custom launch path', function () {
      cy.changeSetup({
        invalidClientId: false,
        invalidClientSecret: false,
        simulateLaunchOnAuthorize: false,
        launchPath: '/dummypage',
        defaultAuthorizedRedirect: undefined,
      });
    });

    it('Uses custom defaultAuthorizedRedirect', function () {
      cy.changeSetup({
        invalidClientId: false,
        invalidClientSecret: false,
        simulateLaunchOnAuthorize: false,
        launchPath: undefined,
        defaultAuthorizedRedirect: '/dummypage',
      });
    });
  });
});
