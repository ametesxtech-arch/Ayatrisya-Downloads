const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  cleanRelativePath,
  isWithin,
  resolveExistingPath,
  resolveWritableFile,
  validateCommand,
  validateProjectId,
} = require("./path-policy.cjs");
const {
  validateLocalModelEndpoint,
  validateLocalModelRequest,
} = require("./model-endpoint-policy.cjs");

const MAX_TEXT_FILE_BYTES = 1024 * 1024;
const MAX_TERMINAL_OUTPUT_BYTES = 128 * 1024;
const TERMINAL_TIMEOUT_MS = 60_000;
const GRANTS_FILE = "authorized-project-folders.json";
const SERVER_FILE = "desktop-server.json";
const LOCAL_MODEL_FILE = "local-model-endpoint.json";
const LOCAL_MODEL_TIMEOUT_MS = 120_000;
const LOCAL_MODEL_RESPONSE_BYTES = 2 * 1024 * 1024;
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "frame-src https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https:",
].join("; ");

let mainWindow = null;
let uiOrigin = null;
let staticServer = null;
let projectGrants = [];
const localModelRequests = new Map();

app.setName("Ayatrisya");
app.enableSandbox();

function safeError(error) {
  const code = error && typeof error === "object" ? error.code : null;
  if (code === "ENOENT") return "That file or folder is no longer available.";
  if (code === "EACCES" || code === "EPERM") return "Ayatrisya does not have permission to access that item.";
  if (error instanceof Error && error.message && error.message.length < 300) return error.message;
  return "The desktop operation could not be completed. Check the folder permissions and try again.";
}

function trustedFirebaseHost(hostname) {
  const host = hostname.toLowerCase();
  return host === "firebaseapp.com" || host.endsWith(".firebaseapp.com") ||
    host === "web.app" || host.endsWith(".web.app");
}

function trustedProviderHost(hostname) {
  const host = hostname.toLowerCase();
  return host === "github.com" || host.endsWith(".github.com") ||
    host === "google.com" || host.endsWith(".google.com") ||
    host === "gstatic.com" || host.endsWith(".gstatic.com") ||
    host === "googleusercontent.com" || host.endsWith(".googleusercontent.com");
}

function isAuthStart(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    if (trustedFirebaseHost(url.hostname) && url.pathname === "/__/auth/handler") return true;
    return url.hostname.toLowerCase() === "accounts.google.com" &&
      /^\/o\/oauth2\/(v2\/auth|auth)$/.test(url.pathname);
  } catch {
    return false;
  }
}

function isAuthNavigation(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && (trustedFirebaseHost(url.hostname) || trustedProviderHost(url.hostname));
  } catch {
    return false;
  }
}

function isTrustedUiUrl(rawUrl) {
  try {
    return uiOrigin !== null && new URL(rawUrl).origin === uiOrigin;
  } catch {
    return false;
  }
}

function configureWebContents(contents) {
  contents.on("will-navigate", (event, rawUrl) => {
    const trusted = contents === mainWindow?.webContents
      ? isTrustedUiUrl(rawUrl)
      : isAuthNavigation(rawUrl);
    if (!trusted) event.preventDefault();
  });
  contents.on("will-redirect", (event, rawUrl) => {
    const trusted = contents === mainWindow?.webContents
      ? isTrustedUiUrl(rawUrl)
      : isAuthNavigation(rawUrl);
    if (!trusted) event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    const isMainApp = contents === mainWindow?.webContents;
    if (isMainApp && isAuthStart(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          parent: mainWindow ?? undefined,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            webviewTag: false,
          },
        },
      };
    }
    if (isMainApp && /^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
}

app.on("web-contents-created", (_event, contents) => configureWebContents(contents));

async function loadGrants() {
  const file = path.join(app.getPath("userData"), GRANTS_FILE);
  let value;
  try {
    value = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      projectGrants = [];
      return;
    }
    throw new Error("The saved local folder permissions could not be read. Ayatrisya did not change them.");
  }
  if (!Array.isArray(value) || value.some((item) =>
    !item || !/^[0-9a-f-]{36}$/i.test(item.id) ||
    typeof item.path !== "string" || !path.isAbsolute(item.path) ||
    typeof item.name !== "string"
  )) {
    throw new Error("The saved local folder permissions are invalid. Ayatrisya did not change them.");
  }
  projectGrants = value;
}

async function persistGrants() {
  const directory = app.getPath("userData");
  const file = path.join(directory, GRANTS_FILE);
  const temp = `${file}.tmp`;
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(temp, JSON.stringify(projectGrants, null, 2), { mode: 0o600 });
  await fs.rename(temp, file);
}

async function getSavedServerPort() {
  const file = path.join(app.getPath("userData"), SERVER_FILE);
  try {
    const value = JSON.parse(await fs.readFile(file, "utf8"));
    if (!Number.isInteger(value.port) || value.port < 1024 || value.port > 65535) {
      throw new Error("The saved local app port is invalid. Ayatrisya did not change it.");
    }
    return value.port;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    if (error.message === "The saved local app port is invalid. Ayatrisya did not change it.") throw error;
    throw new Error("The saved local app address could not be read. Ayatrisya did not change it.");
  }
}

async function saveServerPort(port) {
  const directory = app.getPath("userData");
  const file = path.join(directory, SERVER_FILE);
  const temp = `${file}.tmp`;
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(temp, JSON.stringify({ port }), { mode: 0o600 });
  await fs.rename(temp, file);
}

async function getLocalModelEndpoint() {
  const file = path.join(app.getPath("userData"), LOCAL_MODEL_FILE);
  try {
    const value = JSON.parse(await fs.readFile(file, "utf8"));
    return validateLocalModelEndpoint(value.endpoint);
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw new Error("The saved local model endpoint is invalid. Update it in Ayatrisya Settings.");
  }
}

async function setLocalModelEndpoint(raw) {
  if (typeof raw !== "string") throw new Error("Enter a local model URL.");
  const file = path.join(app.getPath("userData"), LOCAL_MODEL_FILE);
  if (!raw.trim()) {
    await fs.rm(file, { force: true });
    return "";
  }
  const endpoint = validateLocalModelEndpoint(raw);
  const directory = app.getPath("userData");
  const temp = `${file}.tmp`;
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(temp, JSON.stringify({ endpoint }), { mode: 0o600 });
  await fs.rename(temp, file);
  return endpoint;
}

async function readLocalModelJson(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!/(?:application|text)\/[^;]*json/i.test(contentType)) {
    throw new Error("The local model adapter must return JSON.");
  }
  if (!response.body) throw new Error("The local model adapter returned an empty response.");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > LOCAL_MODEL_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("The local model response is larger than 2 MB.");
    }
    chunks.push(Buffer.from(value));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("The local model adapter returned invalid JSON.");
  }
}

async function requestLocalModel(requestPath, method, body, requestId) {
  if (typeof requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    throw new Error("The local model request is invalid.");
  }
  if (localModelRequests.has(requestId)) throw new Error("The local model request is already running.");
  const request = validateLocalModelRequest(requestPath, method, body);
  const endpoint = await getLocalModelEndpoint();
  if (!endpoint) throw new Error("Set a desktop local model endpoint in Settings first.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOCAL_MODEL_TIMEOUT_MS);
  localModelRequests.set(requestId, controller);
  try {
    const response = await fetch(`${endpoint}${request.path}`, {
      method: request.method,
      headers: {
        Accept: "application/json",
        ...(request.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) {
      throw new Error(response.status === 503
        ? "The local model is unavailable. Retry when it is ready."
        : `The local model request failed (${response.status}).`);
    }
    const responseBody = await readLocalModelJson(response);
    return {
      status: response.status,
      contentType: "application/json",
      body: responseBody,
    };
  } finally {
    clearTimeout(timer);
    localModelRequests.delete(requestId);
  }
}

function cancelLocalModelRequest(requestId) {
  if (typeof requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    throw new Error("The local model request is invalid.");
  }
  localModelRequests.get(requestId)?.abort();
}

async function listProjects() {
  return Promise.all(projectGrants.map(async (project) => {
    let available = false;
    try {
      const stat = await fs.lstat(project.path);
      available = stat.isDirectory() && !stat.isSymbolicLink();
    } catch {
      available = false;
    }
    return { id: project.id, name: project.name, path: project.path, available };
  }));
}

function requireProject(projectId) {
  const id = validateProjectId(projectId);
  const project = projectGrants.find((item) => item.id === id);
  if (!project) throw new Error("This folder has not been granted to Ayatrisya. Choose it again to restore access.");
  return project;
}

function assertTrustedIpc(event) {
  if (
    !mainWindow ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== event.sender.mainFrame ||
    !isTrustedUiUrl(event.senderFrame.url)
  ) {
    throw new Error("This desktop request did not come from the Ayatrisya window.");
  }
}

function registerIpc(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    assertTrustedIpc(event);
    try {
      return await handler(...args);
    } catch (error) {
      throw new Error(safeError(error));
    }
  });
}

registerIpc("desktop:model-endpoint:get", getLocalModelEndpoint);
registerIpc("desktop:model-endpoint:set", setLocalModelEndpoint);
registerIpc("desktop:model-endpoint:request", requestLocalModel);
registerIpc("desktop:model-endpoint:cancel", cancelLocalModelRequest);

registerIpc("desktop:projects:list", listProjects);
registerIpc("desktop:projects:choose", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a local project folder",
    properties: ["openDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const realPath = await fs.realpath(result.filePaths[0]);
  if (!(await fs.stat(realPath)).isDirectory()) throw new Error("Choose a folder.");
  const existing = projectGrants.find((item) => item.path === realPath);
  if (existing) return { id: existing.id, name: existing.name, path: existing.path, available: true };

  const project = { id: randomUUID(), name: path.basename(realPath) || realPath, path: realPath };
  projectGrants = [...projectGrants, project];
  await persistGrants();
  return { ...project, available: true };
});
registerIpc("desktop:projects:remove", async (projectId) => {
  const id = validateProjectId(projectId);
  if (!projectGrants.some((item) => item.id === id)) throw new Error("Local project folder not found.");
  projectGrants = projectGrants.filter((item) => item.id !== id);
  await persistGrants();
});
registerIpc("desktop:files:list", async (projectId, relativePath) => {
  const project = requireProject(projectId);
  const clean = cleanRelativePath(relativePath, true);
  const folder = await resolveExistingPath(fs, project.path, clean, "directory");
  const entries = await fs.readdir(folder.path, { withFileTypes: true });
  if (entries.length > 2000) throw new Error("This folder has more than 2,000 entries. Open a narrower subfolder to browse it.");
  const visible = entries.filter((entry) => !entry.isSymbolicLink());
  return Promise.all(visible.map(async (entry) => {
    const relative = path.posix.join(clean.replaceAll("\\", "/"), entry.name);
    const isDirectory = entry.isDirectory();
    let size = 0;
    if (!isDirectory && entry.isFile()) {
      try {
        size = (await fs.stat(path.join(folder.path, entry.name))).size;
      } catch {
        size = 0;
      }
    }
    return { name: entry.name, relativePath: relative, isDirectory, size };
  })).then((items) => items.sort((a, b) =>
    Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name)));
});
registerIpc("desktop:files:read", async (projectId, relativePath) => {
  const project = requireProject(projectId);
  const file = await resolveExistingPath(fs, project.path, relativePath, "file");
  if (file.stat.size > MAX_TEXT_FILE_BYTES) throw new Error("Files over 1 MB cannot be opened in the built-in editor.");
  const content = await fs.readFile(file.path, "utf8");
  if (content.includes("\0")) throw new Error("This appears to be a binary file and cannot be opened as text.");
  return content;
});
registerIpc("desktop:files:create", async (projectId, relativePath) => {
  const project = requireProject(projectId);
  const target = await resolveWritableFile(fs, project.path, relativePath);
  const handle = await fs.open(target, "wx", 0o600);
  await handle.close();
});
registerIpc("desktop:files:write", async (projectId, relativePath, content) => {
  if (typeof content !== "string" || Buffer.byteLength(content, "utf8") > MAX_TEXT_FILE_BYTES) {
    throw new Error("Text files are limited to 1 MB in the built-in editor.");
  }
  const project = requireProject(projectId);
  const target = await resolveWritableFile(fs, project.path, relativePath);
  await fs.writeFile(target, content, { encoding: "utf8", mode: 0o600 });
});

function executeCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    const windows = process.platform === "win32";
    const executable = windows ? (process.env.ComSpec || "cmd.exe") : "/bin/sh";
    const args = windows ? ["/d", "/s", "/c", command] : ["-lc", command];
    const child = spawn(executable, args, {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let collectedBytes = 0;
    let timedOut = false;
    let outputLimited = false;
    let settled = false;
    const append = (target, chunk) => {
      const text = chunk.toString("utf8");
      const available = Math.max(0, MAX_TERMINAL_OUTPUT_BYTES - collectedBytes);
      const bytes = Buffer.from(text, "utf8");
      collectedBytes += bytes.length;
      const accepted = bytes.subarray(0, available).toString("utf8");
      if (target === "stdout") stdout += accepted;
      else stderr += accepted;
      if (bytes.length > available && !outputLimited) {
        outputLimited = true;
        stderr += "\n[Output limited to 128 KB.]";
        child.kill();
      }
    };
    child.stdout.on("data", (chunk) => append("stdout", chunk));
    child.stderr.on("data", (chunk) => append("stderr", chunk));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, TERMINAL_TIMEOUT_MS);
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ cancelled: false, code, stdout, stderr, timedOut });
    });
  });
}

registerIpc("desktop:terminal:run", async (projectId, rawCommand) => {
  const project = requireProject(projectId);
  const command = validateCommand(rawCommand);
  const stat = await fs.lstat(project.path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("The selected project folder is unavailable.");

  const confirmation = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Run a local command?",
    message: "Ayatrisya will run this command in the selected project folder.",
    detail: `Command:\n${command}\n\nWorking folder:\n${project.path}\n\nThis command runs with your operating-system account permissions. It may access or change files outside this folder. Review the command before approving.`,
    buttons: ["Cancel", "Run once"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (confirmation.response !== 1) {
    return { cancelled: true, code: null, stdout: "", stderr: "", timedOut: false };
  }
  return executeCommand(command, project.path);
});

function contentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function createStaticServer() {
  const root = path.resolve(app.getAppPath(), "dist", "public");
  const savedPort = await getSavedServerPort();
  const server = http.createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }

    try {
      const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
      let candidate = path.resolve(root, `.${pathname}`);
      if (!isWithin(root, candidate)) {
        response.writeHead(404).end();
        return;
      }
      let file = candidate;
      try {
        if (!(await fs.stat(candidate)).isFile()) throw new Error("Not a file");
      } catch {
        if (path.extname(pathname)) {
          response.writeHead(404).end();
          return;
        }
        file = path.join(root, "index.html");
      }
      const body = await fs.readFile(file);
      response.writeHead(200, {
        "Content-Type": contentType(file),
        "Content-Length": body.length,
        "Cache-Control": path.basename(file) === "index.html" ? "no-cache" : "public, max-age=31536000, immutable",
      });
      if (request.method === "HEAD") response.end();
      else response.end(body);
    } catch {
      response.writeHead(400).end("Bad request");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(savedPort ?? 0, "localhost", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start the local Ayatrisya server.");
  staticServer = server;
  if (savedPort === null) {
    try {
      await saveServerPort(address.port);
    } catch (error) {
      server.close();
      staticServer = null;
      throw error;
    }
  }
  return `http://localhost:${address.port}`;
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 960,
    minHeight: 660,
    show: false,
    backgroundColor: "#101116",
    title: "Ayatrisya",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    },
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => { mainWindow = null; });
  if (!app.isPackaged) {
    const devUrl = process.env.AYATRISYA_DESKTOP_DEV_URL;
    if (!devUrl || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(devUrl)) {
      throw new Error("Desktop development must use the local Vite server.");
    }
    uiOrigin = new URL(devUrl).origin;
    await mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }
  const localUrl = await createStaticServer();
  uiOrigin = new URL(localUrl).origin;
  await mainWindow.loadURL(localUrl);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(async () => {
    await loadGrants();
    await createMainWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
    });
  }).catch((error) => {
    dialog.showErrorBox("Ayatrisya could not start", safeError(error));
    app.quit();
  });
}

app.on("before-quit", () => {
  if (staticServer) staticServer.close();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
