import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@seekr/config': path.join(root, 'packages/config/src/index.ts'),
      '@seekr/shared': path.join(root, 'packages/shared/src/index.ts'),
      '@seekr/sdk': path.join(root, 'packages/sdk/src/index.ts'),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts'],
    passWithNoTests: false,
  },
});
