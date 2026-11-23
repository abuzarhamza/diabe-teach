#!/usr/bin/env node
/**
 * Stops everything `npm run dev:local` started: the start script, the
 * npm/npx wrappers, `netlify dev` and its children, and the in-memory MongoDB.
 * Sends SIGTERM, waits a short grace period, then SIGKILLs what is left, and
 * finally checks that port 8888 is free.
 *
 * Usage:
 *   npm run dev:local:stop
 */

import { execFileSync } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const DEV_PORT = 8888;
const GRACE_MS = 5_000;
// Command-line patterns of the processes `dev:local` starts.
const PATTERNS = [
  "start-dev-with-mongodb",
  "netlify dev",
  "mongodb-memory-server",
  "mongodb-binaries",
];

function run(command: string, args: readonly string[]): string {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  }
  catch {
    // pgrep/lsof exit 1 when nothing matches.
    return "";
  }
}

function toPids(output: string): number[] {
  return output.split(/\s+/).filter(Boolean).map(Number).filter(pid => Number.isInteger(pid) && pid > 0);
}

function childrenOf(pid: number): number[] {
  return toPids(run("pgrep", [
    "-P",
    String(pid),
  ]));
}

function portListeners(): number[] {
  return toPids(run("lsof", ["-ti", `tcp:${DEV_PORT}`, "-sTCP:LISTEN"]));
}

/** This script and its ancestors (npm, the calling shell), which must survive. */
function ownAncestry(): Set<number> {
  const chain = new Set<number>([process.pid]);
  let pid = process.ppid;
  while (pid > 1 && !chain.has(pid)) {
    chain.add(pid);
    pid = Number(run("ps", [
      "-o",
      "ppid=",
      "-p",
      String(pid),
    ]).trim()) || 0;
  }
  return chain;
}

function findTargets(): Set<number> {
  const keep = ownAncestry();
  const roots = [
    ...PATTERNS.flatMap(pattern => toPids(run("pgrep", ["-f", pattern]))),
    ...portListeners(),
  ];
  const targets = new Set<number>();
  const queue = [...roots];
  while (queue.length > 0) {
    const pid = queue.pop()!;
    if (keep.has(pid) || targets.has(pid)) {
      continue;
    }
    targets.add(pid);
    queue.push(...childrenOf(pid));
  }
  return targets;
}

function signalAll(pids: Iterable<number>, signal: NodeJS.Signals): void {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    }
    catch {
      // Already gone.
    }
  }
}

function alive(pids: Iterable<number>): number[] {
  return [...pids].filter((pid) => {
    try {
      process.kill(pid, 0);
      return true;
    }
    catch {
      return false;
    }
  });
}

async function main(): Promise<void> {
  const targets = findTargets();
  if (targets.size === 0) {
    console.log("dev:local is not running.");
  }
  else {
    console.log(`Stopping ${targets.size} dev:local process(es) with SIGTERM...`);
    signalAll(targets, "SIGTERM");
    const deadline = Date.now() + GRACE_MS;
    while (alive(targets).length > 0 && Date.now() < deadline) {
      await delay(200);
    }
    // Children may have been spawned during shutdown; pick them up too.
    const leftovers = new Set([
      ...alive(targets),
      ...findTargets(),
    ]);
    if (leftovers.size > 0) {
      console.log(`Force-killing ${leftovers.size} process(es) still running after ${GRACE_MS / 1000}s...`);
      signalAll(leftovers, "SIGKILL");
      await delay(500);
    }
  }

  const listeners = portListeners();
  if (listeners.length > 0) {
    console.error(`❌ Port ${DEV_PORT} is still in use by pid(s) ${listeners.join(", ")}.`);
    process.exitCode = 1;
    return;
  }
  console.log(`DEV STOPPED (port ${DEV_PORT} is free)`);
}

void main();
