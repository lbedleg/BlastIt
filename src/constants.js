// constants.js
export const FIELD_SIZE = { w: 40, h: 24 };
export const GOAL = { width: 8.2, height: 2.44, depth: 2.0, z: -11 };
// set to null -> game ends after 3 misses
export const SHOTS_MAX = null;
export const PHYSICS = { gravity: -9.81, restitution: 0.45, friction: 0.35, linDamp: 0.02, angDamp: 0.01 };

export const ASSETS = {
  hdr: './public/assets/hdris/stadium.hdr',
  textures: {
    grass: './public/assets/textures/grass.jpg',
    ball:  './public/assets/textures/ball.png',
  },
  models: {
    stadium: './public/assets/models/stadium.glb',
    goal: './public/assets/models/goal.glb',
    keeper: './public/assets/models/goalkeeper.glb',
    player: './public/assets/models/player.glb',
  },
  audio: {
    bgm: './public/assets/audio/bgm.mp3',
    goal: './public/assets/audio/goal.mp3',
    miss: './public/assets/audio/miss.mp3',
    whistle: './public/assets/audio/whistle.mp3',
  }
};
