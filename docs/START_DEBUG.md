# 🚀 Quick Start - Debugging Guide

## ✅ Step-by-Step Process (Recommended)

### Option 1: Manual Start (Most Reliable)

This is the **most reliable** approach for debugging:

#### Step 1: Start the BFF Server
```powershell
cd bff
npm install  # Only needed first time
npm run dev
```

Wait for this message:
```
🚀 APIM Portal BFF Server Started
🔐 Auth: 🧪 Mock Mode (Development)
⚠️  WARNING: Running in MOCK MODE
```

> **Note:** Mock mode is enabled by default (`USE_MOCK_MODE=true` in `bff/.env`). This allows local development without Azure credentials. The BFF will return mock data instead of calling the real APIM API.

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
- **Backend**: Open `bff/server.js`, set breakpoints

You're now debugging! 🎉

---

### Option 2: Use VS Code Debug Configuration

1. Press `F5` or go to **Run and Debug** (`Ctrl+Shift+D`)
2. Select **"🚀 Full Stack (Frontend + BFF)"**
3. Wait for both servers to start (may take 10-30 seconds)
4. Chrome should open automatically

If you get errors, use **Option 1** instead.

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
cd bff && npm install && cd ..

# Start frontend only
npm run dev

# Start BFF only
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
- [ ] Dependencies installed:
  - [ ] Root: `npm install`
  - [ ] BFF: `cd bff && npm install`
- [ ] Environment files created:
  - [ ] Root: `.env` (copy from `.env.development`)
  - [ ] BFF: `bff/.env` (already exists with `USE_MOCK_MODE=true`)
- [ ] Mock mode enabled in `bff/.env` (recommended for local dev)
- [ ] Azure CLI logged in (only if `USE_MOCK_MODE=false`): `az login`

---

Need more help? See the full [DEBUG_SETUP_GUIDE.md](DEBUG_SETUP_GUIDE.md) for detailed instructions.
