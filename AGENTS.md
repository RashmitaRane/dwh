# Divine Watch House — Agent & Security Guidelines

This project is a **Django** e-commerce app (SQLite, session auth, REST-style JSON APIs).  
All AI-generated code must follow the security rules below (adapted from Taha Jaffri’s checklist for this stack).

## Core security rules

### Secrets & environment variables
- Never put API keys, `SECRET_KEY`, DB URLs, or email passwords in frontend code or templates.
- Load secrets from `.env` via `os.environ` in `core/settings.py` only.
- `.env` must be in `.gitignore`; commit `.env.example` with placeholders only.

### Rate limiting
- Auth endpoints (`/api/login/`, `/api/register/`, `/api/admin-login/`): **5 requests / 15 min / IP**.
- General read APIs: **60 requests / min / IP** where appropriate.
- Use `django-ratelimit` decorators on views; never ship auth without rate limits.

### Input validation & sanitization
- Never trust client-side validation alone.
- Validate on the server: email format, string length, allowed characters, password rules.
- Return safe, generic error messages (no stack traces, no internal exception text).

### Authentication & authorization
- Use Django’s built-in auth (`create_user`, `authenticate`, `login`) — do not roll custom password crypto.
- Passwords are hashed with PBKDF2 (Django default); enforce strength rules server-side.
- Use `@csrf_protect` on all state-changing POST APIs.
- Admin actions: require `is_superuser` / `is_staff`; verify ownership on user-specific resources.
- Session cookies: `HttpOnly`; `Secure` + `SameSite` in production.

### Database security
- Use Django ORM only — **no raw SQL string concatenation**.
- Use parameterized queries if raw SQL is ever required.

### CORS
- Same-origin by default. If CORS is needed, whitelist explicit origins — **never `*` in production**.

### HTTP security headers
- Keep `SecurityMiddleware`, `CsrfViewMiddleware`, `XFrameOptionsMiddleware` enabled.
- In production (`DEBUG=False`): enable HSTS, secure cookies, SSL redirect as configured in settings.

### File uploads (admin product images)
- Validate MIME type and extension server-side for uploads.
- Enforce size limits (e.g. 5 MB images).
- Store under `MEDIA_ROOT`; serve via Django only in `DEBUG` or via signed URLs / CDN in production.
- Prefer UUID-based filenames for user uploads when adding custom upload endpoints.

### Error handling & logging
- Clients get generic messages: `"Registration failed. Please try again."`
- Log full errors server-side only (never return `str(exception)` to the browser).

### Dependency security
- Pin versions in `requirements.txt`.
- Run `pip audit` periodically; update vulnerable packages.

### XSS prevention
- Do not use `|safe` or `mark_safe` on user content in templates.
- In JavaScript, use `textContent` / `escapeHtml` before inserting user data into HTML.
- Never use `eval()` or render unsanitized HTML from API responses.

## Django-specific conventions
- Templates: `{% static %}` for assets; `{% url %}` for routes.
- APIs: JSON + CSRF token from cookie for POST requests (`credentials: 'same-origin'`).
- New endpoints must be added to `core/urls.py` and documented here if security-sensitive.

## Pre-deployment checklist
- [ ] `.env` not in git; production secrets set on host
- [ ] `DJANGO_DEBUG=False`
- [ ] `DJANGO_SECRET_KEY` is a strong random value
- [ ] `ALLOWED_HOSTS` set correctly
- [ ] HTTPS enforced; secure session/CSRF cookies
- [ ] Rate limiting active on auth routes
- [ ] `MEDIA` not exposed insecurely in production
- [ ] Email credentials only in environment variables
