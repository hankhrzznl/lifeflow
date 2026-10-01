/**
 * 用 GitHub API 推送**指定的几个文件**（最省事、最可控的一版）
 * 用法： node tools/push-files.mjs <repoDir> <messageFile> <file1> [file2 ...]
 *
 * 为什么又写一版：
 *   前两版失败的教训 ——
 *   · push-via-api.mjs  依赖本地有远端那个 SHA 的对象（浅克隆 + 远端被我改过 ⟹ 拿不到）
 *   · push-api2.mjs     自己算全库差异，结果把 483 个文件都判成"变了"
 *                       （工作区的 CRLF 与 git 存储的 LF 不一致导致的假差异），
 *                       而且一次性提交 483 个 blob 建 tree 会被 GitHub 拒绝：
 *                       HTTP 422 "your input was too large to process"
 *
 * 这一版的做法最笨也最稳：**你明确告诉它改哪几个文件**，它就只推这几个。
 *   不做差异计算、不碰其它文件、不依赖本地 git 历史。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [, , REPO, MSG_FILE, ...FILES] = process.argv;
const OWNER = "hankhrzznl";
const NAME = "lifeflow";
const BRANCH = "main";

if (!REPO || !MSG_FILE || FILES.length === 0) {
  console.error("用法: node tools/push-files.mjs <repoDir> <messageFile> <file1> [file2 ...]");
  process.exit(1);
}

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
  if (!r.ok) throw new Error(`${method} ${url} → HTTP ${r.status}: ${t.slice(0, 400)}`);
  return t ? JSON.parse(t) : null;
}

/* 1. 远端 head */
const ref = await api("GET", `/repos/${OWNER}/${NAME}/git/ref/heads/${BRANCH}`);
const headSha = ref.object.sha;
const headCommit = await api("GET", `/repos/${OWNER}/${NAME}/git/commits/${headSha}`);
console.log(`  远端 ${BRANCH} = ${headSha.slice(0, 7)}`);

/* 2. 逐个文件建 blob —— 只推指定的这几个 */
const tree = [];
for (const rel of FILES) {
  const abs = path.join(REPO, rel);
  if (!fs.existsSync(abs)) {
    tree.push({ path: rel, mode: "100644", type: "blob", sha: null });
    console.log(`    - 删除 ${rel}`);
    continue;
  }
  const buf = fs.readFileSync(abs);
  const blob = await api("POST", `/repos/${OWNER}/${NAME}/git/blobs`, {
    content: buf.toString("base64"),
    encoding: "base64",
  });
  tree.push({ path: rel, mode: "100644", type: "blob", sha: blob.sha });
  console.log(`    ~ ${rel}  (${buf.length} 字节 → blob ${blob.sha.slice(0, 7)})`);
}

/* 3. tree → commit → ref */
const newTree = await api("POST", `/repos/${OWNER}/${NAME}/git/trees`, {
  base_tree: headCommit.tree.sha, tree,
});
const author = execFileSync("git", ["config", "user.name"], { cwd: REPO, encoding: "utf8" }).trim();
const email = execFileSync("git", ["config", "user.email"], { cwd: REPO, encoding: "utf8" }).trim();
const message = fs.readFileSync(MSG_FILE, "utf8").replace(/^\uFEFF/, ""); // 去掉可能的 BOM
const now = new Date().toISOString();
const commit = await api("POST", `/repos/${OWNER}/${NAME}/git/commits`, {
  message, tree: newTree.sha, parents: [headSha],
  author: { name: author, email, date: now },
  committer: { name: author, email, date: now },
});
await api("PATCH", `/repos/${OWNER}/${NAME}/git/refs/heads/${BRANCH}`, {
  sha: commit.sha, force: false,
});
console.log(`  ✅ 已推送 ${commit.sha.slice(0, 7)}（${FILES.length} 个文件）`);
console.log(`     https://github.com/${OWNER}/${NAME}/commit/${commit.sha}`);
