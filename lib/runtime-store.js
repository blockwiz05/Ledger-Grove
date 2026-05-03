import { promises as fs } from "fs";
import path from "path";
import { createDefaultRuntimeState, createDefaultAgents, DEFAULT_OWNER_CONFIG } from "./config.js";

const DATA_DIR = path.join(process.cwd(), "data");
const RUNTIME_FILE = path.join(DATA_DIR, "runtime.json");

export async function readRuntimeState() {
  await ensureRuntimeFile();
  const raw = await fs.readFile(RUNTIME_FILE, "utf8");
  const parsed = JSON.parse(raw);
  return normalizeRuntimeState(parsed);
}

export async function writeRuntimeState(state) {
  await ensureRuntimeFile();
  await fs.writeFile(RUNTIME_FILE, JSON.stringify(state, null, 2));
  return state;
}

export async function updateRuntimeState(updater) {
  const current = await readRuntimeState();
  const next = await updater(current);
  return writeRuntimeState(normalizeRuntimeState(next));
}

async function ensureRuntimeFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(RUNTIME_FILE);
  } catch {
    await fs.writeFile(
      RUNTIME_FILE,
      JSON.stringify(createDefaultRuntimeState(), null, 2),
    );
  }
}

function normalizeRuntimeState(state) {
  const base = createDefaultRuntimeState();
  const merged = {
    ...base,
    ...state,
    ownerConfig: {
      ...base.ownerConfig,
      ...(state.ownerConfig || {}),
    },
    automationConfig: {
      ...base.automationConfig,
      ...(state.automationConfig || {}),
    },
    agents:
      state.agents && state.agents.length
        ? state.agents
        : createDefaultAgents((state.ownerConfig || {}).teamRoot || DEFAULT_OWNER_CONFIG.teamRoot),
    auditLog: state.auditLog || [],
    automationEvents: state.automationEvents || [],
    actionReports: state.actionReports || [],
    pendingActions: state.pendingActions || [],
    latestAction: state.latestAction || null,
  };
  return merged;
}
