let rustRoboticsOrtLoadPromise = null;
let rustRoboticsMujocoModulePromise = null;
let rustRoboticsMujocoRuntime = null;
let rustRoboticsMujocoInitPromise = null;
let rustRoboticsMujocoOverlay = null;

function ensureRustRoboticsOrtLoaded() {
  if (globalThis.ort) {
    return Promise.resolve(globalThis.ort);
  }
  if (!rustRoboticsOrtLoadPromise) {
    rustRoboticsOrtLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "vendor/onnxruntime-web/dist/ort.wasm.min.js";
      script.async = true;
      script.onload = () => {
        if (globalThis.ort) {
          resolve(globalThis.ort);
        } else {
          reject(new Error("onnxruntime-web script loaded but global ort is missing"));
        }
      };
      script.onerror = () => reject(new Error("failed to load onnxruntime-web script"));
      document.head.appendChild(script);
    });
  }
  return rustRoboticsOrtLoadPromise;
}

async function configureRustRoboticsOrt(wasmBasePath) {
  const ort = await ensureRustRoboticsOrtLoaded();
  if (!ort) {
    throw new Error("onnxruntime-web script is not loaded");
  }

  const assetBase = new URL(wasmBasePath, window.location.href);
  ort.env.wasm.wasmPaths = {
    mjs: new URL("ort-wasm-simd-threaded.mjs", assetBase).href,
    wasm: new URL("ort-wasm-simd-threaded.wasm", assetBase).href,
  };
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  ort.env.wasm.proxy = false;
  return ort;
}

export async function rustRoboticsOrtSmokeTest(modelBytes, wasmBasePath, config = null) {
  const ort = await configureRustRoboticsOrt(wasmBasePath);

  const session = await ort.InferenceSession.create(modelBytes, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });

  const inputNames = Array.from(session.inputNames);
  if (inputNames.length < 4) {
    throw new Error(`unexpected input count: ${inputNames.length}`);
  }

  const feeds = {};
  const commandDim = Number(config?.command_dim) || 16;
  const inputKeys = Array.isArray(config?.input_keys) ? config.input_keys : inputNames;
  const nameFor = (predicate) => inputNames.find(predicate) ?? inputKeys.find(predicate);
  const policyName = nameFor((name) => name === "policy");
  const isInitName = nameFor((name) => name === "is_init");
  const adaptHxName = nameFor((name) => name.includes("adapt_hx"));
  const commandName = inputNames.find(
    (name) => name !== policyName && name !== isInitName && name !== adaptHxName,
  );
  if (!policyName || !isInitName || !adaptHxName || !commandName) {
    throw new Error(`failed to resolve ONNX smoke-test inputs from ${inputNames.join(", ")}`);
  }
  feeds[policyName] = new ort.Tensor("float32", new Float32Array(117), [1, 117]);
  feeds[isInitName] = new ort.Tensor("bool", [false], [1]);
  feeds[adaptHxName] = new ort.Tensor("float32", new Float32Array(128), [1, 128]);
  feeds[commandName] = new ort.Tensor("float32", new Float32Array(commandDim), [1, commandDim]);

  const outputs = await session.run(feeds);
  const outputNames = Array.from(session.outputNames);
  const outputSummaries = outputNames.slice(0, 8).map((name) => {
    const tensor = outputs[name];
    const dims = tensor?.dims ? Array.from(tensor.dims) : [];
    const data = tensor?.data;
    let first = null;
    if (data && data.length > 0) {
      first = Number(data[0]);
      if (!Number.isFinite(first)) {
        first = null;
      }
    }
    return { name, dims, first };
  });

  return {
    input_names: inputNames,
    output_names: outputNames,
    output_summaries: outputSummaries,
  };
}

async function getRustRoboticsMujocoModule(wasmBasePath) {
  const assetBase = new URL(wasmBasePath, window.location.href);
  if (!rustRoboticsMujocoModulePromise) {
    const { default: loadMujoco } = await import("./vendor/mujoco/mt/mujoco.js");
    rustRoboticsMujocoModulePromise = loadMujoco({
      locateFile: (path) => new URL(path, assetBase).href,
    });
  }
  return rustRoboticsMujocoModulePromise;
}

function maybeDelete(handle) {
  if (handle && typeof handle.delete === "function") {
    handle.delete();
  }
}

function ensureDirectory(fs, fullPath) {
  const parts = fullPath.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    try {
      fs.mkdir(current);
    } catch (_) {}
  }
}

function writeWorkingFiles(mujoco, fileEntries) {
  ensureDirectory(mujoco.FS, "/working");
  ensureDirectory(mujoco.FS, "/working/assets");

  for (const [path, bytes] of fileEntries) {
    const fullPath = `/working/${path}`;
    const parent = fullPath.substring(0, fullPath.lastIndexOf("/"));
    if (parent) {
      ensureDirectory(mujoco.FS, parent);
    }
    mujoco.FS.writeFile(fullPath, new Uint8Array(bytes));
  }
}

function buildOutputNameMap(outputKeys, outputNames) {
  const mapping = new Map();
  const count = Math.min(outputKeys.length, outputNames.length);
  for (let i = 0; i < count; ++i) {
    mapping.set(outputKeys[i], outputNames[i]);
  }
  return mapping;
}

function buildInputNameMap(inputKeys, inputNames) {
  const mapping = {
    policy: null,
    is_init: null,
    adapt_hx: null,
    command: null,
  };
  const count = Math.min(inputKeys.length, inputNames.length);
  for (let i = 0; i < count; ++i) {
    const key = inputKeys[i];
    if (key === "policy") {
      mapping.policy = inputNames[i];
    } else if (key === "is_init") {
      mapping.is_init = inputNames[i];
    } else if (key.includes("adapt_hx")) {
      mapping.adapt_hx = inputNames[i];
    } else {
      mapping.command = inputNames[i];
    }
  }
  return mapping;
}

function stripJointSuffix(name) {
  return name.endsWith("_joint") ? name.slice(0, -6) : name;
}

function oscillator(timeS) {
  const omega = 4.0 * Math.PI;
  const phases = [
    omega * timeS + Math.PI,
    omega * timeS,
    omega * timeS,
    omega * timeS + Math.PI,
  ];

  return new Float32Array([
    Math.sin(phases[0]),
    Math.sin(phases[1]),
    Math.sin(phases[2]),
    Math.sin(phases[3]),
    Math.cos(phases[0]),
    Math.cos(phases[1]),
    Math.cos(phases[2]),
    Math.cos(phases[3]),
    omega,
    omega,
    omega,
    omega,
  ]);
}

function quaternionYaw(q) {
  const [w, x, y, z] = q;
  const sinzCosp = 2.0 * (x * y + z * w);
  const coszCosp = w * w + x * x - y * y - z * z;
  return Math.atan2(sinzCosp, coszCosp);
}

function rotateVectorByQuaternion(q, v) {
  const [w, x, y, z] = q;
  const uv = [
    y * v[2] - z * v[1],
    z * v[0] - x * v[2],
    x * v[1] - y * v[0],
  ];
  const uuv = [
    y * uv[2] - z * uv[1],
    z * uv[0] - x * uv[2],
    x * uv[1] - y * uv[0],
  ];

  return [
    v[0] + 2.0 * (w * uv[0] + uuv[0]),
    v[1] + 2.0 * (w * uv[1] + uuv[1]),
    v[2] + 2.0 * (w * uv[2] + uuv[2]),
  ];
}

function rotateVectorByInverseQuaternion(q, v) {
  return rotateVectorByQuaternion([q[0], -q[1], -q[2], -q[3]], v);
}

function shiftHistory(history, sample) {
  history[2].set(history[1]);
  history[1].set(history[0]);
  history[0].set(sample);
}

function flattenPolicyInput(runtime) {
  const out = new Float32Array(117);
  let idx = 0;

  for (const step of runtime.gravityHistory) {
    out.set(step, idx);
    idx += 3;
  }
  for (const step of runtime.jointPosHistory) {
    out.set(step, idx);
    idx += 12;
  }
  for (const step of runtime.jointVelHistory) {
    out.set(step, idx);
    idx += 12;
  }
  for (let joint = 0; joint < 12; ++joint) {
    for (let step = 0; step < runtime.actionHistory.length; ++step) {
      out[idx] = runtime.actionHistory[step][joint];
      idx += 1;
    }
  }

  return out;
}

function updatePolicyInput(runtime) {
  const qpos = runtime.data.qpos;
  const qvel = runtime.data.qvel;
  const quat = [qpos[3], qpos[4], qpos[5], qpos[6]];
  const gravity = rotateVectorByInverseQuaternion(quat, [0.0, 0.0, -1.0]);
  shiftHistory(runtime.gravityHistory, gravity);

  const jointPos = new Float32Array(12);
  const jointVel = new Float32Array(12);
  for (let i = 0; i < 12; ++i) {
    jointPos[i] = qpos[runtime.jointQposAdr[i]];
    jointVel[i] = qvel[runtime.jointQvelAdr[i]];
  }
  shiftHistory(runtime.jointPosHistory, jointPos);
  shiftHistory(runtime.jointVelHistory, jointVel);
}

function computeVelocityCommandInput(runtime, commandVelX, commandVelY) {
  const qpos = runtime.data.qpos;
  const quat = [qpos[3], qpos[4], qpos[5], qpos[6]];
  const command = rotateVectorByInverseQuaternion(quat, [commandVelX, commandVelY, 0.0]);
  const yaw = quaternionYaw(quat);
  const osc = oscillator(runtime.mujocoTimeMs / 1000.0);

  return new Float32Array([
    command[0],
    command[1],
    -yaw,
    0.0,
    osc[0],
    osc[1],
    osc[2],
    osc[3],
    osc[4],
    osc[5],
    osc[6],
    osc[7],
    osc[8],
    osc[9],
    osc[10],
    osc[11],
  ]);
}

function computeImpedanceCommandInput(runtime) {
  const qpos = runtime.data.qpos;
  const quat = [qpos[3], qpos[4], qpos[5], qpos[6]];
  const basePos = [Number(qpos[0]), Number(qpos[1]), Number(qpos[2])];
  const kp = runtime.impedanceKp ?? 24.0;
  const kd = 1.8 * Math.sqrt(kp);
  const osc = oscillator(runtime.mujocoTimeMs / 1000.0);
  const setpointWorld = runtime.useSetpointBall
    ? [runtime.commandSetpoint.x, runtime.commandSetpoint.y, 0.0]
    : [
        basePos[0] + runtime.commandVelX * (kd / kp),
        basePos[1] + runtime.commandVelY * (kd / kp),
        0.0,
      ];
  let setpointBody = rotateVectorByInverseQuaternion(quat, [
    setpointWorld[0] - basePos[0],
    setpointWorld[1] - basePos[1],
    setpointWorld[2] - basePos[2],
  ]);
  const norm = Math.hypot(setpointBody[0], setpointBody[1], setpointBody[2]);
  if (norm > 1e-6) {
    const scale = Math.min(norm, 2.0) / norm;
    setpointBody = [setpointBody[0] * scale, setpointBody[1] * scale, setpointBody[2] * scale];
  }
  const yaw = quaternionYaw(quat);
  const mass = 1.0;
  return new Float32Array([
    setpointBody[0],
    setpointBody[1],
    -yaw,
    kp * setpointBody[0],
    kp * setpointBody[1],
    kd,
    kd,
    kd,
    kp * -yaw,
    mass,
    (kp * setpointBody[0]) / mass,
    (kp * setpointBody[1]) / mass,
    kd / mass,
    kd / mass,
    kd / mass,
    osc[0],
    osc[1],
    osc[2],
    osc[3],
    osc[4],
    osc[5],
    osc[6],
    osc[7],
    osc[8],
    osc[9],
    osc[10],
    osc[11],
  ]);
}

function computeCommandInput(runtime, commandVelX, commandVelY) {
  if (runtime.commandMode === "impedance") {
    return computeImpedanceCommandInput(runtime);
  }
  return computeVelocityCommandInput(runtime, commandVelX, commandVelY);
}

async function runPolicy(runtime, commandVelX, commandVelY) {
  const ort = globalThis.ort;
  const policyInput = flattenPolicyInput(runtime);
  const commandInput = computeCommandInput(runtime, commandVelX, commandVelY);
  const adaptHx = new Float32Array(runtime.adaptHx);

  const feeds = {};
  feeds[runtime.inputNameMap.policy] = new ort.Tensor("float32", policyInput, [1, 117]);
  feeds[runtime.inputNameMap.is_init] = new ort.Tensor("bool", [runtime.isInit], [1]);
  feeds[runtime.inputNameMap.adapt_hx] = new ort.Tensor("float32", adaptHx, [1, 128]);
  feeds[runtime.inputNameMap.command] = new ort.Tensor("float32", commandInput, [1, runtime.commandDim]);

  const outputs = await runtime.ortSession.run(feeds);
  const actionTensor = outputs[runtime.actionOutputName];
  const nextHxTensor = outputs[runtime.nextHxOutputName];
  if (!actionTensor || !nextHxTensor) {
    throw new Error("missing policy outputs from ONNX Runtime");
  }

  const action = Float32Array.from(actionTensor.data);
  const nextHx = Float32Array.from(nextHxTensor.data);
  if (action.length < 12) {
    throw new Error(`policy returned ${action.length} actions, expected at least 12`);
  }
  if (nextHx.length < 128) {
    throw new Error(`policy returned ${nextHx.length} recurrent values, expected at least 128`);
  }

  for (let i = 0; i < 12; ++i) {
    runtime.lastActions[i] = runtime.lastActions[i] * 0.2 + action[i] * 0.8;
  }
  shiftHistory(runtime.actionHistory, runtime.lastActions);
  runtime.adaptHx.set(nextHx.subarray(0, 128));
  runtime.isInit = false;
}

function applyControl(runtime) {
  const qpos = runtime.data.qpos;
  const qvel = runtime.data.qvel;
  const ctrl = runtime.data.ctrl;

  for (let i = 0; i < 12; ++i) {
    const target =
      runtime.config.action_scale * runtime.lastActions[i] +
      runtime.config.default_joint_pos[i];
    const torque =
      runtime.config.stiffness * (target - qpos[runtime.jointQposAdr[i]]) +
      runtime.config.damping * (0.0 - qvel[runtime.jointQvelAdr[i]]);
    ctrl[runtime.ctrlAdr[i]] = torque;
  }
}

function collectGeomSnapshots(runtime) {
  if (runtime.visualGeomMeta && runtime.visualGeomState && runtime.data.xpos && runtime.data.xmat) {
    updateVisualGeomState(runtime);
    return runtime.visualGeomState;
  }

  const geoms = [];
  for (let i = 0; i < runtime.model.ngeom; ++i) {
    const modelGeom = runtime.model.geom(i);
    try {
      if (Number(modelGeom.group) >= 3) {
        continue;
      }
      const rgba = Array.from(modelGeom.rgba);
      if ((rgba[3] ?? 0.0) <= 0.01) {
        continue;
      }
      const dataGeom = runtime.data.geom(i);
      try {
        geoms.push({
          type_id: Number(modelGeom.type),
          dataid: Number(modelGeom.dataid),
          size: Array.from(modelGeom.size).slice(0, 3).map(Number),
          rgba: rgba.slice(0, 4).map(Number),
          pos: Array.from(dataGeom.xpos).slice(0, 3).map(Number),
          mat: Array.from(dataGeom.xmat).slice(0, 9).map(Number),
        });
      } finally {
        maybeDelete(dataGeom);
      }
    } finally {
      maybeDelete(modelGeom);
    }
  }
  return geoms;
}

function collectVisualGeomMeta(runtime) {
  const geoms = [];
  for (let i = 0; i < runtime.model.ngeom; ++i) {
    const modelGeom = runtime.model.geom(i);
    try {
      if (Number(modelGeom.group) >= 3) {
        continue;
      }
      const rgba = Array.from(modelGeom.rgba);
      if ((rgba[3] ?? 0.0) <= 0.01) {
        continue;
      }
      geoms.push({
        bodyId: Number(modelGeom.bodyid),
        type_id: Number(modelGeom.type),
        dataid: Number(modelGeom.dataid),
        size: Array.from(modelGeom.size).slice(0, 3).map(Number),
        rgba: rgba.slice(0, 4).map(Number),
        localPos: Array.from(modelGeom.pos).slice(0, 3).map(Number),
        localMat: quatToMat3(Array.from(modelGeom.quat).slice(0, 4).map(Number)),
      });
    } finally {
      maybeDelete(modelGeom);
    }
  }
  return geoms;
}

function createVisualGeomState(meta) {
  return meta.map((geom) => ({
    type_id: geom.type_id,
    dataid: geom.dataid,
    size: geom.size,
    rgba: geom.rgba,
    pos: [0.0, 0.0, 0.0],
    mat: [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0],
  }));
}

function updateVisualGeomState(runtime) {
  const bodyPosAll = runtime.data.xpos;
  const bodyMatAll = runtime.data.xmat;
  for (let i = 0; i < runtime.visualGeomMeta.length; ++i) {
    const meta = runtime.visualGeomMeta[i];
    const state = runtime.visualGeomState[i];
    const bodyPos = readVec3(bodyPosAll, meta.bodyId);
    const bodyMat = readMat3(bodyMatAll, meta.bodyId);
    const worldPos = transformPoint(bodyPos, bodyMat, meta.localPos);
    const worldMat = mulMat3(bodyMat, meta.localMat);
    state.pos[0] = worldPos[0];
    state.pos[1] = worldPos[1];
    state.pos[2] = worldPos[2];
    for (let j = 0; j < 9; ++j) {
      state.mat[j] = worldMat[j];
    }
  }
}

function basePosition(runtime) {
  const qpos = runtime.data.qpos;
  return [Number(qpos[0]), Number(qpos[1]), Number(qpos[2])];
}

function syncCommandSetpointFromCommand(runtime) {
  const basePos = basePosition(runtime);
  let scale = 1.0;
  if (runtime.commandMode === "impedance") {
    const kp = runtime.config.stiffness;
    const kd = 1.8 * Math.sqrt(kp);
    scale = kd / kp;
  }
  runtime.commandSetpoint = {
    x: basePos[0] + runtime.commandVelX * scale,
    y: basePos[1] + runtime.commandVelY * scale,
    z: COMMAND_BALL_HEIGHT,
  };
}

function updateCommandFromSetpoint(runtime) {
  if (!runtime.commandSetpoint) {
    syncCommandSetpointFromCommand(runtime);
  }
  const basePos = basePosition(runtime);
  let dx = runtime.commandSetpoint.x - basePos[0];
  let dy = runtime.commandSetpoint.y - basePos[1];
  const norm = Math.hypot(dx, dy);
  if (norm > MAX_COMMAND_SPEED && norm > 1e-6) {
    const scale = MAX_COMMAND_SPEED / norm;
    dx *= scale;
    dy *= scale;
  }
  runtime.commandVelX = dx;
  runtime.commandVelY = dy;
  runtime.commandSetpoint.z = COMMAND_BALL_HEIGHT;
}

function collectMeshAssets(runtime) {
  const meshAssets = [];
  const allVerts = runtime.model.mesh_vert;
  const allNormals = runtime.model.mesh_normal;
  const allFaces = runtime.model.mesh_face;
  const vertAdr = runtime.model.mesh_vertadr;
  const vertNum = runtime.model.mesh_vertnum;
  const faceAdr = runtime.model.mesh_faceadr;
  const faceNum = runtime.model.mesh_facenum;

  for (let meshId = 0; meshId < runtime.model.nmesh; ++meshId) {
    const vadr = Number(vertAdr[meshId]);
    const vnum = Number(vertNum[meshId]);
    const fadr = Number(faceAdr[meshId]);
    const fnum = Number(faceNum[meshId]);
    meshAssets.push({
      positions: Array.from(allVerts.slice(vadr * 3, (vadr + vnum) * 3), Number),
      normals: Array.from(allNormals.slice(vadr * 3, (vadr + vnum) * 3), Number),
      faces: Array.from(allFaces.slice(fadr * 3, (fadr + fnum) * 3), Number),
    });
  }

  return meshAssets;
}

function buildMujocoReport(runtime, includeMeshAssets = false) {
  const { model, data, stepCount } = runtime;
  const report = {
    nbody: model.nbody,
    ngeom: model.ngeom,
    nv: model.nv,
    nu: model.nu,
    timestep: model.opt.timestep,
    sim_time: data.time,
    step_count: stepCount,
    qpos_preview: Array.from(data.qpos.slice(0, Math.min(8, data.qpos.length))),
    xpos_preview: Array.from(data.xpos.slice(0, Math.min(9, data.xpos.length))),
    last_action_preview: Array.from(runtime.lastActions.slice(0, 12)),
    policy_inputs: Array.from(runtime.policyInputNames),
    policy_outputs: Array.from(runtime.policyOutputNames),
    command_vel_x: runtime.commandVelX,
    command_vel_y: runtime.commandVelY,
    use_setpoint_ball: Boolean(runtime.useSetpointBall),
    command_mode: runtime.commandMode ?? "velocity",
    setpoint_preview: runtime.commandSetpoint
      ? [runtime.commandSetpoint.x, runtime.commandSetpoint.y, runtime.commandSetpoint.z]
      : [],
    debug_drag_mode: runtime.debugDragMode ?? "",
    debug_pointer_downs: Number(runtime.debugPointerDowns ?? 0),
    debug_pointer_moves: Number(runtime.debugPointerMoves ?? 0),
    display_fps: Number(runtime.displayFps ?? 0.0),
    last_step_wall_ms: Number(runtime.lastStepWallMs ?? 0.0),
    avg_step_wall_ms: Number(runtime.avgStepWallMs ?? 0.0),
    last_policy_wall_ms: Number(runtime.lastPolicyWallMs ?? 0.0),
    avg_policy_wall_ms: Number(runtime.avgPolicyWallMs ?? 0.0),
    last_physics_wall_ms: Number(runtime.lastPhysicsWallMs ?? 0.0),
    avg_physics_wall_ms: Number(runtime.avgPhysicsWallMs ?? 0.0),
    last_overlay_wall_ms: Number(runtime.lastOverlayWallMs ?? 0.0),
    avg_overlay_wall_ms: Number(runtime.avgOverlayWallMs ?? 0.0),
  };
  if (includeMeshAssets) {
    report.mesh_assets = collectMeshAssets(runtime);
  }
  return report;
}

async function createRustRoboticsMujocoRuntime(
  fileEntries,
  policyBytes,
  mujocoWasmBasePath,
  ortWasmBasePath,
  config,
) {
  const mujoco = await getRustRoboticsMujocoModule(mujocoWasmBasePath);
  const ort = await configureRustRoboticsOrt(ortWasmBasePath);
  const ortSession = await ort.InferenceSession.create(policyBytes, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });

  writeWorkingFiles(mujoco, fileEntries);

  const model = mujoco.MjModel.mj_loadXML("/working/scene.xml");
  const data = new mujoco.MjData(model);
  if (model.nkey > 0) {
    mujoco.mj_resetDataKeyframe(model, data, 0);
  } else {
    mujoco.mj_resetData(model, data);
  }
  mujoco.mj_forward(model, data);

  const jointQposAdr = [];
  const jointQvelAdr = [];
  const ctrlAdr = [];
  for (const jointName of config.joint_names) {
    const joint = model.jnt(jointName);
    const actuator = model.actuator(stripJointSuffix(jointName));
    jointQposAdr.push(Number(joint.qposadr));
    jointQvelAdr.push(Number(joint.dofadr));
    ctrlAdr.push(Number(actuator.id));
    maybeDelete(joint);
    maybeDelete(actuator);
  }

  const outputNameMap = buildOutputNameMap(config.output_keys, Array.from(ortSession.outputNames));
  const inputNameMap = buildInputNameMap(config.input_keys, Array.from(ortSession.inputNames));
  const actionOutputName = outputNameMap.get("action");
  const nextHxOutputName = outputNameMap.get("next.adapt_hx");
  if (!actionOutputName || !nextHxOutputName) {
    throw new Error("ONNX output mapping is missing action or next.adapt_hx");
  }
  if (!inputNameMap.policy || !inputNameMap.is_init || !inputNameMap.adapt_hx || !inputNameMap.command) {
    throw new Error("ONNX input mapping is missing policy/is_init/adapt_hx/command");
  }

  const timestep = Number(model.opt.timestep);
  const decimation = Math.max(1, Math.round(0.02 / timestep));
  rustRoboticsMujocoRuntime = {
    mujoco,
    model,
    data,
    ortSession,
    config,
    jointQposAdr,
    jointQvelAdr,
    ctrlAdr,
    policyInputNames: Array.from(ortSession.inputNames),
    policyOutputNames: Array.from(ortSession.outputNames),
    inputNameMap,
    actionOutputName,
    nextHxOutputName,
    lastActions: new Float32Array(12),
    actionHistory: [new Float32Array(12), new Float32Array(12), new Float32Array(12)],
    gravityHistory: [
      Float32Array.from([0.0, 0.0, -1.0]),
      Float32Array.from([0.0, 0.0, -1.0]),
      Float32Array.from([0.0, 0.0, -1.0]),
    ],
    jointPosHistory: [new Float32Array(12), new Float32Array(12), new Float32Array(12)],
    jointVelHistory: [new Float32Array(12), new Float32Array(12), new Float32Array(12)],
    adaptHx: new Float32Array(128),
    isInit: true,
    timestep,
    decimation,
    mujocoTimeMs: 0.0,
    stepCount: 0,
    commandVelX: 0.0,
    commandVelY: 0.0,
    useSetpointBall: true,
    commandMode: config.command_mode ?? "velocity",
    commandDim: Number(config.command_dim) || 16,
    impedanceKp: 24.0,
    debugDragMode: "",
    debugPointerDowns: 0,
    debugPointerMoves: 0,
    displayFps: 0.0,
    lastFrameTimeMs: 0.0,
    lastStepWallMs: 0.0,
    avgStepWallMs: 0.0,
    lastPolicyWallMs: 0.0,
    avgPolicyWallMs: 0.0,
    lastPhysicsWallMs: 0.0,
    avgPhysicsWallMs: 0.0,
    lastOverlayWallMs: 0.0,
    avgOverlayWallMs: 0.0,
  };
  syncCommandSetpointFromCommand(rustRoboticsMujocoRuntime);
  rustRoboticsMujocoRuntime.visualGeomMeta = collectVisualGeomMeta(rustRoboticsMujocoRuntime);
  rustRoboticsMujocoRuntime.visualGeomState = createVisualGeomState(rustRoboticsMujocoRuntime.visualGeomMeta);
  const initialMeshAssets = collectMeshAssets(rustRoboticsMujocoRuntime);
  rustRoboticsMujocoRuntime.meshAssets = convertBrowserMeshAssets(initialMeshAssets);
  const initialReport = buildMujocoReport(rustRoboticsMujocoRuntime, true);
  rustRoboticsMujocoRuntime.lastReport = {
    ...initialReport,
    mesh_assets: [],
  };
  requestMujocoOverlayRender();
  return rustRoboticsMujocoRuntime;
}

export async function rustRoboticsMujocoInit(
  fileEntries,
  policyBytes,
  mujocoWasmBasePath,
  ortWasmBasePath,
  config,
) {
  if (!rustRoboticsMujocoInitPromise) {
    rustRoboticsMujocoInitPromise = createRustRoboticsMujocoRuntime(
      fileEntries,
      policyBytes,
      mujocoWasmBasePath,
      ortWasmBasePath,
      config,
    ).catch((error) => {
      rustRoboticsMujocoInitPromise = null;
      rustRoboticsMujocoRuntime = null;
      throw error;
    });
  }
  const runtime = await rustRoboticsMujocoInitPromise;
  return {
    ...runtime.lastReport,
    mesh_assets: collectMeshAssets(runtime),
  };
}

export async function rustRoboticsMujocoStep(stepCount, commandVelX, commandVelY, useSetpointBall) {
  if (!rustRoboticsMujocoRuntime) {
    throw new Error("MuJoCo runtime is not initialized");
  }

  const runtime = rustRoboticsMujocoRuntime;
  const steps = Math.max(1, Number(stepCount) || 1);
  runtime.commandVelX = Number(commandVelX) || 0.0;
  runtime.commandVelY = Number(commandVelY) || 0.0;
  runtime.useSetpointBall =
    runtime.commandMode === "impedance" ? true : Boolean(useSetpointBall);
  if (!runtime.useSetpointBall) {
    syncCommandSetpointFromCommand(runtime);
  }
  const stepStart = performance.now();
  let policyTotalMs = 0.0;
  let physicsTotalMs = 0.0;
  for (let i = 0; i < steps; ++i) {
    if (runtime.useSetpointBall) {
      updateCommandFromSetpoint(runtime);
    }
    const policyStart = performance.now();
    updatePolicyInput(runtime);
    await runPolicy(runtime, runtime.commandVelX, runtime.commandVelY);
    policyTotalMs += performance.now() - policyStart;

    const physicsStart = performance.now();
    for (let j = 0; j < runtime.decimation; ++j) {
      applyControl(runtime);
      runtime.mujoco.mj_step(runtime.model, runtime.data);
      runtime.mujocoTimeMs += runtime.timestep * 1000.0;
    }
    physicsTotalMs += performance.now() - physicsStart;
  }
  runtime.stepCount += steps;
  const stepWallMs = performance.now() - stepStart;
  runtime.lastStepWallMs = stepWallMs;
  runtime.avgStepWallMs = runtime.avgStepWallMs > 0.0 ? runtime.avgStepWallMs * 0.9 + stepWallMs * 0.1 : stepWallMs;
  runtime.lastPolicyWallMs = policyTotalMs;
  runtime.avgPolicyWallMs = runtime.avgPolicyWallMs > 0.0 ? runtime.avgPolicyWallMs * 0.9 + policyTotalMs * 0.1 : policyTotalMs;
  runtime.lastPhysicsWallMs = physicsTotalMs;
  runtime.avgPhysicsWallMs =
    runtime.avgPhysicsWallMs > 0.0 ? runtime.avgPhysicsWallMs * 0.9 + physicsTotalMs * 0.1 : physicsTotalMs;
  runtime.lastReport = buildMujocoReport(runtime, false);
  requestMujocoOverlayRender();
  return runtime.lastReport;
}

export function rustRoboticsMujocoConfigureViewport(config) {
  const overlay = ensureMujocoOverlay();
  const visible = Boolean(config?.visible);
  const diagnosticColors = Boolean(config?.diagnostic_colors);
  const left = Math.max(0, Number(config?.left) || 0);
  const top = Math.max(0, Number(config?.top) || 0);
  const width = Math.max(2, Number(config?.width) || 2);
  const height = Math.max(2, Number(config?.height) || 2);
  const pixelsPerPoint = Math.max(1, Number(config?.pixels_per_point) || 1);
  const widthPx = Math.max(2, Math.round(width * pixelsPerPoint));
  const heightPx = Math.max(2, Math.round(height * pixelsPerPoint));
  const changed =
    overlay.visible !== visible ||
    overlay.diagnosticColors !== diagnosticColors ||
    overlay.left !== left ||
    overlay.top !== top ||
    overlay.width !== width ||
    overlay.height !== height ||
    overlay.widthPx !== widthPx ||
    overlay.heightPx !== heightPx;

  overlay.visible = visible;
  overlay.diagnosticColors = diagnosticColors;

  if (!overlay.visible) {
    overlay.canvas.style.display = "none";
    return;
  }
  overlay.left = left;
  overlay.top = top;
  overlay.width = width;
  overlay.height = height;
  overlay.widthPx = widthPx;
  overlay.heightPx = heightPx;

  overlay.canvas.style.display = "block";
  overlay.canvas.style.left = `${left}px`;
  overlay.canvas.style.top = `${top}px`;
  overlay.canvas.style.width = `${width}px`;
  overlay.canvas.style.height = `${height}px`;
  if (overlay.canvas.width !== widthPx) {
    overlay.canvas.width = widthPx;
  }
  if (overlay.canvas.height !== heightPx) {
    overlay.canvas.height = heightPx;
  }

  if (!overlay.cameraInitialized && rustRoboticsMujocoRuntime) {
    fitOverlayCameraToGeoms(overlay.camera, collectGeomSnapshots(rustRoboticsMujocoRuntime));
    overlay.cameraInitialized = true;
  }

  if (changed) {
    requestMujocoOverlayRender();
  }
}

export function rustRoboticsMujocoResetViewportCamera() {
  const overlay = ensureMujocoOverlay();
  overlay.camera = defaultOverlayCamera();
  overlay.cameraInitialized = false;
  if (rustRoboticsMujocoRuntime) {
    fitOverlayCameraToGeoms(overlay.camera, collectGeomSnapshots(rustRoboticsMujocoRuntime));
    overlay.cameraInitialized = true;
  }
  requestMujocoOverlayRender();
}

export function rustRoboticsMujocoReset() {
  if (rustRoboticsMujocoRuntime) {
    maybeDelete(rustRoboticsMujocoRuntime.data);
    maybeDelete(rustRoboticsMujocoRuntime.model);
  }
  rustRoboticsMujocoRuntime = null;
  rustRoboticsMujocoInitPromise = null;
  if (rustRoboticsMujocoOverlay) {
    rustRoboticsMujocoOverlay.camera = defaultOverlayCamera();
    rustRoboticsMujocoOverlay.cameraInitialized = false;
    rustRoboticsMujocoOverlay.needsRender = true;
  }
}

function ensureMujocoOverlay() {
  if (rustRoboticsMujocoOverlay) {
    return rustRoboticsMujocoOverlay;
  }

  const canvas = document.createElement("canvas");
  canvas.id = "rust-robotics-mujoco-overlay";
  Object.assign(canvas.style, {
    position: "absolute",
    display: "none",
    pointerEvents: "auto",
    zIndex: "20",
    background: "#12161c",
    borderRadius: "6px",
    touchAction: "none",
  });
  document.body.appendChild(canvas);

  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: true,
    depth: true,
    stencil: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) {
    throw new Error("Failed to create WebGL2 context for MuJoCo overlay");
  }

  const renderer = createOverlayRenderer(gl);
  const overlay = {
    canvas,
    gl,
    renderer,
    visible: false,
    diagnosticColors: false,
    camera: defaultOverlayCamera(),
    cameraInitialized: false,
    rafHandle: 0,
    lastPointer: null,
    dragButton: null,
    dragMode: null,
    setpointGrabDistance: 0.0,
    setpointDragStart: null,
    needsRender: true,
    lastRenderMs: 0,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    widthPx: 0,
    heightPx: 0,
  };

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("dblclick", (event) => {
    event.preventDefault();
    overlay.camera = defaultOverlayCamera();
    overlay.cameraInitialized = false;
    if (rustRoboticsMujocoRuntime) {
      fitOverlayCameraToGeoms(overlay.camera, collectGeomSnapshots(rustRoboticsMujocoRuntime));
      overlay.cameraInitialized = true;
    }
    requestMujocoOverlayRender();
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!overlay.visible) {
        return;
      }
      event.preventDefault();
      const zoom = clamp(1.0 - event.deltaY * 0.0015, 0.8, 1.25);
      overlay.camera.distance = clamp(overlay.camera.distance * zoom, 0.35, 40.0);
      requestMujocoOverlayRender();
    },
    { passive: false },
  );
  canvas.addEventListener("pointerdown", (event) => {
    if (!overlay.visible) {
      return;
    }
    overlay.lastPointer = { x: event.clientX, y: event.clientY };
    overlay.dragButton = event.button;
    overlay.dragMode = null;
    if (event.button === 0 && rustRoboticsMujocoRuntime) {
      const runtime = rustRoboticsMujocoRuntime;
      runtime.debugPointerDowns = (runtime.debugPointerDowns ?? 0) + 1;
      if (runtime.useSetpointBall) {
        const setpoint = [
          runtime.commandSetpoint.x,
          runtime.commandSetpoint.y,
          runtime.commandSetpoint.z,
        ];
        overlay.setpointGrabDistance = distance3(cameraEye(overlay.camera), setpoint);
        overlay.dragMode = "setpoint";
        runtime.debugDragMode = "setpoint";
        overlay.setpointDragStart = {
          clientX: event.clientX,
          clientY: event.clientY,
          setpoint: {
            x: runtime.commandSetpoint.x,
            y: runtime.commandSetpoint.y,
            z: runtime.commandSetpoint.z,
          },
        };
        requestMujocoOverlayRender();
      } else if (isPointerOnCommandBall(overlay, event, runtime)) {
        const setpoint = [
          runtime.commandSetpoint.x,
          runtime.commandSetpoint.y,
          runtime.commandSetpoint.z,
        ];
        overlay.setpointGrabDistance = distance3(cameraEye(overlay.camera), setpoint);
        overlay.dragMode = "setpoint";
        runtime.debugDragMode = "setpoint";
        overlay.setpointDragStart = {
          clientX: event.clientX,
          clientY: event.clientY,
          setpoint: {
            x: runtime.commandSetpoint.x,
            y: runtime.commandSetpoint.y,
            z: runtime.commandSetpoint.z,
          },
        };
        requestMujocoOverlayRender();
      }
    }
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!overlay.visible || overlay.lastPointer == null) {
      return;
    }
    const dx = event.clientX - overlay.lastPointer.x;
    const dy = event.clientY - overlay.lastPointer.y;
    overlay.lastPointer = { x: event.clientX, y: event.clientY };
    if (rustRoboticsMujocoRuntime) {
      rustRoboticsMujocoRuntime.debugPointerMoves =
        (rustRoboticsMujocoRuntime.debugPointerMoves ?? 0) + 1;
    }

    if (overlay.dragMode === "setpoint" && rustRoboticsMujocoRuntime) {
      rustRoboticsMujocoRuntime.debugDragMode = "setpoint";
      updateCommandSetpointFromDragRay(overlay, event, rustRoboticsMujocoRuntime);
    } else if (overlay.dragButton === 0) {
      if (rustRoboticsMujocoRuntime) {
        rustRoboticsMujocoRuntime.debugDragMode = "orbit";
      }
      overlay.camera.azimuthDeg -= dx * 0.25;
      overlay.camera.elevationDeg = clamp(overlay.camera.elevationDeg + dy * 0.2, -89.0, 89.0);
    } else if (overlay.dragButton === 2) {
      if (rustRoboticsMujocoRuntime) {
        rustRoboticsMujocoRuntime.debugDragMode = "pan";
      }
      const forward = orbitForward(overlay.camera.azimuthDeg, overlay.camera.elevationDeg);
      const right = normalize3(cross3(forward, [0.0, 0.0, 1.0]));
      const up = normalize3(cross3(right, forward));
      const panScale = overlay.camera.distance * 0.0025;
      overlay.camera.target = sub3(
        overlay.camera.target,
        scale3(add3(scale3(right, dx), scale3(up, dy)), panScale),
      );
    }

    requestMujocoOverlayRender();
  });
  canvas.addEventListener("pointerup", (event) => {
    overlay.lastPointer = null;
    overlay.dragButton = null;
    overlay.dragMode = null;
    overlay.setpointDragStart = null;
    if (rustRoboticsMujocoRuntime) {
      rustRoboticsMujocoRuntime.debugDragMode = "released";
    }
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch (_) {}
  });
  canvas.addEventListener("pointercancel", () => {
    overlay.lastPointer = null;
    overlay.dragButton = null;
    overlay.dragMode = null;
    overlay.setpointDragStart = null;
    if (rustRoboticsMujocoRuntime) {
      rustRoboticsMujocoRuntime.debugDragMode = "cancel";
    }
  });

  rustRoboticsMujocoOverlay = overlay;
  return overlay;
}

function ensureMujocoOverlayLoop() {
  const overlay = ensureMujocoOverlay();
  if (overlay.rafHandle !== 0) {
    return;
  }

  const tick = (now) => {
    overlay.rafHandle = 0;
    if (!overlay.visible) {
      return;
    }
    if (!overlay.needsRender) {
      return;
    }
    const minFrameMs = 1000.0 / 60.0;
    if (now - overlay.lastRenderMs < minFrameMs) {
      overlay.rafHandle = window.requestAnimationFrame(tick);
      return;
    }
    renderMujocoOverlay(now);
    if (overlay.needsRender) {
      overlay.rafHandle = window.requestAnimationFrame(tick);
    }
  };

  overlay.rafHandle = window.requestAnimationFrame(tick);
}

function requestMujocoOverlayRender() {
  if (rustRoboticsMujocoOverlay) {
    rustRoboticsMujocoOverlay.needsRender = true;
    ensureMujocoOverlayLoop();
  }
}

function renderMujocoOverlay(now) {
  const overlay = ensureMujocoOverlay();
  if (!overlay.visible || !overlay.needsRender) {
    return;
  }
  const runtime = rustRoboticsMujocoRuntime;
  const gl = overlay.gl;
  gl.viewport(0, 0, overlay.canvas.width, overlay.canvas.height);
  gl.clearColor(0.07, 0.09, 0.12, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (!runtime?.lastReport || !runtime.meshAssets?.length) {
    return;
  }

  const geoms = collectGeomSnapshots(runtime);

  if (!overlay.cameraInitialized && geoms.length) {
    fitOverlayCameraToGeoms(overlay.camera, geoms);
    overlay.cameraInitialized = true;
  }

  const renderStart = performance.now();
  const scene = buildOverlaySceneFrame(
    geoms,
    runtime.meshAssets,
    overlay.canvas.width / Math.max(1, overlay.canvas.height),
    overlay.camera,
    overlay.diagnosticColors,
    runtime,
  );
  paintOverlayScene(overlay.renderer, gl, scene);
  overlay.needsRender = false;
  overlay.lastRenderMs = now ?? performance.now();
  const overlayWallMs = performance.now() - renderStart;
  runtime.lastOverlayWallMs = overlayWallMs;
  runtime.avgOverlayWallMs =
    runtime.avgOverlayWallMs > 0.0 ? runtime.avgOverlayWallMs * 0.9 + overlayWallMs * 0.1 : overlayWallMs;
  const frameNow = performance.now();
  if (runtime.lastFrameTimeMs > 0.0) {
    const instantFps = 1000.0 / Math.max(1.0, frameNow - runtime.lastFrameTimeMs);
    runtime.displayFps = runtime.displayFps > 0.0 ? runtime.displayFps * 0.9 + instantFps * 0.1 : instantFps;
  }
  runtime.lastFrameTimeMs = frameNow;
}

function createOverlayRenderer(gl) {
  const program = createWebGlProgram(gl, OVERLAY_VERTEX_SHADER, OVERLAY_FRAGMENT_SHADER);
  const triangleVao = gl.createVertexArray();
  const triangleVbo = gl.createBuffer();
  const lineVao = gl.createVertexArray();
  const lineVbo = gl.createBuffer();
  const uViewProj = gl.getUniformLocation(program, "u_view_proj");
  const uUnlit = gl.getUniformLocation(program, "u_unlit");
  const uModel = gl.getUniformLocation(program, "u_model");
  const uNormalMat = gl.getUniformLocation(program, "u_normal_mat");
  const uTint = gl.getUniformLocation(program, "u_tint");

  setupOverlayVertexArray(gl, triangleVao, triangleVbo);
  setupOverlayVertexArray(gl, lineVao, lineVbo);

  return {
    program,
    triangleVao,
    triangleVbo,
    lineVao,
    lineVbo,
    uViewProj,
    uUnlit,
    uModel,
    uNormalMat,
    uTint,
    meshBuffers: [],
  };
}

function setupOverlayVertexArray(gl, vao, vbo) {
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  const stride = 10 * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 6 * 4);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function paintOverlayScene(renderer, gl, scene) {
  ensureOverlayMeshBuffers(renderer, gl, rustRoboticsMujocoRuntime?.meshAssets ?? []);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.useProgram(renderer.program);
  gl.uniformMatrix4fv(renderer.uViewProj, false, scene.viewProj);
  gl.uniformMatrix4fv(renderer.uModel, false, IDENTITY_MAT4);
  gl.uniformMatrix3fv(renderer.uNormalMat, false, IDENTITY_MAT3);
  gl.uniform4fv(renderer.uTint, WHITE_TINT);

  if (scene.triangles.length > 0) {
    gl.uniform1i(renderer.uUnlit, 0);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.bindVertexArray(renderer.triangleVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, renderer.triangleVbo);
    gl.bufferData(gl.ARRAY_BUFFER, scene.triangles, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, scene.triangles.length / 10);
    gl.disable(gl.CULL_FACE);
  }

  if (scene.lines.length > 0) {
    gl.uniform1i(renderer.uUnlit, 1);
    gl.bindVertexArray(renderer.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, renderer.lineVbo);
    gl.bufferData(gl.ARRAY_BUFFER, scene.lines, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.LINES, 0, scene.lines.length / 10);
  }

  if (scene.meshDraws.length > 0) {
    gl.uniform1i(renderer.uUnlit, 0);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    for (const draw of scene.meshDraws) {
      const meshBuffer = renderer.meshBuffers[draw.meshId];
      if (!meshBuffer) {
        continue;
      }
      gl.uniformMatrix4fv(renderer.uModel, false, draw.modelMat);
      gl.uniformMatrix3fv(renderer.uNormalMat, false, draw.normalMat);
      gl.uniform4fv(renderer.uTint, draw.tint);
      gl.bindVertexArray(meshBuffer.vao);
      gl.drawArrays(gl.TRIANGLES, 0, meshBuffer.vertexCount);
    }
    gl.disable(gl.CULL_FACE);
  }

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.useProgram(null);
}

function buildOverlaySceneFrame(geoms, meshAssets, aspect, camera, diagnosticColors, runtime = null) {
  const triangles = [];
  const lines = [];
  const meshDraws = [];
  appendGridLines(lines);
  for (const geom of geoms) {
    switch (geom.type_id) {
      case 0:
        break;
      case 2:
        appendSphereGeom(triangles, geom, 12, 20, diagnosticColors);
        break;
      case 3:
        appendCapsuleGeom(triangles, geom, 10, 18, diagnosticColors);
        break;
      case 5:
        appendCylinderGeom(triangles, geom, 18, diagnosticColors);
        break;
      case 6:
        appendBoxGeom(triangles, geom, diagnosticColors);
        break;
      case 7:
        appendMeshDraw(meshDraws, geom, meshAssets, diagnosticColors);
        break;
      case 9:
        appendLineGeom(lines, geom, diagnosticColors);
        break;
      default:
        break;
    }
  }
  if (runtime?.commandSetpoint) {
    appendCommandSetpointMarker(triangles, lines, runtime);
  }
  return {
    triangles: new Float32Array(triangles),
    lines: new Float32Array(lines),
    meshDraws,
    viewProj: new Float32Array(viewProjectionMatrix(camera, Math.max(0.1, aspect))),
  };
}

function appendCommandSetpointMarker(triangles, lines, runtime) {
  const basePos = basePosition(runtime);
  const ballGeom = {
    type_id: 2,
    dataid: -1,
    size: [COMMAND_BALL_RADIUS, 0.0, 0.0],
    rgba: runtime.useSetpointBall ? [0.94, 0.27, 0.27, 1.0] : [0.94, 0.55, 0.27, 1.0],
    pos: [runtime.commandSetpoint.x, runtime.commandSetpoint.y, runtime.commandSetpoint.z],
    mat: [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0],
  };
  appendSphereGeom(triangles, ballGeom, 10, 16, false);
  pushLine(
    lines,
    [basePos[0], basePos[1], COMMAND_BALL_HEIGHT],
    [runtime.commandSetpoint.x, runtime.commandSetpoint.y, runtime.commandSetpoint.z],
    runtime.useSetpointBall ? [0.95, 0.55, 0.55, 1.0] : [0.95, 0.72, 0.55, 1.0],
  );
}

function appendGridLines(lines) {
  const color = [0.22, 0.28, 0.34, 1.0];
  for (let i = -16; i <= 16; ++i) {
    const offset = i * 0.25;
    pushLine(lines, [-4.0, offset, 0.0], [4.0, offset, 0.0], color);
    pushLine(lines, [offset, -4.0, 0.0], [offset, 4.0, 0.0], color);
  }
}

function appendLineGeom(lines, geom, diagnosticColors) {
  const axes = geomAxes(geom);
  const half = scale3(axes[2], Math.max(geom.size[1], 0.02));
  const a = sub3(geom.pos, half);
  const b = add3(geom.pos, half);
  pushLine(lines, a, b, displayGeomColor(geom, diagnosticColors));
}

function appendBoxGeom(triangles, geom, diagnosticColors) {
  const axes = geomAxes(geom);
  const [sx, sy, sz] = geom.size;
  const corners = [
    transformGeomPoint(geom, [sx, sy, sz]),
    transformGeomPoint(geom, [sx, sy, -sz]),
    transformGeomPoint(geom, [sx, -sy, sz]),
    transformGeomPoint(geom, [sx, -sy, -sz]),
    transformGeomPoint(geom, [-sx, sy, sz]),
    transformGeomPoint(geom, [-sx, sy, -sz]),
    transformGeomPoint(geom, [-sx, -sy, sz]),
    transformGeomPoint(geom, [-sx, -sy, -sz]),
  ];
  const color = displayGeomColor(geom, diagnosticColors);
  const faces = [
    [[0, 2, 3, 1], axes[0]],
    [[4, 5, 7, 6], scale3(axes[0], -1.0)],
    [[0, 1, 5, 4], axes[1]],
    [[2, 6, 7, 3], scale3(axes[1], -1.0)],
    [[0, 4, 6, 2], axes[2]],
    [[1, 3, 7, 5], scale3(axes[2], -1.0)],
  ];
  for (const [indices, normal] of faces) {
    const n = normalize3(normal);
    pushTriangle(triangles, corners[indices[0]], corners[indices[1]], corners[indices[2]], n, color);
    pushTriangle(triangles, corners[indices[0]], corners[indices[2]], corners[indices[3]], n, color);
  }
}

function appendCylinderGeom(triangles, geom, segments, diagnosticColors) {
  const color = displayGeomColor(geom, diagnosticColors);
  const half = Math.max(geom.size[1], 0.01);
  const radius = Math.max(geom.size[0], 0.01);
  for (let i = 0; i < segments; ++i) {
    const a0 = (i / segments) * Math.PI * 2.0;
    const a1 = ((i + 1) / segments) * Math.PI * 2.0;
    const p0 = [radius * Math.cos(a0), radius * Math.sin(a0), -half];
    const p1 = [radius * Math.cos(a1), radius * Math.sin(a1), -half];
    const p2 = [radius * Math.cos(a1), radius * Math.sin(a1), half];
    const p3 = [radius * Math.cos(a0), radius * Math.sin(a0), half];

    const w0 = transformGeomPoint(geom, p0);
    const w1 = transformGeomPoint(geom, p1);
    const w2 = transformGeomPoint(geom, p2);
    const w3 = transformGeomPoint(geom, p3);
    const n0 = transformGeomVector(geom, normalize3([Math.cos(a0), Math.sin(a0), 0.0]));
    const n1 = transformGeomVector(geom, normalize3([Math.cos(a1), Math.sin(a1), 0.0]));
    const nMid = normalize3(add3(n0, n1));

    pushTriangle(triangles, w0, w1, w2, nMid, color);
    pushTriangle(triangles, w0, w2, w3, nMid, color);

    const topCenter = transformGeomPoint(geom, [0.0, 0.0, half]);
    const bottomCenter = transformGeomPoint(geom, [0.0, 0.0, -half]);
    pushTriangle(triangles, topCenter, w3, w2, transformGeomVector(geom, [0.0, 0.0, 1.0]), color);
    pushTriangle(triangles, bottomCenter, w1, w0, transformGeomVector(geom, [0.0, 0.0, -1.0]), color);
  }
}

function appendCapsuleGeom(triangles, geom, hemiRings, segments, diagnosticColors) {
  appendCylinderGeom(triangles, geom, segments, diagnosticColors);
  const radius = Math.max(geom.size[0], 0.01);
  const half = Math.max(geom.size[1], 0.01);
  const color = displayGeomColor(geom, diagnosticColors);
  for (const hemisphere of [-1.0, 1.0]) {
    for (let ring = 0; ring < hemiRings; ++ring) {
      const v0 = (ring / hemiRings) * (Math.PI / 2.0);
      const v1 = ((ring + 1) / hemiRings) * (Math.PI / 2.0);
      const z0 = hemisphere * (half + radius * Math.sin(v0));
      const z1 = hemisphere * (half + radius * Math.sin(v1));
      const r0 = radius * Math.cos(v0);
      const r1 = radius * Math.cos(v1);

      for (let seg = 0; seg < segments; ++seg) {
        const a0 = (seg / segments) * Math.PI * 2.0;
        const a1 = ((seg + 1) / segments) * Math.PI * 2.0;
        const p00 = [r0 * Math.cos(a0), r0 * Math.sin(a0), z0];
        const p01 = [r0 * Math.cos(a1), r0 * Math.sin(a1), z0];
        const p10 = [r1 * Math.cos(a0), r1 * Math.sin(a0), z1];
        const p11 = [r1 * Math.cos(a1), r1 * Math.sin(a1), z1];
        const n00 = transformGeomVector(geom, normalize3([p00[0], p00[1], hemisphere * (p00[2] - hemisphere * half)]));
        const n01 = transformGeomVector(geom, normalize3([p01[0], p01[1], hemisphere * (p01[2] - hemisphere * half)]));
        const n10 = transformGeomVector(geom, normalize3([p10[0], p10[1], hemisphere * (p10[2] - hemisphere * half)]));
        const n11 = transformGeomVector(geom, normalize3([p11[0], p11[1], hemisphere * (p11[2] - hemisphere * half)]));

        pushTriangle(
          triangles,
          transformGeomPoint(geom, p00),
          transformGeomPoint(geom, p01),
          transformGeomPoint(geom, p11),
          normalize3(add3(add3(n00, n01), n11)),
          color,
        );
        pushTriangle(
          triangles,
          transformGeomPoint(geom, p00),
          transformGeomPoint(geom, p11),
          transformGeomPoint(geom, p10),
          normalize3(add3(add3(n00, n11), n10)),
          color,
        );
      }
    }
  }
}

function appendSphereGeom(triangles, geom, rings, segments, diagnosticColors) {
  const radius = Math.max(geom.size[0], 0.01);
  const color = displayGeomColor(geom, diagnosticColors);
  for (let ring = 0; ring < rings; ++ring) {
    const v0 = (ring / rings) * Math.PI - Math.PI / 2.0;
    const v1 = ((ring + 1) / rings) * Math.PI - Math.PI / 2.0;
    const z0 = radius * Math.sin(v0);
    const z1 = radius * Math.sin(v1);
    const r0 = radius * Math.cos(v0);
    const r1 = radius * Math.cos(v1);
    for (let seg = 0; seg < segments; ++seg) {
      const a0 = (seg / segments) * Math.PI * 2.0;
      const a1 = ((seg + 1) / segments) * Math.PI * 2.0;
      const p00 = [r0 * Math.cos(a0), r0 * Math.sin(a0), z0];
      const p01 = [r0 * Math.cos(a1), r0 * Math.sin(a1), z0];
      const p10 = [r1 * Math.cos(a0), r1 * Math.sin(a0), z1];
      const p11 = [r1 * Math.cos(a1), r1 * Math.sin(a1), z1];
      pushTriangle(
        triangles,
        transformGeomPoint(geom, p00),
        transformGeomPoint(geom, p01),
        transformGeomPoint(geom, p11),
        normalize3(transformGeomVector(geom, normalize3(add3(add3(p00, p01), p11)))),
        color,
      );
      pushTriangle(
        triangles,
        transformGeomPoint(geom, p00),
        transformGeomPoint(geom, p11),
        transformGeomPoint(geom, p10),
        normalize3(transformGeomVector(geom, normalize3(add3(add3(p00, p11), p10)))),
        color,
      );
    }
  }
}

function appendMeshDraw(meshDraws, geom, meshAssets, diagnosticColors) {
  const meshId = Math.max(0, geom.dataid | 0);
  const mesh = meshAssets[meshId];
  if (!mesh) {
    return;
  }
  meshDraws.push({
    meshId,
    modelMat: new Float32Array(modelMatrixFromGeom(geom)),
    normalMat: new Float32Array(normalMatrixFromGeom(geom)),
    tint: new Float32Array(displayGeomColor(geom, diagnosticColors)),
  });
}

function convertBrowserMeshAssets(meshes) {
  return meshes.map((mesh) => {
    const vertexData = [];
    const vertnum = Math.floor(mesh.positions.length / 3);
    for (let i = 0; i + 2 < mesh.faces.length; i += 3) {
      const ia = mesh.faces[i];
      const ib = mesh.faces[i + 1];
      const ic = mesh.faces[i + 2];
      if (ia >= vertnum || ib >= vertnum || ic >= vertnum) {
        continue;
      }
      const a = readVec3(mesh.positions, ia);
      const b = readVec3(mesh.positions, ib);
      const c = readVec3(mesh.positions, ic);
      const faceNormal = triangleNormal(a, b, c);
      pushVertex(
        vertexData,
        a,
        mesh.normals.length >= (ia + 1) * 3 ? normalize3(readVec3(mesh.normals, ia)) : faceNormal,
        WHITE_COLOR,
      );
      pushVertex(
        vertexData,
        b,
        mesh.normals.length >= (ib + 1) * 3 ? normalize3(readVec3(mesh.normals, ib)) : faceNormal,
        WHITE_COLOR,
      );
      pushVertex(
        vertexData,
        c,
        mesh.normals.length >= (ic + 1) * 3 ? normalize3(readVec3(mesh.normals, ic)) : faceNormal,
        WHITE_COLOR,
      );
    }
    return {
      vertexData: new Float32Array(vertexData),
      vertexCount: vertexData.length / 10,
    };
  });
}

function ensureOverlayMeshBuffers(renderer, gl, meshAssets) {
  if (renderer.meshBuffers.length === meshAssets.length && renderer.meshBuffers.length > 0) {
    return;
  }

  for (const buffer of renderer.meshBuffers) {
    if (!buffer) {
      continue;
    }
    gl.deleteBuffer(buffer.vbo);
    gl.deleteVertexArray(buffer.vao);
  }
  renderer.meshBuffers = [];

  for (const mesh of meshAssets) {
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    setupOverlayVertexArray(gl, vao, vbo);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertexData, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    renderer.meshBuffers.push({
      vao,
      vbo,
      vertexCount: mesh.vertexCount,
    });
  }
}

function readVec3(array, index) {
  return [array[index * 3], array[index * 3 + 1], array[index * 3 + 2]];
}

function readMat3(array, index) {
  const base = index * 9;
  return [
    array[base], array[base + 1], array[base + 2],
    array[base + 3], array[base + 4], array[base + 5],
    array[base + 6], array[base + 7], array[base + 8],
  ];
}

function defaultOverlayCamera() {
  return {
    azimuthDeg: 135.0,
    elevationDeg: -20.0,
    distance: 2.2,
    target: [0.0, 0.0, 0.35],
  };
}

function fitOverlayCameraToGeoms(camera, geoms) {
  if (!geoms?.length) {
    return;
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const geom of geoms) {
    const radius = Math.max(0.05, geom.size[0], geom.size[1], geom.size[2]);
    for (let axis = 0; axis < 3; ++axis) {
      min[axis] = Math.min(min[axis], geom.pos[axis] - radius);
      max[axis] = Math.max(max[axis], geom.pos[axis] + radius);
    }
  }
  camera.target = [
    (min[0] + max[0]) * 0.5,
    (min[1] + max[1]) * 0.5,
    (min[2] + max[2]) * 0.5,
  ];
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 0.5);
  camera.distance = Math.max(extent * 2.8, 1.5);
}

function viewProjectionMatrix(camera, aspect) {
  return mulMat4(projectionMatrix(aspect), viewMatrix(camera));
}

function viewMatrix(camera) {
  const eye = cameraEye(camera);
  const forward = normalize3(sub3(camera.target, eye));
  const worldUp = [0.0, 0.0, 1.0];
  const right = normalize3(cross3(forward, worldUp));
  const up = normalize3(cross3(right, forward));
  return [
    right[0], up[0], -forward[0], 0.0,
    right[1], up[1], -forward[1], 0.0,
    right[2], up[2], -forward[2], 0.0,
    -dot3(right, eye), -dot3(up, eye), dot3(forward, eye), 1.0,
  ];
}

function projectionMatrix(aspect) {
  const fovY = 45.0 * Math.PI / 180.0;
  const near = 0.02;
  const far = 50.0;
  const f = 1.0 / Math.tan(fovY * 0.5);
  return [
    f / aspect, 0.0, 0.0, 0.0,
    0.0, f, 0.0, 0.0,
    0.0, 0.0, -((far + near) / (far - near)), -1.0,
    0.0, 0.0, -((2.0 * far * near) / (far - near)), 0.0,
  ];
}

function cameraEye(camera) {
  return sub3(camera.target, scale3(orbitForward(camera.azimuthDeg, camera.elevationDeg), camera.distance));
}

function orbitForward(azimuthDeg, elevationDeg) {
  const azimuth = azimuthDeg * Math.PI / 180.0;
  const elevation = elevationDeg * Math.PI / 180.0;
  return normalize3([
    Math.cos(azimuth) * Math.cos(elevation),
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
  ]);
}

function projectPointToScreen(overlay, point) {
  const rect = overlay.canvas.getBoundingClientRect();
  const clip = mulMat4Vec4(viewProjectionMatrix(overlay.camera, Math.max(0.1, rect.width / Math.max(1.0, rect.height))), [
    point[0], point[1], point[2], 1.0,
  ]);
  if (Math.abs(clip[3]) <= 1e-6) {
    return null;
  }
  const ndcX = clip[0] / clip[3];
  const ndcY = clip[1] / clip[3];
  const ndcZ = clip[2] / clip[3];
  return {
    x: rect.left + (ndcX * 0.5 + 0.5) * rect.width,
    y: rect.top + (1.0 - (ndcY * 0.5 + 0.5)) * rect.height,
    z: ndcZ,
  };
}

function isPointerOnCommandBall(overlay, event, runtime) {
  const point = projectPointToScreen(overlay, [
    runtime.commandSetpoint.x,
    runtime.commandSetpoint.y,
    runtime.commandSetpoint.z,
  ]);
  if (!point) {
    return false;
  }
  const dx = event.clientX - point.x;
  const dy = event.clientY - point.y;
  return dx * dx + dy * dy <= 18.0 * 18.0;
}

function updateCommandSetpointFromPointer(overlay, event, runtime) {
  const hit = intersectPointerWithGround(overlay, event.clientX, event.clientY, COMMAND_BALL_HEIGHT);
  if (!hit) {
    return;
  }
  runtime.commandSetpoint.x = hit[0];
  runtime.commandSetpoint.y = hit[1];
  runtime.commandSetpoint.z = COMMAND_BALL_HEIGHT;
  if (runtime.useSetpointBall) {
    updateCommandFromSetpoint(runtime);
    runtime.lastReport = buildMujocoReport(runtime, false);
  }
}

function updateCommandSetpointFromScreenDelta(overlay, event, runtime) {
  const start = overlay.setpointDragStart;
  if (!start) {
    return;
  }
  const p0 = [start.setpoint.x, start.setpoint.y, COMMAND_BALL_HEIGHT];
  const s0 = projectPointToScreen(overlay, p0);
  const sx = projectPointToScreen(overlay, [p0[0] + 1.0, p0[1], p0[2]]);
  const sy = projectPointToScreen(overlay, [p0[0], p0[1] + 1.0, p0[2]]);
  if (!s0 || !sx || !sy) {
    return;
  }
  const a11 = sx.x - s0.x;
  const a21 = sx.y - s0.y;
  const a12 = sy.x - s0.x;
  const a22 = sy.y - s0.y;
  const det = a11 * a22 - a12 * a21;
  if (Math.abs(det) <= 1e-6) {
    return;
  }
  const dxScreen = event.clientX - start.clientX;
  const dyScreen = event.clientY - start.clientY;
  const invDet = 1.0 / det;
  const dxWorld = ( a22 * dxScreen - a12 * dyScreen) * invDet;
  const dyWorld = (-a21 * dxScreen + a11 * dyScreen) * invDet;
  runtime.commandSetpoint.x = start.setpoint.x + dxWorld;
  runtime.commandSetpoint.y = start.setpoint.y + dyWorld;
  runtime.commandSetpoint.z = COMMAND_BALL_HEIGHT;
  if (runtime.useSetpointBall) {
    updateCommandFromSetpoint(runtime);
    runtime.lastReport = buildMujocoReport(runtime, false);
  }
}

function updateCommandSetpointFromDragRay(overlay, event, runtime) {
  const distance = Math.max(0.1, overlay.setpointGrabDistance || 0.0);
  const point = pointOnPointerRayAtDistance(overlay, event.clientX, event.clientY, distance);
  if (!point) {
    return;
  }
  runtime.commandSetpoint.x = point[0];
  runtime.commandSetpoint.y = point[1];
  runtime.commandSetpoint.z = COMMAND_BALL_HEIGHT;
  if (runtime.useSetpointBall) {
    updateCommandFromSetpoint(runtime);
    runtime.lastReport = buildMujocoReport(runtime, false);
  }
}

function intersectPointerWithGround(overlay, clientX, clientY, planeZ) {
  const { origin, direction } = pointerRay(overlay, clientX, clientY);
  const denom = direction[2];
  if (Math.abs(denom) <= 1e-6) {
    return null;
  }
  const t = (planeZ - origin[2]) / denom;
  if (t <= 0.0) {
    return null;
  }
  return add3(origin, scale3(direction, t));
}

function pointOnPointerRayAtDistance(overlay, clientX, clientY, distance) {
  const { origin, direction } = pointerRay(overlay, clientX, clientY);
  return add3(origin, scale3(direction, distance));
}

function pointerRay(overlay, clientX, clientY) {
  const rect = overlay.canvas.getBoundingClientRect();
  const rectX = (clientX - rect.left) / Math.max(1.0, rect.width);
  const rectY = (clientY - rect.top) / Math.max(1.0, rect.height);
  const ndcX = rectX * 2.0 - 1.0;
  const ndcY = 1.0 - rectY * 2.0;
  const aspect = Math.max(0.1, rect.width / Math.max(1.0, rect.height));
  const invViewProj = invertMat4(viewProjectionMatrix(overlay.camera, aspect));
  if (!invViewProj) {
    const eye = cameraEye(overlay.camera);
    const forward = orbitForward(overlay.camera.azimuthDeg, overlay.camera.elevationDeg);
    return { origin: eye, direction: forward };
  }
  const near4 = mulMat4Vec4(invViewProj, [ndcX, ndcY, -1.0, 1.0]);
  const far4 = mulMat4Vec4(invViewProj, [ndcX, ndcY, 1.0, 1.0]);
  const near = perspectiveDivide(near4);
  const far = perspectiveDivide(far4);
  if (!near || !far) {
    const eye = cameraEye(overlay.camera);
    const forward = orbitForward(overlay.camera.azimuthDeg, overlay.camera.elevationDeg);
    return { origin: eye, direction: forward };
  }
  return {
    origin: near,
    direction: normalize3(sub3(far, near)),
  };
}

function geomColor(geom) {
  return [geom.rgba[0], geom.rgba[1], geom.rgba[2], 1.0];
}

function displayGeomColor(geom, diagnosticColors) {
  return diagnosticColors ? diagnosticGeomColor(geom) : geomColor(geom);
}

function diagnosticGeomColor(geom) {
  const seed =
    (((geom.dataid >>> 0) * 0x9e3779b9) >>> 0) +
    ((((geom.type_id >>> 0) * 0x85ebca6b) >>> 0) >>> 0);
  const hue = seed % 360;
  return hsvToRgb(hue, 0.72, 0.92);
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1.0 - Math.abs(((h / 60.0) % 2.0) - 1.0));
  const m = v - c;
  let rgb;
  if (h < 60.0) rgb = [c, x, 0.0];
  else if (h < 120.0) rgb = [x, c, 0.0];
  else if (h < 180.0) rgb = [0.0, c, x];
  else if (h < 240.0) rgb = [0.0, x, c];
  else if (h < 300.0) rgb = [x, 0.0, c];
  else rgb = [c, 0.0, x];
  return [rgb[0] + m, rgb[1] + m, rgb[2] + m, 1.0];
}

function geomAxes(geom) {
  return [
    [geom.mat[0], geom.mat[3], geom.mat[6]],
    [geom.mat[1], geom.mat[4], geom.mat[7]],
    [geom.mat[2], geom.mat[5], geom.mat[8]],
  ];
}

function quatToMat3(quat) {
  const [w, x, y, z] = quat;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  return [
    1.0 - 2.0 * (yy + zz), 2.0 * (xy - wz), 2.0 * (xz + wy),
    2.0 * (xy + wz), 1.0 - 2.0 * (xx + zz), 2.0 * (yz - wx),
    2.0 * (xz - wy), 2.0 * (yz + wx), 1.0 - 2.0 * (xx + yy),
  ];
}

function transformPoint(origin, mat, local) {
  return [
    origin[0] + mat[0] * local[0] + mat[1] * local[1] + mat[2] * local[2],
    origin[1] + mat[3] * local[0] + mat[4] * local[1] + mat[5] * local[2],
    origin[2] + mat[6] * local[0] + mat[7] * local[1] + mat[8] * local[2],
  ];
}

function modelMatrixFromGeom(geom) {
  return [
    geom.mat[0], geom.mat[3], geom.mat[6], 0.0,
    geom.mat[1], geom.mat[4], geom.mat[7], 0.0,
    geom.mat[2], geom.mat[5], geom.mat[8], 0.0,
    geom.pos[0], geom.pos[1], geom.pos[2], 1.0,
  ];
}

function normalMatrixFromGeom(geom) {
  return [
    geom.mat[0], geom.mat[3], geom.mat[6],
    geom.mat[1], geom.mat[4], geom.mat[7],
    geom.mat[2], geom.mat[5], geom.mat[8],
  ];
}

function transformGeomPoint(geom, local) {
  return [
    geom.pos[0] + geom.mat[0] * local[0] + geom.mat[1] * local[1] + geom.mat[2] * local[2],
    geom.pos[1] + geom.mat[3] * local[0] + geom.mat[4] * local[1] + geom.mat[5] * local[2],
    geom.pos[2] + geom.mat[6] * local[0] + geom.mat[7] * local[1] + geom.mat[8] * local[2],
  ];
}

function transformGeomVector(geom, local) {
  return normalize3([
    geom.mat[0] * local[0] + geom.mat[1] * local[1] + geom.mat[2] * local[2],
    geom.mat[3] * local[0] + geom.mat[4] * local[1] + geom.mat[5] * local[2],
    geom.mat[6] * local[0] + geom.mat[7] * local[1] + geom.mat[8] * local[2],
  ]);
}

function pushVertex(out, position, normal, color) {
  out.push(
    position[0], position[1], position[2],
    normal[0], normal[1], normal[2],
    color[0], color[1], color[2], color[3],
  );
}

function pushTriangle(out, a, b, c, normal, color) {
  pushVertex(out, a, normal, color);
  pushVertex(out, b, normal, color);
  pushVertex(out, c, normal, color);
}

function pushLine(out, a, b, color) {
  const normal = [0.0, 0.0, 1.0];
  pushVertex(out, a, normal, color);
  pushVertex(out, b, normal, color);
}

function triangleNormal(a, b, c) {
  return normalize3(cross3(sub3(b, a), sub3(c, a)));
}

function createWebGlProgram(gl, vertexSource, fragmentSource) {
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertex, vertexSource);
  gl.compileShader(vertex);
  if (!gl.getShaderParameter(vertex, gl.COMPILE_STATUS)) {
    throw new Error(`vertex shader compile failed: ${gl.getShaderInfoLog(vertex)}`);
  }
  const fragment = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragment, fragmentSource);
  gl.compileShader(fragment);
  if (!gl.getShaderParameter(fragment, gl.COMPILE_STATUS)) {
    throw new Error(`fragment shader compile failed: ${gl.getShaderInfoLog(fragment)}`);
  }
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(v, scalar) {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function distance3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len <= 1e-6) {
    return [0.0, 0.0, 1.0];
  }
  return [v[0] / len, v[1] / len, v[2] / len];
}

function mulMat3(a, b) {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

function mulMat4(a, b) {
  const out = new Array(16).fill(0.0);
  for (let col = 0; col < 4; ++col) {
    for (let row = 0; row < 4; ++row) {
      for (let i = 0; i < 4; ++i) {
        out[col * 4 + row] += a[i * 4 + row] * b[col * 4 + i];
      }
    }
  }
  return out;
}

function mulMat4Vec4(m, v) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
    m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3],
  ];
}

function perspectiveDivide(v) {
  if (Math.abs(v[3]) <= 1e-6) {
    return null;
  }
  return [v[0] / v[3], v[1] / v[3], v[2] / v[3]];
}

function invertMat4(m) {
  const out = new Array(16);
  const m00 = m[0], m01 = m[4], m02 = m[8], m03 = m[12];
  const m10 = m[1], m11 = m[5], m12 = m[9], m13 = m[13];
  const m20 = m[2], m21 = m[6], m22 = m[10], m23 = m[14];
  const m30 = m[3], m31 = m[7], m32 = m[11], m33 = m[15];

  const b00 = m00 * m11 - m01 * m10;
  const b01 = m00 * m12 - m02 * m10;
  const b02 = m00 * m13 - m03 * m10;
  const b03 = m01 * m12 - m02 * m11;
  const b04 = m01 * m13 - m03 * m11;
  const b05 = m02 * m13 - m03 * m12;
  const b06 = m20 * m31 - m21 * m30;
  const b07 = m20 * m32 - m22 * m30;
  const b08 = m20 * m33 - m23 * m30;
  const b09 = m21 * m32 - m22 * m31;
  const b10 = m21 * m33 - m23 * m31;
  const b11 = m22 * m33 - m23 * m32;

  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(det) <= 1e-8) {
    return null;
  }
  const invDet = 1.0 / det;

  out[0] = (m11 * b11 - m12 * b10 + m13 * b09) * invDet;
  out[1] = (-m10 * b11 + m12 * b08 - m13 * b07) * invDet;
  out[2] = (m10 * b10 - m11 * b08 + m13 * b06) * invDet;
  out[3] = (-m10 * b09 + m11 * b07 - m12 * b06) * invDet;
  out[4] = (-m01 * b11 + m02 * b10 - m03 * b09) * invDet;
  out[5] = (m00 * b11 - m02 * b08 + m03 * b07) * invDet;
  out[6] = (-m00 * b10 + m01 * b08 - m03 * b06) * invDet;
  out[7] = (m00 * b09 - m01 * b07 + m02 * b06) * invDet;
  out[8] = (m31 * b05 - m32 * b04 + m33 * b03) * invDet;
  out[9] = (-m30 * b05 + m32 * b02 - m33 * b01) * invDet;
  out[10] = (m30 * b04 - m31 * b02 + m33 * b00) * invDet;
  out[11] = (-m30 * b03 + m31 * b01 - m32 * b00) * invDet;
  out[12] = (-m21 * b05 + m22 * b04 - m23 * b03) * invDet;
  out[13] = (m20 * b05 - m22 * b02 + m23 * b01) * invDet;
  out[14] = (-m20 * b04 + m21 * b02 - m23 * b00) * invDet;
  out[15] = (m20 * b03 - m21 * b01 + m22 * b00) * invDet;
  return out;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const IDENTITY_MAT4 = new Float32Array([
  1.0, 0.0, 0.0, 0.0,
  0.0, 1.0, 0.0, 0.0,
  0.0, 0.0, 1.0, 0.0,
  0.0, 0.0, 0.0, 1.0,
]);
const IDENTITY_MAT3 = new Float32Array([
  1.0, 0.0, 0.0,
  0.0, 1.0, 0.0,
  0.0, 0.0, 1.0,
]);
const WHITE_TINT = new Float32Array([1.0, 1.0, 1.0, 1.0]);
const WHITE_COLOR = [1.0, 1.0, 1.0, 1.0];
const COMMAND_BALL_HEIGHT = 0.05;
const COMMAND_BALL_RADIUS = 0.06;
const MAX_COMMAND_SPEED = 2.0;

const OVERLAY_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec4 a_color;
uniform mat4 u_view_proj;
uniform mat4 u_model;
uniform mat3 u_normal_mat;
uniform vec4 u_tint;
out vec3 v_normal;
out vec4 v_color;
void main() {
  v_normal = normalize(u_normal_mat * a_normal);
  v_color = a_color * u_tint;
  gl_Position = u_view_proj * u_model * vec4(a_pos, 1.0);
}`;

const OVERLAY_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform bool u_unlit;
in vec3 v_normal;
in vec4 v_color;
out vec4 out_color;
void main() {
  if (u_unlit) {
    out_color = v_color;
    return;
  }
  vec3 light_dir = normalize(vec3(0.35, 0.45, 0.82));
  float diffuse = max(dot(normalize(v_normal), light_dir), 0.0);
  float lighting = 0.28 + 0.72 * diffuse;
  out_color = vec4(v_color.rgb * lighting, v_color.a);
}`;
