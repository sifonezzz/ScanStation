import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import simpleGit from 'simple-git';
import sharp from 'sharp';
import { getSetting, setSetting } from './settings';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const CREATE_PROJECT_WINDOW_WEBPACK_ENTRY: string;

let createProjectWindow: BrowserWindow | null = null;

/**
 * Scans the projects directory and sends the list of projects to the main window.
 * @param mainWindow The main application window.
 */
async function loadProjects(mainWindow: BrowserWindow) {
  const storagePath = getStoragePath();
  try {
    // Ensure the projects directory exists before trying to read it.
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
    console.log('Could not read projects directory:', error);
    mainWindow.webContents.send('projects-loaded', []);
  }
}

async function initializeNewProject(projectPath: string, coverImagePath: string): Promise<void> {
  try {
    await fs.ensureDir(projectPath);
    const git = simpleGit(projectPath);
    await git.init();
    await sharp(coverImagePath).resize(512, 728, { fit: 'cover' }).jpeg({ quality: 90 }).toFile(path.join(projectPath, 'cover.jpg'));
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
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });
  createProjectWindow.loadURL(CREATE_PROJECT_WINDOW_WEBPACK_ENTRY);
}

// --- IPC Handlers ---
ipcMain.on('open-create-project-window', openCreateProjectWindow);

ipcMain.on('select-cover-image', async (event) => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }] });
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
  console.log(`User wants to open project: ${projectName}`);
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
  const result = await dialog.showMessageBox({ type: 'info', title: 'Data Folder Configuration', message: 'Would you like to change your Scanstation data folder?', detail: `By default, a 'Scanstation' folder will be created in your application data directory. Inside, a 'projects' folder will store all your work.`, buttons: ['Use Custom Folder...', 'Use Default'], defaultId: 1 });
  if (result.response === 0) {
    const folderResult = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Select a Folder to Store Your Projects' });
    if (!folderResult.canceled && folderResult.filePaths.length > 0) {
      setSetting('projectStoragePath', folderResult.filePaths[0]);
    }
  }
  setSetting('initialSetupComplete', true);
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
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
  await handleFirstBoot();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});