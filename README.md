# Komatsu API Marketplace Portal

React + Vite SPA scaffold for the Komatsu API Marketplace portal UI.

## Setup

1. Install dependencies:
   - `npm install`
2. Copy `.env.example` to `.env` and fill in Entra ID + KPS values.
3. Start the dev server:
   - `npm run dev`

## Notes

- The app expects a Portal API base at `VITE_PORTAL_API_BASE` (default `/api`).
- Login uses the KPS tenant-selection flow before MSAL redirects.
- `VITE_USE_MOCK_AUTH` allows local UI work without Entra ID/KPS.

## Auth Flow

- KPS tenant selection runs before MSAL initialization.
- MSAL redirects use the tenant-specific authority and land on `/`.
- Front-channel logout is handled at `/sso-logout`.

## Auth Env Vars

- `VITE_ENTRA_CLIENT_ID`: Entra app client id.
- `VITE_EXTERNAL_TENANT_ID`: CIAM tenant id (external users).
- `VITE_WORKFORCE_TENANT_ID`: Workforce tenant id.
- `VITE_CIAM_HOST`: CIAM host (default `kltdexternaliddev.ciamlogin.com`).
- `VITE_KPS_URL`: KPS tenant selection URL.
- `VITE_LOGIN_SCOPES`: MSAL login scopes (comma-separated).
- `VITE_LOGOUT_MODE`: `client-only`, `msal-only`, `full`, `msal-plus-bff`.
- `VITE_AEM_LOGOUT_URL` or `VITE_CDN_ICON`: SLO helper for AEM logout.
- `VITE_BASE_URL`: Base for post-logout redirect (defaults to origin).

## Troubleshooting Login

- `AADSTS900144` (missing `client_id`): ensure `.env` exists, `VITE_ENTRA_CLIENT_ID` is set, and restart `npm run dev`.
- Stuck redirecting: clear `localStorage` `tenantId`/`email` and retry KPS; verify `VITE_KPS_URL`.
- Logout loop: check `VITE_BASE_URL` and front-channel logout route `/sso-logout` is registered in Entra.
- Scope errors (invalid or insufficient scope): verify `VITE_LOGIN_SCOPES` and `VITE_PORTAL_API_SCOPE` match the Entra app registrations and consented permissions.
