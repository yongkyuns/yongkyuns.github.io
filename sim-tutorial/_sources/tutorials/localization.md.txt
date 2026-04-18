# Localization Tutorial

The localization demo is a compact way to see noisy sensing, motion uncertainty,
and particle-filter behavior without the extra complexity of full mapping.

```{raw} html
<div class="sim-embed-card">
  <iframe
    class="sim-embed-frame"
    data-sim-mode="localization"
    data-sim-path="?mode=localization&embed=focused&ui=20260416b"
    title="Rust Robotics localization simulator"
    loading="lazy"
  ></iframe>
</div>
```

## The estimation problem

Localization asks for the posterior over robot state given controls and sensor
measurements:

$$
p(x_t \mid z_{1:t}, u_{1:t})
$$

The key difficulty is that both motion and measurement are uncertain. The robot
does not have direct access to the true state; it only has a motion model and
noisy observations.

## Particle-filter derivation

The particle filter approximates the posterior with weighted samples:

$$
p(x_t \mid z_{1:t}, u_{1:t}) \approx \sum_i w_t^{(i)} \delta(x_t - x_t^{(i)})
$$

Each update has three conceptual stages:

1. predict:
   sample each particle through the motion model
2. weight:
   score each particle under the sensor likelihood
3. resample:
   concentrate computation on high-likelihood particles

That is why localization quality depends on both the transition model and the
measurement model. If either one is badly tuned, the particle cloud either
spreads too aggressively or collapses onto the wrong region.

## What this simulator is for

That makes it useful for understanding:

- sensor noise
- motion-model drift
- particle diversity
- recovery after the estimate spreads or collapses

## What to look at

- the gap between the true pose and the estimated pose
- how particle clouds spread during ambiguous motion
- whether the filter recenters quickly when landmarks or measurements become informative
- how tuning noise changes confidence and recovery speed

## Try this

1. Run the default filter and watch the particle cloud during turns.
2. Increase process noise and see how quickly uncertainty spreads.
3. Increase sensor noise and watch the estimate become less anchored.
4. Reset and repeat with calmer motion to see how the same filter behaves under easier conditions.

## Implementation mapping

The underlying estimator lives in `rust_robotics_algo`, while the simulator UI
and visualization live in `rust_robotics_sim`. That separation matters because
it keeps the estimation logic testable outside the app shell and lets the same
filter implementation stay reusable even if the visualization changes.
