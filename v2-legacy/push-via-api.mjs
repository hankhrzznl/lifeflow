/**
 * 用 GitHub API 推送（当 git over HTTPS 不通、但 api.github.com 通时用）
 * 用法： node tools/push-via-api.mjs <repoDir> "<commit message>"
 *
 * 为什么需要它：这台机器上 github.com:443 会不通（代理挂掉后直连被拒），
 * 但 api.github.com:443 通。git 的传输走前者，所以 push 失败；
 * 而 GitHub 的 Git Data API 走后者，可以用它完成同样的推送。
 *
 * 做的事（等价于 git add + commit + push）：
 *   1. 读本地 git 里的改动文件（相对 HEAD~1..HEAD？不 —— 用"工作区 vs 远端"对比）
 *   2. 为每个改动文件建 blob
 *   3. 在远端 head 的 tree 上建新 tree
 *   4. 建 commit，把 main 指过去
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REPO = process.argv[2];
const MESSAGE = process.argv[3] ?? "chore: 通过 API 推送";
const OWNER = "hankhrzznl";
const NAME = "lifeflow";
const BRANCH = "main";

if (!REPO) {
  console.error("用法: node tools/push-via-api.mjs <repoDir> \"<message>\"");
  process.exit(1);
}

/* ── 1. 取令牌（从 git 凭据管理器，不落盘、不打印） ── */
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
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${url} → HTTP ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/* ── 2. 远端 head ── */
const ref = await api("GET", `/repos/${OWNER}/${NAME}/git/ref/heads/${BRANCH}`);
const headSha = ref.object.sha;
const headCommit = await api("GET", `/repos/${OWNER}/${NAME}/git/commits/${headSha}`);
console.log(`  远端 ${BRANCH} = ${headSha.slice(0, 7)}`);

/* ── 3. 找出"本地 HEAD 相对远端 head 改了哪些文件" ── */
const changed = execFileSync(
  "git",
  ["diff", "--name-only", `${headSha}`, "HEAD"],
  { cwd: REPO, encoding: "utf8" },
)
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

if (!changed.length) {
  console.log("  没有差异，无需推送");
  process.exit(0);
}
console.log(`  改动 ${changed.length} 个文件:`);
for (const f of changed) console.log(`    ${f}`);

/* ── 4. 逐个建 blob ── */
const tree = [];
for (const f of changed) {
  const abs = path.join(REPO, f);
  if (!fs.existsSync(abs)) {
    /* 删除的文件 */
    tree.push({ path: f, mode: "100644", type: "blob", sha: null });
    console.log(`    ✗ 删除 ${f}`);
    continue;
  }
  const content = fs.readFileSync(abs);
  const blob = await api("POST", `/repos/${OWNER}/${NAME}/git/blobs`, {
    content: content.toString("base64"),
    encoding: "base64",
  });
  const isExec = (fs.statSync(abs).mode & 0o111) !== 0;
  tree.push({ path: f, mode: isExec ? "100755" : "100644", type: "blob", sha: blob.sha });
  console.log(`    ✓ ${f} → blob ${blob.sha.slice(0, 7)}`);
}

/* ── 5. 建 tree（基于远端 head 的 tree） ── */
const newTree = await api("POST", `/repos/${OWNER}/${NAME}/git/trees`, {
  base_tree: headCommit.tree.sha,
  tree,
});
console.log(`  新 tree = ${newTree.sha.slice(0, 7)}`);

/* ── 6. 建 commit ── */
const author = execFileSync("git", ["config", "user.name"], { cwd: REPO, encoding: "utf8" }).trim();
const email = execFileSync("git", ["config", "user.email"], { cwd: REPO, encoding: "utf8" }).trim();
const commit = await api("POST", `/repos/${OWNER}/${NAME}/git/commits`, {
  message: MESSAGE,
  tree: newTree.sha,
  parents: [headSha],
  author: { name: author, email, date: new Date().toISOString() },
  committer: { name: author, email, date: new Date().toISOString() },
});
console.log(`  新 commit = ${commit.sha.slice(0, 7)}`);

/* ── 7. 移动 main ── */
await api("PATCH", `/repos/${OWNER}/${NAME}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false });
console.log(`  ✅ 已推送到 ${BRANCH}`);
console.log(`     https://github.com/${OWNER}/${NAME}/commit/${commit.sha}`);
