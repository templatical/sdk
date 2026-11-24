---
"@templatical/types": patch
---

Remove the unused named `SdkErrorCode` members `invalid_credentials`, `token_invalid`, `token_revoked`, `browser_not_allowed`, `token_scope_mismatch`, `user_required`, `not_author`, `mcp_not_allowed`, `recipient_not_allowed`, and `send_failed`. Provider-defined code strings remain accepted through the open string type (`string & {}`), so assigning or comparing one of these strings still typechecks. A type that extracts one from the union, such as `Extract<SdkErrorCode, "user_required">`, now resolves to `never`; use the literal type (`"user_required"`) instead.
