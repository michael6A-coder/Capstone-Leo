document.addEventListener('DOMContentLoaded', async () => {
  const host = document.querySelector('[data-account-pin]');
  if (!host) return;
  host.innerHTML = `<h2>Portal access PIN</h2>
    <p data-pin-status>Loading PIN settings…</p>
    <form hidden>
      <label>Current account password<input name="password" type="password" autocomplete="current-password" required></label>
      <label>New PIN<input name="pin" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{6,12}" minlength="6" maxlength="12" required></label>
      <label>Confirm PIN<input name="confirmation" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{6,12}" minlength="6" maxlength="12" required></label>
      <p>Choose 6–12 digits. Use your account role and PIN at the team portal.</p>
      <button type="submit">Save PIN</button>
    </form>
    <p data-pin-message role="status" aria-live="polite"></p>`;
  const form = host.querySelector('form');
  const status = host.querySelector('[data-pin-status]');
  const message = host.querySelector('[data-pin-message]');
  const button = form.querySelector('button');
  let token;
  try {
    const response = await fetch('../../backend/auth/accountPin.php', { credentials: 'include' });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load PIN settings.');
    token = data.token;
    status.textContent = data.configured ? 'Your account has a PIN. You can change it below.' : 'Set up a PIN for your account.';
    form.hidden = false;
  } catch (error) {
    status.textContent = error instanceof SyntaxError ? 'Unable to load PIN settings. Please try again later.' : error.message;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled) return;
    const body = new FormData(form);
    if (body.get('pin') !== body.get('confirmation')) {
      message.textContent = 'The PINs do not match.';
      return;
    }
    body.append('token', token);
    button.disabled = true;
    button.textContent = 'Saving…';
    message.textContent = '';
    try {
      const response = await fetch('../../backend/auth/accountPin.php', { method: 'POST', credentials: 'include', body });
      const data = await response.json();
      message.textContent = data.message || 'Unable to save PIN.';
      if (response.ok && data.success) {
        form.reset();
        status.textContent = 'Your account has a PIN. You can change it below.';
      }
    } catch {
      message.textContent = 'Could not reach the server. Please try again.';
    } finally {
      button.disabled = false;
      button.textContent = 'Save PIN';
    }
  });
});
