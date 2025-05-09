'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

export default function Home() {
  const ref = useRef<HTMLDivElement>(null);
  const [debugText, setDebugText] = useState('No Data');
  const stickBase = useRef<THREE.Mesh | null>(null);
  const stickKnob = useRef<THREE.Mesh | null>(null);
  const inputDir = useRef(new THREE.Vector3());

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 3);

    const cameraRig = new THREE.Group();
    cameraRig.add(camera);
    scene.add(cameraRig);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.outputEncoding = 3001 as THREE.OutputEncoding;
    ref.current?.appendChild(renderer.domElement);

    if (!document.getElementById('VRButton')) {
      const button = VRButton.createButton(renderer);
      button.id = 'VRButton';
      button.style.position = 'absolute';
      button.style.bottom = '10px';
      button.style.right = '20px';
      button.style.zIndex = '999';
      document.body.appendChild(button);
    }

    const light = new THREE.HemisphereLight(0xffffff, 0x444444);
    light.position.set(0, 20, 0);
    scene.add(light);

    new EXRLoader().load('/hdri/urban.exr', (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
      scene.background = texture;
    });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0x555555 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xff0000 })
    );
    cube.position.set(0, 0.5, -3);
    scene.add(cube);

    const controllerFactory = new XRControllerModelFactory();
    const grip1 = renderer.xr.getControllerGrip(0);
    grip1.add(controllerFactory.createControllerModel(grip1));
    scene.add(grip1);

    const grip2 = renderer.xr.getControllerGrip(1);
    grip2.add(controllerFactory.createControllerModel(grip2));
    scene.add(grip2);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    let vrm: VRM | null = null;

    loader.load('/vrm/AliciaSolid.vrm', (gltf) => {
      vrm = gltf.userData.vrm;
      if (vrm) {
        vrm.scene.position.y = -1.6;
        scene.add(vrm.scene);
      }
    });

    function simpleIK(bone: THREE.Object3D, target: THREE.Object3D, chainLength = 3) {
      let current: THREE.Object3D | null = bone;
      for (let i = 0; i < chainLength; i++) {
        if (!current?.parent) break;
        const toTarget = new THREE.Vector3().subVectors(
          target.position,
          current.getWorldPosition(new THREE.Vector3())
        );
        toTarget.normalize().multiplyScalar(0.05);
        current.position.add(toTarget);
        current.updateMatrixWorld();
        current = current.parent;
      }
    }

    const moveVelocity = new THREE.Vector3();
    const moveDirection = new THREE.Vector3();

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    base.position.set(-0.3, 0.8, -0.5);
    scene.add(base);
    stickBase.current = base;

    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.05),
      new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    );
    knob.position.set(-0.3, 0.85, -0.5);
    scene.add(knob);
    stickKnob.current = knob;

    renderer.setAnimationLoop(() => {
      const delta = 1 / 60;

      const session = renderer.xr.getSession();
      if (session) {
        const inputSources = Array.from(session.inputSources);
        const debugLines: string[] = [];

        for (const src of inputSources) {
          debugLines.push(`[${src.handedness}]`);
          debugLines.push(`  has gamepad? ${!!src.gamepad}`);
          if (src.gamepad) {
            debugLines.push(`  axes: ${src.gamepad.axes}`);
            debugLines.push(`  buttons: ${src.gamepad.buttons.map(b => b.value).join(',')}`);
          }
          debugLines.push(`  profiles: ${src.profiles}`);
        }

        setDebugText(debugLines.join('\n'));
      }

      const controller = renderer.xr.getController(0);
      if (stickBase.current && stickKnob.current) {
        const distance = controller.position.distanceTo(stickKnob.current.position);
        if (distance < 0.1) {
          const delta = new THREE.Vector3().subVectors(controller.position, stickBase.current.position);
          delta.y = 0;
          const len = delta.length();
          if (len > 0.01) {
            delta.normalize();
            inputDir.current.copy(delta);
            stickKnob.current.position.copy(stickBase.current.position).add(delta.clone().multiplyScalar(0.05));
          }
        } else {
          inputDir.current.set(0, 0, 0);
          stickKnob.current.position.lerp(stickBase.current.position, 0.1);
        }
      }

      if (inputDir.current.lengthSq() > 0.001) {
        const cameraDir = new THREE.Vector3();
        camera.getWorldDirection(cameraDir);
        const theta = Math.atan2(cameraDir.x, cameraDir.z);
        const dir = inputDir.current.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), theta);
        const targetVelocity = dir.multiplyScalar(0.03);
        moveVelocity.lerp(targetVelocity, 0.2);
        moveDirection.copy(dir);
      } else {
        moveVelocity.lerp(new THREE.Vector3(0, 0, 0), 0.1);
      }

      if (vrm) {
        vrm.scene.position.add(moveVelocity);
        cameraRig.position.add(moveVelocity);

        const rightHand = vrm.humanoid?.getRawBoneNode('rightHand');
        const leftHand = vrm.humanoid?.getRawBoneNode('leftHand');

        if (rightHand) {
          simpleIK(rightHand, grip1);
          rightHand.quaternion.copy(grip1.quaternion);
        }

        if (leftHand) {
          simpleIK(leftHand, grip2);
          leftHand.quaternion.copy(grip2.quaternion);
        }

        vrm.update(delta);
      }

      renderer.render(scene, camera);
    });

    return () => {
      renderer.dispose();
    };
  }, []);

  return (
    <>
      <div ref={ref} />
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        background: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '10px',
        fontSize: '14px',
        fontFamily: 'monospace',
        whiteSpace: 'pre',
        zIndex: 10,
      }}>{debugText}</div>
    </>
  );
}
