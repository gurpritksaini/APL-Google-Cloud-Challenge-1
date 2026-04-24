#!/usr/bin/env tsx
/**
 * Run all simulators concurrently for a full demo scenario.
 * Usage: pnpm simulate:all
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SIMULATORS = [
  { name: 'Entries', script: 'simulate-entries.ts', color: '\x1b[34m' },
  { name: 'POS/Queues', script: 'simulate-pos.ts', color: '\x1b[32m' },
  { name: 'Sensors', script: 'simulate-sensors.ts', color: '\x1b[35m' },
];

const RESET = '\x1b[0m';

console.info('\n🚀 Starting all simulators for demo scenario\n');

const processes = SIMULATORS.map(({ name, script, color }) => {
  const scriptPath = path.join(__dirname, script);
  const child = spawn('tsx', [scriptPath], {
    env: process.env,
    stdio: 'pipe',
  });

  child.stdout?.on('data', (data: Buffer) => {
    process.stdout.write(`${color}[${name}]${RESET} ${data.toString()}`);
  });

  child.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(`${color}[${name}]${RESET} ${data.toString()}`);
  });

  child.on('exit', (code) => {
    console.info(`${color}[${name}]${RESET} exited with code ${code}`);
  });

  return child;
});

process.on('SIGINT', () => {
  console.info('\n\nShutting down all simulators...');
  processes.forEach((p) => p.kill('SIGTERM'));
  process.exit(0);
});
