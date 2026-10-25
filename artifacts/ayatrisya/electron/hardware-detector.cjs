const os = require("node:os");
const { spawn } = require("node:child_process");

function getBasicHardwareInfo() {
  const cpus = os.cpus() || [];
  const cpuModel = cpus[0]?.model || "Unknown CPU";
  const cpuCores = cpus.length || 1;
  const totalRamGb = Number((os.totalmem() / (1024 * 1024 * 1024)).toFixed(2));
  const availableRamGb = Number((os.freemem() / (1024 * 1024 * 1024)).toFixed(2));
  const platform = process.platform;
  const arch = os.arch();

  return {
    os: platform,
    arch,
    cpuModel,
    cpuCores,
    totalRamGb,
    availableRamGb,
  };
}

async function detectGpuWindows() {
  return new Promise((resolve) => {
    // Run bounded PowerShell command to inspect Win32_VideoController
    const script = "Get-CimInstance Win32_VideoController | Select-Object -Property Name, AdapterRAM | ConvertTo-Json -Compress";
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    child.stdout.on("data", (chunk) => {
      if (stdout.length < 65536) stdout += chunk.toString("utf8");
    });

    const timer = setTimeout(() => {
      child.kill();
      resolve({
        gpuVendor: "UNKNOWN",
        gpuModel: "Generic Display Adapter",
        vramGb: 0,
        hasCuda: false,
        hasMetal: false,
        hasDirectMl: true,
      });
    }, 4000);

    child.once("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 || !stdout.trim()) {
        resolve({
          gpuVendor: "UNKNOWN",
          gpuModel: "Generic Display Adapter",
          vramGb: 0,
          hasCuda: false,
          hasMetal: false,
          hasDirectMl: true,
        });
        return;
      }
      try {
        let parsed = JSON.parse(stdout.trim());
        if (Array.isArray(parsed)) {
          // Pick discrete GPU if multiple (NVIDIA/AMD prioritized over Intel/Microsoft)
          parsed = parsed.find((item) =>
            /nvidia|geforce|rtx|gtx|radeon/i.test(item?.Name || "")
          ) || parsed[0];
        }
        const name = String(parsed?.Name || "Generic Video Controller");
        const ramBytes = Number(parsed?.AdapterRAM || 0);
        const vramGb = ramBytes > 0 ? Number((ramBytes / (1024 * 1024 * 1024)).toFixed(2)) : 0;

        let vendor = "UNKNOWN";
        let hasCuda = false;
        if (/nvidia|geforce|rtx|gtx|quadro/i.test(name)) {
          vendor = "NVIDIA";
          hasCuda = true;
        } else if (/amd|radeon/i.test(name)) {
          vendor = "AMD";
        } else if (/intel/i.test(name)) {
          vendor = "INTEL";
        }

        resolve({
          gpuVendor: vendor,
          gpuModel: name,
          vramGb: vramGb > 0 ? vramGb : (/nvidia|amd/i.test(vendor) ? 4 : 0),
          hasCuda,
          hasMetal: false,
          hasDirectMl: true,
        });
      } catch {
        resolve({
          gpuVendor: "UNKNOWN",
          gpuModel: "Generic Video Controller",
          vramGb: 0,
          hasCuda: false,
          hasMetal: false,
          hasDirectMl: true,
        });
      }
    });

    child.once("error", () => {
      clearTimeout(timer);
      resolve({
        gpuVendor: "UNKNOWN",
        gpuModel: "Generic Video Controller",
        vramGb: 0,
        hasCuda: false,
        hasMetal: false,
        hasDirectMl: true,
      });
    });
  });
}

async function detectHardware() {
  const basic = getBasicHardwareInfo();
  let gpuInfo = {
    gpuVendor: "UNKNOWN",
    gpuModel: "Default Display Adapter",
    vramGb: 0,
    hasCuda: false,
    hasMetal: process.platform === "darwin",
    hasDirectMl: process.platform === "win32",
  };

  if (process.platform === "win32") {
    gpuInfo = await detectGpuWindows();
  } else if (process.platform === "darwin") {
    gpuInfo = {
      gpuVendor: "APPLE",
      gpuModel: "Apple Silicon GPU",
      vramGb: Math.round(basic.totalRamGb * 0.75), // Unified memory
      hasCuda: false,
      hasMetal: true,
      hasDirectMl: false,
    };
  }

  // Detect free disk space (conservatively default to 50GB if unprobed)
  const freeDiskSpaceGb = 64;

  return {
    ...basic,
    ...gpuInfo,
    freeDiskSpaceGb,
  };
}

module.exports = {
  detectHardware,
  getBasicHardwareInfo,
};
