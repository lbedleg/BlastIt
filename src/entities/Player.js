import * as THREE from 'three';
import { ASSETS } from '../constants.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

export class PlayerAvatar {
  constructor({
    scene,
    isLocal = false,
    name = 'Player',
    teamColor = 'blue',
    spawnZ = -7.35,
    bounds = null,
  }) {
    this.scene = scene;
    this.isLocal = isLocal;
    this.name = name;
    this.teamColor = teamColor;
    this.bounds = bounds;

    this.mesh = null;
    this.speed = 4;
    this.position = new THREE.Vector3(0, 0, spawnZ);

    this._box = new THREE.Box3();

    this._loadModel();
  }

  _loadModel() {
    const modelPath = ASSETS.models.player;

    gltfLoader.load(
      modelPath,
      (gltf) => {
        const root = gltf.scene;

        root.scale.setScalar(0.03);

        // color tint based on team
        const tint =
          this.teamColor === 'red'
            ? new THREE.Color(1.0, 0.6, 0.6)
            : new THREE.Color(0.6, 0.8, 1.0);

        root.traverse((child) => {
          if (!child.isMesh) return;

          child.castShadow = true;
          child.receiveShadow = true;

          const mat = child.material;
          if (mat) {
            if (mat.map) {
              mat.map.colorSpace = THREE.SRGBColorSpace;
            }
            if (mat.color) {
              mat.color.multiply(tint);
            }
            mat.needsUpdate = true;
          }
        });

        const box = new THREE.Box3().setFromObject(root);
        const minY = box.min.y;

        let x = this.position.x;
        if (this.bounds) {
          x = THREE.MathUtils.clamp(x, this.bounds.minX, this.bounds.maxX);
        }

        root.position.set(x, -minY, this.position.z);

        this.position.set(x, 0, this.position.z);
        this.mesh = root;
        this.scene.add(root);
      },
      undefined,
      (err) => {
        console.error('Error loading player model:', err);
      }
    );
  }

  setPosition(x, z) {
    if (this.bounds) {
      x = THREE.MathUtils.clamp(x, this.bounds.minX, this.bounds.maxX);
    }
    this.position.set(x, 0, z);

    if (this.mesh) {
      this.mesh.position.x = x;
      this.mesh.position.z = z;
    }
  }

  getPosition() {
    return { x: this.position.x, z: this.position.z };
  }

  updateFromInput(input, dt) {
    if (!this.isLocal) return false;

    let moved = false;

    if (input.left) {
      this.position.x -= this.speed * dt;
      moved = true;
    }
    if (input.right) {
      this.position.x += this.speed * dt;
      moved = true;
    }

    if (this.bounds) {
      this.position.x = THREE.MathUtils.clamp(
        this.position.x,
        this.bounds.minX,
        this.bounds.maxX
      );
    }

    if (moved && this.mesh) {
      this.mesh.position.x = this.position.x;
      this.mesh.position.z = this.position.z;
    }

    return moved;
  }

  getAABB(outBox) {
    if (!this.mesh) return null;
    const b = outBox ?? this._box;
    return b.setFromObject(this.mesh);
  }
}