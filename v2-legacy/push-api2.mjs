/**
 * 用 GitHub API 推送（**不依赖本地 git 历史**的版本）
 * 用法： node tools/push-api2.mjs <repoDir> <messageFile>
 *
 * 为什么需要这一版：
 *   前一版 push-via-api.mjs 用 `git diff <远端SHA> HEAD` 算改动，
 *   前提是本地仓库**有那个 SHA 的对象**。但浅克隆 + 远端被我改过之后，
 *   那个对象可能拿不到（fatal: bad object / Could not read ...）。
 *
 * 这一版改成：**远端所有 tree 里的文件，与本地工作区逐个比**。
 *   不需要任何本地 git 历史，只要一个能读文件的工作区。
 *
 * 步骤：
 *   1. 取远端 head commit（纯 API）
 *   2. 取它的 tree（recursive）
 *   3. 对每个远端文件：本地不存在 → 删除；内容不同 → 更新
 *   4. 本地有、远端没有 → 新增
 *   5. 建 tree → 建 commit → 移动 ref
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

/** git 的对象哈希：sha1("blob <len>\0" + content)。
 *  先算哈希比，比"逐个建 blob 再比"省掉大量 API 调用。 */
function gitBlobSha(buf) {
  const h = crypto.createHash("sha1");
  h.update(`blob ${buf.length}\0`);
  h.update(buf);
  return h.digest("hex");
}

const REPO = process.argv[2];
const MSG_FILE = process.argv[3];
const OWNER = "hankhrzznl";
const NAME = "lifeflow";
const BRANCH = "main";

if (!REPO || !MSG_FILE) {
  console.error("用法: node tools/push-api2.mjs <repoDir> <messageFile>");
  process.exit(1);
}

/* ── 令牌（从 git 凭据管理器取，不落盘、不打印） ── */
function token() {
  const out = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    cwd: REPO,
  });
  const m = /^password=(.+)$/m.exec(out);
  if (!m) throw new Error("git 凭据里没有 password（令牌）");
  return m[1].trim();
}
const TOKEN = token();
const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
  "User-Agent": "lifeflow-push",
};
async function api(method, url, body) {
  const r = await fetch(`https://api.github.com${url}`, {
    method, headers: H, body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${url} → HTTP ${r.status}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

/* ── 1. 远端 head + 完整 tree ── */
const ref = await api("GET", `/repos/${OWNER}/${NAME}/git/ref/heads/${BRANCH}`);
const headSha = ref.object.sha;
const headCommit = await api("GET", `/repos/${OWNER}/${NAME}/git/commits/${headSha}`);
const remoteTree = await api(
  "GET",
  `/repos/${OWNER}/${NAME}/git/trees/${headCommit.tree.sha}?recursive=1`,
);
console.log(`  远端 ${BRANCH} = ${headSha.slice(0, 7)}  文件 ${remoteTree.tree.length} 个`);

const remoteFiles = new Map();
for (const e of remoteTree.tree) if (e.type === "blob") remoteFiles.set(e.path, e.sha);

/* ── 2. 本地工作区（跳过 .git / node_modules / .next） ── */
function walk(dir, base = "") {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name === ".git" || name === "node_modules" || name === ".next") continue;
    const abs = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const st = fs.statSync(abs);
    if (st.isDirectory()) out.push(...walk(abs, rel));
    else out.push(rel);
  }
  return out;
}
const localFiles = walk(REPO);
console.log(`  本地工作区 文件 ${localFiles.length} 个`);

/* ── 3. 算差异 ── */
const updates = [];
const deletes = [];

for (const rel of localFiles) {
  const buf = fs.readFileSync(path.join(REPO, rel));
  const sha = gitBlobSha(buf);
  if (remoteFiles.get(rel) !== sha) updates.push({ rel, buf, sha });
}
const localSet = new Set(localFiles); // 用 Set，别用数组 includes（O(n²)）
for (const rel of remoteFiles.keys()) {
  if (!localSet.has(rel)) deletes.push(rel);
}

console.log(`  需更新 ${updates.length} · 需删除 ${deletes.length}`);
if (!updates.length && !deletes.length) {
  console.log("  没有差异，无需推送");
  process.exit(0);
}
for (const u of updates) console.log(`    ~ ${u.rel}`);
for (const d of deletes) console.log(`    - ${d}`);

/* ── 4. 建 blob ── */
const tree = [];
for (const u of updates) {
  const blob = await api("POST", `/repos/${OWNER}/${NAME}/git/blobs`, {
    content: u.buf.toString("base64"),
    encoding: "base64",
  });
  tree.push({ path: u.rel, mode: "100644", type: "blob", sha: blob.sha });
}
for (const d of deletes) tree.push({ path: d, mode: "100644", type: "blob", sha: null });

/* ── 5. tree → commit → ref ── */
const newTree = await api("POST", `/repos/${OWNER}/${NAME}/git/trees`, {
  base_tree: headCommit.tree.sha, tree,
});
const author = execFileSync("git", ["config", "user.name"], { cwd: REPO, encoding: "utf8" }).trim();
const email = execFileSync("git", ["config", "user.email"], { cwd: REPO, encoding: "utf8" }).trim();
const message = fs.readFileSync(MSG_FILE, "utf8");
const now = new Date().toISOString();
const commit = await api("POST", `/repos/${OWNER}/${NAME}/git/commits`, {
  message, tree: newTree.sha, parents: [headSha],
  author: { name: author, email, date: now },
  committer: { name: author, email, date: now },
});
await api("PATCH", `/repos/${OWNER}/${NAME}/git/refs/heads/${BRANCH}`, {
  sha: commit.sha, force: false,
});
console.log(`  ✅ 已推送 ${commit.sha.slice(0, 7)}`);
console.log(`     https://github.com/${OWNER}/${NAME}/commit/${commit.sha}`);
