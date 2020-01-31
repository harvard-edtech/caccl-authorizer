const randomstring = require('randomstring');

/**
 * Replace all occurrences in a string
 * @author Gabe Abrams
 * @param {string} str - the string to search
 * @param {string} search - the fragment to search for
 * @param {string} replacement - the fragment to replace when search is found
 * @return {string} the string with its replacements made
 */
const replaceAll = (str, search, replacement) => {
  return str.replace(new RegExp(search, 'g'), replacement);
};

/**
 * Generates an LTI launch body
 * @author Gabe Abrams
 * @param {object} profile - the Canvas profile of the user that is being
 *   launched
 * @param {object} course - the Canvas course the user is launching from
 * @param {string} [canvasHost=canvas.instructure.com] - the hostname of the
 *   Canvas instance
 * @param {string} [locale=en] - the locale of the user
 * @param {string} [userEmail=primary email from profile] - the email of the
 *   user
 * @param {string} [appName=Unnamed App] - the name of the app being launched
 *   from (nav launch)
 * @param {object} [assignment=null] - if included, the LTI launch is an
 *   external tool assignment launch based on this assignment
 */
module.exports = (options) => {
  // Get the first and last name from the profile
  const [last, first] = options.profile.sortable_name.split(', ');

  // Prep roles
  const extRoles = [];
  const roles = [];
  if (Array.isArray(options.course.enrollments)) {
    // Add student enrollment if applicable
    const hasStudentEnrollment = (
      options.course.enrollments.some((enrollment) => {
        return enrollment.type === 'student';
      })
    );
    if (hasStudentEnrollment) {
      // Ext roles
      extRoles.push('urn:lti:instrole:ims/lis/Student');
      extRoles.push('urn:lti:role:ims/lis/Learner');
      extRoles.push('urn:lti:sysrole:ims/lis/User');
      // Depricated roles
      roles.push('Learner');
    }

    // Add teacher enrollment if applicable
    const hasTeacherEnrollment = (
      options.course.enrollments.some((enrollment) => {
        return enrollment.type === 'teacher';
      })
    );
    if (hasTeacherEnrollment) {
      // Ext roles
      extRoles.push('urn:lti:instrole:ims/lis/Instructor');
      extRoles.push('urn:lti:role:ims/lis/Instructor');
      extRoles.push('urn:lti:sysrole:ims/lis/User');
      // Depricated roles
      roles.push('Instructor');
    }
  }

  // Create LTI launch body
  const body = {};

  body.oauth_nonce = `${randomstring.generate(48)}${Date.now()}`;
  body.oauth_timestamp = Math.round(Date.now() / 1000);
  body.context_id = options.course.uuid; // Double check that this is correct
  body.context_label = replaceAll(
    options.course.course_code || 'Current Course Code',
    '"',
    ''
  );
  body.context_title = replaceAll(
    options.course.name || 'Current Course',
    '"',
    ''
  );
  body.custom_canvas_api_domain = options.canvasHost || 'canvas.instructure.com';
  body.custom_canvas_course_id = options.course.id;
  body.custom_canvas_enrollment_state = 'active';
  body.custom_canvas_user_id = options.profile.id;
  body.custom_canvas_user_login_id = options.profile.login_id;
  body.custom_canvas_workflow_state = 'available';
  body.ext_roles = extRoles.join(',');
  body.launch_presentation_document_target = 'window';
  body.launch_presentation_height = null; // Not applicable
  body.launch_presentation_locale = options.locale || 'en';
  body.launch_presentation_return_url = null; // We can't get this
  body.launch_presentation_width = null; // Not applicable
  body.lis_person_contact_email_primary = (
    options.userEmail || options.profile.primary_email
  );
  body.lis_person_name_family = last;
  body.lis_person_name_full = options.profile.name;
  body.lis_person_name_given = first;
  body.lis_person_sourcedid = options.profile.login_id;
  body.lti_message_type = 'basic-lti-launch-request';
  body.lti_version = 'LTI-1p0';
  body.oauth_callback = 'about:blank';
  body.resource_link_id = options.course.uuid;
  body.resource_link_title = options.appName || 'Unnamed App';
  body.roles = roles.join(',');
  body.tool_consumer_info_product_family_code = 'canvas';
  body.tool_consumer_info_version = 'cloud';
  body.tool_consumer_instance_contact_email = 'notifications@instructure.com';
  body.tool_consumer_instance_guid = null; // We can't get this
  body.tool_consumer_instance_name = `Canvas instance at ${options.canvasHost || 'canvas.instructure.com'}`;
  body.user_id = options.profile.lti_user_id;
  body.user_image = options.profile.avatar_url;

  return body;
};
