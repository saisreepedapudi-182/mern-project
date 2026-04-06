const driverState = {
  user: null,
  rides: [],
  payments: [],
  feedback: [],
};

const redirectToLogin = () => {
  window.location.href = 'login.html';
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const parseError = new Error(`Expected JSON response from ${url}`);
    parseError.status = response.status;
    throw parseError;
  }

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data?.message || 'Request failed');
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
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

const setLoading = (loading) => {
  document.getElementById('loadingOverlay')?.classList.toggle('hidden', !loading);
};

const setDriverMessage = (message, type = 'error') => {
  const notice = document.getElementById('driverStatusNotice');
  if (!notice) return;
  notice.textContent = message;
  notice.classList.remove('success', 'error');
  notice.classList.add(type);
};

const setTab = (id) => {
  document.querySelectorAll('.tab').forEach((section) => {
    section.classList.toggle('active', section.id === id);
  });

  document.querySelectorAll('[data-tab-target]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tabTarget === id);
  });
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

const renderProfile = () => {
  const profileInfo = document.getElementById('profileInfo');
  if (!profileInfo || !driverState.user) return;

  document.getElementById('name').value = driverState.user.name || '';
  document.getElementById('phone').value = driverState.user.phone || '';

  profileInfo.innerHTML = `
    <div class="detail-row"><strong>Name</strong><span>${escapeHtml(driverState.user.name || 'N/A')}</span></div>
    <div class="detail-row"><strong>Email</strong><span>${escapeHtml(driverState.user.email || 'N/A')}</span></div>
    <div class="detail-row"><strong>Phone</strong><span>${escapeHtml(driverState.user.phone || 'N/A')}</span></div>
    <div class="detail-row"><strong>Role</strong><span>${escapeHtml(driverState.user.role || 'driver')}</span></div>
  `;
};

const renderAssignedRides = () => {
  const assignedList = document.getElementById('assignedList');
  if (!assignedList) return;

  const acceptedCount = driverState.rides.filter((ride) => ride.status === 'accepted').length;
  const inProgressCount = driverState.rides.filter((ride) => ride.status === 'in_progress').length;
  const completedCount = driverState.rides.filter((ride) => ride.status === 'completed').length;
  const totalFare = driverState.rides.reduce((sum, ride) => sum + Number(ride.fare || 0), 0);

  document.getElementById('acceptedCountValue').textContent = String(acceptedCount);
  document.getElementById('inProgressCountValue').textContent = String(inProgressCount);
  document.getElementById('completedCountValue').textContent = String(completedCount);
  document.getElementById('fareTotalValue').textContent = currency(totalFare);

  if (!driverState.rides.length) {
    assignedList.innerHTML = '<div class="empty-state">No assigned rides yet.</div>';
    return;
  }

  assignedList.innerHTML = driverState.rides
    .map((ride) => {
      const actions = [];

      if (ride.status === 'accepted') {
        actions.push(`<button class="btn btn-primary" type="button" data-status-action="in_progress" data-ride-id="${escapeHtml(ride._id)}">Start ride</button>`);
      }

      if (ride.status === 'in_progress') {
        actions.push(`<button class="btn btn-primary" type="button" data-status-action="completed" data-ride-id="${escapeHtml(ride._id)}">Complete ride</button>`);
      }

      actions.push(`<button class="btn btn-secondary" type="button" data-fare-action="edit" data-ride-id="${escapeHtml(ride._id)}">Edit fare</button>`);
      actions.push(
        `<button class="btn btn-secondary" type="button" data-cancel-ride="${escapeHtml(ride._id)}" ${canCancelRide(ride) ? '' : 'disabled'}>
          ${ride.status === 'cancelled' ? 'Ride cancelled' : ride.status === 'completed' ? 'Ride completed' : 'Cancel ride'}
        </button>`,
      );

      return `
        <article class="card-item ${ride.status === 'cancelled' ? 'card-item-cancelled' : ''}">
          <div class="card-head">
            <div>
              <strong>${escapeHtml(ride.pickup)} to ${escapeHtml(ride.dropoff)}</strong>
              <div class="card-meta">Customer: ${escapeHtml(ride.customer?.name || 'Customer')} | Vehicle: ${escapeHtml(ride.vehicle || 'sedan')}</div>
            </div>
            ${statusBadge(ride.status)}
          </div>
          <div class="detail-row"><strong>Fare</strong><span>${currency(ride.fare)}</span></div>
          <div class="card-actions">${actions.join('')}</div>
        </article>
      `;
    })
    .join('');
};

const renderPayments = () => {
  const paymentList = document.getElementById('paymentList');
  if (!paymentList) return;

  if (!driverState.payments.length) {
    paymentList.innerHTML = '<div class="empty-state">No payment records available.</div>';
    return;
  }

  paymentList.innerHTML = driverState.payments
    .map((payment) => `
      <article class="card-item">
        <div class="card-head">
          <div>
            <strong>${escapeHtml(payment.ride?.pickup || 'Ride')} to ${escapeHtml(payment.ride?.dropoff || 'destination')}</strong>
            <div class="card-meta">Customer: ${escapeHtml(payment.customer?.name || 'N/A')} | Method: ${escapeHtml(payment.method || 'card')}</div>
          </div>
          ${statusBadge(payment.status || 'pending')}
        </div>
        <div class="detail-row"><strong>Amount</strong><span>${currency(payment.amount)}</span></div>
      </article>
    `)
    .join('');
};

const renderFeedback = () => {
  const feedbackList = document.getElementById('feedbackList');
  if (!feedbackList) return;

  if (!driverState.feedback.length) {
    feedbackList.innerHTML = '<div class="empty-state">No feedback records available.</div>';
    return;
  }

  feedbackList.innerHTML = driverState.feedback
    .map((item) => `
      <article class="card-item">
        <div class="card-head">
          <div>
            <strong>${escapeHtml(item.from?.name || 'Unknown')}</strong>
            <div class="card-meta">${escapeHtml(item.ride?.pickup || 'Ride')} to ${escapeHtml(item.ride?.dropoff || 'destination')}</div>
          </div>
          <span class="badge completed">${'&#9733; '.repeat(Number(item.rating || 0)).trim()}</span>
        </div>
        <div class="detail-row"><strong>Role</strong><span>${escapeHtml(item.role || 'user')}</span></div>
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

    driverState.user = user;
    driverState.rides = rides;
    driverState.payments = payments;
    driverState.feedback = feedback.filter((item) => {
      const rideDriverId = item.ride?.driver?._id || item.ride?.driver;
      return !item.to || item.to?._id === user._id || rideDriverId === user._id;
    });

    renderProfile();
    renderAssignedRides();
    renderPayments();
    renderFeedback();
  } catch (error) {
    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    window.alert(error.message || 'Could not load driver dashboard.');
  } finally {
    setLoading(false);
  }
};

document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('driverSidebar')?.classList.toggle('open');
});

document.querySelector('.sidebar-nav')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-tab-target]');
  if (!button) return;
  setTab(button.dataset.tabTarget);
  document.getElementById('driverSidebar')?.classList.remove('open');
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

    document.getElementById('profileForm')?.classList.add('hidden');
    await loadDashboard();
  } catch (error) {
    window.alert(error.message || 'Could not save profile.');
  }
});

document.getElementById('assignedList')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-status-action]');
  const fareButton = event.target.closest('[data-fare-action]');
  const cancelButton = event.target.closest('[data-cancel-ride]');
  const rideId = button?.dataset.rideId || fareButton?.dataset.rideId || cancelButton?.dataset.cancelRide;
  const ride = driverState.rides.find((item) => item._id === rideId);
  if (!ride) return;

  if (cancelButton) {
    if (cancelButton.disabled) return;

    requestJson(`/api/rides/cancel/${ride._id}`, { method: 'PUT' })
      .then(async () => {
        setDriverMessage('Ride cancelled successfully.', 'success');
        await loadDashboard();
        setTab('assigned');
      })
      .catch((error) => {
        setDriverMessage(error.message || 'Could not cancel ride.');
      });
    return;
  }

  document.getElementById('rideStatusRideId').value = ride._id;

  if (button) {
    const nextStatus = button.dataset.statusAction;
    document.getElementById('rideStatusValue').value = nextStatus;
    document.getElementById('rideStatusCopy').textContent = `Change ${ride.pickup} to ${ride.dropoff} from ${ride.status.replace('_', ' ')} to ${nextStatus.replace('_', ' ')}.`;
    document.getElementById('rideFareField').classList.add('hidden');
    document.getElementById('rideFareValue').value = String(ride.fare || '');
    document.getElementById('confirmRideStatusBtn').textContent = 'Confirm update';
  }

  if (fareButton) {
    document.getElementById('rideStatusValue').value = 'fare';
    document.getElementById('rideStatusCopy').textContent = `Update the fare for ${ride.pickup} to ${ride.dropoff}.`;
    document.getElementById('rideFareField').classList.remove('hidden');
    document.getElementById('rideFareValue').value = String(ride.fare || '');
    document.getElementById('confirmRideStatusBtn').textContent = 'Save fare';
  }

  openModal('rideStatusModal');
});

document.getElementById('confirmRideStatusBtn')?.addEventListener('click', async () => {
  const rideId = document.getElementById('rideStatusRideId').value;
  const status = document.getElementById('rideStatusValue').value;

  if (!rideId || !status) return;

  try {
    if (status === 'fare') {
      const fareValue = Number(document.getElementById('rideFareValue').value);
      if (!fareValue || fareValue <= 0) {
        setDriverMessage('Enter a valid fare amount.');
        return;
      }

      await requestJson('/api/rides/fare', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId, fare: fareValue }),
      });
      setDriverMessage('Fare updated successfully.', 'success');
    } else {
      await requestJson('/api/rides/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId, status }),
      });
      setDriverMessage('Ride status updated successfully.', 'success');
    }

    closeModal('rideStatusModal');
    await loadDashboard();
    setTab('assigned');
  } catch (error) {
    setDriverMessage(error.message || 'Could not update ride.');
  }
});

document.body.addEventListener('click', (event) => {
  const closeTarget = event.target.closest('[data-close-modal]');
  if (!closeTarget) return;
  closeModal(closeTarget.dataset.closeModal);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal('rideStatusModal');
    document.getElementById('driverSidebar')?.classList.remove('open');
  }
});

setTab('profile');
loadDashboard();
