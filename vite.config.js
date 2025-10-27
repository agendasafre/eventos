import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        retiro: resolve(__dirname, 'retiro.html'),
        mesas: resolve(__dirname, 'mesas.html'),
        sorteo: resolve(__dirname, 'sorteo.html'),
        manual: resolve(__dirname, 'manual.html'),
        quien: resolve(__dirname, 'quien.html'),
        retirados: resolve(__dirname, 'retirados.html'),
        pendientes: resolve(__dirname, 'pendientes.html'),
      },
    },
  },
});
