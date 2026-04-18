import {
  bindEmbedHeightObservers,
  createStatePollingLoop,
  measureVisibleBodyHeight,
  setInputValueIfIdle,
} from "./base.js";

export function setupRobotEmbed({ getEmbedState, dispatchEmbedAction }) {
  let lastToolbarStateJson = "";

  function elements() {
    return {
      toolbar: document.getElementById("embed_robot_toolbar"),
      pause: document.getElementById("robot_toolbar_pause_button"),
      restart: document.getElementById("robot_toolbar_restart_button"),
      resetView: document.getElementById("robot_toolbar_reset_view_button"),
      speed: document.getElementById("robot_toolbar_speed_input"),
      speedValue: document.getElementById("robot_toolbar_speed_value"),
      robot: document.getElementById("robot_toolbar_robot_select"),
      status: document.getElementById("robot_status_text"),
    };
  }

  function postRobotHeight() {
    if (!document.documentElement.classList.contains("embedded-robot-dom")) {
      return;
    }
    const height = measureVisibleBodyHeight();
    if (!height || !window.parent || window.parent === window) {
      return;
    }
    window.parent.postMessage(
      {
        type: "rust-robotics-embed-size",
        mode: "robot",
        height,
      },
      "*",
    );
  }

  function bindRobotHeightObservers() {
    if (!document.documentElement.classList.contains("embedded-robot-dom")) {
      return;
    }
    bindEmbedHeightObservers({
      observeTargets: () => [
        document.body,
        document.getElementById("embed_robot_toolbar"),
        document.getElementById("embed_robot_cards"),
        document.getElementById("canvas_shell"),
      ],
      onMeasure: postRobotHeight,
      observerFlag: "robotEmbedHeightObserverBound",
    });
  }

  function syncToolbar(state) {
    const payload = state?.payload;
    if (!state || state.mode !== "robot" || !payload || payload.kind !== "robot") {
      return;
    }

    const snapshot = JSON.stringify({
      paused: state.paused,
      sim_speed: state.toolbar.sim_speed,
      robot: payload.robot,
    });
    if (snapshot === lastToolbarStateJson) {
      return;
    }
    lastToolbarStateJson = snapshot;

    const ui = elements();
    ui.pause.textContent = state.paused ? "Play" : "Pause";
    setInputValueIfIdle(ui.speed, state.toolbar.sim_speed);
    ui.speedValue.textContent = `${state.toolbar.sim_speed}x`;
    if (document.activeElement !== ui.robot) {
      ui.robot.value = payload.robot.selected_robot;
    }
    ui.status.textContent = `${payload.robot.robot_label}\nPolicy: ${payload.robot.policy_label}\n${payload.robot.status}`;
    window.requestAnimationFrame(postRobotHeight);
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
    ui.resetView.addEventListener("click", () => {
      dispatchEmbedAction({ type: "reset_mujoco_view" });
    });
    ui.speed.addEventListener("input", () => {
      const value = Number.parseInt(ui.speed.value, 10);
      ui.speedValue.textContent = `${value}x`;
      dispatchEmbedAction({ type: "set_sim_speed", sim_speed: value });
    });
    ui.robot.addEventListener("change", () => {
      dispatchEmbedAction({ type: "set_mujoco_robot", robot: ui.robot.value });
    });

    bindRobotHeightObservers();
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
