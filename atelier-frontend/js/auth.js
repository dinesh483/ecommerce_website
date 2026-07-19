function showFormMsg(text, type = "error") {
  const el = qs("#form-msg");
  if (!el) return;
  el.innerHTML = `<div class="form-msg ${type}">${escapeHTML(text)}</div>`;
}

async function afterLoginRedirect() {
  try {
    const me = await API.me();
    AUTHUI.setCachedUser(me);
  } catch (_) { /* ignore */ }
  const params = new URLSearchParams(window.location.search);
  window.location.href = params.get("next") || "account.html";
}

const loginForm = qs("#login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = qs("#submit-btn");
    btn.disabled = true; btn.textContent = "Signing in…";
    try {
      const { access_token } = await API.login(qs("#username").value.trim(), qs("#password").value);
      API.setToken(access_token);
      showFormMsg("Signed in — redirecting…", "success");
      await afterLoginRedirect();
    } catch (err) {
      showFormMsg(err.message || "Sign in failed. Check your username and password.");
      btn.disabled = false; btn.textContent = "Sign in";
    }
  });
}

const registerForm = qs("#register-form");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = qs("#submit-btn");
    btn.disabled = true; btn.textContent = "Creating account…";
    try {
      await API.register({
        username: qs("#username").value.trim(),
        email: qs("#email").value.trim(),
        password: qs("#password").value,
        full_name: qs("#full_name").value.trim() || null,
      });
      const { access_token } = await API.login(qs("#username").value.trim(), qs("#password").value);
      API.setToken(access_token);
      showFormMsg("Account created — welcome to Atelier.", "success");
      await afterLoginRedirect();
    } catch (err) {
      showFormMsg(err.message || "Could not create your account.");
      btn.disabled = false; btn.textContent = "Create account";
    }
  });
}
