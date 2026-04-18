# SLAM Tutorial

The SLAM demo moves one step beyond localization: the robot is estimating its
own pose while also building or refining the map it uses.

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

## The joint estimation problem

SLAM estimates both trajectory and map:

$$
p(x_{1:t}, m \mid z_{1:t}, u_{1:t})
$$

That is why the problem is harder than localization. Errors in pose corrupt map
estimates, and map errors feed back into later pose estimates.

## Theoretical derivations

### EKF-SLAM

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

### Graph SLAM

Graph SLAM reframes the problem as sparse nonlinear least squares. Robot poses
and landmarks become nodes, and measurements become constraints. The optimizer
tries to minimize the residual energy across the whole graph.

That is why loop closure is so powerful in graph formulations: one good
constraint can redistribute error across a long accumulated trajectory.

## What this simulator is for

SLAM becomes easier to understand when you can see the coupling directly:

- pose errors distort the map
- map errors distort future pose estimates
- loop closure is valuable because it corrects both at once

This demo is there to make that coupling visible.

## What to look at

- drift accumulating before corrections arrive
- landmark placement relative to the estimated trajectory
- how uncertainty evolves when the robot revisits familiar areas
- how graph- or filter-based updates reshape the map after new evidence arrives

## Try this

1. Let the robot move without intervention and watch drift accumulate.
2. Focus on repeated viewpoints or revisits to see when the estimate tightens again.
3. Compare the map before and after a strong correction event.
4. Reset and rerun to see how the same algorithm behaves under different random conditions.

## Implementation mapping

The estimation and optimization logic stays in `rust_robotics_algo`, while the
simulator owns the world state, plotting, and interactive controls. That split
keeps the math-heavy code from being tangled into the UI and makes it easier to
test SLAM logic independently of the app.
