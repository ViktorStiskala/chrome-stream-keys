import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';

// Copy logo files to build directory
function copyLogos() {
  return {
    name: 'copy-logos',
    writeBundle() {
      const srcDir = resolve(__dirname, 'src/logo');
      const destDir = resolve(__dirname, 'build/chrome/extension/logo');
      
      try {
        mkdirSync(destDir, { recursive: true });
        const files = readdirSync(srcDir);
        files.forEach(file => {
          if (file.endsWith('.png')) {
            copyFileSync(resolve(srcDir, file), resolve(destDir, file));
          }
        });
      } catch (e) {
        console.warn('Could not copy logo files:', e);
      }
    },
  };
}

export default defineConfig({
  plugins: [
    webExtension({
      manifest: 'src/manifest.json',
      additionalInputs: [
        'src/handlers/disney.ts',
        'src/handlers/hbomax.ts',
      ],
    }),
    copyLogos(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'build/chrome/extension',
    emptyOutDir: true,
  },
});
