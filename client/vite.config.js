import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // You can specify a port for the Vite dev server
    proxy: {
      // Proxying API requests to the backend
      '/api': {
        target: 'http://localhost:5000', // Your backend server address
        changeOrigin: true, // Needed for virtual hosted sites
        secure: false,      // If your backend is not https
        // rewrite: (path) => path.replace(/^\/api/, '') // Optional: if you want to remove /api prefix when forwarding
      },
      // Proxying other backend routes if needed (e.g. /refresh_token)
      // Ensure these paths match your backend routes used by the client
      '/refresh_token': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      // If your auth routes like /login, /register are directly on root in backend:
      '/login': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
       '/register': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/logout': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/verify-email': {
         target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/send-email-verification': {
         target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/reset-password': {
         target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/forgot-password': {
         target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
      // Add any other specific backend paths your client calls directly that are not under /api
    }
  },
  build: {
    outDir: 'build' // Specifying the output directory for the build (similar to CRA)
  }
})
