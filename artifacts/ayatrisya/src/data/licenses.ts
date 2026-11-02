export interface ShippedDependencyLicense {
  name: string;
  version: string;
  license: string;
  authorOrCopyright: string;
  licenseUrl: string;
  category: 'runtime' | 'framework' | 'ui-components' | 'markdown-math' | 'storage-cloud';
  notes?: string;
}

export const SHIPPED_DEPENDENCY_LICENSES: ShippedDependencyLicense[] = [
  // Framework & Core
  {
    name: 'react',
    version: '^18.3.1',
    license: 'MIT',
    authorOrCopyright: 'Meta Platforms, Inc. and affiliates',
    licenseUrl: 'https://github.com/facebook/react/blob/main/LICENSE',
    category: 'framework',
  },
  {
    name: 'react-dom',
    version: '^18.3.1',
    license: 'MIT',
    authorOrCopyright: 'Meta Platforms, Inc. and affiliates',
    licenseUrl: 'https://github.com/facebook/react/blob/main/LICENSE',
    category: 'framework',
  },
  {
    name: 'wouter',
    version: '^3.3.5',
    license: 'MIT',
    authorOrCopyright: 'Alexey Taktarov',
    licenseUrl: 'https://github.com/molefrog/wouter/blob/main/LICENSE',
    category: 'framework',
  },
  {
    name: '@tanstack/react-query',
    version: '^5.66.0',
    license: 'MIT',
    authorOrCopyright: 'Tanner Linsley',
    licenseUrl: 'https://github.com/TanStack/query/blob/main/LICENSE',
    category: 'framework',
  },
  {
    name: 'zod',
    version: '^3.24.2',
    license: 'MIT',
    authorOrCopyright: 'Colin McDonnell',
    licenseUrl: 'https://github.com/colinhacks/zod/blob/master/LICENSE',
    category: 'runtime',
  },

  // Storage & Cloud Integrations
  {
    name: 'firebase',
    version: '^13.0.0',
    license: 'Apache-2.0',
    authorOrCopyright: 'Google LLC',
    licenseUrl: 'https://github.com/firebase/firebase-js-sdk/blob/master/LICENSE',
    category: 'storage-cloud',
    notes: 'Used for Google Firebase Authentication and Cloud storage tokens.',
  },
  {
    name: 'idb',
    version: '^8.0.4',
    license: 'ISC',
    authorOrCopyright: 'Jake Archibald',
    licenseUrl: 'https://github.com/jakearchibald/idb/blob/main/LICENSE',
    category: 'storage-cloud',
    notes: 'Pure client-side IndexedDB wrapper for local-first storage.',
  },
  {
    name: 'fake-indexeddb',
    version: '^6.2.6',
    license: 'Apache-2.0',
    authorOrCopyright: 'Dumbware / Jeremy Danyow',
    licenseUrl: 'https://github.com/dumbware/fake-indexeddb/blob/master/LICENSE',
    category: 'storage-cloud',
    notes: 'Development and testing polyfill for IndexedDB in headless environments.',
  },

  // UI Components & Icons
  {
    name: 'lucide-react',
    version: '^0.453.0',
    license: 'ISC',
    authorOrCopyright: 'Lucide Project Authors',
    licenseUrl: 'https://github.com/lucide-icons/lucide/blob/main/LICENSE',
    category: 'ui-components',
  },
  {
    name: 'clsx',
    version: '^2.1.1',
    license: 'MIT',
    authorOrCopyright: 'Luke Edwards',
    licenseUrl: 'https://github.com/lukeed/clsx/blob/master/license',
    category: 'ui-components',
  },
  {
    name: 'tailwind-merge',
    version: '^3.0.1',
    license: 'MIT',
    authorOrCopyright: 'Dany Castillo',
    licenseUrl: 'https://github.com/dcastil/tailwind-merge/blob/main/LICENSE',
    category: 'ui-components',
  },
  {
    name: 'class-variance-authority',
    version: '^0.7.1',
    license: 'Apache-2.0',
    authorOrCopyright: 'Joe Bell',
    licenseUrl: 'https://github.com/joe-bell/cva/blob/main/LICENSE',
    category: 'ui-components',
  },
  {
    name: '@radix-ui/react-dialog',
    version: '^1.1.7',
    license: 'MIT',
    authorOrCopyright: 'WorkOS',
    licenseUrl: 'https://github.com/radix-ui/primitives/blob/main/LICENSE',
    category: 'ui-components',
  },
  {
    name: '@radix-ui/react-dropdown-menu',
    version: '^2.1.7',
    license: 'MIT',
    authorOrCopyright: 'WorkOS',
    licenseUrl: 'https://github.com/radix-ui/primitives/blob/main/LICENSE',
    category: 'ui-components',
  },
  {
    name: '@radix-ui/react-tooltip',
    version: '^1.2.0',
    license: 'MIT',
    authorOrCopyright: 'WorkOS',
    licenseUrl: 'https://github.com/radix-ui/primitives/blob/main/LICENSE',
    category: 'ui-components',
  },
  {
    name: '@radix-ui/react-slot',
    version: '^1.2.0',
    license: 'MIT',
    authorOrCopyright: 'WorkOS',
    licenseUrl: 'https://github.com/radix-ui/primitives/blob/main/LICENSE',
    category: 'ui-components',
  },
  {
    name: 'sonner',
    version: '^2.0.7',
    license: 'MIT',
    authorOrCopyright: 'Emil Kowalski',
    licenseUrl: 'https://github.com/emilkowalski/sonner/blob/main/LICENSE',
    category: 'ui-components',
  },
  {
    name: 'framer-motion',
    version: '^12.4.7',
    license: 'MIT',
    authorOrCopyright: 'Framer B.V.',
    licenseUrl: 'https://github.com/framer/motion/blob/main/LICENSE.md',
    category: 'ui-components',
  },

  // Markdown, Math & Media
  {
    name: 'react-markdown',
    version: '^10.1.0',
    license: 'MIT',
    authorOrCopyright: 'Titus Wormer',
    licenseUrl: 'https://github.com/remarkjs/react-markdown/blob/main/license',
    category: 'markdown-math',
  },
  {
    name: 'remark-gfm',
    version: '^4.0.1',
    license: 'MIT',
    authorOrCopyright: 'Titus Wormer',
    licenseUrl: 'https://github.com/remarkjs/remark-gfm/blob/main/license',
    category: 'markdown-math',
  },
  {
    name: 'remark-math',
    version: '^6.0.0',
    license: 'MIT',
    authorOrCopyright: 'Junyoung Choi',
    licenseUrl: 'https://github.com/remarkjs/remark-math/blob/main/license',
    category: 'markdown-math',
  },
  {
    name: 'rehype-katex',
    version: '^7.0.1',
    license: 'MIT',
    authorOrCopyright: 'Junyoung Choi',
    licenseUrl: 'https://github.com/remarkjs/remark-math/blob/main/packages/rehype-katex/license',
    category: 'markdown-math',
  },
  {
    name: 'katex',
    version: '^0.19.0',
    license: 'MIT',
    authorOrCopyright: 'Khan Academy and other contributors',
    licenseUrl: 'https://github.com/KaTeX/KaTeX/blob/main/LICENSE',
    category: 'markdown-math',
  },
  {
    name: 'three',
    version: '^0.183.2',
    license: 'MIT',
    authorOrCopyright: 'Ricardo Cabello (Mr.doob) and three.js authors',
    licenseUrl: 'https://github.com/mrdoob/three.js/blob/dev/LICENSE',
    category: 'runtime',
  },
  {
    name: '@google/model-viewer',
    version: '^4.4.0',
    license: 'Apache-2.0',
    authorOrCopyright: 'Google LLC',
    licenseUrl: 'https://github.com/google/model-viewer/blob/master/LICENSE',
    category: 'runtime',
  },
];

