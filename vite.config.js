import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/counting/',
  plugins: [react()],
  test: {
    globals: true,
  },
})
