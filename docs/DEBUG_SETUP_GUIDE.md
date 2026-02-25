# Local Development & Debugging Guide

## 🎯 Quick Start

### Prerequisites
1. **Node.js** (v20 or higher)
2. **VS Code** with extensions:
   - **JavaScript Debugger** (built-in)
   - **Debugger for Chrome** or **Debugger for Edge** (for browser debugging)
3. **Azure CLI** (if using Azure Managed Identity locally)

### Initial Setup

1. **Install dependencies:**
   ```powershell
   # Install frontend dependencies
   npm install
   
   # Install BFF dependencies
   cd bff
   npm install
   cd ..
   ```

2. **Environment Configuration:**
   
   Create a `.env` file in the root directory for frontend:
   ```env
   VITE_BFF_URL=http://localhost:3001
   VITE_MSAL_CLIENT_ID=your-client-id
   VITE_MSAL_AUTHORITY=https://login.microsoftonline.com/your-tenant-id
   ```

   Create a `.env` file in the `bff/` directory:
   ```env
   NODE_ENV=development
   BFF_PORT=3001
   APIM_MANAGEMENT_URL=https://demo-apim-feb.management.azure-api.net
   APIM_API_VERSION=2021-08-01
   ```

## 🐛 Debugging Configurations

The project includes several debugging configurations accessible via the **Run and Debug** panel (Ctrl+Shift+D):

### 1. 🚀 Full Stack (Frontend + BFF) - **RECOMMENDED**
**Best option for full-stack development**

- Starts both the BFF server and opens the frontend in Chrome
- All breakpoints work simultaneously
- Best for end-to-end debugging

**How to use:**
1. Press `F5` or go to Run and Debug → "🚀 Full Stack (Frontend + BFF)"
2. Set breakpoints in both frontend (`.tsx`, `.ts`) and backend (`.js`) files
3. Interact with the app in the browser

### 2. 🌐 Launch Frontend (Chrome or Edge)
Debug the React/TypeScript frontend application

**Prerequisites:** Frontend dev server must be running
```powershell
npm run dev
```

**How to use:**
1. Start the dev server (see above)
2. Select "🌐 Launch Frontend (Chrome)" or "🌐 Launch Frontend (Edge)"
3. Press `F5`
4. Set breakpoints in your `.tsx` or `.ts` files

### 3. ⚙️ Debug BFF Server
Debug the Node.js Express backend

**How to use:**
1. Set breakpoints in `bff/server.js`
2. Select "⚙️ Debug BFF Server"
3. Press `F5`
4. The server will start with hot reload enabled (`--watch` flag)

**Environment variables** can be modified in `.vscode/launch.json`

### 4. 🔗 Attach to BFF Server
Attach debugger to an already running BFF server

**How to use:**
```powershell
# Start server with debug flag
cd bff
node --inspect server.js

# Or with watch mode
node --inspect --watch server.js
```

Then select "🔗 Attach to BFF Server" and press `F5`

### 5. 🧪 Run/Debug Tests
Debug unit tests with Vitest

**Options:**
- **Run Current Test File**: Debug the currently open test file
- **Debug All Tests**: Run all tests in debug mode

**How to use:**
1. Open a test file (e.g., `*.test.ts` or `*.test.tsx`)
2. Set breakpoints
3. Select "🧪 Run Current Test File"
4. Press `F5`

## 🛠️ VS Code Tasks

Access tasks via `Terminal > Run Task...` or `Ctrl+Shift+P` → "Tasks: Run Task":

- **Start Frontend Dev Server**: Run Vite dev server
- **Start BFF Server**: Run BFF in watch mode
- **Install All Dependencies**: Install both frontend and BFF dependencies
- **Run Tests**: Run Vitest tests
- **Run Tests with Coverage**: Run tests with coverage report

## 💡 Debugging Tips

### Setting Breakpoints

**Frontend (TypeScript/React):**
- Click in the gutter next to line numbers in `.ts` or `.tsx` files
- Or use `debugger;` statement in your code
- Breakpoints work in source maps (TypeScript → JavaScript)

**Backend (Node.js):**
- Click in the gutter next to line numbers in `.js` files
- Or use `debugger;` statement
- Use `skipFiles` to ignore node_modules (already configured)

### Debug Console
- Access via `View > Debug Console` or `Ctrl+Shift+Y`
- Evaluate expressions while paused at breakpoints
- Check variable values: `console.log(variable)`

### Watch Expressions
- Add variables to watch via the **Watch** panel
- Right-click a variable → "Add to Watch"

### Call Stack
- View the execution path in the **Call Stack** panel
- Click on stack frames to navigate through the code

### Conditional Breakpoints
- Right-click on a breakpoint → "Edit Breakpoint"
- Add a condition (e.g., `userId === '123'`)
- Breakpoint only triggers when condition is true

## 🔧 Common Debugging Scenarios

### Debugging API Calls

**Frontend side:**
```typescript
// src/api/client.ts
export async function fetchData() {
  debugger; // Breakpoint here
  const response = await fetch('/api/endpoint');
  return response.json();
}
```

**Backend side:**
```javascript
// bff/server.js
app.get('/api/endpoint', async (req, res) => {
  debugger; // Breakpoint here
  const data = await fetchFromAPIM();
  res.json(data);
});
```

### Debugging Authentication

**MSAL Frontend:**
```typescript
// src/auth/useAuth.ts
const { instance, accounts } = useMsal();
debugger; // Check accounts array
```

**BFF Managed Identity:**
```javascript
// bff/server.js - getAccessToken function
async function getAccessToken() {
  debugger; // Check token retrieval
  const tokenResponse = await credential.getToken(AZURE_MANAGEMENT_SCOPE);
  return tokenResponse.token;
}
```

### Debugging React Component Rendering

```typescript
function MyComponent({ prop1, prop2 }) {
  debugger; // Check props
  
  useEffect(() => {
    debugger; // Check effect execution
  }, [dependency]);
  
  return <div>...</div>;
}
```

## 🚨 Troubleshooting

### "Cannot connect to runtime process" (Chrome/Edge)
1. Ensure the dev server is running: `npm run dev`
2. Check the URL in launch.json matches your dev server (default: `http://localhost:5173`)
3. Close existing browser instances and try again

### Breakpoints Not Hitting (Frontend)
1. Ensure source maps are enabled (already configured in `vite.config.ts`)
2. Check the file path in the breakpoint matches the running code
3. Clear browser cache and reload

### Breakpoints Not Hitting (Backend)
1. Ensure you're using the debug configuration, not just `npm start`
2. Check that the BFF server is running in debug mode
3. Verify the correct file is being executed

### Port Already in Use
```powershell
# Kill process on port 3001 (BFF)
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Kill process on port 5173 (Vite)
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### Azure Authentication Issues (Local Development)
```powershell
# Sign in to Azure CLI
az login

# Set default subscription
az account set --subscription "<your-subscription-id>"

# Verify authentication
az account show
```

For local development without Azure credentials, you may need to mock the authentication or use a service principal.

## 🔐 Environment Variables Reference

### Frontend (.env in root)
```env
VITE_BFF_URL=http://localhost:3001
VITE_MSAL_CLIENT_ID=<your-entra-app-client-id>
VITE_MSAL_AUTHORITY=https://login.microsoftonline.com/<tenant-id>
VITE_MSAL_REDIRECT_URI=http://localhost:5173
```

### Backend (.env in bff/)
```env
NODE_ENV=development
BFF_PORT=3001
APIM_MANAGEMENT_URL=https://<your-apim>.management.azure-api.net
APIM_API_VERSION=2021-08-01

# Optional: For local development with service principal
AZURE_CLIENT_ID=<service-principal-client-id>
AZURE_CLIENT_SECRET=<service-principal-secret>
AZURE_TENANT_ID=<tenant-id>
```

## � Switching Between Mock Mode and Real APIM Data

The application supports two modes for local development:

### Mock Mode (Default) - No Azure Credentials Required
- Uses local mock data for all API endpoints
- No authentication required
- Best for development without Azure access
- Fast and reliable for UI development

### Real APIM Mode - Connects to Azure APIM
- Fetches real data from Azure API Management instance
- Requires Azure authentication and permissions
- Best for integration testing and validating real API responses

---

### 🧪 Switch to Mock Mode

**1. Configure BFF Server** (file: `bff/.env`):
```env
USE_MOCK_MODE=true
```

**2. Configure Frontend** (file: `.env.local` or `.env.development`):
```env
VITE_USE_MOCK_AUTH=true
VITE_USE_MOCK_DATA=true
```

**3. Restart Both Servers:**
```powershell
# Stop all Node processes
taskkill /F /IM node.exe

# Start BFF server
cd bff
npm start

# Start frontend (in a new terminal)
cd ..
npm run dev
```

**4. Verify Mock Mode:**
```powershell
# Test mock endpoints
curl http://localhost:3001/news
curl http://localhost:3001/apis
curl http://localhost:3001/users/me/subscriptions
```

You should see mock data returned immediately without Azure authentication.

---

### ☁️ Switch to Real APIM Mode

**Prerequisites:**
1. **Azure CLI** installed and authenticated
2. **Azure RBAC Role** on the APIM instance:
   - `API Management Service Reader` (read-only), OR
   - `API Management Service Contributor` (read-write)

**1. Authenticate to Azure:**
```powershell
# Sign in to Azure
az login

# Verify your subscription
az account show

# List your subscriptions if needed
az account list --output table

# Set the correct subscription
az account set --subscription "KAC_DigitalOffice_devtest_sub_01"
```

**2. Configure BFF Server** (file: `bff/.env`):
```env
# Disable mock mode
USE_MOCK_MODE=false

# Azure APIM Configuration
APIM_MANAGEMENT_URL=https://demo-apim-feb.management.azure-api.net
APIM_API_VERSION=2021-08-01

# User-Assigned Managed Identity (if applicable)
MANAGED_IDENTITY_CLIENT_ID=2c46c615-a962-4ce7-a2f9-cc0610ff2043
```

**3. Configure Frontend** (file: `.env.local`):
```env
# Disable mock authentication
VITE_USE_MOCK_AUTH=false
VITE_USE_MOCK_DATA=false

# Real Azure AD Configuration
VITE_ENTRA_CLIENT_ID=2ba49c18-f3b7-41e8-b1a8-15b95f3e662a
VITE_EXTERNAL_TENANT_ID=511e2453-090d-480c-abeb-d2d95388a675
VITE_WORKFORCE_TENANT_ID=58be8688-6625-4e52-80d8-c17f3a9ae08a

# BFF URL
VITE_BFF_URL=http://localhost:3001
```

**4. Restart Both Servers:**
```powershell
# Stop all Node processes
taskkill /F /IM node.exe

# Start BFF server
cd bff
npm start

# Start frontend (in a new terminal)
cd ..
npm run dev
```

**5. Verify Real APIM Connection:**

Check BFF terminal output for:
```
✅ Azure Managed Identity credential initialized
🔑 Access token acquired, expires at 2026-02-25T17:51:15.000Z
🔄 Proxying to: https://demo-apim-feb.management.azure-api.net/apis?api-version=2021-08-01
✅ Response: 200 OK
```

Test endpoints:
```powershell
# Test real APIM connection
curl "http://localhost:3001/apis?api-version=2021-08-01"
```

---

### 🔐 Required Azure Permissions

To use **Real APIM Mode**, your Azure account needs one of these roles on the APIM instance:

| Role | Access Level | Recommended For |
|------|-------------|-----------------|
| **API Management Service Reader** | Read-only access to APIM | Local development, viewing APIs |
| **API Management Service Contributor** | Full read/write access | Development, testing API changes |
| **Owner** | Full access + RBAC management | Not recommended for development |

**Request Access:**
1. Contact your Azure administrator
2. Provide the following details:
   ```
   Resource: demo-apim-feb
   Resource Group: kac_apimarketplace_eus_dev_rg
   Subscription: KAC_DigitalOffice_devtest_sub_01 (121789fa-2321-4e44-8aee-c6f1cd5d7045)
   Required Role: API Management Service Reader Role
   Purpose: Access APIM Management API for local development
   ```

**Verify Your Access:**
```powershell
# Check if you can read APIM instance
az apim show --name demo-apim-feb --resource-group kac_apimarketplace_eus_dev_rg

# List APIs (requires Reader role)
az apim api list --resource-group kac_apimarketplace_eus_dev_rg --service-name demo-apim-feb
```

---

### ⚠️ Common Issues When Using Real APIM Mode

**1. "AuthorizationFailed" Error**
```
Error: The client does not have authorization to perform action 'Microsoft.ApiManagement/service/apis/read'
```

**Solution:**
- You don't have the required RBAC role on the APIM instance
- Request `API Management Service Reader` role from your admin
- Switch back to mock mode while waiting for permissions

**2. "Token Expired" or "Authentication Failed"**
```
Error: Failed to acquire access token
```

**Solution:**
```powershell
# Clear and refresh Azure credentials
az account clear
az login
```

**3. "404 Not Found" from APIM**
```
✅ Response: 404 Not Found
```

**Solution:**
- The API endpoint path might be incorrect
- Verify APIM Management URL in `bff/.env`
- Check API version parameter (should be `2021-08-01`)

**4. BFF Returns Mock Data Even When Mock Mode is Disabled**

**Solution:**
```powershell
# Verify environment variables are loaded
cd bff
node -e "require('dotenv').config(); console.log(process.env.USE_MOCK_MODE)"

# Should output: false

# Restart BFF server to reload .env
taskkill /F /IM node.exe
npm start
```

---

### 📊 Quick Reference: Mock vs Real Mode Configuration

| Component | Mock Mode | Real APIM Mode |
|-----------|-----------|----------------|
| **BFF (`bff/.env`)** | `USE_MOCK_MODE=true` | `USE_MOCK_MODE=false` |
| **Frontend (`.env.local`)** | `VITE_USE_MOCK_AUTH=true`<br/>`VITE_USE_MOCK_DATA=true` | `VITE_USE_MOCK_AUTH=false`<br/>`VITE_USE_MOCK_DATA=false` |
| **Azure CLI** | Not required | Required (`az login`) |
| **RBAC Permissions** | None needed | Reader/Contributor role |
| **Authentication** | Bypassed | Full MSAL + Managed Identity |
| **Data Source** | Local mock data | Azure APIM Management API |

---

## �📚 Additional Resources

- [VS Code Debugging Documentation](https://code.visualstudio.com/docs/editor/debugging)
- [Vite Documentation](https://vitejs.dev/)
- [Node.js Debugging Guide](https://nodejs.org/en/docs/guides/debugging-getting-started/)
- [React Developer Tools](https://react.dev/learn/react-developer-tools)
- [Azure Identity SDK](https://learn.microsoft.com/en-us/javascript/api/overview/azure/identity-readme)

## 🎓 Pro Tips

1. **Use the compound configuration** "🚀 Full Stack" for the best debugging experience
2. **Keep the Debug Console open** to catch errors early
3. **Use logpoints** instead of `console.log` for temporary logging (right-click breakpoint → "Add Logpoint")
4. **Enable "Debug: JavaScript: Auto Attach"** in VS Code settings for automatic Node.js debugging
5. **Install React Developer Tools** browser extension for component inspection
6. **Use VS Code's built-in terminal** to see all output in one place

Happy Debugging! 🎉
