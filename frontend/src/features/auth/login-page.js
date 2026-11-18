// @ts-check
/**
 * Sign in: the DepEd email and password, then (when the school turned it on) the 6-digit code
 * sent to that email, with "Remember this device for 30 days".
 */
import { h, replace, uid } from "@/lib/dom.js";
import { api, errorMessage } from "@/api/client.js";
import { icon } from "@/components/icons.js";
import { setBusy } from "@/components/dialog.js";
import { toast } from "@/components/toast.js";
import { setUser } from "@/state/session.js";
import { loadTerms } from "@/state/term.js";
import { withEye } from "@/lib/forms.js";
import { googleButton, openTerms } from "./account-pages.js";

/**
 * What the server's ?google= answer means after "Continue with Google" (GoogleAuthController,
 * AccountService::fromGoogle). A new Google account starts pending until the Admin activates it.
 */
export const GOOGLE_MESSAGES = {
  pending: { text: "Your account was created with Google. You can sign in once the Admin activates it.", isError: false },
  inactive: { text: "Your account is not active. Please contact the Admin.", isError: true },
  not_deped: { text: "Use your official DepEd Google account (@deped.gov.ph).", isError: true },
  not_verified: { text: "Google has not verified this email yet. Use your official DepEd account.", isError: true },
  cancelled: { text: "Signing in with Google was cancelled.", isError: true },
  failed: { text: "Signing in with Google did not work. Please try again, or use your email and password.", isError: true },
  unavailable: { text: "Signing in with Google is not set up yet. Use your email and password.", isError: true },
};

/** @type {import("@/router.js").RenderPage} */
export function render(container, { navigate, query }) {
  // Back from Google without signing in: say why once, then clean the address so a refresh does not repeat it.
  const googleResult = GOOGLE_MESSAGES[/** @type {keyof typeof GOOGLE_MESSAGES} */ (query.get("google") ?? "")] ?? null;
  if (query.has("google")) history.replaceState(history.state, "", location.pathname);

  const finish = async (/** @type {{ data: import("@/state/session.js").User }} */ result) => {
    setUser(result.data);
    await loadTerms();
    toast.success(`Welcome, ${result.data.first_name}.`);
    navigate("/dashboard");
  };

  const passwordStep = () => {
    const emailId = uid("email");
    const passwordId = uid("password");
    const error = h("p", { class: "field-error", role: "alert", hidden: true });
    const email = /** @type {HTMLInputElement} */ (h("input", { id: emailId, type: "email", class: "input min-h-12", autocomplete: "username", required: true, placeholder: "juan.delacruz@deped.gov.ph" }));
    const password = /** @type {HTMLInputElement} */ (h("input", { id: passwordId, type: "password", class: "input min-h-12", autocomplete: "current-password", required: true, placeholder: "Your password" }));
    const submit = /** @type {HTMLButtonElement} */ (h("button", { type: "submit", class: "btn btn-primary min-h-12 w-full text-base" }, "Sign in"));
    const passwordBox = h("div", null, password);
    withEye(password);

    const form = h(
      "form",
      {
        class: "space-y-4",
        novalidate: true,
        onsubmit: async (/** @type {SubmitEvent} */ event) => {
          event.preventDefault();
          error.hidden = true;
          if (!/@deped\.gov\.ph$/i.test(email.value.trim())) {
            error.textContent = "Use your DepEd email (name@deped.gov.ph).";
            error.hidden = false;
            email.focus();
            return;
          }
          setBusy(submit, true, "Signing in...");
          try {
            const result = /** @type {any} */ (await api("/login", { method: "POST", body: { email: email.value.trim(), password: password.value } }));
            if (result.code_required) replace(container, codeStep(result));
            else await finish(result);
          } catch (caught) {
            error.textContent = errorMessage(caught);
            error.hidden = false;
            toast.error(caught);
          } finally {
            setBusy(submit, false);
          }
        },
      },
      h("div", { class: "space-y-1 text-center" }, h("h1", { class: "text-2xl font-bold text-brand" }, "Sign in to your account"), h("p", { class: "text-muted-foreground" }, "Enter your DepEd email below to access your account")),
      googleResult
        ? h("p", { role: googleResult.isError ? "alert" : "status", class: `rounded-lg border p-3 text-sm ${googleResult.isError ? "border-danger/40 bg-danger/5 text-danger" : "border-success/40 bg-success/5 text-success"}` }, googleResult.text)
        : null,
      googleButton(),
      h("div", { class: "space-y-1.5" }, h("label", { class: "block font-medium", htmlFor: emailId }, "Email"), email),
      h(
        "div",
        { class: "space-y-1.5" },
        h(
          "div",
          { class: "flex items-center justify-between gap-2" },
          h("label", { class: "block font-medium", htmlFor: passwordId }, "Password"),
          h("a", { href: "/forgot-password", class: "inline-flex min-h-11 items-center text-sm font-medium text-foreground hover:text-brand" }, "Forgot your password?"),
        ),
        passwordBox,
      ),
      error,
      submit,
      h("a", { href: "/guest", class: "btn btn-outline min-h-12 w-full text-base" }, icon("calendar-search"), "View as Guest"),
      h("p", { class: "flex items-center justify-center gap-2 text-sm text-muted-foreground" }, "No account yet?", h("a", { href: "/signup", class: "inline-flex min-h-11 items-center font-semibold text-foreground hover:text-brand" }, "Sign up")),
      h(
        "p",
        { class: "text-center text-small text-muted-foreground" },
        "On your first sign-in you will be asked to accept the ",
        h("button", { type: "button", class: "inline-flex min-h-11 items-center font-medium text-brand underline underline-offset-2", onclick: () => openTerms() }, "Terms and Conditions"),
        ".",
      ),
    );
    return form;
  };

  /** @param {{ sent_to: string, minutes: number }} sent */
  const codeStep = (sent) => {
    const codeId = uid("code");
    const error = h("p", { class: "field-error", role: "alert", hidden: true });
    const code = /** @type {HTMLInputElement} */ (h("input", { id: codeId, class: "input text-center text-2xl tracking-[0.5em] tabular-nums", inputMode: "numeric", autocomplete: "one-time-code", maxLength: 6, pattern: "[0-9]{6}" }));
    const remember = /** @type {HTMLInputElement} */ (h("input", { type: "checkbox", class: "size-5 accent-[var(--brand)]" }));
    const submit = /** @type {HTMLButtonElement} */ (h("button", { type: "submit", class: "btn btn-primary w-full" }, "Verify and sign in"));
    const resend = /** @type {HTMLButtonElement} */ (
      h(
        "button",
        {
          type: "button",
          class: "btn btn-outline w-full",
          onclick: async () => {
            setBusy(resend, true, "Sending...");
            try {
              await api("/login/code/resend", { method: "POST" });
              toast.success(`A new code was sent to ${sent.sent_to}.`);
            } catch (caught) {
              toast.error(caught);
            } finally {
              setBusy(resend, false);
            }
          },
        },
        "Send a new code",
      )
    );

    return h(
      "form",
      {
        class: "space-y-4",
        onsubmit: async (/** @type {SubmitEvent} */ event) => {
          event.preventDefault();
          error.hidden = true;
          if (!/^\d{6}$/.test(code.value)) {
            error.textContent = "Type the 6 numbers from the email.";
            error.hidden = false;
            return;
          }
          setBusy(submit, true, "Checking...");
          try {
            await finish(/** @type {any} */ (await api("/login/code", { method: "POST", body: { code: code.value, remember_device: remember.checked } })));
          } catch (caught) {
            error.textContent = errorMessage(caught);
            error.hidden = false;
            toast.error(caught);
          } finally {
            setBusy(submit, false);
          }
        },
      },
      h("div", { class: "space-y-1 text-center" }, h("h1", { class: "text-2xl font-bold text-brand" }, "Check your email"), h("p", { class: "text-sm text-muted-foreground" }, `We sent a 6-digit code to ${sent.sent_to}. It works for ${sent.minutes} minutes.`)),
      h("div", { class: "space-y-1" }, h("label", { class: "field-label", htmlFor: codeId }, "Sign-in code"), code),
      h("label", { class: "flex min-h-11 items-center gap-3 text-sm" }, remember, "Remember this device for 30 days"),
      error,
      submit,
      resend,
      h("button", { type: "button", class: "btn btn-quiet w-full", onclick: () => replace(container, passwordStep()) }, icon("arrow-left"), "Use another account"),
    );
  };

  replace(container, passwordStep());
}
