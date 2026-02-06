import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProd = mode === 'production';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [tailwindcss(), react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // PRODUCTION PROTECTION SETTINGS
        minify: 'terser', // Use terser for better minification than esbuild
        sourcemap: isProd ? false : true, // NO source maps in production (critical!)
        terserOptions: {
          compress: {
            drop_console: isProd, // Remove console.log in production
            drop_debugger: isProd, // Remove debugger statements
            pure_funcs: isProd ? ['console.log', 'console.info', 'console.debug', 'console.warn'] : [],
          },
          mangle: {
            safari10: true, // Compatibility
          },
          format: {
            comments: false, // Remove all comments
          },
        },
        rollupOptions: {
          output: {
            // Randomize chunk names to make reverse engineering harder
            chunkFileNames: isProd ? 'assets/[hash].js' : 'assets/[name]-[hash].js',
            entryFileNames: isProd ? 'assets/[hash].js' : 'assets/[name]-[hash].js',
            assetFileNames: isProd ? 'assets/[hash].[ext]' : 'assets/[name]-[hash].[ext]',
            // Split heavy vendor libs into separate cacheable chunks
            manualChunks: {
              'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/analytics'],
              'vendor-router': ['react-router-dom'],
              'vendor-charts': ['recharts'],
              'vendor-icons': ['lucide-react'],
            },
          },
        },
      },
    };
});
