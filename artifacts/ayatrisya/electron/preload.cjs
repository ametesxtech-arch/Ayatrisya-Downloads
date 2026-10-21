const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "ayatrisyaDesktop",
  Object.freeze({
    isDesktop: true,
    listProjects: () => ipcRenderer.invoke("desktop:projects:list"),
    chooseProjectFolder: () => ipcRenderer.invoke("desktop:projects:choose"),
    removeProjectFolder: (projectId) => ipcRenderer.invoke("desktop:projects:remove", projectId),
    listFiles: (projectId, relativePath) =>
      ipcRenderer.invoke("desktop:files:list", projectId, relativePath),
    readFile: (projectId, relativePath) =>
      ipcRenderer.invoke("desktop:files:read", projectId, relativePath),
    createFile: (projectId, relativePath) =>
      ipcRenderer.invoke("desktop:files:create", projectId, relativePath),
    createFileWithContent: (projectId, relativePath, content) =>
      ipcRenderer.invoke("desktop:files:create-with-content", projectId, relativePath, content),
    writeFile: (projectId, relativePath, content) =>
      ipcRenderer.invoke("desktop:files:write", projectId, relativePath, content),
    runCommand: (projectId, command) =>
      ipcRenderer.invoke("desktop:terminal:run", projectId, command),
    getLocalModelEndpoint: () => ipcRenderer.invoke("desktop:model-endpoint:get"),
    setLocalModelEndpoint: (endpoint) => ipcRenderer.invoke("desktop:model-endpoint:set", endpoint),
    requestLocalModel: (path, method, body, requestId) =>
      ipcRenderer.invoke("desktop:model-endpoint:request", path, method, body, requestId),
    cancelLocalModelRequest: (requestId) =>
      ipcRenderer.invoke("desktop:model-endpoint:cancel", requestId),
    getWarModeStatus: () => ipcRenderer.invoke("desktop:war-mode:status"),
    chooseWarModeFolder: () => ipcRenderer.invoke("desktop:war-mode:choose-folder"),
    scanWarModeFolder: (folderId) => ipcRenderer.invoke("desktop:war-mode:scan-folder", folderId),
    getWarModeAuditLog: () => ipcRenderer.invoke("desktop:war-mode:audit-log"),
    openWindowsSecurity: () => ipcRenderer.invoke("desktop:war-mode:open-windows-security"),
  }),
);
