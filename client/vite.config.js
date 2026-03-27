import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
  const useHttps = process.env.VITE_USE_HTTPS === 'true' || process.env.USE_HTTPS === 'true'
  const backendPort = process.env.BACKEND_PORT || '3001'
  const backendTarget = `${useHttps ? 'https' : 'http'}://localhost:${backendPort}`

  let httpsConfig = false
  if (useHttps) {
    const certPath = process.env.SSL_CERT_PATH
    const keyPath = process.env.SSL_KEY_PATH
    if (!certPath || !keyPath) {
      throw new Error('HTTPS enabled but SSL_CERT_PATH/SSL_KEY_PATH are missing for Vite')
    }

    httpsConfig = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    }
  }

  return {
    plugins: [react()],
    server: {
      https: httpsConfig,
      proxy: {
        '/api': { target: backendTarget, changeOrigin: true, secure: false },
        '/socket.io': { target: backendTarget, ws: true, secure: false },
        '/uploads': { target: backendTarget, changeOrigin: true, secure: false },
      },
    },
  }
})
