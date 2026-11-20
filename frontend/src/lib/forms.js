// @ts-check
/**
 * Form fields and checks used by every form: a labelled input with its own error line, the DepEd
 * email rule, the password rules, and the API's field errors shown beside each field.
 */
import { h, uid } from "./dom.js";
import { ApiError } from "@/api/client.js";
import { icon } from "@/components/icons.js";

/**
 * A labelled input. The returned element has input, value(), setError() and focus().
 * @param {{ label: string, name: string, type?: string, value?: string, autocomplete?: string, help?: string, required?: boolean, maxLength?: number, inputMode?: string }} props
 */
export function field({ label, name, type = "text", value = "", autocomplete, help, required = false, maxLength, inputMode }) {
  const id = uid(name);
  const error = h("p", { id: `${id}-error`, class: "field-error", hidden: true });
  const input = /** @type {HTMLInputElement} */ (h("input", { id, name, type, value, class: "input", autocomplete, required, maxLength, inputMode, "aria-describedby": `${id}-error` }));
  const wrapper = h("div", { class: "space-y-1" }, h("label", { class: "field-label", htmlFor: id }, label, required ? null : h("span", { class: "font-normal text-muted-foreground" }, " (optional)")), input, help ? h("p", { class: "field-help" }, help) : null, error);
  return Object.assign(wrapper, {
    input,
    value: () => input.value.trim(),
    /** @param {string | null} message */
    setError: (message) => {
      error.textContent = message ?? "";
      error.hidden = !message;
      input.setAttribute("aria-invalid", String(!!message));
    },
    focus: () => input.focus(),
  });
}

/**
 * Wraps a password input with an eye button inside it, on the right: press it to see what was
 * typed, press again to hide it. The button says "Show password" or "Hide password" to screen
 * readers, and is a full 44 px target.
 * @param {HTMLInputElement} input
 */
export function withEye(input) {
  input.classList.add("pr-12");
  const toggle = /** @type {HTMLButtonElement} */ (h("button", {
    type: "button",
    class: "absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground",
    "aria-controls": input.id,
    "aria-label": "Show password",
    "aria-pressed": "false",
  }));
  const draw = () => {
    const isShown = input.type === "text";
    toggle.replaceChildren(icon(isShown ? "eye" : "eye-off", "size-5"));
    toggle.setAttribute("aria-label", isShown ? "Hide password" : "Show password");
    toggle.setAttribute("aria-pressed", String(isShown));
  };
  toggle.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
    draw();
  });
  draw();
  const box = h("div", { class: "relative" });
  input.before(box);
  box.append(input, toggle);
  return box;
}

/**
 * A password field with the eye button to show or hide it.
 * @param {{ label: string, name: string, autocomplete: string, help?: string, placeholder?: string }} props
 */
export function passwordField({ label, name, autocomplete, help, placeholder }) {
  const base = field({ label, name, type: "password", autocomplete, help, required: true });
  if (placeholder) base.input.placeholder = placeholder;
  withEye(base.input);
  return base;
}

/**
 * Official DepEd emails only.
 * @param {string} email
 * @returns {string | null} the problem, or null
 */
export function depEdEmailError(email) {
  if (!email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
  if (!email.toLowerCase().endsWith("@deped.gov.ph")) return "Use your official DepEd email (@deped.gov.ph)";
  return null;
}

/**
 * An employee ID is optional; when given, only letters, numbers and dashes, up to 20 characters.
 * The server also checks that no one else has it.
 * @param {string} value
 * @returns {string | null}
 */
export function employeeIdError(value) {
  const id = (value ?? "").trim();
  if (!id) return null;
  if (id.length > 20) return "Use at most 20 characters";
  if (!/^[0-9A-Za-z-]+$/.test(id)) return "Use only letters, numbers and dashes";
  return null;
}

/**
 * The password rules: 8 to 64 characters, with lower and upper case, a number and a symbol.
 * @param {string} password
 * @returns {string | null}
 */
export function passwordError(password) {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 64) return "Password must be at most 64 characters";
  if (!/[a-z]/.test(password)) return "Include at least one lowercase letter";
  if (!/[A-Z]/.test(password)) return "Include at least one uppercase letter";
  if (!/[0-9]/.test(password)) return "Include at least one number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Include at least one special character";
  return null;
}

/**
 * A name people pick from a list (track, department, designation, task) must read like a name.
 * The same rule runs in the API (backend/app/Rules/ReadableName.php).
 * @param {string} typed
 * @param {string[]} [existing]  names already in the list
 * @returns {string | null} the problem, or null
 */
export function readableNameError(typed, existing = []) {
  const name = typed.trim();
  if (name.length < 2) return "Type at least 2 characters.";
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .,'&()/-]*$/u.test(name)) return "Use letters and numbers only, with spaces and . , ' - & ( ) /";
  if ((name.match(/\p{L}/gu) ?? []).length < 2) return "A name needs at least 2 letters.";
  if (/(.)\1{3,}/u.test(name)) return "The same character is typed 4 times in a row. Check the spelling.";
  if (!/[aeiouy]/i.test(name) && !/^[A-Z]{2,6}$/.test(name)) return "This does not look like a name (it has no vowel). Check the spelling, or type a short form in capitals, like SSG.";
  if (existing.some((other) => other.trim().toLowerCase() === name.toLowerCase())) return "This is already in the list.";
  return null;
}

/**
 * Puts the API's field errors under the right fields. Returns the message for the rest.
 * @param {unknown} error
 * @param {Record<string, { setError: (message: string | null) => void }>} fields
 * @returns {string}
 */
export function applyApiErrors(error, fields) {
  if (error instanceof ApiError && error.status === 422) {
    let rest = "";
    for (const [name, messages] of Object.entries(error.errors ?? {})) {
      if (fields[name]) fields[name].setError(messages[0]);
      else rest = rest || messages[0];
    }
    return rest || (Object.keys(error.errors ?? {}).some((name) => fields[name]) ? "" : error.message);
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
