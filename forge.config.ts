import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';

const config: ForgeConfig = {
  packagerConfig: {},
  rebuildConfig: {},
  makers: [new MakerSquirrel({}), new MakerZIP({}, ['darwin']), new MakerRpm({}), new MakerDeb({})],
  plugins: [
    new WebpackPlugin({
      mainConfig: './webpack.main.config.ts',
      renderer: {
        config: './webpack.renderer.config.ts',
        entryPoints: [

          // Inside the 'entryPoints' array in forge.config.ts
          {
            html: './src/splash.html',
            js: './src/splash-renderer.ts',
            name: 'splash_window',
            preload: {
              js: './src/preload.ts',
            },
          },
          {
            html: './src/index.html',
            js: './src/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
            },
          },
          {
            html: './src/create-project.html',
            js: './src/create-project-renderer.ts',
            name: 'create_project_window',
            preload: {
              js: './src/preload.ts',
            },
          },
          {
            html: './src/edit-project.html',
            js: './src/edit-project-renderer.ts',
            name: 'edit_project_window',
            preload: {
              js: './src/preload.ts',
            },
          },
          {
            html: './src/chapter-screen.html',
            js: './src/chapter-screen-renderer.ts',
            name: 'chapter_screen_window',
            preload: {
              js: './src/preload.ts',
            },
          },
          {
            html: './src/create-chapter.html',
            js: './src/create-chapter-renderer.ts',
            name: 'create_chapter_window',
            preload: {
              js: './src/preload.ts',
            },
          },
        ],
      },
    }),
  ],
};

export default config;