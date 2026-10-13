// DOM overlays: title, HUD, game over, stage clear.
export class UI {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      sparks: document.getElementById('hud-sparks'),
      progress: document.getElementById('hud-progress'),
      title: document.getElementById('title'),
      gameover: document.getElementById('gameover'),
      gameoverTitle: document.getElementById('gameover-title'),
      gameoverStats: document.getElementById('gameover-stats'),
      clear: document.getElementById('clear'),
      clearStats: document.getElementById('clear-stats'),
      flash: document.getElementById('flash'),
      fade: document.getElementById('fade'),
      corner: document.getElementById('corner'),
    };
  }

  show(name, visible = true) {
    this.el[name].classList.toggle('visible', visible);
  }

  showTitle() {
    this.show('title', true);
    this.show('gameover', false);
    this.show('clear', false);
    this.show('hud', false);
  }
  showRun() {
    this.show('title', false);
    this.show('gameover', false);
    this.show('clear', false);
    this.show('hud', true);
  }
  showGameOver(kind, stats) {
    this.el.gameoverTitle.textContent = kind === 'fall' ? 'lost the walk' : 'a stumble';
    this.el.gameoverStats.textContent = stats;
    this.show('gameover', true);
  }
  showClear(stats) {
    this.el.clearStats.textContent = stats;
    this.show('hud', false);
    this.show('clear', true);
  }

  setSparks(n) {
    this.el.sparks.textContent = String(n);
  }
  setProgress(p) {
    this.el.progress.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
  }

  flash() {
    const f = this.el.flash;
    f.classList.remove('hit');
    void f.offsetWidth; // restart the animation
    f.classList.add('hit');
  }
  fadeIn(quick = false) {
    this.el.fade.classList.toggle('quick', quick);
    this.el.fade.classList.add('clear');
  }
  fadeOut(quick = true) {
    this.el.fade.classList.toggle('quick', quick);
    this.el.fade.classList.remove('clear');
  }
  setMuted(m) {
    this.el.corner.classList.toggle('muted', m);
  }
}
