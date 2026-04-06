const state = {
  user: null,
  rides: [],
  payments: [],
  feedback: [],
};

const bookingFormState = {
  pickup: '',
  dropoff: '',
  vehicle: 'sedan',
  paymentMethod: 'card',
  fare: 18,
};

const redirectToLogin = () => {
  window.location.href = 'login.html';
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

const setLoading = (loading) => {
  document.getElementById('loadingOverlay')?.classList.toggle('hidden', !loading);
};

const setMessage = (message, type = 'error') => {
  const notice = document.getElementById('rideMsg');
  if (!notice) return;
  notice.textContent = message;
  notice.classList.remove('success', 'error');
  notice.classList.add(type);
};

const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || '').trim());
const vehicleFareMap = { bike: 10, sedan: 18, suv: 28 };

const setTab = (id) => {
  document.querySelectorAll('.tab').forEach((section) => {
    section.classList.toggle('active', section.id === id);
  });

  document.querySelectorAll('[data-tab-target]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tabTarget === id);
  });
};

const toggleSidebar = () => {
  document.getElementById('customerSidebar')?.classList.toggle('open');
};

const closeSidebar = () => {
  document.getElementById('customerSidebar')?.classList.remove('open');
};

const openModal = (id) => {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
};

const closeModal = (id) => {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
};

const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const currency = (amount) => `$${Number(amount || 0).toFixed(2)}`;

const statusBadge = (status) =>
  `<span class="badge ${escapeHtml(status)}">${escapeHtml(status.replace('_', ' '))}</span>`;

const canCancelRide = (ride) => !['cancelled', 'completed'].includes(ride.status);

const renderProfile = () => {
  const profileInfo = document.getElementById('profileInfo');
  if (!profileInfo || !state.user) return;

  const completion = Math.min(
    100,
    [
      state.user.name ? 35 : 0,
      state.user.email ? 35 : 0,
      state.user.phone ? 30 : 0,
    ].reduce((sum, value) => sum + value, 0),
  );

  document.getElementById('customerNameDisplay').textContent = state.user.name || 'Rider';
  document.getElementById('profileCompletionValue').textContent = `${completion}%`;
  document.getElementById('name').value = state.user.name || '';
  document.getElementById('phone').value = state.user.phone || '';

  profileInfo.innerHTML = `
    <div class="detail-row"><strong>Name</strong><span>${escapeHtml(state.user.name || 'N/A')}</span></div>
    <div class="detail-row"><strong>Email</strong><span>${escapeHtml(state.user.email || 'N/A')}</span></div>
    <div class="detail-row"><strong>Phone</strong><span>${escapeHtml(state.user.phone || 'N/A')}</span></div>
    <div class="detail-row"><strong>Role</strong><span>${escapeHtml(state.user.role || 'customer')}</span></div>
  `;
};

const renderRides = () => {
  const rideList = document.getElementById('rideList');
  if (!rideList) return;

  document.getElementById('rideCountValue').textContent = String(state.rides.length);

  if (!state.rides.length) {
    rideList.innerHTML = '<div class="empty-state">No rides yet. Your next booking will appear here.</div>';
    return;
  }

  const paidRideIds = new Set(
    state.payments.filter((payment) => payment.status === 'paid').map((payment) => payment.ride?._id),
  );

  rideList.innerHTML = state.rides
    .map((ride) => {
      const canCancel = canCancelRide(ride);
      const canPay = !paidRideIds.has(ride._id) && ride.status !== 'cancelled';

      return `
        <article class="card-item ${ride.status === 'cancelled' ? 'card-item-cancelled' : ''}">
          <div class="card-head">
            <div>
              <strong>${escapeHtml(ride.pickup)} to ${escapeHtml(ride.dropoff)}</strong>
              <div class="card-meta">Driver: ${escapeHtml(ride.driver?.name || 'Pending assignment')}</div>
            </div>
            ${statusBadge(ride.status)}
          </div>
          <div class="detail-row">
            <strong>Vehicle</strong>
            <span>${escapeHtml(ride.vehicle || 'sedan')}</span>
          </div>
          <div class="detail-row">
            <strong>Fare</strong>
            <span>${currency(ride.fare)}</span>
          </div>
          <div class="card-actions">
            ${canPay ? `<button class="btn btn-primary" type="button" data-pay-ride="${escapeHtml(ride._id)}">Pay now</button>` : ''}
            <button class="btn btn-secondary" type="button" data-cancel-ride="${escapeHtml(ride._id)}" ${canCancel ? '' : 'disabled'}>
              ${ride.status === 'cancelled' ? 'Ride cancelled' : ride.status === 'completed' ? 'Ride completed' : 'Cancel ride'}
            </button>
          </div>
        </article>
      `;
    })
    .join('');
};

const renderPayments = () => {
  const paymentList = document.getElementById('paymentList');
  if (!paymentList) return;

  const pendingCount = state.rides.filter((ride) => {
    const paid = state.payments.some((payment) => payment.ride?._id === ride._id && payment.status === 'paid');
    return !paid && ride.status !== 'cancelled';
  }).length;

  document.getElementById('pendingPaymentValue').textContent = String(pendingCount);

  if (!state.payments.length) {
    paymentList.innerHTML = '<div class="empty-state">No receipts yet. Paid rides will appear here.</div>';
    return;
  }

  paymentList.innerHTML = state.payments
    .map((payment) => `
      <article class="card-item">
        <div class="card-head">
          <div>
            <strong>${escapeHtml(payment.ride?.pickup || 'Ride')} to ${escapeHtml(payment.ride?.dropoff || 'destination')}</strong>
            <div class="card-meta">Method: ${escapeHtml(payment.method || 'card')}</div>
          </div>
          ${statusBadge(payment.status)}
        </div>
        <div class="detail-row">
          <strong>Amount</strong>
          <span>${currency(payment.amount)}</span>
        </div>
      </article>
    `)
    .join('');
};

const renderFeedback = () => {
  const feedbackList = document.getElementById('feedbackList');
  if (!feedbackList) return;

  const ownFeedback = state.feedback
    .filter((item) => item.from?._id === state.user?._id)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  document.getElementById('feedbackCountValue').textContent = String(ownFeedback.length);

  if (!ownFeedback.length) {
    feedbackList.innerHTML = '<div class="empty-state">No feedback entries yet.</div>';
    return;
  }

  feedbackList.innerHTML = ownFeedback
    .map((item) => `
      <article class="card-item">
        <div class="card-head">
          <div>
            <strong>${escapeHtml(item.from?.name || 'Unknown')}</strong>
            <div class="card-meta">To: ${escapeHtml(item.to?.name || 'Platform')} | ${escapeHtml(item.ride?.pickup || 'Ride')} to ${escapeHtml(item.ride?.dropoff || 'destination')}</div>
          </div>
          <span class="badge completed">${'&#9733; '.repeat(Number(item.rating || 0)).trim()}</span>
        </div>
        <p>${escapeHtml(item.message || '')}</p>
      </article>
    `)
    .join('');
};

const loadDashboard = async () => {
  setLoading(true);

  try {
    const [user, rides, payments, feedback] = await Promise.all([
      requestJson('/api/auth/profile'),
      requestJson('/api/rides'),
      requestJson('/api/payments'),
      requestJson('/api/rides/feedback'),
    ]);

    state.user = user;
    state.rides = rides;
    state.payments = payments;
    state.feedback = feedback;

    renderProfile();
    renderRides();
    renderPayments();
    renderFeedback();
  } catch (error) {
    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    window.alert(error.message || 'Could not load dashboard.');
  } finally {
    setLoading(false);
  }
};

const updateStarRating = (rating) => {
  document.getElementById('fbRating').value = String(rating);
  document.querySelectorAll('.rating-star').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.rating) <= rating);
  });
};

const syncEstimatedFare = () => {
  bookingFormState.fare = vehicleFareMap[bookingFormState.vehicle] || vehicleFareMap.sedan;
  document.getElementById('estimatedFare').value = String(bookingFormState.fare);
};

const syncBookingField = (field, value) => {
  bookingFormState[field] = value;

  const element = document.getElementById(
    field === 'paymentMethod' ? 'preferredPaymentMethod' : field,
  );

  if (element && element.value !== value) {
    element.value = value;
  }

  if (field === 'vehicle') {
    syncEstimatedFare();
  }
};

const resetBookingForm = () => {
  syncBookingField('pickup', '');
  syncBookingField('dropoff', '');
  syncBookingField('vehicle', 'sedan');
  syncBookingField('paymentMethod', 'card');
};

document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);

document.querySelector('.sidebar-nav')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-tab-target]');
  if (!button) return;
  setTab(button.dataset.tabTarget);
  closeSidebar();
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  redirectToLogin();
});

document.getElementById('editProfileBtn')?.addEventListener('click', () => {
  document.getElementById('profileForm')?.classList.toggle('hidden');
});

document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
  try {
    await requestJson('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('name').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        password: document.getElementById('newPassword').value,
      }),
    });

    await loadDashboard();
    document.getElementById('profileForm')?.classList.add('hidden');
  } catch (error) {
    window.alert(error.message || 'Profile update failed.');
  }
});

document.getElementById('bookRideBtn')?.addEventListener('click', async () => {
  const pickup = bookingFormState.pickup.trim();
  const dropoff = bookingFormState.dropoff.trim();
  const vehicle = bookingFormState.vehicle;
  const paymentMethod = bookingFormState.paymentMethod;
  const fare = Number(bookingFormState.fare);

  if (!pickup || !dropoff || !vehicle || !paymentMethod || !fare) {
    setMessage('Pickup, dropoff, vehicle, payment method, and fare are required.');
    return;
  }

  try {
    await requestJson('/api/rides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickup, dropoff, vehicle, paymentMethod, fare }),
    });

    setMessage('Ride requested successfully.', 'success');
    resetBookingForm();
    await loadDashboard();
    setTab('rides');
  } catch (error) {
    setMessage(error.message || 'Could not request ride.');
  }
});

document.getElementById('rideList')?.addEventListener('click', async (event) => {
  const payButton = event.target.closest('[data-pay-ride]');
  const cancelButton = event.target.closest('[data-cancel-ride]');

  if (payButton) {
    const ride = state.rides.find((item) => item._id === payButton.dataset.payRide);
    if (!ride) return;

    document.getElementById('paymentRideId').value = ride._id;
    document.getElementById('paymentModalRideSummary').textContent = `${ride.pickup} to ${ride.dropoff} for ${currency(ride.fare)}`;
    document.getElementById('paymentMethodSelect').value = document.getElementById('preferredPaymentMethod').value;
    openModal('paymentModal');
    return;
  }

  if (cancelButton) {
    if (cancelButton.disabled) return;
    try {
      await requestJson(`/api/rides/cancel/${cancelButton.dataset.cancelRide}`, {
        method: 'PUT',
      });
      await loadDashboard();
    } catch (error) {
      window.alert(error.message || 'Could not cancel ride.');
    }
  }
});

document.getElementById('confirmPaymentBtn')?.addEventListener('click', async () => {
  const rideId = document.getElementById('paymentRideId').value;
  const method = document.getElementById('paymentMethodSelect').value;

  if (!rideId) return;

  try {
    await requestJson('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId, method }),
    });

    closeModal('paymentModal');
    await loadDashboard();
    setTab('payments');
  } catch (error) {
    window.alert(error.message || 'Payment failed.');
  }
});

document.getElementById('starRating')?.addEventListener('click', (event) => {
  const star = event.target.closest('[data-rating]');
  if (!star) return;
  updateStarRating(Number(star.dataset.rating));
});

document.getElementById('submitFeedbackBtn')?.addEventListener('click', async () => {
  const toId = document.getElementById('fbToId').value.trim();
  const message = document.getElementById('fbMessage').value.trim();
  const rating = Number(document.getElementById('fbRating').value);

  if (!message) {
    window.alert('Feedback message is required.');
    return;
  }

  if (toId && !isObjectId(toId)) {
    window.alert('Enter a valid recipient user ID or leave it blank.');
    return;
  }

  try {
    await requestJson('/api/rides/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toId: toId || undefined,
        message,
        rating,
      }),
    });

    document.getElementById('fbToId').value = '';
    document.getElementById('fbMessage').value = '';
    updateStarRating(5);
    await loadDashboard();
    document.getElementById('feedbackModalText').textContent = 'Your feedback has been submitted successfully.';
    openModal('feedbackModal');
    setTab('feedback');
  } catch (error) {
    window.alert(error.message || 'Could not submit feedback.');
  }
});

document.body.addEventListener('click', (event) => {
  const closeTarget = event.target.closest('[data-close-modal]');
  if (!closeTarget) return;
  closeModal(closeTarget.dataset.closeModal);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal('paymentModal');
    closeModal('feedbackModal');
    closeSidebar();
  }
});

setTab('profile');
document.getElementById('pickup')?.addEventListener('input', (event) => {
  syncBookingField('pickup', event.target.value);
});
document.getElementById('dropoff')?.addEventListener('input', (event) => {
  syncBookingField('dropoff', event.target.value);
});
document.getElementById('vehicle')?.addEventListener('change', (event) => {
  syncBookingField('vehicle', event.target.value);
});
document.getElementById('preferredPaymentMethod')?.addEventListener('change', (event) => {
  syncBookingField('paymentMethod', event.target.value);
});
updateStarRating(5);
resetBookingForm();
loadDashboard();
