# Token Store

Your custom token store object will be designed to replace the built-in memory store for storing refresh tokens. It must follow the class description below:

## Methods

### async get(key)

Get the tokens for a user
 * @param {number} canvasId -
 * @return {object}
 */

Argument | Type | Description
:--- | :--- | :---
canvasId | number | the canvasId for the user to look up

Returns:

token object in the following form: `{ refreshToken, accessToken, accessTokenExpiry }` where refreshToken and accessToken are string tokens and accessTokenExpiry is a ms since epoch expiry timestamp for the accessToken. The refreshToken is assumed to not expire

### async set(canvasId, tokens)

Store tokens for a user

Argument | Type | Description
:--- | :--- | :---
canvasId | number | the canvasId for the user to store tokens for
tokens | object | an object containing all token info to update

Allowed properties for tokens:

Argument | Type | Description
:--- | :--- | :---
tokens.refreshToken | string | if included, updates the user's current value for their refreshToken
tokens.accessToken | string | if included, updates the user's current value for their accessToken
tokens.accessTokenExpiry | number | if included, updates the user's current accessToken expiry

Returns:  
`Promise` that resolves when the store is successful.
