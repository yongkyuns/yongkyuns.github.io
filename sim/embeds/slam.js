import {
  bindEmbedHeightObservers,
  createStatePollingLoop,
  measureVisibleBodyHeight,
  setInputValueIfIdle,
} from "./base.js";

function setSelectOptionsIfIdle(select, options, selectedValue) {
  if (!select || document.activeElement === select) {
    return;
  }

  const optionSignature = JSON.stringify(options);
  if (select.dataset.optionSignature !== optionSignature) {
    select.innerHTML = "";
    for (const option of options) {
      const element = document.createElement("option");
      element.value = option.value;
      element.textContent = option.label;
      select.appendChild(element);
    }
    select.dataset.optionSignature = optionSignature;
  }
  select.value = selectedValue;
}

export function setupSlamEmbed({ getEmbedState, dispatchEmbedAction }) {
  let lastToolbarStateJson = "";

  function elements() {
    return {
      toolbar: document.getElementById("embed_slam_toolbar"),
      pause: document.getElementById("slam_toolbar_pause_button"),
      restart: document.getElementById("slam_toolbar_restart_button"),
      addDemo: document.getElementById("slam_toolbar_add_demo_button"),
      speed: document.getElementById("slam_toolbar_speed_input"),
      speedValue: document.getElementById("slam_toolbar_speed_value"),
      count: document.getElementById("slam_toolbar_count"),
      cards: document.getElementById("embed_slam_cards"),
    };
  }

  function postSlamHeight() {
    if (!document.documentElement.classList.contains("embedded-slam-dom")) {
      return;
    }
    const height = measureVisibleBodyHeight();
    if (!height || !window.parent || window.parent === window) {
      return;
    }
    window.parent.postMessage(
      {
        type: "rust-robotics-embed-size",
        mode: "slam",
        height,
      },
      "*",
    );
  }

  function bindSlamHeightObservers() {
    if (!document.documentElement.classList.contains("embedded-slam-dom")) {
      return;
    }
    bindEmbedHeightObservers({
      observeTargets: () => [
        document.body,
        document.getElementById("embed_slam_toolbar"),
        document.getElementById("embed_slam_cards"),
        document.getElementById("canvas_shell"),
      ],
      onMeasure: postSlamHeight,
      observerFlag: "slamEmbedHeightObserverBound",
    });
  }

  function syncNumber(input, slamId, patchKey, value, { min, max, step, parser = Number.parseFloat }) {
    if (!input.dataset.bound) {
      input.addEventListener("change", () => {
        const parsed = parser(input.value);
        if (!Number.isFinite(parsed)) {
          return;
        }
        dispatchEmbedAction({
          type: "patch_slam",
          slam_id: slamId,
          patch: { [patchKey]: parsed },
        });
      });
      input.dataset.bound = "1";
    }
    if (min !== undefined) input.min = String(min);
    if (max !== undefined) input.max = String(max);
    if (step !== undefined) input.step = String(step);
    setInputValueIfIdle(input, value);
  }

  function syncCheckbox(input, onChange) {
    if (!input.dataset.bound) {
      input.addEventListener("change", onChange);
      input.dataset.bound = "1";
    }
  }

  function syncCards(container, payload) {
    const existing = new Map(
      [...container.querySelectorAll(".slam-dom-card")].map((card) => [
        Number(card.dataset.slamId),
        card,
      ]),
    );

    const driveModeOptions = [
      { value: "auto", label: "Auto" },
      { value: "manual", label: "Manual" },
    ];

    for (const demo of payload.demos || []) {
      let card = existing.get(demo.id);
      if (!card) {
        card = document.createElement("section");
        card.className = "slam-dom-card";
        card.dataset.slamId = String(demo.id);
        card.innerHTML = `
          <div class="slam-dom-card-header">
            <div class="slam-dom-card-title"></div>
            <button class="card-remove" type="button">Remove</button>
          </div>
          <div class="slam-status"></div>
          <div class="slam-toggle-row">
            <label><input class="slam-ekf" type="checkbox" /> <span>EKF</span></label>
            <label><input class="slam-graph" type="checkbox" /> <span>Graph</span></label>
          </div>
          <div class="slam-param-field">
            <label>Drive Mode</label>
            <select class="slam-drive-mode"></select>
          </div>
          <details class="slam-motion-details">
            <summary>Auto Motion</summary>
            <div class="slam-param-fields">
              <div class="slam-param-field">
                <label>Velocity (m/s)</label>
                <input class="slam-velocity" type="number" />
              </div>
              <div class="slam-param-field">
                <label>Yaw Rate (rad/s)</label>
                <input class="slam-yaw-rate" type="number" />
              </div>
            </div>
          </details>
          <details>
            <summary>Display</summary>
            <div class="slam-toggle-grid">
              <label><input class="slam-show-covariance" type="checkbox" /> <span>Covariance</span></label>
              <label><input class="slam-show-observations" type="checkbox" /> <span>Observations</span></label>
              <label><input class="slam-show-dr" type="checkbox" /> <span>Dead Reckoning</span></label>
              <label><input class="slam-show-landmarks" type="checkbox" /> <span>True Landmarks</span></label>
            </div>
          </details>
          <details>
            <summary>Landmarks</summary>
            <div class="slam-param-fields">
              <div class="slam-param-field">
                <label>Count</label>
                <input class="slam-landmarks" type="number" />
              </div>
            </div>
          </details>
        `;
        container.appendChild(card);
      }

      const title = card.querySelector(".slam-dom-card-title");
      const removeButton = card.querySelector(".card-remove");
      const status = card.querySelector(".slam-status");
      const ekf = card.querySelector(".slam-ekf");
      const graph = card.querySelector(".slam-graph");
      const driveMode = card.querySelector(".slam-drive-mode");
      const motionDetails = card.querySelector(".slam-motion-details");
      const velocity = card.querySelector(".slam-velocity");
      const yawRate = card.querySelector(".slam-yaw-rate");
      const showCovariance = card.querySelector(".slam-show-covariance");
      const showObservations = card.querySelector(".slam-show-observations");
      const showDr = card.querySelector(".slam-show-dr");
      const showLandmarks = card.querySelector(".slam-show-landmarks");
      const landmarks = card.querySelector(".slam-landmarks");

      title.textContent = `SLAM ${demo.id}`;
      status.textContent = demo.status;

      if (!removeButton.dataset.bound) {
        removeButton.addEventListener("click", () => {
          dispatchEmbedAction({
            type: "remove_slam_demo",
            slam_id: demo.id,
          });
        });
        removeButton.dataset.bound = "1";
      }
      removeButton.style.display = (payload.slam_count || 0) > 1 ? "" : "none";

      if (document.activeElement !== ekf) ekf.checked = demo.ekf_enabled;
      if (document.activeElement !== graph) graph.checked = demo.graph_enabled;
      syncCheckbox(ekf, () => {
        dispatchEmbedAction({ type: "set_slam_ekf_enabled", slam_id: demo.id, enabled: ekf.checked });
      });
      syncCheckbox(graph, () => {
        dispatchEmbedAction({ type: "set_slam_graph_enabled", slam_id: demo.id, enabled: graph.checked });
      });

      setSelectOptionsIfIdle(driveMode, driveModeOptions, demo.drive_mode);
      if (!driveMode.dataset.bound) {
        driveMode.addEventListener("change", () => {
          dispatchEmbedAction({
            type: "set_slam_drive_mode",
            slam_id: demo.id,
            drive_mode: driveMode.value,
          });
        });
        driveMode.dataset.bound = "1";
      }

      motionDetails.hidden = demo.drive_mode !== "auto";
      if (demo.drive_mode === "auto") {
        syncNumber(velocity, demo.id, "velocity", demo.velocity, {
          min: 0.1,
          max: 3,
          step: 0.05,
        });
        syncNumber(yawRate, demo.id, "yaw_rate", demo.yaw_rate, {
          min: -0.5,
          max: 0.5,
          step: 0.01,
        });
      }

      if (document.activeElement !== showCovariance) showCovariance.checked = demo.show_covariance;
      if (document.activeElement !== showObservations) showObservations.checked = demo.show_observations;
      if (document.activeElement !== showDr) showDr.checked = demo.show_dr;
      if (document.activeElement !== showLandmarks) showLandmarks.checked = demo.show_true_landmarks;

      syncCheckbox(showCovariance, () => {
        dispatchEmbedAction({ type: "patch_slam", slam_id: demo.id, patch: { show_covariance: showCovariance.checked } });
      });
      syncCheckbox(showObservations, () => {
        dispatchEmbedAction({ type: "patch_slam", slam_id: demo.id, patch: { show_observations: showObservations.checked } });
      });
      syncCheckbox(showDr, () => {
        dispatchEmbedAction({ type: "patch_slam", slam_id: demo.id, patch: { show_dr: showDr.checked } });
      });
      syncCheckbox(showLandmarks, () => {
        dispatchEmbedAction({ type: "patch_slam", slam_id: demo.id, patch: { show_true_landmarks: showLandmarks.checked } });
      });

      syncNumber(landmarks, demo.id, "n_landmarks", demo.n_landmarks, {
        min: 1,
        max: 50,
        step: 1,
        parser: (raw) => Number.parseInt(raw, 10),
      });

      existing.delete(demo.id);
    }

    for (const staleCard of existing.values()) {
      staleCard.remove();
    }
  }

  function syncToolbar(state) {
    const payload = state?.payload;
    if (!state || state.mode !== "slam" || !payload || payload.kind !== "slam") {
      return;
    }

    const snapshot = JSON.stringify({
      paused: state.paused,
      sim_speed: state.toolbar.sim_speed,
      slam_count: payload.slam_count,
      demos: payload.demos,
    });
    if (snapshot === lastToolbarStateJson) {
      return;
    }
    lastToolbarStateJson = snapshot;

    const ui = elements();
    ui.pause.textContent = state.paused ? "Play" : "Pause";
    setInputValueIfIdle(ui.speed, state.toolbar.sim_speed);
    ui.speedValue.textContent = `${state.toolbar.sim_speed}x`;
    ui.count.textContent = `${payload.slam_count} demo${payload.slam_count === 1 ? "" : "s"}`;
    syncCards(ui.cards, payload);
    window.requestAnimationFrame(postSlamHeight);
  }

  const poller = createStatePollingLoop({
    getState: getEmbedState,
    onState: syncToolbar,
  });

  function init() {
    const ui = elements();
    ui.pause.addEventListener("click", () => {
      const state = getEmbedState();
      dispatchEmbedAction({ type: "set_paused", paused: !state.paused });
    });
    ui.restart.addEventListener("click", () => {
      dispatchEmbedAction({ type: "restart" });
    });
    ui.addDemo.addEventListener("click", () => {
      dispatchEmbedAction({ type: "add_active_simulation" });
    });
    ui.speed.addEventListener("input", () => {
      const value = Number.parseInt(ui.speed.value, 10);
      ui.speedValue.textContent = `${value}x`;
      dispatchEmbedAction({ type: "set_sim_speed", sim_speed: value });
    });

    bindSlamHeightObservers();
    poller.start();

    try {
      const state = getEmbedState();
      if (state) syncToolbar(state);
    } catch (_error) {
      // Ignore startup races until wasm is ready.
    }
  }

  return { init };
}
