/**
 * SEARCH TAKEOVER
 * --------------------------------------------------------------------------
 * Custom element that drives the search overlay. Replaces Prestige's
 * <predictive-search> component, which fetches from /search/suggest (the
 * predictive API) — that endpoint does NOT return search.filters, which
 * is why the overlay has no filter pills.
 *
 * This element fetches from /search?section_id=predictive-search so the
 * `search` drop is populated with matching products AND search.filters
 * from the Search & Discovery app.
 *
 * The "Kategorier" sidebar is rendered server-side in predictive-search.liquid
 * by iterating the global `collections` object and matching titles against
 * search.terms. This sidesteps Shopify's limitation that the full /search
 * endpoint doesn't support collections as a resource type (collections only
 * appear in predictive_search.resources, which doesn't return filters — so
 * we can't use that endpoint either).
 *
 * Idle-state handling:
 *   The server renders the idle state (Top produkter) directly into the
 *   slot on page load. We cache that initial HTML on connection, replace
 *   it with AJAX results when the user types, and restore it when the
 *   user clears the input.
 *
 * The theme's existing facet:update global listener (in theme.js) handles
 * filter clicks automatically — when a facet is toggled, it refetches
 * /search?…&section_id=predictive-search and swaps the shopify-section
 * in place.
 */

/**
 * Portal <header-search.header-search--takeover> to document.body.
 *
 * The element is originally rendered inside Prestige's <x-header>, which
 * applies `transform` for hide-on-scroll. Any non-none transform on an
 * ancestor creates a new containing block and breaks `position: fixed` —
 * which is why the overlay anchors to the header rather than the viewport
 * after scrolling. Moving it to document.body once on load avoids this.
 */
function portalTakeoverToBody() {
  document.querySelectorAll('header-search.header-search--takeover').forEach((el) => {
    if (el.parentElement !== document.body) {
      document.body.appendChild(el);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', portalTakeoverToBody);
} else {
  portalTakeoverToBody();
}

/**
 * Auto-close filter dropdowns when a checkbox is toggled.
 *
 * The theme's <form is="facets-form" update-on-change> handles refetching
 * the section, but the dropdown stays visually open during the refetch.
 * This listener closes the parent <details> immediately on change.
 *
 * Delegated at document level so it survives section swaps without re-binding.
 */
document.addEventListener('change', (event) => {
  const input = event.target;
  if (!input.matches('.predictive-search__filter-values input[type="checkbox"]')) return;

  // Close the parent accordion dropdown (desktop)
  const details = input.closest('details');
  if (details) {
    if (typeof details.toggle === 'function') {
      details.toggle(false);
    } else {
      details.removeAttribute('open');
    }
  }

  // Close the mobile filter sheet too — user has chosen a filter, no need
  // to keep the fullscreen panel open. The theme's facet:update pipeline
  // will refetch and the user sees results immediately.
  const headerSearch = input.closest('header-search');
  if (headerSearch && headerSearch.dataset.mobileFilterOpen === 'true') {
    delete headerSearch.dataset.mobileFilterOpen;
    const trigger = headerSearch.querySelector('[data-mobile-filter-trigger]');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }
});

/**
 * Active-facet chip removal (single chip and "Ryd alle filtre").
 *
 * The chips render inside <form is="facets-form" update-on-change>, so when
 * we modify form inputs and dispatch a 'change' event, the theme's pipeline
 * AJAX-refetches the section automatically — no full-page nav.
 *
 * For an individual chip: uncheck the matching checkbox (or clear the
 * matching number/range input for price), then dispatch change.
 *
 * For "Ryd alle filtre": clear ALL filter inputs in the form, then dispatch
 * change once on the form (theme listens at form level too).
 */
document.addEventListener('click', (event) => {
  // SINGLE CHIP REMOVAL
  const removeBtn = event.target.closest('[data-remove-facet]');
  if (removeBtn) {
    event.preventDefault();
    const form = removeBtn.closest('form');
    if (!form) return;

    const filterName = removeBtn.dataset.filterName;
    const filterName2 = removeBtn.dataset.filterName2; // for price (gte + lte)
    const filterValue = removeBtn.dataset.filterValue;

    // Uncheck the matching checkbox (or clear price input)
    let changedInput = null;
    if (filterValue !== undefined) {
      // Checkbox-style filter — find by name + value
      const input = form.querySelector(`input[name="${CSS.escape(filterName)}"][value="${CSS.escape(filterValue)}"]`);
      if (input) {
        input.checked = false;
        changedInput = input;
      }
    } else {
      // Price range — clear both gte and lte inputs
      [filterName, filterName2].filter(Boolean).forEach((name) => {
        const input = form.querySelector(`input[name="${CSS.escape(name)}"]`);
        if (input) {
          input.value = '';
          changedInput = input;
        }
      });
    }

    // Dispatch change so theme's update-on-change pipeline fires
    if (changedInput) {
      changedInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return;
  }

  // CLEAR-ALL
  const clearAllBtn = event.target.closest('[data-clear-all-facets]');
  if (clearAllBtn) {
    event.preventDefault();
    const form = clearAllBtn.closest('form');
    if (!form) return;

    // Uncheck all filter checkboxes and clear all filter number/range inputs
    form.querySelectorAll('input[type="checkbox"][name^="filter."]').forEach((cb) => {
      cb.checked = false;
    });
    form.querySelectorAll('input[name^="filter."]:not([type="checkbox"])').forEach((inp) => {
      inp.value = '';
    });

    // Dispatch change at form level once — theme's facets-form listens here
    form.dispatchEvent(new Event('change', { bubbles: true }));

    // Also close the mobile filter sheet — user cleared everything, no point
    // keeping the sheet open. On desktop this is a no-op (the data attribute
    // is mobile-only).
    const headerSearch = clearAllBtn.closest('header-search');
    if (headerSearch && headerSearch.dataset.mobileFilterOpen === 'true') {
      delete headerSearch.dataset.mobileFilterOpen;
      const trigger = headerSearch.querySelector('[data-mobile-filter-trigger]');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }
    return;
  }

  // MOBILE FILTER SHEET — dedicated close button (X in top-right of sheet)
  const filterCloseBtn = event.target.closest('[data-mobile-filter-close]');
  if (filterCloseBtn) {
    event.preventDefault();
    const headerSearch = filterCloseBtn.closest('header-search');
    if (!headerSearch) return;
    delete headerSearch.dataset.mobileFilterOpen;
    const trigger = headerSearch.querySelector('[data-mobile-filter-trigger]');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    return;
  }

  // MOBILE FILTER SHEET — toggle open/close
  const filterTrigger = event.target.closest('[data-mobile-filter-trigger]');
  if (filterTrigger) {
    event.preventDefault();
    const headerSearch = filterTrigger.closest('header-search');
    if (!headerSearch) return;
    const isOpen = headerSearch.dataset.mobileFilterOpen === 'true';
    if (isOpen) {
      delete headerSearch.dataset.mobileFilterOpen;
      filterTrigger.setAttribute('aria-expanded', 'false');
    } else {
      headerSearch.dataset.mobileFilterOpen = 'true';
      filterTrigger.setAttribute('aria-expanded', 'true');

      // Scroll the toolbar into view at the top of its scroll container.
      // This compensates for cases where the toolbar is rendered with
      // position: fixed but the containing block is an ancestor with
      // transform/filter (which makes "fixed" behave like "absolute").
      // scrollIntoView lets the browser find the correct scroll container
      // regardless of shadow DOM or other quirks.
      requestAnimationFrame(() => {
        const toolbar = headerSearch.querySelector('.predictive-search__toolbar');
        if (toolbar && typeof toolbar.scrollIntoView === 'function') {
          toolbar.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      });
    }
    return;
  }

  // MOBILE TABS — switch between Produkter and Kategorier
  const tabBtn = event.target.closest('[data-tab]');
  if (tabBtn) {
    event.preventDefault();
    const tabsNav = tabBtn.closest('[data-mobile-tabs]');
    const layout = tabsNav?.parentElement?.querySelector('.predictive-search__layout');
    if (!tabsNav || !layout) return;

    const targetTab = tabBtn.dataset.tab;
    layout.setAttribute('data-active-tab', targetTab);

    // Update active state on tab buttons
    tabsNav.querySelectorAll('[data-tab]').forEach((btn) => {
      const isActive = btn.dataset.tab === targetTab;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }
});

class SearchTakeover extends HTMLElement {
  #abortController;
  #fetchAbortController;
  #searchForm;
  #queryInput;
  #initialSlotHTML = '';

  /**
   * Delay in ms before firing the search after the last keystroke.
   */
  get autoCompleteDelay() {
    return 280;
  }

  connectedCallback() {
    this.#abortController = new AbortController();
    this.#searchForm = document.querySelector(`[aria-owns="${this.id}"]`);
    if (!this.#searchForm) return;

    this.#queryInput = this.#searchForm.elements['q'];
    if (!this.#queryInput) return;

    // Cache the initial slot HTML so we can restore it on clear. This is
    // the server-rendered idle state (Top produkter) — see header-search.liquid.
    //
    // Custom elements can be upgraded before children are fully parsed, so
    // we defer the cache to the next microtask if the slot is currently empty.
    const cacheSlot = () => {
      const slot = this.querySelector('[slot="results"]');
      if (slot && slot.innerHTML.trim() !== '') {
        this.#initialSlotHTML = slot.innerHTML;
      }
    };
    cacheSlot();
    if (!this.#initialSlotHTML) {
      // Try again after the next tick in case the slot wasn't filled yet
      Promise.resolve().then(cacheSlot);
    }

    this.#searchForm.addEventListener('reset', () => this.#onSearchCleared(), {
      signal: this.#abortController.signal,
    });

    const debouncedInput = this.#debounce(
      () => this.#onInputChanged(),
      this.autoCompleteDelay
    );
    this.#queryInput.addEventListener('input', debouncedInput, {
      signal: this.#abortController.signal,
    });
  }

  disconnectedCallback() {
    this.#abortController?.abort();
  }

  #onInputChanged() {
    // Reflect whether there's a query as a data attribute on <header-search>
    // — CSS uses this to show/hide the mobile filter trigger.
    const hasQuery = this.#queryInput.value !== '';
    const headerSearch = this.closest('header-search');
    if (headerSearch) {
      if (hasQuery) {
        headerSearch.dataset.hasQuery = 'true';
      } else {
        delete headerSearch.dataset.hasQuery;
      }
    }

    if (!hasQuery) {
      return this.#onSearchCleared();
    }
    this.#fetchAbortController?.abort();
    this.#fetchAbortController = new AbortController();
    this.#doSearch().catch((err) => {
      if (err.name !== 'AbortError') throw err;
    });
  }

  async #doSearch() {
    document.documentElement.dispatchEvent(
      new CustomEvent('theme:loading:start', { bubbles: true })
    );

    const url =
      `${window.Shopify.routes.root}search` +
      `?q=${encodeURIComponent(this.#queryInput.value)}` +
      `&section_id=predictive-search`;

    try {
      const response = await fetch(url, {
        signal: this.#fetchAbortController.signal,
      });
      const html = await response.text();
      const tempDoc = new DOMParser().parseFromString(html, 'text/html');
      const section = tempDoc.querySelector('.shopify-section');
      const slot = this.querySelector('[slot="results"]');

      if (section && slot) {
        // Preserve the .shopify-section wrapper with its ID intact so the
        // theme's facet:update listener can find and replace it when a
        // filter is toggled.
        slot.replaceChildren(document.importNode(section, true));
      }
    } finally {
      document.documentElement.dispatchEvent(
        new CustomEvent('theme:loading:end', { bubbles: true })
      );
    }
  }

  #onSearchCleared() {
    this.#fetchAbortController?.abort();
    this.#queryInput?.focus();
    const slot = this.querySelector('[slot="results"]');
    if (!slot) return;

    if (this.#initialSlotHTML) {
      // Restore the cached idle state.
      slot.innerHTML = this.#initialSlotHTML;
      return;
    }

    // Cache was empty (custom element timing edge case). Re-fetch the page
    // to get a fresh server-rendered idle state. We fetch the cart route's
    // header-search section since that's where the idle state lives, but
    // any page that includes the header works.
    this.#fetchIdleStateFromServer().then((html) => {
      if (html) {
        slot.innerHTML = html;
        // Also cache for next time
        this.#initialSlotHTML = html;
      }
    });
  }

  /**
   * Fetch the idle-state HTML from the server as a fallback when the
   * custom-element cache is empty. We hit the homepage with section_id
   * to render just the header-search section, then extract the slot content.
   */
  async #fetchIdleStateFromServer() {
    try {
      const res = await fetch(`${window.Shopify.routes.root}?sections=header-search`);
      const data = await res.json();
      const sectionHtml = data['header-search'];
      if (!sectionHtml) return '';
      const tempDoc = new DOMParser().parseFromString(sectionHtml, 'text/html');
      const slot = tempDoc.querySelector('[slot="results"]');
      return slot ? slot.innerHTML : '';
    } catch (err) {
      console.warn('[search-takeover] Could not fetch idle state', err);
      return '';
    }
  }

  #debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }
}

if (!customElements.get('search-takeover')) {
  customElements.define('search-takeover', SearchTakeover);
}
