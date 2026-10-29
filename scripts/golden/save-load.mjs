#!/usr/bin/env node
/** Run the existing GOLD-1.2 route with the GOLD-1.4 persistence probe enabled. */
if (!process.argv.includes('--save-load')) process.argv.push('--save-load')
await import('./play.mjs')
