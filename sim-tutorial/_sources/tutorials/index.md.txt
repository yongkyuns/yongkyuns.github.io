# Tutorials

The tutorial pages are the main content of this site. Each tutorial is intended
to explain:

- the robotics problem
- the main algorithms used for that problem
- where those algorithms are used
- how those algorithms compare
- what they cost in compute and memory
- what to look for in the live simulator

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

## Tutorial structure

Each chapter is organized around four layers:

1. the robotics problem itself
2. the mathematical formulation and key assumptions
3. the computational tradeoffs such as time complexity, memory use, and runtime behavior
4. the observable effects in the interactive simulator

That structure matters because robotics learning often breaks down at the gap
between the equation and the actual behavior. The simulator is there to close
that gap.

This is deliberate. The goal is to keep the notes useful both as learning
material and as a practical reference.

::::{grid} 1 1 2 2
:gutter: 2

:::{grid-item-card} Control Systems
:class-card: tutorial-card

Linearization, feedback, optimal control, and reinforcement learning viewed
through an inverted pendulum that is small enough to reason about by hand and
rich enough to expose meaningful tradeoffs.

{doc}`pendulum`
:::

:::{grid-item-card} Localization
:class-card: tutorial-card

Bayesian state estimation, particle weighting, resampling, uncertainty
propagation, and the practical limits of noisy sensing.

{doc}`localization`
:::

:::{grid-item-card} Path Planning
:class-card: tutorial-card

Graph search, heuristics, any-angle shortcuts, and sampling-based planning in a
single environment where path quality and search effort can be compared side by side.

{doc}`path_planning`
:::

:::{grid-item-card} SLAM
:class-card: tutorial-card

Joint pose-and-map estimation, covariance coupling, drift accumulation, loop
closure intuition, and the difference between filter and graph viewpoints.

{doc}`slam`
:::

:::{grid-item-card} Robot Runtime
:class-card: tutorial-card

An end-to-end view of simulated robot control: observations, actions, policy
execution, timing, portability, and what changes when an algorithm moves from a
toy example to a more realistic runtime loop.

{doc}`robot`
:::
::::

## Suggested order

If you want a structured learning sequence:

1. start with control systems
2. continue with localization
3. move to path planning
4. then study SLAM
5. finish with the robot tutorial to connect the ideas to a richer runtime

That order roughly follows increasing model complexity and increasing coupling
between estimation, planning, and control.

## What these tutorials are not

They are not meant to be exhaustive research surveys, and they are not meant to
mirror every internal UI option in the simulator. The goal is to explain the
core algorithms clearly and compare them in a practical way.

```{toctree}
:maxdepth: 2
:hidden:

pendulum
localization
path_planning
slam
robot
```
