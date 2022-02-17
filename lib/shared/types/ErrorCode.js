"use strict";
// Highest error code: CAT11
Object.defineProperty(exports, "__esModule", { value: true });
var ErrorCode;
(function (ErrorCode) {
    // index.js
    ErrorCode["InvalidTokenPackage"] = "CAT1";
    ErrorCode["TokenStoreInvalidWrongFunctions"] = "CAT2";
    ErrorCode["TokenStoreInvalidNotFunctions"] = "CAT3";
    ErrorCode["RequiredOptionExcluded"] = "CAT4";
    ErrorCode["RefreshFailed"] = "CAT5";
    ErrorCode["InitializedMoreThanOnce"] = "CAT6";
    ErrorCode["RefreshFailedDueToSessionExpiry"] = "CAT7";
    ErrorCode["NotInitialized"] = "CAT8";
    ErrorCode["RefreshFailedDueToTokenMissing"] = "CAT9";
    ErrorCode["GetFailedNoSession"] = "CAT10";
    ErrorCode["GetFailedNoAuthorization"] = "CAT11";
})(ErrorCode || (ErrorCode = {}));
;
exports.default = ErrorCode;
//# sourceMappingURL=ErrorCode.js.map