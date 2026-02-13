# Komatsu API Marketplace Portal

React + Vite SPA scaffold for the Komatsu API Marketplace portal UI.

## Setup

1. Install dependencies:
   - `npm install`
2. Copy `.env.example` to `.env` and fill in Entra ID values.
3. Start the dev server:
   - `npm run dev`

## Notes

- The app expects a Portal API base at `VITE_PORTAL_API_BASE` (default `/api`).
- MSAL config is read from env vars; `VITE_USE_MOCK_AUTH` allows local UI work without Entra ID.
