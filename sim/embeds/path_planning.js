import {
  bindEmbedHeightObservers,
  createStatePollingLoop,
  measureVisibleBodyHeight,
  setInputValueIfIdle,
} from "./base.js";

function plannerAlgorithmOptions(envMode) {
  return envMode === "continuous"
    ? [
        { value: "rrt", label: "RRT" },
        { value: "theta_star", label: "Theta*" },
      ]
    : [
        { value: "a_star", label: "A*" },
        { value: "theta_star", label: "Theta*" },
        { value: "dijkstra", label: "Dijkstra" },
      ];
}

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

export function setupPathPlanningEmbed({ getEmbedState, dispatchEmbedAction }) {
  let lastToolbarStateJson = "";

  function elements() {
    return {
      toolbar: document.getElementById("embed_path_toolbar"),
      restart: document.getElementById("path_toolbar_restart_button"),
      addPlanner: document.getElementById("path_toolbar_add_planner_button"),
      speed: document.getElementById("path_toolbar_speed_input"),
      speedValue: document.getElementById("path_toolbar_speed_value"),
      envMode: document.getElementById("path_toolbar_env_mode"),
      radiusWrap: document.getElementById("path_toolbar_radius_wrap"),
      radius: document.getElementById("path_toolbar_radius_input"),
      radiusValue: document.getElementById("path_toolbar_radius_value"),
      plannerCount: document.getElementById("path_toolbar_planner_count"),
      cards: document.getElementById("embed_path_planner_cards"),
    };
  }

  function postPathPlanningHeight() {
    if (!document.documentElement.classList.contains("embedded-path-planning-dom")) {
      return;
    }

    const height = measureVisibleBodyHeight();
    if (!height || !window.parent || window.parent === window) {
      return;
    }

    window.parent.postMessage(
      {
        type: "rust-robotics-embed-size",
        mode: "path_planning",
        height,
      },
      "*",
    );
  }

  function bindPathPlanningHeightObservers() {
    if (!document.documentElement.classList.contains("embedded-path-planning-dom")) {
      return;
    }

    bindEmbedHeightObservers({
      observeTargets: () => [
        document.body,
        document.getElementById("embed_path_toolbar"),
        document.getElementById("embed_path_planner_cards"),
        document.getElementById("canvas_shell"),
      ],
      onMeasure: postPathPlanningHeight,
      observerFlag: "pathPlanningEmbedHeightObserverBound",
    });
  }

  function syncRrtField(input, plannerId, patchKey, value, { min, max, step, parser = Number.parseFloat }) {
    if (!input.dataset.bound) {
      input.addEventListener("change", () => {
        const parsed = parser(input.value);
        if (!Number.isFinite(parsed)) {
          return;
        }
        dispatchEmbedAction({
          type: "patch_path_planner",
          planner_id: plannerId,
          patch: { [patchKey]: parsed },
        });
      });
      input.dataset.bound = "1";
    }

    if (min !== undefined) {
      input.min = String(min);
    }
    if (max !== undefined) {
      input.max = String(max);
    }
    if (step !== undefined) {
      input.step = String(step);
    }
    setInputValueIfIdle(input, value);
  }

  function syncPlannerCards(container, payload) {
    const existing = new Map(
      [...container.querySelectorAll(".planner-dom-card")].map((card) => [
        Number(card.dataset.plannerId),
        card,
      ]),
    );

    const availableAlgorithms = plannerAlgorithmOptions(payload.env_mode);

    for (const planner of payload.planners || []) {
      let card = existing.get(planner.id);
      if (!card) {
        card = document.createElement("section");
        card.className = "planner-dom-card";
        card.dataset.plannerId = String(planner.id);
        card.innerHTML = `
          <div class="planner-dom-card-header">
            <div class="planner-dom-card-title"></div>
            <button class="card-remove" type="button">Remove</button>
          </div>
          <div class="planner-dom-accent"></div>
          <div class="planner-param-field planner-algo-field">
            <label>Algorithm</label>
            <select class="planner-algorithm-select"></select>
          </div>
          <label class="planner-inline-toggle">
            <input class="planner-show-visited" type="checkbox" />
            <span class="planner-show-visited-label"></span>
          </label>
          <details class="planner-rrt-details">
            <summary>RRT Settings</summary>
            <div class="planner-param-fields">
              <div class="planner-param-field">
                <label>Expand Distance</label>
                <input class="planner-rrt-expand" type="number" />
              </div>
              <div class="planner-param-field">
                <label>Goal Bias</label>
                <input class="planner-rrt-goal-bias" type="number" />
              </div>
              <div class="planner-param-field">
                <label>Max Iter</label>
                <input class="planner-rrt-max-iter" type="number" />
              </div>
            </div>
          </details>
          <div class="planner-status"></div>
          <div class="planner-result"></div>
        `;
        container.appendChild(card);
      }

      const title = card.querySelector(".planner-dom-card-title");
      const removeButton = card.querySelector(".card-remove");
      const accent = card.querySelector(".planner-dom-accent");
      const algorithmSelect = card.querySelector(".planner-algorithm-select");
      const showVisitedInput = card.querySelector(".planner-show-visited");
      const showVisitedLabel = card.querySelector(".planner-show-visited-label");
      const rrtDetails = card.querySelector(".planner-rrt-details");
      const rrtExpand = card.querySelector(".planner-rrt-expand");
      const rrtGoalBias = card.querySelector(".planner-rrt-goal-bias");
      const rrtMaxIter = card.querySelector(".planner-rrt-max-iter");
      const status = card.querySelector(".planner-status");
      const result = card.querySelector(".planner-result");

      title.textContent = `Planner ${planner.id}`;
      accent.style.background = planner.color_hex;

      if (!removeButton.dataset.bound) {
        removeButton.addEventListener("click", () => {
          dispatchEmbedAction({
            type: "remove_path_planner",
            planner_id: planner.id,
          });
        });
        removeButton.dataset.bound = "1";
      }
      removeButton.style.display = (payload.planner_count || 0) > 1 ? "" : "none";

      setSelectOptionsIfIdle(algorithmSelect, availableAlgorithms, planner.algorithm);
      if (!algorithmSelect.dataset.bound) {
        algorithmSelect.addEventListener("change", () => {
          dispatchEmbedAction({
            type: "set_path_planner_algorithm",
            planner_id: planner.id,
            algorithm: algorithmSelect.value,
          });
        });
        algorithmSelect.dataset.bound = "1";
      }

      showVisitedLabel.textContent = planner.show_visited_label;
      if (document.activeElement !== showVisitedInput) {
        showVisitedInput.checked = Boolean(planner.show_visited);
      }
      if (!showVisitedInput.dataset.bound) {
        showVisitedInput.addEventListener("change", () => {
          dispatchEmbedAction({
            type: "set_path_planner_show_visited",
            planner_id: planner.id,
            show_visited: showVisitedInput.checked,
          });
        });
        showVisitedInput.dataset.bound = "1";
      }

      const isRrt = planner.algorithm === "rrt";
      rrtDetails.hidden = !isRrt;
      if (isRrt) {
        syncRrtField(rrtExpand, planner.id, "rrt_expand_dist", planner.rrt_expand_dist, {
          min: 0.1,
          max: 5,
          step: 0.1,
        });
        syncRrtField(
          rrtGoalBias,
          planner.id,
          "rrt_goal_sample_rate",
          planner.rrt_goal_sample_rate,
          {
            min: 0,
            max: 1,
            step: 0.01,
          },
        );
        syncRrtField(rrtMaxIter, planner.id, "rrt_max_iter", planner.rrt_max_iter, {
          min: 100,
          max: 5000,
          step: 1,
          parser: (raw) => Number.parseInt(raw, 10),
        });
      }

      status.textContent = planner.status;

      if (planner.result) {
        const lines = [];
        if (planner.result.success && planner.result.path_length !== null) {
          lines.push(`Path: ${Number(planner.result.path_length).toFixed(2)}`);
        } else if (!planner.result.success) {
          lines.push("No path found");
        }
        if (
          planner.result.success &&
          planner.result.optimality_ratio !== null &&
          planner.result.optimality_ratio !== undefined
        ) {
          lines.push(`Ratio: ${Number(planner.result.optimality_ratio).toFixed(2)}`);
        }
        lines.push(`Iter: ${planner.result.iterations}`);
        lines.push(`Plan: ${Number(planner.result.plan_time_ms).toFixed(1)} ms`);
        result.textContent = lines.join(" · ");
      } else {
        result.textContent = "";
      }

      existing.delete(planner.id);
    }

    for (const staleCard of existing.values()) {
      staleCard.remove();
    }
  }

  function syncToolbar(state) {
    const payload = state?.payload;
    if (!state || state.mode !== "path_planning" || !payload || payload.kind !== "path_planning") {
      return;
    }

    const snapshot = JSON.stringify({
      paused: state.paused,
      sim_speed: state.toolbar.sim_speed,
      env_mode: payload.env_mode,
      continuous_obstacle_radius: payload.continuous_obstacle_radius,
      planner_count: payload.planner_count,
      planners: payload.planners,
    });

    if (snapshot === lastToolbarStateJson) {
      return;
    }
    lastToolbarStateJson = snapshot;

    const ui = elements();
    setInputValueIfIdle(ui.speed, state.toolbar.sim_speed);
    ui.speedValue.textContent = `${state.toolbar.sim_speed}x`;
    setSelectOptionsIfIdle(
      ui.envMode,
      [
        { value: "grid", label: "Grid" },
        { value: "continuous", label: "Continuous" },
      ],
      payload.env_mode,
    );

    const showRadius = payload.env_mode === "continuous";
    ui.radiusWrap.hidden = !showRadius;
    setInputValueIfIdle(ui.radius, Number(payload.continuous_obstacle_radius).toFixed(2));
    ui.radiusValue.textContent = Number(payload.continuous_obstacle_radius).toFixed(2);
    ui.plannerCount.textContent = `${payload.planner_count} planner${payload.planner_count === 1 ? "" : "s"}`;

    syncPlannerCards(ui.cards, payload);
    window.requestAnimationFrame(postPathPlanningHeight);
  }

  const poller = createStatePollingLoop({
    getState: getEmbedState,
    onState: syncToolbar,
  });

  function init() {
    const ui = elements();

    ui.restart.addEventListener("click", () => {
      dispatchEmbedAction({ type: "restart" });
    });
    ui.addPlanner.addEventListener("click", () => {
      dispatchEmbedAction({ type: "add_active_simulation" });
    });
    ui.speed.addEventListener("input", () => {
      const value = Number.parseInt(ui.speed.value, 10);
      ui.speedValue.textContent = `${value}x`;
      dispatchEmbedAction({ type: "set_sim_speed", sim_speed: value });
    });
    ui.envMode.addEventListener("change", () => {
      dispatchEmbedAction({
        type: "set_path_planning_env_mode",
        mode: ui.envMode.value,
      });
    });
    ui.radius.addEventListener("input", () => {
      const value = Number.parseFloat(ui.radius.value);
      ui.radiusValue.textContent = value.toFixed(2);
      dispatchEmbedAction({
        type: "set_path_planning_continuous_obstacle_radius",
        radius: value,
      });
    });

    bindPathPlanningHeightObservers();
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
