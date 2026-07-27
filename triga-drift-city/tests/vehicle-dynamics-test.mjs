// Executable dynamics checks against the compiled Faber ESM.
//
// The .fab fact programs cover the same ground but cannot run yet (blocked on
// the radix-runtime-contract core-support path), so these assertions are the
// only executable proof of the drive and collision contracts.

const esm = new URL("../dist/faber-esm/", import.meta.url).href;
const vehicle = await import(`${esm}vehicle.js`);
const cityMod = await import(`${esm}city.js`);
const triga = await import(`${esm}triga-triga.js`);
const main = await import(`${esm}main.js`);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

const map = cityMod.drift_city();
const DT = 1 / 60;

function withState(overrides) {
  return { ...vehicle.spawn_vehicle(), ...overrides };
}

function pressed(...codes) {
  let input = vehicle.apply_focus(vehicle.empty_input(), true);
  for (const code of codes) input = vehicle.set_key_by_code(input, code, true);
  return input;
}

// ── Rendered body yaw must match the direction of travel ───────────────────
//
// The mesh nose is local -Z. Rotating it by the model matrix has to land on
// camera_forward_planus_ex_yaw(heading), the same vector the simulation and
// the chase camera use. A sign error here yaws the body against its path.
for (const heading of [0, 30, -45, 90, 135, -170]) {
  const model = main.compute_model_matrix(withState({ heading_degrees: heading }));
  assert(model !== null, `model matrix exists at heading ${heading}`);
  if (model === null) continue;

  const e = model.elements;
  // Column-major: rotating local (0,0,-1) uses the negated third column.
  const nose = { x: -e[8], y: -e[9], z: -e[10] };
  const forward = triga.camera_forward_planus_ex_yaw(heading);
  // Tolerance covers the f32 sine approximation, which drifts by a few
  // thousandths near ±180°. A sign error would be off by twice the component.
  assert(
    Math.abs(nose.x - forward.x) < 0.01 && Math.abs(nose.z - forward.z) < 0.01,
    `heading ${heading}: body nose (${nose.x.toFixed(3)}, ${nose.z.toFixed(3)}) ` +
      `matches travel (${forward.x.toFixed(3)}, ${forward.z.toFixed(3)})`,
  );
}

// ── Steering authority survives a standstill ───────────────────────────────

const restLeft = vehicle.step_vehicle(map, withState({}), pressed("KeyA"), DT);
assert(
  restLeft.heading_degrees < withState({}).heading_degrees,
  `a stopped car can still steer left (heading ${restLeft.heading_degrees})`,
);
const restRight = vehicle.step_vehicle(map, withState({}), pressed("KeyD"), DT);
assert(
  restRight.heading_degrees > withState({}).heading_degrees,
  `a stopped car can still steer right (heading ${restRight.heading_degrees})`,
);

// ── Grazing an obstacle slides instead of pinning ──────────────────────────
//
// Building 0 spans x -16..-3, z -9..0. At heading 90 the car is 3.6 wide in
// X, so x = -17.9 leaves its east face just clear of the wall. Push east
// (+X, blocked) while also moving north (-Z, clear). The blocked axis must
// not cancel the clear one.
const graze = withState({
  x: -17.9,
  z: -4.0,
  heading_degrees: 90.0,
  velocity_x: 12.0,
  velocity_z: -6.0,
});
const slid = vehicle.step_vehicle(map, graze, vehicle.apply_focus(vehicle.empty_input(), true), DT);
assert(slid.collided, "grazing an obstacle records a collision");
assert(
  Math.abs(slid.x - graze.x) < 0.0001,
  `blocked axis is held (x ${slid.x} vs ${graze.x})`,
);
assert(
  slid.z < graze.z - 0.001,
  `clear axis keeps moving along the wall (z ${slid.z} vs ${graze.z})`,
);

// ── A car driven into a wall can always recover ────────────────────────────
//
// Hold throttle into the outer west wall until pinned, then steer away and
// drive out. Without wall sliding and a steering floor this never escapes.
let pinned = withState({ x: -25.0, z: 0.0, heading_degrees: -90.0 });
for (let i = 0; i < 120; i++) {
  pinned = vehicle.step_vehicle(map, pinned, pressed("KeyW"), DT);
}
assert(pinned.collided, "holding throttle into the west wall reaches the wall");

let recovered = pinned;
let escapeFrames = -1;
for (let i = 0; i < 600; i++) {
  recovered = vehicle.step_vehicle(map, recovered, pressed("KeyW", "KeyD"), DT);
  if (!recovered.collided) {
    escapeFrames = i + 1;
    break;
  }
}
assert(
  escapeFrames > 0,
  `steering away from a wall recovers (collided ${recovered.collided})`,
);

const escapePoint = recovered;
for (let i = 0; i < 60; i++) {
  recovered = vehicle.step_vehicle(map, recovered, pressed("KeyW"), DT);
}
const travelled = Math.hypot(recovered.x - escapePoint.x, recovered.z - escapePoint.z);
assert(
  travelled > 1.0,
  `recovered car keeps driving after escaping (travelled ${travelled.toFixed(2)})`,
);

// ── Reset-relevant invariant: spawn sits inside the circuit ────────────────

assert(
  !cityMod.city_collides_box(map, vehicle.vehicle_box(vehicle.spawn_vehicle())),
  "spawn position is clear of the city geometry",
);

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
