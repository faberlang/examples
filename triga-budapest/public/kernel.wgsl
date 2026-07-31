// Lit scene shader for Triga Budapest.
//
// Vertex format: position (location 0, float32x3)
//                normal   (location 1, float32x3)
//                color    (location 2, float32x3)
// Stride: 36 bytes (9 f32 per vertex)
//
// Bind group 0:
//   binding 0 — transform storage buffer (64 f32: model 16 + view_proj 16 + padding 32)
//   binding 1 — lighting uniform buffer (8 f32: sun_dir(3) + ambient(3) + sun_color(3) padded)

@group(0) @binding(0) var<storage, read> transform: array<f32>;
@group(0) @binding(1) var<uniform> lighting: LightingUniforms;

struct LightingUniforms {
  sun_direction: vec3<f32>,   // normalized, points toward the light
  _pad0: f32,
  sun_color: vec3<f32>,       // sun intensity (linear, 0..1+)
  _pad1: f32,
  ambient_color: vec3<f32>,   // ambient sky/fill light
  _pad2: f32,
};

struct LitVertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) color: vec3<f32>,
}

struct LitVertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(perspective) world_normal: vec3<f32>,
  @location(1) @interpolate(perspective) base_color: vec3<f32>,
}

@vertex
fn greybox_vertex(input: LitVertexInput) -> LitVertexOutput {
  var out: LitVertexOutput;
  let model = mat4x4<f32>(
    vec4<f32>(transform[0], transform[1], transform[2], transform[3]),
    vec4<f32>(transform[4], transform[5], transform[6], transform[7]),
    vec4<f32>(transform[8], transform[9], transform[10], transform[11]),
    vec4<f32>(transform[12], transform[13], transform[14], transform[15])
  );
  let view_proj = mat4x4<f32>(
    vec4<f32>(transform[16], transform[17], transform[18], transform[19]),
    vec4<f32>(transform[20], transform[21], transform[22], transform[23]),
    vec4<f32>(transform[24], transform[25], transform[26], transform[27]),
    vec4<f32>(transform[28], transform[29], transform[30], transform[31])
  );
  // Normal matrix: for uniform scale, model's upper-left 3x3 suffices.
  let world_pos = model * vec4<f32>(input.position, 1.0);
  out.position = view_proj * world_pos;
  out.world_normal = normalize(input.normal);
  out.base_color = input.color;
  return out;
}

struct LitFragmentInput {
  @location(0) @interpolate(perspective) world_normal: vec3<f32>,
  @location(1) @interpolate(perspective) base_color: vec3<f32>,
}

struct LitFragmentOutput {
  @location(0) color: vec4<f32>,
}

@fragment
fn greybox_fragment(input: LitFragmentInput) -> LitFragmentOutput {
  var out: LitFragmentOutput;
  let N = normalize(input.world_normal);
  let L = normalize(lighting.sun_direction);
  let NdotL = max(dot(N, L), 0.0);

  // Simple Lambert + ambient with a hemisphere fill term.
  // Up-facing surfaces get sky ambient; down-facing get ground ambient.
  let up_facing = max(N.y, 0.0);
  let down_facing = max(-N.y, 0.0);
  let sky_tint = vec3<f32>(0.4, 0.55, 0.75) * up_facing;
  let ground_tint = vec3<f32>(0.2, 0.18, 0.15) * down_facing;
  let hemi_ambient = lighting.ambient_color + sky_tint * 0.3 + ground_tint * 0.2;

  let diffuse = lighting.sun_color * NdotL;
  let lit_color = input.base_color * (hemi_ambient + diffuse);

  out.color = vec4<f32>(lit_color, 1.0);
  return out;
}
