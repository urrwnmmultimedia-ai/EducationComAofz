/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // ไฟล์หลัก ~650 kB (gzip ~190 kB) คือ react-dom + supabase-js + react-router + zod ที่ทุกหน้าต้องใช้
    // หน้าที่เหลือแยกไฟล์โหลดเมื่อเปิดแล้ว (ดู src/app/router.tsx)
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
