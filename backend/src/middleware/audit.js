import { appendFile, mkdir, readFile } from "node:fs/promises";

// ponytail: JSONL files on local disk. Cloud Run disks are ephemeral, so move
// these to Firestore/Postgres before deploying.
const DATA_DIR = new URL("../../data/", import.meta.url);
const FILES = {
  audit: new URL("audit.jsonl", DATA_DIR),
  tests: new URL("tests.jsonl", DATA_DIR),
};

await mkdir(DATA_DIR, { recursive: true });

async function append(kind, entry) {
  const record = { timestamp: new Date().toISOString(), ...entry };
  await appendFile(FILES[kind], JSON.stringify(record) + "\n");
  return record;
}

export async function readLog(kind, bucket) {
  let text = "";
  try {
    text = await readFile(FILES[kind], "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((r) => !bucket || r.bucket === bucket)
    .reverse();
}

export const logChange = (req, entry) =>
  append("audit", { user: req.user.email, ...entry });

export const recordTest = (req, entry) =>
  append("tests", { user: req.user.email, ...entry });
