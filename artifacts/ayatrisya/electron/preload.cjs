const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "ayatrisyaDesktop",
  Object.freeze({
    isDesktop: true,
    getRuntimeInfo: () => ipcRenderer.invoke("desktop:bridge:handshake"),
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
    runCommand: (projectId, command, commandId) =>
      ipcRenderer.invoke("desktop:terminal:run", projectId, command, commandId),
    cancelCommand: (commandId) => ipcRenderer.invoke("desktop:terminal:cancel", commandId),
    getLocalCompanionStatus: () => ipcRenderer.invoke("desktop:companion:status"),
    enableLocalCompanion: () => ipcRenderer.invoke("desktop:companion:enable"),
    disableLocalCompanion: () => ipcRenderer.invoke("desktop:companion:disable"),
    getLocalModelEndpoint: () => ipcRenderer.invoke("desktop:model-endpoint:get"),
    setLocalModelEndpoint: (endpoint) => ipcRenderer.invoke("desktop:model-endpoint:set", endpoint),
    requestLocalModel: (path, method, body, requestId) =>
      ipcRenderer.invoke("desktop:model-endpoint:request", path, method, body, requestId),
    cancelLocalModelRequest: (requestId) =>
      ipcRenderer.invoke("desktop:model-endpoint:cancel", requestId),
    getSeedModelHostStatus: () => ipcRenderer.invoke("desktop:seed-host:status"),
    chooseSeedModelCheckpoint: () => ipcRenderer.invoke("desktop:seed-host:choose-checkpoint"),
    setSeedModelHostAutoStart: (enabled) => ipcRenderer.invoke("desktop:seed-host:auto-start", enabled),
    startSeedModelHost: () => ipcRenderer.invoke("desktop:seed-host:start"),
    stopSeedModelHost: () => ipcRenderer.invoke("desktop:seed-host:stop"),
    generateSeedModelText: (prompt, requestId) =>
      ipcRenderer.invoke("desktop:seed-host:generate", prompt, requestId),
    cancelSeedModelText: (requestId) => ipcRenderer.invoke("desktop:seed-host:cancel", requestId),
    getWarModeStatus: () => ipcRenderer.invoke("desktop:war-mode:status"),
    chooseWarModeFolder: () => ipcRenderer.invoke("desktop:war-mode:choose-folder"),
    scanWarModeFolder: (folderId) => ipcRenderer.invoke("desktop:war-mode:scan-folder", folderId),
    getWarModeAuditLog: () => ipcRenderer.invoke("desktop:war-mode:audit-log"),
    openWindowsSecurity: () => ipcRenderer.invoke("desktop:war-mode:open-windows-security"),
    scanWarModeYaraFolder: (folderId) => ipcRenderer.invoke("desktop:war-mode:yara-scan-folder", folderId),
    cancelWarModeYaraScan: (scanId) => ipcRenderer.invoke("desktop:war-mode:yara-cancel-scan", scanId),
    quarantineWarModeFinding: (findingId) => ipcRenderer.invoke("desktop:war-mode:yara-quarantine", findingId),
    restoreWarModeQuarantine: (itemId) => ipcRenderer.invoke("desktop:war-mode:yara-restore", itemId),
    getWarModeQuarantine: () => ipcRenderer.invoke("desktop:war-mode:yara-quarantine-list"),
    getWarModeYaraAuditLog: () => ipcRenderer.invoke("desktop:war-mode:yara-audit-log"),
    prepareWarModeRuleUpdate: () => ipcRenderer.invoke("desktop:war-mode:yara-update-prepare"),
    applyWarModeRuleUpdate: (proposalId) => ipcRenderer.invoke("desktop:war-mode:yara-update-apply", proposalId),
    onWarModeYaraProgress: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, value) => {
        if (
          value &&
          typeof value.scanId === "string" &&
          Number.isInteger(value.completed) &&
          Number.isInteger(value.total) &&
          value.counts &&
          typeof value.currentPath === "string"
        ) callback(value);
      };
      ipcRenderer.on("desktop:war-mode:yara-progress", listener);
      return () => ipcRenderer.removeListener("desktop:war-mode:yara-progress", listener);
    },
    getAmetesxHardwareSpecs: () => ipcRenderer.invoke("desktop:ametesx:hardware"),
    getAmetesxProvisioningStatus: () => ipcRenderer.invoke("desktop:ametesx:provisioning-status"),
    startAmetesxProvisioning: (modelId) => ipcRenderer.invoke("desktop:ametesx:provision-start", modelId),
    cancelAmetesxProvisioning: () => ipcRenderer.invoke("desktop:ametesx:provision-cancel"),
    exportAmetesxProject: (request) => ipcRenderer.invoke("desktop:ametesx:export-project", request),
    startBrowserAuth: (mode) => ipcRenderer.invoke("desktop:auth:start", mode),
    cancelBrowserAuth: () => ipcRenderer.invoke("desktop:auth:cancel"),
    onAuthCallback: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, result) => {
        if (result && typeof result === "object") callback(result);
      };
      ipcRenderer.on("desktop:auth:callback", listener);
      return () => ipcRenderer.removeListener("desktop:auth:callback", listener);
    },
  }),
);

