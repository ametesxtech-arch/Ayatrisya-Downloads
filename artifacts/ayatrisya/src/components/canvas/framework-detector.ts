import { CanvasFile } from './types';

export type SupportedFramework = 'html' | 'react' | 'vite' | 'next' | 'node' | 'python' | 'generic';

export interface FrameworkDetectionResult {
  framework: SupportedFramework;
  name: string;
  entryPoint: string;
  devCommand: string;
  buildCommand: string;
  testCommand: string;
  defaultPort: number;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'pip' | 'none';
  dependencies: string[];
  devDependencies: string[];
  description: string;
}

/**
 * Automatically inspects Canvas project files and configuration to determine:
 * - Framework type (HTML, React, Vite, Next.js, Node.js, Python, etc.)
 * - Proper development command (never assuming every project uses `npm run dev`)
 * - Build and test commands
 * - Entry point file
 * - Default runtime port
 * - Dependencies & package manager
 */
export function detectFramework(files: CanvasFile[]): FrameworkDetectionResult {
  const fileNames = files.map((f) => f.name.toLowerCase());
  const packageJsonFile = files.find((f) => f.name.toLowerCase() === 'package.json');
  const requirementsTxt = files.find((f) => f.name.toLowerCase() === 'requirements.txt');
  const pyFiles = files.filter((f) => f.name.endsWith('.py'));
  const htmlFiles = files.filter((f) => f.name.endsWith('.html'));

  // 1. Inspect package.json if present
  if (packageJsonFile) {
    try {
      const parsed = JSON.parse(packageJsonFile.content || '{}');
      const deps = Object.keys(parsed.dependencies || {});
      const devDeps = Object.keys(parsed.devDependencies || {});
      const allDeps = [...deps, ...devDeps];
      const scripts = parsed.scripts || {};

      // Vite project (Vite + React / Vue / Vanilla)
      if (allDeps.includes('vite') || files.some((f) => f.name.includes('vite.config'))) {
        const isReact = allDeps.includes('react');
        return {
          framework: 'vite',
          name: isReact ? 'Vite + React SPA' : 'Vite Modern Web App',
          entryPoint: findEntryPoint(files, ['src/main.tsx', 'src/main.jsx', 'src/App.tsx', 'src/App.jsx', 'index.html']),
          devCommand: scripts.dev ? 'npm run dev' : 'npx vite',
          buildCommand: scripts.build ? 'npm run build' : 'npx vite build',
          testCommand: scripts.test ? 'npm test' : 'npx vitest run',
          defaultPort: 5173,
          packageManager: 'npm',
          dependencies: deps,
          devDependencies: devDeps,
          description: 'Modern lightning-fast frontend application with ESM hot module replacement.',
        };
      }

      // Next.js
      if (allDeps.includes('next') || files.some((f) => f.name.includes('next.config'))) {
        return {
          framework: 'next',
          name: 'Next.js Full-Stack Application',
          entryPoint: findEntryPoint(files, [
            'app/page.tsx',
            'app/page.jsx',
            'pages/index.tsx',
            'pages/index.jsx',
            'src/app/page.tsx',
            'src/pages/index.tsx',
          ]),
          devCommand: scripts.dev ? 'npm run dev' : 'npx next dev',
          buildCommand: scripts.build ? 'npm run build' : 'npx next build',
          testCommand: scripts.test ? 'npm test' : 'npx jest',
          defaultPort: 3000,
          packageManager: 'npm',
          dependencies: deps,
          devDependencies: devDeps,
          description: 'Production React framework with SSR, static generation and API routes.',
        };
      }

      // React (Create React App or Webpack React SPA)
      if (allDeps.includes('react')) {
        return {
          framework: 'react',
          name: 'React SPA',
          entryPoint: findEntryPoint(files, ['src/index.tsx', 'src/index.jsx', 'src/index.js', 'src/App.tsx', 'src/App.js']),
          devCommand: scripts.start ? 'npm start' : scripts.dev ? 'npm run dev' : 'react-scripts start',
          buildCommand: scripts.build ? 'npm run build' : 'react-scripts build',
          testCommand: scripts.test ? 'npm test' : 'react-scripts test --watchAll=false',
          defaultPort: 3000,
          packageManager: 'npm',
          dependencies: deps,
          devDependencies: devDeps,
          description: 'React client single page application with component architecture.',
        };
      }

      // Node.js Backend Server (Express, Fastify, Koa, or generic Node)
      const isExpress = allDeps.includes('express') || files.some((f) => f.content.includes("require('express')") || f.content.includes("from 'express'"));
      return {
        framework: 'node',
        name: isExpress ? 'Node.js Express Server' : 'Node.js Application',
        entryPoint: findEntryPoint(files, ['server.js', 'server.ts', 'index.js', 'app.js', 'src/index.js']),
        devCommand: scripts.dev ? 'npm run dev' : scripts.start ? 'npm start' : 'node server.js',
        buildCommand: scripts.build ? 'npm run build' : 'none',
        testCommand: scripts.test ? 'npm test' : 'node --test',
        defaultPort: 3000,
        packageManager: 'npm',
        dependencies: deps,
        devDependencies: devDeps,
        description: 'Server-side JavaScript runtime for APIs, microservices, and network utilities.',
      };
    } catch {
      // In case package.json is currently being edited with invalid JSON
    }
  }

  // 2. Python environment
  if (requirementsTxt || pyFiles.length > 0) {
    const deps = requirementsTxt
      ? requirementsTxt.content
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#'))
      : [];
    const mainPy = findEntryPoint(files, ['main.py', 'app.py', 'server.py', pyFiles[0]?.name || 'main.py']);
    const isFlaskOrFastAPI = deps.some((d) => d.toLowerCase().includes('fastapi') || d.toLowerCase().includes('flask')) ||
      pyFiles.some((f) => f.content.includes('FastAPI') || f.content.includes('Flask'));

    return {
      framework: 'python',
      name: isFlaskOrFastAPI ? 'Python Web Service (FastAPI/Flask)' : 'Python Analytics & Utility Engine',
      entryPoint: mainPy,
      devCommand: isFlaskOrFastAPI ? 'uvicorn main:app --reload --port 8000' : `python3 ${mainPy}`,
      buildCommand: requirementsTxt ? 'pip install -r requirements.txt' : 'none',
      testCommand: 'pytest',
      defaultPort: 8000,
      packageManager: 'pip',
      dependencies: deps,
      devDependencies: [],
      description: 'Python 3 script or backend service with scientific computing and web support.',
    };
  }

  // 3. Static HTML / CSS / JS Web Application
  if (htmlFiles.length > 0 || fileNames.includes('index.html')) {
    const entryHtml = findEntryPoint(files, ['index.html', htmlFiles[0]?.name || 'index.html']);
    return {
      framework: 'html',
      name: 'Static HTML5 / CSS / JS',
      entryPoint: entryHtml,
      devCommand: 'http-server . -p 80',
      buildCommand: 'none',
      testCommand: 'none',
      defaultPort: 80,
      packageManager: 'none',
      dependencies: [],
      devDependencies: [],
      description: 'Zero-configuration client-side HTML, CSS styling, and JavaScript interactive scripts.',
    };
  }

  // 4. Generic Project Fallback
  return {
    framework: 'generic',
    name: 'General Project',
    entryPoint: files[0]?.name || 'index.txt',
    devCommand: 'run',
    buildCommand: 'build',
    testCommand: 'test',
    defaultPort: 8080,
    packageManager: 'none',
    dependencies: [],
    devDependencies: [],
    description: 'Generic text or script files inside Ayatrisya development workspace.',
  };
}

function findEntryPoint(files: CanvasFile[], candidates: string[]): string {
  for (const c of candidates) {
    const match = files.find((f) => f.name.toLowerCase() === c.toLowerCase());
    if (match) return match.name;
  }
  return files[0]?.name || 'index.html';
}
