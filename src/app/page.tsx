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

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.outputEncoding = 3001 as THREE.OutputEncoding;
    ref.current?.appendChild(renderer.domElement);
    document.body.appendChild(VRButton.createButton(renderer));

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

    const controller1 = renderer.xr.getController(0);
    const controller2 = renderer.xr.getController(1);
    scene.add(controller1);
    scene.add(controller2);

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

    renderer.setAnimationLoop(() => {
      const delta = 1 / 60;

      const session = renderer.xr.getSession();
      if (session) {
        const inputSources = Array.from(session.inputSources);

        const debugLines: string[] = [];

        for (const src of inputSources) {
          if (src.gamepad) {
            const axes = src.gamepad.axes.map(v => v.toFixed(2)).join(', ');
            debugLines.push(`[${src.handedness}] axes: ${axes}`);
          }
        }

        if (debugLines.length > 0) {
          setDebugText(debugLines.join('\n'));
        } else {
          setDebugText("No Input Sources");
        }
      }

      if (vrm) {
        vrm.scene.position.add(moveVelocity);

        if (moveVelocity.lengthSq() > 0.0001) {
          const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
          vrm.scene.rotation.y += (targetRotation - vrm.scene.rotation.y) * 0.1;
        }

        const rightHand = vrm.humanoid?.getBoneNode('rightHand');
        const leftHand = vrm.humanoid?.getBoneNode('leftHand');

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
      }}>
        {debugText}
      </div>
    </>
  );
}