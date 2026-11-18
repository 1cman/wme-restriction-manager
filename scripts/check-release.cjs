'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node scripts/check-release.cjs 3.1.0'); process.exit(1);
}
const src = fs.readFileSync('dist/Restriction_Manager.user.js','utf8');
const found = /^\/\/ @version\s+(\S+)/m.exec(src)?.[1];
assert.equal(found,version,'Release tag and metadata @version must match');
const download = /^\/\/ @downloadURL\s+(\S+)/m.exec(src)?.[1];
const update = /^\/\/ @updateURL\s+(\S+)/m.exec(src)?.[1];
assert.ok(download && update && download===update,'Use identical stable Release URL for updates/downloads');
assert.match(download,/^https:\/\/github\.com\/[\w-]+\/[\w.-]+\/releases\/latest\/download\/Restriction_Manager\.user\.js$/);
console.log(`Ready to draft v${version} (${download}).`);
