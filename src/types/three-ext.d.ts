// types/three-ext.d.ts
import type * as THREE from 'three';

// eslint対策用のダミー参照
type _Dummy = THREE.WebGLRenderer;

declare module 'three' {
    export type OutputEncoding = 3000 | 3001;

    export const LinearEncoding: OutputEncoding;
    export const sRGBEncoding: OutputEncoding;

    interface WebGLRenderer {
        outputEncoding: OutputEncoding;
    }
}