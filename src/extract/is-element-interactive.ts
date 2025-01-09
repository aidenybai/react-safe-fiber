const ARIA_ROLES = new Set([
  'application',
  'button',
  'composite',
  'gridcell',
  'group',
  'input',
  'link',
  'menuitem',
  'scrollbar',
  'separator',
  'tabcheckbox',
  'columnheader',
  'combobox',
  'grid',
  'listbox',
  'menu',
  'menubar',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'radiogroup',
  'row',
  'rowheader',
  'searchbox',
  'select',
  'slider',
  'spinbutton',
  'switch',
  'tablist',
  'textbox',
  'toolbar',
  'tree',
  'treegrid',
  'treeitem',
]);

function isElementARIAOperable(element: HTMLElement): boolean {
  return (
    !(
      element.hasAttribute('disabled') ||
      element.getAttribute('aria-disabled') === 'true' ||
      element.getAttribute('aria-hidden') === 'true'
    ) && (element.parentElement ? isElementARIAOperable(element) : true)
  );
}

function isElementARIAInteractive(element: HTMLElement): boolean {
  // Now we check for A11Y 3:D
  const role = element.role;
  if (!role) {
    return false;
  }
  if (ARIA_ROLES.has(role)) {
    // This is tedious, but for accuracy
    // we need to traverse up to the root to make sure that the element is indeed interactive
    return isElementARIAOperable(element);
  }
  return false;
}

export function isElementInteractive(element: HTMLElement): boolean {
  switch (element.nodeName) {
    case 'EMBED':
    case 'IFRAME':
    case 'LABEL':
    case 'DETAILS':
      return isElementARIAOperable(element);
    case 'BUTTON':
    case 'SELECT':
    case 'TEXTAREA':
    case 'OPTION':
      if (!element.hasAttribute('disabled') && isElementARIAOperable(element)) {
        // By default, return true for actual interactive elements
        // ...that are not disabled
        return true;
      }
      break;
    case 'INPUT':
      // Inputs are interactive except for disabled and hidden ones
      if (
        !(
          (element as HTMLInputElement).type === 'hidden' &&
          element.hasAttribute('disabled')
        ) &&
        isElementARIAOperable(element)
      ) {
        return true;
      }
      break;
    // An anchor element with an href is interactive
    case 'A':
      if (element.hasAttribute('href') && isElementARIAOperable(element)) {
        return true;
      }
      break;
    // Media elements that has controls are interactive
    case 'VIDEO':
    case 'AUDIO':
      if (element.hasAttribute('controls') && isElementARIAOperable(element)) {
        return true;
      }
      break;
    // Images with interactive maps
    case 'IMG':
      if (element.hasAttribute('usemap') && isElementARIAOperable(element)) {
        return true;
      }
      break;
  }

  return isElementARIAInteractive(element);
}
