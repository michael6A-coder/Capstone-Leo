document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('portal-form');
  const button = document.getElementById('role-button');
  const list = document.getElementById('role-options');
  const options = Array.from(list.querySelectorAll('[role=option]'));
  const pin = document.getElementById('portal-pin');
  const message = document.getElementById('portal-message');
  const submit = form.querySelector('[type=submit]');
  const customerFields = document.getElementById('customer-fields');
  const pinFields = document.getElementById('pin-fields');
  const email = document.getElementById('customer-email');
  const password = document.getElementById('customer-password');
  const emailLink = document.querySelector('.email-link');
  const mode = new URLSearchParams(window.location.search).get('mode');
  const teamEmail = mode === 'team-email';
  const customer = mode !== 'team';
  const submitLabel = teamEmail ? 'SIGN IN' : customer ? 'Log in' : 'Verify credentials';
  const showPassword = document.getElementById('show-password');
  const openEyeIcon = showPassword.querySelector('[data-eye-open]');
  const closedEyeIcon = showPassword.querySelector('[data-eye-closed]');
  openEyeIcon.toggleAttribute('hidden', password.type === 'password');
  closedEyeIcon.toggleAttribute('hidden', password.type !== 'password');
  document.getElementById('team-fields').hidden = customer;
  customerFields.hidden = !customer;
  pinFields.hidden = customer;
  pin.disabled = customer;
  email.disabled = password.disabled = !customer;
  emailLink.hidden = customer && !teamEmail;
  document.getElementById('register-link').hidden = !customer || teamEmail;
  submit.textContent = submitLabel;
  if (teamEmail) {
    document.title = 'Leo Mejillano — Team Sign-in';
    document.getElementById('login-heading').textContent = 'TEAM SIGN-IN';
    document.getElementById('login-intro').textContent = 'Enter your email and password to access your account.';
    emailLink.textContent = 'Use Role & PIN Instead';
    emailLink.href = '?mode=team';
  }
  if (!customer) {
    emailLink.href = '?mode=team-email';
    document.getElementById('login-heading').textContent = 'TEAM SIGN-IN';
    document.getElementById('login-intro').textContent = 'Choose your team role and enter your access PIN.';
  }
  showPassword.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    const label = visible ? 'Hide password' : 'Show password';
    showPassword.setAttribute('aria-label', label);
    showPassword.title = label;
    showPassword.setAttribute('aria-pressed', String(visible));
    openEyeIcon.toggleAttribute('hidden', !visible);
    closedEyeIcon.toggleAttribute('hidden', visible);
  });
  [email, password].forEach(input => input.addEventListener('input', () => {
    message.textContent = '';
    input.removeAttribute('aria-invalid');
  }));
  let selected = options.find(option => option.getAttribute('aria-selected') === 'true');
  let busy = false;
  function close(focus = false) {
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focus) button.focus();
  }
  function open() {
    list.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    selected.focus();
  }
  function select(option) {
    if (busy) return;
    selected.setAttribute('aria-selected', 'false');
    selected = option;
    selected.setAttribute('aria-selected', 'true');
    document.getElementById('selected-role').textContent = selected.firstChild.textContent;
    pin.value = '';
    pin.removeAttribute('aria-invalid');
    password.value = '';
    message.textContent = '';
    close(true);
  }
  button.addEventListener('click', () => list.hidden ? open() : close());
  button.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); open(); }
  });
  options.forEach(option => option.addEventListener('click', () => select(option)));
  list.addEventListener('keydown', event => {
    const index = options.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    else if (event.key === 'Tab') close();
    else if (['Enter', ' '].includes(event.key)) { event.preventDefault(); select(options[index]); }
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next].focus();
    }
  });
  document.addEventListener('click', event => { if (!event.target.closest('.role-picker')) close(); });
  document.addEventListener('focusin', event => { if (!event.target.closest('.role-picker')) close(); });
  pin.addEventListener('input', () => { message.textContent = ''; pin.removeAttribute('aria-invalid'); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    email.value = email.value.trim();
    if (customer && (!email.checkValidity() || !password.value)) {
      message.textContent = 'Please enter a valid email address and your password.';
      (!email.checkValidity() ? email : password).setAttribute('aria-invalid', 'true');
      (!email.checkValidity() ? email : password).focus();
      return;
    }
    if (!customer && !/^\d{4,12}$/.test(pin.value)) {
      message.textContent = 'Please enter your 4–12 digit access PIN.';
      pin.setAttribute('aria-invalid', 'true');
      pin.focus();
      return;
    }
    const body = new FormData();
    if (customer) {
      body.append('email', email.value.trim().toLowerCase());
      body.append('password', password.value);
      if (teamEmail) body.append('portal', '1');
    } else {
      body.append('role', selected.dataset.value);
      body.append('pin', pin.value);
    }
    busy = true;
    submit.disabled = button.disabled = pin.disabled = true;
    email.disabled = password.disabled = true;
    submit.textContent = 'Verifying…';
    message.textContent = '';
    try {
      const endpoint = customer ? 'login.php' : 'portalLogin.php';
      const response = await fetch('../../backend/auth/' + endpoint, { method: 'POST', credentials: 'include', body });
      const result = await response.json();
      if (response.ok && result.success) {
        window.location.assign(result.redirect);
      } else if (customer && response.status === 403 && result.needs_verification) {
        window.location.assign('../login/verify-otp.html?email=' + encodeURIComponent(result.email || email.value.trim()));
      } else {
        message.textContent = result.message || 'Unable to sign in. Please try again.';
      }
    } catch {
      message.textContent = 'Could not reach the server. Please try again.';
    } finally {
      busy = false;
      submit.disabled = button.disabled = pin.disabled = false;
      pin.disabled = customer;
      email.disabled = password.disabled = !customer;
      submit.textContent = submitLabel;
    }
  });
});
