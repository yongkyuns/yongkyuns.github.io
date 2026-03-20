# BreezySLAM FFI Integration Plan

## Overview
Integrate BreezySLAM C library into RustRobotics via FFI, enabling occupancy grid mapping alongside existing EKF-SLAM and Graph-SLAM.

## Architecture
Create new crate `rust_robotics_breezyslam` for clean separation of FFI bindings from pure Rust code.

```
rust_robotics_breezyslam/
├── Cargo.toml
├── build.rs              # Compile C code with platform detection
└── src/
    ├── lib.rs            # Module root
    ├── ffi.rs            # Raw FFI bindings (extern "C")
    ├── types.rs          # Safe wrappers: Position, Map, Scan
    └── slam.rs           # BreezySlam high-level API
```

## Implementation Steps

### Step 1: Create FFI Crate
**Files:** `rust_robotics_breezyslam/Cargo.toml`, `build.rs`

- Add crate to workspace in `/home/yongkyunshin/personal/RustRobotics/Cargo.toml`
- build.rs compiles C sources from `~/personal/BreezySLAM/c/`:
  - `coreslam.c`, `random.c`, `ziggurat.c`
  - Platform-specific: `coreslam_i686.c` (x86 SSE), `coreslam_armv7l.c` (ARM NEON), or `coreslam_sisd.c` (fallback)

### Step 2: Raw FFI Bindings
**File:** `src/ffi.rs`

Bind key C functions:
```rust
extern "C" {
    fn map_init(map: *mut map_t, size_pixels: c_int, size_meters: c_double);
    fn map_update(map: *mut map_t, scan: *mut scan_t, pos: position_t, quality: c_int, hole_width: c_double);
    fn map_get(map: *mut map_t, bytes: *mut c_char);
    fn scan_init(scan: *mut scan_t, span: c_int, size: c_int, ...);
    fn scan_update(scan: *mut scan_t, angles: *mut c_float, distances: *mut c_int, ...);
    fn rmhc_position_search(...) -> position_t;
    fn random_new(seed: c_int) -> *mut c_void;
}
```

### Step 3: Safe Rust Wrappers
**Files:** `src/types.rs`, `src/slam.rs`

```rust
pub struct BreezySlam {
    map: Map,
    scan: Scan,
    randomizer: *mut c_void,
    position: Position,
}

impl BreezySlam {
    pub fn new(map_size_pixels: i32, map_size_meters: f64, scan_config: ScanConfig) -> Self;
    pub fn update(&mut self, distances_mm: &[i32], odometry: Odometry);
    pub fn get_position(&self) -> (f64, f64, f64);  // x_mm, y_mm, theta_deg
    pub fn get_map_bytes(&self) -> Vec<u8>;
}
```

### Step 4: LiDAR Simulation
**File:** `rust_robotics_sim/src/simulator/slam.rs`

Add environment with walls for raycasting:
```rust
struct WallObstacle { p1: (f32, f32), p2: (f32, f32) }
struct SlamEnvironment { walls: Vec<WallObstacle> }

fn generate_lidar_scan(pose: &Vector3<f32>, env: &SlamEnvironment, angles: &[f32], max_range: f32) -> Vec<i32>
```

Default environment: outer boundary walls + internal walls for structure.

### Step 5: Simulator Integration
**File:** `rust_robotics_sim/src/simulator/slam.rs`

Add `BreezySlamInstance` following existing pattern:
```rust
struct BreezySlamInstance {
    enabled: bool,
    slam: BreezySlam,
    h_est: Vec<rb::Vector3>,
    h_update_us: Vec<f64>,
}
```

Add to `SlamDemo` struct, call in `step()`, render in `scene()`.

### Step 6: Visualization
- Occupancy grid: render as semi-transparent polygon grid overlay
- LiDAR rays: cyan dotted lines from robot to detected walls
- Color: Teal `Color32::from_rgb(0, 188, 212)`

### Step 7: UI Controls
Add to existing UI:
- Checkbox: "Breezy" toggle
- Checkbox: "Grid" to show/hide occupancy map
- Error display: position error in meters
- Timing display: update time in microseconds

## Files to Modify/Create

| File | Action |
|------|--------|
| `Cargo.toml` (workspace) | Add `rust_robotics_breezyslam` to members |
| `rust_robotics_breezyslam/Cargo.toml` | Create with cc build-dep |
| `rust_robotics_breezyslam/build.rs` | Create - compile C code |
| `rust_robotics_breezyslam/src/lib.rs` | Create - module root |
| `rust_robotics_breezyslam/src/ffi.rs` | Create - raw FFI bindings |
| `rust_robotics_breezyslam/src/types.rs` | Create - safe wrappers |
| `rust_robotics_breezyslam/src/slam.rs` | Create - high-level API |
| `rust_robotics_sim/Cargo.toml` | Add breezyslam dependency |
| `rust_robotics_sim/src/simulator/slam.rs` | Extend with BreezySlamInstance |

## Verification

1. **Build test**: `cargo build` succeeds with C library linking
2. **Unit tests**: Test Map/Scan initialization and update in isolation
3. **Integration test**: Run simulation with all 3 algorithms enabled
4. **Visual check**: Occupancy grid captures wall structure correctly
5. **Performance**: BreezySLAM update time comparable to EKF (~100-500 us)
