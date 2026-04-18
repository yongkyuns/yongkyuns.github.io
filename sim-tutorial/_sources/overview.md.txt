# Project Overview

Rust Robotics is organized around four explicit responsibilities.

::::{grid} 1 1 2 2
:gutter: 2

:::{grid-item-card} `rust_robotics_algo`
:class-card: module-card

Reusable robotics algorithms, robot-framework logic, control models, localization,
planning, and SLAM.
:::

:::{grid-item-card} `rust_robotics_core`
:class-card: module-card

Portable DTOs that let policies and training state cross crate boundaries without
pulling the full runtime with them.
:::

:::{grid-item-card} `rust_robotics_train`
:class-card: module-card

PPO training runtime, environment rollouts, Burn model ownership, and snapshot export.
:::

:::{grid-item-card} `rust_robotics_sim`
:class-card: module-card

Interactive app shell, simulator orchestration, MuJoCo world ownership, and native/web runtime glue.
:::
::::

## The Main Design Rule

The architecture is centered on one boundary:

- the simulator owns the world
- the algorithm crate owns robotics semantics
- the training crate owns optimization
- the core crate owns portable handoff data

That split is what allows the same policy to be trained in one crate, exported
as a portable snapshot, and executed from both native and web simulator paths.

## Why this matters

Without that separation, robotics repos tend to collapse into one large
application crate where world state, controller semantics, training code, and UI
assumptions are mixed together. This workspace is trying to avoid that.

The benefit is not abstraction for its own sake. The benefit is that each layer
has a more stable job:

- simulation can change its renderer or viewport
- algorithms can change their internal math or state conventions
- training can change optimizers or model implementations
- the handoff between them can stay explicit and testable

## Documentation direction

This docs site is intended to grow around those boundaries:

- architecture pages for each crate
- implementation essays for the pendulum path, robot framework, and MuJoCo runtime
- higher-level onboarding pages that explain how to navigate the repo

The source code and rustdoc already carry detailed implementation comments. This
site is the narrative layer on top of that.
