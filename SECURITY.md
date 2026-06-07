# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report privately via one of:

- **GitHub Security Advisories** — open a draft advisory under the repository's
  **Security → Report a vulnerability** tab (preferred).
- **Email** — yeabsiratesfaye58@gmail.com with the details below.

Include, where possible:

- A description of the issue and its impact.
- Steps to reproduce (proof-of-concept if available).
- Affected versions / commit, and any suggested remediation.

You can expect an acknowledgement within a few days. Please give a reasonable window
for a fix before any public disclosure.

## Scope

Issues in this repository's application code, configuration defaults, and
documentation are in scope. Vulnerabilities in third-party services (Clerk, Vapi,
DeepSeek, Trigger.dev, Vercel, PostgreSQL) should be reported to those vendors; if
the issue is in how talkt *uses* a service, report it here.

## Handling secrets

Never include real secrets, API keys, or connection strings in an issue, PR, or
advisory. If a secret is exposed, rotate it immediately. See
[`docs/security.md`](docs/security.md) for the project's security posture.
