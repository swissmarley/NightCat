// Keyboard / pointer input. One button: jump. Hold for a higher jump.
export class Input {
  constructor(target) {
    this.held = false; // jump button currently down
    this.pressed = false; // edge: went down since last consume
    this.anyPress = false; // edge: any start/restart press
    this.muteToggle = false;
    this.onFirstInteraction = null;
    this._interacted = false;

    const down = (e) => {
      if (e.repeat) return;
      if (['Space', 'ArrowUp', 'KeyW', 'Enter'].includes(e.code)) {
        e.preventDefault();
        this.press();
      }
      if (e.code === 'KeyM') this.muteToggle = true;
    };
    const up = (e) => {
      if (['Space', 'ArrowUp', 'KeyW', 'Enter'].includes(e.code)) this.release();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    target.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.press();
    });
    window.addEventListener('pointerup', () => this.release());
    window.addEventListener('pointercancel', () => this.release());
    window.addEventListener('blur', () => this.release());
  }

  press() {
    if (!this._interacted) {
      this._interacted = true;
      this.onFirstInteraction?.();
    }
    this.held = true;
    this.pressed = true;
    this.anyPress = true;
  }
  release() {
    this.held = false;
  }

  /** Returns true once per press. */
  consumePress() {
    const p = this.pressed;
    this.pressed = false;
    return p;
  }
  consumeAny() {
    const p = this.anyPress;
    this.anyPress = false;
    return p;
  }
  consumeMute() {
    const m = this.muteToggle;
    this.muteToggle = false;
    return m;
  }
}
