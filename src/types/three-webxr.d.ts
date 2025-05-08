// types/three-webxr.d.ts
import { WebGLRenderer } from 'three';

declare module 'three/examples/jsm/webxr/VRButton.js' {
    export class VRButton {
        static createButton(renderer: WebGLRenderer): HTMLElement;
    }
}

//なんか起きたらここが原因
declare module 'three/examples/jsm/webxr/XRControllerModelFactory.js' {
    export class XRControllerModelFactory {
        static createButton(renderer: WebGLRenderer): HTMLElement;
    }
}