# Introducing Rust Robotics

```{raw} html
<div class="article-hero">
  <div class="article-kicker">Project essay</div>
  <div class="article-subtitle">
    A project about portable robotics algorithms, interactive simulation, and using live systems as a teaching medium.
  </div>
  <div class="article-meta">
    By Yongkyun Shin • 15 Apr 2026
  </div>
</div>
```

```{admonition} In one sentence
:class: note-shell

Rust Robotics is an attempt to make robotics algorithms reusable, interactive,
and accessible across native and web environments without reducing the project
to either a static library or a simulator demo.
```

Rust Robotics started from a practical gap. Many robotics resources do one thing
well but leave the other half unfinished.

- some are good algorithm references but hard to interact with
- some are polished simulators but not good teaching material
- some are good one-off experiments but hard to reuse
- some are interesting demos but difficult to port or extend

The project exists to connect those pieces instead of choosing only one.

## Two products, one project

Rust Robotics has two equally important outputs.

The first is a library-oriented body of robotics code: controllers, planners,
filters, SLAM components, and robot runtime logic that should remain reusable
instead of being buried inside one application.

The second is an interactive simulation layer that turns those ideas into
something explorable. The simulator is not only a visual wrapper. It is part of
the teaching method. It lets a learner see:

- overshoot instead of just reading about it
- uncertainty spread instead of only plotting equations
- path search effort instead of only discussing admissibility
- drift and correction instead of only reading SLAM derivations

The useful part of the project is the link between the two.

## Why portability matters here

Portability is one of the core ideas of the project. That word can sound like a
software architecture preference, but it is more than that.

Portable implementations matter because they lower friction in three ways:

1. they make it easier to move from experiment to a more realistic runtime
2. they make it easier to compare behavior across native and web environments
3. they make educational material more accessible to people who cannot or do
   not want to set up a full native robotics stack

For a learning-oriented project, this is a big deal. If the same idea can be
studied in a browser, on a desktop, and in code, the entry barrier drops.

## Why interactivity matters just as much

Robotics is one of those subjects where the gap between formulas and behavior is
large. Many ideas sound clear in notation and then feel confusing in motion.

That is why interactivity is treated here as a principle rather than an extra:

- a good controller explanation should invite disturbance and retuning
- a localization explanation should make uncertainty visible
- a planning explanation should expose search patterns and tradeoffs
- a SLAM explanation should make drift and correction intuitive

The simulator is not there merely to decorate the documentation. It is there to
make the documentation more truthful.

## What this site should feel like

The long-term ambition for this documentation is not project notes for people
already inside the repo. It is closer to a compact textbook:

- enough mathematical detail to be useful
- enough runtime detail to be honest
- enough visual experimentation to support intuition
- enough narrative structure to help both students and professionals

::::{grid} 1 1 2 2
:gutter: 2

:::{grid-item-card} Algorithms
:class-card: module-card

Portable implementations of robotics methods such as control, localization,
planning, SLAM, and robot behavior semantics.
:::

:::{grid-item-card} Training
:class-card: module-card

Learning-oriented runtime for policy optimization and model training.
:::

:::{grid-item-card} Shared runtime DTOs
:class-card: module-card

Portable shared representations that let snapshots and metrics move cleanly
between parts of the project.
:::

:::{grid-item-card} Interactive simulator
:class-card: module-card

Interactive simulation for native and web-based exploration.
:::
::::

## Why Rust

Rust is a good fit here for reasons that are more specific than general
language preference.

First, the project benefits from explicit boundaries between reusable logic and
environment-specific runtime code. Rust makes those boundaries concrete instead
of leaving them as convention.

Second, many of the interesting robotics seams are exactly the kind of seams
Rust handles well:

- native versus web runtime
- simulator world versus algorithm logic
- learned policies versus analytical control laws
- interactive experimentation versus reusable library code

Third, the project wants to stay close to practical deployment concerns even
when the simulator is the most visible part. Robotics software rarely stops at
the equation. It has to live inside a runtime.

## What readers should expect next

The direction of the documentation site is straightforward:

- deeper tutorials that read like compact textbook chapters
- stronger focus on complexity, memory, and practical behavior
- better interpretation of simulator output
- enough implementation detail to stay honest, but not so much that the reader
  has to study the repo structure before learning the robotics content

The source already contains technical details. The role of this site is to turn
those details into guided understanding.
