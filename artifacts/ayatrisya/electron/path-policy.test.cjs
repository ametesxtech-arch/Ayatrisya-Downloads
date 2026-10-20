const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  cleanRelativePath,
  isWithin,
  resolveExistingPath,
  resolveWritableFile,
  validateCommand,
  validateProjectId,
} = require("./path-policy.cjs");

test("rejects absolute paths, traversal, and malformed identifiers", () => {
  for (const value of ["../outside", "src/../../outside", "/etc/passwd", "C:\\Windows\\win.ini"]) {
    assert.throws(() => cleanRelativePath(value));
  }
  assert.equal(cleanRelativePath("", true), "");
  assert.equal(cleanRelativePath("src\\main.ts"), path.join("src", "main.ts"));
  assert.throws(() => validateProjectId("../outside"));
  assert.equal(validateProjectId("123e4567-e89b-12d3-a456-426614174000"), "123e4567-e89b-12d3-a456-426614174000");
});

test("keeps resolved paths inside the selected project, including symbolic links", async (t) => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "ayatrisya-access-"));
  const root = path.join(temp, "project");
  const outside = path.join(temp, "outside");
  await fs.mkdir(root);
  await fs.mkdir(outside);
  await fs.writeFile(path.join(root, "readme.md"), "hello");
  const rootLink = path.join(temp, "project-link");
  await fs.writeFile(path.join(outside, "secret.txt"), "not for this project");
  try {
    await fs.symlink(outside, path.join(root, "external"), "dir");
    await fs.symlink(outside, rootLink, "dir");
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") {
      t.diagnostic("Symlink creation is not permitted in this environment.");
    } else {
      throw error;
    }
  }

  const found = await resolveExistingPath(fs, root, "readme.md");
  assert.equal(await fs.readFile(found.path, "utf8"), "hello");
  await assert.rejects(resolveExistingPath(fs, root, "../outside/secret.txt"));
  await assert.rejects(resolveWritableFile(fs, root, "../outside/secret.txt"));
  if (await fs.lstat(rootLink).then((stat) => stat.isSymbolicLink(), () => false)) {
    await assert.rejects(resolveExistingPath(fs, rootLink, "secret.txt"), /replaced/);
    await assert.rejects(resolveWritableFile(fs, rootLink, "new.txt"), /replaced/);
  }

  try {
    await fs.realpath(path.join(root, "external"));
    await assert.rejects(resolveExistingPath(fs, root, "external/secret.txt"), /Symbolic links/);
    await assert.rejects(resolveWritableFile(fs, root, "external/new.txt"), /inside the selected project folder/);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  assert.equal(isWithin(root, path.join(root, "readme.md")), true);
  assert.equal(isWithin(root, outside), false);
  await fs.rm(temp, { recursive: true, force: true });
});

test("only accepts a single bounded command line", () => {
  assert.equal(validateCommand("pnpm test"), "pnpm test");
  assert.throws(() => validateCommand(""));
  assert.throws(() => validateCommand("echo one\nrm -rf ."));
  assert.throws(() => validateCommand("x".repeat(2001)));
});
