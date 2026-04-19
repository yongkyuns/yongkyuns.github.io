# Project Overview

Rust Robotics has two practical goals:

1. provide a reusable library of robotics algorithms
2. provide interactive simulators that make those algorithms easier to learn,
   test, and compare

The project is meant to stay technically straightforward. It is not trying to
be a framework for its own sake, and the documentation should not require the
reader to understand repository structure before learning the actual robotics
content.

## What this site is for

This documentation is written to be useful to both:

- beginners who want clear explanations and intuition
- experienced engineers who want practical tradeoffs, assumptions, and runtime implications

The main questions the site should answer are:

- what problem does this algorithm solve?
- what assumptions does it make?
- where is it used in practice?
- what are its computational and memory costs?
- how does it compare to related algorithms?
- what should you look for in the interactive simulation?

## The two halves of the project

### Algorithms library

The library side of the project collects implementations of:

- control algorithms
- localization methods
- planning methods
- SLAM-related methods
- robot runtime logic and policy execution support

The point is not only to have working code. The point is to have implementations
that are portable enough to be used across:

- native runs
- browser runs
- interactive demos
- and, where reasonable, more deployment-oriented environments

### Interactive simulation layer

The simulation side exists because robotics becomes easier to understand when
you can manipulate the problem directly. Reading equations is important, but
many ideas only become intuitive when you can see them:

- overshoot and settling in control
- uncertainty spread in localization
- search effort in planning
- drift and correction in SLAM
- end-to-end policy execution in robot control

Interactivity is a teaching tool, not an afterthought.

## How to read the tutorials

Each tutorial is intended to answer four layers of questions:

1. the problem definition
2. the theory and assumptions
3. the practical tradeoffs
4. the visible behavior in the simulator

That means the tutorials emphasize:

- theory
- comparison
- complexity
- memory use
- practical applications
- common mistakes

They deliberately avoid spending too much time on internal project architecture.
Rustdoc and source comments are better places for crate-level implementation
details.

## Minimal mental model of the project

The project still has several crates, but for documentation purposes the simpler
mental model is usually enough:

::::{grid} 1 1 2 2
:gutter: 2

:::{grid-item-card} Algorithms
:class-card: module-card

Reusable robotics methods and shared runtime logic.
:::

:::{grid-item-card} Training
:class-card: module-card

Learning-oriented policy optimization and model export.
:::

:::{grid-item-card} Shared portable data
:class-card: module-card

The small types that move snapshots and metrics between project components.
:::

:::{grid-item-card} Interactive simulation
:class-card: module-card

Native and web simulator surfaces for learning, testing, and exploration.
:::
::::

For most readers, that is enough context. The core value of the site should be
the robotics material itself.
