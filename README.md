# BlastIt! – 1v1 Multiplayer Penalty Game

BlastIt! is a fast-paced 1v1 online penalty shootout built with Three.js, Vite, Express, and Socket.io.
Aim, shoot, and move your blocker to obstruct your opponent. First to 50 points wins, or miss 3 shots in a row and you lose instantly.

## Features

- Real-time multiplayer (Socket.io)
- Player name and color selection (Red/Blue)
- Dynamic color-tinted 3D avatars
- Vision-blocking defender controlled with A/D
- Aim with Arrow Keys, shoot with Space
- Scoreboard showing names, colors, points, and wins
- Win/Lose animations and Ready system for rematches

## How to Run

1. Install dependencies:
   npm install

2. Start the game server from the project root:
   npm run start-server

3. Open two browser windows and go to:
   http://localhost:3000
   (Play 1v1 across the two tabs or machines.)

## Controls

- Aim: Arrow Keys
- Shoot: Space
- Move blocker: A / D
- Reset (debug): R

## Project Structure (Simplified)

src/
  main.js          — Game logic, rendering, networking
  entities/
    Player.js      — Player avatar, tinting, AABB collider
    Goalkeeper.js
  systems/
    Scoring.js
    Audio.js
public/assets/     — Models, textures, HDRI files
server/server.js   — Express + Socket.io backend

## Notes

- Only the opponent’s defender (opposite color) can block your shots.
- Both players must press Ready after a match to start the next one.
- Wins persist during the session.

Enjoy the game - score goals and outsmart your rival!
