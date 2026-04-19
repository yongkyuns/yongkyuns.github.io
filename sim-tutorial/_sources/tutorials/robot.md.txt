# Robot Tutorial

The robot tutorial is where the ideas from the earlier chapters stop looking
like isolated textbook problems and start looking like a real control loop. The
robot simulator is still educational rather than production-grade, but it makes
one important transition visible:

how do algorithms become a runtime?

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

## Learning goals

This chapter is built to answer questions such as:

- what changes when control moves from a toy system to a legged robot simulator?
- how do observations, policies, commands, and actuation fit together?
- why do latency, memory, and compute matter more in a richer runtime?
- what does portability mean in practice for robot control software?

## Where this matters in practice

Robot runtimes like this are relevant whenever an algorithm must actually live
inside a control loop rather than on paper:

- legged locomotion
- mobile robot command following
- simulation-to-deployment experiments
- browser-accessible demonstrations for education and testing
- native interactive tools used for debugging behavior

## The runtime loop

At a high level, the robot runtime follows a standard perception-to-action loop:

1. the simulator advances the world and produces raw robot state
2. that state is converted into an observation vector
3. a controller or policy consumes the observation
4. the output is decoded into actuation
5. the world steps again under the new actuation

Conceptually:

$$
\text{state} \rightarrow \text{observation} \rightarrow \text{policy} \rightarrow \text{action} \rightarrow \text{next state}
$$

This loop sounds simple, but every stage creates design questions.

## Why this loop is more demanding than the pendulum

Compared with the pendulum tutorial, the robot runtime has:

- much larger observation spaces
- more actuators
- more complicated contact dynamics
- stronger dependence on timing and stability
- more opportunities for mismatch between simulation and future deployment

That makes it the right place to discuss not only does the algorithm work, but also:

- how much state must be carried?
- how much memory does inference require?
- how much latency is acceptable?
- how portable is the implementation between native and web environments?

## Observations and actions

The observation vector is the compression of the world into what the controller
is allowed to see. Good observation design matters because:

- too little information makes control impossible or brittle
- too much information increases model size and training burden
- the wrong representation can make transfer or generalization harder

Similarly, the action representation matters because the controller may not
output torques directly. It may output:

- desired joint targets
- normalized action values
- velocity-like commands
- gait or command abstractions that are decoded further downstream

This separation is one of the central practical lessons of robot control: the
policy output is rarely the final actuator command in the most naive sense.

## Portability as a design goal

One of the main ideas behind Rust Robotics is that the same control logic should
not be trapped in one runtime.

In practical terms, portability means:

- the same control semantics can appear in the browser and native application
- the same algorithmic core does not need to be rewritten for each UI host
- simulation can be used as a public teaching surface without forcing a separate
  implementation stack

This is not only a software engineering preference. It is educationally useful:
if a reader can study the same runtime loop in multiple accessible environments,
the barrier to experimentation is lower.

## Comparison to the earlier tutorials

The earlier tutorials isolate one main problem at a time:

- control
- localization
- planning
- SLAM

The robot runtime combines several ideas at once. That is why it is a useful
final chapter: it shows what changes when algorithms become part of a system
with state, timing, and interface constraints.

## Performance, memory, and runtime concerns

Robot control is where practical systems issues become unavoidable.

### Compute

A control loop must finish within its time budget. If policy inference, state
construction, or decoding becomes too slow, the controller may destabilize or
behave inconsistently.

### Memory

Model parameters, temporary buffers, recurrent state, and simulator state all
consume memory. On the web, this is especially relevant because the environment
is more constrained and more visible to end users.

### Latency

Even when average performance looks fine, jitter matters. A control policy that
sometimes stalls is different from one that runs consistently.

These concerns are part of the algorithm story, not separate from it. A method
that is elegant mathematically but too expensive for the intended runtime is not
actually a good solution.

## Practical comparison questions

When looking at a robot runtime, a professional reader usually cares about
questions like these:

- how large is the observation and action representation?
- how expensive is inference?
- how much state must be carried between steps?
- what happens if timing slips?
- how portable is the controller between runtime hosts?

Those are algorithm questions as much as runtime questions.

## What to look at

- how command changes affect robot motion
- whether the robot remains stable under changes in setpoint
- how smoothly actions appear to be decoded and applied
- how responsive the runtime feels
- how much complexity is hidden behind just run the policy

Try to observe the system as both a learner and an engineer:

- as a learner, ask what the robot is trying to do
- as an engineer, ask what data and computation were required to do it

## Try this

### Experiment 1: Command interpretation

1. Change the high-level command inputs.
2. Watch how the robot’s behavior changes.
3. Ask what intermediate representation must exist between command and actuation.

### Experiment 2: Stability and responsiveness

1. Try more aggressive command changes.
2. Observe whether the robot reacts smoothly or abruptly.
3. Think about how action smoothing and decoding affect the visible result.

### Experiment 3: Runtime mindset

1. Reset and rerun the demo.
2. Focus less on the animation and more on the loop:
   observation, policy, action, world step.
3. Ask where latency, memory use, and portability constraints would matter most.

## Common mistakes when thinking about robot runtimes

- assuming the simulator state can be fed directly into the policy without design
- ignoring time budget and only focusing on mathematical correctness
- forgetting that action decoding is part of the control pipeline
- treating browser execution as just UI rather than a real runtime constraint
- assuming portability happens automatically

## What this chapter is really teaching

The earlier tutorials teach individual algorithmic ideas. This chapter teaches
something broader:

an algorithm becomes useful only when it can live inside a runtime that respects
time, memory, interface, and deployment constraints.

That is the bridge from robotics as theory to robotics as a usable system.
