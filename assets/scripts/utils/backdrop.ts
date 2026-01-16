// A self-initializing class to manage the site-wide backdrop.
class BackdropManager {
  private backdropElement: HTMLElement | null;
  private openCount: number;

  constructor() {
    this.backdropElement = document.getElementById('site-backdrop');
    this.openCount = 0;

    if (!this.backdropElement) {
      console.error('Backdrop element #site-backdrop not found. Backdrop will not function.');
      return;
    }

    this.backdropElement.addEventListener('click', this.handleClick.bind(this));
  }

  private handleClick() {
    // Dispatch a global event that active components can listen for.
    document.dispatchEvent(new CustomEvent('backdrop-click'));
  }

  public show() {
    if (this.openCount === 0) {
      this.backdropElement?.classList.add('open');
    }
    this.openCount++;
  }

  public hide() {
    this.openCount--;
    if (this.openCount === 0) {
      this.backdropElement?.classList.remove('open');
    }
    // Prevent the count from going negative if hide() is called extra times.
    if (this.openCount < 0) {
      this.openCount = 0;
    }
  }

  public forceHide() {
    this.openCount = 0;
    this.backdropElement?.classList.remove('open');
  }
}

// Export a single instance for the entire application to use.
const backdropManager = new BackdropManager();
export default backdropManager;
