// Runtime bridge for bare specifiers "triga:triga", "triga:geometry", "triga:scene".
//
// The built ESM imports `{ triga }` from "triga:triga", `{ geometry }` from
// "triga:geometry", and `{ scene }` from "triga:scene".  Node.js cannot resolve
// these bare specifiers natively, so the test harness registers a loader hook
// that redirects all three to this module.
//
// Functions below mirror the triga.fab, geometry.fab, and scene.fab source
// compiled by the Faber/Radix pipeline.  Only the subset actually reachable
// from the compiled ESM is implemented here.
//
// All operations are pure (no WebGPU, no browser host).

// ============================================================================
// triga:triga  —  Math, face-code, camera, matrix helpers
// ============================================================================

// -- Vector helpers -----------------------------------------------------------

function vector3(x, y, z) {
  return { x, y, z };
}

function vector3_addita(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vector3_multiplicata(v, scalar) {
  return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
}

function vector3_subtracta(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vector3_dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vector3_longitudo(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function vector3_normalizata(v) {
  const len = vector3_longitudo(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function vector3_cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

// -- Angle helpers ------------------------------------------------------------

const DEG2RAD = Math.PI / 180;

function radians_ex_gradibus(degrees) {
  return degrees * DEG2RAD;
}

// -- Face-code helpers --------------------------------------------------------

function face_code_valid(code) {
  return code >= 1 && code <= 6;
}

function face_code_color(code) {
  switch (code) {
    case 1: return { r: 0.8, g: 0.1, b: 0.1 };
    case 2: return { r: 1.0, g: 0.4, b: 0.4 };
    case 3: return { r: 0.1, g: 0.7, b: 0.1 };
    case 4: return { r: 0.4, g: 1.0, b: 0.4 };
    case 5: return { r: 0.1, g: 0.1, b: 0.8 };
    case 6: return { r: 0.4, g: 0.4, b: 1.0 };
    default: return null;
  }
}

function face_code_normal(code) {
  switch (code) {
    case 1: return { x: -1, y: 0, z: 0 };
    case 2: return { x: 1, y: 0, z: 0 };
    case 3: return { x: 0, y: -1, z: 0 };
    case 4: return { x: 0, y: 1, z: 0 };
    case 5: return { x: 0, y: 0, z: -1 };
    case 6: return { x: 0, y: 0, z: 1 };
    default: return null;
  }
}

function face_code_x_offset(code) {
  if (code === 1) return -1;
  if (code === 2) return 1;
  return 0;
}

function face_code_y_offset(code) {
  if (code === 3) return -1;
  if (code === 4) return 1;
  return 0;
}

function face_code_z_offset(code) {
  if (code === 5) return -1;
  if (code === 6) return 1;
  return 0;
}

// -- Box helpers --------------------------------------------------------------

function box3_validum(box) {
  return (
    typeof box.min === "object" && box.min !== null &&
    typeof box.max === "object" && box.max !== null &&
    typeof box.min.x === "number" && typeof box.min.y === "number" && typeof box.min.z === "number" &&
    typeof box.max.x === "number" && typeof box.max.y === "number" && typeof box.max.z === "number" &&
    box.min.x <= box.max.x && box.min.y <= box.max.y && box.min.z <= box.max.z
  );
}

function box3_intersecat(a, b) {
  if (!box3_validum(a) || !box3_validum(b)) return false;
  if (a.max.x < b.min.x || a.min.x > b.max.x) return false;
  if (a.max.y < b.min.y || a.min.y > b.max.y) return false;
  if (a.max.z < b.min.z || a.min.z > b.max.z) return false;
  return true;
}

// -- Face-code quad mesh ------------------------------------------------------

function face_code_unit_quad(code, x, y, z, size) {
  if (!face_code_valid(code)) return null;
  if (size <= 0) return null;
  const x1 = x + size;
  const y1 = y + size;
  const z1 = z + size;
  switch (code) {
    case 1: return { a: vector3(x, y, z), b: vector3(x, y, z1), c: vector3(x, y1, z1), d: vector3(x, y1, z) };
    case 2: return { a: vector3(x1, y, z1), b: vector3(x1, y, z), c: vector3(x1, y1, z), d: vector3(x1, y1, z1) };
    case 3: return { a: vector3(x, y, z), b: vector3(x1, y, z), c: vector3(x1, y, z1), d: vector3(x, y, z1) };
    case 4: return { a: vector3(x, y1, z1), b: vector3(x1, y1, z1), c: vector3(x1, y1, z), d: vector3(x, y1, z) };
    case 5: return { a: vector3(x1, y, z), b: vector3(x, y, z), c: vector3(x, y1, z), d: vector3(x1, y1, z) };
    case 6: return { a: vector3(x, y, z1), b: vector3(x1, y, z1), c: vector3(x1, y1, z1), d: vector3(x, y1, z1) };
  }
}

function face_code_colored_quad_mesh_append(positions, colors, indices, code, x, y, z, size) {
  const quad = face_code_unit_quad(code, x, y, z, size);
  if (quad === null) return null;
  const col = face_code_color(code);
  if (col === null) return null;
  return colored_quad_mesh_append(
    positions, colors, indices,
    quad.a.x, quad.a.y, quad.a.z,
    quad.b.x, quad.b.y, quad.b.z,
    quad.c.x, quad.c.y, quad.c.z,
    quad.d.x, quad.d.y, quad.d.z,
    col.r, col.g, col.b,
  );
}

// -- Camera helpers -----------------------------------------------------------

function camera_pitch_coercita(pitch_degrees) {
  if (pitch_degrees > 89) return 89;
  if (pitch_degrees < -89) return -89;
  return pitch_degrees;
}

function camera_directio_ex_yaw_pitch(yaw_degrees, pitch_degrees) {
  const yaw = radians_ex_gradibus(yaw_degrees);
  const pitch = radians_ex_gradibus(camera_pitch_coercita(pitch_degrees));
  const h = Math.cos(pitch);
  return vector3_normalizata(vector3(
    Math.sin(yaw) * h,
    Math.sin(pitch),
    -Math.cos(yaw) * h,
  ));
}

function camera_forward_planus_ex_yaw(yaw_degrees) {
  const yaw = radians_ex_gradibus(yaw_degrees);
  return vector3_normalizata(vector3(Math.sin(yaw), 0, -Math.cos(yaw)));
}

function camera_right_ex_yaw(yaw_degrees) {
  const yaw = radians_ex_gradibus(yaw_degrees);
  return vector3_normalizata(vector3(Math.cos(yaw), 0, Math.sin(yaw)));
}

function camera_yaw_pitch_facts(origin, yaw_degrees, pitch_degrees) {
  const clamped = camera_pitch_coercita(pitch_degrees);
  const dir = camera_directio_ex_yaw_pitch(yaw_degrees, pitch_degrees);
  return {
    yaw_degrees,
    pitch_degrees,
    clamped_pitch_degrees: clamped,
    direction: dir,
    planar_forward: camera_forward_planus_ex_yaw(yaw_degrees),
    planar_right: camera_right_ex_yaw(yaw_degrees),
    ray: { origin, direction: dir },
  };
}

function camera_motus_planus_ex_yaw(yaw_degrees, forward_amount, right_amount, speed, delta_seconds) {
  if (speed <= 0 || delta_seconds <= 0) return vector3(0, 0, 0);
  const forward = camera_forward_planus_ex_yaw(yaw_degrees);
  const right = camera_right_ex_yaw(yaw_degrees);
  const mixed = vector3_addita(
    vector3_multiplicata(forward, forward_amount),
    vector3_multiplicata(right, right_amount),
  );
  const direction = vector3_normalizata(mixed);
  return vector3_multiplicata(direction, speed * delta_seconds);
}

// -- Matrix helpers -----------------------------------------------------------

function matrix4_identitas() {
  return {
    elements: [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ],
  };
}

function matrix4_multiplicata(a, b) {
  const ae = a.elements;
  const be = b.elements;
  const result = [];
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      result.push(
        ae[0 * 4 + row] * be[col * 4 + 0] +
        ae[1 * 4 + row] * be[col * 4 + 1] +
        ae[2 * 4 + row] * be[col * 4 + 2] +
        ae[3 * 4 + row] * be[col * 4 + 3],
      );
    }
  }
  return { elements: result };
}

function matrix4_perspectiva(fov_y_degrees, aspect, near, far) {
  if (fov_y_degrees <= 0 || fov_y_degrees >= 180) return null;
  if (aspect <= 0) return null;
  if (near <= 0 || far <= near) return null;
  const halfAngle = radians_ex_gradibus(fov_y_degrees) * 0.5;
  const sine = Math.sin(halfAngle);
  const cosine = Math.cos(halfAngle);
  if (Math.abs(sine) <= 0.000001) return null;
  const focal = cosine / sine;
  const depth = far / (near - far);
  return {
    elements: [
      focal / aspect, 0, 0, 0,
      0, focal, 0, 0,
      0, 0, depth, -1,
      0, 0, near * depth, 0,
    ],
  };
}

function matrix4_conspectus(eye, target, up) {
  const forward = vector3_normalizata(vector3_subtracta(target, eye));
  if (vector3_longitudo(forward) <= 0.000001) return null;
  const side = vector3_normalizata(vector3_cross(forward, up));
  if (vector3_longitudo(side) <= 0.000001) return null;
  const cameraUp = vector3_cross(side, forward);
  return {
    elements: [
      side.x, cameraUp.x, -forward.x, 0,
      side.y, cameraUp.y, -forward.y, 0,
      side.z, cameraUp.z, -forward.z, 0,
      -vector3_dot(side, eye), -vector3_dot(cameraUp, eye), vector3_dot(forward, eye), 1,
    ],
  };
}

function transform_payload(model, viewProjection) {
  if (!model || !viewProjection) return null;
  if (model.elements.length !== 16 || viewProjection.elements.length !== 16) return null;
  return { values: [...model.elements, ...viewProjection.elements] };
}

// ============================================================================
// triga:geometry  —  Mesh append, facts, bounding box, wire geometry
// ============================================================================

function colored_quad_mesh_append(
  positions, colors, indices,
  ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz,
  r, g, b,
) {
  if (positions.length !== colors.length) return null;
  if (positions.length % 3 !== 0) return null;
  if (indices.length % 3 !== 0) return null;

  const nextPositions = [...positions];
  const nextColors = [...colors];
  const nextIndices = [...indices];
  const vertexBase = positions.length / 3;

  nextPositions.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
  nextColors.push(r, g, b, r, g, b, r, g, b, r, g, b);
  nextIndices.push(vertexBase, vertexBase + 1, vertexBase + 2, vertexBase, vertexBase + 2, vertexBase + 3);

  return { positions: nextPositions, colors: nextColors, indices: nextIndices };
}

function colored_quad_mesh_face_count(mesh) {
  if (mesh.positions.length !== mesh.colors.length) return null;
  if (mesh.positions.length % 12 !== 0) return null;
  if (mesh.indices.length % 6 !== 0) return null;
  const count = mesh.positions.length / 12;
  if (count === 0) return null;
  if (mesh.indices.length !== count * 6) return null;
  return count;
}

function colored_quad_mesh_facts(mesh) {
  const count = colored_quad_mesh_face_count(mesh);
  if (count === null) return null;
  return visible_face_mesh_facts(count);
}

function visible_face_vertex_count(faceCount) {
  if (faceCount <= 0) return null;
  return faceCount * 4;
}

function visible_face_index_count(faceCount) {
  if (faceCount <= 0) return null;
  return faceCount * 6;
}

function visible_face_triangle_count(faceCount) {
  if (faceCount <= 0) return null;
  return faceCount * 2;
}

function visible_face_mesh_facts(faceCount) {
  const vc = visible_face_vertex_count(faceCount);
  if (vc === null) return null;
  const ic = visible_face_index_count(faceCount);
  if (ic === null) return null;
  const tc = visible_face_triangle_count(faceCount);
  if (tc === null) return null;
  const posBytes = vc * 3 * 4;
  const colBytes = vc * 3 * 4;
  const idxBytes = ic * 4;
  return {
    face_count: faceCount,
    vertex_count: vc,
    index_count: ic,
    triangle_count: tc,
    position_payload_byte_count: posBytes,
    color_payload_byte_count: colBytes,
    index_payload_byte_count: idxBytes,
    total_payload_byte_count: posBytes + colBytes + idxBytes,
  };
}

function colored_quad_mesh_bounding_box(mesh) {
  const { positions } = mesh;
  if (positions.length < 3) return null;
  let minX = positions[0], minY = positions[1], minZ = positions[2];
  let maxX = positions[0], maxY = positions[1], maxZ = positions[2];
  for (let i = 3; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return { min_x: minX, min_y: minY, min_z: minZ, max_x: maxX, max_y: maxY, max_z: maxZ };
}

// -- Box wire geometry (box_wire_geometry returns BufferGeometry-like object) --

function box_wire_geometry(width, height, depth) {
  if (width <= 0 || height <= 0 || depth <= 0) return null;
  const hx = width * 0.5;
  const hy = height * 0.5;
  const hz = depth * 0.5;
  // 8 vertices
  const positions = [
    -hx, -hy, -hz,  hx, -hy, -hz,  hx,  hy, -hz, -hx,  hy, -hz,
    -hx, -hy,  hz,  hx, -hy,  hz,  hx,  hy,  hz, -hx,  hy,  hz,
  ];
  // 12 edges = 24 indices
  const indices = [
    0, 1, 1, 2, 2, 3, 3, 0,
    4, 5, 5, 6, 6, 7, 7, 4,
    0, 4, 1, 5, 2, 6, 3, 7,
  ];
  return {
    vertex_count: 8,
    indices,
    // Additional BufferGeometry-like fields for compatibility.
    topology: { kind: "LineList" },
    attributes: [
      { name: "position", shader_location: 0, component_width: 3, element_count: 8,
        normalized: false, usage: { kind: "StaticAttribute" },
        data: { kind: "Float32Attribute", values: positions } },
    ],
    indexed: true,
    draw_range: { start: 0, count: 24 },
    groups: [{ start: 0, count: 24, material_index: 0 }],
  };
}

function box_wire_draw_batch_facts(width, height, depth, instanceCount) {
  const geo = box_wire_geometry(width, height, depth);
  if (geo === null) return null;
  // Return minimal LineGeometryDrawBatchFacts shape.
  const lineCount = geo.indices.length / 2;
  const elementTotal = geo.indices.length;
  const vertexBytes = geo.vertex_count * 3 * 4;
  const indexBytes = geo.indices.length * 4;
  return {
    draw_count: 1,
    line_count: lineCount,
    grouped_element_total: elementTotal,
    vertex_payload_byte_count: vertexBytes,
    index_payload_byte_count: indexBytes,
    total_payload_byte_count: vertexBytes + indexBytes,
  };
}

// ============================================================================
// triga:scene  —  Resource lifecycle transitions
// ============================================================================

function resource_handle_next(handle) {
  return { index: handle.index, generation: handle.generation + 1 };
}

function resource_lifecycle_unchanged(handle) {
  return {
    logical_index: handle.index,
    previous: { index: handle.index, generation: handle.generation },
    current: { index: handle.index, generation: handle.generation },
    changed: false,
    removed: false,
  };
}

function resource_lifecycle_replaced(handle) {
  return {
    logical_index: handle.index,
    previous: { index: handle.index, generation: handle.generation },
    current: resource_handle_next(handle),
    changed: true,
    removed: false,
  };
}

function resource_lifecycle_removed(handle) {
  return {
    logical_index: handle.index,
    previous: { index: handle.index, generation: handle.generation },
    current: null,
    changed: true,
    removed: true,
  };
}

function resource_lifecycle_created(handle) {
  return {
    logical_index: handle.index,
    previous: null,
    current: { index: handle.index, generation: handle.generation },
    changed: true,
    removed: false,
  };
}

function resource_lifecycles_valid(batch) {
  if (!Array.isArray(batch)) return false;
  const seen = new Set();
  for (const t of batch) {
    if (typeof t !== "object" || t === null) return false;
    if (typeof t.logical_index !== "number") return false;
    if (seen.has(t.logical_index)) return false;
    seen.add(t.logical_index);
    if (!t.previous && !t.current) return false;
    if (t.removed) {
      if (!t.previous || t.current) return false;
    }
  }
  return true;
}

// ============================================================================
// Exports
// ============================================================================

export const triga = {
  vector3,
  vector3_addita,
  vector3_multiplicata,
  vector3_subtracta,
  vector3_dot,
  vector3_longitudo,
  vector3_normalizata,
  vector3_cross,
  radians_ex_gradibus,
  face_code_valid,
  face_code_color,
  face_code_normal,
  face_code_x_offset,
  face_code_y_offset,
  face_code_z_offset,
  face_code_colored_quad_mesh_append,
  box3_validum,
  box3_intersecat,
  camera_pitch_coercita,
  camera_directio_ex_yaw_pitch,
  camera_forward_planus_ex_yaw,
  camera_right_ex_yaw,
  camera_yaw_pitch_facts,
  camera_motus_planus_ex_yaw,
  matrix4_identitas,
  matrix4_multiplicata,
  matrix4_perspectiva,
  matrix4_conspectus,
  transform_payload,
};

export const geometry = {
  colored_quad_mesh_append,
  colored_quad_mesh_facts,
  colored_quad_mesh_bounding_box,
  box_wire_geometry,
  box_wire_draw_batch_facts,
};

export const scene = {
  resource_lifecycle_unchanged,
  resource_lifecycle_replaced,
  resource_lifecycle_removed,
  resource_lifecycle_created,
  resource_lifecycles_valid,
};
