# Security Rules for AI-Generated Apps

These core security rules must be rigorously applied to all development tasks within this project.

## Core Security Rules

*   **Secrets & Environment Variables:** Never expose secrets in frontend code. Store all API keys and database URLs in `.env` files, which must be listed in `.gitignore`. Use environment variables securely on the backend.
*   **Rate Limiting:** Protect all endpoints. Implement appropriate limits (e.g., auth, general APIs, AI endpoints) using suitable libraries.
*   **Input Validation & Sanitization:** Never trust client-side validation alone. Use server-side schema validation (e.g., Zod, Pydantic, Django Forms/Serializers) to check data types, lengths, and allowed characters before processing.
*   **Authentication & Authorization:** Rely on established libraries rather than building custom auth. Hash passwords appropriately, manage sessions/tokens securely, and always verify resource ownership on every request.
*   **Database Security:** Prevent SQL injection by strictly using ORMs (like Django ORM) or parameterized queries. Never use string concatenation for database queries.
*   **CORS Configuration:** Explicitly whitelist allowed origins. Never use wildcard (`*`) CORS in production environments.
*   **HTTP Security Headers:** Set critical security headers (e.g., CSP, HSTS, X-Frame-Options).
*   **File Upload Security:** Validate file uploads on the server using MIME types and extensions. Enforce strict size limits, ensure secure filenames, and store them securely.
*   **Error Handling & Logging:** Never leak stack traces or internal errors to the client; return generic error messages instead. Log full error context securely on the server.
*   **Dependency Security:** Keep dependencies updated and audited. Pin dependency versions for production.
*   **XSS Prevention:** Do not render dynamic user content as raw HTML without thorough sanitization.

## AI & LLM-Specific Rules

*   **Sanitize Inputs:** Clean user input before sending it to an LLM to prevent prompt injection attacks.
*   **Cost Control:** Set limits on LLM API calls and implement budgets to prevent cost-exhaustion attacks.
*   **Secure Routing:** Store LLM API keys on the server and route all AI requests through the backend. Never call an LLM API directly from the browser.
*   **Output Sanitization:** Treat LLM-generated output as untrusted data. Validate and sanitize it before rendering it in the UI to prevent Cross-Site Scripting (XSS).

## Pre-Deployment Gate

Before shipping, ensure:
*   `.env` is absent from version control.
*   Production secrets are correctly configured in the hosting environment.
*   Debug mode is disabled.
*   HTTPS is enforced, rate limiting is active, and CORS is restricted.
