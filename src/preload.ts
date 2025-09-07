// REPLACE THE ENTIRE CONTENT of this file with this:
import { contextBridge, ipcRenderer } from 'electron';
import type { IScanstationAPI, Project, Chapter } from './types';

const api: IScanstationAPI = {
  // --- Main Window ---
  onProjectsLoaded: (callback: (projects: Project[]) => void) => ipcRenderer.on('projects-loaded', (_event, projects) => callback(projects)),
  openProject: (data: any) => ipcRenderer.send('open-project', data),
  deleteProject: (repoName: string, projectName: string) => ipcRenderer.invoke('delete-project', { repoName, projectName }),
  openEditProjectWindow: (repoName: string, projectName: string) => ipcRenderer.send('open-edit-project-window', { repoName, projectName }),

  // --- Chapter Workspace ---
  openChapterFolder: (chapterPath: string) => ipcRenderer.send('open-chapter-folder', chapterPath),
  healChapterFolders: (chapterPath: string) => ipcRenderer.send('heal-chapter-folders', chapterPath),
  onHealFoldersComplete: (callback) => ipcRenderer.on('heal-folders-complete', (_event, result) => callback(result)),
  getChapterPageStatus: (chapterPath: string) => ipcRenderer.invoke('get-chapter-page-status', chapterPath),
  getFileContent: (filePath: string) => ipcRenderer.invoke('get-file-content', filePath),
  getJsonContent: (filePath: string) => ipcRenderer.invoke('get-json-content', filePath),
  saveTranslationData: (data: any) => ipcRenderer.invoke('save-translation-data', data),
  saveProofreadData: (data: any) => ipcRenderer.invoke('save-proofread-data', data),
  markPageCorrect: (data: any) => ipcRenderer.invoke('mark-page-correct', data),
  openFileInEditor: (data: any) => ipcRenderer.invoke('open-file-in-editor', data),
  getStitchedRawSpread: (data) => ipcRenderer.invoke('get-stitched-raw-spread', data),
  startWatchingChapter: (chapterPath) => ipcRenderer.send('start-watching-chapter', chapterPath),
  stopWatchingChapter: () => ipcRenderer.send('stop-watching-chapter'), 
  onFileAdded: (callback) => ipcRenderer.on('file-added-to-chapter', callback),
  renameFilesInFolder: (data) => ipcRenderer.invoke('rename-files-in-folder', data),
  getProofreadImages: (data) => ipcRenderer.invoke('get-proofread-images', data),


  // --- Settings Window ---
  openSettingsWindow: () => ipcRenderer.send('open-settings-window'),
  closeSettingsWindow: () => ipcRenderer.send('close-settings-window'),
  getEditorPaths: () => ipcRenderer.invoke('get-editor-paths'),
  selectEditorPath: () => ipcRenderer.invoke('select-editor-path'),
  setEditorPath: (data: any) => ipcRenderer.invoke('set-editor-path', data),
  createDesktopShortcut: () => ipcRenderer.invoke('create-shortcut'),
  addOfflineRepository: (repoName) => ipcRenderer.invoke('add-offline-repository', repoName),

  // --- Splash Window ---
  onStatusUpdate: (callback: (message: string) => void) => ipcRenderer.on('status-update', (_event, message) => callback(message)),

  // --- Create Project Window ---
  createProject: (repoName: string) => ipcRenderer.send('open-create-project-window', repoName),
  onProjectDataForCreateProject: (callback: (data: { repoName: string }) => void) => ipcRenderer.on('project-data-for-create-project', (_event, data) => callback(data)),
  submitProjectCreation: (data: any) => ipcRenderer.send('submit-project-creation', data),
  cancelProjectCreation: () => ipcRenderer.send('cancel-project-creation'),

  // --- Edit Project Window ---
  onProjectDataForEdit: (callback: (data: any) => void) => ipcRenderer.on('project-data-for-edit', (_event, data) => callback(data)),
  submitProjectUpdate: (data: any) => ipcRenderer.invoke('submit-project-update', data),
  cancelProjectUpdate: () => ipcRenderer.send('cancel-project-update'),

  // --- Chapter Screen Navigation & Creation ---
  onProjectDataForChapterScreen: (callback: (data: any) => void) => ipcRenderer.on('project-data-for-chapter-screen', (_event, data) => callback(data)),
  getChapters: (repoName: string, projectName: string) => ipcRenderer.send('get-chapters', { repoName, projectName }),
  onChapterListDataLoaded: (callback: (data: { coverPath: string, chapters: any[] }) => void) => ipcRenderer.on('chapter-list-data-loaded', (_event, data) => callback(data)),  onShowChapterSelection: (callback: (data: { repoName: string, projectName: string }) => void) => ipcRenderer.on('show-chapter-selection-for-project', (_event, data) => callback(data)),
  openCreateChapterWindow: (repoName: string, projectName: string) => ipcRenderer.send('open-create-chapter-window', { repoName, projectName }),
  goBackToProjects: (repoName: string, projectName: string) => ipcRenderer.send('go-back-to-projects', { repoName, projectName }),

  // --- Create Chapter Window ---
  onProjectDataForCreateChapter: (callback: (data: { repoName: string; projectName: string }) => void) => ipcRenderer.on('project-data-for-create-chapter', (_event, data) => callback(data)),
  submitChapterCreation: (data: any) => ipcRenderer.invoke('submit-chapter-creation', data),
  cancelChapterCreation: () => ipcRenderer.send('cancel-chapter-creation'),

  // --- Repo Management & Git ---
  onRepositoriesUpdated: (callback: () => void) => ipcRenderer.on('repositories-updated', callback), 
  loadProjects: (repoName: string) => ipcRenderer.send('load-projects', repoName),
  getRepositories: () => ipcRenderer.invoke('get-repositories'),
  setSelectedRepository: (repoName: string) => ipcRenderer.send('set-selected-repository', repoName),
  addRepository: (repoUrl: string) => ipcRenderer.invoke('add-repository', repoUrl),
  removeRepository: (repoName: string) => ipcRenderer.invoke('remove-repository', repoName),
  getPatStatus: () => ipcRenderer.invoke('get-pat-status'),
  setPat: (token: string) => ipcRenderer.invoke('set-pat', token),
  removePat: () => ipcRenderer.invoke('remove-pat'),
  gitStatus: (repoName: string) => ipcRenderer.invoke('git-status', { repoName }),
  gitCommit: (repoName: string, message: string) => ipcRenderer.invoke('git-commit', { repoName, message }),
  gitPush: (repoName: string) => ipcRenderer.invoke('git-push', { repoName }),
  gitPull: (repoName: string) => ipcRenderer.invoke('git-pull', repoName),
  gitSyncRepository: (repoName: string) => ipcRenderer.invoke('git-sync-repository', repoName),
  resolveConflictForcePush: (repoName) => ipcRenderer.invoke('resolve-conflict-force-push', repoName),

  // --- Universal APIs ---
  selectCoverImage: () => ipcRenderer.send('select-cover-image'),
  getGitIdentity: () => ipcRenderer.invoke('get-git-identity'),
  setGitIdentity: (data) => ipcRenderer.invoke('set-git-identity', data),
  openExternalLink: (url: string) => ipcRenderer.send('open-external-link', url),
  onCoverImageSelected: (callback: (path: string) => void) => ipcRenderer.on('cover-image-selected', (_event, path) => callback(path)),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
};

contextBridge.exposeInMainWorld('api', api);