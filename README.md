# caccl-authorizer

Handles app authorization, redirecting users to the "Authorize this App" page, acquiring access tokens, and refreshing access tokens when they expire.

Your LTI app accepts launches at your `launchPath` via POST. `caccl-authorizer` uses that same path to kick off the Canvas authorization process: direct users to your `launchPath` via GET and they'll be authorized and then redirected to the `defaultAuthorizedRedirect` path.

## Part of the CACCL library
**C**anvas  
**A**pp  
**C**omplete  
**C**onnection  
**L**ibrary

## Quickstart

After creating your express app but before adding routes, initialize `caccl-authorizer` to add routes and middleware to make authorization possible.

```js
const initAuthorization = require('caccl-authorizer');

// TODO: create express app

initAuthorization({
    app: /* express app with express-session enabled*/,
    developerCredentials: {
        client_id: /* developer client id */,
        client_secret: /* developer client secret */,
    },
    canvasHost: /* your canvas host name */,
});

// TODO: add routes to express app
```

To authorize a user, redirect them to the `launchPath` via GET. `caccl-authorizer` will handle the entire authorization process then redirect them to the `defaultAuthorizedRedirect` path. After authorization, the user's access token will appear in the `req` object: `req.accessToken`.

**Important:** you must initialize `caccl-authorizer` before adding refreshed routes (see `autoRefreshRoutes` below).

## Configuration Options

When initializing `caccl-authorizer`, you can pass in many different configuration options to customize CACCL's behavior or turn on/off certain functionality.

**Note:** configuration options are _optional_ unless otherwise stated

### Main Configuration Options

Important configuration options you probably should include.

Config Option | Type | Description | Default/Required
:--- | :--- | :--- | :---
app | express app | the server express app with express-session enabled | **required**
developerCredentials | object | canvas app developer credentials in the form: `{ client_id, client_secret }` | **required**
canvasHost | string | canvas host to use for oauth exchange | canvas.instructure.com
allowAuthorizationWithoutLaunch | boolean | if true, allows user to be authorized even without a launch (when no LTI launch occurred and simulateLaunchOnAuthorize is false) | false

### App Information

Optional information about your app.

Config Option | Type | Description | Default
:--- | :--- | :--- | :---
appName | string | the name of the app for use in simulated launches and in errors | "this app"
launchPath | string | redirect users to this path via GET to kick off the authorization process | "/launch"

### Authorization Configuration

Options that change how authorization functions. By default, when authorization is complete, the user will be redirected to `/`, and when the access token expires (after 1hr), it will automatically be refreshed when the user visits any route (`*`). The refresh tokens are stored in a `memory token store`. All of these features can be customized via the config options below.

Config Option | Type | Description | Default
:--- | :--- | :--- | :---
defaultAuthorizedRedirect | string | the default route to visit after authorization is complete (you can override this for a specific authorization call by including `query.next`. example: `/launch?next=/profile`) | "/"
autoRefreshRoutes | string[] | list of routes to automatically refresh the access token for (if the access token has expired), these routes must be added _after_ `caccl-authorizer` has been initialized | `["*"]`
tokenStore | [TokenStore](https://github.com/harvard-edtech/caccl-authorizer/blob/master/docs/TokenStore.md) | null to turn off storage of refresh tokens, exclude to use memory token store, or include a custom token store (see [these docs](https://github.com/harvard-edtech/caccl-authorizer/blob/master/docs/TokenStore.md)) | memory store

**Tip:** we recommend setting `autoRefreshRoutes` to all the paths where you will need access to the Canvas API. Then, the accessToken will never have expired when the user visits one of those paths.

### Simulated Launch Options

Enabling this feature allows users to visit the `launchPath` (GET), go through the authorization process, and then `caccl-authorizer` simulates an LTI launch. This essentially makes it possible for users to launch your app without visiting Canvas, simply by visiting the `launchPath`.

To enable this feature,

Config Option | Type | Description | Default
:--- | :--- | :--- | :---
simulateLaunchOnAuthorize | boolean | if true, simulates an LTI launch upon successful authorization (if the user hasn't already launched via LTI) | false

## Session Information

After the authorization process, caccl-authorizer stores information in the user's session:

- **req.session.authorized**  [boolean] - true if the user has successfully authorized with Canvas
- **req.session.authFailed** [boolean] - true if the user's authorization process failed. If this is true, authFailureReason will be defined.
- **req.session.authFailureReason** [string] - the reason the user's authorization failed. See values below:

Possible values of `req.session.authFailureReason`:

- "error" - a Canvas error occurred: Canvas responded erratically during the authorization process
- "internal_error" - an internal error occurred on the server while attempting to process authorization
- "denied" - the user denied the app access to Canvas when they were prompted
- "invalid_client" - the app's client_id is invalid: the app is not approved to interact with Canvas
