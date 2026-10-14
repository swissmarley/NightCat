// DOM overlays: title, stage select, HUD, stage card, toasts, pause, game over, stage clear.
const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
};
export { fmtTime };

export class UI {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      hud: $('hud'),
      sparks: $('hud-sparks'),
      sparksTotal: $('hud-sparks-total'),
      time: $('hud-time'),
      progress: $('hud-progress'),
      ticks: $('hud-ticks'),
      stagecard: $('stagecard'),
      stagecardNum: $('stagecard-num'),
      stagecardName: $('stagecard-name'),
      stagecardPrompt: $('stagecard-prompt'),
      toast: $('toast'),
      toastText: $('toast-text'),
      title: $('title'),
      select: $('select'),
      cards: $('cards'),
      gameover: $('gameover'),
      gameoverTitle: $('gameover-title'),
      gameoverStats: $('gameover-stats'),
      gameoverPrompt: $('gameover-prompt'),
      clear: $('clear'),
      clearRank: $('clear-rank'),
      clearStats: $('clear-stats'),
      clearRecord: $('clear-record'),
      clearPrompt: $('clear-prompt'),
      pause: $('pause'),
      touch: $('touchzones'),
      flash: $('flash'),
      fade: $('fade'),
      corner: $('corner'),
      btnSound: $('btn-sound'),
      btnFull: $('btn-full'),
      btnGfx: $('btn-gfx'),
      debug: $('debug'),
    };
    this.screens = ['title', 'select', 'gameover', 'clear', 'pause'];
    this.onCard = null;
    this.toastTimer = null;
    this.touch = false;
  }

  setTouch(on) {
    this.touch = on;
    document.body.classList.toggle('touch', on);
  }

  showScreen(name) {
    for (const s of this.screens) this.el[s].classList.toggle('visible', s === name);
  }
  showHud(on) {
    this.el.hud.classList.toggle('visible', on);
  }
  showTouchZones(on) {
    this.el.touch.classList.toggle('visible', on && this.touch);
  }

  showTitle() {
    this.showScreen('title');
    this.showHud(false);
    this.hideStageCard();
    this.showTouchZones(false);
  }

  buildCards(stages, records) {
    const c = this.el.cards;
    c.innerHTML = '';
    stages.forEach((s, i) => {
      const r = records[s.id];
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.index = String(i);
      const rec = r?.cleared
        ? `best ${fmtTime(r.bestTime)} · ${r.bestSparks}/${r.sparksTotal} sparks · rank ${r.bestRank}`
        : 'not yet walked';
      card.innerHTML = `<div class="card-num">${s.numeral}</div><div class="card-name">${s.name}</div><div class="card-blurb">${s.blurb}</div><div class="card-record">${rec}</div>`;
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onCard?.(i);
      });
      c.appendChild(card);
    });
  }
  showSelect(index) {
    this.showScreen('select');
    this.showHud(false);
    this.hideStageCard();
    this.showTouchZones(false);
    this.setSelected(index);
  }
  setSelected(index) {
    const cards = this.el.cards.children;
    for (let i = 0; i < cards.length; i++) cards[i].classList.toggle('selected', i === index);
  }

  showStageCard(stage, prompt) {
    this.el.stagecardNum.textContent = `stage ${stage.numeral}`;
    this.el.stagecardName.textContent = stage.name;
    this.el.stagecardPrompt.innerHTML = prompt;
    this.el.stagecard.classList.add('visible');
  }
  hideStageCard() {
    this.el.stagecard.classList.remove('visible');
  }

  showReady(stage, prompt) {
    this.showScreen(null);
    this.showHud(true);
    this.showStageCard(stage, prompt);
    this.showTouchZones(true);
  }
  showRun() {
    this.showScreen(null);
    this.showHud(true);
    this.hideStageCard();
    this.showTouchZones(true);
  }
  showPause(on) {
    this.showScreen(on ? 'pause' : null);
  }
  showGameOver(kind, stats, canContinue) {
    this.el.gameoverTitle.textContent = kind === 'fall' ? 'lost the walk' : 'a stumble';
    this.el.gameoverStats.textContent = stats;
    this.el.gameoverPrompt.innerHTML = canContinue
      ? `${this.key('space')} continue from the lantern &nbsp;·&nbsp; ${this.key('r')} start over`
      : `${this.key('space')} try again`;
    this.showScreen('gameover');
  }
  showClear({ rank, time, sparks, total, deaths, hasNext, record }) {
    this.el.clearRank.textContent = rank;
    this.el.clearRank.dataset.rank = rank;
    this.el.clearStats.textContent = `${fmtTime(time)} · ${sparks} / ${total} sparks · ${deaths === 0 ? 'no stumbles' : deaths === 1 ? '1 stumble' : `${deaths} stumbles`}`;
    this.el.clearRecord.textContent = record ? 'new record' : '';
    this.el.clearPrompt.innerHTML = hasNext
      ? `${this.key('space')} next stage &nbsp;·&nbsp; ${this.key('esc')} stage select`
      : `${this.key('space')} walk again &nbsp;·&nbsp; ${this.key('esc')} stage select`;
    this.showHud(false);
    this.showTouchZones(false);
    this.showScreen('clear');
  }

  /** Key hint that reads naturally on touch devices too. */
  key(k) {
    if (this.touch) {
      if (k === 'space') return '<kbd>tap</kbd>';
      if (k === 'esc') return '<kbd>⟵</kbd>';
      if (k === 'r') return '<kbd>hold</kbd>';
    }
    return `<kbd>${k}</kbd>`;
  }

  toast(text, ms = 1600) {
    this.el.toastText.textContent = text;
    this.el.toast.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('visible'), ms);
  }

  setSparks(n, total) {
    this.el.sparks.textContent = String(n);
    if (total !== undefined) this.el.sparksTotal.textContent = `/ ${total}`;
  }
  setTime(sec) {
    this.el.time.textContent = fmtTime(sec);
  }
  setProgress(p) {
    this.el.progress.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
  }
  setTicks(fracs) {
    this.el.ticks.innerHTML = fracs.map((f) => `<span class="tick" style="left:${(f * 100).toFixed(1)}%"></span>`).join('');
  }

  flash() {
    const f = this.el.flash;
    f.classList.remove('hit');
    void f.offsetWidth;
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
    this.el.btnSound.textContent = m ? 'sound off' : 'sound on';
  }
  setGfx(safe) {
    this.el.btnGfx.textContent = safe ? 'graphics: simple' : 'graphics: rich';
  }
  showDebug(on) {
    this.el.debug.style.display = on ? 'block' : 'none';
  }
  setDebug(text) {
    this.el.debug.textContent = text;
  }
}
