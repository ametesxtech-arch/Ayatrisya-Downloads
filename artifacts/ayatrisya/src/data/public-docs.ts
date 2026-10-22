export type DocSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type DocArticle = {
  id: string;
  category: string;
  title: string;
  summary: string;
  sections: DocSection[];
};

export const documentationArticles: DocArticle[] = [
  {
    id: 'overview',
    category: 'Getting started',
    title: 'Ayatrisya overview',
    summary: 'What the workspace does today, and where its current limits are.',
    sections: [
      {
        heading: 'Product and status',
        paragraphs: [
          'Ayatrisya is a product of Ametesx, as confirmed by its owner. It is a workspace for conversations, research, projects, coding workflows, documents, presentations, and creative studios.',
          'The interface and request paths exist for several AI-assisted workflows. Actual generation depends on a compatible Ayatrisya-operated model service being configured and passing a live inference test. The app does not bundle or train foundation models.',
        ],
      },
      {
        heading: 'Quick start',
        paragraphs: [
          'Create an account or sign in using the methods enabled for this deployment. Guest access is limited to chat and the image studio; guest content stays in this browser and does not sync automatically.',
          'Use Settings → Models to check whether a model is available. A listed model or a healthy endpoint is not proof of successful inference; run the live inference test before relying on generation.',
        ],
      },
      {
        heading: 'Supported environments',
        paragraphs: [],
        bullets: [
          'The web app works within browser permissions. It cannot browse arbitrary local folders or execute shell commands.',
          'The desktop app provides consent-based local folder and terminal workflows through a validated, isolated bridge.',
          'Some desktop installers or platform capabilities may be unavailable for a release. Check the Desktop page for current download status.',
          'Web use requires a modern browser with JavaScript and browser storage enabled. Exact minimum browser and operating-system versions have not been published; installer-specific requirements must be checked against the release.',
        ],
      },
      {
        heading: 'Frequently asked questions',
        paragraphs: [
          'Where is my workspace stored? In this browser’s IndexedDB unless you use an explicit optional backup/sync feature.',
          'Why is a model unavailable? The deployment may not have an operational compatible model. Check Settings → Models and run the live inference test.',
          'Can the website edit files on my computer? No. Local project-folder and terminal access are desktop-only and require user approval.',
          'Are studio previews real model outputs? Not unless the connected Ayatrisya model returns a supported result; the app should show unavailable status otherwise.',
        ],
      },
    ],
  },
  {
    id: 'accounts',
    category: 'Getting started',
    title: 'Accounts and sign-in',
    summary: 'Create an account, sign in, and understand guest access.',
    sections: [
      {
        heading: 'Account methods',
        paragraphs: [
          'Ayatrisya uses Firebase Authentication when the deployment is configured. The app currently includes email and password, Google, and GitHub sign-in flows; whether each provider works depends on the Firebase project configuration and enabled providers.',
          'Email/password account creation requires at least eight characters and sends an email-verification message. Password reset is available from the sign-in screen.',
        ],
      },
      {
        heading: 'Guest access',
        paragraphs: [
          'Guest mode does not create an account. It is limited to chat and the image studio, and guest content is stored locally in this browser. The guest image allowance is two generations; image generation remains unavailable if no compatible model is connected.',
          'Guest records are not automatically copied into an account. Use the explicit import/copy flow where available, and export a backup before changing devices or clearing browser data.',
        ],
      },
      {
        heading: 'Account deletion',
        paragraphs: [
          'The app does not currently offer an in-app Firebase account deletion flow. The signed-in account can sign out; browser-local content can be deleted from Storage and backup. The account administrator must provide and operate a verified account-deletion contact path before this documentation is published as final policy.',
        ],
      },
    ],
  },
  {
    id: 'storage',
    category: 'Privacy and storage',
    title: 'Storage and privacy',
    summary: 'Where Ayatrisya stores workspace content and when content leaves the device.',
    sections: [
      {
        heading: 'Browser storage',
        paragraphs: [
          'Conversations, messages, projects, project items, attachments, and preferences are stored in an owner-scoped IndexedDB database in the current browser profile. Guest mode and the guest image-use counter also use browser localStorage. The sidebar layout preference uses a first-party browser cookie.',
          'Clearing browser/site data, using private browsing, browser eviction, or device failure can remove local records. Exported backups contain private content and are not encrypted by the app.',
        ],
      },
      {
        heading: 'Local and hosted model processing',
        paragraphs: [
          'Ayatrisya Desktop can connect to a model service on the same computer through a loopback-only endpoint. In this route, the renderer does not send the request to the hosted gateway.',
          'The web app cannot access a visitor’s localhost model service. A hosted model request is sent to Ayatrisya’s same-origin API after the user invokes a model feature. The API verifies a Firebase ID token and forwards the request to the deployment-configured Ayatrisya model endpoint. Prompts and relevant conversation context are therefore processed outside the browser when hosted inference is used.',
          'The model endpoint operator, infrastructure region, retention period, and applicable service terms are deployment-specific and have not been verified in this workspace. The owner must complete those disclosures before treating this page as a final privacy policy.',
        ],
      },
      {
        heading: 'Optional backups and preferences sync',
        paragraphs: [
          'Google Drive is authorized by the user and used only after an explicit backup, restore, project, or item action. A full workspace backup can include conversations, messages, projects, notes, preferences, attachment metadata, and attachment bytes. The app also supports explicit project/item copies; this is not automatic continuous synchronization.',
          'Signed-in users can optionally enable Firebase Firestore synchronization for selected personalization settings, including the memory summary, and a built-in wallpaper choice. Chat history, attachments, and custom wallpaper image bytes are not included. Turning sync off stops future app sync but does not delete the existing Firestore document.',
        ],
      },
      {
        heading: 'Retention and deletion',
        paragraphs: [
          'The in-app local-data control removes this workspace owner’s records from this browser only. It does not delete a Firebase account, cloud personalization document, Google Drive copy, or hosted service logs. Account deletion is not available in the app. The app can move tracked Drive project/item copies to Drive trash, but a full backup must be deleted from Drive itself. No remote retention period is verified.',
        ],
      },
    ],
  },
  {
    id: 'models',
    category: 'Products',
    title: 'Models and generation',
    summary: 'Model capabilities, endpoint setup, and honest availability checks.',
    sections: [
      {
        heading: 'Model ownership and availability',
        paragraphs: [
          'Ayatrisya’s model gateway is intended to call an Ayatrisya-operated service. The client does not directly call OpenAI, Anthropic, Google, or other third-party model APIs. The app does not include model weights.',
          'A deployment must configure its HTTPS model endpoint and server-side key. Do not put credentials in browser-visible environment variables. The API requires Firebase authentication for hosted inference, applies per-user request limits, and uses request timeouts and bounded payloads.',
        ],
      },
      {
        heading: 'Available modalities',
        paragraphs: [
          'The client and gateway include request paths for chat, image generation, 3D GLB generation, music generation, transcription, and speech synthesis. A route is not evidence that a compatible model is installed or that output quality is established.',
          'Current live model connectivity and successful generation are not independently verified by this documentation page. Use Settings → Models → Live inference test. Studios should report unavailable models rather than display mock output as generated content.',
        ],
      },
      {
        heading: 'Troubleshooting',
        paragraphs: [],
        bullets: [
          '“Model unavailable” means the capability check did not confirm that model and modality.',
          'For hosted models, confirm Firebase Authentication and the API server’s endpoint/key configuration with the deployment owner.',
          'For desktop-local models, use a service on the same computer and a loopback address only. LAN and public endpoints are rejected.',
          'Do not paste API keys into chat, browser settings, source files, or logs.',
        ],
      },
    ],
  },
  {
    id: 'coding',
    category: 'Products',
    title: 'Coding workspace',
    summary: 'Understand browser boundaries and the desktop project workflow.',
    sections: [
      {
        heading: 'Web versus desktop',
        paragraphs: [
          'The browser coding workspace works with content the user explicitly provides or imports into the app. Browser-based coding does not have unrestricted access to the computer’s filesystem or terminal.',
          'Ayatrisya Desktop can open user-selected project folders and offers a permission-controlled terminal. File access and command execution are mediated by the native process; commands require explicit review/approval. The renderer does not receive unrestricted Node.js, filesystem, or shell access.',
        ],
      },
      {
        heading: 'Coding agent and planner',
        paragraphs: [
          'The coding workflow can prepare a project plan and propose edits/commands. Review proposed changes and command effects before approval. Generated code may be incomplete or unsafe and should be inspected and tested before use.',
          'A planner or generated plan does not itself change files. An approved operation can still fail because of file permissions, missing tools, project configuration, or an unavailable model.',
        ],
      },
      {
        heading: 'Limitations',
        paragraphs: [],
        bullets: [
          'The website cannot execute local commands or modify folders on the visitor’s computer.',
          'Desktop capabilities depend on the installed app, platform, requested permissions, and available local tools.',
          'Model output and generated code are not guaranteed to compile, be secure, or meet a project’s requirements.',
        ],
      },
    ],
  },
  {
    id: 'studios',
    category: 'Products',
    title: 'Creative studios',
    summary: 'Image, 3D, music, transcription, and speech workflows.',
    sections: [
      {
        heading: 'Generation status',
        paragraphs: [
          'The application has studio interfaces and gateway contracts for image output (PNG/JPEG), 3D output (GLB), music output (WAV/MP3), speech transcription, and speech synthesis. Actual results require compatible models at the configured Ayatrisya model service.',
          'No trained generation weights are packaged with the web application. Do not treat a form submission, mock illustration, preview, or procedural asset as evidence of trained-AI generation.',
        ],
      },
      {
        heading: 'Files and user responsibility',
        paragraphs: [
          'Generated files are saved to the user’s workspace/library when a real supported response is returned. Review content and rights before sharing or using it commercially. Generated output can be inaccurate, resemble existing works, or contain errors.',
        ],
      },
    ],
  },
  {
    id: 'desktop',
    category: 'Products',
    title: 'Ayatrisya Desktop',
    summary: 'Installers, local projects, model connection, and platform support.',
    sections: [
      {
        heading: 'Desktop app',
        paragraphs: [
          'Ayatrisya Desktop is an Electron application with a context-isolated UI/native bridge. Installers are built per operating system; availability is shown on the Desktop page. A build artifact is not by itself proof that an installer was launched and tested on that operating system.',
          'Choose folders through the native folder picker. The app reports permission errors and does not claim web pages can browse local files.',
        ],
      },
      {
        heading: 'Local model setup',
        paragraphs: [
          'In Ayatrisya Desktop, open Settings → Models → Desktop-only local model and enter a loopback URL such as http://127.0.0.1:1234. The app checks health, capabilities, and live inference. It does not send a local model API key.',
          'Cloud inference is a separate route and is not used as a silent fallback when desktop-local inference is unavailable.',
        ],
      },
      {
        heading: 'Updates and support',
        paragraphs: [
          'Installer availability and release status are deployment-specific. The app’s Desktop page should be treated as the source for current download links. The owner must provide verified update and support channels before these instructions are final.',
        ],
      },
    ],
  },
  {
    id: 'connectors',
    category: 'Products',
    title: 'Connected services',
    summary: 'Optional GitHub, Figma, and Google Drive integrations.',
    sections: [
      {
        heading: 'GitHub and Figma',
        paragraphs: [
          'The optional account connectors request GitHub read:user and Figma current_user:read. They retrieve account identity only; they do not read repositories or Figma design files. OAuth codes, provider tokens, and account names pass through the Ayatrisya API service, with the encrypted server session held in an HttpOnly cookie rather than browser JavaScript.',
          'Disconnecting removes the Ayatrisya session. It does not necessarily revoke the provider grant; revoke that authorization in the GitHub or Figma account settings as well.',
        ],
      },
      {
        heading: 'Google Drive',
        paragraphs: [
          'Google Drive is an optional, user-initiated backup/restore integration. It uses the narrow drive.file scope and does not continuously synchronize all workspace data. The OAuth client must be configured by the deployment owner.',
        ],
      },
      {
        heading: 'Unconfigured integrations',
        paragraphs: [
          'If provider credentials or configuration are missing, Ayatrisya reports the integration as unavailable. Do not treat the presence of a settings panel as proof that an OAuth application is connected.',
        ],
      },
    ],
  },
  {
    id: 'war-mode',
    category: 'Security',
    title: 'WAR MODE rule-based scanning',
    summary: 'Windows-only on-demand YARA-X scanning and its limitations.',
    sections: [
      {
        heading: 'What it is',
        paragraphs: [
          'On Windows desktop, WAR MODE uses YARA-X 1.22.0 with a reviewed Signature-Base snapshot. The packaged baseline contains 711 licensed source files and 4,886 rule declarations. It is a local, on-demand rule scanner—not a full antivirus replacement.',
          'Microsoft Defender remains separate and unchanged. YARA-X matches are indicators that require review; a match is not a confirmed malware verdict. The app does not automatically delete files.',
        ],
      },
      {
        heading: 'Privacy and limits',
        paragraphs: [
          'Scanning is performed locally. The documented Windows implementation supports progress, cancellation, skipped/inaccessible/failed counts, review, recoverable quarantine, restoration, and manual signature updates. If a safe quarantine move cannot be established, the original file is left in place.',
          'It is not real-time, scheduled, kernel-level, or complete malware protection. Some files may be skipped or inaccessible; false-positive rates have not been established.',
        ],
      },
      {
        heading: 'Verification boundaries',
        paragraphs: [
          'The repository’s WAR MODE test report records a Windows CI installer smoke test and packaged scanner integration checks, including harmless EICAR detection, a benign control, quarantine/restore, cancellation, failed-update retention, and an access-denied case. The test did not physically disable networking, did not prove successful signature updates, and was not a full interactive UI test.',
        ],
      },
    ],
  },
  {
    id: 'developer',
    category: 'Developer documentation',
    title: 'Architecture and configuration',
    summary: 'Verified API paths, environment variable names, and local checks.',
    sections: [
      {
        heading: 'Architecture',
        paragraphs: [
          'The Ayatrisya web client is a React and TypeScript application built with Vite. Local workspace records are stored in IndexedDB. The API service is a separate Express application. Ayatrisya Desktop wraps the web UI in Electron and uses validated IPC for native operations.',
        ],
      },
      {
        heading: 'Model API paths',
        paragraphs: [],
        bullets: [
          'GET /api/model/health and GET /api/model/capabilities',
          'POST /api/model/chat',
          'POST /api/model/generate/image, /api/model/generate/3d, and /api/model/generate/music',
          'POST /api/model/transcribe and POST /api/model/speech',
          'Hosted model routes require a verified Firebase ID token. The server stores/forwards the model credential; the browser must never receive it.',
        ],
      },
      {
        heading: 'Environment variable names',
        paragraphs: [
          'Names below are documented from the repository’s environment example and source. They are names and purposes only; never place secret values in this page, source control, browser-visible VITE_ variables, or logs.',
        ],
        bullets: [
          'VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID — Firebase web app identifiers/configuration.',
          'FIREBASE_PROJECT_ID — server-side Firebase ID-token verification project.',
          'AYATRISYA_MODEL_ENDPOINT — server-side HTTPS Ayatrisya model endpoint; non-secret.',
          'AYATRISYA_MODEL_API_KEY — server-side model credential; secret.',
          'GITHUB_OAUTH_CLIENT_ID / GITHUB_OAUTH_CLIENT_SECRET and FIGMA_OAUTH_CLIENT_ID / FIGMA_OAUTH_CLIENT_SECRET — OAuth app configuration; secrets stay server-side.',
          'VITE_GOOGLE_CLIENT_ID — Google Drive browser OAuth client identifier.',
          'SESSION_SECRET — server-side signing/encryption secret for OAuth state/session handling.',
          'AYATRISYA_APP_ORIGIN — allowed HTTPS origin for production OAuth flows.',
          'VITE_DESKTOP_DOWNLOAD_URL, VITE_DESKTOP_DOWNLOAD_LINUX_URL, VITE_DESKTOP_DOWNLOAD_WINDOWS_URL, VITE_DESKTOP_DOWNLOAD_MAC_URL — optional public release/installer URLs.',
        ],
      },
      {
        heading: 'Build and tests',
        paragraphs: [],
        bullets: [
          'From the workspace root: pnpm run typecheck',
          'Ayatrisya checks: pnpm --filter @workspace/ayatrisya run typecheck and pnpm --filter @workspace/ayatrisya run test',
          'API checks: pnpm --filter @workspace/api-server run test',
          'Production build: pnpm --filter @workspace/ayatrisya run build',
          'A successful automated test suite does not verify live model inference, OAuth provider configuration, or platform installer behavior unless those specific integration tests run.',
        ],
      },
      {
        heading: 'Versioning',
        paragraphs: [
          'The current workspace package manifests identify the product packages as 0.0.0. No public release/changelog process was found in the checked project files. The owner should define a release versioning policy before publishing developer documentation.',
        ],
      },
    ],
  },
];

export type PublicSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type PublicLegalPage = {
  path: string;
  title: string;
  description: string;
  reviewed: boolean;
  sections: PublicSection[];
};

export const publicLegalPages: PublicLegalPage[] = [
  {
    path: '/terms',
    title: 'Terms of Service',
    description: 'Draft use terms for the Ayatrisya app and its experimental features.',
    reviewed: false,
    sections: [
      {
        heading: 'Draft status',
        paragraphs: [
          'Draft for owner and legal review. This page is not legal advice and is not a claim that a binding agreement has been accepted. Owner review is required to identify the service operator, effective date, governing law, jurisdiction, and a valid notice/contact process.',
        ],
      },
      {
        heading: 'Use and account security',
        paragraphs: [
          'Use the service lawfully and do not attempt to disrupt, abuse, or gain unauthorized access to the app, accounts, integrations, model endpoints, or other users’ data. Keep account credentials secure and review provider authorization requests before approving them.',
          'Do not use the service to process content you do not have the right to submit. You remain responsible for your prompts, uploaded files, generated outputs, and actions taken using the app.',
        ],
      },
      {
        heading: 'AI output and important decisions',
        paragraphs: [
          'AI output can be inaccurate, incomplete, biased, insecure, or unsuitable. Verify code, research, legal, medical, financial, safety, and other consequential information with qualified sources before relying on it. Generated output is not a guarantee of originality, correctness, or fitness for a particular use.',
        ],
      },
      {
        heading: 'Availability and changes',
        paragraphs: [
          'Features may be experimental, unavailable, changed, or discontinued. A user interface or API route does not promise that a model, connector, installer, or external service is currently configured or operational. Use the app’s status and live tests where available.',
        ],
      },
      {
        heading: 'Intellectual property and third parties',
        paragraphs: [
          'Rights in the Ayatrisya app, Ametesx branding, user-submitted content, model outputs, and third-party components differ. Third-party software and assets remain subject to their own licenses. Do not assume that using generated content grants rights to underlying third-party material.',
        ],
      },
      {
        heading: 'Suspension, termination, and liability',
        paragraphs: [
          'The service operator may need to restrict access to address abuse, security, legal, or operational issues. The app currently has no published suspension/appeal process. Any final limitation of liability, warranty disclaimer, indemnity, governing-law, and termination terms require qualified legal review and owner confirmation; no jurisdiction or enforceability claim is made here.',
        ],
      },
    ],
  },
  {
    path: '/copyright',
    title: 'Copyright and intellectual property',
    description: 'How Ayatrisya identifies its own material and third-party materials.',
    reviewed: false,
    sections: [
      {
        heading: 'Ametesx and Ayatrisya ownership statement',
        paragraphs: [
          'Ayatrisya is a product of Ametesx, as confirmed by its owner. This confirms the product relationship; it does not by itself establish authorship, copyright assignment, trademark registration, or exclusive rights in any specific code, design, logo, document, model, contribution, or other asset. Subject to applicable law and documented third-party rights, Ametesx claims ownership of original intellectual property created for and lawfully owned by Ametesx. That claim applies only where authorship, ownership, assignment, or license rights can be verified. The repository alone does not establish that a work was assigned or licensed to Ametesx.',
        ],
      },
      {
        heading: 'Brand identity',
        paragraphs: [
          'The Ametesx and Ayatrisya names, logos, and product identities are intended to identify Ametesx and its products. Their legal status and any registrations have not been verified here and must not be misrepresented.',
        ],
      },
      {
        heading: 'Original software and content',
        paragraphs: [
          'Ametesx claims rights in original software, source code, website design, interface layouts, original graphics, product documentation, writing, and marketing materials only where the work was created for and is lawfully owned by Ametesx, or validly assigned or licensed to it. For verified proprietary materials, rights are reserved only to the extent Ametesx owns or is authorized to enforce them; no broader permission to copy, modify, redistribute, commercially exploit, or use Ametesx-owned branding is granted except as expressly authorized or permitted by law. This does not override an applicable open-source or third-party license. The repository alone does not establish authorship or transfer of rights. No patent or completed assignment is asserted.',
        ],
      },
      {
        heading: 'Third-party material and licensing',
        paragraphs: [
          'Third-party software, models, datasets, fonts, icons, libraries, rules, and other materials remain subject to their respective owners’ rights and license terms. Ametesx does not claim third-party ownership merely because material is used, integrated, hosted, or distributed with an Ametesx product.',
          'The root package manifest declares MIT, but no root LICENSE text was found in the checked repository and the scope of that manifest declaration is unresolved. The Ayatrisya package is marked private and does not declare a package license. Do not infer that the MIT declaration applies to all product code, brand assets, models, datasets, or content. No license was changed for this review.',
        ],
      },
      {
        heading: 'Models, user content, and generated content',
        paragraphs: [
          'No foundation-model weights are bundled with the web application. The model-service operator, model licenses, training data rights, and terms for generated output have not been verified. This page does not claim ownership of user-submitted content or model output, and it does not guarantee that generated output is original or free of third-party rights.',
        ],
      },
      {
        heading: 'Rights requests and publication status',
        paragraphs: [
          'Ametesx may enforce rights it owns or is authorized to enforce, subject to applicable law. Rights-request contact: pending owner configuration; no verified, monitored contact channel was found in the checked project. This page remains a draft until the contact channel, repository license scope, and creator/contributor ownership records are reviewed. The intended notice for verified Ametesx-owned or authorized materials is “© [current year] Ametesx. All rights reserved.”',
        ],
      },
    ],
  },
  {
    path: '/licenses',
    title: 'Third-party licenses and attributions',
    description: 'Selected direct dependencies, bundled scanner notices, and unresolved license review.',
    reviewed: false,
    sections: [
      {
        heading: 'Scope of this inventory',
        paragraphs: [
          'This is a first-party dependency/asset inventory based on the Ayatrisya package manifest, installed package metadata, and checked bundled notices. It is not a complete software bill of materials: a full transitive dependency and release-artifact scan is still required before distribution.',
        ],
      },
      {
        heading: 'Selected direct dependencies',
        paragraphs: [
          'The checked installed package metadata identifies these representative direct dependencies and their declared licenses:',
        ],
        bullets: [
          'React, React DOM, Vite, TypeScript, Tailwind CSS, Wouter, Zod, TanStack Query, Radix UI packages, Firebase JavaScript SDK, Electron, and Electron Builder — MIT, except where noted below.',
          'Lucide React — ISC.',
          'idb — ISC.',
          'class-variance-authority — Apache-2.0.',
          '@google/model-viewer — Apache-2.0.',
          'fake-indexeddb — Apache-2.0.',
          'wouter — Unlicense.',
        ],
      },
      {
        heading: 'Fonts and icons',
        paragraphs: [
          'The client imports DM Sans, Manrope, and IBM Plex Mono through Google Fonts. The font files are served by Google Fonts at runtime; verify family-specific SIL Open Font License notices and include the relevant notices if bundling font files in a release. Lucide icons are used from the ISC-licensed Lucide React package.',
        ],
      },
      {
        heading: 'WAR MODE bundled software and rules',
        paragraphs: [
          'Windows WAR MODE bundles YARA-X v1.22.0 under BSD-3-Clause and the reviewed Signature-Base rule snapshot under the project’s Detection Rule License (DRL) 1.1 terms. The source files contain author metadata and the app displays attribution for rule matches. The corresponding license and notice files ship in the Windows resources.',
          'The checked baseline is snapshot 3ce6640c26046da8e6d8094af3eaaee3ee84e648: 711 reviewed source files containing 4,886 rule declarations. These rules are not an antivirus replacement and retain their own attribution/license conditions.',
        ],
      },
      {
        heading: 'Models and unresolved review',
        paragraphs: [
          'No foundation-model weights are bundled in the Ayatrisya web app. The configured model endpoint and any models it serves must be audited and attributed separately by the service owner; no model license is asserted here.',
          'Owner review required: produce a complete transitive SBOM/license report for each published web and desktop build, confirm the repository MIT scope, confirm Google Fonts delivery/notice requirements, and audit model-service licenses separately.',
        ],
      },
    ],
  },
  {
    path: '/cookies',
    title: 'Cookies and storage notice',
    description: 'First-party browser storage and provider-managed authentication state.',
    reviewed: false,
    sections: [
      {
        heading: 'First-party browser storage',
        paragraphs: [
          'Ayatrisya stores workspace records and attachments in IndexedDB; guest-mode and guest-image-quota flags in localStorage; and a sidebar display preference in a first-party cookie. These mechanisms support core product behavior and interface preferences.',
          'Firebase Authentication uses its SDK-managed browser persistence for signed-in sessions. Exact persistence can vary by browser and Firebase SDK behavior. Provider sign-in and OAuth redirects may involve provider-controlled storage and network requests.',
        ],
      },
      {
        heading: 'Analytics and controls',
        paragraphs: [
          'No analytics or advertising tracker was found in the inspected Ayatrisya client source and package dependencies. This statement should be rechecked against the production deployment, tag manager, CDN, and any injected scripts before publication.',
          'To remove local workspace records, use Settings → Storage and backup. Clearing browser/site storage also removes locally stored Ayatrisya data and may sign the user out. The app does not currently provide in-app account deletion.',
        ],
      },
    ],
  },
];
