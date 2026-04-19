# Control Systems Tutorial

The inverted pendulum is one of the classic teaching systems in robotics and
control because it sits at the right level of difficulty. It is simple enough
to derive by hand, but difficult enough to expose the central questions of
modern control:

- how should a controller react to state error?
- what assumptions are hidden inside a linear model?
- when does planning outperform fixed feedback?
- when does a learned policy behave differently from a model-based controller?

```{raw} html
<div class="sim-embed-card">
  <iframe
    class="sim-embed-frame"
    data-sim-mode="inverted_pendulum"
    data-sim-path="?mode=inverted_pendulum&embed=focused&ui=20260416w"
    title="Rust Robotics control systems simulator"
    loading="lazy"
  ></iframe>
</div>
```

## Learning goals

By the end of this chapter, you should be able to explain:

- why the inverted pendulum is unstable around the upright equilibrium
- what information PID, LQR, MPC, and PPO use when choosing control
- what each method costs computationally
- when a local linear model is adequate and when it becomes misleading
- how to read oscillation, overshoot, and settling behavior in the live demo

## Where these algorithms are used

The inverted pendulum is a teaching system, but the control ideas are widely
used in real applications:

- PID:
  low-level industrial loops, motors, temperature control, simple balancing systems
- LQR:
  aerospace control, balancing systems, trajectory stabilization, linearized multivariable regulation
- MPC:
  autonomous driving, process control, constrained motion systems, energy systems
- PPO and related RL policies:
  learned control in simulation, locomotion, game-like environments, tasks with difficult hand-modeling

The pendulum matters because it lets these methods be compared under one shared
plant without hiding the core tradeoffs.

## The control problem

The problem is to keep the pole upright while also controlling cart motion. The
system state is:

$$
\mathbf{x} =
\begin{bmatrix}
x & \dot{x} & \theta & \dot{\theta}
\end{bmatrix}^T
$$

where:

- `x` is cart position
- `\dot{x}` is cart velocity
- `\theta` is pole angle
- `\dot{\theta}` is pole angular velocity

The control input is the horizontal force `u` applied to the cart.

Two facts make this system educational:

1. the upright equilibrium is unstable
2. the state variables are coupled, so correcting the angle affects the cart
   and correcting the cart affects the angle

That coupling is exactly why multivariable control is more interesting than
single-loop intuition suggests.

## Linearization and the local model

Around the upright equilibrium, the nonlinear dynamics can be linearized into a
state-space model:

$$
\dot{\mathbf{x}} = A\mathbf{x} + B\mathbf{u}
$$

This local model is not the full physics of the pendulum. It is an approximation
valid near the upright position. That approximation is powerful because it makes
several important tools practical:

- LQR can solve a quadratic optimal control problem in closed form
- MPC can optimize over a linear prediction model efficiently
- stability and tuning intuition become easier to reason about analytically

But it also has a limit: far from the operating point, the nonlinear plant
matters. In practice, this means:

- small disturbances are usually well described by the linear model
- large excursions reveal the limitations of linear assumptions

The simulator is useful precisely because you can see the difference.

## The controller families in this tutorial

The tutorial exposes four control families on the same plant:

- `PID`
- `LQR`
- `MPC`
- `PPO Policy`

All of them answer the same question:

> Given the current state, what force should be applied now?

The difference is in how they represent the problem and what they optimize.

## High-level comparison

| Method | Main idea | Best fit | Main limitation |
| --- | --- | --- | --- |
| PID | correct the observed error directly | simple regulation tasks | weak handling of strong coupling |
| LQR | compute optimal linear feedback from a model and quadratic cost | local stabilization around an operating point | depends on linear model validity |
| MPC | solve a finite-horizon optimization problem repeatedly | constrained or anticipatory control | computational cost |
| PPO | learn a policy from interaction data | hard-to-model or reward-defined tasks | training cost and weaker interpretability |

## PID: error correction without a system model

PID is the most familiar controller because it treats the task as error
correction:

$$
u(t) = K_p e(t) + K_i \int e(t)\,dt + K_d \frac{de(t)}{dt}
$$

In discrete time, the implementation approximates the derivative with finite
differences and accumulates the integral numerically.

### What PID gets right

- intuitive tuning
- low computational cost
- effective on many simple regulation problems

### What PID struggles with here

The pendulum is not a one-variable problem. The pole angle, cart position, and
their velocities are coupled. A PID loop can still work as a baseline, but it
does not naturally encode that coupling in an optimal way.

### Cost profile

- time per update: constant, very small
- memory: constant
- tuning burden: potentially high, because gains are hand-chosen

## LQR: optimal linear feedback

LQR starts from the linearized model and chooses a feedback gain that minimizes
a long-horizon quadratic cost:

$$
J = \sum_{k=0}^{\infty} \left(x_k^T Q x_k + u_k^T R u_k\right)
$$

The matrices `Q` and `R` encode what should be expensive:

- large state errors
- large control effort

The solution comes from the discrete Riccati equation. Once the stabilizing
matrix `P` is found, the controller is:

$$
u_k = -K x_k
$$

### Why LQR matters

LQR is one of the cleanest examples of good engineering through modeling. Once
the linear model and cost weights are chosen, the controller follows directly.

It also illustrates a larger engineering lesson: a good local model can turn a
hard control problem into a very clean one.

### Cost profile

- offline work: solve the Riccati equation
- online work: one matrix-vector multiply per step
- memory: store model matrices and feedback gain

That makes LQR extremely attractive when the local model is good enough.

## MPC: optimization at runtime

Model predictive control solves a finite-horizon optimization problem at every
time step:

$$
\min_{\{x_k, u_k\}} \sum_{k=0}^{N-1} \left(x_k^T Q x_k + u_k^T R u_k\right) + x_N^T P x_N
$$

subject to dynamics and any relevant constraints.

Only the first control is applied. Then the horizon shifts and the optimization
is solved again.

### Why MPC often looks smoother or more deliberate

Unlike LQR, MPC is not tied to a single static feedback law. It plans a short
sequence, then re-plans as the state changes. This is especially valuable when:

- constraints matter
- finite-horizon behavior matters
- the best immediate action depends strongly on near-future consequences

### Cost profile

- online work: solve an optimization problem every step
- memory: store prediction model, horizon data, and solver state
- tuning burden: cost weights plus horizon and constraint choices

MPC is usually the most computationally expensive controller in this tutorial.

## PPO policy: learned feedback

The PPO controller replaces an explicit analytical control law with a neural
policy:

$$
u = \pi_\theta(o)
$$

where `o` is the observation and `\theta` are learned parameters.

The important distinction is not simply neural network versus equation. The
real distinction is that PPO learns from repeated interaction and reward design
rather than directly from a system model and explicit control objective.

### Cost profile

- training cost: high
- inference cost: usually modest
- memory: model parameters plus any recurrent or optimizer state during training

Once trained, a policy can be cheap to execute, but the design effort moves from
model derivation to reward shaping, training setup, and data collection.

## Practical comparison points

### Interpretability

- PID and LQR are highly interpretable
- MPC is interpretable, but more dependent on optimization setup
- PPO policies are usually least interpretable

### Tuning burden

- PID often looks simple but can be tedious to tune well
- LQR replaces gain tuning with cost design
- MPC adds horizon and solver choices
- PPO moves the burden toward reward design, training stability, and data collection

### Runtime burden

- PID and LQR are usually cheap enough for tight control loops
- MPC may require careful engineering for real-time performance
- PPO inference can be cheap, but only after expensive training

## Complexity and memory summary

| Method | Online time cost | Memory cost | Main strength | Main weakness |
| --- | --- | --- | --- | --- |
| PID | very low | very low | simplicity | weak handling of coupled dynamics |
| LQR | very low | low | principled multivariable feedback | limited to local linear model |
| MPC | high | moderate | explicit short-horizon optimization | runtime cost |
| PPO | moderate at inference, high in training | model-dependent | flexible learned behavior | training burden and weaker interpretability |

## What to look at

- angle stabilization and cart stabilization together
- overshoot after a disturbance
- settling time
- residual oscillation
- control aggressiveness
- sensitivity to noise or bad parameter choices

A common mistake is to look only at whether the pole stays up. A good controller
does more than merely avoid failure. It also balances smoothness, effort, and
recovery behavior.

## Try this

### Experiment 1: Compare local feedback laws

1. Use `LQR` as a baseline.
2. Switch to `PID`.
3. Adjust gains until the response becomes oscillatory or sluggish.
4. Compare the shape of the recovery, not just the final outcome.

### Experiment 2: Compare planning to fixed feedback

1. Switch from `LQR` to `MPC`.
2. Apply a disturbance or restart from a challenging state.
3. Watch whether the MPC controller appears more anticipatory.

### Experiment 3: Compare learned and model-based control

1. Select `PPO Policy`.
2. Compare its corrections to `LQR` and `MPC`.
3. Look for differences in smoothness, aggressiveness, and repeated micro-corrections.

### Experiment 4: Study robustness

1. Add observation noise.
2. Repeat the same experiment across several controllers.
3. Observe which controllers degrade gracefully and which become brittle.

## Common pitfalls

- confusing local stability with global stability
- over-tuning for one initial condition
- treating low overshoot as the only marker of quality
- ignoring control effort
- comparing learned and analytical controllers without considering training cost

## What this chapter is really teaching

The inverted pendulum is not important because pendulums are common industrial
systems. It is important because it reveals a general lesson:

different controllers encode different beliefs about the world.

- PID assumes reactive error correction is enough
- LQR assumes a local linear model is the right abstraction
- MPC assumes online planning is worth the cost
- PPO assumes a policy can be learned effectively from interaction

Once you understand those differences here, you can recognize the same ideas in
larger robotic systems.
