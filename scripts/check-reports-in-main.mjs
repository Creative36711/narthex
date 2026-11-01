#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const requestedPaths = [...new Set(process.argv.slice(2))];
const invalidPaths = requestedPaths.filter(
  (filePath) => !filePath || filePath.startsWith('/') || filePath.split('/').includes('..'),
);

if (requestedPaths.length === 0 || invalidPaths.length > 0) {
  console.error('Usage: node scripts/check-reports-in-main.mjs <report-path> [<report-path> ...]');
  if (invalidPaths.length > 0) {
    for (const filePath of invalidPaths) {
      console.error(`Invalid repository-relative path: ${filePath}`);
    }
  }
  process.exitCode = 2;
} else {
  const root = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });

  if (root.error || root.status !== 0) {
    const detail = root.error?.message || root.stderr?.trim() || 'not inside a Git repository';
    console.error(`Unable to locate repository root: ${detail}`);
    process.exitCode = 2;
  } else {
    const pathspecs = requestedPaths.map((filePath) => `:(literal)${filePath}`);
    const tree = spawnSync(
      'git',
      ['ls-tree', '--full-tree', '-r', '--name-only', 'main', '--', ...pathspecs],
      { cwd: root.stdout.trim(), encoding: 'utf8' },
    );

    if (tree.error || tree.status !== 0) {
      const detail = tree.error?.message || tree.stderr?.trim() || `git exited with status ${tree.status}`;
      console.error(`Unable to inspect main: ${detail}`);
      process.exitCode = 2;
    } else {
      const pathsInMain = new Set(tree.stdout.split(/\r?\n/).filter(Boolean));
      const missingPaths = requestedPaths.filter((filePath) => !pathsInMain.has(filePath));

      if (missingPaths.length > 0) {
        for (const filePath of missingPaths) {
          console.error(`Missing from main: ${filePath}`);
        }
        process.exitCode = 1;
      } else {
        console.log(`All ${requestedPaths.length} requested path(s) exist in main.`);
      }
    }
  }
}
