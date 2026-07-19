declare module "web:dom" {
  export class Scope { selector: string; constructor(fields: { selector?: string }); }
  export class Element { selector: string; constructor(fields: { selector?: string }); }
  export class DomEvent { kind: string; default_prevented: boolean; }
  export class Subscription { id: number; }
  export class SubmitOptions { prevent_default: boolean; constructor(fields?: { prevent_default?: boolean }); }
  export class FetchRequest { url: string; method: string; body: string | null; constructor(fields: { url: string; method?: string; body?: string | null }); }
  export class FetchResponse { status: number; ok: boolean; body: string; }
  export type EventHandler = (event: DomEvent) => void;
  export type InputHandler = (element: Element, value: string) => void;
  export type SubmitHandler = (form: Element) => void;
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
