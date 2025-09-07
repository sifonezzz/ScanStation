import { AppStore } from './settings';
import { app, BrowserWindow, ipcMain, dialog, protocol, session, shell, Menu, screen } from 'electron';
import path from 'path';
import fs from 'fs-extra'; // This stays the same for your existing code
import * as fsPromises from 'fs/promises'; // Add this line
import simpleGit, { SimpleGit } from 'simple-git';
import Jimp from 'jimp';
import { getSetting, setSetting, deleteSetting } from './settings';
import { exec, execFile } from 'child_process';
import * as chokidar from 'chokidar';

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
declare const SPLASH_WINDOW_WEBPACK_ENTRY: string;
declare const SPLASH_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const SETTINGS_WINDOW_WEBPACK_ENTRY: string;
declare const SETTINGS_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const WELCOME_WINDOW_WEBPACK_ENTRY: string;
declare const WELCOME_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow;
let createProjectWindow: BrowserWindow | null = null;
let editProjectWindow: BrowserWindow | null = null;
let chapterScreenWindow: BrowserWindow | null = null;
let createChapterWindow: BrowserWindow | null = null;
let lastWindowBounds: Electron.Rectangle = { width: 1024, height: 768, x: undefined, y: undefined };
let splashWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let welcomeWindow: BrowserWindow | null = null;
let chapterWatcher: chokidar.FSWatcher | null = null;
let repoWatcher: chokidar.FSWatcher | null = null;
let spreadCache = new Map<string, string>();


function getBaseName(fileName: string): string {
    return path.basename(fileName, path.extname(fileName));
}

function getRepoNameFromUrl(url: string): string | null {
    const match = url.match(/([^\/]+)\.git$/);
    return match ? match[1] : null;
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 150,
    backgroundColor: '#2c2f33',
    frame: false,
    resizable: false,
    center: true,
    webPreferences: {
      preload: SPLASH_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });
  splashWindow.loadURL(SPLASH_WINDOW_WEBPACK_ENTRY);
  splashWindow.on('closed', (): void => {
  splashWindow = null;
});
}


function updateSplashStatus(message: string) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('status-update', message);
  }
}

function openSettingsWindow() {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    settingsWindow = new BrowserWindow({
        width: 600,
        height: 400,
        title: 'Settings',
        modal: true,
        parent: mainWindow,
        resizable: false,
        frame: false,
        show: false,
        backgroundColor: '#2c2f33',
        webPreferences: {
            preload: SETTINGS_WINDOW_PRELOAD_WEBPACK_ENTRY, // Ensure this matches the name in forge.config.ts
        },
    });
    settingsWindow.loadURL(SETTINGS_WINDOW_WEBPACK_ENTRY); // Ensure this matches the name in forge.config.ts
    settingsWindow.once('ready-to-show', () => settingsWindow.show());
    settingsWindow.on('closed', () => {
        settingsWindow = null;
        const mainWindow = BrowserWindow.getAllWindows().find(win => !win.isModal());
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('repositories-updated');
        }
    });
}



ipcMain.on('open-settings-window', openSettingsWindow);
ipcMain.on('close-settings-window', () => {
    if (settingsWindow) settingsWindow.close();
});
ipcMain.handle('get-editor-paths', () => {
    return {
        photoshop: getSetting('photoshopPath'),
        illustrator: getSetting('illustratorPath'),
        gimp: getSetting('gimpPath'),
    };
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('select-editor-path', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        title: 'Select Editor Executable',
    });
    return !canceled && filePaths.length > 0 ? filePaths[0] : null;
});
ipcMain.handle('set-editor-path', (_, { editor, path }: { editor: string, path: string }) => {
    const key = `${editor}Path` as keyof AppStore;
    setSetting(key, path);
});

ipcMain.on('start-watching-chapter', (event, chapterPath: string) => {
    if (chapterWatcher) {
        chapterWatcher.close(); 
    }

    chapterWatcher = chokidar.watch(chapterPath, {
        ignored: /(^|[\/\\])\../, 
        persistent: true,
        ignoreInitial: true, 
    });

    chapterWatcher.on('add', () => {
        console.log('New file detected, notifying renderer.');
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window && !window.isDestroyed()) {
            window.webContents.send('file-added-to-chapter');
        }
    });
});

ipcMain.handle('get-proofread-images', async (_, { chapterPath, pageFile }) => {
    try {
        const baseName = getBaseName(pageFile);

        // Define paths for raw and typeset directories
        const rawDir = path.join(chapterPath, 'Raws');
        const typesetDir = path.join(chapterPath, 'Typesetted');

        // Find the full filename in the Typesetted folder
        const allTypesetFiles = await fs.readdir(typesetDir);
        const typesetFileName = allTypesetFiles.find(f => getBaseName(f) === baseName);

        // MODIFICATION: We no longer return 'success: false' if typesetFileName is missing.
        // We now always return success, and the tsPath will be null if typesetFileName is undefined.
        return {
            success: true,
            rawPath: path.join(rawDir, pageFile),
            tsPath: typesetFileName ? path.join(typesetDir, typesetFileName) : null
        };
        
    } catch (error) {
        console.error('Failed to get proofread images:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.on('stop-watching-chapter', () => {
    if (chapterWatcher) {
        console.log('Stopping chapter watcher.');
        chapterWatcher.close();
        chapterWatcher = null;
    }
    spreadCache.clear();
});

ipcMain.handle('get-stitched-raw-spread', async (_, { chapterPath, pageFile }) => {
    const cacheKey = `${chapterPath}_${pageFile}`;
    if (spreadCache.has(cacheKey) && await fs.pathExists(spreadCache.get(cacheKey))) {
        return { success: true, filePath: spreadCache.get(cacheKey) };
    }
    try {
        const spreadMatch = getBaseName(pageFile).match(/(\d+)[-_](\d+)/);
        if (!spreadMatch) {
            return { success: false, error: 'Filename does not match spread pattern (e.g., 02-03.jpg).' };
        }

        const pageNum1 = spreadMatch[1].padStart(2, '0');
        const pageNum2 = spreadMatch[2].padStart(2, '0');

        const rawsDir = path.join(chapterPath, 'Raws');
        const allRaws = await fs.readdir(rawsDir);

        const rawFile1 = allRaws.find(f => getBaseName(f).startsWith(pageNum1));
        const rawFile2 = allRaws.find(f => getBaseName(f).startsWith(pageNum2));

        if (!rawFile1 || !rawFile2) {
            return { success: false, error: `Could not find raw files for pages ${pageNum1} and ${pageNum2}.` };
        }

        const image1 = await Jimp.read(path.join(rawsDir, rawFile1));
        const image2 = await Jimp.read(path.join(rawsDir, rawFile2));

        const totalWidth = image1.getWidth() + image2.getWidth();
        const maxHeight = Math.max(image1.getHeight(), image2.getHeight());
        const stitchedImage = await new Jimp(totalWidth, maxHeight, '#FFFFFF');
        
        stitchedImage.composite(image2, 0, 0); 
        stitchedImage.composite(image1, image2.getWidth(), 0);

        const tempDir = path.join(app.getPath('temp'), 'scanstation');
        await fs.ensureDir(tempDir);
        const tempFilePath = path.join(tempDir, `spread-${Date.now()}.jpg`);
        await stitchedImage.writeAsync(tempFilePath);

        spreadCache.set(cacheKey, tempFilePath);
        return { success: true, filePath: tempFilePath };
    } catch (error) {
        console.error('Failed to stitch spread:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-git-identity', (): Promise<{ name: string; email: string }> => {
    return new Promise((resolve) => {
        let name = '';
        let email = '';
        exec('git config user.name', (err, stdout) => {
            if (!err) name = stdout.trim();
            exec('git config user.email', (err, stdout) => {
                if (!err) email = stdout.trim();
                resolve({ name, email });
            });
        });
    });
});

ipcMain.handle('set-git-identity', async (_, { name, email }: { name: string; email: string }) => {
    try {
        await new Promise<void>((resolve, reject) => {
            exec(`git config --global user.name "${name}"`, (err) => (err ? reject(err) : resolve()));
        });
        await new Promise<void>((resolve, reject) => {
            exec(`git config --global user.email "${email}"`, (err) => (err ? reject(err) : resolve()));
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Helper to strip the [local] prefix for filesystem operations
function getRepoFolderName(repoIdentifier: string): string {
    if (repoIdentifier && repoIdentifier.startsWith('[local] ')) {
        return repoIdentifier.substring(8);
    }
    return repoIdentifier;
}
ipcMain.handle('add-offline-repository', async (_, repoName: string) => {
    const storagePath = getStoragePath();
    const repoPath = path.join(storagePath, repoName); // Uses the clean name

    if (await fs.pathExists(repoPath)) {
        dialog.showErrorBox('Folder Exists', `A folder named '${repoName}' already exists.`);
        return { success: false };
    }

    try {
        // Creates the folder with the clean name
        await fs.ensureDir(repoPath);

        // Adds the repository to settings WITH the prefix and space
        const identifier = `[local] ${repoName}`;
        const currentRepos = getSetting<string[]>('repositories') || [];
        setSetting('repositories', [...currentRepos, identifier]);
        setSetting('selectedRepository', identifier); // Auto-selects it

        return { success: true };
    } catch (error) {
        dialog.showErrorBox('Creation Failed', `Could not create offline repository. Error: ${error.message}`);
        return { success: false };
    }
});

ipcMain.handle('create-shortcut', async () => {
    try {
        const shortcutPath = path.join(app.getPath('desktop'), 'Scanstation.lnk');
        const targetPath = app.getPath('exe');

        if (process.platform === 'win32') {
            const success = shell.writeShortcutLink(shortcutPath, 'create', {
                target: targetPath,
                description: 'A collaboration tool for solo and group scanlation projects.',
                icon: targetPath,
                iconIndex: 0,
                appUserModelId: 'com.sifonezzz.scanstation'
            });

            if (success) {
                return { success: true };
            } else {
                return { success: false, error: 'The OS failed to write the shortcut link.' };
            }
        }
        return { success: false, error: 'Shortcut creation is only supported on Windows.' };
    } catch (error) {
        console.error('Failed to create shortcut:', error);
        return { success: false, error: error.message };
    }
});

async function loadProjects(mainWindow: BrowserWindow, repositoryName: string) {
  if (!mainWindow || mainWindow.isDestroyed() || !repositoryName) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('projects-loaded', []);
    }
    return;
  }
  
  const repoPath = path.join(getStoragePath(), getRepoFolderName(repositoryName));


  try {
    await fs.ensureDir(repoPath);
    const projectFolders = await fs.readdir(repoPath, { withFileTypes: true });
    const projects = [];
    for (const folder of projectFolders) {
      if (folder.isDirectory()) {
        const coverPath = path.join(repoPath, folder.name, 'cover.jpg');
        if (await fs.pathExists(coverPath)) {
          projects.push({ name: folder.name, coverPath });
        }
      }
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('projects-loaded', projects);
    }
  } catch (error) {
    console.error('Could not read projects directory:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('projects-loaded', []);
    }
  }
}

async function healRepositoryFolders(repoPath: string): Promise<void> {
  const requiredChapterFolders = [
    'Raws',
    'Raws Cleaned',
    'Typesetted',
    'Final',
    'data',
    path.join('data', 'TL Data'),
    path.join('data', 'PR Data')
  ];

  try {
    // Use the fsPromises alias for all file system operations
    const projects = await fsPromises.readdir(repoPath, { withFileTypes: true }); 
    for (const project of projects) {
      if (!project.isDirectory()) continue;

      const projectPath = path.join(repoPath, project.name);
      const chapters = await fsPromises.readdir(projectPath, { withFileTypes: true }); 

      for (const chapter of chapters) {
        if (!chapter.isDirectory()) continue;

        const chapterPath = path.join(projectPath, chapter.name);
        for (const requiredFolder of requiredChapterFolders) {
          const fullPath = path.join(chapterPath, requiredFolder);
          try {
            await fsPromises.access(fullPath); 
          } catch {
            await fsPromises.mkdir(fullPath, { recursive: true }); 
            console.log(`Healed missing folder: ${fullPath}`);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Failed during repository healing process for ${repoPath}:`, error);
  }
}

async function backupProjects() {
    const sourcePath = getStoragePath();
    // Creates the backup path as a sibling to the 'projects' folder
    const backupPath = path.join(sourcePath, '..', 'backup');

    try {
        // Only run the backup if the projects folder actually exists
        if (await fs.pathExists(sourcePath)) {
            console.log(`Backing up projects from ${sourcePath} to ${backupPath}...`);
            // This copies the directory, overwriting any existing backup
            await fs.copy(sourcePath, backupPath, { overwrite: true });
            console.log('Backup completed successfully.');
        } else {
            console.log('Projects folder not found, skipping backup.');
        }
    } catch (error) {
        console.error('Failed to backup project folder:', error);
        dialog.showErrorBox('Backup Failed', `Could not create a backup of the projects folder. Error: ${error.message}`);
    }
}

async function refreshChapters(targetWindow: BrowserWindow, repoName: string, projectName: string) {
    if (!targetWindow || targetWindow.isDestroyed()) return;
    // 1. Get Project Cover Path (New)
    const repoFolderName = getRepoFolderName(repoName); // [cite: 583]
    const projectPath = path.join(getStoragePath(), repoFolderName, projectName);
    const coverPath = path.join(projectPath, 'cover.jpg'); // Logic based on [cite: 595]

    let chaptersData: { name: string; progress: number }[] = [];

    try {
      const chapterFolders = await fs.readdir(projectPath, { withFileTypes: true });
      const chapterDirents = chapterFolders
        .filter(dirent => dirent.isDirectory() && dirent.name.toLowerCase().startsWith('chapter ')) // [cite: 616]
        .sort((a, b) => { // [cite: 616]
          const numA = parseInt(a.name.replace(/[^0-9]/g, ''), 10);
          const numB = parseInt(b.name.replace(/[^0-9]/g, ''), 10);
          return numA - numB;
        });
    
      // NEW: Run progress calculation for all chapters in parallel
      chaptersData = await Promise.all(chapterDirents.map(async (dirent) => {
          const chapterPath = path.join(projectPath, dirent.name);
          const progress = await getChapterProgressPercent(chapterPath); // Our new helper
          return {
              name: dirent.name,
              progress: progress // Add the progress percentage
          };
      }));

    } catch (error) {
      console.error(`Could not read chapters for ${projectName}:`, error);
      // chaptersData is already []
    }

    // Send ONE payload with all data using a new channel name
    targetWindow.webContents.send('chapter-list-data-loaded', {
        coverPath: coverPath,
        chapters: chaptersData
    });
}

async function initializeNewProject(projectPath: string, coverImagePath: string): Promise<void> {
  try {
    await fs.ensureDir(projectPath);
    const image = await Jimp.read(coverImagePath);
    await image
      .cover(512, 728) // Resizes and crops to fit the dimensions
      .quality(90) // Sets JPEG quality
      .writeAsync(path.join(projectPath, 'cover.jpg')); // Saves the file
  } catch (error) {
    dialog.showErrorBox('Project Creation Failed', `An error occurred: ${error.message}`);
  }
}

function openCreateProjectWindow(repoName: string) {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  createProjectWindow = new BrowserWindow({
    width: 400, height: 550, title: 'Create New Project', modal: true,
    parent: mainWindow, resizable: false, frame: false, show: false,
    backgroundColor: '#2c2f33',
    webPreferences: { preload: CREATE_PROJECT_WINDOW_PRELOAD_WEBPACK_ENTRY },
  });
  createProjectWindow.once('ready-to-show', () => createProjectWindow.show());
  createProjectWindow.loadURL(CREATE_PROJECT_WINDOW_WEBPACK_ENTRY);
  createProjectWindow.webContents.once('dom-ready', () => {
    createProjectWindow.webContents.send('project-data-for-create-project', { repoName });
  });
}

function openEditProjectWindow(repoName: string, projectName: string) {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  editProjectWindow = new BrowserWindow({
    width: 400, height: 550, title: 'Edit Project', modal: true,
    parent: mainWindow, resizable: false, frame: false, show: false,
    backgroundColor: '#2c2f33',
    webPreferences: { preload: EDIT_PROJECT_WINDOW_PRELOAD_WEBPACK_ENTRY, },
  });
  editProjectWindow.once('ready-to-show', () => editProjectWindow.show());
  editProjectWindow.webContents.once('dom-ready', () => {
    const coverPath = path.join(getStoragePath(), getRepoFolderName(repoName), projectName, 'cover.jpg');
    editProjectWindow.webContents.send('project-data-for-edit', { name: projectName, coverPath, repoName });
  });
  editProjectWindow.loadURL(EDIT_PROJECT_WINDOW_WEBPACK_ENTRY);
}

async function performAuthenticatedPush(git: SimpleGit) {
    const pat = getSetting<string>('githubPat');
    if (!pat) {
        throw new Error('Personal Access Token not set.');
    }

    const remotes = await git.getRemotes(true);
    const origin = remotes.find(r => r.name === 'origin');
    if (!origin) {
        throw new Error('No "origin" remote found for this repository.');
    }
    
    // ▼▼▼ NEW LOGIC to get the current branch name ▼▼▼
    const branchSummary = await git.branch();
    const currentBranch = branchSummary.current;
    if (!currentBranch) {
        throw new Error('Could not determine the current Git branch.');
    }
    // ▲▲▲ END OF NEW LOGIC ▲▲▲

    const originalUrl = origin.refs.push;
    const cleanUrl = originalUrl.replace(/^(https:\/\/)(?:.*@)?(.*)$/, '$1$2');
    const authenticatedUrl = cleanUrl.replace('https://', `https://${pat}@`);
    
    try {
        await git.remote(['set-url', 'origin', authenticatedUrl]);
        // Use the dynamically found branch name instead of hardcoding 'main'
        await git.push('origin', currentBranch); 
    } finally {
        await git.remote(['set-url', 'origin', originalUrl]);
    }
}


// --- IPC Handlers ---
ipcMain.on('open-external-link', (_, url: string) => {
    shell.openExternal(url);
});

ipcMain.handle('rename-files-in-folder', async (_, { chapterPath, folderName }) => {
    const targetDir = path.join(chapterPath, folderName);
    try {
        const files = (await fs.readdir(targetDir))
            .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        if (files.length === 0) {
            return { success: true, message: 'No image files found to rename.' };
        }

        // 1. First pass: Rename all files to temporary names to avoid conflicts
        const tempRenames = files.map((file, index) => ({
            oldPath: path.join(targetDir, file),
            tempPath: path.join(targetDir, `__temp_${index}${path.extname(file)}`),
        }));
        for (const op of tempRenames) {
            await fs.rename(op.oldPath, op.tempPath);
        }

        // 2. Second pass: Rename from temporary to final names
        const finalRenames = tempRenames.map((op, index) => ({
            tempPath: op.tempPath,
            newPath: path.join(targetDir, `${String(index + 1).padStart(2, '0')}${path.extname(op.tempPath)}`),
        }));
        for (const op of finalRenames) {
            await fs.rename(op.tempPath, op.newPath);
        }
        
        return { success: true, message: `Successfully renamed ${files.length} files in "${folderName}".` };
    } catch (error) {
        console.error(`Failed to rename files in ${folderName}:`, error);
        return { success: false, message: `An error occurred: ${error.message}` };
    }
});

ipcMain.on('open-create-project-window', (_, repoName) => openCreateProjectWindow(repoName));
ipcMain.on('select-cover-image', async (event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
  });
  if (!canceled && filePaths.length > 0) {
    event.sender.send('cover-image-selected', filePaths[0]);
  }
});

ipcMain.on('cancel-project-creation', () => {
  if (createProjectWindow) createProjectWindow.close();
});

ipcMain.handle('open-file-in-editor', async (_, { editor, filePath }: { editor: string, filePath: string }) => {
    const key = `${editor}Path` as keyof AppStore;
    const editorPath = getSetting<string>(key);

    if (!editorPath) {
        dialog.showMessageBox({
            type: 'warning',
            title: 'Editor Path Not Set',
            message: `You haven't linked your programs. Please do so on the settings screen.`
        });
        return { success: false, error: 'Editor path not set.' };
    }

    try {
        if (!await fs.pathExists(editorPath)) throw new Error(`Executable not found at: ${editorPath}`);
        if (!await fs.pathExists(filePath)) throw new Error(`Image file not found at: ${filePath}`);

        execFile(editorPath, [filePath], (error) => {
            if (error) throw error;
        });
        return { success: true };
    } catch (error) {
        console.error(`Failed to open ${filePath} in ${editor}:`, error);
        dialog.showErrorBox('Error Opening File', `Could not open file in ${editor}.\n\nError: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('git-pull', async (_, repoName: string) => {

    if (repoName.startsWith('[local] ')) {
    return { success: true, message: 'Local repositories do not need to be pulled.' };
}
    const repoPath = path.join(getStoragePath(), getRepoFolderName(repoName));
    const git = simpleGit(repoPath);

  try {
    // A successful pull means there were no merge conflicts.
    await git.pull();

    console.log(`Pull successful for ${repoName}. Healing repository folders...`);
    await healRepositoryFolders(repoPath);

    return {
      success: true,
      conflict: false,
      message: 'Repository pulled successfully.'
    };

  } catch (error) {
    // When a conflict occurs, simple-git throws a GitResponseError.
    // We check if the error object contains the expected conflict data.
    if (error.git && error.git.conflicts && error.git.conflicts.length > 0) {
      return {
        success: true, // The operation is "successful" in that it correctly identified the conflict.
        conflict: true,
        files: error.git.conflicts.map((conflict: any) => conflict.file), // Extract file names from the conflict objects.
        message: 'A merge conflict occurred.'
      };
    }

    // Handle other, unexpected errors.
    console.error(`Git pull failed for ${repoName}:`, error);
    return {
      success: false,
      message: `An error occurred while pulling the repository: ${error.message}`
    };
  }
});

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1100,
    minWidth: 1100,
    height: 720,
    minHeight: 720,
    show: false,
    backgroundColor: '#2c2f33',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.once('ready-to-show', () => {
    const selectedRepo = getSetting<string>('selectedRepository');
    if (selectedRepo) {
      loadProjects(mainWindow, selectedRepo);
    }
  });
};

ipcMain.on('submit-project-creation', async (_, { repoName, name, path: coverPath }) => {
  const projectPath = path.join(getStoragePath(), getRepoFolderName(repoName), name);
  const projectExists = await fs.pathExists(projectPath);
  if (projectExists) {
    dialog.showErrorBox('Project Exists', `A project named "${name}" already exists.`);
    return;
  }
  await initializeNewProject(projectPath, coverPath);

  // Get a direct reference to the main window from the modal's parent property
  const mainWindow = createProjectWindow?.getParentWindow();

  if (createProjectWindow) {
    createProjectWindow.close();
  }

  // Use the direct reference to reload the projects
  if (mainWindow) {
    loadProjects(mainWindow, repoName);
  }
});

ipcMain.on('open-project', (_, data: { repoName: string, projectName: string, chapterName: string, rect?: any }) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
        
        const { repoName, projectName, chapterName, rect } = data; // Unpack all data
        const chapterPath = path.join(getStoragePath(), repoName, projectName, chapterName);
        
        // 1. Load the chapter screen HTML file
        mainWindow.loadURL(CHAPTER_SCREEN_WINDOW_WEBPACK_ENTRY);

        // 2. After the page is loaded, send ALL data it needs (including the animation rect)
        mainWindow.webContents.once('dom-ready', () => {
            mainWindow.setTitle(`${projectName} / ${chapterName}`);
            mainWindow.webContents.send('project-data-for-chapter-screen', { 
                repoName, 
                projectName, 
                chapterName, 
                chapterPath,
                animationRect: rect // Forward the rect data
            });
        });
    }
});

ipcMain.handle('delete-project', async (_, { repoName, projectName }) => {
  const { response } = await dialog.showMessageBox({
    type: 'warning', title: 'Delete Project',
    message: `Are you sure you want to permanently delete '${projectName}'?`,
    detail: 'This action cannot be undone.',
    buttons: ['Delete', 'Cancel'], defaultId: 1, cancelId: 1,
  });
  if (response === 1) return { success: false };
  try {
    const projectPath = path.join(getStoragePath(), getRepoFolderName(repoName), projectName);
    await fs.rm(projectPath, { recursive: true, force: true });
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) loadProjects(mainWindow, repoName);
    return { success: true };
  } catch (error) {
    dialog.showErrorBox('Delete Failed', `Could not delete project folder. Error: ${error.message}`);
    return { success: false };
  }
});

ipcMain.on('open-edit-project-window', (_, { repoName, projectName }) => openEditProjectWindow(repoName, projectName));

ipcMain.on('cancel-project-update', () => {
  if (editProjectWindow) editProjectWindow.close();
});

ipcMain.handle('submit-project-update', async (_, data) => {
  const { repoName, originalName, newName, newCoverPath } = data;
  const repoPath = path.join(getStoragePath(), getRepoFolderName(repoName));
  const originalPath = path.join(repoPath, originalName);
  const newPath = path.join(repoPath, newName);

  try {
    if (newName !== originalName) {
      if (await fs.pathExists(newPath)) {
        dialog.showErrorBox('Rename Failed', `A project named '${newName}' already exists.`);
        return { success: false };
      }
      await fs.rename(originalPath, newPath);
    }

    if (newCoverPath) {
      const image = await Jimp.read(newCoverPath);
      await image
        .cover(512, 728)
        .quality(90)
        .writeAsync(path.join(newPath, 'cover.jpg'));
    }

    if (editProjectWindow) editProjectWindow.close();
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) loadProjects(mainWindow, repoName);
    return { success: true };
    
  } catch (error) {
    dialog.showErrorBox('Update Failed', `An error occurred. Error: ${error.message}`);
    return { success: false };
  }
});

ipcMain.on('go-back-to-projects', (_, { repoName, projectName }) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
        // Just load and show chapter selection - fade out is handled by renderer
        mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
        
        mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('show-chapter-selection-for-project', { repoName, projectName });
        });
    }
});

ipcMain.on('get-chapters', async (event, { repoName, projectName }) => {
    refreshChapters(BrowserWindow.fromWebContents(event.sender), repoName, projectName);
});

ipcMain.on('open-create-chapter-window', (_, { repoName, projectName }) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) return; // Exit if the main window isn't found

    createChapterWindow = new BrowserWindow({
      width: 450,
      height: 380, // Adjusted height after removing the optional folder checkbox
      title: 'Create New Chapter',
      modal: true,
      parent: mainWindow, // Use the main window as the parent
      resizable: false,
      frame: false,
      show: false,
      backgroundColor: '#2c2f33',
      webPreferences: {
        preload: CREATE_CHAPTER_WINDOW_PRELOAD_WEBPACK_ENTRY,
      },
    });
    
    createChapterWindow.once('ready-to-show', () => createChapterWindow.show());
    
    createChapterWindow.webContents.once('dom-ready', () => {
      createChapterWindow.webContents.send('project-data-for-create-chapter', { repoName, projectName });
    });

    createChapterWindow.loadURL(CREATE_CHAPTER_WINDOW_WEBPACK_ENTRY);
});

ipcMain.on('cancel-chapter-creation', () => {
    if (createChapterWindow) createChapterWindow.close();
});

ipcMain.handle('submit-chapter-creation', async (_, data) => {
    const { repoName, projectName, chapterNumber, chapterName } = data;
    const chapterFolderName = `chapter ${chapterNumber} - ${chapterName.replace(/[^a-z0-9_ -]/gi, '')}`;
    const chapterPath = path.join(getStoragePath(), repoName, projectName, chapterFolderName);
    if (await fs.pathExists(chapterPath)) {
      dialog.showErrorBox('Chapter Exists', `A chapter folder named '${chapterFolderName}' already exists.`);
      return { success: false };
    }
    try {
        // "Final" folder is now created by default
        const foldersToCreate = ['Raws', 'Raws Cleaned', 'Edit Files', 'Typesetted', 'Final', 'data'];
        
        await Promise.all(foldersToCreate.map(folder => fs.ensureDir(path.join(chapterPath, folder))));
        const parentWindow = createChapterWindow?.getParentWindow();
        if (parentWindow) {
            await refreshChapters(parentWindow, repoName, projectName);
        }
        if (createChapterWindow) createChapterWindow.close();
        return { success: true };
    } catch (error) {
        dialog.showErrorBox('Creation Failed', `Could not create chapter.
Error: ${error.message}`);
        return { success: false };
    }
});

ipcMain.on('load-projects', (event, repoName: string) => {
  const mainWindow = BrowserWindow.fromWebContents(event.sender);
  if (mainWindow) loadProjects(mainWindow, repoName);
});

// --- Repo, Token & Git Handlers ---

ipcMain.handle('set-pat', (_, token: string) => {
    setSetting('githubPat', token);
});

ipcMain.handle('get-repositories', () => ({
    repositories: getSetting<string[]>('repositories') || [],
    selected: getSetting<string>('selectedRepository') || null,
}));

ipcMain.on('set-selected-repository', (event, repoName: string) => {
    setSetting('selectedRepository', repoName);
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (mainWindow) {
        loadProjects(mainWindow, repoName);
    }
});



ipcMain.handle('add-repository', async (_, repoUrl: string) => {
    const repoName = getRepoNameFromUrl(repoUrl);
    if (!repoName) {
        dialog.showErrorBox('Invalid URL', 'Could not determine repository name from the URL.');
        return { success: false };
    }
    const targetPath = path.join(getStoragePath(), repoName);
    const pat = getSetting<string>('githubPat');
    const authenticatedUrl = pat ? repoUrl.replace('https://', `https://${pat}@`) : repoUrl;

      if (await fs.pathExists(targetPath)) {
          // Folder exists, now check if it's a valid git repo
          if (await fs.pathExists(path.join(targetPath, '.git'))) {
              dialog.showMessageBox({ title: 'Repository Exists', message: `The repository '${repoName}' has already been added.` });
          } else {
              // Folder exists but is NOT a git repo
              dialog.showErrorBox(
                    'Invalid Folder', // The title (first argument)
                    `A folder named '${repoName}' already exists but is not a valid Git repository.\n\nPlease manually remove this folder from the following location and try again:\n\n${targetPath}` // The content (second argument)
                );
              return { success: false };
          }
      } else {
          // Folder does not exist, so clone it
            try {
            // First, clone the repository
            await simpleGit().clone(authenticatedUrl, targetPath);

            const git = simpleGit(targetPath);
            let defaultBranch = 'main'; // Start with a safe default

            // Get information about the remote repository
            const remoteInfo = await git.remote(['show', 'origin']);

            // First, check if remoteInfo is a string before using .match()
            if (typeof remoteInfo === 'string') {
                const headBranchMatch = remoteInfo.match(/HEAD branch: (.*)/);
                if (headBranchMatch && headBranchMatch[1]) {
                    defaultBranch = headBranchMatch[1]; // If we find the branch, update it
                }
            }

            // Explicitly check out the determined branch
            await git.checkout(defaultBranch);


            await healRepositoryFolders(targetPath);

        } catch (error) {
              dialog.showErrorBox('Clone Failed', `Could not clone repository. This is often due to an invalid URL or an incorrect/missing Personal Access Token.\n\nError: ${error.message}`);
              return { success: false };
          }
      }
    const currentRepos = getSetting<string[]>('repositories') || [];
    if (!currentRepos.includes(repoName)) {
        setSetting('repositories', [...currentRepos, repoName]);
    }
    setSetting('selectedRepository', repoName);
    return { success: true, repoName };
});

ipcMain.handle('remove-repository', async (_, repoName: string) => {
    const { response } = await dialog.showMessageBox({
        type: 'warning',
        title: 'Permanently Delete Repository?',
        message: `Are you sure you want to delete '${getRepoFolderName(repoName)}'?`,
        // IMPORTANT: The warning message is now much stronger.
        detail: 'This will PERMANENTLY DELETE the repository folder and all its projects from your computer. This action cannot be undone.',
        buttons: ['Delete', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
    });

    if (response === 1) { // User clicked 'Cancel'
        return { success: false };
    }

    try {
        // Add this block to delete the actual folder
        const repoPath = path.join(getStoragePath(), getRepoFolderName(repoName));
        await fs.rm(repoPath, { recursive: true, force: true });

        // This existing logic removes the repository from the app's settings
        const currentRepos = getSetting<string[]>('repositories') || [];
        const newRepos = currentRepos.filter(r => r !== repoName);
        setSetting('repositories', newRepos);

        const selectedRepo = getSetting<string>('selectedRepository');
        if (selectedRepo === repoName) {
            setSetting('selectedRepository', newRepos.length > 0 ? newRepos[0] : null);
        }

        return { success: true };
    } catch (error) {
        console.error('Failed to remove repository:', error);
        dialog.showErrorBox('Delete Failed', `Could not delete the repository folder. Error: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('git-status', async (_, { repoName }) => {
    // First, check if this is a local repository. If so, do nothing.
    if (repoName.startsWith('[local] ')) {
        return { isClean: true, files: [] }; // Return a default "clean" status
    }

    // For online repos, use the helper function to get the correct folder name
    const repoPath = path.join(getStoragePath(), getRepoFolderName(repoName));

    // Add a check to ensure the directory exists before running git commands
    if (!await fs.pathExists(repoPath)) {
        console.error(`git-status: Directory not found at ${repoPath}`);
        return { isClean: true, files: [] };
    }

    const status = await simpleGit(repoPath).status();
    return {
        files: status.files,
        isClean: status.isClean(), // Pass the isClean status to the renderer
    };
});

ipcMain.on('heal-chapter-folders', async (event, chapterPath: string) => {
    try {
        const requiredFolders = [
            'Raws', 'Raws Cleaned', 'Edit Files', 'Typesetted', 'Final', 'data',
            path.join('data', 'TL Data'),
            path.join('data', 'PR Data')
        ];
        
        await Promise.all(
            requiredFolders.map(folder => fs.ensureDir(path.join(chapterPath, folder)))
        );

        dialog.showMessageBox({
            type: 'info',
            title: 'Success',
            message: 'Base folders have been checked and recreated if missing.'
        });
        event.reply('heal-folders-complete', { success: true });
    } catch (error) {
        console.error('Failed to heal chapter folders:', error);
        dialog.showErrorBox('Healing Failed', `Could not recreate folder structure. Error: ${error.message}`);
        event.reply('heal-folders-complete', { success: false, error: error.message });
    }
});

ipcMain.handle('git-commit', async (_, { repoName, message }) => {
    if (repoName.startsWith('[local] ')) {
        return { success: true, message: 'Local repository is already up-to-date.' };
    }
    const repoPath = path.join(getStoragePath(), repoName);
    const git = simpleGit(repoPath);
    await git.add('.');
    return await git.commit(message);
});

ipcMain.handle('get-pat-status', () => {
    return !!getSetting('githubPat');
});

ipcMain.handle('remove-pat', () => {
    deleteSetting('githubPat');
});

ipcMain.handle('git-push', async (_, { repoName }) => {
    if (repoName.startsWith('[local] ')) {
        dialog.showErrorBox('Operation Not Supported', 'You cannot push a local repository.');
        return { success: false };
    }
    // Update the path
    const repoPath = path.join(getStoragePath(), getRepoFolderName(repoName));
    await performAuthenticatedPush(simpleGit(repoPath));
    return { success: true };

});

ipcMain.handle('git-sync-repository', async (event, repoName: string) => {
    if (repoName.startsWith('[local] ')) {
        return { success: true, message: 'Local repository is already up-to-date.' };
    }
    const repoPath = path.join(getStoragePath(), repoName);
    const git = simpleGit(repoPath);

    try {
        await git.fetch();
        const status = await git.status();

        if (status.conflicted.length > 0) {
            // CONFLICT DETECTED!
            return {
                success: false,
                conflict: true,
                files: status.conflicted,
                message: 'Merge conflict detected.'
            };
        }

        if (status.behind > 0) {
            // If behind, we must pull. A simple pull can create new conflicts.
            await git.pull();
            const postPullStatus = await git.status();
            if (postPullStatus.conflicted.length > 0) {
                return {
                    success: false,
                    conflict: true,
                    files: postPullStatus.conflicted,
                    message: 'Merge conflict detected after pulling changes.'
                };
            }
        }

        if (status.ahead > 0 || !status.isClean()) {
            if (!status.isClean()) {
                await git.add('.');
                await git.commit(`Sync: Scanstation auto-commit on ${new Date().toISOString()}`);
            }
            await performAuthenticatedPush(git);
            return { success: true, message: 'Repository synced successfully!' };
        }

        return { success: true, message: 'Repository is already up-to-date.' };

    } catch (error) {
        if (error.message.includes('Merge conflict')) {
            const status = await git.status();
            return {
                success: false,
                conflict: true,
                files: status.conflicted,
                message: 'Merge conflict detected.'
            };
        }
        console.error(`Failed to sync repository ${repoName}:`, error);
        throw error;
    }
});

// Add this new handler to manage the force push
ipcMain.handle('resolve-conflict-force-push', async (event, repoName) => {
    if (repoName.startsWith('[local] ')) {
        return { success: true, message: 'Local repository is already up-to-date.' };
    }
    const repoPath = path.join(getStoragePath(), repoName);
    const git = simpleGit(repoPath);
    try {
        // Add all current files, commit them, and then force push
        await git.add('.');
        await git.commit('Force Push: Overwriting remote changes with local version.');
        await performAuthenticatedPush(git.push(['--force']));
        return { success: true, message: 'Successfully overwrote remote files with local versions.' };
    } catch (error) {
        console.error('Force push failed:', error);
        throw error;
    }
});

// --- Chapter Workspace IPC Handlers ---

// Helper function to read/write a JSON status file in the chapter's 'data' folder
async function getChapterStatus(chapterPath: string) {
    const statusFilePath = path.join(chapterPath, 'data', 'page_status.json');
    if (!await fs.pathExists(statusFilePath)) return {};
    const content = await fs.readFile(statusFilePath, 'utf-8');
    return content ? JSON.parse(content) : {};
}

// This helper calculates the total % complete for a given chapter
async function getChapterProgressPercent(chapterPath: string): Promise<number> {
  try {
    const rawFolderPath = path.join(chapterPath, 'Raws');
    // If Raws folder doesn't exist or is empty, chapter is 0% complete
    if (!await fs.pathExists(rawFolderPath)) return 0;
    const rawFiles = (await fs.readdir(rawFolderPath))
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    // Get all page status info, reusing existing logic from the workspace dashboard
    const cleanedFiles = await fs.readdir(path.join(chapterPath, 'Raws Cleaned'));
    const typesetFiles = await fs.readdir(path.join(chapterPath, 'Typesetted'));
    const cleanedBaseNames = new Set(cleanedFiles.map(getBaseName));
    const typesetBaseNames = new Set(typesetFiles.map(getBaseName));
    const statusData = await getChapterStatus(chapterPath); // Existing helper [cite: 715]

    // This logic creates the definitive list of "pages" (handling spreads) [cite: 719-731]
    let finalPages = rawFiles.map(pageFile => {
        const baseName = getBaseName(pageFile);
        return {
            fileName: pageFile,
            status: {
                CL: cleanedBaseNames.has(baseName),
                TS: typesetBaseNames.has(baseName),
                TL: (statusData[pageFile] || {}).TL || false,
                PR: (statusData[pageFile] || {}).PR || false,
                QC: (statusData[pageFile] || {}).QC || false,
            }
        };
    });

    const typesetSpreads = typesetFiles.filter(f => /^\d+[-_]\d+\..+$/.test(f)); // [cite: 725]
    for (const spreadFile of typesetSpreads) {
        const spreadMatch = getBaseName(spreadFile).match(/(\d+)[-_](\d+)/);
        if (!spreadMatch) continue;
        const pageNum1 = spreadMatch[1].padStart(2, '0');
        const pageNum2 = spreadMatch[2].padStart(2, '0');
        const firstPageIndex = finalPages.findIndex(p => getBaseName(p.fileName).startsWith(pageNum1));
        if (firstPageIndex !== -1) {
            finalPages = finalPages.filter(p => !getBaseName(p.fileName).startsWith(pageNum1) && !getBaseName(p.fileName).startsWith(pageNum2));
            const spreadPageEntry = {
                fileName: spreadFile,
                status: {
                    CL: true, TS: true, TL: true, // Spreads count as these 3 complete
                    PR: (statusData[spreadFile] || {}).PR || false,
                    QC: (statusData[spreadFile] || {}).QC || false,
                }
            };
            finalPages.splice(firstPageIndex, 0, spreadPageEntry);
        }
    }
    
    // --- New Cumulative Calculation ---
    const numPages = finalPages.length; 
    if (numPages === 0) return 0;
    
    const totalSteps = numPages * 5; // 5 steps per page (CL, TL, TS, PR, QC) [cite: 56]
    let completedSteps = 0;
    
    for (const page of finalPages) {
        if (page.status.CL === true) completedSteps++;
        if (page.status.TL === true) completedSteps++;
        if (page.status.TS === true) completedSteps++;
        if (page.status.PR === true) completedSteps++; // status 'annotated' is not 'true'
        if (page.status.QC === true) completedSteps++;
    }
    
    if (totalSteps === 0) return 0;
    return Math.floor((completedSteps / totalSteps) * 100);

  } catch (error) {
    // This often fails gracefully if a chapter has just been created and has no subfolders
    return 0; 
  }
}

async function saveChapterStatus(chapterPath: string, status: any) {
    const statusFilePath = path.join(chapterPath, 'data', 'page_status.json');
    await fs.ensureFile(statusFilePath);
    await fs.writeFile(statusFilePath, JSON.stringify(status, null, 2));
}

// Opens the chapter's folder in the system's file explorer
ipcMain.on('open-chapter-folder', (_, chapterPath: string) => {
    shell.openPath(chapterPath);
});

ipcMain.handle('get-chapter-page-status', async (_, chapterPath: string) => {
    try {
        const rawFiles = (await fs.readdir(path.join(chapterPath, 'Raws')))
            .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        const cleanedFiles = await fs.readdir(path.join(chapterPath, 'Raws Cleaned'));
        const typesetFiles = await fs.readdir(path.join(chapterPath, 'Typesetted'));
        const cleanedBaseNames = new Set(cleanedFiles.map(getBaseName));
        const typesetBaseNames = new Set(typesetFiles.map(getBaseName));
        const statusData = await getChapterStatus(chapterPath);

        let finalPages = rawFiles.map(pageFile => {
            const baseName = getBaseName(pageFile);
            return {
                fileName: pageFile,
                status: {
                    CL: cleanedBaseNames.has(baseName),
                    TS: typesetBaseNames.has(baseName),
                    TL: (statusData[pageFile] || {}).TL || false,
                    PR: (statusData[pageFile] || {}).PR || false,
                    QC: (statusData[pageFile] || {}).QC || false,
                }
            };
        });

        const typesetSpreads = typesetFiles.filter(f => /^\d+[-_]\d+\..+$/.test(f));

        for (const spreadFile of typesetSpreads) {
            const spreadMatch = getBaseName(spreadFile).match(/(\d+)[-_](\d+)/);
            if (!spreadMatch) continue;

            const pageNum1 = spreadMatch[1].padStart(2, '0');
            const pageNum2 = spreadMatch[2].padStart(2, '0');
            
            const firstPageIndex = finalPages.findIndex(p => getBaseName(p.fileName).startsWith(pageNum1));
            
            if (firstPageIndex !== -1) {
                finalPages = finalPages.filter(p => !getBaseName(p.fileName).startsWith(pageNum1) && !getBaseName(p.fileName).startsWith(pageNum2));
                const spreadPageEntry = {
                    fileName: spreadFile,
                    status: {
                        CL: true, TS: true, TL: true,
                        PR: (statusData[spreadFile] || {}).PR || false,
                        QC: (statusData[spreadFile] || {}).QC || false,
                    }
                };
                finalPages.splice(firstPageIndex, 0, spreadPageEntry);
            }
        }
        return { success: true, pages: finalPages };
    } catch (error) {
        console.error('Error Loading Pages:', error);
        return { success: false, pages: [] };
    }
});

// Generic handlers to read text or JSON file content
ipcMain.handle('get-file-content', async (_, filePath: string) => {
    return (await fs.pathExists(filePath)) ? fs.readFile(filePath, 'utf-8') : '';
});

ipcMain.handle('get-json-content', async (_, filePath: string) => {
    if (!await fs.pathExists(filePath)) return null;
    const content = await fs.readFile(filePath, 'utf-8');
    try {
        return JSON.parse(content);
    } catch (error) {
        console.error(`Failed to parse JSON from ${filePath}:`, error);
        return null; // Return null if file is corrupted
    }
});
// Saves translation text and drawing data

// --- REPLACE WITH THIS UPDATED VERSION ---
ipcMain.handle('save-translation-data', async (_, { chapterPath, pageFile, text, drawingData }) => {
    try {
        const tlDataPath = path.join(chapterPath, 'data', 'TL Data');
        await fs.ensureDir(tlDataPath);

        const status = await getChapterStatus(chapterPath);
        // Always save the text and drawing files
        await fs.writeFile(path.join(tlDataPath, `${pageFile}.txt`), text);
        await fs.writeFile(path.join(tlDataPath, `${pageFile}_drawing.json`), JSON.stringify(drawingData));
        
        if (!status[pageFile]) status[pageFile] = {};

        // Only mark as translated if there is actual text content.
        if (text && text.trim().length > 0) {
            status[pageFile].TL = true;
        } else {
            status[pageFile].TL = false;
        }

        await saveChapterStatus(chapterPath, status);
        return { success: true, newStatus: status[pageFile] };
    } catch (error) {
        console.error('Error saving translation data:', error);
        return { success: false, error: error.message };
    }
});

// Saves proofread annotations
ipcMain.handle('save-proofread-data', async (_, { chapterPath, pageFile, annotations }) => {
    try {
        const prDataPath = path.join(chapterPath, 'data', 'PR Data');
        await fs.ensureDir(prDataPath);

        const status = await getChapterStatus(chapterPath);
        // Always save the annotation file to capture when a user clears their notes
        await fs.writeFile(path.join(prDataPath, `${pageFile}_proof.txt`), annotations);

        if (!status[pageFile]) status[pageFile] = {};

        // Only circle the status if there are actual annotations.
        if (annotations && annotations.trim().length > 0) {
            status[pageFile].PR = 'annotated';
            status[pageFile].QC = 'annotated';
        } else {
            // If annotations are cleared, revert the status from 'annotated' to false (not started).
            // This won't affect pages that are already marked as correct (true).
            if (status[pageFile].PR === 'annotated') {
                status[pageFile].PR = false;
            }
            if (status[pageFile].QC === 'annotated') {
                status[pageFile].QC = false;
            }
        }

        await saveChapterStatus(chapterPath, status);
        return { success: true, newStatus: status[pageFile] };
    } catch (error) {
        console.error('Error saving proofread data:', error);
        return { success: false, error: error.message };
    }
});

// Marks a page as correct, copies it to the Final folder, and updates its status
ipcMain.handle('mark-page-correct', async (_, { chapterPath, pageFile }) => {
    try {
        const typesetDir = path.join(chapterPath, 'Typesetted');
        const allTypesetFiles = await fs.readdir(typesetDir);
        
        // Find the full filename in the Typesetted folder based on the base name of the pageFile
        const baseName = getBaseName(pageFile);
        const typesetFileName = allTypesetFiles.find(f => getBaseName(f) === baseName);

        if (!typesetFileName) {
          return { success: false, error: 'Typeset file not found.' };
        }
        
        const typesetPath = path.join(typesetDir, typesetFileName);
        await fs.copy(typesetPath, path.join(chapterPath, 'Final', typesetFileName), { overwrite: true });
        
        const status = await getChapterStatus(chapterPath);
        // Use the raw pageFile name as the key, even for spreads
        const statusKey = pageFile.includes('-') ? spreadCache.get(`${chapterPath}_${pageFile}_raw`) || pageFile : pageFile;
        if (!status[statusKey]) status[statusKey] = {};
        status[statusKey].PR = true;
        status[statusKey].QC = true;
        await saveChapterStatus(chapterPath, status);

        const annotationsPath = path.join(chapterPath, 'data', 'PR Data', `${baseName}_proof.txt`);
        if(await fs.pathExists(annotationsPath)) await fs.remove(annotationsPath);

        return { success: true, newStatus: status[statusKey] };
    } catch (error) {
        console.error('Error marking page as correct:', error);
        return { success: false, error: error.message };
    }
});

function checkGitInstallation(): Promise<boolean> {
    return new Promise((resolve) => {
        exec('git --version', (error) => {
            if (error) {
                resolve(false); // Git is not found
            } else {
                resolve(true); // Git is found
            }
        });
    });
}

function createWelcomeWindow() {
    welcomeWindow = new BrowserWindow({
        width: 600,
        height: 300,
        resizable: false,
        backgroundColor: '#2c2f33',
        webPreferences: {
            preload: WELCOME_WINDOW_PRELOAD_WEBPACK_ENTRY,
        },
    });
    welcomeWindow.loadURL(WELCOME_WINDOW_WEBPACK_ENTRY);
}

function getStoragePath(): string {
  const customPath = getSetting<string>('projectStoragePath');
  const basePath = customPath || path.join(app.getPath('userData'), 'Scanstation');
  return path.join(basePath, 'projects');
}

async function handleFirstBoot(): Promise<void> {
  if (getSetting('initialSetupComplete')) return;
  const { response } = await dialog.showMessageBox({
    type: 'info', title: 'Data Folder Configuration',
    message: 'Select a base folder for your Scanstation data.',
    detail: `A 'projects' subfolder will be created in the directory you choose.`,
    buttons: ['Select Custom Folder...', 'Use Default'], defaultId: 1,
  });
  if (response === 0) {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'], title: 'Select a Folder to Store Projects',
    });
    if (!canceled && filePaths.length > 0) {
      setSetting('projectStoragePath', filePaths[0]);
    }
  }
  setSetting('initialSetupComplete', true);
}

async function updateAllRepositories() {
    console.log('Checking for repository updates...');
    const repos = getSetting<string[]>('repositories') || [];
    const pat = getSetting<string>('githubPat');
    const outdatedRepos: string[] = [];

    for (const repoName of repos) {
        const repoPath = path.join(getStoragePath(), repoName);
        try {
            if (await fs.pathExists(path.join(repoPath, '.git'))) {
                console.log(`Checking for outdated status in ${repoName}...`);
                const git = simpleGit(repoPath);

                // Perform an authenticated fetch to get remote status
                if (pat) {
                    const remotes = await git.getRemotes(true);
                    const origin = remotes.find(r => r.name === 'origin');
                    if (origin) {
                        const originalUrl = origin.refs.fetch;
                        const cleanUrl = originalUrl.replace(/^(https:\/\/)(?:.*@)?(.*)$/, '$1$2');
                        try {
                            const authenticatedUrl = cleanUrl.replace('https://', `https://${pat}@`);
                            await git.remote(['set-url', 'origin', authenticatedUrl]);
                            await git.fetch();
                        } finally {
                            await git.remote(['set-url', 'origin', originalUrl]);
                        }
                    } else {
                         await git.fetch(); // Fallback for no origin
                    }
                } else {
                    await git.fetch();
                }

                // Check status and record if outdated
                const status = await git.status();
                if (status.behind > 0) {
                    outdatedRepos.push(repoName);
                }
            }
        } catch (error) {
            console.error(`Failed to check repository status for ${repoName}:`, error.message);
            // Silently fail for one repo to not interrupt the startup for others.
        }
    }

    // After checking all repos, show a single prompt if any are outdated.
    if (outdatedRepos.length > 0) {
        const isSingle = outdatedRepos.length === 1;
        const repoList = outdatedRepos.join(', ');
        dialog.showMessageBox({
            type: 'warning',
            title: `Repository${isSingle ? '' : 's'} Outdated`,
            message: `Your repositor${isSingle ? 'y' : 'ies'} (${repoList}) ${isSingle ? 'is' : 'are'} outdated.`,
            detail: 'Remember to pull before making any local changes to avoid potential conflicts.'
        });
    }

    console.log('Repository update check finished.');
}

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [ `default-src 'self'; script-src 'self' ${!app.isPackaged ? "'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' scanstation-asset: data:`, ], },
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
      console.error('Failed to resolve file path:', error, request.url);
      callback({ error: -6 });
    }
  });

  const isGitInstalled = await checkGitInstallation();

  if (!isGitInstalled) {
      createWelcomeWindow();
  } else {
      createSplashWindow();
      await handleFirstBoot();
      updateSplashStatus('Backing up current user folder...');
      await backupProjects();
      updateSplashStatus('Done!');
      
      // This now correctly calls the function that assigns the top-level mainWindow
      createWindow(); 

      setTimeout(() => {
          if (splashWindow && !splashWindow.isDestroyed()) {
              splashWindow.close();
          }
          if (mainWindow) {
            mainWindow.show();
          }

          // --- FILE WATCHER LOGIC ---
          // This watcher monitors the main projects folder for deleted repositories.
          const storagePath = getStoragePath();
          repoWatcher = chokidar.watch(storagePath, {
              depth: 0, // Only watch for repository folders, not their contents
              ignoreInitial: true,
          });

          repoWatcher.on('unlinkDir', (deletedPath) => {
              const deletedRepoName = path.basename(deletedPath);
              console.log(`Repository folder deleted: ${deletedRepoName}. Updating settings.`);

              const currentRepos = getSetting<string[]>('repositories') || [];
              const selectedRepo = getSetting<string>('selectedRepository');
              
              // Find the exact identifier (e.g., '[local] Offline') using the folder name ('Offline')
              const repoIdentifierToDelete = currentRepos.find(r => getRepoFolderName(r) === deletedRepoName);
              
              if (!repoIdentifierToDelete) return; // Not a tracked repo

              // Remove the deleted repository from the list
              const newRepos = currentRepos.filter(r => r !== repoIdentifierToDelete);
              setSetting('repositories', newRepos);

              // If the deleted repo was the one currently selected, update the selection
              if (selectedRepo === repoIdentifierToDelete) {
                  const newSelectedRepo = newRepos.length > 0 ? newRepos[0] : null;
                  setSetting('selectedRepository', newSelectedRepo);
              }

              // Notify the renderer window to refresh its entire view
              if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('repositories-updated');
              }
          });
          // --- END OF FILE WATCHER LOGIC ---

      }, 1200);
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        const gitInstalled = await checkGitInstallation();
        if (gitInstalled) {
            createWindow();
            if(mainWindow) mainWindow.show();
        } else {
            createWelcomeWindow();
        }
    }
  });
});



app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});