"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccessToken = void 0;
// Import CACCL modules
var caccl_error_1 = __importDefault(require("caccl-error"));
var caccl_send_request_1 = __importDefault(require("caccl-send-request"));
var caccl_lti_1 = require("caccl-lti");
var caccl_memory_store_1 = __importDefault(require("caccl-memory-store"));
// Import shared types
var ErrorCode_js_1 = __importDefault(require("./shared/types/ErrorCode.js"));
// Import shared constants
var CACCL_PATHS_1 = __importDefault(require("./shared/constants/CACCL_PATHS"));
var TOKEN_LIFESPAN_SEC_js_1 = __importDefault(require("./shared/constants/TOKEN_LIFESPAN_SEC.js"));
// Constants
var FIVE_MINS_MS = 300000;
// Store a copy of the token store
var tokenStore;
// Store a copy of the developer credentials
var developerCredentials;
/*------------------------------------------------------------------------*/
/*                                 Helpers                                */
/*------------------------------------------------------------------------*/
/**
 * Refresh the user's authorization
 * @author Gabe Abrams
 * @async
 * @returns the new token pack
 */
var refreshAuth = function (req) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, launched, launchInfo, tokenPack, specificCanvasCreds, body, expiresIn, newTokenPack, err_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                // Make sure caccl has been initialized
                if (!tokenStore || !developerCredentials) {
                    throw new caccl_error_1.default({
                        message: 'We could not extend your Canvas authorization because CACCL Authorizer has not been initialized yet.',
                        code: ErrorCode_js_1.default.NotInitialized,
                    });
                }
                _a = (0, caccl_lti_1.getLaunchInfo)(req), launched = _a.launched, launchInfo = _a.launchInfo;
                if (!launched) {
                    throw new caccl_error_1.default({
                        message: 'We could not extend your Canvas authorization because your session has expired.',
                        code: ErrorCode_js_1.default.RefreshFailedDueToSessionExpiry,
                    });
                }
                return [4 /*yield*/, tokenStore.get("".concat(launchInfo.canvasHost, "/").concat(launchInfo.userId))];
            case 1:
                tokenPack = _b.sent();
                if (!tokenPack) {
                    throw new caccl_error_1.default({
                        message: 'We could not extend your Canvas authorization because your refresh credentials could not be found.',
                        code: ErrorCode_js_1.default.RefreshFailedDueToTokenMissing,
                    });
                }
                specificCanvasCreds = developerCredentials[launchInfo.canvasHost];
                if (!specificCanvasCreds) {
                    // No credentials for this Canvas host
                    throw new caccl_error_1.default({
                        message: 'Your Canvas session could not be extended. Please contact support.',
                        code: ErrorCode_js_1.default.NoCreds,
                    });
                }
                _b.label = 2;
            case 2:
                _b.trys.push([2, 5, , 6]);
                return [4 /*yield*/, (0, caccl_send_request_1.default)({
                        host: launchInfo.canvasHost,
                        path: '/login/oauth2/token',
                        method: 'POST',
                        params: {
                            grant_type: 'refresh_token',
                            refresh_token: tokenPack.refreshToken,
                            client_id: specificCanvasCreds.clientId,
                            client_secret: specificCanvasCreds.clientSecret,
                        },
                    })];
            case 3:
                body = (_b.sent()).body;
                expiresIn = (body.expires_in * 0.99 * 1000);
                newTokenPack = {
                    accessToken: body.access_token,
                    refreshToken: (body.refresh_token || tokenPack.refreshToken),
                    accessTokenExpiry: (Date.now() + expiresIn),
                    canvasHost: launchInfo.canvasHost,
                };
                // Save in the store
                return [4 /*yield*/, tokenStore.set("".concat(launchInfo.canvasHost, "/").concat(launchInfo.userId), newTokenPack)];
            case 4:
                // Save in the store
                _b.sent();
                // Return new token pack
                return [2 /*return*/, newTokenPack];
            case 5:
                err_1 = _b.sent();
                throw new caccl_error_1.default({
                    message: 'Your Canvas session could not be extended. Please contact support.',
                    code: ErrorCode_js_1.default.RefreshFailed,
                });
            case 6: return [2 /*return*/];
        }
    });
}); };
/*------------------------------------------------------------------------*/
/*                           Main Functionality                           */
/*------------------------------------------------------------------------*/
/**
 * Initializes the token manager on the given express app
 * @author Gabriel Abrams
 * @param {object} opts object containing all arguments
 * @param {object} opts.app - express app
 * @param {DeveloperCredentials} opts.developerCredentials canvas app developer
 *   credentials map
 * @param {InitCACCLStore} [opts.initTokenStore=memory store factory] a function
 *   that creates a store for keeping track of user's API tokens and auth status
 * @param {string[]} [opts.scopes] list of scope strings
 *   (e.g. url:GET|/api/v1/courses). These scopes will be included
 *   in all authorization requests
 */
var initAuth = function (opts) { return __awaiter(void 0, void 0, void 0, function () {
    var scopesQueryAddon;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                // Check if required opts are included
                if (!opts
                    || !opts.app
                    || !opts.developerCredentials) {
                    throw new caccl_error_1.default({
                        message: 'Token manager initialized improperly: at least one required option was not included. We require app, developerCredentials',
                        code: ErrorCode_js_1.default.RequiredOptionExcluded,
                    });
                }
                // Make sure init isn't called more than once
                if (tokenStore || developerCredentials) {
                    throw new caccl_error_1.default({
                        message: 'CACCL Authorizer cannot be initialized more than one.',
                        code: ErrorCode_js_1.default.InitializedMoreThanOnce,
                    });
                }
                scopesQueryAddon = (opts.scopes
                    ? "&scopes=".concat(encodeURIComponent(opts.scopes.join(' ')))
                    : undefined);
                return [4 /*yield*/, (opts.initTokenStore
                        ? opts.initTokenStore(TOKEN_LIFESPAN_SEC_js_1.default)
                        : (0, caccl_memory_store_1.default)(TOKEN_LIFESPAN_SEC_js_1.default))];
            case 1:
                // Initialize token store
                tokenStore = _a.sent();
                // Save copy of credentials
                developerCredentials = opts.developerCredentials;
                /*------------------------------------------------------------------------*/
                /*                          Authorization Process                         */
                /*------------------------------------------------------------------------*/
                // Step 0: Intercept errors
                opts.app.get(CACCL_PATHS_1.default.AUTHORIZE, function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
                    var error, description;
                    return __generator(this, function (_a) {
                        if (req.query.error || req.query.error_description) {
                            error = (String(req.query.error || 'unknown_error')
                                .split('_')
                                .map(function (word) {
                                if (word.length <= 1) {
                                    return word.toUpperCase();
                                }
                                // Capitalize the word
                                return "".concat(word.substring(0, 1).toUpperCase()).concat(word.substring(1));
                            })
                                .join(' '));
                            description = decodeURIComponent(String(req.query.error_description
                                || 'No+further+description+could+be+found.')).replace(/\+/g, ' ');
                            return [2 /*return*/, res.status(403).send("A launch error occurred: ".concat(error, ". ").concat(description))];
                        }
                        // No error occurred. Continue
                        return [2 /*return*/, next()];
                    });
                }); });
                // Step 1: Try to refresh, if not possible, redirect to authorization screen
                opts.app.get(CACCL_PATHS_1.default.AUTHORIZE, function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, launched, launchInfo, tokenPack, err_2, authURL;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = (0, caccl_lti_1.getLaunchInfo)(req), launched = _a.launched, launchInfo = _a.launchInfo;
                                if (!launched) {
                                    // No session! Cannot authorize without session
                                    return [2 /*return*/, res.status(403).send('We could not authorize you with Canvas because your session has expired.')];
                                }
                                // Skip if not step 1
                                if (req.query.code && req.query.state) {
                                    return [2 /*return*/, next()];
                                }
                                // Only allow auth if LTI launch occurred
                                if (!launched) {
                                    // Cannot authorize
                                    return [2 /*return*/, res.status(403).send('Your session has expired. Please launch this app again via Canvas.')];
                                }
                                return [4 /*yield*/, tokenStore.get("".concat(launchInfo.canvasHost, "/").concat(launchInfo.userId))];
                            case 1:
                                tokenPack = _b.sent();
                                if (!tokenPack) return [3 /*break*/, 5];
                                _b.label = 2;
                            case 2:
                                _b.trys.push([2, 4, , 5]);
                                return [4 /*yield*/, refreshAuth(req)];
                            case 3:
                                _b.sent();
                                return [3 /*break*/, 5];
                            case 4:
                                err_2 = _b.sent();
                                // Refresh failed. Show error to user
                                return [2 /*return*/, res.status(403).send('Your Canvas authorization has expired and we could not refresh your credentials.')];
                            case 5:
                                authURL = "https://".concat(launchInfo.canvasHost, "/login/oauth2/auth?client_id=").concat(opts.developerCredentials[launchInfo.canvasHost].clientId, "&response_type=code&redirect_uri=https://").concat(req.hostname).concat(CACCL_PATHS_1.default.AUTHORIZE, "&state=caccl").concat(scopesQueryAddon);
                                return [2 /*return*/, res.redirect(authURL)];
                        }
                    });
                }); });
                // Step 2: Receive code or denial
                opts.app.get(CACCL_PATHS_1.default.AUTHORIZE, function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, code, error, _b, launched, launchInfo, specificCanvasCreds, response, err_3, body, expiresIn, newTokenPack, err_4;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                // Skip unless we have a code OR error and state indicates this is CACCL
                                if (!req.query
                                    || !req.query.state
                                    || req.query.state !== 'caccl'
                                    || (!req.query.code && !req.query.error)) {
                                    return [2 /*return*/, next()];
                                }
                                _a = req.query, code = _a.code, error = _a.error;
                                // Check for invalid Canvas response
                                if (!code && !error) {
                                    // Canvas responded weirdly
                                    return [2 /*return*/, res.status(403).send('We could not get your authorization with Canvas because Canvas responded in an unexpected way.')];
                                }
                                _b = (0, caccl_lti_1.getLaunchInfo)(req), launched = _b.launched, launchInfo = _b.launchInfo;
                                if (!launched) {
                                    // No session
                                    return [2 /*return*/, res.status(403).send('We could not get your authorization with Canvas because your session has expired.')];
                                }
                                // Check if we encountered an internal error
                                if (!code
                                    && error
                                    && error === 'unsupported_response_type') {
                                    return [2 /*return*/, res.status(403).send('We could not get your authorization with Canvas because Canvas would not start the authorization process.')];
                                }
                                // Check if access was denied
                                if (!code) {
                                    // Access was denied
                                    return [2 /*return*/, res.status(403).send('We could not get your authorization with Canvas because your access was denied. Please contact your Canvas support team.')];
                                }
                                specificCanvasCreds = developerCredentials[launchInfo.canvasHost];
                                if (!specificCanvasCreds) {
                                    // No credentials for this Canvas host
                                    return [2 /*return*/, res.status(403).send('We could not get your authorization with Canvas because this app is not ready to integrate with your instance of Canvas.')];
                                }
                                _c.label = 1;
                            case 1:
                                _c.trys.push([1, 3, , 4]);
                                return [4 /*yield*/, (0, caccl_send_request_1.default)({
                                        host: launchInfo.canvasHost,
                                        path: '/login/oauth2/token',
                                        method: 'POST',
                                        params: {
                                            code: code,
                                            grant_type: 'authorization_code',
                                            client_id: specificCanvasCreds.clientId,
                                            client_secret: specificCanvasCreds.clientSecret,
                                            redirect_uri: "https://".concat(req.hostname).concat(CACCL_PATHS_1.default.AUTHORIZE),
                                        },
                                        ignoreSSLIssues: launchInfo.canvasHost.startsWith('localhost'),
                                    })];
                            case 2:
                                response = _c.sent();
                                return [3 /*break*/, 4];
                            case 3:
                                err_3 = _c.sent();
                                // Could not trade auth code for tokens
                                return [2 /*return*/, res.status(403).send('We could not get your authorization with Canvas because Canvas did not respond to our request for tokens.')];
                            case 4:
                                body = response.body;
                                // Detect invalid client_secret error
                                if (body.error && body.error === 'invalid_client') {
                                    // Save status
                                    return [2 /*return*/, res.status(403).send('We could not get your authorization with Canvas because Canvas would not recognize this app.')];
                                }
                                expiresIn = (body.expires_in * 0.99 * 1000);
                                newTokenPack = {
                                    accessToken: body.access_token,
                                    refreshToken: body.refresh_token,
                                    accessTokenExpiry: (Date.now() + expiresIn),
                                    canvasHost: launchInfo.canvasHost,
                                };
                                _c.label = 5;
                            case 5:
                                _c.trys.push([5, 7, , 8]);
                                return [4 /*yield*/, tokenStore.set("".concat(launchInfo.canvasHost, "/").concat(launchInfo.userId), newTokenPack)];
                            case 6:
                                _c.sent();
                                return [3 /*break*/, 8];
                            case 7:
                                err_4 = _c.sent();
                                return [2 /*return*/, res.status(403).send('We could not get your authorization with Canvas because your credentials could not be stored.')];
                            case 8: 
                            // We're done authorizing. Redirect to homepage
                            return [2 /*return*/, res.redirect(CACCL_PATHS_1.default.HOME)];
                        }
                    });
                }); });
                return [2 /*return*/];
        }
    });
}); };
/*------------------------------------------------------------------------*/
/*                            Get Access Token                            */
/*------------------------------------------------------------------------*/
/**
 * Get the user's current access token
 * @author Gabe Abrams
 * @async
 * @param {express.Request} req express request instance
 * @returns {Promise<string>} user's current access token
 */
var getAccessToken = function (req) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, launched, launchInfo, tokenPack;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = (0, caccl_lti_1.getLaunchInfo)(req), launched = _a.launched, launchInfo = _a.launchInfo;
                // Show an error if user has not launched
                if (!launched) {
                    throw new caccl_error_1.default({
                        message: 'We could not find the current user\'s access token because the current user has no session.',
                        code: ErrorCode_js_1.default.GetFailedNoSession,
                    });
                }
                return [4 /*yield*/, tokenStore.get("".concat(launchInfo.canvasHost, "/").concat(launchInfo.userId))];
            case 1:
                tokenPack = _b.sent();
                if (!tokenPack) {
                    // User is not authorized
                    throw new caccl_error_1.default({
                        message: 'We could not find the current user\'s access token because the current user is not authorized.',
                        code: ErrorCode_js_1.default.GetFailedNoAuthorization,
                    });
                }
                if (!(Date.now() >= tokenPack.accessTokenExpiry - FIVE_MINS_MS)) return [3 /*break*/, 3];
                return [4 /*yield*/, refreshAuth(req)];
            case 2:
                // Need to refresh!
                tokenPack = _b.sent();
                _b.label = 3;
            case 3: 
            // Return the access token
            return [2 /*return*/, tokenPack.accessToken];
        }
    });
}); };
exports.getAccessToken = getAccessToken;
/*------------------------------------------------------------------------*/
/*                                 Exports                                */
/*------------------------------------------------------------------------*/
// Export initAuth
exports.default = initAuth;
//# sourceMappingURL=index.js.map