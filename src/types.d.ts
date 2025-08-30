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
  openProject: (repoName: string, projectName: string, chapterName: string) => void;
  deleteProject: (repoName: string, projectName: string) => Promise<{ success: boolean }>;
  openEditProjectWindow: (repoName: string, projectName: string) => void;

  // Chapter Workspace
  openChapterFolder: (chapterPath: string) => void;
  healChapterFolders: (chapterPath: string) => Promise<{ success: boolean }>;
  getChapterPageStatus: (chapterPath: string) => Promise<{ success: boolean; pages: any[] }>;
  getFileContent: (filePath: string) => Promise<string>;
  getJsonContent: (filePath: string) => Promise<any>;
  saveTranslationData: (data: any) => Promise<{ success: boolean; newStatus: any }>;
  saveProofreadData: (data: any) => Promise<{ success: boolean; newStatus: any; error?: string }>;
  markPageCorrect: (data: any) => Promise<{ success: boolean; newStatus: any; error?: string }>;
  openFileInEditor: (data: { editor: Editor; filePath: string }) => Promise<{ success: boolean; error?: string }>;
  // Settings Window
  openSettingsWindow: () => void;
  closeSettingsWindow: () => void;
  getEditorPaths: () => Promise<{ [key: string]: string }>;
  selectEditorPath: () => Promise<string | null>;
  setEditorPath: (data: { editor: Editor; path: string }) => void;
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
  onChaptersLoaded: (callback: (chapters: Chapter[]) => void) => void;
  onShowChapterSelection: (callback: (data: { repoName: string, projectName: string }) => void) => void;
  openCreateChapterWindow: (repoName: string, projectName: string) => void;
  goBackToProjects: (repoName: string, projectName: string) => void;

  // Create Chapter Window
  onProjectDataForCreateChapter: (callback: (data: { repoName: string; projectName: string }) => void) => void;
  submitChapterCreation: (data: any) => Promise<{ success: boolean }>;
  cancelChapterCreation: () => void;
  // Repo Management & Git
  loadProjects: (repoName: string) => void;
  getRepositories: () => Promise<{ repositories: string[]; selected: string | null }>;
  setSelectedRepository: (repoName: string) => void;
  addRepository: (repoUrl: string) => Promise<{ success: boolean; repoName?: string }>;
  getPatStatus: () => Promise<boolean>;
  setPat: (token: string) => Promise<void>;
  removePat: () => Promise<void>;
  gitStatus: (repoName: string) => Promise<any>;
  gitCommit: (repoName: string, message: string) => Promise<any>;
  gitPush: (repoName: string) => Promise<any>;
  gitPull: (repoName: string) => Promise<{ success: boolean; message?: string }>;
  gitSyncRepository: (repoName: string) => Promise<{ success: boolean; message?: string }>;
  // Universal APIs
  selectCoverImage: () => void;
  onCoverImageSelected: (callback: (path: string) => void) => void;
}

// This is the new part that fixes the errors
declare global {
  interface Window {
    api: IScanstationAPI;
  }
}