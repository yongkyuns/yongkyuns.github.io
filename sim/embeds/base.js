export function setInputValueIfIdle(input, value) {
  if (!input || document.activeElement === input) {
    return;
  }
  input.value = String(value);
}

export function createStatePollingLoop({ getState, onState, intervalMs = 200 }) {
  let timer = null;

  return {
    start() {
      if (timer !== null) {
        return;
      }
      timer = window.setInterval(() => {
        try {
          const state = getState();
          onState(state);
        } catch (_error) {
          // Ignore transient startup races while the wasm app finishes booting.
        }
      }, intervalMs);
    },
    stop() {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    },
  };
}

export function measureVisibleBodyHeight({ extraBottom = 0 } = {}) {
  const body = document.body;
  if (!body) {
    return null;
  }

  const bodyRect = body.getBoundingClientRect();
  const bodyStyle = window.getComputedStyle(body);
  const bodyPaddingBottom = Number.parseFloat(bodyStyle.paddingBottom) || 0;
  const measuredHeight = Math.ceil(
    [...body.children]
      .filter((child) => child instanceof HTMLElement && child.offsetParent !== null)
      .reduce((maxBottom, child) => {
        const childBottom = child.getBoundingClientRect().bottom - bodyRect.top;
        return Math.max(maxBottom, childBottom);
      }, 0) + bodyPaddingBottom,
  );

  const height = measuredHeight + extraBottom;
  if (!Number.isFinite(height) || height <= 0) {
    return null;
  }
  return height;
}

export function bindEmbedHeightObservers({
  observeTargets,
  onMeasure,
  observerFlag = "embedHeightObserverBound",
}) {
  if (document.documentElement.dataset[observerFlag] === "1") {
    return;
  }
  document.documentElement.dataset[observerFlag] = "1";

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(onMeasure);
    });
    for (const target of observeTargets()) {
      if (target) {
        observer.observe(target);
      }
    }
  }

  if (typeof MutationObserver !== "undefined" && document.body) {
    const mutationObserver = new MutationObserver(() => {
      window.requestAnimationFrame(onMeasure);
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }
}
