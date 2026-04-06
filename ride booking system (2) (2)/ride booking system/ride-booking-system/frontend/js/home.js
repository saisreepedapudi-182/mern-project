const bookingState = {
  user: null,
  pickup: '',
  dropoff: '',
  vehicle: 'sedan',
  paymentMethod: 'card',
  fare: 18,
};

const vehicleFareMap = {
  bike: 10,
  sedan: 18,
  suv: 28,
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const error = new Error(`Expected JSON response from ${url}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data?.message || 'Request failed');
    error.status = response.status;
    throw error;
  }

  return data;
};

const showBookingNotice = (message, type = 'error') => {
  const notice = document.getElementById('bookingNotice');
  if (!notice) return;

  notice.textContent = message;
  notice.classList.remove('hidden', 'success', 'error');
  notice.classList.add(type);
};

const setButtonLoading = (loading) => {
  const button = document.getElementById('homeBookingBtn');
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading ? 'Processing...' : 'Book ride now';
};

const syncFare = () => {
  bookingState.fare = vehicleFareMap[bookingState.vehicle] || vehicleFareMap.sedan;
  const fareInput = document.getElementById('homeFare');
  if (fareInput) {
    fareInput.value = String(bookingState.fare);
  }
};

const persistDraft = () => {
  sessionStorage.setItem('homepageBookingDraft', JSON.stringify({
    pickup: bookingState.pickup,
    dropoff: bookingState.dropoff,
    vehicle: bookingState.vehicle,
    paymentMethod: bookingState.paymentMethod,
    fare: bookingState.fare,
  }));
};

const hydrateDraft = () => {
  const rawDraft = sessionStorage.getItem('homepageBookingDraft');
  if (!rawDraft) {
    syncFare();
    return;
  }

  try {
    const draft = JSON.parse(rawDraft);
    bookingState.pickup = draft.pickup || '';
    bookingState.dropoff = draft.dropoff || '';
    bookingState.vehicle = draft.vehicle || 'sedan';
    bookingState.paymentMethod = draft.paymentMethod || 'card';
  } catch {
    sessionStorage.removeItem('homepageBookingDraft');
  }

  document.getElementById('homePickup').value = bookingState.pickup;
  document.getElementById('homeDropoff').value = bookingState.dropoff;
  document.getElementById('homeVehicle').value = bookingState.vehicle;
  document.getElementById('homePaymentMethod').value = bookingState.paymentMethod;
  syncFare();
};

const clearDraft = () => {
  sessionStorage.removeItem('homepageBookingDraft');
};

const updateUserState = () => {
  const userState = document.getElementById('bookingUserState');
  if (!userState) return;

  if (!bookingState.user) {
    userState.textContent = 'Sign in as a customer to submit this booking directly.';
    return;
  }

  if (bookingState.user.role !== 'customer') {
    userState.textContent = `Signed in as ${bookingState.user.role}. Booking is available for customer accounts.`;
    return;
  }

  userState.textContent = `Signed in as ${bookingState.user.name || 'customer'}. Your booking can be sent immediately.`;
};

const loadSession = async () => {
  try {
    bookingState.user = await requestJson('/api/auth/profile');
  } catch (error) {
    if (error.status !== 401) {
      showBookingNotice(error.message || 'Could not verify session.');
    }
    bookingState.user = null;
  } finally {
    updateUserState();
  }
};

const animateCounters = () => {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const element = entry.target;
      const target = Number(element.dataset.counter || 0);
      const suffix = target === 98 ? '%' : target === 24 ? '/7' : '+';
      const duration = 1200;
      const start = performance.now();

      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const value = Math.round(progress * target);
        element.textContent = `${value}${suffix}`;
        if (progress < 1) {
          window.requestAnimationFrame(tick);
        }
      };

      window.requestAnimationFrame(tick);
      observer.unobserve(element);
    });
  }, { threshold: 0.6 });

  counters.forEach((counter) => observer.observe(counter));
};

const bindRevealAnimations = () => {
  const revealItems = document.querySelectorAll('.reveal');
  if (!revealItems.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('revealed');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.18 });

  revealItems.forEach((item) => observer.observe(item));
};

const bindMenuToggle = () => {
  const toggle = document.getElementById('menuToggle');
  const panel = document.getElementById('navPanel');
  if (!toggle || !panel) return;

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    panel.classList.toggle('open', !expanded);
  });

  panel.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      toggle.setAttribute('aria-expanded', 'false');
      panel.classList.remove('open');
    });
  });
};

document.getElementById('homePickup')?.addEventListener('input', (event) => {
  bookingState.pickup = event.target.value;
  persistDraft();
});

document.getElementById('homeDropoff')?.addEventListener('input', (event) => {
  bookingState.dropoff = event.target.value;
  persistDraft();
});

document.getElementById('homeVehicle')?.addEventListener('change', (event) => {
  bookingState.vehicle = event.target.value;
  syncFare();
  persistDraft();
});

document.getElementById('homePaymentMethod')?.addEventListener('change', (event) => {
  bookingState.paymentMethod = event.target.value;
  persistDraft();
});

document.getElementById('homepageBookingForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const pickup = bookingState.pickup.trim();
  const dropoff = bookingState.dropoff.trim();

  if (!pickup || !dropoff) {
    showBookingNotice('Pickup and dropoff are required.');
    return;
  }

  if (!bookingState.user) {
    persistDraft();
    showBookingNotice('Please log in as a customer to complete your booking.');
    window.setTimeout(() => {
      window.location.href = 'login.html';
    }, 500);
    return;
  }

  if (bookingState.user.role !== 'customer') {
    showBookingNotice('Only customer accounts can create rides from this form.');
    return;
  }

  setButtonLoading(true);

  try {
    await requestJson('/api/rides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickup,
        dropoff,
        vehicle: bookingState.vehicle,
        paymentMethod: bookingState.paymentMethod,
        fare: bookingState.fare,
      }),
    });

    showBookingNotice('Ride requested successfully. You can review it in the customer dashboard.', 'success');
    bookingState.pickup = '';
    bookingState.dropoff = '';
    bookingState.vehicle = 'sedan';
    bookingState.paymentMethod = 'card';
    document.getElementById('homePickup').value = '';
    document.getElementById('homeDropoff').value = '';
    document.getElementById('homeVehicle').value = 'sedan';
    document.getElementById('homePaymentMethod').value = 'card';
    syncFare();
    clearDraft();
  } catch (error) {
    if (error.status === 401) {
      bookingState.user = null;
      updateUserState();
      persistDraft();
      showBookingNotice('Your session expired. Please sign in again to book the ride.');
      window.setTimeout(() => {
        window.location.href = 'login.html';
      }, 700);
      return;
    }

    showBookingNotice(error.message || 'Could not create ride.');
  } finally {
    setButtonLoading(false);
  }
});

hydrateDraft();
bindMenuToggle();
bindRevealAnimations();
animateCounters();
loadSession();
