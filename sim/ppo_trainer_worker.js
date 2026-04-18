import init, {
  rust_robotics_ppo_worker_create_trainer,
  rust_robotics_ppo_worker_destroy_trainer,
  rust_robotics_ppo_worker_load_shared_state,
  rust_robotics_ppo_worker_train,
} from "./rust_robotics_sim.js";

let wasmInitPromise = null;
const sessions = new Map();

function serializeError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function ensureWasm() {
  if (!wasmInitPromise) {
    wasmInitPromise = init({ module_or_path: "./rust_robotics_sim_bg.wasm" });
  }
  return wasmInitPromise;
}

async function createTrainer(handle, config) {
  const created = rust_robotics_ppo_worker_create_trainer(config);
  sessions.set(handle, created.session_id);
  self.postMessage({
    type: "created",
    handle,
    metrics: created.metrics,
    snapshot: created.snapshot,
    shared_state: created.shared_state,
  });
}

self.onmessage = async (event) => {
  const { type, handle, config, updates } = event.data ?? {};

  try {
    await ensureWasm();

    if (type === "create") {
      await createTrainer(handle, config);
      return;
    }

    if (type === "reset") {
      const oldSessionId = sessions.get(handle);
      if (oldSessionId !== undefined) {
        rust_robotics_ppo_worker_destroy_trainer(oldSessionId);
        sessions.delete(handle);
      }
      await createTrainer(handle, config);
      return;
    }

    if (type === "train") {
      const sessionId = sessions.get(handle);
      if (sessionId === undefined) {
        throw new Error(`missing trainer session for handle ${handle}`);
      }
      const trained = rust_robotics_ppo_worker_train(sessionId, updates);
      self.postMessage({
        type: "trained",
        handle,
        metrics: trained.metrics,
        snapshot: trained.snapshot,
        shared_state: trained.shared_state,
      });
      return;
    }

    if (type === "loadSharedState") {
      const sessionId = sessions.get(handle);
      if (sessionId === undefined) {
        throw new Error(`missing trainer session for handle ${handle}`);
      }
      rust_robotics_ppo_worker_load_shared_state(sessionId, {
        shared_state: event.data.shared_state,
      });
      self.postMessage({ type: "sharedStateLoaded", handle });
      return;
    }

    if (type === "destroy") {
      const sessionId = sessions.get(handle);
      if (sessionId !== undefined) {
        rust_robotics_ppo_worker_destroy_trainer(sessionId);
        sessions.delete(handle);
      }
      self.postMessage({ type: "destroyed", handle });
      return;
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      handle,
      error: serializeError(error),
    });
  }
};
