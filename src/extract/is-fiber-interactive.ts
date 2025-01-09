import type { Fiber } from '../types.js';

// https://www.w3.org/TR/wai-aria/#aria-disabled
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

function normalizeBooleanish(value: unknown): boolean {
  if (value == null) {
    return false;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return !!value;
}

function isFiberARIAOperable(fiber: Fiber): boolean {
  let result = true;
  // if current fiber
  if (typeof fiber.type === 'string') {
    result = !(
      fiber.memoizedProps.disabled ||
      normalizeBooleanish(fiber.memoizedProps['aria-disabled']) ||
      normalizeBooleanish(fiber.memoizedProps['aria-hidden'])
    );
  }
  if (fiber.return) {
    return result && isFiberARIAOperable(fiber.return);
  }
  return result;
}

export function isFiberInteractive(fiber: Fiber): boolean {
  switch (fiber.type) {
    case 'embed':
    case 'iframe':
    case 'label':
    case 'details':
      return isFiberARIAOperable(fiber);
    case 'button':
    case 'select':
    case 'textarea':
    case 'option':
      if (!fiber.memoizedProps.disabled && isFiberARIAOperable(fiber)) {
        // By default, return true for actual interactive fibers
        // ...that are not disabled
        return true;
      }
      break;
    case 'input':
      // Inputs are interactive except for disabled and hidden ones
      if (
        !(
          fiber.memoizedProps.type === 'hidden' && fiber.memoizedProps.disabled
        ) &&
        isFiberARIAOperable(fiber)
      ) {
        return true;
      }
      break;
    // An anchor fiber with an href is interactive
    case 'a':
      if (fiber.memoizedProps.href && isFiberARIAOperable(fiber)) {
        return true;
      }
      break;
    // Media fibers that has controls are interactive
    case 'video':
    case 'audio':
      if (fiber.memoizedProps.controls && isFiberARIAOperable(fiber)) {
        return true;
      }
      break;
    // Images with interactive maps
    case 'img':
      if (fiber.memoizedProps.useMap && isFiberARIAOperable(fiber)) {
        return true;
      }
      break;
  }

  // Now we check for A11Y 3:D
  const role = fiber.memoizedProps.role as string | undefined | null;
  if (!role) {
    return false;
  }
  if (ARIA_ROLES.has(role)) {
    // This is tedious, but for accuracy
    // we need to traverse up to the root to make sure that the fiber is indeed interactive
    return isFiberARIAOperable(fiber);
  }
  return false;
}
