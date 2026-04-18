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

export function setupLocalizationEmbed({ getEmbedState, dispatchEmbedAction }) {
  let lastToolbarStateJson = "";

  function elements() {
    return {
      toolbar: document.getElementById("embed_localization_toolbar"),
      pause: document.getElementById("localization_toolbar_pause_button"),
      restart: document.getElementById("localization_toolbar_restart_button"),
      addVehicle: document.getElementById("localization_toolbar_add_vehicle_button"),
      speed: document.getElementById("localization_toolbar_speed_input"),
      speedValue: document.getElementById("localization_toolbar_speed_value"),
      vehicleCount: document.getElementById("localization_toolbar_vehicle_count"),
      cards: document.getElementById("embed_localization_cards"),
    };
  }

  function postLocalizationHeight() {
    if (!document.documentElement.classList.contains("embedded-localization-dom")) {
      return;
    }
    const height = measureVisibleBodyHeight();
    if (!height || !window.parent || window.parent === window) {
      return;
    }
    window.parent.postMessage(
      {
        type: "rust-robotics-embed-size",
        mode: "localization",
        height,
      },
      "*",
    );
  }

  function bindLocalizationHeightObservers() {
    if (!document.documentElement.classList.contains("embedded-localization-dom")) {
      return;
    }
    bindEmbedHeightObservers({
      observeTargets: () => [
        document.body,
        document.getElementById("embed_localization_toolbar"),
        document.getElementById("embed_localization_cards"),
        document.getElementById("canvas_shell"),
      ],
      onMeasure: postLocalizationHeight,
      observerFlag: "localizationEmbedHeightObserverBound",
    });
  }

  function syncNumericInput(input, vehicleId, patchKey, value, { min, max, step }) {
    if (!input.dataset.bound) {
      input.addEventListener("change", () => {
        const parsed = Number.parseFloat(input.value);
        if (!Number.isFinite(parsed)) {
          return;
        }
        dispatchEmbedAction({
          type: "patch_localization_vehicle",
          vehicle_id: vehicleId,
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

  function syncVehicleCards(container, payload) {
    const existing = new Map(
      [...container.querySelectorAll(".localization-dom-card")].map((card) => [
        Number(card.dataset.vehicleId),
        card,
      ]),
    );

    const driveModeOptions = [
      { value: "kinematic", label: "Fixed Input" },
      { value: "dynamic", label: "User Control" },
    ];

    for (const vehicle of payload.vehicles || []) {
      let card = existing.get(vehicle.id);
      if (!card) {
        card = document.createElement("section");
        card.className = "localization-dom-card";
        card.dataset.vehicleId = String(vehicle.id);
        card.innerHTML = `
          <div class="localization-dom-card-header">
            <div class="localization-dom-card-title"></div>
            <button class="card-remove" type="button">Remove</button>
          </div>
          <div class="localization-status"></div>
          <div class="localization-param-field">
            <label>Drive Mode</label>
            <select class="localization-drive-mode"></select>
          </div>
          <details class="localization-motion-details">
            <summary>Motion</summary>
            <div class="localization-param-fields">
              <div class="localization-param-field">
                <label>Velocity (m/s)</label>
                <input class="localization-velocity" type="number" />
              </div>
              <div class="localization-param-field">
                <label>Yaw Rate (rad/s)</label>
                <input class="localization-yaw-rate" type="number" />
              </div>
            </div>
          </details>
          <details>
            <summary>Sensor</summary>
            <div class="localization-param-fields">
              <div class="localization-param-field">
                <label>Range (m)</label>
                <input class="localization-max-range" type="number" />
              </div>
              <div class="localization-param-field">
                <label>Observation Noise</label>
                <input class="localization-obs-noise" type="number" />
              </div>
            </div>
          </details>
          <details>
            <summary>PF Noise</summary>
            <div class="localization-param-fields">
              <div class="localization-param-field">
                <label>Motion Noise v</label>
                <input class="localization-motion-noise-v" type="number" />
              </div>
              <div class="localization-param-field">
                <label>Motion Noise yaw (deg)</label>
                <input class="localization-motion-noise-yaw" type="number" />
              </div>
            </div>
          </details>
        `;
        container.appendChild(card);
      }

      const title = card.querySelector(".localization-dom-card-title");
      const removeButton = card.querySelector(".card-remove");
      const status = card.querySelector(".localization-status");
      const driveMode = card.querySelector(".localization-drive-mode");
      const motionDetails = card.querySelector(".localization-motion-details");
      const velocity = card.querySelector(".localization-velocity");
      const yawRate = card.querySelector(".localization-yaw-rate");
      const maxRange = card.querySelector(".localization-max-range");
      const obsNoise = card.querySelector(".localization-obs-noise");
      const motionNoiseV = card.querySelector(".localization-motion-noise-v");
      const motionNoiseYaw = card.querySelector(".localization-motion-noise-yaw");

      title.textContent = `Vehicle ${vehicle.id}`;
      status.textContent = vehicle.status;

      if (!removeButton.dataset.bound) {
        removeButton.addEventListener("click", () => {
          dispatchEmbedAction({
            type: "remove_localization_vehicle",
            vehicle_id: vehicle.id,
          });
        });
        removeButton.dataset.bound = "1";
      }
      removeButton.style.display = (payload.vehicle_count || 0) > 1 ? "" : "none";

      setSelectOptionsIfIdle(driveMode, driveModeOptions, vehicle.drive_mode);
      if (!driveMode.dataset.bound) {
        driveMode.addEventListener("change", () => {
          dispatchEmbedAction({
            type: "set_localization_drive_mode",
            vehicle_id: vehicle.id,
            drive_mode: driveMode.value,
          });
        });
        driveMode.dataset.bound = "1";
      }

      motionDetails.hidden = vehicle.drive_mode !== "kinematic";
      if (vehicle.drive_mode === "kinematic") {
        syncNumericInput(velocity, vehicle.id, "velocity", vehicle.velocity, {
          min: 0,
          max: 30,
          step: 0.5,
        });
        syncNumericInput(yawRate, vehicle.id, "yaw_rate", vehicle.yaw_rate, {
          min: -1,
          max: 1,
          step: 0.01,
        });
      }
      syncNumericInput(maxRange, vehicle.id, "max_range", vehicle.max_range, {
        min: 5,
        max: 100,
        step: 1,
      });
      syncNumericInput(obsNoise, vehicle.id, "obs_noise", vehicle.obs_noise, {
        min: 0.1,
        max: 5,
        step: 0.05,
      });
      syncNumericInput(motionNoiseV, vehicle.id, "motion_noise_v", vehicle.motion_noise_v, {
        min: 0.5,
        max: 10,
        step: 0.2,
      });
      syncNumericInput(
        motionNoiseYaw,
        vehicle.id,
        "motion_noise_yaw",
        vehicle.motion_noise_yaw,
        {
          min: 1,
          max: 90,
          step: 1,
        },
      );

      existing.delete(vehicle.id);
    }

    for (const staleCard of existing.values()) {
      staleCard.remove();
    }
  }

  function syncToolbar(state) {
    const payload = state?.payload;
    if (!state || state.mode !== "localization" || !payload || payload.kind !== "localization") {
      return;
    }

    const snapshot = JSON.stringify({
      paused: state.paused,
      sim_speed: state.toolbar.sim_speed,
      vehicle_count: payload.vehicle_count,
      vehicles: payload.vehicles,
    });
    if (snapshot === lastToolbarStateJson) {
      return;
    }
    lastToolbarStateJson = snapshot;

    const ui = elements();
    ui.pause.textContent = state.paused ? "Play" : "Pause";
    setInputValueIfIdle(ui.speed, state.toolbar.sim_speed);
    ui.speedValue.textContent = `${state.toolbar.sim_speed}x`;
    ui.vehicleCount.textContent = `${payload.vehicle_count} vehicle${payload.vehicle_count === 1 ? "" : "s"}`;
    syncVehicleCards(ui.cards, payload);
    window.requestAnimationFrame(postLocalizationHeight);
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
    ui.addVehicle.addEventListener("click", () => {
      dispatchEmbedAction({ type: "add_active_simulation" });
    });
    ui.speed.addEventListener("input", () => {
      const value = Number.parseInt(ui.speed.value, 10);
      ui.speedValue.textContent = `${value}x`;
      dispatchEmbedAction({ type: "set_sim_speed", sim_speed: value });
    });

    bindLocalizationHeightObservers();
    poller.start();

    try {
      const state = getEmbedState();
      if (state) {
        syncToolbar(state);
      }
    } catch (_error) {
      // Ignore startup races until wasm is ready.
    }
  }

  return { init };
}
