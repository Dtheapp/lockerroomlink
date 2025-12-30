import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Custom plugin to redirect non-hash routes to hash routes for HashRouter
const hashRouterRedirect = () => ({
  name: 'hash-router-redirect',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const url = req.url || '';
      // List of routes that should be redirected to hash routes
      const hashRoutes = ['/register/', '/event/', '/league/', '/team/', '/athlete/', '/dashboard', '/login'];
      
      // Check if URL starts with any hash route (but isn't already a hash route or asset)
      if (!url.includes('#') && !url.startsWith('/@') && !url.startsWith('/node_modules') && !url.includes('.')) {
        const matchedRoute = hashRoutes.find(route => url.startsWith(route));
        if (matchedRoute) {
          // Redirect to hash URL
          res.writeHead(302, { Location: `/#${url}` });
          res.end();
          return;
        }
      }
      next();
    });
  }
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProd = mode === 'production';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [hashRouterRedirect(), react()],
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
          },
        },
      },
    };
});
