import * as Store from 'electron-store';

// Replace the AppStore interface with this
export interface AppStore {
  initialSetupComplete?: boolean;
  projectStoragePath?: string;
  githubToken?: string;
  githubPat?: string;
  repositories?: string[];
  selectedRepository?: string;
  // Paths to external editors
  photoshopPath?: string;
  illustratorPath?: string;
  gimpPath?: string;
}

const store: any = new (Store as any).default();

export function setSetting(key: keyof AppStore, value: any): void {
  store.set(key, value);
}

export function getSetting<T>(key: keyof AppStore): T | undefined {
  return store.get(key) as T | undefined;
}

export function deleteSetting(key: keyof AppStore): void {
  store.delete(key);
}