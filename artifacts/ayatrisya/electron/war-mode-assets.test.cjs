const test = require("node:test");
const assert = require("node:assert/strict");
const { extractZipPaths, gitBlobSha, sha256 } = require("./war-mode-assets.cjs");

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function makeStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const [name, value] of entries) {
    const filename = Buffer.from(name, "utf8");
    const data = Buffer.from(value);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    localParts.push(local, filename, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, filename);
    localOffset += local.length + filename.length + data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

test("extracts only explicitly requested files and verifies ZIP checksums", () => {
  const zip = makeStoredZip([
    ["yr.exe", Buffer.from("scanner")],
    ["other.txt", Buffer.from("not selected")],
  ]);
  const files = extractZipPaths(zip, new Set(["yr.exe"]));
  assert.deepEqual([...files.keys()], ["yr.exe"]);
  assert.equal(files.get("yr.exe").toString("utf8"), "scanner");
});

test("rejects traversal paths even when they are not requested", () => {
  const zip = makeStoredZip([["rules/../../escape.yar", Buffer.from("unsafe")]]);
  assert.throws(() => extractZipPaths(zip, new Set(["safe.yar"])), /unsafe path/);
});

test("rejects duplicate case-insensitive paths for Windows extraction", () => {
  const zip = makeStoredZip([
    ["Rules/sample.yar", Buffer.from("one")],
    ["rules/SAMPLE.YAR", Buffer.from("two")],
  ]);
  assert.throws(() => extractZipPaths(zip, new Set(["Rules/sample.yar"])), /duplicate paths/);
});

test("Git blob and SHA-256 helpers produce stable digests", () => {
  const content = Buffer.from("rule test");
  assert.equal(gitBlobSha(content), "8454662da6bd9ba28d5dc482586a862afc662326");
  assert.equal(sha256(content), "31a43b63c659daf344684b983781e9af63a86f1c29553554eb2e8154148d0415");
});
