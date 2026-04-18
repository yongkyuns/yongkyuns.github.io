let nextHandle = 1;
const trainers = new Map();

function cloneState(state) {
  return {
    ready: Boolean(state.ready),
    busy: Boolean(state.busy),
    snapshot: state.snapshot ?? null,
    shared_state: state.shared_state ?? null,
    metrics: state.metrics ?? null,
    error: state.error ?? null,
  };
}

function ensureTrainer(handle) {
  const trainer = trainers.get(handle);
  if (!trainer) {
    throw new Error(`missing PPO trainer handle ${handle}`);
  }
  return trainer;
}

function spawnTrainerWorker(handle, trainer) {
  const worker = new Worker(new URL("./ppo_trainer_worker.js", import.meta.url), {
    type: "module",
    name: `rust-robotics-ppo-worker-${handle}`,
  });

  worker.onmessage = (event) => {
    const { type, snapshot, shared_state, metrics, error } = event.data ?? {};
    if (!trainers.has(handle)) {
      worker.terminate();
      return;
    }

    if (type === "created" || type === "trained") {
      trainer.ready = true;
      trainer.busy = false;
      trainer.snapshot = snapshot ?? trainer.snapshot;
      trainer.shared_state = shared_state ?? trainer.shared_state;
      trainer.metrics = metrics ?? trainer.metrics;
      trainer.error = null;
      return;
    }

    if (type === "sharedStateLoaded") {
      return;
    }

    if (type === "destroyed") {
      trainer.ready = false;
      trainer.busy = false;
      trainer.snapshot = null;
      trainer.metrics = null;
      trainer.error = null;
      worker.terminate();
      return;
    }

    if (type === "error") {
      trainer.busy = false;
      trainer.ready = false;
      trainer.error = typeof error === "string" ? error : String(error ?? "unknown worker error");
    }
  };

  worker.onerror = (event) => {
    trainer.busy = false;
    trainer.ready = false;
    trainer.error = event?.message || "PPO trainer worker failed";
    worker.terminate();
    trainer.worker = null;
  };

  trainer.worker = worker;
  return worker;
}

function resetLocalTrainer(trainer) {
  trainer.ready = false;
  trainer.busy = true;
  trainer.snapshot = null;
  trainer.shared_state = null;
  trainer.metrics = null;
  trainer.error = null;
}

export function rustRoboticsPpoTrainerCreate(config) {
  const handle = nextHandle++;
  const trainer = {
    worker: null,
    ready: false,
    busy: true,
    snapshot: null,
    shared_state: null,
    metrics: null,
    error: null,
  };
  trainers.set(handle, trainer);
  const worker = spawnTrainerWorker(handle, trainer);
  worker.postMessage({ type: "create", handle, config });
  return handle;
}

export function rustRoboticsPpoTrainerRecreate(handle, config) {
  const trainer = ensureTrainer(handle);
  trainer.worker?.terminate();
  resetLocalTrainer(trainer);
  const worker = spawnTrainerWorker(handle, trainer);
  worker.postMessage({ type: "create", handle, config });
}

export function rustRoboticsPpoTrainerRequestTrain(handle, updates) {
  const trainer = ensureTrainer(handle);
  if (!trainer.ready || trainer.busy) {
    return false;
  }
  trainer.busy = true;
  trainer.worker?.postMessage({ type: "train", handle, updates });
  return true;
}

export function rustRoboticsPpoTrainerPoll(handle) {
  const trainer = trainers.get(handle);
  return trainer ? cloneState(trainer) : null;
}

export function rustRoboticsPpoTrainerLoadSharedState(handle, sharedState) {
  const trainer = ensureTrainer(handle);
  trainer.shared_state = sharedState;
  trainer.snapshot = sharedState?.policy ?? trainer.snapshot;
  trainer.worker?.postMessage({ type: "loadSharedState", handle, shared_state: sharedState });
}

export function rustRoboticsPpoTrainerDestroy(handle) {
  const trainer = trainers.get(handle);
  if (!trainer) {
    return;
  }
  trainer.worker?.terminate();
  trainer.worker = null;
  trainers.delete(handle);
}
