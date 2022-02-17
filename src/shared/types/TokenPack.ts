type TokenPack = {
  // User's current access token
  accessToken: string,
  // User's refresh token
  refreshToken: string,
  // Timestamp of when the user's access token expires
  accessTokenExpiry: number,
  // Canvas host for this user
  canvasHost: string,
};

export default TokenPack;
