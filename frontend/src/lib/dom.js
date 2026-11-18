// @ts-check
/**
 * Small helpers to build the screen with plain JavaScript, without a framework.
 * Every page and component is a function that returns DOM elements made with h().
 */

/**
 * @typedef {string | number | Node | null | undefined | false | Child[]} Child
 * @typedef {Record<string, any>} Props
 */

/**
 * Makes an element. Example: h("button", { class: "btn btn-primary", onclick: save }, "Save").
 * - Props that start with "on" become event listeners (onclick, oninput...).
 * - class, id, type, value, checked, disabled, hidden and aria-* / data-* are set as attributes or properties.
 * - null, undefined and false props or children are left out, so conditions read naturally.
 *
 * @param {string} tag
 * @param {Props | null} [props]
 * @param {...Child} children
 * @returns {HTMLElement}
 */
export function h(tag, props = null, ...children) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;

    if (key.startsWith("on") && typeof value === "function") {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "class") {
      element.className = String(value);
    } else if (key === "style" && typeof value === "object") {
      Object.assign(element.style, value);
    } else if (key === "ref" && typeof value === "function") {
      value(element);
    } else if (key in element && !key.includes("-") && key !== "list" && key !== "form") {
      // Properties such as value, checked, disabled, hidden, htmlFor.
      /** @type {any} */ (element)[key] = value;
    } else {
      element.setAttribute(key, value === true ? "" : String(value));
    }
  }

  append(element, children);
  return element;
}

/**
 * Adds children to an element, skipping empty ones.
 * @param {Element | DocumentFragment} parent
 * @param {Child[]} children
 */
export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/**
 * Replaces everything inside an element.
 * @param {Element} parent
 * @param {...Child} children
 */
export function replace(parent, ...children) {
  parent.replaceChildren();
  append(parent, children);
}

/**
 * A text-only element, safe for any text from the API (it is never read as HTML).
 * @param {string} tag
 * @param {string} className
 * @param {string | number | null | undefined} text
 */
export function text(tag, className, text) {
  return h(tag, { class: className }, text ?? "");
}

/**
 * A unique id for labels and fields, like "field-12".
 * @param {string} [prefix]
 */
let counter = 0;
export function uid(prefix = "field") {
  counter += 1;
  return `${prefix}-${counter}`;
}

