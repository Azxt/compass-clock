const { app, BrowserWindow, ipcMain } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000, height: 1000,
    transparent: true, frame: false, 
    resizable: true, // 允許滑鼠拖曳邊緣
    alwaysOnTop: false, 
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  win.setAspectRatio(1); // 強制 1:1 正方形
  win.loadFile('index.html');

  ipcMain.on('set-window-level', (event, isOnTop) => {
    win.setAlwaysOnTop(isOnTop);
  });
  
  ipcMain.on('close-app', () => {
    app.quit();
  });

  // 接收滑鼠放開時的精準視窗調整
  ipcMain.on('resize-window', (event, size) => {
    const bounds = win.getBounds();
    const center = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2
    };
    win.setBounds({
        x: Math.round(center.x - size / 2),
        y: Math.round(center.y - size / 2),
        width: Math.round(size),
        height: Math.round(size)
    });
  });
}

app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.disableHardwareAcceleration(); 
app.whenReady().then(createWindow);