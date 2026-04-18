# Control Systems Tutorial

The inverted-pendulum simulator is the control tutorial in this repo. It is
small enough to derive by hand, but rich enough to compare classical and learned
controllers under one shared plant.

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

## The plant

The state is the familiar cart-pole state:

- cart position `x`
- cart velocity `\dot{x}`
- pole angle `\theta`
- pole angular velocity `\dot{\theta}`

The control input is the horizontal force applied to the cart. Around the
upright equilibrium, the nonlinear dynamics can be linearized into the standard
state-space form:

$$
\dot{\mathbf{x}} = A\mathbf{x} + B\mathbf{u}
$$

That local linear model is what makes LQR and the terminal-cost approximation
inside MPC practical for this demo.

## Controllers in this page

The simulator lets you compare several controllers on the same plant:

- `PID`
- `LQR`
- `MPC`
- `PPO Policy`

Each one answers the same question differently: how should force be chosen from
the current state to keep the pole upright while keeping the cart motion under
control?

## Theoretical derivations

### PID

PID treats control as weighted error feedback:

$$
u(t) = K_p e(t) + K_i \int e(t)\,dt + K_d \frac{de(t)}{dt}
$$

In discrete time, the implementation approximates the derivative from finite
differences and accumulates the integral term numerically. PID is useful here as
a baseline because it is intuitive and tunable, but it does not explicitly
reason about the coupled multivariable pendulum dynamics.

### LQR

LQR chooses a feedback gain `K` that minimizes a quadratic cost:

$$
J = \sum_{k=0}^{\infty} \left(x_k^T Q x_k + u_k^T R u_k\right)
$$

The solution comes from the Riccati equation. Once the stabilizing matrix `P` is
found, the optimal linear feedback is:

$$
u_k = -K x_k
$$

with `K` derived from `A`, `B`, `Q`, `R`, and `P`. The important point is that
LQR does not tune angle and cart motion separately; it optimizes them together
through the state cost.

### MPC

MPC solves a finite-horizon optimization problem online:

$$
\min_{\{x_k, u_k\}} \sum_{k=0}^{N-1} \left(x_k^T Q x_k + u_k^T R u_k\right) + x_N^T P x_N
$$

subject to the dynamics and any input/state constraints. Only the first control
action is applied, then the optimization is solved again at the next step.

That is why MPC typically looks more deliberate: it is explicitly planning a
short future sequence rather than reacting with one static feedback law.

### PPO policy

The learned policy replaces an analytical control law with a neural mapping from
observation to action. Training still optimizes a control objective, but the
gradient comes from PPO's clipped surrogate loss instead of a Riccati or QP
solve.

Conceptually, PPO is learning a feedback policy:

$$
u = \pi_{\theta}(o)
$$

where `o` is the observation built by the simulator and `\theta` are the policy
parameters exported as a portable `PolicySnapshot`.

## What to look at

- the cart position and pole angle together, not just one variable in isolation
- how quickly the controller damps oscillation after a disturbance
- whether the controller settles smoothly or keeps injecting small corrections
- how the learned PPO policy behaves relative to the model-based controllers

## Try this

1. Start with `LQR` and use it as the baseline for smooth stabilization.
2. Switch to `PID` and change gains until you see overshoot or sluggish recovery.
3. Switch to `MPC` and notice the more deliberate control behavior.
4. Select `PPO Policy` and compare its recovery pattern to the analytical controllers.
5. Add noise and restart to see which controller is most sensitive to sensing error.

## Implementation mapping

The pendulum path is intentionally structured across crates:

- `rust_robotics_algo` owns the classical controller logic
- `rust_robotics_train` owns PPO training
- `rust_robotics_core` owns portable `PolicySnapshot` handoff data
- `rust_robotics_sim` owns the plant, stepping, UI, and controller selection

So the same plant can be stabilized either by analytical control laws or by a
policy snapshot exported from training, while the simulator itself stays fixed.
