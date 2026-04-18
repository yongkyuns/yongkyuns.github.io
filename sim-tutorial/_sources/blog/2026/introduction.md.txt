# Introducing Rust Robotics

```{raw} html
<div class="article-hero">
  <div class="article-kicker">Architecture note</div>
  <div class="article-subtitle">
    A Rust workspace for reusable robotics algorithms, interactive simulation, and deployable policy execution.
  </div>
  <div class="article-meta">
    By Yongkyun Shin • 15 Apr 2026
  </div>
</div>
```

```{admonition} In one sentence
:class: note-shell

Rust Robotics is an attempt to keep algorithms, training, simulation, and deployment-oriented runtime boundaries in one coherent Rust workspace without collapsing them into one application crate.
```

Rust Robotics started from a practical gap: there are many good robotics
examples, many good simulation environments, and many good one-off control
implementations, but they are often hard to compare, hard to reuse, and hard to
move between interactive exploration and something closer to deployment.

The goal of this repo is to keep those pieces in one coherent workspace.

- `rust_robotics_algo` holds the reusable robotics logic
- `rust_robotics_train` holds the policy-training runtime
- `rust_robotics_core` holds the portable model handoff types
- `rust_robotics_sim` holds the actual simulator, UI, and MuJoCo world

That split matters because the repo is not just a simulator and it is not just
an algorithms library. The useful part is the connection between the two.

## The Workspace At A Glance

::::{grid} 1 1 2 2
:gutter: 2

:::{grid-item-card} Algorithms
:class-card: module-card

`rust_robotics_algo` owns reusable robotics logic: control, localization,
planning, SLAM, and robot framework semantics.
:::

:::{grid-item-card} Training
:class-card: module-card

`rust_robotics_train` owns PPO training runtime and model optimization.
:::

:::{grid-item-card} Shared runtime DTOs
:class-card: module-card

`rust_robotics_core` owns portable snapshots and metrics used across crates.
:::

:::{grid-item-card} Interactive simulator
:class-card: module-card

`rust_robotics_sim` owns the app shell, MuJoCo world, stepping, rendering, and UI.
:::
::::

## The Core Idea

The central architectural rule is:

> the simulator owns the world, and the algorithm crate owns robotics semantics

That means MuJoCo model/data, viewport state, stepping, and reset live in the
simulator crate, while command semantics, observations, recurrent state, action
decoding, and robot-controller logic live in the shared robotics crate.

This gives the repo a cleaner data flow:

1. the world produces raw runtime state
2. the robot framework converts that into an observation
3. an inference backend produces a policy output
4. the robot framework decodes that output into actuation
5. the simulator applies the actuation back into the world

The result is that native and web paths can share the controller logic even when
they do not share the renderer or runtime internals.

## A Workspace, Not A Single App

The pendulum path shows why the workspace split is useful.

The same task can be:

- controlled with LQR, PID, or MPC from `rust_robotics_algo`
- trained with PPO from `rust_robotics_train`
- exported as a portable `PolicySnapshot` from `rust_robotics_core`
- executed inside the interactive app in `rust_robotics_sim`

That makes the project useful both as:

- a teaching and visualization tool
- a regression harness for algorithm changes
- a place to compare classical and learned controllers under the same plant

```{admonition} Why this architecture is useful
:class: note-shell

The same pendulum task can be controlled with LQR, PID, or MPC from `rust_robotics_algo`, trained with PPO in `rust_robotics_train`, serialized in `rust_robotics_core`, and executed in the interactive UI from `rust_robotics_sim`.
```

## Why Rust

Rust is a good fit here for reasons that are more specific than general
language preference.

First, the repo benefits from explicit crate boundaries. This workspace wants a
real distinction between reusable algorithms, training runtime, simulator UI,
and portable shared types. Rust makes that separation cheap and visible.

Second, the code is full of "almost shared, but not quite" responsibilities:
native vs web runtime, MuJoCo world vs robot semantics, learned policy vs
classical control, dense math vs UI state. Rust pushes those seams into actual
types and modules instead of leaving them as conventions.

Third, the project wants to stay close to deployment concerns. Even when the
simulator is the visible product, the interesting work is usually at the
boundary where control, inference, and world state meet.

## What Comes Next

The next stage for this documentation site is straightforward:

- architecture pages for `algo`, `sim`, `train`, and `core`
- longer writeups for the pendulum, robot framework, and MuJoCo integration
- generated API links where they add value
- implementation notes for the native/web split

The repo already has a lot of technical content in source comments and rustdoc.
This site is the place to turn that into a guided narrative instead of expecting
readers to assemble the whole system from the code alone.
