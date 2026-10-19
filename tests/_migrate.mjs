/* 一次性迁移：把 tests/verify_*.mjs 里写死的 req/EXE/BASE/OUT/PAGES 换到 _env.mjs */
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("tests");
for (const f of fs.readdirSync(dir).filter((x) => x.startsWith("verify_"))) {
  const p = path.join(dir, f);
  let s = fs.readFileSync(p, "utf8");
  s = s.replace(/import \{ createRequire \} from "node:module";\r?\n/g, "");
  s = s.replace(/const req = createRequire\([^)]*\);\r?\n/g, "");
  s = s.replace(/const \{ chromium \} = req\("playwright-core"\);\r?\n/g, "");
  s = s.replace(/const EXE = [^;]*;\r?\n/g, "");
  s = s.replace(/const BASE = [^;]*;\r?\n/g, "");
  s = s.replace(/const OUT = [^;]*;\r?\n/g, "");
  s = s.replace(/const PAGES = [^;]*;\r?\n/g, "");
  s = s.replace(/\.workbuddy\/tmp\//g, "tests/");
  const imp = 'import { chromium, EXE, BASE, OUT, PAGES } from "./_env.mjs";';
  const lines = s.split(/\r?\n/);
  let last = -1;
  for (let i = 0; i < lines.length; i++) if (/^import /.test(lines[i])) last = i;
  if (last >= 0) lines.splice(last + 1, 0, imp);
  else lines.unshift(imp);
  s = lines.join("\n");
  fs.writeFileSync(p, s);
  console.log("migrated", f);
}
