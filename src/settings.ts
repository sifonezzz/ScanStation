import * as Store from 'electron-store';

// This file is a WRAPPER around the problematic electron-store module.
// It is the ONLY file in the app that should import or deal with electron-store.
// It hides the complexity and exports a clean, simple API for the rest of the app to use.

// It's good practice to declare the type of your store's data
interface AppStore {
  initialSetupComplete?: boolean;
  projectStoragePath?: string;
}

// This is the ugly, but necessary, instantiation that works at runtime.
// The .default is needed because of how Webpack handles this specific CommonJS module.
const store: any = new (Store as any).default();

/**
 * Saves a key-value pair to the persistent settings file.
 * @param key The key to save.
 * @param value The value to save.
 */
export function setSetting(key: keyof AppStore, value: any): void {
  store.set(key, value);
}

/**
 * Retrieves a value from the persistent settings file.
 * @param key The key to retrieve.
 * @returns The stored value, or undefined if not found.
 */
export function getSetting<T>(key: keyof AppStore): T | undefined {
  return store.get(key) as T | undefined;
}