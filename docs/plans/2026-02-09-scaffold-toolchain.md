# Scaffold Toolchain Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold the Node.js + TypeScript CLI toolchain with baseline config files and dependencies.

**Architecture:** Add standard package.json scripts/dependencies, TypeScript compiler config, Vitest config, and a minimal .gitignore. No runtime code changes in this task.

**Tech Stack:** Node.js, TypeScript, Vitest, npm

---

### Task 1: Scaffold the toolchain

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

**Step 1: Create `package.json`**

```json
{
  "name": "installer-cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "installer": "dist/index.js"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "chalk": "^5.3.0",
    "commander": "^11.1.0",
    "gradient-string": "^2.0.2",
    "log-update": "^5.0.1",
    "ora": "^7.0.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.11.30",
    "tsx": "^4.7.0",
    "typescript": "^5.4.2",
    "vitest": "^1.3.1"
  }
}
```

**Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "preserveShebang": true
  },
  "include": ["src/**/*.ts"]
}
```

**Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
```

**Step 4: Create `.gitignore`**

```
node_modules
dist
coverage
.DS_Store
.env
```

**Step 5: Install dependencies**

Run: `npm install`
Expected: installs all dependencies successfully

**Step 6: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore
git commit -m "chore: scaffold cli toolchain"
```
