<!-- Project Structure + Game Story + Rules (gameplay, flow, physics) -->

# BlastIt! ⚽🔥

# Project Structure:
BlastIt/
├─ public/assets/          # models, textures, audio, HDRIs
├─ src/
│  ├─ entities/            # Goalkeeper.js, (optional for now) Player.js
│  ├─ systems/             # Audio.js, Scoring.js
│  ├─ main.js              # game setup + loop
│  ├─ constants.js         # asset paths & constants
├─ index.html
├─ styles.css

## 🏟️ Story
You’re on the pitch. The crowd is loud.  
It’s just you, the ball, and the keeper.  
Your goal: **score as many times as possible** before you run out of attempts.  
But beware - the keeper gets faster every 15 points!

---

## 🎯 Rules
- You start with **3 attempts**.  
- Each missed shot or save by the keeper costs you an attempt.  
- Score goals to increase your points.  
- Every **15 points** the goalkeeper speeds up.  
- Game ends after 3 misses.

---

## 🔄 Gameplay Flow
1. **Aim** using WASD or Arrow Keys.  
2. **Shoot** with Space.  
3. **Reset** with R.  
4. The **keeper defends**, and the crowd reacts.  

---

## ⚙️ Physics
- The ball moves with **realistic speed, drag, and bounce**.  
- The keeper **sways while idle** and dives when you shoot.  
- The stadium can be played in **Day 🌞 or Night 🌙 mode**.  
- Sounds adjust with the **volume slider**.  

---
