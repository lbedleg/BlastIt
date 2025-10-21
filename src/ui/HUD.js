export function createHUD(maxShots){
  const hud = document.getElementById('hud');
  const scoreEl = document.getElementById('score');
  const shotEl = document.getElementById('shot');
  const msgEl = document.getElementById('msg');

  return {
    show(){ hud.classList.remove('hidden'); },
    hide(){ hud.classList.add('hidden'); },
    setScore(v){ scoreEl.textContent = String(v); },
    setShot(v){ shotEl.textContent = String(v); },
    message(text, ms=900){
      msgEl.textContent = text || '';
      if (text) { clearTimeout(this._t); this._t = setTimeout(()=> msgEl.textContent='', ms); }
    }
  };
}