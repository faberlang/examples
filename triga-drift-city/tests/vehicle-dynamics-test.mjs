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
// This is what the player actually does: drive straight into a wall, then hold
// throttle and steer. Each recovery input is checked on its own, because the
// failure being guarded against was a car that answered none of them.

function driveIntoWall() {
  let car = vehicle.spawn_vehicle();
  for (let i = 0; i < 300; i++) {
    car = vehicle.step_vehicle(map, car, pressed("KeyW"), DT);
  }
  return car;
}

const pinned = driveIntoWall();
assert(pinned.collided, "holding throttle drives the car into the north wall");
assert(
  !cityMod.city_collides_footprint(map, vehicle.vehicle_footprint(pinned)),
  "a car stopped by a wall rests clear of it, not inside it",
);

// Throttle and steer: the car should turn off the wall and drive away.
let steeredOff = pinned;
for (let i = 0; i < 300; i++) {
  steeredOff = vehicle.step_vehicle(map, steeredOff, pressed("KeyW", "KeyD"), DT);
}
assert(
  Math.abs(steeredOff.heading_degrees - pinned.heading_degrees) > 90.0,
  `throttle and steer turns the car off the wall ` +
    `(heading ${pinned.heading_degrees.toFixed(1)} to ${steeredOff.heading_degrees.toFixed(1)})`,
);
assert(
  Math.hypot(steeredOff.x - pinned.x, steeredOff.z - pinned.z) > 5.0,
  "throttle and steer carries the car away from the wall",
);
assert(vehicle.speed(steeredOff) > 1.0, "the recovered car is still moving");

// Steering with no throttle must also work: a pinned car can always pivot.
let pivoted = pinned;
for (let i = 0; i < 300; i++) {
  pivoted = vehicle.step_vehicle(map, pivoted, pressed("KeyD"), DT);
}
assert(
  Math.abs(pivoted.heading_degrees - pinned.heading_degrees) > 90.0,
  `a pinned car can pivot on steering alone ` +
    `(heading ${pivoted.heading_degrees.toFixed(1)})`,
);

// Reverse must also work.
let reversed = pinned;
for (let i = 0; i < 120; i++) {
  reversed = vehicle.step_vehicle(map, reversed, pressed("KeyS"), DT);
}
assert(
  Math.hypot(reversed.x - pinned.x, reversed.z - pinned.z) > 5.0,
  `a pinned car can reverse out ` +
    `(moved ${Math.hypot(reversed.x - pinned.x, reversed.z - pinned.z).toFixed(2)})`,
);

// ── The collision shape is the car, not a bound around it ──────────────────
//
// An axis-aligned bound of the rotated car fills the corners the car itself
// does not occupy. Sitting diagonally off the north-west corner of building 0
// (x -16..-3, z -9..0) is clear for the car but not for that bound.
const diagonal = withState({ x: -17.5, z: 1.5, heading_degrees: 45.0 });
assert(
  cityMod.city_collides_box(map, vehicle.vehicle_box(diagonal)),
  "the axis-aligned bound would report a corner collision here",
);
assert(
  !cityMod.city_collides_footprint(map, vehicle.vehicle_footprint(diagonal)),
  "the exact footprint clears the building corner",
);

for (const heading of [30, 45, 60]) {
  const bound = vehicle.vehicle_box_at(0, 0.2, 0, heading);
  const boundArea = (bound.max.x - bound.min.x) * (bound.max.z - bound.min.z);
  const carArea =
    vehicle.vehicle_half_length() * 2 * vehicle.vehicle_half_width() * 2;
  assert(
    boundArea > carArea * 1.5,
    `heading ${heading}: the discarded bound really was oversized ` +
      `(${boundArea.toFixed(1)} m² vs ${carArea.toFixed(1)} m²)`,
  );
}

// ── Turning may never leave the car inside geometry ────────────────────────
//
// The footprint sweeps as it rotates, so a turn taken while flush against a
// wall used to land the car inside that wall, where no move was legal.
let flush = withState({ x: -16.95, z: -4.5, heading_degrees: 0.0 });
assert(
  !cityMod.city_collides_footprint(map, vehicle.vehicle_footprint(flush)),
  "the car starts flush against the wall and clear of it",
);
let everEmbedded = false;
for (let i = 0; i < 240; i++) {
  flush = vehicle.step_vehicle(map, flush, pressed("KeyD"), DT);
  if (cityMod.city_collides_footprint(map, vehicle.vehicle_footprint(flush))) {
    everEmbedded = true;
    break;
  }
}
assert(everEmbedded === false, "turning while flush never embeds the car");

// Backing away from that wall must still work.
let backing = flush;
for (let i = 0; i < 90; i++) {
  backing = vehicle.step_vehicle(map, backing, pressed("KeyS"), DT);
}
const backedOff = Math.hypot(backing.x - flush.x, backing.z - flush.z);
assert(
  backedOff > 5.0,
  `a car flush against a wall can still reverse away (moved ${backedOff.toFixed(2)})`,
);

// ── An embedded car can always drive clear ────────────────────────────────
//
// Driving cannot reach this state, but a bad starting state must not freeze.
let inside = withState({ x: -10.0, z: -4.5, heading_degrees: 0.0 });
assert(
  cityMod.city_collides_footprint(map, vehicle.vehicle_footprint(inside)),
  "the recovery case starts inside a building",
);
for (let i = 0; i < 300; i++) {
  inside = vehicle.step_vehicle(map, inside, pressed("KeyW"), DT);
  if (!cityMod.city_collides_footprint(map, vehicle.vehicle_footprint(inside))) break;
}
assert(
  !cityMod.city_collides_footprint(map, vehicle.vehicle_footprint(inside)),
  "a car starting inside a building can drive out of it",
);

// ── Sweep: ram something from every direction and always get free ─────────
//
// The reported failure was a car that reached a state where no input did
// anything. Drive into whatever lies ahead on each heading, then check the car
// is still outside geometry and that throttle-and-steer frees it.
for (let heading = 0; heading < 360; heading += 30) {
  let car = withState({ heading_degrees: heading > 180 ? heading - 360 : heading });
  for (let i = 0; i < 300; i++) {
    car = vehicle.step_vehicle(map, car, pressed("KeyW"), DT);
  }
  assert(
    !cityMod.city_collides_footprint(map, vehicle.vehicle_footprint(car)),
    `heading ${heading}: car never ends up inside geometry`,
  );

  let freed = car;
  for (let i = 0; i < 300; i++) {
    freed = vehicle.step_vehicle(map, freed, pressed("KeyW", "KeyD"), DT);
  }
  const moved = Math.hypot(freed.x - car.x, freed.z - car.z);
  const turned = Math.abs(freed.heading_degrees - car.heading_degrees);
  assert(
    moved > 3.0 || turned > 45.0,
    `heading ${heading}: throttle and steer frees the car ` +
      `(moved ${moved.toFixed(1)}, turned ${turned.toFixed(1)})`,
  );
}

// ── Reset-relevant invariant: spawn sits inside the circuit ────────────────

assert(
  !cityMod.city_collides_box(map, vehicle.vehicle_box(vehicle.spawn_vehicle())),
  "spawn position is clear of the city geometry",
);

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
