import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ciarka.pl is served from the domain root (GitHub Pages + CNAME)
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
})
