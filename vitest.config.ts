import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['apps/admin/src/**/*.test.ts'],environment:'node'}});
