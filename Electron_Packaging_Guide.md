# Electron Desktop App Packaging Guide

This guide explains how to package the Kaveesha Timesheet application as a desktop app for **Windows (.exe)**, **macOS (.dmg)**, and **Linux (.AppImage/.deb)**.

---

## Prerequisites

- **Node.js** v18+ installed
- **Git** installed
- For macOS builds: macOS with Xcode Command Line Tools
- For Windows builds: Windows or use Wine on Linux/Mac
- For Linux builds: Linux or use Docker

---

## Step 1: Export & Clone Project

1. In Lovable, click **"Export to GitHub"**
2. Clone your repository locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
   cd YOUR_REPO
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

---

## Step 2: Install Electron Dependencies

```bash
npm install electron electron-builder --save-dev
```

---

## Step 3: Create Electron Files

### Create `electron/main.js`

```javascript
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, '../public/favicon.ico'),
    title: 'Kaveesha Timesheet',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    autoHideMenuBar: true,
    show: false
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the deployed Lovable app (uses live backend)
  mainWindow.loadURL('https://c169e2e9-7eb1-48f3-a3cd-12b1a667c14e.lovableproject.com');

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event) => {
    event.preventDefault();
  });
});
```

### Create `electron/preload.js` (optional, for future enhancements)

```javascript
// Preload script for secure context bridge
// Can be used for exposing specific Node.js APIs to renderer

window.addEventListener('DOMContentLoaded', () => {
  console.log('Kaveesha Timesheet Desktop App Loaded');
});
```

---

## Step 4: Update package.json

Add/modify these fields in your `package.json`:

```json
{
  "name": "kaveesha-timesheet",
  "version": "1.0.0",
  "description": "Kaveesha Engineers Timesheet Management System",
  "main": "electron/main.js",
  "author": "Kaveesha Engineers India Pvt. Ltd.",
  "license": "MIT",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron:dev": "electron .",
    "electron:build": "electron-builder",
    "electron:build:win": "electron-builder --win",
    "electron:build:mac": "electron-builder --mac",
    "electron:build:linux": "electron-builder --linux",
    "electron:build:all": "electron-builder --win --mac --linux"
  },
  "build": {
    "appId": "com.kaveesha.timesheet",
    "productName": "Kaveesha Timesheet",
    "copyright": "Copyright © 2024 Kaveesha Engineers India Pvt. Ltd.",
    "directories": {
      "output": "release",
      "buildResources": "build-resources"
    },
    "files": [
      "electron/**/*",
      "public/**/*"
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64", "ia32"]
        },
        {
          "target": "portable",
          "arch": ["x64"]
        }
      ],
      "icon": "public/favicon.ico",
      "artifactName": "${productName}-${version}-Windows-${arch}.${ext}"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "Kaveesha Timesheet",
      "installerIcon": "public/favicon.ico",
      "uninstallerIcon": "public/favicon.ico"
    },
    "mac": {
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        },
        {
          "target": "zip",
          "arch": ["x64", "arm64"]
        }
      ],
      "icon": "public/icon.icns",
      "category": "public.app-category.business",
      "artifactName": "${productName}-${version}-macOS-${arch}.${ext}",
      "hardenedRuntime": true,
      "gatekeeperAssess": false
    },
    "linux": {
      "target": [
        {
          "target": "AppImage",
          "arch": ["x64"]
        },
        {
          "target": "deb",
          "arch": ["x64"]
        },
        {
          "target": "rpm",
          "arch": ["x64"]
        }
      ],
      "icon": "public/icons",
      "category": "Office",
      "artifactName": "${productName}-${version}-Linux-${arch}.${ext}",
      "desktop": {
        "Name": "Kaveesha Timesheet",
        "Comment": "Timesheet Management System",
        "Categories": "Office;ProjectManagement"
      }
    }
  }
}
```

---

## Step 5: Create App Icons

You need icons in different formats for each platform:

### Windows
- `public/favicon.ico` - 256x256 ICO file (already exists)

### macOS
Create `public/icon.icns` (use an online converter or):
```bash
# On macOS, create iconset folder with these sizes:
# icon_16x16.png, icon_32x32.png, icon_128x128.png, icon_256x256.png, icon_512x512.png
# Then run:
iconutil -c icns icon.iconset
```

### Linux
Create `public/icons/` folder with PNG files:
- `16x16.png`
- `32x32.png`
- `48x48.png`
- `64x64.png`
- `128x128.png`
- `256x256.png`
- `512x512.png`

**Tip**: Use https://www.electronjs.org/docs/latest/tutorial/application-distribution#application-icons or online tools like https://icon.kitchen/

---

## Step 6: Build Desktop Apps

### Test in Development Mode
```bash
npm run electron:dev
```

### Build for Specific Platform

**Windows (run on Windows):**
```bash
npm run electron:build:win
```

**macOS (run on macOS):**
```bash
npm run electron:build:mac
```

**Linux (run on Linux):**
```bash
npm run electron:build:linux
```

**All Platforms (requires all OS environments):**
```bash
npm run electron:build:all
```

---

## Step 7: Find Your Installers

After building, installers will be in the `release/` folder:

| Platform | File | Description |
|----------|------|-------------|
| Windows | `Kaveesha Timesheet-1.0.0-Windows-x64.exe` | NSIS Installer |
| Windows | `Kaveesha Timesheet-1.0.0-Windows-x64-portable.exe` | Portable (no install) |
| macOS | `Kaveesha Timesheet-1.0.0-macOS-x64.dmg` | Intel Mac |
| macOS | `Kaveesha Timesheet-1.0.0-macOS-arm64.dmg` | Apple Silicon |
| Linux | `Kaveesha Timesheet-1.0.0-Linux-x64.AppImage` | Universal Linux |
| Linux | `Kaveesha Timesheet-1.0.0-Linux-x64.deb` | Debian/Ubuntu |
| Linux | `Kaveesha Timesheet-1.0.0-Linux-x64.rpm` | Fedora/RHEL |

---

## Cross-Platform Building Tips

### Building Windows on macOS/Linux
```bash
# Install Wine
brew install --cask wine-stable  # macOS
sudo apt install wine            # Ubuntu

# Then build
npm run electron:build:win
```

### Building macOS on Windows/Linux
⚠️ **Not recommended** - macOS apps should be built on macOS for proper code signing.

### Using GitHub Actions (Recommended for all platforms)

Create `.github/workflows/build.yml`:

```yaml
name: Build Desktop Apps

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build Electron app
        run: npm run electron:build
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: release-${{ matrix.os }}
          path: release/*
```

---

## Troubleshooting

### "App not connecting to backend"
- Ensure internet connection is available
- Check the URL in `electron/main.js` is correct

### "White screen on startup"
- Wait a few seconds for the app to load
- Check your internet connection

### "Code signing errors on macOS"
- For distribution, you need an Apple Developer account
- For testing, ignore with: `export CSC_IDENTITY_AUTO_DISCOVERY=false`

### "App icon not showing"
- Ensure icon files are in correct format and location
- Windows requires `.ico`, macOS requires `.icns`

---

## Distribution

1. **Direct Download**: Host installers on your website/server
2. **GitHub Releases**: Attach installers to GitHub releases
3. **Auto-Update**: Add `electron-updater` for automatic updates

---

## Need Help?

- Electron Docs: https://www.electronjs.org/docs
- electron-builder Docs: https://www.electron.build/
- Icon Generation: https://icon.kitchen/

---

**Happy Building! 🚀**
