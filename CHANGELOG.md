# Changelog

All notable changes to this project will be documented in this file.

## 1.1.0

Major breaking authorization change: instead of accessTokens being stored in the user's session, they are stored in the tokenStore. This means two things: first, that CACCL now supports users being logged into your app in more than one session, and second, that tokenStores must be able to store slightly larger payloads (instead of just the refreshToken, we are now also storing accessToken and expiry timestamp).
