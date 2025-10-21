// Scoring.js
import { SHOTS_MAX } from '../constants.js';

export class Scoring {
  constructor(hud){
    this.hud = hud;
    this.reset();
  }
  reset(){
    this.score = 0;
    this.attempts = 0;
    this.missStreak = 0;
    this.hud.setScore(0);
    this.hud.setShot(0);
  }
  onShot(result){
    // result: 'goal' | 'save' | 'miss'
    this.attempts++;

    if (result === 'goal') {        // +3
      this.score += 3;
      this.missStreak = 0;
    } else if (result === 'miss') { // out of frame: -2
      this.score -= 2;
      this.missStreak++;
    } else {                        // 'save': -1
      this.score -= 1;
      this.missStreak++;
    }

    this.hud.setScore(this.score);
    this.hud.setShot(this.attempts);

    const capped = Number.isFinite(SHOTS_MAX) && SHOTS_MAX !== null
      ? this.attempts >= SHOTS_MAX
      : false;

    const threeMisses = this.missStreak >= 3;
    const isGameOver = capped || threeMisses;

    return { isGameOver, threeMisses };
  }
}