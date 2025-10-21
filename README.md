# BlastIt! ⚽🔥

**BlastIt!** is a lightweight 3D penalty shootout built with **Three.js**.  
Score as many goals as you can while the **goalkeeper gets faster every 15 points**.

---

## Features
- 🌞🌙 **Day/Night modes** (toggle in Settings)
- 🔊 **Volume slider** (master volume)
- ⚡ **Dynamic difficulty** (keeper speeds up at 15, 30, 45…)
- 🖥️ **Clean HUD** with Score, Attempts, and keycap hints
- ⚽ Simple, responsive gameplay

---

## Controls
- **WASD / Arrow Keys** → Aim  
- **Space** → Shoot  
- **R** → Reset  
- **Mouse** → Menus & Settings

---

# 🚀 Getting Started

You can run **BlastIt** locally using either a development server or a simple static server, depending on your setup.

---

## OPTIONS:

```bash
# Option A: Run with a Development Server (Recommended)

# 1) Install dependencies
npm install

# 2) Start the development server (Vite or similar)
npm run dev

# 3) Open in your browser
http://localhost:5173


# Option B: Run Without Node.js (Quick Static Server)

# 1) Navigate into the project directory
cd ./BlastIt-main

# 2) Start a lightweight static server
python3 -m http.server 8000

# 3) Open in your browser
http://localhost:8000
