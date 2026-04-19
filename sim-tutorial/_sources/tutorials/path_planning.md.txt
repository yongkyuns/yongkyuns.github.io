# Path Planning Tutorial

Path planning is the problem of finding a feasible route from a start state to
a goal state while optimizing some notion of quality, such as length, smoothness,
clearance, or search effort. This tutorial compares several planning ideas in
the same environment so their behavior can be studied side by side.

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

## Learning goals

This chapter is designed to help you answer:

- what makes graph search different from sampling-based planning?
- what do heuristics really buy you?
- why are some paths optimal but visually awkward?
- how do complexity and memory usage change across planners?
- how should you interpret planner behavior when the map gets cluttered?

## Where these planners are used

- Dijkstra and A*:
  navigation on roadmaps, occupancy grids, tile maps, and graph-structured motion problems
- Theta*:
  grid-based systems where path shape matters but a full continuous planner is unnecessary
- RRT:
  continuous configuration spaces, motion planning, kinodynamic and high-dimensional planning families

## The planning problem

Path planning is an optimization problem over feasible trajectories. In the
simplest discrete case, the planner is minimizing cumulative cost from a start
node to a goal node while respecting obstacle constraints.

The exact form of the problem depends on how the environment is represented:

- as a graph or grid
- as a continuous geometric space
- as a state lattice with motion constraints

This tutorial compares planners that sit at different points on that spectrum.

## Dijkstra and A*: optimal graph search

Dijkstra expands nodes in order of accumulated cost `g(n)`. It is complete and
optimal for nonnegative edge costs, but it can waste significant work because
it has no notion of how promising a state is with respect to the goal.

A* adds a heuristic `h(n)` and ranks candidates by:

$$
f(n) = g(n) + h(n)
$$

If `h(n)` is admissible, A* preserves optimality while usually exploring fewer
states than Dijkstra.

### Complexity and memory

Using a priority queue, both algorithms are commonly described as roughly
`O(E log V)` on a graph with `V` vertices and `E` edges, though actual behavior
depends strongly on the heuristic and representation.

Memory usage is also important:

- both methods must remember frontier and visited structures
- in large grids, memory can become a practical bottleneck before asymptotic
  runtime does

## What the heuristic changes in A*

The heuristic is not a minor detail. It determines how much search effort can
be saved without giving up optimality.

- a weak heuristic makes A* look closer to Dijkstra
- a strong admissible heuristic can reduce search dramatically
- a bad heuristic can lose guarantees or simply fail to help

## Theta*: any-angle planning on top of graph search

Theta* keeps the A* search structure but allows line-of-sight shortcuts between
parents and descendants. The effect is that the solution path can become less
grid stair-stepped without abandoning the graph-search framing.

The main lesson here is that path quality is not only about shortest graph cost.
Representation matters. A graph can encode an awkward geometry even when the
search itself is optimal on that graph.

## RRT: sampling-based planning in continuous space

RRT changes the problem entirely. Instead of exhaustively expanding a structured
graph, it samples free space, connects toward samples, and grows a tree. It is
useful when the search space is continuous or the environment is awkward for a
uniform grid representation.

Sampling-based planning gives up deterministic optimality guarantees in its
simplest form, but gains flexibility in spaces where graph construction is
expensive or unnatural.

### Complexity and memory

- runtime: usually described in terms of number of samples or iterations rather
  than graph size
- memory: proportional to the number of stored samples or tree nodes
- quality: strongly dependent on stopping criteria, connection strategy, and
  post-processing

## Comparison at a glance

| Planner | Space model | Typical objective | Practical strength | Practical weakness |
| --- | --- | --- | --- | --- |
| Dijkstra | graph | shortest path on the graph | simple and reliable | explores too broadly |
| A* | graph + heuristic | shortest path on the graph | much better focused search | depends on heuristic quality |
| Theta* | graph + line of sight | shorter, less stair-stepped graph paths | visually better paths on grids | still tied to graph representation |
| RRT | continuous samples | feasible path, often quickly | flexible in continuous spaces | no simple optimality story in the basic form |

## What to compare in the simulator

- whether the path hugs obstacles or keeps useful clearance
- how path shape changes when you switch environment representation
- how grid resolution affects both path quality and search complexity
- which algorithms recover gracefully when the scene gets cluttered

In practice, a good planner depends on the application:

- optimality may matter
- smoothness may matter
- fast initial feasibility may matter
- memory use may matter
- deterministic behavior may matter

This simulator is useful because it makes those tradeoffs visible under the same
start/goal pair.

## Complexity and memory summary

| Planner family | Typical strength | Typical cost profile | Memory profile |
| --- | --- | --- | --- |
| Dijkstra | guaranteed optimal shortest path on the graph | explores broadly | stores frontier plus visited graph state |
| A* | same guarantee with good heuristic guidance | often much faster than Dijkstra in practice | similar to Dijkstra |
| Theta* | smoother graph-based paths | extra visibility checks | similar frontier memory plus geometry checks |
| RRT | scalable feasibility in continuous spaces | depends on sample count and collision checks | stores tree nodes and parent structure |

## Try this

### Experiment 1: Optimality versus shape

1. Start in a sparse environment.
2. Compare Dijkstra, A*, and Theta*.
3. Note that the mathematically shortest graph path may still look visually awkward.

### Experiment 2: Heuristic value

1. Compare Dijkstra and A* on the same scene.
2. Observe how much unnecessary exploration disappears when the heuristic is informative.

### Experiment 3: Representation sensitivity

1. Switch environment mode or resolution.
2. Compare how graph-based and sampling-based methods react.
3. Look for cases where a planner’s weakness is really a representation weakness.

### Experiment 4: Clutter and scalability

1. Increase obstacle density.
2. Watch which planners degrade gracefully.
3. Compare path quality against search effort, not just success versus failure.

## Common mistakes when reasoning about planning

- equating geometric smoothness with optimality
- assuming admissible heuristics are always easy to design
- ignoring memory cost on large search spaces
- comparing planners without accounting for different environment representations
- judging RRT by the same criteria as an optimal graph planner

## What this chapter is really teaching

Path planning is not one algorithmic problem with one best method. It is a
family of tradeoffs between:

- representation
- optimality
- compute budget
- memory budget
- and the kind of path quality that actually matters for the robot

The live comparisons are there to make those tradeoffs concrete rather than abstract.
