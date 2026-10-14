// Keyboard / pointer input. Two verbs: jump and slide. Menus use the same keys.
const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'];
const SLIDE_KEYS = ['ArrowDown', 'KeyS', 'ShiftLeft', 'ShiftRight'];

export class Input {
  constructor(target) {
    this.jumpHeld = false;
    this.slideHeld = false;
    this._edges = {
      jump: false,
      slide: false,
      any: false,
      confirm: false,
      back: false,
      pause: false,
      restart: false,
      mute: false,
      left: false,
      right: false,
    };
    this.touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.onFirstInteraction = null;
    this._interacted = false;
    this._pointerSlide = new Set();

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (JUMP_KEYS.includes(e.code)) {
        e.preventDefault();
        this.jump();
      } else if (SLIDE_KEYS.includes(e.code)) {
        e.preventDefault();
        this.slide();
      } else if (e.code === 'Enter') {
        this._interact();
        this._edges.confirm = true;
        this._edges.any = true;
      } else if (e.code === 'Escape') {
        this._edges.back = true;
      } else if (e.code === 'KeyP') {
        this._edges.pause = true;
      } else if (e.code === 'KeyR') {
        this._edges.restart = true;
      } else if (e.code === 'KeyM') {
        this._edges.mute = true;
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        this._edges.left = true;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        this._edges.right = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (JUMP_KEYS.includes(e.code)) this.jumpHeld = false;
      if (SLIDE_KEYS.includes(e.code)) this.slideHeld = false;
    });

    target.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // touch: left third slides, the rest jumps; mouse: left button jumps, right button slides
      const slideZone =
        (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.34) || (e.pointerType !== 'touch' && e.button === 2);
      if (slideZone) {
        this._pointerSlide.add(e.pointerId);
        this.slide();
      } else {
        this.jump();
      }
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    const up = (e) => {
      if (e && this._pointerSlide.has(e.pointerId) && (e.pointerType === 'touch' || e.button === 2 || e.type === 'pointercancel')) {
        this._pointerSlide.delete(e.pointerId);
        this.slideHeld = this._pointerSlide.size > 0;
      } else {
        this.jumpHeld = false;
      }
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', () => {
      this.jumpHeld = false;
      this.slideHeld = false;
      this._pointerSlide.clear();
      this._edges.pause = true;
    });
  }

  _interact() {
    if (!this._interacted) {
      this._interacted = true;
      this.onFirstInteraction?.();
    }
  }
  jump() {
    this._interact();
    this.jumpHeld = true;
    this._edges.jump = true;
    this._edges.any = true;
    this._edges.confirm = true;
  }
  slide() {
    this._interact();
    this.slideHeld = true;
    this._edges.slide = true;
    this._edges.any = true;
  }

  /** Returns true once per press of the named edge. */
  consume(name) {
    const v = this._edges[name];
    this._edges[name] = false;
    return v;
  }
  /** Drop all pending one-shot presses (used on state changes). */
  clearEdges() {
    for (const k in this._edges) this._edges[k] = false;
  }
}
