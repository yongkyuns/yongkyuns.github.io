import {
  bindEmbedHeightObservers,
  createStatePollingLoop,
  measureVisibleBodyHeight,
  setInputValueIfIdle,
} from "./base.js";

export function setupPendulumEmbed({ getEmbedState, dispatchEmbedAction }) {
  let lastToolbarStateJson = "";

  function pendulumToolbarElements() {
    return {
      root: document.getElementById("embed_toolbar"),
      pause: document.getElementById("toolbar_pause_button"),
      restart: document.getElementById("toolbar_restart_button"),
      addPendulum: document.getElementById("toolbar_add_pendulum_button"),
      speed: document.getElementById("toolbar_speed_input"),
      speedValue: document.getElementById("toolbar_speed_value"),
      showGraph: document.getElementById("toolbar_show_graph"),
      noiseEnabled: document.getElementById("toolbar_noise_enabled"),
      noiseScale: document.getElementById("toolbar_noise_scale"),
      noiseValue: document.getElementById("toolbar_noise_value"),
      pendulumCount: document.getElementById("toolbar_pendulum_count"),
      cards: document.getElementById("embed_pendulum_cards"),
    };
  }

  function commitPendulumPatch(pendulumId, patch) {
    dispatchEmbedAction({
      type: "patch_pendulum",
      pendulum_id: pendulumId,
      patch,
    });
  }

  function syncPendulumFieldRows(container, pendulumId, fields) {
    const existing = new Map(
      [...container.querySelectorAll(".pendulum-param-field")].map((field) => [
        field.dataset.fieldKey,
        field,
      ]),
    );

    for (const field of fields) {
      let row = existing.get(field.key);
      if (!row) {
        row = document.createElement("div");
        row.className = "pendulum-param-field";
        row.dataset.fieldKey = field.key;
        row.innerHTML = `
          <label></label>
          <input />
        `;
        container.appendChild(row);
      }

      const label = row.querySelector("label");
      const input = row.querySelector("input");
      label.textContent = field.label;
      input.type = field.type || "number";
      input.step = field.step ?? "0.01";
      if (field.min !== undefined) {
        input.min = String(field.min);
      } else {
        input.removeAttribute("min");
      }
      if (field.max !== undefined) {
        input.max = String(field.max);
      } else {
        input.removeAttribute("max");
      }
      input.disabled = Boolean(field.disabled);

      if (field.disabled) {
        setInputValueIfIdle(input, field.value);
      } else {
        if (!input.dataset.bound) {
          input.addEventListener("change", () => {
            const rawValue =
              input.type === "number" ? Number.parseFloat(input.value) : input.value;
            if (input.type === "number" && !Number.isFinite(rawValue)) {
              return;
            }
            const patchBuilder = input.__patchBuilder;
            if (typeof patchBuilder === "function") {
              commitPendulumPatch(pendulumId, patchBuilder(rawValue));
            }
          });
          input.dataset.bound = "1";
        }
        input.__patchBuilder = field.patch;
        setInputValueIfIdle(input, field.value);
      }

      existing.delete(field.key);
    }

    for (const staleField of existing.values()) {
      staleField.remove();
    }
  }

  function pendulumPlantFields(pendulum) {
    return [
      {
        key: "beam_length",
        label: "Beam Length (m)",
        value: pendulum.pendulum.beam_length.toFixed(2),
        min: 0.1,
        max: 10,
        step: 0.01,
        patch: (value) => ({ beam_length: value }),
      },
      {
        key: "cart_mass",
        label: "Cart Mass (kg)",
        value: pendulum.pendulum.cart_mass.toFixed(2),
        min: 0.1,
        max: 3,
        step: 0.01,
        patch: (value) => ({ cart_mass: value }),
      },
      {
        key: "ball_mass",
        label: "Ball Mass (kg)",
        value: pendulum.pendulum.ball_mass.toFixed(2),
        min: 0.1,
        max: 10,
        step: 0.01,
        patch: (value) => ({ ball_mass: value }),
      },
    ];
  }

  function controllerParamFields(controllerParams) {
    switch (controllerParams.kind) {
      case "lqr":
        return [
          {
            key: "lqr_beam_length",
            label: "Model Beam (m)",
            value: controllerParams.beam_length.toFixed(2),
            min: 0.1,
            max: 10,
            step: 0.01,
            patch: (value) => ({ lqr: { beam_length: value } }),
          },
          {
            key: "lqr_cart_mass",
            label: "Model Cart (kg)",
            value: controllerParams.cart_mass.toFixed(2),
            min: 0.1,
            max: 3,
            step: 0.01,
            patch: (value) => ({ lqr: { cart_mass: value } }),
          },
          {
            key: "lqr_ball_mass",
            label: "Model Ball (kg)",
            value: controllerParams.ball_mass.toFixed(2),
            min: 0.1,
            max: 10,
            step: 0.01,
            patch: (value) => ({ lqr: { ball_mass: value } }),
          },
          {
            key: "lqr_q_position",
            label: "Q Position",
            value: controllerParams.q_position.toFixed(2),
            min: 0,
            max: 100,
            step: 0.01,
            patch: (value) => ({ lqr: { q_position: value } }),
          },
          {
            key: "lqr_q_velocity",
            label: "Q Velocity",
            value: controllerParams.q_velocity.toFixed(2),
            min: 0,
            max: 100,
            step: 0.01,
            patch: (value) => ({ lqr: { q_velocity: value } }),
          },
          {
            key: "lqr_q_angle",
            label: "Q Angle",
            value: controllerParams.q_angle.toFixed(2),
            min: 0,
            max: 100,
            step: 0.01,
            patch: (value) => ({ lqr: { q_angle: value } }),
          },
          {
            key: "lqr_q_angular_velocity",
            label: "Q Ang. Velocity",
            value: controllerParams.q_angular_velocity.toFixed(2),
            min: 0,
            max: 100,
            step: 0.01,
            patch: (value) => ({ lqr: { q_angular_velocity: value } }),
          },
          {
            key: "lqr_r_input",
            label: "R Input",
            value: controllerParams.r_input.toFixed(2),
            min: 0,
            max: 100,
            step: 0.01,
            patch: (value) => ({ lqr: { r_input: value } }),
          },
        ];
      case "pid":
        return [
          {
            key: "pid_kp",
            label: "Kp",
            value: controllerParams.kp.toFixed(2),
            min: 0.01,
            max: 10000,
            step: 0.01,
            patch: (value) => ({ pid: { kp: value } }),
          },
          {
            key: "pid_ki",
            label: "Ki",
            value: controllerParams.ki.toFixed(2),
            min: 0.01,
            max: 10000,
            step: 0.01,
            patch: (value) => ({ pid: { ki: value } }),
          },
          {
            key: "pid_kd",
            label: "Kd",
            value: controllerParams.kd.toFixed(2),
            min: 0.01,
            max: 10000,
            step: 0.01,
            patch: (value) => ({ pid: { kd: value } }),
          },
        ];
      case "mpc":
        return [
          {
            key: "mpc_beam_length",
            label: "Model Beam (m)",
            value: controllerParams.beam_length.toFixed(2),
            min: 0.1,
            max: 10,
            step: 0.01,
            patch: (value) => ({ mpc: { beam_length: value } }),
          },
          {
            key: "mpc_cart_mass",
            label: "Model Cart (kg)",
            value: controllerParams.cart_mass.toFixed(2),
            min: 0.1,
            max: 3,
            step: 0.01,
            patch: (value) => ({ mpc: { cart_mass: value } }),
          },
          {
            key: "mpc_ball_mass",
            label: "Model Ball (kg)",
            value: controllerParams.ball_mass.toFixed(2),
            min: 0.1,
            max: 10,
            step: 0.01,
            patch: (value) => ({ mpc: { ball_mass: value } }),
          },
          {
            key: "mpc_q_position",
            label: "Q Position",
            value: controllerParams.q_position.toFixed(2),
            min: 0,
            max: 100,
            step: 0.01,
            patch: (value) => ({ mpc: { q_position: value } }),
          },
          {
            key: "mpc_q_velocity",
            label: "Q Velocity",
            value: controllerParams.q_velocity.toFixed(2),
            min: 0,
            max: 100,
            step: 0.01,
            patch: (value) => ({ mpc: { q_velocity: value } }),
          },
          {
            key: "mpc_q_angle",
            label: "Q Angle",
            value: controllerParams.q_angle.toFixed(2),
            min: 0,
            max: 100,
            step: 0.01,
            patch: (value) => ({ mpc: { q_angle: value } }),
          },
          {
            key: "mpc_q_angular_velocity",
            label: "Q Ang. Velocity",
            value: controllerParams.q_angular_velocity.toFixed(2),
            min: 0,
            max: 100,
            step: 0.01,
            patch: (value) => ({ mpc: { q_angular_velocity: value } }),
          },
          {
            key: "mpc_r_input",
            label: "R Input",
            value: controllerParams.r_input.toFixed(2),
            min: 0,
            max: 100,
            step: 0.01,
            patch: (value) => ({ mpc: { r_input: value } }),
          },
          {
            key: "mpc_horizon",
            label: "Horizon",
            value: controllerParams.horizon,
            type: "text",
            disabled: true,
            patch: () => ({}),
          },
        ];
      case "policy":
        return [
          {
            key: "policy_ready",
            label: "Snapshot",
            value: controllerParams.ready ? "Ready" : "Waiting for trainer",
            type: "text",
            disabled: true,
            patch: () => ({}),
          },
          {
            key: "policy_action_std",
            label: "Action Std",
            value:
              controllerParams.action_std === null || controllerParams.action_std === undefined
                ? "N/A"
                : Number(controllerParams.action_std).toFixed(3),
            type: "text",
            disabled: true,
            patch: () => ({}),
          },
        ];
      default:
        return [];
    }
  }

  function trainerParamFields(trainer) {
    return [
      {
        key: "policy_parallel_trainers",
        label: "Parallel",
        value: trainer.parallel_trainers,
        min: 1,
        max: 32,
        step: 1,
        patch: (value) => ({ policy: { parallel_trainers: value } }),
      },
      {
        key: "policy_training_updates_per_tick",
        label: "Updates / tick",
        value: trainer.training_updates_per_tick,
        min: 1,
        max: 32,
        step: 1,
        patch: (value) => ({ policy: { training_updates_per_tick: value } }),
      },
      {
        key: "policy_rollout_steps",
        label: "Rollout",
        value: trainer.rollout_steps,
        min: 32,
        max: 8192,
        step: 16,
        patch: (value) => ({ policy: { rollout_steps: value } }),
      },
      {
        key: "policy_epochs_per_update",
        label: "Epochs",
        value: trainer.epochs_per_update,
        min: 1,
        max: 16,
        step: 1,
        patch: (value) => ({ policy: { epochs_per_update: value } }),
      },
      {
        key: "policy_learning_rate",
        label: "Learning Rate",
        value: Number(trainer.learning_rate).toFixed(5),
        min: 0.00001,
        max: 0.01,
        step: 0.00001,
        patch: (value) => ({ policy: { learning_rate: value } }),
      },
      {
        key: "policy_action_std",
        label: "Action Std",
        value: Number(trainer.action_std).toFixed(3),
        min: 0.05,
        max: 10,
        step: 0.05,
        patch: (value) => ({ policy: { action_std: value } }),
      },
    ];
  }

  function syncPpoTrainerSection(section, pendulum) {
    if (!section) {
      return;
    }

    const trainer = pendulum.policy_trainer;
    section.hidden = pendulum.controller !== "policy";
    if (!trainer) {
      return;
    }

    const toggleButton = section.querySelector(".trainer-toggle-button");
    const resetButton = section.querySelector(".trainer-reset-button");
    const useButton = section.querySelector(".trainer-use-button");
    toggleButton.onclick = () => {
      commitPendulumPatch(pendulum.id, {
        trainer_action: trainer.training_active ? "stop" : "start",
      });
    };
    resetButton.onclick = () => {
      commitPendulumPatch(pendulum.id, { trainer_action: "reset" });
    };
    useButton.onclick = () => {
      commitPendulumPatch(pendulum.id, { trainer_action: "use" });
    };
    toggleButton.textContent = trainer.training_active ? "Stop" : "Train";
    resetButton.disabled = false;
    useButton.disabled = !trainer.snapshot_ready;

    syncPendulumFieldRows(
      section.querySelector(".trainer-params-fields"),
      pendulum.id,
      trainerParamFields(trainer),
    );

    const status = section.querySelector(".pendulum-trainer-status");
    const statusLines = [];
    if (!trainer.initialized) {
      statusLines.push("Trainer not initialized.");
    } else {
      statusLines.push(
        `Replicas ${trainer.total_replicas}/${trainer.ready_replicas}/${trainer.busy_replicas}`,
      );
    }
    if (trainer.training_active && trainer.busy) {
      statusLines.push("Training...");
    }
    if (trainer.last_error) {
      statusLines.push(`Error: ${trainer.last_error}`);
    }
    status.textContent = statusLines.join("\n");

    const metricsRoot = section.querySelector(".pendulum-trainer-metrics");
    if (trainer.metrics) {
      metricsRoot.hidden = false;
      metricsRoot.innerHTML = `
        <div>Upd ${trainer.metrics.total_updates}  Step ${trainer.metrics.total_env_steps}  Ep ${trainer.metrics.total_episodes}</div>
        <div>Ret ${Number(trainer.metrics.last_episode_return).toFixed(2)} / ${Number(trainer.metrics.mean_episode_return).toFixed(2)} / ${Number(trainer.metrics.best_episode_return).toFixed(2)}</div>
        <div>Loss ${Number(trainer.metrics.last_policy_loss).toFixed(3)} / ${Number(trainer.metrics.last_value_loss).toFixed(3)}</div>
      `;
    } else {
      metricsRoot.hidden = true;
      metricsRoot.innerHTML = "";
    }

    section.querySelector(".pendulum-trainer-note").textContent =
      "Changes apply after Reset.";
  }

  function postEmbedHeightFromDom() {
    if (!document.documentElement.classList.contains("embedded-pendulum-dom")) {
      return;
    }
    if (window.parent === window) {
      return;
    }

    const heightWithBuffer = measureVisibleBodyHeight({
      extraBottom: document.documentElement.classList.contains("embedded-pendulum-graph") ? 16 : 0,
    });
    if (!heightWithBuffer) {
      return;
    }

    window.parent.postMessage(
      {
        type: "rust-robotics-embed-size",
        height: heightWithBuffer,
      },
      "*",
    );
  }

  function bindPendulumEmbedHeightObservers() {
    if (!document.documentElement.classList.contains("embedded-pendulum-dom")) {
      return;
    }
    bindEmbedHeightObservers({
      onMeasure: postEmbedHeightFromDom,
      observeTargets: () => [
        document.body,
        document.documentElement,
        document.getElementById("canvas_shell"),
        document.getElementById("embed_toolbar"),
        document.getElementById("embed_pendulum_cards"),
      ],
      observerFlag: "pendulumEmbedHeightObserverBound",
    });
  }

  function renderPendulumCards(state) {
    const payload = state.payload;
    if (!payload || payload.kind !== "pendulum") {
      return;
    }
    const elements = pendulumToolbarElements();
    const cardRoot = elements.cards;
    if (!cardRoot) {
      return;
    }
    cardRoot.hidden = false;
    const existing = new Map(
      [...cardRoot.querySelectorAll(".pendulum-dom-card")].map((card) => [
        Number.parseInt(card.dataset.pendulumId || "0", 10),
        card,
      ]),
    );

    for (const pendulum of payload.pendulums || []) {
      let card = existing.get(pendulum.id);
      if (!card) {
        card = document.createElement("section");
        card.className = "pendulum-dom-card";
        card.dataset.pendulumId = String(pendulum.id);
        card.innerHTML = `
          <div class="pendulum-dom-card-header">
            <strong>Pendulum ${pendulum.id}</strong>
            <button type="button" class="card-remove">Remove</button>
          </div>
          <select>
            <option value="lqr">LQR</option>
            <option value="pid">PID</option>
            <option value="mpc">MPC</option>
            <option value="policy">PPO Policy</option>
          </select>
          <details class="pendulum-params-section">
            <summary>Pendulum Parameters</summary>
            <div class="pendulum-param-fields pendulum-params-fields"></div>
          </details>
          <details class="controller-params-section">
            <summary>Controller Parameters</summary>
            <div class="pendulum-param-fields controller-params-fields"></div>
          </details>
          <details class="ppo-trainer-section">
            <summary>PPO Trainer</summary>
            <div class="pendulum-trainer-actions">
              <button type="button" class="trainer-toggle-button">Train</button>
              <button type="button" class="trainer-reset-button">Reset</button>
              <button type="button" class="trainer-use-button">Use</button>
            </div>
            <div class="pendulum-trainer-status"></div>
            <div class="pendulum-trainer-metrics" hidden></div>
            <div class="pendulum-param-fields trainer-params-fields"></div>
            <div class="pendulum-trainer-note"></div>
          </details>
        `;
        const removeButton = card.querySelector(".card-remove");
        removeButton.addEventListener("click", () => {
          dispatchEmbedAction({
            type: "remove_pendulum",
            pendulum_id: pendulum.id,
          });
        });
        const select = card.querySelector("select");
        select.addEventListener("change", () => {
          dispatchEmbedAction({
            type: "set_pendulum_controller",
            pendulum_id: pendulum.id,
            controller: select.value,
          });
        });
        cardRoot.appendChild(card);
      }

      card.querySelector("strong").textContent = `Pendulum ${pendulum.id}`;
      const removeButton = card.querySelector(".card-remove");
      removeButton.style.display = (payload.pendulum_count || 0) > 1 ? "" : "none";
      const select = card.querySelector("select");
      if (document.activeElement !== select) {
        select.value = pendulum.controller;
      }
      syncPendulumFieldRows(
        card.querySelector(".pendulum-params-fields"),
        pendulum.id,
        pendulumPlantFields(pendulum),
      );
      syncPendulumFieldRows(
        card.querySelector(".controller-params-fields"),
        pendulum.id,
        controllerParamFields(pendulum.controller_params),
      );
      syncPpoTrainerSection(card.querySelector(".ppo-trainer-section"), pendulum);
      existing.delete(pendulum.id);
    }

    for (const staleCard of existing.values()) {
      staleCard.remove();
    }
  }

  function syncPendulumToolbar(state) {
    const elements = pendulumToolbarElements();
    const payload = state?.payload;
    if (!state || state.mode !== "inverted_pendulum" || !payload || payload.kind !== "pendulum") {
      return;
    }

    const snapshot = JSON.stringify({
      mode: state.mode,
      paused: state.paused,
      show_graph: state.view.show_graph,
      sim_speed: state.toolbar.sim_speed,
      pendulum_noise_enabled: payload.noise_enabled,
      pendulum_noise_scale: payload.noise_scale,
      pendulum_count: payload.pendulum_count,
      pendulums: payload.pendulums,
    });
    if (snapshot === lastToolbarStateJson) {
      return;
    }
    lastToolbarStateJson = snapshot;

    elements.pause.textContent = state.paused ? "Play" : "Pause";
    elements.speed.value = String(state.toolbar.sim_speed);
    elements.speedValue.textContent = `${state.toolbar.sim_speed}x`;
    elements.showGraph.checked = Boolean(state.view.show_graph);
    elements.noiseEnabled.checked = payload.noise_enabled;
    elements.noiseScale.value = String(payload.noise_scale);
    elements.noiseScale.disabled = !payload.noise_enabled;
    elements.noiseValue.textContent = Number(payload.noise_scale).toFixed(2);
    elements.pendulumCount.textContent =
      `${payload.pendulum_count} pendulum${payload.pendulum_count === 1 ? "" : "s"}`;
    document.documentElement.classList.toggle(
      "embedded-pendulum-graph",
      Boolean(state.view.show_graph),
    );
    renderPendulumCards(state);
    window.requestAnimationFrame(postEmbedHeightFromDom);
  }

  const stateLoop = createStatePollingLoop({
    getState: getEmbedState,
    onState: syncPendulumToolbar,
    intervalMs: 200,
  });

  function init() {
    const elements = pendulumToolbarElements();
    elements.root.hidden = false;

    if (!elements.root.dataset.bound) {
      elements.pause.addEventListener("click", () => {
        try {
          const state = getEmbedState();
          dispatchEmbedAction({ type: "set_paused", paused: !state.paused });
        } catch (_error) {}
      });

      elements.restart.addEventListener("click", () => {
        dispatchEmbedAction({ type: "restart" });
      });

      elements.addPendulum.addEventListener("click", () => {
        dispatchEmbedAction({ type: "add_pendulum" });
      });

      elements.speed.addEventListener("input", () => {
        const value = Number.parseInt(elements.speed.value, 10) || 1;
        elements.speedValue.textContent = `${value}x`;
        dispatchEmbedAction({ type: "set_sim_speed", sim_speed: value });
      });

      elements.showGraph.addEventListener("change", () => {
        document.documentElement.classList.toggle(
          "embedded-pendulum-graph",
          elements.showGraph.checked,
        );
        dispatchEmbedAction({ type: "set_show_graph", show_graph: elements.showGraph.checked });
        window.requestAnimationFrame(postEmbedHeightFromDom);
      });

      elements.noiseEnabled.addEventListener("change", () => {
        dispatchEmbedAction({
          type: "set_pendulum_noise_enabled",
          enabled: elements.noiseEnabled.checked,
        });
        elements.noiseScale.disabled = !elements.noiseEnabled.checked;
      });

      elements.noiseScale.addEventListener("input", () => {
        const value = Number.parseFloat(elements.noiseScale.value) || 0;
        elements.noiseValue.textContent = value.toFixed(2);
        dispatchEmbedAction({ type: "set_pendulum_noise_scale", scale: value });
      });

      elements.root.dataset.bound = "1";
    }

    bindPendulumEmbedHeightObservers();
    stateLoop.start();
    window.addEventListener("resize", postEmbedHeightFromDom, { passive: true });
    window.requestAnimationFrame(postEmbedHeightFromDom);
  }

  return {
    init,
    syncFromState: syncPendulumToolbar,
  };
}
