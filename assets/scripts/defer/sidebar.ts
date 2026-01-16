import { updateBodyPadding } from '../lib/utils.ts';

(() => {
  const buttons = document.querySelectorAll('[data-toggle-sidebar]') as NodeListOf<HTMLButtonElement>;
  const closeButtons = document.querySelectorAll('[data-toggle-sidebar-close]') as NodeListOf<HTMLButtonElement>;
  const backdrops = document.querySelectorAll('.sidebar--backdrop') as NodeListOf<HTMLElement>;

  // avoid drawer flashing on page load
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
      buttons.forEach(toggle => {
        const sidebarID = toggle.dataset.toggleSidebar;
        const sidebarElement = sidebarID ? document.getElementById(sidebarID) : undefined;
        if (sidebarElement) {
          sidebarElement.removeAttribute('data-no-flash');
        }
      });
    }, 100);
  });

  const toggleSidebar = (sidebarID: string, shouldClose: boolean | undefined = undefined) => {
    const currentSideBarButtons = document.querySelectorAll(`[data-toggle-sidebar="${sidebarID}"]`) as NodeListOf<HTMLButtonElement>;
    const closeButton = document.querySelector(`[data-toggle-sidebar-close="${sidebarID}"]`);
    const backdrop = document.querySelector(`[data-controls="${sidebarID}"]`);

    let isExpanded = (shouldClose !== undefined) ? (shouldClose ? 'true' : 'false') : currentSideBarButtons[0].getAttribute('aria-expanded');
    const shouldExpand = isExpanded == 'false' ? true : false

    updateBodyPadding(shouldExpand);

    const sidebarElement = sidebarID ? document.getElementById(sidebarID) : undefined;
    if (sidebarElement) {
      sidebarElement.classList.toggle('open', shouldExpand);
    }

    currentSideBarButtons.forEach(toggle => toggle.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false'));
    closeButton?.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
    if (backdrop) {
      backdrop.classList.toggle('open', shouldExpand);
    }
    const event = new CustomEvent("sidebar_toggle", { detail: {shouldExpand: shouldExpand, id: sidebarID} });
    currentSideBarButtons[0].dispatchEvent(event);
  }

  [...buttons, ...closeButtons].forEach(toggle => {
    toggle.addEventListener('click', e => {
      // get the sidebar ID from the current element data attribute
      const sidebarID = toggle.dataset.toggleSidebar || toggle.dataset.toggleSidebarClose || "";

      toggleSidebar(sidebarID);
    });

    // toggle.addEventListener('sidebar_toggle', e => {
    //   if (e.detail.shouldExpand) {
    //     renderCart();
    //   }
    // });
  });
  backdrops.forEach(element => {
    element.addEventListener('click', () => {
      const sidebarID = element.dataset.controls || "";
      toggleSidebar(sidebarID, true);
    });
  });

  document.addEventListener('keyup', e => {
    if (e.code === 'Escape') {
      buttons.forEach(toggle => {
        const isExpanded = toggle.getAttribute('aria-expanded');
        if (isExpanded === 'true') {
          const sidebarID = toggle.dataset.toggleSidebar || "";
          toggleSidebar(sidebarID, true);
        }
      })
    }
  });
})();