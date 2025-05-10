declare module 'three-ik';

export class IK {
    constructor();
    addChain(chain: any): void;
    getIKChain(index: number): any;
    solve(): void;
}

export class IKChain {
    add(bone: any, joint: any): void;
    setTarget(target: any): void;
}

export class IKJoint {
    constructor(bone: any, constraints?: any);
}

export class IKHelper extends THREE.Object3D {
    constructor(ik: IK);
}
