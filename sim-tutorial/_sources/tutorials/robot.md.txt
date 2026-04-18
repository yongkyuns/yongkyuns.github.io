# Robot Tutorial

The robot mode is the most complete end-to-end path in the repo: MuJoCo world
state, shared robot-framework logic, browser runtime glue, and policy execution.

```{raw} html
<div class="sim-embed-card">
  <iframe
    class="sim-embed-frame"
    data-sim-mode="robot"
    data-sim-path="?mode=robot&embed=focused&ui=20260416g"
    title="Rust Robotics robot runtime simulator"
    loading="lazy"
  ></iframe>
</div>
```

## The runtime pipeline

This mode is where the architecture boundary matters most.

The simulator owns:

- MuJoCo model and data
- stepping and reset
- native and web viewport/runtime glue

The shared robot framework owns:

- observation construction
- command semantics
- recurrent/action state
- action smoothing
- actuation decoding

That is what allows Go2 and Open Duck Mini control logic to stay shared across
native and browser execution.

## Theoretical flow

The robot runtime follows a five-stage loop:

1. MuJoCo produces raw state from the world
2. the robot framework constructs an observation vector
3. the policy backend performs inference
4. the robot framework decodes network output into robot actuation
5. the simulator applies that actuation back into the world

Conceptually:

$$
\text{world state} \rightarrow \text{observation} \rightarrow \pi(o) \rightarrow \text{actuation} \rightarrow \text{world step}
$$

The important design decision is that the world and the robot semantics are not
owned by the same crate. That keeps MuJoCo-specific API ownership in the
simulator and keeps the command/observation/policy logic reusable.

## What to look at

- how the same robot-framework logic survives different runtime backends
- how command changes affect setpoints, gait, and policy output
- how the MuJoCo view and robot state stay synchronized during stepping and reset
- whether the live browser path behaves like the native path in the ways that matter

## Try this

1. Switch between supported robots and compare the control semantics.
2. Change command inputs and watch how the robot framework interprets them.
3. Reset the simulation and confirm that robot state and viewport state return together.
4. Open the full simulator view if you want the normal app layout instead of the embedded frame.

## Implementation mapping

This mode is intentionally split across crates:

- `rust_robotics_sim` owns MuJoCo world/runtime concerns
- `rust_robotics_algo::robot_fw` owns robot semantics and policy decoding
- browser interop lives in the web runtime glue, not in the algorithm layer

That boundary is what keeps the robot framework reusable instead of burying it
inside one renderer or one simulator host.
