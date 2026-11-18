import {readFileSync, writeFileSync} from 'node:fs';
const [owner, repo] = process.argv.slice(2);
if (!owner || !repo || !/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) {
  console.error('Usage: node scripts/configure-release-urls.mjs GITHUB_OWNER REPOSITORY_NAME');
  process.exit(1);
}
const path = 'dist/Restriction_Manager.user.js';
let content = readFileSync(path, 'utf8');
const releaseUrl = `https://github.com/${owner}/${repo}/releases/latest/download/Restriction_Manager.user.js`;
const supportUrl = `https://github.com/${owner}/${repo}/issues`;
const meta = content.match(/^\/\/ ==UserScript==\n([\s\S]*?)\/\/ ==\/UserScript==/);
if (!meta) throw new Error('Userscript metadata block not found');
let block = meta[0].split('\n').filter(line =>
  !/^\/\/ @(updateURL|downloadURL|supportURL|homepageURL)\s+/.test(line));
const pos = block.findIndex(line => line.startsWith('// @version'));
if (pos === -1) throw new Error('@version metadata not found');
block.splice(pos + 1, 0,
  `// @updateURL    ${releaseUrl}`,
  `// @downloadURL  ${releaseUrl}`,
  `// @supportURL   ${supportUrl}`,
  `// @homepageURL  https://github.com/${owner}/${repo}`);
content = content.replace(meta[0], block.join('\n'));
writeFileSync(path, content, 'utf8');
console.log(`Configured stable Release URLs for ${owner}/${repo}. Run npm-free checks: node tests/validate.cjs`);
