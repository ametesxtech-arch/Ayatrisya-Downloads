import type { PublicLegalPage } from './public-docs';
import { SHIPPED_DEPENDENCY_LICENSES } from './licenses';

export const fullProductPage: PublicLegalPage = {
  path: '/product',
  title: 'Ayatrisya Product Architecture',
  description: 'Ayatrisya is a high-performance intelligent reasoning, creation, and multimodal workspace built by AMETESX.',
  sections: [
    {
      heading: 'What is Ayatrisya?',
      paragraphs: [
        'Ayatrisya is an advanced agentic intelligence workspace developed by AMETESX. It combines deep conversational reasoning, code development, presentation generation, document drafting, and creative media into a single unified dark cinematic interface.',
        'Ayatrisya is built with a local-first philosophy: your conversations, draft documents, presentation decks, knowledge bases, and memories reside securely on your client machine via browser IndexedDB or native desktop storage unless you explicitly choose to back them up or sync them.',
      ],
      bullets: [
        'Local-First Workspace: Chats, knowledge items, memories, and Canvas projects stay in your browser by default.',
        'Universal Interactive Response Engine: Markdown responses automatically render interactive quizzes, sortable and filterable data tables, metric progress charts, and multi-step forms.',
        'High-Speed Streaming AI: Powered by Cloudflare Workers AI (@cf/meta/llama-3.1-8b-instruct) and Google Cloud Gemini models for low-latency streaming responses.',
        'Replit-Style Canvas IDE: Dedicated full-screen development workspace with multi-file tabs, live preview, syntax highlighting, and project export.',
        'Gamma-Style Presentation Engine: Multi-theme (.pptx) generator creating valid Microsoft Office OpenXML decks with SmartArt card grids, callouts, and badge headers.',
        'Instant Multi-Format Export: Download any assistant response directly as Microsoft Word (.docx), PDF, or .ZIP package.',
      ],
    },
    {
      heading: 'Cloud/Web vs. Desktop Capabilities',
      paragraphs: [
        'Ayatrisya maintains a strict technical boundary between its Cloud/Web browser deployment and its native Desktop application to respect security and sandbox boundaries.',
      ],
      bullets: [
        'Cloud/Web (https://ayatrisya.web.app): Operates strictly within standard web security boundaries. Provides web-based code authoring in Canvas IDE, live HTML/JS preview, cloud image generation via Cloudflare Workers AI / Hugging Face, speech-to-text, and Google Drive backup. Does not execute local shell commands or access client disk files.',
        'Desktop Application: Provides optional local-hardware model execution (e.g. running local Qwen checkpoints through loopback endpoints), native terminal execution with approval dialogs, local folder binding, and GPU-intensive 3D/video generation.',
      ],
    },
    {
      heading: 'Model Infrastructure & AI Providers',
      paragraphs: [
        'Ayatrisya routes inference requests through an authenticated backend API gateway with clear provider transparency:',
        '1. Cloudflare Workers AI: Fast streaming chat completion using Llama 3.1 8B Instruct and FLUX.1 Schnell image generation without third-party prompt monetization.',
        '2. Google Cloud Gemini: High-context multimodal intelligence and document analysis fallback.',
        '3. Hugging Face Spaces: Dedicated open-source inference pipelines for specialized generation tasks.',
      ],
    },
    {
      heading: 'Current Technical Boundaries & Limitations',
      paragraphs: [
        'To maintain honest engineering standards, Ayatrisya clearly discloses its architectural constraints:',
      ],
      bullets: [
        'Browser Terminal: The Web Canvas terminal provides client-side command processing and virtual file operations; it is not a root Linux virtual machine.',
        '3D & Video Generation: 3D model generation (.glb) and video workflows require native desktop hardware acceleration and are disabled on cloud guest sessions.',
        'Model Output Verification: Generated code, mathematical proofs, and factual citations should always be reviewed before production deployment.',
      ],
    },
  ],
};

export const fullPrivacyPolicyPage: PublicLegalPage = {
  path: '/privacy',
  title: 'Privacy Policy',
  description: 'How Ayatrisya and AMETESX protect your privacy, handle local data, and manage cloud processing.',
  sections: [
    {
      heading: 'Local-First Architecture',
      paragraphs: [
        'Ayatrisya is engineered to keep your personal data under your control. By default, all your conversations, chat messages, uploaded attachments, prompt history, memories, and Canvas IDE code files are stored locally in your browser’s IndexedDB and localStorage.',
        'Ayatrisya does not operate background scrapers or track your personal workspace data for AI model pretraining.',
      ],
    },
    {
      heading: 'Authentication & Account Data',
      paragraphs: [
        'When you create an account, Ayatrisya uses Firebase Authentication (Google Cloud) to manage secure sign-in. Your account profile stores only your basic identity token, email address, and optional display name.',
        'Guest mode is fully supported: guests can use chat, Canvas IDE, and basic studio tools without creating an account or transmitting personal identifying information.',
      ],
    },
    {
      heading: 'AI Inference & Data in Transit',
      paragraphs: [
        'When you submit a chat message or generation request:',
        '1. The request payload (your prompt and immediate conversation history) is transmitted via encrypted HTTPS (TLS 1.3) to our backend model gateway.',
        '2. The gateway verifies your authentication token and routes the request to the active inference provider (Cloudflare Workers AI or Google Gemini).',
        '3. Prompts are used solely to produce the requested model completion and are not retained in long-term databases by Ayatrisya for advertising or secondary training.',
      ],
    },
    {
      heading: 'Backups & Cloud Storage',
      paragraphs: [
        'Google Drive Backups: If you connect Google Drive, Ayatrisya accesses only the dedicated application folder authorized by you. Backups occur strictly on your explicit command.',
        'Cloudflare Storage: Cloud-hosted assets generated via Cloudflare Workers AI are delivered over secure CDN endpoints with time-bounded access.',
      ],
    },
    {
      heading: 'User Data Rights & Export',
      paragraphs: [
        'You have full control over your data at all times:',
        '1. Local Deletion: You can clear all conversations, local files, and memories instantly from Settings → Storage & Backup.',
        '2. Data Export: You can export your complete workspace as a JSON archive or download individual conversations as .docx, .pdf, or .zip packages.',
        '3. Account Inquiries: For account inquiries or data deletion requests, contact AMETESX at ametesxtech@gmail.com.',
      ],
    },
  ],
};

export const fullContactPage: PublicLegalPage = {
  path: '/contact',
  title: 'Contact & Support',
  description: 'Official contact channels and technical support for Ayatrisya and AMETESX.',
  sections: [
    {
      heading: 'AMETESX Support & Contact Channels',
      paragraphs: [
        'AYATRISYA is an original product developed and maintained by AMETESX. We welcome user feedback, bug reports, security disclosures, and enterprise partnership inquiries.',
      ],
      bullets: [
        'Official Support Email: ametesxtech@gmail.com',
        'Technical Inquiries: ametesxtech@gmail.com (Subject: [Ayatrisya Tech])',
        'Security & Responsible Disclosure: ametesxtech@gmail.com (Subject: [Security Vulnerability])',
        'Copyright & Licensing: ametesxtech@gmail.com (Subject: [Copyright / Legal])',
      ],
    },
    {
      heading: 'Responsible Disclosure Policy',
      paragraphs: [
        'If you discover a security vulnerability or boundary breach within Ayatrisya Cloud or Desktop, please report it directly to ametesxtech@gmail.com before public disclosure. We review and address verified security reports promptly.',
      ],
    },
    {
      heading: 'Product Inquiries & Feedback',
      paragraphs: [
        'You can also submit feature requests, Canvas IDE feedback, and model performance comments through the in-app Settings menu or by writing to our support team.',
      ],
    },
  ],
};

export const fullLicensesPage: PublicLegalPage = {
  path: '/licenses',
  title: 'Open Source Licenses & Attributions',
  description: 'Complete inventory of third-party open-source software packages shipped in Ayatrisya.',
  sections: [
    {
      heading: 'Open Source Attribution Policy',
      paragraphs: [
        'AYATRISYA is a proprietary product of AMETESX. However, we proudly stand on the shoulders of the open-source community. Open-source components integrated into Ayatrisya are NOT owned by Ametesx and remain subject to their respective copyright notices and licenses.',
        'Below is an accurate, real register of direct production dependencies shipped in the web application:',
      ],
    },
    {
      heading: 'Direct Production Dependencies Inventory',
      paragraphs: [
        'Every dependency listed below has been verified against the production package manifest (package.json):',
      ],
      bullets: SHIPPED_DEPENDENCY_LICENSES.map(
        (dep) => `${dep.name} (${dep.version}) — License: ${dep.license} | Author/Copyright: ${dep.authorOrCopyright} | Category: ${dep.category}`
      ),
    },
    {
      heading: 'Third-Party Font & Icon Notices',
      paragraphs: [
        '1. Lucide React: Icons used throughout Ayatrisya are provided by the Lucide project under the ISC License.',
        '2. KaTeX: Mathematical typesetting is powered by KaTeX (Khan Academy) under the MIT License.',
        '3. Google Fonts: Web typography utilizes DM Sans, Manrope, and IBM Plex Mono, served under the SIL Open Font License 1.1.',
      ],
    },
  ],
};

export const fullCookiesAndStoragePage: PublicLegalPage = {
  path: '/cookies',
  title: 'Cookies & Storage Policy',
  description: 'Detailed explanation of essential browser storage, persistence, and cookies used by Ayatrisya.',
  sections: [
    {
      heading: 'Essential Browser Storage',
      paragraphs: [
        'Ayatrisya is a local-first application that relies on standard browser storage mechanisms to function seamlessly without requiring intrusive server-side tracking cookies.',
      ],
      bullets: [
        'IndexedDB: Used as the primary local database for your conversations, messages, document drafts, presentations, attachments, personal memories, and Canvas IDE project files. This data remains on your physical device.',
        'localStorage: Stores interface preferences (such as theme choice, dark mode cinematic settings, active chat mode), model consent flags, and guest generation limits.',
        'sessionStorage: Stores temporary session tokens and ephemeral workflow state during active browser tabs.',
      ],
    },
    {
      heading: 'Cookies Used by Ayatrisya',
      paragraphs: [
        'Ayatrisya does NOT use third-party advertising cookies, behavioural cross-site tracking beacons, or marketing cookies.',
        'The only cookies used are strictly essential first-party cookies:',
      ],
      bullets: [
        'Sidebar Display Preference: A lightweight first-party cookie remembering whether the sidebar is collapsed or expanded.',
        'Firebase Authentication Cookie: Managed securely by the Firebase SDK to maintain signed-in session continuity across page reloads.',
      ],
    },
    {
      heading: 'How to Manage and Clear Local Storage',
      paragraphs: [
        'You can inspect or delete all locally stored data at any time:',
        '1. In Ayatrisya: Navigate to Settings → Storage & Backup and click "Clear local workspace records".',
        '2. In Browser Settings: Clear site data and cookies for ayatrisya.web.app in your browser privacy settings.',
        'Note: Clearing browser storage permanently deletes all local conversations and Canvas files unless you have saved an external backup.',
      ],
    },
  ],
};

