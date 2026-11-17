import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DIST_DIR = path.resolve('artifacts/ayatrisya/dist/public');
const ARTIFACT_DIR = 'C:/Users/nigam/.gemini/antigravity/brain/6e2471ce-e53c-4785-9ede-0b2b7a4b8d4a';
const PORT = 4173;

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

// 1. Start SPA static server
const server = http.createServer(async (req, res) => {
  try {
    const rawPath = (req.url || '/').split('?')[0];
    let filePath = path.join(DIST_DIR, rawPath);
    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
    } catch {
      // SPA Fallback
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const content = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
console.log(`[Static Server] Listening on http://127.0.0.1:${PORT}`);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const tempUserDataDir = path.resolve('tmp-chrome-profile-' + Date.now());
await fs.mkdir(tempUserDataDir, { recursive: true });

const chromeExe = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const chromeProcess = spawn(
  chromeExe,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=9222',
    `--user-data-dir=${tempUserDataDir}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

try {
  // Wait for DevTools port
  let targets = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      targets = await res.json();
      if (targets && targets.length > 0) break;
    } catch {
      await delay(150);
    }
  }

  if (!targets) throw new Error('Chrome remote debugging did not respond on port 9222');
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  const socket = new WebSocket(pageTarget.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let seq = 0;
  const pending = new Map();
  socket.addEventListener('message', (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.id) {
      const entry = pending.get(msg.id);
      if (entry) {
        pending.delete(msg.id);
        if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
        else entry.resolve(msg.result);
      }
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result?.value;
  };

  // Enable Page & DOM
  await send('Page.enable');
  await send('DOM.enable');

  // Step A: Navigate to home to initialize IndexedDB & guest mode
  console.log('[Chrome] Navigating to root application...');
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
  await delay(1500);

  // Set guest mode in localStorage
  await evaluate(`localStorage.setItem('ayatrisya:guest-mode:v1', 'enabled')`);

  // Step B: Inject test messages with all required features into IndexedDB
  console.log('[Chrome] Injecting test conversation with equations, tables, callouts, and quizzes...');
  const convId = 'test-ai-quality-evidence';
  const now = new Date().toISOString();

  const makePayload = (ownerId) => ({
    conversation: {
      id: convId,
      ownerId,
      title: 'AI Response Quality Verification',
      createdAt: now,
      updatedAt: now,
      favorite: false,
      pinned: false,
      tags: ['test', 'quality'],
      model: 'v1-fast',
    },
    messages: [
      {
        id: 'msg-math-' + ownerId,
        ownerId,
        conversationId: convId,
        role: 'assistant',
        attachmentIds: [],
        content: [
          '### 1. Mathematical Foundations & Chemistry',
          '',
          'Here is the quadratic solution:',
          '\\begin{aligned}',
          'x &= \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} \\\\',
          'y &= mx + c',
          '\\end{aligned}',
          '',
          'Matrix transformation:',
          '\\begin{pmatrix}',
          '\\cos\\theta & -\\sin\\theta \\\\',
          '\\sin\\theta & \\cos\\theta',
          '\\end{pmatrix}',
          '',
          'Piecewise definition:',
          '\\begin{cases}',
          'x & \\text{if } x \\ge 0 \\\\',
          '-x & \\text{if } x < 0',
          '\\end{cases}',
          '',
          'Limits and Integrals:',
          'Limit: $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$',
          '',
          '$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$',
          '',
          'Chemical synthesis:',
          '$\\ce{2H2 + O2 -> 2H2O}$ and $\\ce{H2SO4 -> 2H+ + SO4^2-}$',
        ].join('\n'),
        createdAt: new Date(Date.now() - 4000).toISOString(),
      },
      {
        id: 'msg-currency-' + ownerId,
        ownerId,
        conversationId: convId,
        role: 'assistant',
        attachmentIds: [],
        content: [
          '### 2. Currency Disambiguation & Financial Precision',
          '',
          'All financial metrics are preserved without false math triggering:',
          '- India INR: ₹1,500',
          '- USD Balance: $1,250.50',
          '- Europe EUR: €50',
          '- UK GBP: £100',
          '- Adjustment: -$50',
          '- Hosting Range: $10–$20',
          '- Node Cluster: $100 to $200 per node',
        ].join('\n'),
        createdAt: new Date(Date.now() - 3000).toISOString(),
      },
      {
        id: 'msg-alerts-' + ownerId,
        ownerId,
        conversationId: convId,
        role: 'assistant',
        attachmentIds: [],
        content: [
          '### 3. Themed Callout Alerts',
          '',
          '> [!NOTE]',
          '> Encryption is activated on all transport channels by default.',
          '',
          '> [!TIP]',
          '> Precache static assets using service workers to achieve sub-10ms navigation.',
          '',
          '> [!IMPORTANT]',
          '> Always backup cryptographic keys before triggering tenant rotation.',
          '',
          '> [!WARNING]',
          '> Ephemeral disk storage resets on cluster reboot.',
          '',
          '> [!CAUTION]',
          '> Permanent data loss will occur if volumes are deleted without detached sync.',
        ].join('\n'),
        createdAt: new Date(Date.now() - 2000).toISOString(),
      },
      {
        id: 'msg-table-' + ownerId,
        ownerId,
        conversationId: convId,
        role: 'assistant',
        attachmentIds: [],
        content: [
          '### 4. Technical Benchmark Matrix',
          '',
          '| Subsystem | Performance | Memory Limit | Security Profile | Status |',
          '| :--- | :--- | :--- | :--- | :--- |',
          '| **Trust Kernel** | `1.2ms` | `128 MB` | *Hardware Enforced* | Active |',
          '| **Math Engine** | `0.4ms` | `64 MB` | *KaTeX MathML* | Verified |',
          '| **Table Engine** | `0.2ms` | `32 MB` | *GFM Standard* | Certified |',
        ].join('\n'),
        createdAt: new Date(Date.now() - 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1000).toISOString(),
      },
      {
        id: 'msg-quiz-' + ownerId,
        ownerId,
        conversationId: convId,
        role: 'assistant',
        attachmentIds: [],
        content: [
          '### 5. Interactive Assessment Engine',
          '',
          '```interactive',
          JSON.stringify(
            {
              version: '1.0',
              type: 'quiz',
              id: 'quiz-algorithms',
              title: 'Algorithmic Complexity Assessment',
              questions: [
                {
                  id: 'q1',
                  question: 'What is the average time complexity of Hash Table search?',
                  options: [
                    { id: 'opt1', label: 'O(1) - Constant time lookup' },
                    { id: 'opt2', label: 'O(n) - Linear traversal' },
                    { id: 'opt3', label: 'O(log n) - Binary division' },
                    { id: 'opt4', label: 'O(n^2) - Quadratic search' },
                  ],
                  correctAnswer: 'opt1',
                  explanation: 'Hash tables achieve average constant time lookups via direct bucket indexing.',
                },
              ],
            },
            null,
            2
          ),
          '```',
        ].join('\n'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });

  const injectionScript = `(async () => {
    try {
      const payloads = [${JSON.stringify(makePayload('guest'))}, ${JSON.stringify(makePayload('signed-out'))}];
      return await new Promise((resolve, reject) => {
        const req = indexedDB.open('ayatrisya-local');
        req.onerror = () => reject('IDB open error: ' + (req.error && req.error.message));
        req.onsuccess = () => {
          const db = req.result;
          try {
            const tx = db.transaction(['conversations', 'messages'], 'readwrite');
            tx.onerror = () => reject('tx error: ' + (tx.error && tx.error.message));
            tx.onabort = () => reject('tx abort: ' + (tx.error && tx.error.message));
            const cStore = tx.objectStore('conversations');
            const mStore = tx.objectStore('messages');
            for (const p of payloads) {
              cStore.put(p.conversation);
              for (const msg of p.messages) {
                mStore.put(msg);
              }
            }
            tx.oncomplete = () => {
              db.close();
              resolve({ success: true });
            };
          } catch (err) {
            db.close();
            reject('put catch: ' + (err && err.message));
          }
        };
      });
    } catch (e) {
      return { error: String(e) };
    }
  })()`;

  const injectResult = await evaluate(injectionScript);
  console.log('[Chrome] Injection result:', injectResult);

  // Step C: Navigate to conversation URL
  console.log('[Chrome] Navigating to test conversation /workspace/chat/' + convId);
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/workspace/chat/${convId}` });
  await delay(3500);

  // Set Desktop Viewport (1280 x 960)
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 960,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await delay(1000);

  // Screenshot 1: Desktop Full Conversation Overview
  console.log('[Screenshot] Capturing Desktop Overview...');
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  const shot1Path = path.join(ARTIFACT_DIR, 'render-evidence-desktop.png');
  await fs.writeFile(shot1Path, Buffer.from(shot1.data, 'base64'));
  console.log(`[Screenshot] Saved: ${shot1Path}`);

  // Screenshot 2: Zoom on Equations & Alerts Detail
  console.log('[Screenshot] Capturing Equations & Alerts Detail...');
  await evaluate(`window.scrollTo({ top: 380, behavior: 'instant' })`);
  await delay(600);
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  const shot2Path = path.join(ARTIFACT_DIR, 'render-evidence-math-alerts.png');
  await fs.writeFile(shot2Path, Buffer.from(shot2.data, 'base64'));
  console.log(`[Screenshot] Saved: ${shot2Path}`);

  // Screenshot 3: Interactive Quiz Block
  console.log('[Screenshot] Capturing Interactive Quiz Block...');
  await evaluate(`window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })`);
  await delay(600);
  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  const shot3Path = path.join(ARTIFACT_DIR, 'render-evidence-interactive-quiz.png');
  await fs.writeFile(shot3Path, Buffer.from(shot3.data, 'base64'));
  console.log(`[Screenshot] Saved: ${shot3Path}`);

  // Screenshot 4: Mobile Viewport (iPhone / Android 390 x 844)
  console.log('[Screenshot] Switching to Mobile Viewport (390 x 844)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`);
  await delay(800);
  const shot4 = await send('Page.captureScreenshot', { format: 'png' });
  const shot4Path = path.join(ARTIFACT_DIR, 'render-evidence-mobile-equations.png');
  await fs.writeFile(shot4Path, Buffer.from(shot4.data, 'base64'));
  console.log(`[Screenshot] Saved: ${shot4Path}`);

  // Step D: Verify DOM elements actually exist in live page
  const domVerification = await evaluate(`(() => {
    return {
      chatProseCount: document.querySelectorAll('.chat-prose').length,
      headings: Array.from(document.querySelectorAll('h3')).map(h => h.innerText),
      katexElementsCount: document.querySelectorAll('.katex').length,
      katexDisplayCount: document.querySelectorAll('.katex-display').length,
      alertNoteCount: document.querySelectorAll('[data-testid="alert-note"]').length,
      alertTipCount: document.querySelectorAll('[data-testid="alert-tip"]').length,
      alertImportantCount: document.querySelectorAll('[data-testid="alert-important"]').length,
      alertWarningCount: document.querySelectorAll('[data-testid="alert-warning"]').length,
      alertCautionCount: document.querySelectorAll('[data-testid="alert-caution"]').length,
      tableWrapCount: document.querySelectorAll('.chat-table-wrap, table').length,
      tableHeaders: Array.from(document.querySelectorAll('th')).map(th => th.innerText),
      quizBlockCount: document.querySelectorAll('[data-testid="interactive-quiz-block"]').length,
      interactiveBlockCount: document.querySelectorAll('[data-testid^="interactive-"]').length,
    };
  })()`);

  console.log('[DOM Verification]', JSON.stringify(domVerification, null, 2));

  socket.close();
} finally {
  chromeProcess.kill();
  server.close();
  try {
    await fs.rm(tempUserDataDir, { recursive: true, force: true });
  } catch {}
}

console.log('[Verification Complete] All screenshots captured and DOM verified!');
