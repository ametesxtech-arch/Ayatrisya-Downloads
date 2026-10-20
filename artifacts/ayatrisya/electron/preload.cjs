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
    writeFile: (projectId, relativePath, content) =>
      ipcRenderer.invoke("desktop:files:write", projectId, relativePath, content),
    runCommand: (projectId, command) =>
      ipcRenderer.invoke("desktop:terminal:run", projectId, command),
  }),
);
