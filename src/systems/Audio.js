import * as THREE from 'three';
import { ASSETS } from '../constants.js';

export class AudioSystem {
  constructor(camera){
    this.ctxUnlocked = false;
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    this.loader = new THREE.AudioLoader();
    this.sounds = {};

    // Preload sounds
    this._load('bgm',     ASSETS.audio.bgm,     { loop:true, volume:0.25 });
    this._load('goal',    ASSETS.audio.goal,    { volume:0.9 });
    this._load('miss',    ASSETS.audio.miss,    { volume:0.8 });
    this._load('whistle', ASSETS.audio.whistle, { volume:0.8 });

    // Unlock audio on first gesture (and start bgm if already loaded)
    const unlock = () => {
      if (!this.ctxUnlocked && this.listener.context.state === 'suspended') {
        this.listener.context.resume();
        this.ctxUnlocked = true;

        const bgm = this.sounds.bgm;
        if (bgm && !bgm.isPlaying) bgm.play();

        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  _load(name, url, opts={}){
    const a = new THREE.Audio(this.listener);
    this.loader.load(url, (buf)=>{
      a.setBuffer(buf);
      if (opts.loop) a.setLoop(true);
      if (opts.volume!=null) a.setVolume(opts.volume);
      a._baseVol = opts.volume ?? 1;
      if (name==='bgm' && this.ctxUnlocked && !a.isPlaying) a.play();
    });
    this.sounds[name] = a;
  }

  play(name){
    const a = this.sounds[name];
    if (!a) return;
    if (a.isPlaying) a.stop();
    a.play();
  }

  duck(vol=0.1, ms=800){
    const bgm = this.sounds.bgm; if (!bgm) return;
    const old = bgm.getVolume();
    bgm.setVolume(vol);
    setTimeout(()=> bgm.setVolume(old), ms);
  }

  setMasterVolume(v){
    this._master = Math.max(0, Math.min(1, v));
    for (const a of Object.values(this.sounds)) {
      if (!a) continue;
      const base = (a._baseVol != null) ? a._baseVol : a.getVolume();
      a._baseVol = base;
      a.setVolume(base * this._master);
    }
  }
}