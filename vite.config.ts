import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { notesApiPlugin } from './notesApiPlugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), notesApiPlugin()],
})
