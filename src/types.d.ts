export type Editor = 'photoshop' | 'illustrator' | 'gimp';

export interface Project {
  name: string;
  coverPath: string;
}
export interface Chapter {
  name: string;
}

export interface IScanstationAPI {
  // Main Window
  onProjectsLoaded: (callback: (projects: Project[]) => void) => void;
  openProject: (data: { 
    repoName: string; 
    projectName: string; 
    chapterName: string; 
    rect?: { top: number; left: number; width: number; height: number; }; 
  }) => void;

  deleteProject: (repoName: string, projectName: string) => Promise<{ success: boolean }>;
  openEditProjectWindow: (repoName: string, projectName: string) => void;

  // Chapter Workspace
  openChapterFolder: (chapterPath: string) => void;
  openChapterSubfolder: (data: { chapterPath: string; subfolder: string; }) => void; // <-- ADD THIS LINE
  healChapterFolders: (chapterPath: string) => void;
  onHealFoldersComplete: (callback: (result: { success: boolean; error?: string }) => void) => void;
  getChapterPageStatus: (chapterPath: string) => Promise<{ success: boolean; pages: any[] }>;
  getFileContent: (filePath: string) => Promise<string>;
  getJsonContent: (filePath: string) => Promise<any>;
  saveTranslationData: (data: any) => Promise<{ success: boolean; newStatus: any }>;
  saveProofreadData: (data: any) => Promise<{ success: boolean; newStatus: any; error?: string }>;
  markPageCorrect: (data: any) => Promise<{ success: boolean; newStatus: any; error?: string }>;
  openFileInEditor: (data: { editor: Editor; chapterPath: string; folder: string; baseFileName: string; }) => Promise<{ success: boolean; error?: string }>;
  getStitchedRawSpread: (data: { chapterPath: string; pageFile: string; }) => Promise<{ success: boolean; filePath?: string; error?: string; }>;
  startWatchingChapter: (chapterPath: string) => void;
  stopWatchingChapter: () => void;
  showTypesetImageContextMenu: (imagePath: string) => void;
  onFileAdded: (callback: () => void) => void;
  renameFilesInFolder: (data: { chapterPath: string; folderName: string; }) => Promise<{ success: boolean; message: string; }>; 
  getProofreadImages: (data: { chapterPath: string; pageFile: string; }) => Promise<{ success: boolean; rawPath?: string; tsPath?: string; error?: string; }>;

  // Settings Window
  openSettingsWindow: () => void;
  closeSettingsWindow: () => void;
  getEditorPaths: () => Promise<{ [key: string]: string }>;
  selectEditorPath: () => Promise<string | null>;
  setEditorPath: (data: { editor: Editor; path: string }) => void;
  addOfflineRepository: (repoName: string) => Promise<{ success: boolean }>;
  // Splash Window
  onStatusUpdate: (callback: (message: string) => void) => void;
  // Create Project Window
  createProject: (repoName: string) => void;
  onProjectDataForCreateProject: (callback: (data: { repoName: string }) => void) => void;
  submitProjectCreation: (data: { repoName: string; name: string; path: string }) => void;
  cancelProjectCreation: () => void;
  // Edit Project Window
  onProjectDataForEdit: (callback: (data: { name: string; coverPath: string; repoName: string }) => void) => void;
  submitProjectUpdate: (data: any) => Promise<{ success: boolean }>;
  cancelProjectUpdate: () => void;
  // Chapter Screen Navigation & Creation
  onProjectDataForChapterScreen: (callback: (data: any) => void) => void;
  getChapters: (repoName: string, projectName: string) => void;
  onChapterListDataLoaded: (callback: (data: { coverPath: string, chapters: any[] }) => void) => void;
  onShowChapterSelection: (callback: (data: { repoName: string, projectName: string }) => void) => void;
  openCreateChapterWindow: (repoName: string, projectName: string) => void;
  goBackToProjects: (repoName: string, projectName: string) => void;
  

  // Create Chapter Window
  onProjectDataForCreateChapter: (callback: (data: { repoName: string; projectName: string }) => void) => void;
  submitChapterCreation: (data: any) => Promise<{ success: boolean }>;
  cancelChapterCreation: () => void;
  // Repo Management & Git
  onRepositoriesUpdated: (callback: () => void) => void;
  loadProjects: (repoName: string) => void;
  getRepositories: () => Promise<{ repositories: string[]; selected: string | null }>;
  setSelectedRepository: (repoName: string) => void;
  addRepository: (repoUrl: string) => Promise<{ success: boolean; repoName?: string }>;
  removeRepository: (repoName: string) => Promise<{ success: boolean }>;
  getPatStatus: () => Promise<boolean>;
  setPat: (token: string) => Promise<void>;
  removePat: () => Promise<void>;
  gitStatus: (repoName: string) => Promise<any>;
  gitCommit: (repoName: string, message: string) => Promise<any>;
  gitPush: (repoName: string) => Promise<any>;
  gitPull: (repoName: string) => Promise<{ success: boolean; message?: string; conflict?: boolean; files?: string[] }>;  gitSyncRepository: (repoName: string) => Promise<{ success: boolean; message?: string; conflict?: boolean; files?: string[] }>;
  resolveConflictForcePush: (repoName: string) => Promise<{ success: boolean; message: string }>;
  // Universal APIs
  getSetting: (key: keyof AppStore) => Promise<any>;
  setSetting: (data: { key: keyof AppStore; value: any; }) => Promise<void>;
  selectCoverImage: () => void;
  openExternalLink: (url: string) => void;
  getGitIdentity: () => Promise<{ name: string; email: string }>;
  setGitIdentity: (data: { name: string; email: string; }) => Promise<{ success: boolean; error?: string }>;
  onCoverImageSelected: (callback: (path: string) => void) => void;
  createDesktopShortcut: () => Promise<{ success: boolean; error?: string }>;
  getAppVersion: () => Promise<string>;
}

// This is the new part that fixes the errors
declare global {
  interface Window {
    api: IScanstationAPI;
  }
}