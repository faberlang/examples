declare module "web:dom" {
  export class Scope { selector: string; constructor(fields: { selector?: string }); }
  export class Element { selector: string; constructor(fields: { selector?: string }); }
  export class DomEvent { kind: string; default_prevented: boolean; }
  export class FrameState { frame: number; time_ms: number; delta_ms: number; }
  export class ResizeState { width: number; height: number; device_pixel_ratio: number; }
  export class KeyboardState { kind: string; key: string; code: string; repeat: boolean; alt: boolean; ctrl: boolean; shift: boolean; meta: boolean; }
  export class PointerState { kind: string; x: number; y: number; movement_x: number; movement_y: number; button: number; primary: boolean; }
  export class FocusState { focused: boolean; }
  export class PointerLockState { supported: boolean; locked: boolean; denied: boolean; target_matches: boolean; }
  export class Subscription { id: number; }
  export class SubmitOptions { prevent_default: boolean; constructor(fields?: { prevent_default?: boolean }); }
  export class FetchRequest { url: string; method: string; body: string | null; constructor(fields: { url: string; method?: string; body?: string | null }); }
  export class FetchResponse { status: number; ok: boolean; body: string; }
  export type EventHandler = (event: DomEvent) => void;
  export type InputHandler = (element: Element, value: string) => void;
  export type SubmitHandler = (form: Element) => void;
  export type FrameHandler = (state: FrameState) => void;
  export type ResizeHandler = (state: ResizeState) => void;
  export type KeyboardHandler = (state: KeyboardState) => void;
  export type PointerHandler = (state: PointerState) => void;
  export type FocusHandler = (state: FocusState) => void;
  export type PointerLockHandler = (state: PointerLockState) => void;
  export function scope(selector: string): Scope;
  export function element(selector: string): Element;
  export function query(scope: Scope, selector: string): Element | null;
  export function require(scope: Scope, selector: string): Element;
  export function all(scope: Scope, selector: string): Element[];
  export function text_set(element: Element, value: string): void;
  export function attr_set(element: Element, name: string, value: string): void;
  export function attr_remove(element: Element, name: string): void;
  export function class_add(element: Element, class_name: string): void;
  export function class_remove(element: Element, class_name: string): void;
  export function class_toggle(element: Element, class_name: string): void;
  export function on(element: Element, event_name: string, handler: EventHandler): Subscription;
  export function unsubscribe(subscription: Subscription): void;
  export function value(element: Element): string;
  export function value_set(element: Element, value: string): void;
  export function on_input(element: Element, handler: InputHandler): Subscription;
  export function on_submit(form: Element, options: SubmitOptions, handler: SubmitHandler): Subscription;
  export function on_frame(handler: FrameHandler): Subscription;
  export function on_resize(handler: ResizeHandler): Subscription;
  export function on_keyboard(element: Element, event_name: string, handler: KeyboardHandler): Subscription;
  export function on_pointer(element: Element, event_name: string, handler: PointerHandler): Subscription;
  export function on_focus(element: Element, event_name: string, handler: FocusHandler): Subscription;
  export function pointer_lock_state(element: Element): PointerLockState;
  export function request_pointer_lock(element: Element): PointerLockState;
  export function exit_pointer_lock(): PointerLockState;
  export function on_pointer_lock(element: Element, handler: PointerLockHandler): Subscription;
  export function prevent_default(event: DomEvent): DomEvent;
  export function fetch_text(request: FetchRequest): Promise<FetchResponse>;
  export const dom: {
    scope(selector: string): Scope;
    element(selector: string): Element;
    query(scope: Scope, selector: string): Element | null;
    require(scope: Scope, selector: string): Element;
    all(scope: Scope, selector: string): Element[];
    text_set(element: Element, value: string): void;
    attr_set(element: Element, name: string, value: string): void;
    attr_remove(element: Element, name: string): void;
    class_add(element: Element, class_name: string): void;
    class_remove(element: Element, class_name: string): void;
    class_toggle(element: Element, class_name: string): void;
    on(element: Element, event_name: string, handler: EventHandler): Subscription;
    unsubscribe(subscription: Subscription): void;
    value(element: Element): string;
    value_set(element: Element, value: string): void;
    on_input(element: Element, handler: InputHandler): Subscription;
    on_submit(form: Element, options: SubmitOptions, handler: SubmitHandler): Subscription;
    on_frame(handler: FrameHandler): Subscription;
    on_resize(handler: ResizeHandler): Subscription;
    on_keyboard(element: Element, event_name: string, handler: KeyboardHandler): Subscription;
    on_pointer(element: Element, event_name: string, handler: PointerHandler): Subscription;
    on_focus(element: Element, event_name: string, handler: FocusHandler): Subscription;
    pointer_lock_state(element: Element): PointerLockState;
    request_pointer_lock(element: Element): PointerLockState;
    exit_pointer_lock(): PointerLockState;
    on_pointer_lock(element: Element, handler: PointerLockHandler): Subscription;
    prevent_default(event: DomEvent): DomEvent;
    fetch_text(request: FetchRequest): Promise<FetchResponse>;
  };
}
declare module "web:web" {
  export class Mount { selector: string; constructor(fields: { selector?: string }); }
  export function mount(selector: string): Mount;
  export function selector_of(mount: Mount): string;
  export const web: {
    mount(selector: string): Mount;
    selector_of(mount: Mount): string;
  };
}
declare module "triga:triga" {
  export function vector3(x: number, y: number, z: number): any;
  export function vector3_subtracta(a: any, b: any): any;
  export function vector3_normalizata(v: any): any;
  export function vector3_cross(a: any, b: any): any;
  export function box3_intersecat(a: any, b: any): any;
  export function box(min: any, max: any): any;
  export function matrix4_identitas(): any;
  export function matrix4_perspectiva(fov_degrees: number, aspect: number, near: number, far: number): any;
  export function matrix4_conspectus(eye: any, target: any, up: any): any;
  export function matrix4_multiplicata(a: any, b: any): any;
  export function transform_payload(model: any, view_projection: any): any;
  export function camera_pitch_coercita(pitch_degrees: number): number;
  export function camera_yaw_pitch_facts(eye: any, yaw_degrees: number, pitch_degrees: number): any;
  export function camera_motus_planus_ex_yaw(yaw_degrees: number, forward: number, right: number, speed: number, delta_seconds: number): any;
  export function face_code_color(face_code: number): number;
  export function face_code_colored_quad_mesh_append(positions: any, colors: any, indices: any, face_code: number, x: number, y: number, z: number, color: number): any;
  export function face_code_normal(face_code: number): any;
  export function face_code_valid(face_code: number): boolean;
  export function face_code_x_offset(face_code: number): number;
  export function face_code_y_offset(face_code: number): number;
  export function face_code_z_offset(face_code: number): number;
  export function matrix4_valid(matrix: any): boolean;
  export function transform_payload_byte_count(payload: any): number | null;
  export const triga: {
    vector3(x: number, y: number, z: number): any;
    vector3_subtracta(a: any, b: any): any;
    vector3_normalizata(v: any): any;
    vector3_cross(a: any, b: any): any;
    box3_intersecat(a: any, b: any): any;
    box(min: any, max: any): any;
    matrix4_identitas(): any;
    matrix4_perspectiva(fov_degrees: number, aspect: number, near: number, far: number): any;
    matrix4_conspectus(eye: any, target: any, up: any): any;
    matrix4_multiplicata(a: any, b: any): any;
    transform_payload(model: any, view_projection: any): any;
    camera_pitch_coercita(pitch_degrees: number): number;
    camera_yaw_pitch_facts(eye: any, yaw_degrees: number, pitch_degrees: number): any;
    camera_motus_planus_ex_yaw(yaw_degrees: number, forward: number, right: number, speed: number, delta_seconds: number): any;
    face_code_color(face_code: number): number;
    face_code_colored_quad_mesh_append(positions: any, colors: any, indices: any, face_code: number, x: number, y: number, z: number, color: number): any;
    face_code_normal(face_code: number): any;
    face_code_valid(face_code: number): boolean;
    face_code_x_offset(face_code: number): number;
    face_code_y_offset(face_code: number): number;
    face_code_z_offset(face_code: number): number;
    matrix4_valid(matrix: any): boolean;
    transform_payload_byte_count(payload: any): number | null;
  };
}
declare module "triga:geometry" {
  export function box_wire_geometry(width: number, height: number, depth: number): any;
  export function box_wire_draw_batch_facts(width: number, height: number, depth: number, color: number): any;
  export function colored_quad_mesh_bounding_box(payload: any): any;
  export function colored_quad_mesh_facts(payload: any): any;
  export function colored_quad_mesh_append(positions: any, colors: any, indices: any, ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, dx: number, dy: number, dz: number, r: number, g: number, b: number): any;
  export const geometry: {
    box_wire_geometry(width: number, height: number, depth: number): any;
    box_wire_draw_batch_facts(width: number, height: number, depth: number, color: number): any;
    colored_quad_mesh_bounding_box(payload: any): any;
    colored_quad_mesh_facts(payload: any): any;
    colored_quad_mesh_append(positions: any, colors: any, indices: any, ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, dx: number, dy: number, dz: number, r: number, g: number, b: number): any;
  };
}
declare module "triga:scene" {
  export function resource_lifecycle_created(payload: any): any;
  export function resource_lifecycle_removed(payload: any): any;
  export function resource_lifecycle_replaced(payload: any): any;
  export function resource_lifecycle_unchanged(payload: any): any;
  export function resource_lifecycles_valid(payload: any): boolean;
  export const scene: {
    resource_lifecycle_created(payload: any): any;
    resource_lifecycle_removed(payload: any): any;
    resource_lifecycle_replaced(payload: any): any;
    resource_lifecycle_unchanged(payload: any): any;
    resource_lifecycles_valid(payload: any): boolean;
  };
}
