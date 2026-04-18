# Tutorials

Topic-focused walkthroughs that connect the live simulator to the underlying
theory, derivations, and implementation boundaries in the repo.

```{admonition} Running the live embeds
:class: note-shell

The embedded simulator frames resolve their base URL at runtime:

- local preview on `localhost` / `127.0.0.1`: `http://127.0.0.1:3000/`
- hosted pages: `/sim/`

You can override that explicitly with `?sim_base=...` on the tutorial URL if needed.

Typical local workflow:

1. run `./build_web.sh --fast`
2. run `./start_server.sh`
3. rebuild this docs site with `./scripts/build_docs_site.sh`
```

::::{grid} 1 1 2 2
:gutter: 2

:::{grid-item-card} Control Systems
:class-card: tutorial-card

Linearization, PID, LQR, MPC, and PPO viewed through the inverted-pendulum demo.

{doc}`pendulum`
:::

:::{grid-item-card} Localization
:class-card: tutorial-card

Bayesian state estimation, particle weighting, resampling, and drift recovery.

{doc}`localization`
:::

:::{grid-item-card} Path Planning
:class-card: tutorial-card

Heuristic search, geometric shortcuts, and sampling-based planning in one comparison harness.

{doc}`path_planning`
:::

:::{grid-item-card} SLAM
:class-card: tutorial-card

Pose-and-map coupling, covariance growth, and optimization-based correction.

{doc}`slam`
:::

:::{grid-item-card} Robot Runtime
:class-card: tutorial-card

Observation building, policy inference, and actuation decode across the MuJoCo runtime boundary.

{doc}`robot`
:::
::::

## Why tutorials here

The rustdoc explains the implementation in-place. These pages connect the math,
the modeling assumptions, and the visible simulator behavior so a reader can go
from theory to live system without reconstructing the pipeline from source.

```{toctree}
:maxdepth: 2
:hidden:

pendulum
localization
path_planning
slam
robot
```
