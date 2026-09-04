/**
 * ---------------------------------------------------------------------------------------------------------------------
 * STORY ROW
 * ---------------------------------------------------------------------------------------------------------------------
 *
 * Replaces the pointer inside a story row with an arrow that follows the mouse and turns to face the direction the row
 * can scroll. Pointer position cannot be read in CSS, so this is the one part of the feature that needs JavaScript.
 *
 * The arrow is presentational: it never intercepts clicks, so product cards and buttons keep working normally. It hides
 * itself over links, when the row has nothing left to scroll in that direction, and on touch devices entirely.
 */

if (!customElements.get('story-row')) {
  class StoryRow extends HTMLElement {
    connectedCallback() {
      this.scroller = this.querySelector('.story-row__scroll');
      this.pointer = this.querySelector('.story-row__cursor');

      if (!this.scroller || !this.pointer) {
        return;
      }

      // Touch and coarse pointers have no cursor to replace, and the arrow would be stranded wherever it was last drawn
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        return;
      }

      this.handlePointerMove = this.handlePointerMove.bind(this);
      this.handlePointerLeave = this.handlePointerLeave.bind(this);
      this.handleClick = this.handleClick.bind(this);

      this.addEventListener('pointermove', this.handlePointerMove);
      this.addEventListener('pointerleave', this.handlePointerLeave);
      this.addEventListener('click', this.handleClick);
    }

    disconnectedCallback() {
      this.removeEventListener('pointermove', this.handlePointerMove);
      this.removeEventListener('pointerleave', this.handlePointerLeave);
      this.removeEventListener('click', this.handleClick);
    }

    /**
     * Clicking scrolls one card in the direction the arrow is facing. The arrow only shows where there is no link
     * under the pointer, so this can never swallow a click meant for a product card.
     */
    handleClick(event) {
      if (!this.classList.contains('story-row--pointing')) {
        return;
      }

      if (event.target instanceof Element && event.target.closest('a, button')) {
        return;
      }

      const card = this.scroller.querySelector('.story-card');
      const gap = parseFloat(getComputedStyle(this.scroller).columnGap) || 0;
      const step = card ? card.offsetWidth + gap : this.scroller.clientWidth * 0.8;
      const back = this.pointer.classList.contains('story-row__cursor--back');
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.scroller.scrollBy({
        left: back ? -step : step,
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
    }

    handlePointerMove(event) {
      const bounds = this.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const pointsForward = x > bounds.width / 2;

      const maxScroll = this.scroller.scrollWidth - this.scroller.clientWidth;
      const canScroll = pointsForward ? this.scroller.scrollLeft < maxScroll - 1 : this.scroller.scrollLeft > 1;
      const overInteractive = event.target instanceof Element && event.target.closest('a, button');

      this.pointer.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      this.pointer.classList.toggle('story-row__cursor--back', !pointsForward);
      this.classList.toggle('story-row--pointing', Boolean(canScroll) && !overInteractive);
    }

    handlePointerLeave() {
      this.classList.remove('story-row--pointing');
    }
  }

  customElements.define('story-row', StoryRow);
}
