const path = require("node:path");

function validateProjectId(value) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new Error("Choose a valid local project folder.");
  }
  return value;
}

function cleanRelativePath(value, allowRoot = false) {
  if (typeof value !== "string" || value.length > 2048 || value.includes("\0")) {
    throw new Error("The selected file path is invalid.");
  }
  if (value === "" && allowRoot) return "";

  const normalized = value.replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    /^[a-z]:/i.test(normalized) ||
    normalized.split("/").some((part) => part === ".." || part === ".")
  ) {
    throw new Error("File access must stay inside the selected project folder.");
  }
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length) throw new Error("Choose a file inside the project folder.");
  return parts.join(path.sep);
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function resolveExistingPath(fs, root, relativePath, expectedKind = "file") {
  const clean = cleanRelativePath(relativePath, true);
  const rootPath = path.resolve(root);
  const rootInfo = await fs.lstat(rootPath);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
    throw new Error("The selected project folder is unavailable or has been replaced.");
  }
  const rootReal = await fs.realpath(rootPath);
  const candidate = path.resolve(rootReal, clean || ".");
  if (!isWithin(rootReal, candidate)) throw new Error("File access must stay inside the selected project folder.");
  const realPath = await fs.realpath(candidate);
  if (!isWithin(rootReal, realPath)) throw new Error("Symbolic links cannot access files outside the selected project folder.");

  const stat = await fs.stat(realPath);
  if (expectedKind === "file" && !stat.isFile()) throw new Error("Choose a file.");
  if (expectedKind === "directory" && !stat.isDirectory()) throw new Error("Choose a folder.");
  return { root: rootReal, path: realPath, stat };
}

async function resolveWritableFile(fs, root, relativePath) {
  const clean = cleanRelativePath(relativePath);
  const rootPath = path.resolve(root);
  const rootInfo = await fs.lstat(rootPath);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
    throw new Error("The selected project folder is unavailable or has been replaced.");
  }
  const rootReal = await fs.realpath(rootPath);
  const candidate = path.resolve(rootReal, clean);
  if (!isWithin(rootReal, candidate)) throw new Error("File access must stay inside the selected project folder.");

  const parent = path.dirname(candidate);
  const realParent = await fs.realpath(parent);
  if (!isWithin(rootReal, realParent)) throw new Error("File access must stay inside the selected project folder.");
  const target = path.join(realParent, path.basename(candidate));
  try {
    const realTarget = await fs.realpath(target);
    if (!isWithin(rootReal, realTarget)) throw new Error("Symbolic links cannot write outside the selected project folder.");
    if (!(await fs.stat(realTarget)).isFile()) throw new Error("Choose a regular file.");
    return realTarget;
  } catch (error) {
    if (error && error.code === "ENOENT") return target;
    throw error;
  }
}

function validateCommand(value) {
  if (typeof value !== "string" || value.length > 2000 || /[\0\r\n]/.test(value) || !value.trim()) {
    throw new Error("Enter one command line of up to 2,000 characters.");
  }
  return value.trim();
}

module.exports = {
  cleanRelativePath,
  isWithin,
  resolveExistingPath,
  resolveWritableFile,
  validateCommand,
  validateProjectId,
};
