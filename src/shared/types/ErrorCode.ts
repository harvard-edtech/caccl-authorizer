// Highest error code: CAT11

enum ErrorCode {
  // index.js
  InvalidTokenPackage = 'CAT1',
  TokenStoreInvalidWrongFunctions = 'CAT2',
  TokenStoreInvalidNotFunctions = 'CAT3',
  RequiredOptionExcluded = 'CAT4',
  RefreshFailed = 'CAT5',
  InitializedMoreThanOnce = 'CAT6',
  RefreshFailedDueToSessionExpiry = 'CAT7',
  NotInitialized = 'CAT8',
  RefreshFailedDueToTokenMissing = 'CAT9',
  GetFailedNoSession = 'CAT10',
  GetFailedNoAuthorization = 'CAT11',
};

export default ErrorCode;
