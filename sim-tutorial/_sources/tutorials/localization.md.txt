# Localization Tutorial

Localization is the problem of estimating where the robot is when its motion is
uncertain and its sensors are noisy. This tutorial focuses on one of the most
important practical approaches to that problem: the particle filter.

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

## Learning goals

This chapter is meant to help you understand:

- why localization is a probabilistic inference problem
- how particle filters represent uncertainty
- why resampling is necessary
- how noise parameters affect estimate quality, diversity, and recovery
- what the computational and memory cost of a particle filter looks like in practice

## Where localization is used

Localization appears almost everywhere in robotics:

- mobile robots navigating indoor spaces
- autonomous vehicles estimating pose relative to maps and sensors
- drones estimating position and attitude
- warehouse robots following known layouts
- consumer robotics that combine odometry, landmarks, or camera information

This tutorial focuses on particle filtering because it makes uncertainty visible
in a very direct way.

## The estimation problem

Localization asks for the posterior over robot state given controls and sensor
measurements:

$$
p(x_t \mid z_{1:t}, u_{1:t})
$$

The key difficulty is that both motion and measurement are uncertain. The robot
does not have direct access to the true state; it only has a motion model and
noisy observations.

Even when the robot receives a control command, the realized motion is only
approximately known. Even when the robot receives a measurement, the
measurement is only probabilistically related to the true pose.

That is why localization is fundamentally about belief, not certainty.

## The particle-filter approximation

The particle filter approximates the posterior with weighted samples:

$$
p(x_t \mid z_{1:t}, u_{1:t}) \approx \sum_i w_t^{(i)} \delta(x_t - x_t^{(i)})
$$

Each particle is one hypothesis about where the robot might be. The weights
encode how plausible those hypotheses are after considering the newest
measurement.

Each update has three stages:

1. predict:
   sample each particle through the motion model
2. weight:
   score each particle under the sensor likelihood
3. resample:
   concentrate computation on high-likelihood particles

That structure is conceptually simple, but it hides an important engineering
tradeoff:

- if the filter spreads too much, the estimate becomes vague and noisy
- if the filter collapses too quickly, it loses diversity and cannot recover

## How particle filters compare to other estimators

| Method | Representation | Strength | Limitation |
| --- | --- | --- | --- |
| Kalman filter / EKF | Gaussian belief | efficient and elegant | limited by Gaussian and model assumptions |
| Particle filter | weighted samples | handles non-Gaussian and multi-modal beliefs | higher compute and memory cost |

The particle filter is especially useful when ambiguity matters. If several
poses are plausible, a sample-based representation can keep them alive instead
of collapsing immediately to one mean and covariance.

## Why particle filters are useful

Particle filters are attractive because they can represent non-Gaussian and
multi-modal beliefs. If the environment is ambiguous, a filter does not need to
commit immediately to one Gaussian mean and covariance. It can carry multiple
plausible pose clusters at once.

This flexibility is the main reason particle filters remain so important in
teaching and practice.

## Complexity and memory

Let `N` be the number of particles.

- prediction cost: `O(N)`
- weighting cost: `O(N * C_z)`, where `C_z` depends on the measurement model
- resampling cost: often `O(N)`
- memory: `O(N)` for particle states and weights

This is one of the central tradeoffs of localization:

- more particles improve approximation quality
- more particles also increase compute and memory cost

The simulator helps make this visible because particle count affects both the
estimate and the visual density of the belief.

## Practical tradeoffs

### More particles

- better approximation of the posterior
- better recovery from ambiguity
- higher runtime cost
- higher memory cost

### Stronger sensor trust

- can sharpen the estimate quickly
- can also overcommit to bad observations

### Stronger motion noise

- can preserve diversity
- can also make the estimate diffuse and unstable

## What to look for in the simulator

- the gap between true pose and estimated pose
- how tightly or loosely the particles cluster
- whether the cloud follows motion smoothly or lags
- whether the filter can recover after the belief becomes diffuse
- how ambiguity appears as multiple plausible regions

## Sensor model intuition

The sensor model determines how strongly a measurement should reward or punish a
particle. If the measurement model is too sharp, the filter may overcommit to a
bad measurement. If it is too loose, the filter may fail to use informative
sensing.

That means more trust in the sensor is not always better. It is better only if
the model is actually accurate.

## Resampling and degeneracy

Without resampling, many particles eventually receive negligible weight and stop
contributing meaningfully to the posterior. This is called particle degeneracy.

Resampling addresses degeneracy by replicating high-weight particles and
discarding low-weight ones. But resampling also reduces diversity.

So resampling solves one problem while creating another. Good particle-filter
design is largely about balancing those two effects.

## Try this

### Experiment 1: Motion uncertainty

1. Run the default setup and observe the particle cloud during turns.
2. Increase motion noise.
3. Watch the cloud spread and the estimate become less certain.

### Experiment 2: Measurement quality

1. Reset the scenario.
2. Increase sensor noise.
3. Observe how much less tightly the cloud recenters after informative observations.

### Experiment 3: Recovery behavior

1. Use a setting with high uncertainty.
2. Let the filter drift away from the true pose.
3. Watch whether repeated observations pull the estimate back into place.

### Experiment 4: Stability versus responsiveness

1. Compare a conservative noise setting and an aggressive one.
2. Notice that one may look smoother while the other adapts faster.
3. Decide which behavior would be preferable for a specific application.

## Common mistakes when studying localization

- interpreting the mean estimate as the whole story
- ignoring particle diversity
- assuming a sharper sensor model is always better
- forgetting that bad motion modeling can dominate the filter
- overlooking the computational cost of increasing particle count

## What this chapter is really teaching

Localization is not about guessing position. It is about maintaining and
updating a distribution over plausible states.

Once that viewpoint becomes natural, many robotics problems become easier to
understand:

- uncertainty is explicit
- sensing quality matters quantitatively
- compute and memory tradeoffs become visible
- and recovery is a statistical question, not a purely geometric one
