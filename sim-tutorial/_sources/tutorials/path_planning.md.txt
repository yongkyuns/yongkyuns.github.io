# Path Planning Tutorial

The path-planning demo is the easiest place to compare search behavior across
different environments and algorithm assumptions.

```{raw} html
<div class="sim-embed-card">
  <iframe
    class="sim-embed-frame"
    data-sim-mode="path_planning"
    data-sim-path="?mode=path_planning&embed=focused&ui=20260416b"
    title="Rust Robotics path planning simulator"
    loading="lazy"
  ></iframe>
</div>
```

## The planning problem

Path planning is an optimization problem over feasible trajectories. In the
simplest discrete case, the planner is minimizing cumulative cost from a start
node to a goal node while respecting obstacle constraints.

## Theoretical derivations

### Dijkstra and A*

Dijkstra expands nodes in order of path cost `g(n)`. A* adds a heuristic
estimate `h(n)` and ranks candidates by:

$$
f(n) = g(n) + h(n)
$$

If `h(n)` is admissible, A* preserves optimality while usually exploring fewer
states than Dijkstra.

### Theta*

Theta* keeps the A* search structure but allows line-of-sight shortcuts between
parents and descendants. The effect is that the solution path can become less
"grid stair-stepped" without abandoning the graph-search framing.

### RRT

RRT changes the problem entirely. Instead of exhaustively expanding a structured
graph, it samples free space, connects toward samples, and grows a tree. It is
useful when the search space is continuous or the environment is awkward for a
uniform grid representation.

## What this simulator is for

It is useful for comparing:

- graph-based vs continuous planning
- obstacle-density sensitivity
- resolution tradeoffs
- path quality vs search effort

## What to look at

- whether the path hugs obstacles or keeps useful clearance
- how path shape changes when you switch environment representation
- how grid resolution affects both path quality and search complexity
- which algorithms recover gracefully when the scene gets cluttered

## Try this

1. Start with a sparse map and compare the shortest path to the smoothest path.
2. Increase obstacle density and look for search patterns that degrade first.
3. Change environment mode and compare how the same start/goal pair behaves.
4. Add another planner instance to compare results side by side.

## Implementation mapping

The planner implementations live in `rust_robotics_algo`, but the multi-planner
coordination, scene editing, and synchronized simulator controls live in
`rust_robotics_sim`. That keeps the algorithms reusable while still letting the
app act as a comparison harness.
