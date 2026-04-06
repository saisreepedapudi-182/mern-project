const authMessage = document.getElementById('msg');

const showMessage = (message, type = 'error') => {
  if (!authMessage) return;

  authMessage.textContent = message;
  authMessage.classList.remove('success', 'error');
  authMessage.classList.add(type);
};

const setButtonLoading = (button, loading, loadingLabel) => {
  if (!button) return;

  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.innerHTML;
  }

  button.disabled = loading;
  button.innerHTML = loading ? `<span>${loadingLabel}</span>` : button.dataset.defaultLabel;
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || 'Request failed');
  }

  return data;
};

const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);
const validatePhone = (phone) => /^[+\d\s()-]{8,}$/.test(phone);

const bindRolePicker = () => {
  const rolePicker = document.getElementById('rolePicker');
  const roleSelect = document.getElementById('role');
  if (!rolePicker || !roleSelect) return;

  rolePicker.addEventListener('click', (event) => {
    const option = event.target.closest('[data-role-option]');
    if (!option) return;

    rolePicker.querySelectorAll('[data-role-option]').forEach((button) => {
      button.classList.toggle('active', button === option);
    });
    roleSelect.value = option.dataset.roleOption;
  });
};

const handleLogin = () => {
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  if (!loginForm || !loginBtn) return;

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const selectedRole = document.getElementById('role')?.value;

    if (!validateEmail(email)) {
      showMessage('Enter a valid email address.');
      return;
    }

    if (!password) {
      showMessage('Password is required.');
      return;
    }

    setButtonLoading(loginBtn, true, 'Signing in...');

    try {
      const data = await requestJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      showMessage('Login successful. Redirecting...', 'success');
      const role = data.user.role;

      if (selectedRole && role !== selectedRole) {
        showMessage(`This account is registered as ${role}. Please choose the matching role to continue.`);
        return;
      }

      window.setTimeout(() => {
        if (role === 'customer') window.location.href = 'customer-dashboard.html';
        else if (role === 'driver') window.location.href = 'driver-dashboard.html';
        else window.location.href = 'admin-dashboard.html';
      }, 500);
    } catch (error) {
      showMessage(error.message || 'Failed to sign in.');
    } finally {
      setButtonLoading(loginBtn, false);
    }
  });
};

const handleRegister = () => {
  const registerForm = document.getElementById('registerForm');
  const registerBtn = document.getElementById('registerBtn');
  if (!registerForm || !registerBtn) return;

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      name: document.getElementById('name').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value,
      role: document.getElementById('role').value,
    };

    if (!payload.name) {
      showMessage('Name is required.');
      return;
    }

    if (!validatePhone(payload.phone)) {
      showMessage('Enter a valid phone number.');
      return;
    }

    if (!validateEmail(payload.email)) {
      showMessage('Enter a valid email address.');
      return;
    }

    if (payload.password.length < 6) {
      showMessage('Password must be at least 6 characters.');
      return;
    }

    setButtonLoading(registerBtn, true, 'Creating account...');

    try {
      await requestJson('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      showMessage('Registration successful. Redirecting to login...', 'success');
      window.setTimeout(() => {
        window.location.href = 'login.html';
      }, 800);
    } catch (error) {
      showMessage(error.message || 'Registration failed.');
    } finally {
      setButtonLoading(registerBtn, false);
    }
  });
};

const bindPasswordToggles = () => {
  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      if (!input) return;

      const showPassword = input.type === 'password';
      input.type = showPassword ? 'text' : 'password';
      button.textContent = showPassword ? 'Hide' : 'Show';
      button.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
    });
  });
};

bindRolePicker();
bindPasswordToggles();
handleLogin();
handleRegister();
