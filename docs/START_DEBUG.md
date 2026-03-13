# 🚀 Quick Start - Debugging Guide

## ✅ Step-by-Step Process (Recommended)

### Option 1: .NET BFF + Frontend (Recommended)

This is the **recommended** approach using the ASP.NET Core 10 BFF:

#### Step 1: Start the .NET BFF
```powershell
cd bff-dotnet
dotnet restore --source https://api.nuget.org/v3/index.json  # Only needed first time
dotnet run
```

Wait for this message:
```
APIM Portal BFF (.NET 10) Started
Port:          http://localhost:3001
API Mode:      Mock
Auth:          Mock Mode (Development)
⚠ Running in MOCK MODE — all API calls return static data
```

> **Note:** Mock mode is enabled by default in the Development environment (`Features:UseMockMode=true` in `appsettings.Development.json`). This allows local development without Azure credentials.

Access the **Scalar API explorer** at http://localhost:3001/scalar/v1 to test endpoints interactively.

#### Step 2: Start the Frontend
Open a **new terminal** (keep the BFF running):
```powershell
npm install  # Only needed first time
npm run dev
```

Wait for: `Local: http://localhost:5173/`

#### Step 3: Start Debugging
1. Open the **Run and Debug** panel (`Ctrl+Shift+D`)
2. Select **"🌐 Launch Frontend (Chrome)"** from the dropdown
3. Press `F5`
4. Chrome will open with the debugger attached

#### Step 4: Set Breakpoints
- **Frontend**: Open any `.tsx` or `.ts` file, click in the gutter to set breakpoints
- **.NET BFF**: Open any `.cs` file in `bff-dotnet/` (e.g., `Endpoints/ApisEndpoints.cs`, `Services/ArmApiService.cs`)

You're now debugging! 🎉

---

### Option 2: Node.js BFF + Frontend (Legacy — reference only)

> **⚠️ Deprecated:** The Node.js BFF is no longer used in Docker or ACA deployments.
> It is retained for local reference/testing only. Use the .NET BFF (Option 1) for all active development.

Uses the original Express.js BFF (retained for reference):

#### Step 1: Start the BFF Server
```powershell
cd bff
npm install  # Only needed first time
npm run dev
```

Wait for:
```
🚀 APIM Portal BFF Server Started
🔐 Auth: 🧪 Mock Mode (Development)
```

---

## 🐛 Common Issues & Fixes

### ❌ "Cannot connect to runtime"

**Solution:** Start the frontend dev server manually first:
```powershell
npm run dev
```

Then use the debug configuration.

---

### ❌ "Port 3001 already in use" or "Port 5173 already in use"

**Find and kill the process:**
```powershell
# Find what's using the port
netstat -ano | findstr :3001
netstat -ano | findstr :5173

# Kill the process (replace <PID> with the number from above)
taskkill /PID <PID> /F
```

**Or use this one-liner:**
```powershell
# Kill port 3001
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force

# Kill port 5173
Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess | Stop-Process -Force
```

---

### ❌ Breakpoints showing as grey circles (not hitting)

**Frontend:**
1. Make sure source maps are enabled (already configured)
2. Hard reload the browser: `Ctrl+Shift+R`
3. Check that the file path matches (look in Sources tab in Chrome DevTools)

**Backend:**
1. Make sure you're running in debug mode (not just `npm start`)
2. Restart the BFF debug session
3. Save the file to trigger hot reload

---

### ❌ "npm: command not found" or similar errors

**Install Node.js:**
1. Download from https://nodejs.org/ (LTS version)
2. Install and restart your terminal
3. Verify: `node --version` should show v20 or higher

---

## 🎯 Quick Reference

### Debugging Shortcuts

| Action | Shortcut |
|--------|----------|
| Start Debugging | `F5` |
| Stop Debugging | `Shift+F5` |
| Step Over | `F10` |
| Step Into | `F11` |
| Step Out | `Shift+F11` |
| Continue | `F5` |
| Toggle Breakpoint | `F9` |
| Debug Console | `Ctrl+Shift+Y` |

### Useful Commands

```powershell
# Install all dependencies
npm install
cd bff-dotnet && dotnet restore && cd ..

# Start .NET BFF only (mock mode)
cd bff-dotnet && dotnet run

# Start frontend only
npm run dev

# Start legacy Node.js BFF only
cd bff && npm run dev

# Run tests
npm test

# Build for production
npm run build
```

---

## 🎓 What Each Debug Config Does

| Configuration | What It Does |
|--------------|-------------|
| 🚀 Full Stack (Frontend + BFF) | Starts both servers and opens browser |
| 🌐 Launch Frontend (Chrome) | Opens Chrome with debugger (requires running dev server) |
| 🌐 Launch Frontend (Edge) | Opens Edge with debugger (requires running dev server) |
| ⚙️ Start & Debug BFF Server | Starts and debugs the BFF Node.js server |
| 🔗 Attach to BFF Server | Attaches to already running BFF |
| 🧪 Run Current Test File | Debugs the currently open test file |
| 🧪 Debug All Tests | Debugs all tests |

---

## 💡 Pro Tips

1. **Use "Option 1: Manual Start"** - It's the most reliable, especially when starting out
2. **Keep terminals visible** - You'll see errors and logs immediately
3. **Check the Debug Console** - Shows all console.log output and errors
4. **Use the integrated terminal** - Access via `` Ctrl+` `` 
5. **Hot reload is enabled** - Changes are reflected automatically (for most files)

---

## 📝 Environment Setup Checklist

Before debugging, make sure you have:

- [ ] Node.js v20+ installed (`node --version`)
- [ ] .NET 10 SDK installed (`dotnet --version`)
- [ ] Frontend dependencies installed: `npm install`
- [ ] .NET BFF dependencies restored: `cd bff-dotnet && dotnet restore`
- [ ] Environment files created:
  - [ ] Root: `.env` (copy from `.env.development`)
  - [ ] BFF: `bff-dotnet/appsettings.Development.json` (already exists with mock mode)
- [ ] Mock mode enabled in `appsettings.Development.json` (recommended for local dev)
- [ ] Azure CLI logged in (only if `UseMockMode=false`): `az login`

---

Need more help? See the full [DEBUG_SETUP_GUIDE.md](DEBUG_SETUP_GUIDE.md) for detailed instructions.
