// Main process (Electron) - main.js
const { app, BrowserWindow, dialog, ipcMain, protocol, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadMusicMetadata } = require('music-metadata');

let tray = null; // 托盘对象
let win = null; // 窗口对象
let savedFolderPath = null; // 保存音乐文件夹的路径

// 创建主窗口
function createWindow() {
  win = new BrowserWindow({
    width: 400,
    height: 550,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: true,
    },
  });

  // 开发环境，加载 localhost
  // win.loadURL('http://localhost:3000');
  win.loadFile(path.join(__dirname, 'out/index.html'));

  // 可选：打开调试工具
  //win.webContents.openDevTools();
}

// 创建系统托盘
function createTray() {
  try {
    tray = new Tray(path.join(__dirname, 'icon.png')); // 创建托盘图标
  } catch (error) {
    console.error('托盘图标加载失败:', error);
    return;
  }

  // 托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Select the music folder',
      click: async () => {
        // 打开文件夹选择对话框
        const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        if (!result.canceled && result.filePaths.length > 0) {
          savedFolderPath = result.filePaths[0]; // 保存选择的文件夹路径
          const files = fs.readdirSync(savedFolderPath); // 读取文件夹中的文件
          const audioFiles = files.filter(file => file.endsWith('.mp3') || file.endsWith('.flac') || file.endsWith('.wav')); // 筛选出音频文件

          // 动态加载 `music-metadata` ESM 模块
          const mm = await loadMusicMetadata();

          // 读取每个音频文件的元数据
          const audioDataPromises = audioFiles.map(async (file) => {
            const filePath = path.join(savedFolderPath, file);
            let metadata = {};
            try {
              metadata = await mm.parseFile(filePath); // 解析音频文件元数据
            } catch (err) {
              console.error('解析元数据失败:', filePath, err);
            }
            const title = metadata.common?.title || path.basename(file, path.extname(file));
            const artist = metadata.common?.artist || '未知艺术家';
            const duration = metadata.format?.duration || 0;
            const audioUrl = `safe-file://${encodeURIComponent(filePath)}`; // 编码文件路径
            return {
              title,
              artist,
              duration,
              filePath: audioUrl,
            };
          });

          const audioData = await Promise.all(audioDataPromises);

          if (win) {
            win.webContents.send('update-audio-list', audioData); // 发送音频数据（包括元数据）到渲染过程
          }
          console.log('已保存音乐文件夹路径:', savedFolderPath);

          // 使用用户目录保存路径
          const savePath = path.join(app.getPath('userData'), 'savedPath.json');
          fs.writeFileSync(savePath, JSON.stringify({ savedFolderPath }), 'utf-8');
        }
      }
    },
    { label: 'exit', role: 'quit' } // 退出应用程序
  ]);
  tray.setToolTip('Melody'); // 设置托盘提示
  tray.setContextMenu(contextMenu); // 设置托盘菜单
}

// 应用启动时的初始化操作
app.whenReady().then(() => {
  // 注册自定义协议，以便通过 safe-file:// 访问本地文件
  protocol.registerFileProtocol('safe-file', (request, callback) => {
    const url = request.url.replace('safe-file://', '');
    const decodedPath = decodeURIComponent(url); // 解码文件路径
    console.log('解析的URL路径:', decodedPath); // 打印解析路径以检查问题
    callback({ path: path.normalize(decodedPath) });
  });

  createWindow(); // 创建主窗口
  createTray(); // 创建系统托盘

  // 加载保存的文件夹路径
  const savePath = path.join(app.getPath('userData'), 'savedPath.json');
  if (fs.existsSync(savePath)) {
    const data = fs.readFileSync(savePath, 'utf-8');
    const { savedFolderPath: loadedPath } = JSON.parse(data);
    if (loadedPath) {
      savedFolderPath = loadedPath;
      console.log('加载已保存的音乐文件夹路径:', savedFolderPath);
    }
  }
});

// 监听渲染过程的 'renderer-ready' 消息
ipcMain.on('renderer-ready', async () => {
  if (savedFolderPath && win) {
    const files = fs.readdirSync(savedFolderPath);
    const audioFiles = files.filter(file => file.endsWith('.mp3') || file.endsWith('.flac') || file.endsWith('.wav'));

    // 动态加载 `music-metadata` ESM 模块
    const mm = await loadMusicMetadata();

    // 读取每个音频文件的元数据
    const audioDataPromises = audioFiles.map(async (file) => {
      const filePath = path.join(savedFolderPath, file);
      let metadata = {};
      try {
        metadata = await mm.parseFile(filePath); // 解析音频文件元数据
      } catch (err) {
        console.error('解析元数据失败:', filePath, err);
      }
      const title = metadata.common?.title || path.basename(file, path.extname(file));
      const artist = metadata.common?.artist || '未知艺术家';
      const duration = metadata.format?.duration || 0;
      const audioUrl = `safe-file://${encodeURIComponent(filePath)}`; // 编码文件路径
      return {
        title,
        artist,
        duration,
        filePath: audioUrl,
      };
    });

    const audioData = await Promise.all(audioDataPromises);

    win.webContents.send('update-audio-list', audioData);
    console.log('已发送音乐列表到渲染过程:', audioData);
  }
});

// 所有窗口关闭时的处理
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') { // 如果不是 macOS，则退出应用程序
    app.quit();
  }
});

// 应用激活时的处理（例如在 macOS 中点击应用图标）
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) { // 如果没有打开的窗口，则重新创建主窗口
    createWindow();
  }
});