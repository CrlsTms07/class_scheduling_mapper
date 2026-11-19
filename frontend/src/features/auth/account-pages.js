// @ts-check
/**
 * The account pages: Sign up (with the Terms and Conditions and the Data Privacy Notice, each with
 * its own box), Forgot password, Reset password, and the two steps a signed-in account may owe
 * first: accepting the Terms and the Notice, and choosing a new password after a temporary one.
 */
import { h, replace } from "@/lib/dom.js";
import { api, API_URL, errorMessage } from "@/api/client.js";
import { openDialog, setBusy } from "@/components/dialog.js";
import { icon } from "@/components/icons.js";
import { toast } from "@/components/toast.js";
import { applyApiErrors, depEdEmailError, field, passwordError, passwordField } from "@/lib/forms.js";
import { privacyNotice, TERMS } from "@/lib/legal.js";
import { session, setUser, signOut } from "@/state/session.js";
import { loadTerms } from "@/state/term.js";
import { getPublicSchool } from "@/api/guest.js";
import { load } from "@/state/cache.js";

/**
 * "Continue with Google": shown only when the school set it up. DepEd accounts only.
 */
export function googleButton() {
  const holder = h("div");
  load(["auth", "providers"], async () => /** @type {{ data: { google: boolean } }} */ (await api("/auth/providers")).data, { maxAgeMs: 600_000 })
    .then((providers) => {
      if (!providers.google) return;
      replace(
        holder,
        h(
          "div",
          { class: "space-y-4" },
          h("a", { href: `${API_URL}/auth/google/redirect`, rel: "external", class: "btn btn-outline min-h-12 w-full text-base" }, h("img", { src: "/google-g.svg", alt: "", class: "size-5" }), "Continue with Google"),
          h("div", { class: "flex items-center gap-3 text-sm text-muted-foreground" }, h("span", { class: "h-px flex-1 bg-border" }), "or use your email", h("span", { class: "h-px flex-1 bg-border" })),
        ),
      );
    })
    .catch(() => {});
  return holder;
}

/** Opens the Terms and Conditions to read (from the sign-in page). */
export function openTerms() {
  openDocument({ title: "Terms and Conditions", sections: TERMS });
}

/**
 * Opens the Terms or the Notice to read, with "I agree".
 * @param {{ title: string, sections: { title: string, points: string[] }[], onAgree?: () => void }} props
 */
function openDocument({ title, sections, onAgree }) {
  const { close } = openDialog({
    title,
    size: "lg",
    body: h("div", { class: "space-y-4 text-sm" }, sections.map((section) => h("section", { class: "space-y-1" }, h("h3", { class: "font-semibold text-accent" }, section.title), h("ul", { class: "list-disc space-y-1 pl-5" }, section.points.map((point) => h("li", null, point)))))),
    footer: [h("button", { type: "button", class: "btn btn-outline", onclick: () => close() }, "Close"), onAgree ? h("button", { type: "button", class: "btn btn-primary", onclick: () => { onAgree(); close(); } }, "I agree") : null],
  });
}

/**
 * The two boxes: Terms and Conditions, and the Data Privacy Notice, each with a link to read it.
 * @param {string | null} schoolEmail
 */
function agreementBoxes(schoolEmail) {
  const terms = /** @type {HTMLInputElement} */ (h("input", { type: "checkbox", id: "accept_terms", class: "mt-0.5 size-5 shrink-0 accent-[var(--brand)]" }));
  const privacy = /** @type {HTMLInputElement} */ (h("input", { type: "checkbox", id: "accept_privacy", class: "mt-0.5 size-5 shrink-0 accent-[var(--brand)]" }));
  const error = h("p", { class: "field-error", role: "alert", hidden: true });
  const box = (/** @type {HTMLInputElement} */ input, /** @type {string} */ text, /** @type {string} */ linkText, /** @type {() => void} */ open) =>
    h("div", { class: "flex items-start gap-3 rounded-lg border p-3" }, input, h("div", { class: "space-y-1 text-sm" }, h("label", { htmlFor: input.id }, text), h("button", { type: "button", class: "btn btn-quiet -ml-3 text-brand", onclick: open }, linkText)));
  const element = h(
    "div",
    { class: "space-y-2" },
    box(terms, "I have read and accept the Terms and Conditions.", "Read the Terms and Conditions", () => openDocument({ title: "Terms and Conditions", sections: TERMS, onAgree: () => (terms.checked = true) })),
    box(privacy, "I have read the Data Privacy Notice and agree to the processing of my personal information (Republic Act No. 10173).", "Read the Data Privacy Notice", () => openDocument({ title: "Data Privacy Notice", sections: privacyNotice(schoolEmail), onAgree: () => (privacy.checked = true) })),
    error,
  );
  return Object.assign(element, {
    /** @returns {boolean} true when both are checked; otherwise says which one is missing */
    check: () => {
      const missing = !terms.checked ? "Please read and accept the Terms and Conditions." : !privacy.checked ? "Please read and agree to the Data Privacy Notice." : "";
      error.textContent = missing;
      error.hidden = !missing;
      return !missing;
    },
  });
}

async function schoolEmail() {
  try {
    return (await getPublicSchool()).email;
  } catch {
    return null;
  }
}

/* ---------- Sign up ---------- */

/** @type {import("@/router.js").RenderPage} */
export async function renderSignUp(container) {
  const fields = {
    first_name: field({ label: "First name", name: "first_name", autocomplete: "given-name", required: true, maxLength: 60 }),
    middle_name: field({ label: "Middle name", name: "middle_name", autocomplete: "additional-name", maxLength: 60 }),
    last_name: field({ label: "Last name", name: "last_name", autocomplete: "family-name", required: true, maxLength: 60 }),
    suffix: field({ label: "Suffix", name: "suffix", maxLength: 10, help: "Like Jr. or III" }),
    email: field({ label: "Email", name: "email", type: "email", autocomplete: "email", required: true, help: "Your official DepEd email (@deped.gov.ph)" }),
    password: passwordField({ label: "Password", name: "password", autocomplete: "new-password", help: "8 or more characters, with upper and lower case, a number and a symbol." }),
    password_confirmation: passwordField({ label: "Confirm password", name: "password_confirmation", autocomplete: "new-password" }),
  };
  fields.email.input.placeholder = "juan.delacruz@deped.gov.ph";
  const agreements = agreementBoxes(await schoolEmail());
  const formError = h("p", { class: "field-error", role: "alert", hidden: true });
  const submit = /** @type {HTMLButtonElement} */ (h("button", { type: "submit", class: "btn btn-primary min-h-12 w-full text-base" }, "Sign up"));

  const form = h(
    "form",
    {
      class: "space-y-4",
      novalidate: true,
      onsubmit: async (/** @type {SubmitEvent} */ event) => {
        event.preventDefault();
        Object.values(fields).forEach((item) => item.setError(null));
        formError.hidden = true;
        const values = Object.fromEntries(Object.entries(fields).map(([name, item]) => [name, name.startsWith("password") ? item.input.value : item.value()]));
        const problems = {
          first_name: values.first_name ? null : "First name is required",
          last_name: values.last_name ? null : "Last name is required",
          email: depEdEmailError(values.email),
          password: passwordError(values.password),
          password_confirmation: values.password_confirmation === values.password ? null : "Passwords do not match",
        };
        Object.entries(problems).forEach(([name, message]) => message && fields[/** @type {keyof typeof fields} */ (name)].setError(message));
        const agreed = agreements.check();
        const first = Object.entries(problems).find(([, message]) => message);
        if (first || !agreed) {
          if (first) fields[/** @type {keyof typeof fields} */ (first[0])].focus();
          return;
        }
        setBusy(submit, true, "Signing up...");
        try {
          const { message } = /** @type {{ message: string }} */ (await api("/register", { method: "POST", body: { ...values, accept_terms: true, accept_privacy: true } }));
          toast.success(message);
          replace(container, h("div", { class: "space-y-4 text-center" }, h("h1", { class: "text-2xl font-bold text-brand" }, "Account created"), h("p", { role: "status", class: "text-sm" }, message), h("a", { href: "/login", class: "btn btn-primary w-full" }, "Back to Sign in")));
        } catch (error) {
          const rest = applyApiErrors(error, fields);
          formError.textContent = rest;
          formError.hidden = !rest;
          toast.error(error);
          setBusy(submit, false);
        }
      },
    },
    h("div", { class: "space-y-1 text-center" }, h("h1", { class: "text-2xl font-bold text-brand" }, "Sign up"), h("p", { class: "text-muted-foreground" }, "For ERCIHS personnel. The Admin activates new accounts.")),
    googleButton(),
    h("div", { class: "grid gap-4 sm:grid-cols-2" }, fields.first_name, fields.middle_name, fields.last_name, fields.suffix),
    fields.email,
    fields.password,
    fields.password_confirmation,
    agreements,
    formError,
    submit,
    h("p", { class: "flex items-center justify-center gap-2 text-sm text-muted-foreground" }, "Already have an account?", h("a", { href: "/login", class: "inline-flex min-h-11 items-center font-semibold text-foreground hover:text-brand" }, "Sign in")),
  );
  replace(container, form);
}

/* ---------- Forgot and reset password ---------- */

/** @type {import("@/router.js").RenderPage} */
export function renderForgot(container) {
  const email = field({ label: "Email", name: "email", type: "email", autocomplete: "email", required: true });
  email.input.placeholder = "juan.delacruz@deped.gov.ph";
  const submit = /** @type {HTMLButtonElement} */ (h("button", { type: "submit", class: "btn btn-primary w-full" }, "Send the reset link"));
  replace(
    container,
    h(
      "form",
      {
        class: "space-y-4",
        novalidate: true,
        onsubmit: async (/** @type {SubmitEvent} */ event) => {
          event.preventDefault();
          const problem = depEdEmailError(email.value());
          email.setError(problem);
          if (problem) return;
          setBusy(submit, true, "Sending...");
          try {
            const { message } = /** @type {{ message: string }} */ (await api("/forgot-password", { method: "POST", body: { email: email.value() } }));
            toast.success(message);
            replace(container, h("div", { class: "space-y-4 text-center" }, h("h1", { class: "text-2xl font-bold text-brand" }, "Check your email"), h("p", { role: "status", class: "text-sm" }, message), h("a", { href: "/login", class: "btn btn-outline w-full" }, "Back to Sign in")));
          } catch (error) {
            email.setError(applyApiErrors(error, { email }) || null);
            toast.error(error);
            setBusy(submit, false);
          }
        },
      },
      h("div", { class: "space-y-1 text-center" }, h("h1", { class: "text-2xl font-bold text-brand" }, "Forgot your password?"), h("p", { class: "text-sm text-muted-foreground" }, "We will send a reset link to your DepEd email.")),
      email,
      submit,
      h("a", { href: "/login", class: "btn btn-quiet w-full" }, icon("arrow-left"), "Back to Sign in"),
    ),
  );
}

/** @type {import("@/router.js").RenderPage} */
export function renderReset(container, { query }) {
  const token = query.get("token");
  const email = query.get("email");
  if (!token || !email) {
    replace(container, h("div", { class: "space-y-4 text-center" }, h("h1", { class: "text-2xl font-bold text-brand" }, "This link is not complete"), h("p", { class: "text-sm" }, "Open the link from the email again, or ask for a new one."), h("a", { href: "/forgot-password", class: "btn btn-primary w-full" }, "Ask for a new link")));
    return;
  }
  const fields = {
    password: passwordField({ label: "New password", name: "password", autocomplete: "new-password", help: "8 or more characters, with upper and lower case, a number and a symbol." }),
    password_confirmation: passwordField({ label: "Confirm new password", name: "password_confirmation", autocomplete: "new-password" }),
  };
  const submit = /** @type {HTMLButtonElement} */ (h("button", { type: "submit", class: "btn btn-primary w-full" }, "Save new password"));
  replace(
    container,
    h(
      "form",
      {
        class: "space-y-4",
        novalidate: true,
        onsubmit: async (/** @type {SubmitEvent} */ event) => {
          event.preventDefault();
          const password = fields.password.input.value;
          fields.password.setError(passwordError(password));
          fields.password_confirmation.setError(fields.password_confirmation.input.value === password ? null : "Passwords do not match");
          if (passwordError(password) || fields.password_confirmation.input.value !== password) return;
          setBusy(submit, true);
          try {
            const { message } = /** @type {{ message: string }} */ (await api("/reset-password", { method: "POST", body: { token, email, password, password_confirmation: password } }));
            toast.success(message);
            replace(container, h("div", { class: "space-y-4 text-center" }, h("h1", { class: "text-2xl font-bold text-brand" }, "Password changed"), h("p", { role: "status", class: "text-sm" }, message), h("a", { href: "/login", class: "btn btn-primary w-full" }, "Sign in")));
          } catch (error) {
            const rest = applyApiErrors(error, fields);
            if (rest) toast.error(rest);
            setBusy(submit, false);
          }
        },
      },
      h("div", { class: "space-y-1 text-center" }, h("h1", { class: "text-2xl font-bold text-brand" }, "Choose a new password"), h("p", { class: "text-sm text-muted-foreground" }, `For ${email}`)),
      fields.password,
      fields.password_confirmation,
      submit,
    ),
  );
}

/* ---------- Owed steps after signing in ---------- */

/** @type {import("@/router.js").RenderPage} */
export async function renderAcceptTerms(container, { navigate }) {
  const agreements = agreementBoxes(await schoolEmail());
  const submit = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-primary w-full" }, "Continue"));
  submit.addEventListener("click", async () => {
    if (!agreements.check()) return;
    setBusy(submit, true);
    try {
      const { data } = /** @type {{ data: any }} */ (await api("/me/accept-terms", { method: "POST", body: { accept_terms: true, accept_privacy: true } }));
      setUser(data);
      await loadTerms();
      toast.success("Thank you. You can use the system now.");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error);
      setBusy(submit, false);
    }
  });
  replace(
    container,
    h(
      "div",
      { class: "space-y-4" },
      h("div", { class: "space-y-1 text-center" }, h("h1", { class: "text-2xl font-bold text-brand" }, "Before you continue"), h("p", { class: "text-sm text-muted-foreground" }, `Hello, ${session.user?.first_name ?? ""}. Please read and agree to these first.`)),
      agreements,
      submit,
      h("button", { type: "button", class: "btn btn-quiet w-full", onclick: async () => { await signOut(); navigate("/login"); } }, icon("logout"), "Sign out"),
    ),
  );
}

/** @type {import("@/router.js").RenderPage} */
export function renderChangePassword(container, { navigate }) {
  const fields = {
    current_password: passwordField({ label: "Temporary password", name: "current_password", autocomplete: "current-password", help: "The password the Admin gave you." }),
    password: passwordField({ label: "New password", name: "password", autocomplete: "new-password", help: "8 or more characters, with upper and lower case, a number and a symbol." }),
    password_confirmation: passwordField({ label: "Confirm new password", name: "password_confirmation", autocomplete: "new-password" }),
  };
  const submit = /** @type {HTMLButtonElement} */ (h("button", { type: "submit", class: "btn btn-primary w-full" }, "Save new password"));
  replace(
    container,
    h(
      "form",
      {
        class: "space-y-4",
        novalidate: true,
        onsubmit: async (/** @type {SubmitEvent} */ event) => {
          event.preventDefault();
          const password = fields.password.input.value;
          fields.current_password.setError(fields.current_password.input.value ? null : "Type the temporary password");
          fields.password.setError(passwordError(password));
          fields.password_confirmation.setError(fields.password_confirmation.input.value === password ? null : "Passwords do not match");
          if (!fields.current_password.input.value || passwordError(password) || fields.password_confirmation.input.value !== password) return;
          setBusy(submit, true);
          try {
            const { data } = /** @type {{ data: any }} */ (await api("/me/password", { method: "PUT", body: { current_password: fields.current_password.input.value, password, password_confirmation: password } }));
            setUser(data);
            await loadTerms();
            toast.success("Your new password is saved.");
            navigate("/dashboard");
          } catch (error) {
            const rest = applyApiErrors(error, fields);
            toast.error(rest || errorMessage(error));
            setBusy(submit, false);
          }
        },
      },
      h("div", { class: "space-y-1 text-center" }, h("h1", { class: "text-2xl font-bold text-brand" }, "Choose your own password"), h("p", { class: "text-sm text-muted-foreground" }, "The Admin gave you a temporary password. Choose a new one to continue.")),
      fields.current_password,
      fields.password,
      fields.password_confirmation,
      submit,
    ),
  );
}
