# Token Store

Your custom token store object will be designed to replace the built-in memory store for storing refresh tokens. It must follow the class description below:

## Methods

### get(key)

Argument | Type | Description
:--- | :--- | :---
key | string | the storage key

Returns:  
`Promise` that resolves with the value associated with the given key.

### set(key, value)

Argument | Type | Description
:--- | :--- | :---
key | string | the storage key
value | string | the value to store

Returns:  
`Promise` that resolves when the store is successful.
