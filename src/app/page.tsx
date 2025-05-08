'use client';

import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

export default function Home() {
  const ref = useRef<HTMLDivElement>(null);

  // デバッグ用ステート
  const [leftStick, setLeftStick] = useState({ x: 0, y: 0 });
  const [rightStick, setRightStick] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });

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

        const leftSource = inputSources.find(src => src.handedness === 'left' && Boolean(src.gamepad));
        const rightSource = inputSources.find(src => src.handedness === 'right' && Boolean(src.gamepad));

        const [lx = 0, ly = 0] = leftSource?.gamepad?.axes ?? [0, 0];
        const [rx = 0, ry = 0] = rightSource?.gamepad?.axes ?? [0, 0];

        setLeftStick({ x: lx, y: ly });
        setRightStick({ x: rx, y: ry });

        const inputDir = new THREE.Vector3(lx, 0, ly);
        const isMoving = inputDir.lengthSq() > 0.01;

        if (isMoving) {
          inputDir.normalize();
          const cameraDir = new THREE.Vector3();
          camera.getWorldDirection(cameraDir);
          const theta = Math.atan2(cameraDir.x, cameraDir.z);
          inputDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), theta);

          const targetVelocity = inputDir.clone().multiplyScalar(0.03);
          moveVelocity.lerp(targetVelocity, 0.2);
          moveDirection.copy(inputDir);
        } else {
          moveVelocity.lerp(new THREE.Vector3(0, 0, 0), 0.1);
        }
      }

      if (vrm) {
        vrm.scene.position.add(moveVelocity);

        // UI用座標更新
        const pos = vrm.scene.position;
        setPosition({ x: pos.x, y: pos.y, z: pos.z });

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
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
      </Head>

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
        zIndex: 10,
      }}>
        <div>左スティック: X={leftStick.x.toFixed(2)} Y={leftStick.y.toFixed(2)}</div>
        <div>右スティック: X={rightStick.x.toFixed(2)} Y={rightStick.y.toFixed(2)}</div>
        <div>位置: X={position.x.toFixed(2)} Y={position.y.toFixed(2)} Z={position.z.toFixed(2)}</div>
      </div>
    </>
  );
}