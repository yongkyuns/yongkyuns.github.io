function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resolvedSimBase() {
  const params = new URLSearchParams(window.location.search);
  const explicit = params.get("sim_base");
  if (explicit) {
    return explicit;
  }

  const host = window.location.hostname;
  if (host === "127.0.0.1" || host === "localhost") {
    return "http://127.0.0.1:3000/";
  }

  return "/sim/";
}

function ensureFrameSrc(frame) {
  if (frame.dataset.srcInitialized === "1") {
    return;
  }

  const simPath = frame.dataset.simPath;
  if (!simPath) {
    frame.dataset.srcInitialized = "1";
    return;
  }

  try {
    const url = new URL(simPath, resolvedSimBase());
    frame.setAttribute("src", url.toString());
    frame.dataset.srcInitialized = "1";
  } catch (_error) {
    // Ignore malformed runtime embed paths.
  }
}

function preferredEmbedHeight(width, mode) {
  const viewportHeight = window.innerHeight || 900;
  const modeFloor = {
    inverted_pendulum: 680,
    localization: 700,
    path_planning: 720,
    slam: 720,
    robot: 780,
  };

  const minHeight = (modeFloor[mode] || 700) + (width < 760 ? 80 : 0);
  let preferred;

  if (width < 760) {
    preferred = width * 1.18;
  } else if (width < 1100) {
    preferred = width * 0.9;
  } else {
    preferred = width * 0.66;
  }

  if (mode === "robot") {
    preferred += 50;
  }

  const maxHeight = Math.max(minHeight, Math.min(viewportHeight * 0.9, 980));
  return Math.round(clamp(preferred, minHeight, maxHeight));
}

function updateEmbedFrame(frame) {
  if (frame.dataset.heightReported === "1") {
    return;
  }

  const width = frame.getBoundingClientRect().width;
  if (!width) {
    return;
  }

  const mode = frame.dataset.simMode || "default";
  frame.style.height = `${preferredEmbedHeight(width, mode)}px`;
}

function seedFrameTheme(frame) {
  if (frame.dataset.themeSeeded === "1") {
    return;
  }

  ensureFrameSrc(frame);
  const src = frame.getAttribute("src");
  if (!src) {
    return;
  }

  try {
    const url = new URL(src, window.location.href);
    url.searchParams.set("theme", resolvedHostTheme());
    frame.dataset.themeSeeded = "1";
    frame.setAttribute("src", url.toString());
  } catch (_error) {
    // Ignore malformed or non-standard iframe src values.
  }
}

function bindEmbedFrame(frame) {
  const update = () => updateEmbedFrame(frame);
  frame.dataset.heightReported = "";
  ensureFrameSrc(frame);
  seedFrameTheme(frame);
  update();
  frame.addEventListener("load", () => postThemeToFrame(frame));

  if (typeof ResizeObserver !== "undefined") {
    const target = frame.parentElement || frame;
    const observer = new ResizeObserver(update);
    observer.observe(target);
  }

  window.addEventListener("resize", update, { passive: true });
}

function resolvedHostTheme() {
  const candidates = [
    document.documentElement?.dataset?.theme,
    document.body?.dataset?.theme,
    document.documentElement?.getAttribute("data-theme"),
    document.body?.getAttribute("data-theme"),
  ];

  for (const candidate of candidates) {
    if (candidate === "light" || candidate === "dark") {
      return candidate;
    }
  }

  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function postThemeToFrame(frame) {
  try {
    frame.contentWindow?.postMessage(
      {
        type: "rust-robotics-theme",
        theme: resolvedHostTheme(),
      },
      "*",
    );
  } catch (_error) {
    // Ignore transient cross-document startup races.
  }
}

function postThemeToAllFrames() {
  document.querySelectorAll(".sim-embed-frame").forEach(postThemeToFrame);
}

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "rust-robotics-embed-size" || typeof data.height !== "number") {
    return;
  }

  const frames = [...document.querySelectorAll(".sim-embed-frame")];
  const targetFrames = frames.filter((frame) => {
    try {
      return frame.contentWindow === event.source;
    } catch (_error) {
      return false;
    }
  });
  const framesToUpdate = targetFrames.length > 0 ? targetFrames : frames;

  for (const frame of framesToUpdate) {
    const reportedHeight = Math.round(clamp(data.height, 480, 2000));
    frame.dataset.heightReported = "1";
    frame.style.height = `${reportedHeight}px`;
  }
});

function initializeEmbedFrames() {
  document.querySelectorAll(".sim-embed-frame").forEach(bindEmbedFrame);
  postThemeToAllFrames();

  if (typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver(() => {
      postThemeToAllFrames();
    });
    if (document.documentElement) {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "class"],
      });
    }
    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-theme", "class"],
      });
    }
  }

  if (window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const listener = () => postThemeToAllFrames();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", listener);
    } else if (typeof media.addListener === "function") {
      media.addListener(listener);
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeEmbedFrames, { once: true });
} else {
  initializeEmbedFrames();
}
