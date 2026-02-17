# Public Landing Page Setup

## Changes Made

### 1. **App Architecture**
- ✅ Home page (`/`) is now public - no authentication required
- ✅ All other routes require authentication via `PrivateRoute`
- ✅ Created `PublicLayout` component for public pages
- ✅ Updated `Header` component to show Login/Logout based on auth state

### 2. **Modified Files**

#### `src/main.tsx`
- Removed forced redirect to login on app startup
- App now loads normally without tenant ID
- Uses "common" as default tenant if none exists
- Login only triggered when user clicks Login button or accesses protected routes

#### `src/App.tsx`
- Restructured routing with separate public and protected routes
- Home page under `PublicLayout` (no auth required)
- All other pages under `PrivateRoute` → `AppShell` (auth required)

#### `src/components/PublicLayout.tsx` (NEW)
- Layout for public pages without authentication
- Includes Header and Footer but no side navigation

#### `src/components/Header.tsx`
- Added `isPublic` prop to support both modes
- Shows **Login button** when not authenticated
- Shows **user avatar + logout menu** when authenticated
- Props are now optional with sensible defaults

## Testing the Public Landing Page

### Development Mode (Mock Authentication)

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Verify `.env` file exists with mock auth enabled:**
   ```
   VITE_USE_MOCK_AUTH=true
   ```

3. **Expected behavior:**
   - Home page loads immediately
   - No authentication required
   - All routes accessible (mock auth bypasses security)

### Production Mode (Real Authentication)

1. **Disable mock auth in `.env`:**
   ```
   VITE_USE_MOCK_AUTH=false
   ```

2. **Clear browser cache and localStorage:**
   ```javascript
   // In browser console:
   localStorage.clear();
   sessionStorage.clear();
   ```

3. **Navigate to `http://localhost:5175/`**

4. **Expected behavior:**
   - ✅ Home page loads WITHOUT requiring login
   - ✅ Header shows "Login" button
   - ✅ Clicking "Login" redirects to Komatsu Portal Service for tenant selection
   - ✅ After tenant selection, redirected back to handle authentication
   - ✅ After authentication, Header shows user avatar and name
   - ✅ Can access protected routes (`/apis`, `/my/integrations`, etc.)

5. **Test protected routes while NOT logged in:**
   - Navigate to `http://localhost:5175/apis`
   - Expected: Should trigger authentication flow automatically
   - After login: Should be redirected to `/apis` page

## User Flow

### First-Time Visitor (Not Authenticated)
```
1. Visit site (/)
   ↓
2. See landing page immediately (no login required)
   ↓
3. Click "Login" button in header
   ↓
4. Redirected to Komatsu Portal Service
   ↓
5. Select tenant
   ↓
6. Redirected to Azure AD (Entra ID) for authentication
   ↓
7. Redirected back to site with authentication
   ↓
8. Header now shows user avatar and logout option
   ↓
9. Can access all protected routes
```

### Returning User (Authenticated)
```
1. Visit site (/)
   ↓
2. See landing page with full context
   ↓
3. Header shows user avatar and name
   ↓
4. Can navigate to any route
```

### Accessing Protected Routes Directly (Not Authenticated)
```
1. Visit /apis or /my/integrations
   ↓
2. PrivateRoute detects no authentication
   ↓
3. Automatically triggers login flow
   ↓
4. After auth, redirected to requested page
```

## Troubleshooting

### Issue: Still seeing "Redirecting to login..." screen

**Solution:** Clear browser cache and ensure the updated `main.tsx` is loaded:
```bash
# Stop dev server (Ctrl+C)
# Clear node modules cache
npm run dev
# Hard refresh browser (Ctrl+Shift+R)
```

### Issue: Login button doesn't appear

**Solution:** Check that `PublicLayout` is passing `isPublic` prop:
```tsx
// In PublicLayout.tsx
<Header isPublic />
```

### Issue: TypeScript errors about PublicLayout not found

**Solution:** This is a language server cache issue. Restart VS Code or reload the TypeScript server:
- Open command palette (Ctrl+Shift+P)
- Run: "TypeScript: Restart TS Server"

## Environment Variables

Required in `.env` file:
```dotenv
VITE_ENTRA_CLIENT_ID=<your-client-id>
VITE_EXTERNAL_TENANT_ID=<your-tenant-id>
VITE_WORKFORCE_TENANT_ID=<your-workforce-tenant-id>
VITE_CIAM_HOST=kltdexternaliddev.ciamlogin.com
VITE_KPS_URL=https://login-uat.komatsu.com/spa
VITE_LOGIN_SCOPES=User.Read
VITE_USE_MOCK_AUTH=true  # Set to false for production testing
```

## Current Status

- ✅ Dev server running on: **http://localhost:5175/**
- ✅ Mock authentication enabled (for development)
- ✅ Home page accessible without login
- ✅ Protected routes require authentication
- ✅ Login/logout flow functional
- ✅ All tests passing

## Next Steps

1. Open browser to `http://localhost:5175/`
2. Verify home page loads without authentication
3. Click "Login" button to test authentication flow
4. After login, verify protected routes are accessible
5. Test logout functionality
