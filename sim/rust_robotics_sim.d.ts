declare namespace wasm_bindgen {
    /* tslint:disable */
    /* eslint-disable */

    export function start(canvas_id: string): Promise<void>;

}
declare type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

declare interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly start: (a: number, b: number) => any;
    readonly wasm_bindgen__closure__destroy__h6d84dda947f60dbb: (a: number, b: number) => void;
    readonly wasm_bindgen__closure__destroy__h596383a6642ad33e: (a: number, b: number) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h05b62de2a23b11dd: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h39e0b3e6de8ac46d: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h53ef89c32d5fc627: (a: number, b: number) => [number, number];
    readonly wasm_bindgen__convert__closures_____invoke__hc587492605f47a98: (a: number, b: number, c: any) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
declare function wasm_bindgen (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
