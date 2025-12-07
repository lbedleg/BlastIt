import { GOAL, ASSETS } from '../constants.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';

export class Goalkeeper{
  constructor({ scene, gltfLoader = new GLTFLoader() }){
    this.scene = scene;
    this.saveBaseWidth = 0.45;
    this.timer = 0;
    this.mesh = null;

    this._speedScale = 1;

    gltfLoader.load(ASSETS.models.keeper, (g)=>{
      this.mesh = g.scene;
      this.mesh.position.set(0, 0.95, GOAL.z + 0.3);
      this.mesh.traverse(o=>{ if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; }});
      scene.add(this.mesh);
    });

    this._box = new THREE.Box3();
  }

  setSpeedScale(s) {
    this._speedScale = Math.max(0.25, s || 1);
  }
  bumpSpeedScale(f = 1.12) {
    this.setSpeedScale((this._speedScale || 1) * f);
  }
  getSpeedScale() {
    return this._speedScale || 1;
  }

  update(dt){
    this.timer += dt * this.getSpeedScale();
    if (this.mesh){
      this.mesh.position.x = Math.sin(this.timer * 1.2) * 0.8;
    }
  }

  getAABB(outBox){
    if (!this.mesh) return null;
    const b = outBox ?? this._box;
    return b.setFromObject(this.mesh);
  }
}