// REPLACE THE ENTIRE CONTENT of this file with this:

import './preload'; // This is the crucial line that fixes everything.

// We still keep these types for use in the renderer files.
export type Editor = 'photoshop' | 'illustrator' | 'gimp';

export interface Project {
  name: string;
  coverPath: string;
}
export interface Chapter {
  name: string;
}