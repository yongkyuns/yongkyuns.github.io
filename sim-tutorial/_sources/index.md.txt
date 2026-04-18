# Rust Robotics

```{raw} html
<section class="hero-band">
  <div class="hero-kicker">Documentation</div>
  <h1 class="hero-title">Rust Robotics</h1>
  <p class="hero-lead">
    A documentation site for a Rust workspace focused on reusable robotics algorithms,
    interactive simulation, policy training, and deployable runtime boundaries.
  </p>
</section>
```

::::{grid} 1 1 2 2
:gutter: 3

:::{grid-item-card} Workspace architecture
:class-card: landing-card

Understand how `rust_robotics_algo`, `rust_robotics_core`,
`rust_robotics_train`, and `rust_robotics_sim` fit together.

{doc}`overview`
:::

:::{grid-item-card} Blog and writeups
:class-card: landing-card

Read long-form documentation pages written as project notes, architecture essays,
and implementation walkthroughs.

{doc}`blog/index`
:::

:::{grid-item-card} Interactive tutorials
:class-card: landing-card

Follow simulator-specific walkthroughs and open the live egui app directly from
the documentation pages.

{doc}`tutorials/index`
:::
::::

```{admonition} Why this site exists
:class: note-shell

This site is separate from the repo's existing `docs/` folder.

In this repository:

- `docs/` is the built simulator web bundle used for GitHub Pages hosting
- `site_docs/` is the authored documentation source for project pages like this one
```

```{toctree}
:maxdepth: 2
:hidden:

overview
blog/index
tutorials/index
```
