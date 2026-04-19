# SLAM Tutorial

SLAM, simultaneous localization and mapping, is one of the defining problems of
robotics because it forces two uncertainties to interact: the robot does not
know exactly where it is, and it does not know the map perfectly either.

```{raw} html
<div class="sim-embed-card">
  <iframe
    class="sim-embed-frame"
    data-sim-mode="slam"
    data-sim-path="?mode=slam&embed=focused&ui=20260416c"
    title="Rust Robotics SLAM simulator"
    loading="lazy"
  ></iframe>
</div>
```

## Learning goals

This chapter is meant to make the following ideas concrete:

- why SLAM is harder than localization alone
- how pose uncertainty and map uncertainty influence each other
- how EKF-SLAM and graph-SLAM think about the problem differently
- why loop closure is so powerful
- what computational structure makes SLAM expensive in practice

## Where SLAM is used

SLAM is central in robotics whenever a robot must operate in an environment that
is not perfectly known in advance:

- autonomous vehicles
- drones
- mobile service robots
- warehouse and logistics robots
- handheld mapping systems
- AR and spatial computing systems

## The joint estimation problem

SLAM estimates both trajectory and map:

$$
p(x_{1:t}, m \mid z_{1:t}, u_{1:t})
$$

That is why the problem is harder than localization. Errors in pose corrupt map
estimates, and map errors feed back into later pose estimates.

The central conceptual jump is that pose and map cannot be treated as
independent. Good SLAM methods succeed because they preserve and exploit that
coupling.

## EKF-SLAM: a probabilistic filter view

EKF-SLAM maintains a joint Gaussian over robot pose and landmarks. Prediction
propagates the motion model and grows covariance. Measurement updates use the
Kalman gain to reduce uncertainty when observations arrive.

The core update looks like:

$$
K = P H^T (H P H^T + R)^{-1}
$$

followed by the usual mean and covariance correction. The key structural point
is that pose-landmark cross-covariances are not incidental; they are the thing
that lets a better pose estimate improve landmark estimates and vice versa.

### Cost profile

EKF-SLAM is conceptually elegant, but it becomes expensive as the number of
landmarks grows. Dense covariance structure pushes both memory and runtime
upward.

At a high level:

- memory can grow quadratically with the number of landmarks
- updates can also become increasingly expensive because the covariance is large

That is one reason why graph-based formulations became so influential.

## Graph SLAM compared to EKF-SLAM

| Formulation | Main object | Strength | Main cost issue |
| --- | --- | --- | --- |
| EKF-SLAM | joint Gaussian belief | direct probabilistic interpretation | dense covariance growth |
| Graph SLAM | sparse optimization problem | strong global consistency and scalability | iterative nonlinear optimization |

## Graph SLAM: a sparse optimization view

Graph SLAM reframes the problem as sparse nonlinear least squares. Robot poses
and landmarks become nodes, and measurements become constraints. The optimizer
tries to minimize the residual energy across the whole graph.

That is why loop closure is so powerful in graph formulations: one good
constraint can redistribute error across a long accumulated trajectory.

### Cost profile

Graph-based methods are attractive because many SLAM problems are sparse:

- each observation links only a small subset of variables
- many constraints are local
- sparse linear algebra scales better than dense covariance updates in many settings

That does not make graph SLAM free, but it often makes larger problems more
tractable than dense filter formulations.

## What to look at in the simulator

The most important things to watch are not just the final map shape, but the
intermediate behavior:

- pose errors distort the map
- map errors distort future pose estimates
- loop closure is valuable because it corrects both at once
- drift accumulates before strong corrections arrive
- landmark placement changes with trajectory quality

## Why SLAM is such an important teaching topic

SLAM forces several robotics ideas into one place:

- uncertainty propagation
- data association
- numerical optimization
- linearization
- memory scaling
- delayed global correction

That makes it one of the best examples of why robotics is rarely just geometry
or just probability or just control. It is usually all of them together.

## Practical tradeoffs

### Filter viewpoint

- often conceptually closer to recursive estimation
- good for understanding uncertainty propagation directly
- can become expensive as the state grows

### Graph viewpoint

- often better for larger maps and longer trajectories
- makes loop closure especially natural
- depends heavily on optimization quality and data association

## Complexity and memory summary

| Formulation | Main representation | Typical strength | Main scaling concern |
| --- | --- | --- | --- |
| EKF-SLAM | joint Gaussian | clear probabilistic interpretation | dense covariance growth |
| Graph SLAM | sparse factor graph | strong global correction and scalability | nonlinear optimization cost |

## Try this

### Experiment 1: Watch drift form

1. Start the demo and let the robot move.
2. Pay attention to how small pose errors accumulate into visible map distortion.

### Experiment 2: Look for correction events

1. Focus on revisits or repeated observations.
2. Notice when the map and trajectory become more consistent again.
3. Ask what new information enabled that correction.

### Experiment 3: Compare local consistency and global consistency

1. Watch the map before a strong correction event.
2. Then watch how the entire structure changes after new evidence arrives.
3. Notice that good global consistency may require revising earlier local beliefs.

### Experiment 4: Think about cost

1. Imagine scaling the same problem to many more landmarks and poses.
2. Ask whether dense covariance or sparse graph structure seems more practical.
3. Use the simulator behavior as a prompt for algorithmic scaling intuition.

## Common mistakes when studying SLAM

- treating map building and localization as separate problems
- ignoring cross-correlation structure
- focusing only on final map appearance
- assuming loop closure is a cosmetic improvement instead of a structural correction
- forgetting that data association quality can dominate everything else

## What this chapter is really teaching

SLAM is the point where uncertainty becomes geometric and geometry becomes
probabilistic. If you understand why pose errors corrupt maps and why map
corrections improve pose, you understand the heart of the SLAM problem.
