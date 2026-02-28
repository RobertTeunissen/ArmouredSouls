# User Registration Module — Error Code Reference

This document lists every error code returned by the registration and login endpoints, the HTTP status associated with each, the exact error message text, recommended client handling, and a troubleshooting guide for common issues.

For full endpoint schemas see the [OpenAPI specification](../api/authentication.yaml).

---

## Error Response Format

All error responses follow a consistent JSON structure:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE"
}
```

| Field   | Type   | Required | Description                              |
|---------|--------|----------|------------------------------------------|
| `error` | string | Yes      | Human-readable message safe to display   |
| `code`  | string | Yes      | Machine-readable code for client routing |

---

## Error Code Reference

### Validation Errors — `400 Bad Request`

These errors are returned when the request body fails input validation.

#### `VALIDATION_ERROR`

Returned when one or more fields fail format or length validation. The `error` field contains a comma-separated list when multiple rules are violated simultaneously.

| Condition                        | Error Message                                                                  |
|----------------------------------|--------------------------------------------------------------------------------|
| Username shorter than 3 chars    | Username must be at least 3 characters long                                    |
| Username longer than 20 chars    | Username must not exceed 20 characters                                         |
| Username has invalid characters  | Username can only contain letters, numbers, underscores, and hyphens           |
| Email shorter than 3 chars       | Email must be at least 3 characters long                                       |
| Email longer than 20 chars       | Email must not exceed 20 characters                                            |
| Email has invalid characters     | Email can only contain letters, numbers, underscores, and hyphens              |
| Password shorter than 8 chars    | Password must be at least 8 characters long                                    |
| Password longer than 128 chars   | Password must not exceed 128 characters                                        |
| Missing required fields          | Username, email, and password are required                                     |

Multiple validation errors are joined with `, ` in a single `error` string. For example:

```json
{
  "error": "Username must be at least 3 characters long, Password must be at least 8 characters long",
  "code": "VALIDATION_ERROR"
}
```

**Recommended client handling:**
- Parse the `error` string and display it to the user near the relevant form field(s).
- If you need per-field granularity, split on `, ` and match keywords (`Username`, `Email`, `Password`) to map messages to fields.
- Clear displayed errors when the user edits the corresponding field.

---

#### `DUPLICATE_USERNAME`

Returned when the submitted username already exists in the database.

| Condition                | Error Message              |
|--------------------------|----------------------------|
| Username already taken   | Username is already taken  |

```json
{
  "error": "Username is already taken",
  "code": "DUPLICATE_USERNAME"
}
```

**Recommended client handling:**
- Display the message next to the username field.
- Prompt the user to choose a different username.

---

#### `DUPLICATE_EMAIL`

Returned when the submitted email already exists in the database.

| Condition                  | Error Message                |
|----------------------------|------------------------------|
| Email already registered   | Email is already registered  |

```json
{
  "error": "Email is already registered",
  "code": "DUPLICATE_EMAIL"
}
```

**Recommended client handling:**
- Display the message next to the email field.
- Suggest the user log in instead if they already have an account.

---

### Authentication Errors — `401 Unauthorized`

#### `INVALID_CREDENTIALS`

Returned by the login endpoint when the identifier or password is incorrect. The message is intentionally generic to avoid revealing whether the identifier or the password was wrong.

| Condition                          | Error Message                    |
|------------------------------------|----------------------------------|
| Unknown identifier                 | Invalid credentials              |
| Wrong password for known user      | Invalid credentials              |

```json
{
  "error": "Invalid credentials",
  "code": "INVALID_CREDENTIALS"
}
```

> **Note:** The login endpoint also returns a `400` with message `"Identifier and password are required"` (no `code` field) when the request body is missing the identifier or password.

**Recommended client handling:**
- Display a single generic message such as "Invalid username/email or password."
- Do not attempt to distinguish between "user not found" and "wrong password" — the server intentionally hides this.

---

### Rate Limiting Errors — `429 Too Many Requests`

Returned when the client exceeds the allowed number of requests within the rate-limit window. Both the registration and login endpoints share the same rate limiter.

| Condition              | Error Message                                  |
|------------------------|------------------------------------------------|
| Rate limit exceeded    | Too many requests. Please try again later.     |

```json
{
  "error": "Too many requests. Please try again later."
}
```

> **Note:** The 429 response may not include a `code` field depending on the rate-limiter middleware.

**Recommended client handling:**
- Disable the submit button and show a countdown or "try again later" message.
- Implement exponential back-off if retrying programmatically.
- Do not retry immediately — respect the rate-limit window.

---

### Server Errors — `500 Internal Server Error`

#### `DATABASE_ERROR`

Returned when a database operation fails (connection issue, constraint violation, etc.). Internal details are logged server-side but never exposed to the client.

| Condition                | Error Message                                                      |
|--------------------------|--------------------------------------------------------------------|
| Database error (register)| An error occurred during registration. Please try again.           |
| Database error (login)   | An error occurred during login. Please try again.                  |

```json
{
  "error": "An error occurred during registration. Please try again.",
  "code": "DATABASE_ERROR"
}
```

**Recommended client handling:**
- Display a generic "something went wrong" message.
- Offer a retry button.
- If the error persists, suggest the user try again later or contact support.

---

#### `INTERNAL_ERROR`

Returned for any unexpected, non-database error. Full details are logged server-side.

| Condition                | Error Message                                          |
|--------------------------|--------------------------------------------------------|
| Unexpected error         | An unexpected error occurred. Please try again.        |

```json
{
  "error": "An unexpected error occurred. Please try again.",
  "code": "INTERNAL_ERROR"
}
```

**Recommended client handling:**
- Same as `DATABASE_ERROR` — display a generic message and offer retry.
- Log the occurrence client-side (without sensitive data) for diagnostics.

---

## Quick-Reference Table

| Code                 | HTTP | Endpoint(s)       | Error Message (summary)                                  |
|----------------------|------|--------------------|----------------------------------------------------------|
| `VALIDATION_ERROR`   | 400  | Register           | Field-specific validation message(s)                     |
| `DUPLICATE_USERNAME` | 400  | Register           | Username is already taken                                |
| `DUPLICATE_EMAIL`    | 400  | Register           | Email is already registered                              |
| `INVALID_CREDENTIALS`| 401  | Login              | Invalid credentials                                      |
| *(none)*             | 429  | Register, Login    | Too many requests. Please try again later.               |
| `DATABASE_ERROR`     | 500  | Register, Login    | An error occurred during registration/login. Please try again. |
| `INTERNAL_ERROR`     | 500  | Register, Login    | An unexpected error occurred. Please try again.          |

---

## Troubleshooting Guide

### "Username is already taken" but I haven't registered

The username may have been claimed by another user or created during database seeding. Choose a different username.

### "Email is already registered" for a new email

Similar to usernames — the email may already exist from seed data or a previous migration that assigned placeholder emails (`{username}@legacy.local`). Try a different email value.

### "Username, email, and password are required"

The request body is missing one or more fields, or a field is an empty string. Ensure all three fields are present and non-empty in the JSON body.

### Multiple validation errors in one response

The server validates all fields in a single pass and returns every violation joined by `, `. Fix all reported issues before resubmitting.

### "Invalid credentials" but I'm sure the password is correct

- Verify you are using the correct username **or** email — the login endpoint accepts either.
- Passwords are case-sensitive.
- If you registered recently, ensure the registration request returned `201` (the account may not have been created if there was an error).

### "Too many requests" immediately after one attempt

The rate limiter is shared between registration and login. If you made several login attempts first, the registration endpoint may already be throttled. Wait for the rate-limit window to reset (default: 1 hour).

### 500 errors during registration

- Check that the database is running and accessible.
- Verify the `DATABASE_URL` environment variable is set correctly.
- Review server logs for the full error details — the client response intentionally hides internals.
- If the error is intermittent, it may be a transient database connectivity issue — retry after a short delay.

### Password confirmation mismatch (client-side only)

The "Passwords do not match" error is enforced by the frontend registration form before the request is sent. It does not produce a server-side error code. Ensure both password fields contain identical values.
