import { app, BrowserWindow, ipcMain, dialog, protocol, session } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import simpleGit from 'simple-git';
import sharp from 'sharp';
import { getSetting, setSetting } from './settings';

// Declare the entry points for Webpack.
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const CREATE_PROJECT_WINDOW_WEBPACK_ENTRY: string;
declare const CREATE_PROJECT_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const EDIT_PROJECT_WINDOW_WEBPACK_ENTRY: string;
declare const EDIT_PROJECT_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const CHAPTER_SCREEN_WINDOW_WEBPACK_ENTRY: string;
declare const CHAPTER_SCREEN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const CREATE_CHAPTER_WINDOW_WEBPACK_ENTRY: string;
declare const CREATE_CHAPTER_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Window handles
let createProjectWindow: BrowserWindow | null = null;
let editProjectWindow: BrowserWindow | null = null;
let chapterScreenWindow: BrowserWindow | null = null;
let createChapterWindow: BrowserWindow | null = null;

// Store the last known window bounds to maintain size/position during navigation
let lastWindowBounds: Electron.Rectangle = { width: 800, height: 600, x: undefined, y: undefined };

async function loadProjects(mainWindow: BrowserWindow) {
  const storagePath = getStoragePath();
  try {
    await fs.ensureDir(storagePath);
    const projectFolders = await fs.readdir(storagePath, { withFileTypes: true });
    const projects = [];
    for (const folder of projectFolders) {
      if (folder.isDirectory()) {
        const coverPath = path.join(storagePath, folder.name, 'cover.jpg');
        if (await fs.pathExists(coverPath)) {
          projects.push({ name: folder.name, coverPath });
        }
      }
    }
    mainWindow.webContents.send('projects-loaded', projects);
  } catch (error) {
    console.error('Could not read projects directory:', error);
    mainWindow.webContents.send('projects-loaded', []);
  }
}

async function initializeNewProject(projectPath: string, coverImagePath: string): Promise<void> {
  try {
    await fs.ensureDir(projectPath);
    const git = simpleGit(projectPath);
    await git.init();
    await sharp(coverImagePath)
      .resize(512, 728, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toFile(path.join(projectPath, 'cover.jpg'));
    await Promise.all([
      fs.ensureDir(path.join(projectPath, '01-raws')),
      fs.ensureDir(path.join(projectPath, '02-cleaned')),
      fs.ensureDir(path.join(projectPath, '03-typeset')),
      fs.ensureDir(path.join(projectPath, '04-final')),
    ]);
  } catch (error) {
    dialog.showErrorBox('Project Creation Failed', `An error occurred: ${error.message}`);
  }
}

function openCreateProjectWindow() {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  createProjectWindow = new BrowserWindow({
    width: 400,
    height: 550,
    title: 'Create New Project',
    modal: true,
    parent: mainWindow,
    resizable: false,
    frame: false,
    webPreferences: {
      preload: CREATE_PROJECT_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });
  createProjectWindow.loadURL(CREATE_PROJECT_WINDOW_WEBPACK_ENTRY);
}

function openEditProjectWindow(projectName: string) {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  editProjectWindow = new BrowserWindow({
    width: 400,
    height: 550,
    title: 'Edit Project',
    modal: true,
    parent: mainWindow,
    resizable: false,
    frame: false,
    webPreferences: {
      preload: EDIT_PROJECT_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  editProjectWindow.webContents.once('dom-ready', () => {
    const storagePath = getStoragePath();
    const coverPath = path.join(storagePath, projectName, 'cover.jpg');
    editProjectWindow.webContents.send('project-data-for-edit', { name: projectName, coverPath });
  });

  editProjectWindow.loadURL(EDIT_PROJECT_WINDOW_WEBPACK_ENTRY);
}

// --- IPC Handlers ---

ipcMain.on('open-create-project-window', openCreateProjectWindow);

ipcMain.on('select-cover-image', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    event.sender.send('cover-image-selected', result.filePaths[0]);
  }
});

ipcMain.on('cancel-project-creation', () => {
  if (createProjectWindow) {
    createProjectWindow.close();
    createProjectWindow = null;
  }
});

ipcMain.on('submit-project-creation', async (_, { name, path: coverPath }) => {
  const storagePath = getStoragePath();
  const projectPath = path.join(storagePath, name);
  const projectExists = await fs.pathExists(projectPath);
  if (projectExists) {
    dialog.showErrorBox('Project Exists', `A project named "${name}" already exists.`);
    return;
  }
  await initializeNewProject(projectPath, coverPath);
  if (createProjectWindow) {
    createProjectWindow.close();
    createProjectWindow = null;
  }
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    loadProjects(mainWindow);
  }
});

ipcMain.on('open-project', (_, projectName) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      chapterScreenWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
          preload: CHAPTER_SCREEN_WINDOW_PRELOAD_WEBPACK_ENTRY,
        },
      });
  
      chapterScreenWindow.webContents.once('dom-ready', () => {
        chapterScreenWindow.webContents.send('project-data-for-chapter-screen', projectName);
      });
  
      chapterScreenWindow.loadURL(CHAPTER_SCREEN_WINDOW_WEBPACK_ENTRY);
      chapterScreenWindow.on('closed', () => chapterScreenWindow = null);
  
      mainWindow.close();
    }
});

ipcMain.handle('delete-project', async (_, projectName: string) => {
  const check1 = await dialog.showMessageBox({
    type: 'warning',
    title: 'Delete Project',
    message: `Are you sure you want to permanently delete '${projectName}'?`,
    detail: 'This action cannot be undone.',
    buttons: ['Delete', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
  });

  if (check1.response === 1) return { success: false };

  const check2 = await dialog.showMessageBox({
    type: 'warning',
    title: 'Final Confirmation',
    message: `This is the final confirmation. Delete '${projectName}' and all its files?`,
    buttons: ['Yes, Delete It', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
  });

  if (check2.response === 1) return { success: false };

  try {
    const storagePath = getStoragePath();
    const projectPath = path.join(storagePath, projectName);
    await fs.rm(projectPath, { recursive: true, force: true });
    
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      loadProjects(mainWindow);
    }
    return { success: true };
  } catch (error) {
    dialog.showErrorBox('Delete Failed', `Could not delete project folder. Error: ${error.message}`);
    return { success: false };
  }
});

ipcMain.on('open-edit-project-window', (_, projectName) => openEditProjectWindow(projectName));

ipcMain.on('cancel-project-update', () => {
  if (editProjectWindow) {
    editProjectWindow.close();
    editProjectWindow = null;
  }
});

ipcMain.handle('submit-project-update', async (_, data: { originalName: string; newName: string; newCoverPath: string | null }) => {
  const storagePath = getStoragePath();
  const originalPath = path.join(storagePath, data.originalName);
  const newPath = path.join(storagePath, data.newName);

  try {
    if (data.newName !== data.originalName) {
      if (await fs.pathExists(newPath)) {
        dialog.showErrorBox('Rename Failed', `A project named '${data.newName}' already exists.`);
        return { success: false };
      }
      await fs.rename(originalPath, newPath);
    }

    if (data.newCoverPath) {
      await sharp(data.newCoverPath)
        .resize(512, 728, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .toFile(path.join(newPath, 'cover.jpg'));
    }

    if (editProjectWindow) {
      editProjectWindow.close();
      editProjectWindow = null;
    }
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      loadProjects(mainWindow);
    }
    return { success: true };
  } catch (error) {
    dialog.showErrorBox('Update Failed', `An error occurred while updating the project. Error: ${error.message}`);
    return { success: false };
  }
});

// --- Chapter Management IPC Handlers ---

ipcMain.on('go-back-to-projects', () => {
    if (chapterScreenWindow) {
      chapterScreenWindow.close();
      createWindow();
    }
});

ipcMain.on('get-chapters', async (event, projectName: string) => {
    const storagePath = getStoragePath();
    const projectPath = path.join(storagePath, projectName);
    try {
      const chapterFolders = await fs.readdir(projectPath, { withFileTypes: true });
      const chapters = chapterFolders
        .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('CH_'))
        .map(dirent => ({ name: dirent.name }))
        .sort((a, b) => {
          const numA = parseInt(a.name.split('_')[1], 10);
          const numB = parseInt(b.name.split('_')[1], 10);
          return numA - numB;
        });
      event.sender.send('chapters-loaded', chapters);
    } catch (error) {
      console.error(`Could not read chapters for ${projectName}:`, error);
      event.sender.send('chapters-loaded', []);
    }
});

ipcMain.on('open-create-chapter-window', (_, projectName: string) => {
    if (!chapterScreenWindow) return;
  
    createChapterWindow = new BrowserWindow({
      width: 450,
      height: 480,
      title: 'Create New Chapter',
      modal: true,
      parent: chapterScreenWindow,
      resizable: false,
      frame: false,
      webPreferences: {
        preload: CREATE_CHAPTER_WINDOW_PRELOAD_WEBPACK_ENTRY,
      },
    });
  
    createChapterWindow.webContents.once('dom-ready', () => {
      createChapterWindow.webContents.send('project-data-for-create-chapter', projectName);
    });
  
    createChapterWindow.loadURL(CREATE_CHAPTER_WINDOW_WEBPACK_ENTRY);
    createChapterWindow.on('closed', () => createChapterWindow = null);
});

ipcMain.on('cancel-chapter-creation', () => {
    if (createChapterWindow) {
      createChapterWindow.close();
    }
});

ipcMain.handle('submit-chapter-creation', async (_, data) => {
    const { projectName, chapterNumber, chapterName, includeFinal } = data;
    const paddedNumber = chapterNumber.padStart(3, '0');
    const safeChapterName = chapterName.replace(/[^a-z0-9_\\-]/gi, '-');
    const chapterFolderName = `CH_${paddedNumber}_${safeChapterName}`;
  
    const projectPath = path.join(getStoragePath(), projectName);
    const chapterPath = path.join(projectPath, chapterFolderName);
  
    if (await fs.pathExists(chapterPath)) {
      dialog.showErrorBox('Chapter Exists', `A chapter folder named '${chapterFolderName}' already exists.`);
      return { success: false };
    }
  
    try {
      const foldersToCreate = [
        path.join(chapterPath, '01-Raws'),
        path.join(chapterPath, '02-Cleaned'),
        path.join(chapterPath, '03-Typeset'),
        path.join(chapterPath, '04-Edit-Files'),
      ];
      if (includeFinal) {
        foldersToCreate.push(path.join(chapterPath, '05-Final'));
      }
      
      await Promise.all(foldersToCreate.map(folder => fs.ensureDir(folder)));
      
      if (chapterScreenWindow) {
        chapterScreenWindow.webContents.send('project-data-for-chapter-screen', projectName);
      }
      if (createChapterWindow) {
        createChapterWindow.close();
      }
      return { success: true };
  
    } catch (error) {
      dialog.showErrorBox('Creation Failed', `Could not create chapter folder. Error: ${error.message}`);
      return { success: false };
    }
});

// --- Standard App Setup ---

function getStoragePath(): string {
  const customPath = getSetting<string>('projectStoragePath');
  if (customPath) {
    return customPath;
  }
  return path.join(app.getPath('userData'), 'Scanstation', 'projects');
}

async function handleFirstBoot(): Promise<void> {
  if (getSetting('initialSetupComplete')) return;
  const result = await dialog.showMessageBox({
    type: 'info',
    title: 'Data Folder Configuration',
    message: 'Would you like to change your Scanstation data folder?',
    detail: `By default, a 'Scanstation' folder will be created in your application data directory. Inside, a 'projects' folder will store all your work.`,
    buttons: ['Use Custom Folder...', 'Use Default'],
    defaultId: 1,
  });
  if (result.response === 0) {
    const folderResult = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select a Folder to Store Your Projects',
    });
    if (!folderResult.canceled && folderResult.filePaths.length > 0) {
      setSetting('projectStoragePath', folderResult.filePaths[0]);
    }
  }
  setSetting('initialSetupComplete', true);
}

// This function now uses the stored bounds to create windows of a consistent size
const createWindow = () => {
  const mainWindow = new BrowserWindow({
    ...lastWindowBounds, // Use the stored size and position
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });
  mainWindow.once('ready-to-show', () => {
    loadProjects(mainWindow);
  });
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

// --- Application Lifecycle ---

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self'; script-src 'self' ${!app.isPackaged ? "'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' scanstation-asset: data:`,
        ],
      },
    });
  });

  protocol.registerFileProtocol('scanstation-asset', (request, callback) => {
    try {
      const url = new URL(request.url);
      let decodedPath = decodeURI(url.pathname);
      if (process.platform === 'win32' && decodedPath.startsWith('/')) {
        decodedPath = decodedPath.substring(1);
      }
      callback({ path: path.normalize(decodedPath) });
    } catch (error) {
      console.error('Failed to resolve file path for scanstation-asset protocol:', error, request.url);
      callback({ error: -6 });
    }
  });

  await handleFirstBoot();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});