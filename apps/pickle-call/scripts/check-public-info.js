// 公開してはいけない文字列（端末の中のパス、開発用の住所、作業用の言い回しなど）が
// リポジトリに入っていないかを確かめる。omicreate のプロフィールリポジトリの scripts/check-public-info.js の複製。
// このアプリは "type": "module" なので ESM で書いている。調べる対象はこのフォルダ（npm の実行場所）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = process.cwd();
const scriptPath = path.relative(rootDir, fileURLToPath(import.meta.url)).split(path.sep).join("/");

const ignoredDirs = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".vercel",
  "coverage",
  "dist",
  "dist-artifact",
  "node_modules",
  "playwright-report",
  "test-results"
]);

const ignoredFiles = new Set([scriptPath]);

// どの深さにあっても調べないファイル名
const ignoredNames = new Set(["package-lock.json"]);

const ignoredExtensions = new Set([
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".svg",
  ".webp",
  ".zip"
]);

const checks = [
  ["macOS home path", "/" + "Users/"],
  ["private temp path", "/" + "private/tmp"],
  ["system temp path", "/" + "var/folders"],
  ["personal workspace path", "Documents/" + "Apps"],
  ["loopback host name", ["local", "host"].join("")],
  ["loopback ip address", "127." + "0.0.1"],
  ["static dev server command", "python3 -m " + "http.server"],
  ["file URL", "file" + "://"],
  ["agent workspace name", ["Co", "dex"].join("")],
  ["Japanese local edition label", "ローカル" + "版"],
  ["Japanese local run wording", "ローカル" + "で動かす"],
  ["Japanese work location wording", "作業" + "場所"],
  ["Japanese work root wording", "作業" + "ルート"],
  ["personal computer side wording", "PC" + "側"],
  ["personal computer inside wording", "PC" + "内"]
];

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ignoredExtensions.has(ext)) return false;

  const buffer = fs.readFileSync(filePath);
  if (buffer.includes(0)) return false;
  return buffer.length <= 1024 * 1024;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relativePath = toPosix(path.relative(rootDir, fullPath));
    if (ignoredFiles.has(relativePath)) continue;

    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (ignoredNames.has(entry.name)) continue;

    if (entry.isFile() && isTextFile(fullPath)) {
      files.push({ fullPath, relativePath });
    }
  }
  return files;
}

const findings = [];

for (const file of walk(rootDir)) {
  const content = fs.readFileSync(file.fullPath, "utf8");
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    checks.forEach(([label, needle]) => {
      if (line.includes(needle)) {
        findings.push(`${file.relativePath}:${index + 1} ${label}`);
      }
    });
  });
}

if (findings.length > 0) {
  console.error("Public information check failed:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log("Public information check passed.");
