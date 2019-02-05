const API = require('caccl-api');

// Get test user's name
const { name, canvasHost } = require('../devEnvironment');

module.exports = (app, config) => {
  const {
    launchPath, // path to accept LTI launches at
    user, // Canvas user object for current user
    course, // Canvas course object for test course
    isValid, // function that checks if a launch request is valid (ret: promise)
    nonceValid, // function that checks if a nonce is valid
    getOnLoginTimestamp,
  } = config;

  app.get('/timesinceonlogin', (req, res) => {
    return res.json({
      timestamp: getOnLoginTimestamp(),
    });
  });

  // Relay launch info
  app.get('/launchinfo', (req, res) => {
    if (!req.session || !req.session.launchInfo) {
      return res.json({});
    }
    return res.json(req.session.launchInfo);
  });

  // Login manually
  app.get('/loginManually', (req, res) => {
    req.loginManually('asdf', 'asdf', 'asdf')
      .then(() => {
        return res.json({ success: true });
      });
  });

  // Verify that API is working
  app.get('/withapi/verifyapi', async (req, res) => {
    // Make sure we have the correct session param
    if (
      !req.session
      || !req.session.accessToken
      || !req.session.refreshToken
      || !req.session.accessTokenExpiry
    ) {
      return res.json({
        success: false,
        message: `Required: accessToken, refreshToken, and accessTokenExpiry in session. Instead, seassion was: ${req.session}`,
      });
    }

    // Make sure token hasn't expired
    const elapsedSinceExpiry = (
      req.session.accessTokenExpiry < new Date().getTime()
    );
    if (elapsedSinceExpiry > 0) {
      return res.json({
        success: false,
        message: `Access token has expired and wasn't automatically refreshed! Expired ${elapsedSinceExpiry}ms ago.`,
      });
    }

    // Try to use the access token to get user's profile
    const api = new API({
      canvasHost,
      accessToken: req.session.accessToken,
    });
    // Attempt to get user's profile
    try {
      const profile = await api.user.self.getProfile();
      if (profile.name === name) {
        return res.json({
          success: true,
        });
      }
      return res.json({
        success: false,
        message: `Profile name didn't match. Expected "${name}" but got "${profile.name}"`,
      });
    } catch (err) {
      return res.json({
        success: false,
        message: `An error occurred while trying to get the user profile: ${err.message}`,
      });
    }
  });

  // Indicate to authorizer that launch occurred
  app.get('/addlaunchinfo', (req, res) => {
    req.session.launchInfo = {
      dummyInfo: true,
    };
    req.session.save();
    return res.json({ success: true });
  });

  // Return test course title
  app.get('/testcoursename', (req, res) => {
    return res.send(course.name);
  });

  // Home
  app.get('/', (req, res) => {
    return res.send('home');
  });

  // Just another route
  app.get('/dummypage', (req, res) => {
    return res.send('dummypage get');
  });
  app.post('/dummypage', (req, res) => {
    return res.send('dummypage post');
  });

  // Add route for verifying self-signed certificate
  app.get('/verifycert', (req, res) => {
    return res.send('Certificate accepted!');
  });

  // Route that kills the session
  app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
      return res.json({ success: !err });
    });
  });

  // Route that immediately expires the current access token
  app.get('/expirenow', (req, res) => {
    // Set as expired (expiration is now):
    req.session.accessTokenExpiry = new Date().getTime();

    // Save session
    req.session.save((err) => {
      return res.json({ success: !err });
    });
  });

  // Check how long till token expires
  app.get('/tokentimeleft', (req, res) => {
    return res.json({
      ms: req.session.accessTokenExpiry - new Date().getTime(),
    });
  });

  // POST Launch requests
  app.post(launchPath, (req, res) => {
    isValid(req)
      .then((valid) => {
        let html = '<style>td {\nborder: 1px solid black;\n}</style>\n';
        html += '<h1>Review, then click play to resume tests</h1>\n';
        html += '<table style="width: 100%">\n<tr><td>Item</td><td>Value</td><td>Expected/Requirement</td><td>Results</td><td>Pass/Fail</td>\n';

        // eslint-disable-next-line max-params
        const addRow = (prop, expected, results, pass) => {
          html += `<tr style="background-color: ${pass ? 'white' : 'red'}; color: ${pass ? 'black' : 'white'}"><td>${prop}</td><td>${req.body[prop]}</td><td>${expected}</td><td>${results}</td><td>${pass ? 'Pass!' : 'Fail!'}</td></tr>\n`;
        };

        // Consumer key
        let pass = (req.body.oauth_consumer_key === 'consumer_key');
        addRow(
          'oauth_consumer_key',
          'Equals',
          'consumer_key',
          pass
        );

        // Request validity
        addRow(
          'oauth_signature',
          'is valid',
          valid,
          valid
        );

        // Nonce
        pass = nonceValid(req.body.oauth_nonce);
        addRow(
          'oauth_nonce',
          'Never used',
          pass ? 'Never used' : 'Used',
          pass
        );

        // Timestamp
        const age = (
          (new Date().getTime() / 1000)
          - (req.body.oauth_timestamp || 0)
        );
        pass = (age > -1 && age <= 5);
        addRow(
          'oauth_timestamp',
          'Within last 4s',
          `Age: ${age.toFixed(3)}s`,
          pass
        );

        // Context id
        pass = (req.body.context_id === course.uuid);
        addRow(
          'context_id',
          'Equals the course uuid',
          `Should be: ${course.uuid}`,
          pass
        );
        pass = (req.body.resource_link_id === course.uuid);
        addRow(
          'resource_link_id',
          'Equals the course uuid',
          `Should be: ${course.uuid}`,
          pass
        );

        // Context label
        pass = (req.body.context_label === course.course_code);
        addRow(
          'context_label',
          'Equals the course code',
          `Should be: ${course.course_code}`,
          pass
        );

        // Context title
        pass = (req.body.context_title === course.name);
        addRow(
          'context_title',
          'Equals the course name',
          `Should be: ${course.name}`,
          pass
        );

        // Custom api domain
        pass = (req.body.custom_canvas_api_domain === 'localhost:8088');
        addRow(
          'custom_canvas_api_domain',
          'Equals localhost:8088',
          pass,
          pass
        );

        // Canvas course id
        pass = (
          String(req.body.custom_canvas_course_id) === String(course.id)
        );
        addRow(
          'custom_canvas_course_id',
          'Equals course id',
          `Should be: ${course.id}`,
          pass
        );

        // custom_canvas_enrollment_state
        pass = (req.body.custom_canvas_enrollment_state === 'active');
        addRow(
          'custom_canvas_enrollment_state',
          'Is active',
          pass,
          pass
        );

        // user id
        pass = (req.body.custom_canvas_user_id === String(user.id));
        addRow(
          'custom_canvas_user_id',
          'Equals user.id',
          user.id,
          pass
        );

        // login id
        pass = (req.body.custom_canvas_user_login_id === user.login_id);
        addRow(
          'custom_canvas_user_login_id',
          'Equals login id',
          user.login_id,
          pass
        );

        // custom_canvas_workflow_state
        pass = (req.body.custom_canvas_workflow_state === 'available');
        addRow(
          'custom_canvas_workflow_state',
          'Is available',
          pass,
          pass
        );

        // ext role
        pass = (req.body.ext_roles.includes(course.enrollments[0].role));
        addRow(
          'ext_roles',
          'Matches course enrollment role',
          `Should be: ${course.enrollments[0].role}`,
          pass
        );

        // launch_presentation_document_target
        pass = (
          ['window', 'iframe']
            .indexOf(req.body.launch_presentation_document_target) >= 0
        );
        addRow(
          'launch_presentation_document_target',
          'Is either "iframe" or "window"',
          pass,
          pass
        );

        // locale
        pass = (
          req.body.launch_presentation_locale === user.effective_locale
        );
        addRow(
          'launch_presentation_locale',
          'Equals user locale',
          `Should be: ${user.effective_locale}`,
          pass
        );

        // last name
        const lastName = user.sortable_name.split(',')[0].trim();
        pass = (req.body.lis_person_name_family === lastName);
        addRow(
          'lis_person_name_family',
          'Equals user last name',
          `Should be: ${lastName}`,
          pass
        );

        // first name
        const firstName = user.sortable_name.split(',')[1].trim();
        pass = (req.body.lis_person_name_given === firstName);
        addRow(
          'lis_person_name_given',
          'Equals user first name',
          `Should be: ${firstName}`,
          pass
        );

        // full name
        pass = (req.body.lis_person_name_full === user.name);
        addRow(
          'lis_person_name_full',
          'Equals user full name',
          `Should be ${user.name}`,
          pass
        );

        // login id
        pass = (req.body.lis_person_sourcedid === user.login_id);
        addRow(
          'lis_person_sourcedid',
          'Equals user login id',
          `Should be ${user.login_id}`,
          pass
        );

        // lti_message_type: 'basic-lti-launch-request',
        pass = (req.body.lti_message_type === 'basic-lti-launch-request');
        addRow(
          'lti_message_type',
          'Equals:',
          'basic-lti-launch-request',
          pass
        );

        // lti_version: 'LTI-1p0',
        pass = (req.body.lti_version === 'LTI-1p0');
        addRow(
          'lti_version',
          'Equals:',
          'LTI-1p0',
          pass
        );

        // roles
        pass = (req.body.roles.includes(course.enrollments[0].role));
        addRow(
          'roles',
          'Includes',
          course.enrollments[0].role,
          pass
        );

        // tool family
        pass = (req.body.tool_consumer_info_product_family_code === 'canvas');
        addRow(
          'tool_consumer_info_product_family_code',
          'Equals',
          'canvas',
          pass
        );

        // cloud
        pass = (req.body.tool_consumer_info_version === 'cloud');
        addRow(
          'tool_consumer_info_version',
          'Equals',
          'cloud',
          pass
        );

        // user uuid
        pass = (req.body.user_id === user.lti_user_id);
        addRow(
          'user_id',
          'Equals LTI user id',
          user.lti_user_id,
          pass
        );

        // User image
        pass = (req.body.user_image === user.avatar_url);
        addRow(
          'user_image',
          'Equals user.avatar_url',
          user.avatar_url,
          pass
        );

        html += '\n</table>';
        return res.send(html);
      });
  });
};
