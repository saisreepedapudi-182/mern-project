const adminState = {
  users: [],
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

const renderSummary = () => {
  const users = adminState.users.length;
  const rides = adminState.rides.length;
  const payments = adminState.payments.length;
  const revenue = adminState.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  document.getElementById('summaryUsers').textContent = String(users);
  document.getElementById('summaryRides').textContent = String(rides);
  document.getElementById('summaryPayments').textContent = String(payments);
  document.getElementById('summaryRevenue').textContent = currency(revenue);

  document.getElementById('adminSummary').innerHTML = `
    <article class="card-item"><strong>Total users</strong><span class="card-meta">${users}</span></article>
    <article class="card-item"><strong>Total rides</strong><span class="card-meta">${rides}</span></article>
    <article class="card-item"><strong>Total payments</strong><span class="card-meta">${payments}</span></article>
    <article class="card-item"><strong>Revenue</strong><span class="card-meta">${currency(revenue)}</span></article>
  `;
};

const renderChart = () => {
  const chart = document.getElementById('adminChart');
  if (!chart) return;

  const statusCounts = ['requested', 'accepted', 'in_progress', 'completed', 'cancelled'].map((status) => ({
    label: status.replace('_', ' '),
    count: adminState.rides.filter((ride) => ride.status === status).length,
  }));

  const maxCount = Math.max(1, ...statusCounts.map((item) => item.count));

  chart.innerHTML = statusCounts
    .map((item) => `
      <div class="chart-row">
        <div class="chart-label"><span>${escapeHtml(item.label)}</span><strong>${item.count}</strong></div>
        <div class="chart-track"><div class="chart-fill" style="width:${(item.count / maxCount) * 100}%"></div></div>
      </div>
    `)
    .join('');
};

const renderUsers = () => {
  const query = document.getElementById('userSearch')?.value.trim().toLowerCase() || '';
  const body = document.getElementById('userTableBody');
  if (!body) return;

  const rows = adminState.users.filter((user) => {
    const haystack = `${user.name} ${user.email} ${user.role} ${user.phone || ''}`.toLowerCase();
    return haystack.includes(query);
  });

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5"><div class="empty-state">No users match the current search.</div></td></tr>';
    return;
  }

  body.innerHTML = rows
    .map((user) => `
      <tr>
        <td>${escapeHtml(user.name || 'N/A')}</td>
        <td>${escapeHtml(user.email || 'N/A')}</td>
        <td>${statusBadge(user.role || 'user')}</td>
        <td>${escapeHtml(user.phone || 'N/A')}</td>
        <td><button class="btn btn-danger" type="button" data-delete-user="${escapeHtml(user._id)}">Delete</button></td>
      </tr>
    `)
    .join('');
};

const renderRides = () => {
  const query = document.getElementById('rideSearch')?.value.trim().toLowerCase() || '';
  const body = document.getElementById('rideTableBody');
  if (!body) return;

  const rows = adminState.rides.filter((ride) => {
    const haystack = `${ride.pickup} ${ride.dropoff} ${ride.status} ${ride.customer?.name || ''} ${ride.driver?.name || ''}`.toLowerCase();
    return haystack.includes(query);
  });

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6"><div class="empty-state">No rides match the current search.</div></td></tr>';
    return;
  }

  body.innerHTML = rows
    .map((ride) => `
      <tr class="${ride.status === 'cancelled' ? 'table-row-cancelled' : ''}">
        <td>${escapeHtml(ride.pickup)} to ${escapeHtml(ride.dropoff)}<div class="table-note">${escapeHtml(ride.vehicle || 'sedan')}</div></td>
        <td>${escapeHtml(ride.customer?.name || 'N/A')}</td>
        <td>${escapeHtml(ride.driver?.name || 'Unassigned')}</td>
        <td>${statusBadge(ride.status || 'requested')}</td>
        <td>${currency(ride.fare)}</td>
        <td>
          <button class="btn btn-secondary" type="button" data-assign-ride="${escapeHtml(ride._id)}">
            ${ride.driver ? 'Reassign' : 'Assign'}
          </button>
          <button class="btn btn-danger" type="button" data-cancel-ride="${escapeHtml(ride._id)}" ${canCancelRide(ride) ? '' : 'disabled'}>
            ${ride.status === 'cancelled' ? 'Cancelled' : ride.status === 'completed' ? 'Completed' : 'Cancel'}
          </button>
        </td>
      </tr>
    `)
    .join('');
};

const renderPayments = () => {
  const query = document.getElementById('paymentSearch')?.value.trim().toLowerCase() || '';
  const body = document.getElementById('paymentTableBody');
  if (!body) return;

  const rows = adminState.payments.filter((payment) => {
    const haystack = `${payment.ride?.pickup || ''} ${payment.ride?.dropoff || ''} ${payment.customer?.name || ''} ${payment.driver?.name || ''} ${payment.method || ''} ${payment.status || ''}`.toLowerCase();
    return haystack.includes(query);
  });

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6"><div class="empty-state">No payments recorded.</div></td></tr>';
    return;
  }

  body.innerHTML = rows
    .map((payment) => `
      <tr>
        <td>${escapeHtml(payment.ride?.pickup || 'Ride')} to ${escapeHtml(payment.ride?.dropoff || 'destination')}</td>
        <td>${escapeHtml(payment.customer?.name || 'N/A')}</td>
        <td>${escapeHtml(payment.driver?.name || 'N/A')}</td>
        <td>${currency(payment.amount)}</td>
        <td>${escapeHtml(payment.method || 'card')}</td>
        <td>${statusBadge(payment.status || 'pending')}</td>
      </tr>
    `)
    .join('');
};

const renderFeedback = () => {
  const query = document.getElementById('feedbackSearch')?.value.trim().toLowerCase() || '';
  const feedbackList = document.getElementById('feedbackList');
  if (!feedbackList) return;

  const rows = adminState.feedback.filter((item) => {
    const haystack = `${item.from?.name || ''} ${item.to?.name || ''} ${item.role || ''} ${item.message || ''}`.toLowerCase();
    return haystack.includes(query);
  });

  if (!rows.length) {
    feedbackList.innerHTML = '<div class="empty-state">No feedback available.</div>';
    return;
  }

  feedbackList.innerHTML = rows
    .map((item) => `
      <article class="card-item">
        <div class="card-head">
          <div>
            <strong>${escapeHtml(item.from?.name || 'Unknown')}</strong>
            <div class="card-meta">To: ${escapeHtml(item.to?.name || 'Platform')} | ${escapeHtml(item.ride?.pickup || 'Ride')} to ${escapeHtml(item.ride?.dropoff || 'destination')}</div>
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
    const [users, rides, payments, feedback] = await Promise.all([
      requestJson('/api/auth/users'),
      requestJson('/api/rides/all'),
      requestJson('/api/payments'),
      requestJson('/api/rides/feedback'),
    ]);

    adminState.users = users;
    adminState.rides = rides;
    adminState.payments = payments;
    adminState.feedback = feedback;

    renderSummary();
    renderChart();
    renderUsers();
    renderRides();
    renderPayments();
    renderFeedback();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      redirectToLogin();
      return;
    }

    window.alert(error.message || 'Could not load admin dashboard.');
  } finally {
    setLoading(false);
  }
};

document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('adminSidebar')?.classList.toggle('open');
});

document.querySelector('.sidebar-nav')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-tab-target]');
  if (!button) return;
  setTab(button.dataset.tabTarget);
  document.getElementById('adminSidebar')?.classList.remove('open');
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  redirectToLogin();
});

document.getElementById('refreshDashboardBtn')?.addEventListener('click', loadDashboard);

document.getElementById('userSearch')?.addEventListener('input', renderUsers);
document.getElementById('rideSearch')?.addEventListener('input', renderRides);
document.getElementById('paymentSearch')?.addEventListener('input', renderPayments);
document.getElementById('feedbackSearch')?.addEventListener('input', renderFeedback);

document.getElementById('userTableBody')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-user]');
  if (!button) return;

  const user = adminState.users.find((item) => item._id === button.dataset.deleteUser);
  if (!user) return;

  document.getElementById('deleteUserId').value = user._id;
  document.getElementById('deleteUserName').textContent = `Delete ${user.name} (${user.email}) from the platform?`;
  openModal('deleteUserModal');
});

document.getElementById('rideTableBody')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-assign-ride]');
  const cancelButton = event.target.closest('[data-cancel-ride]');

  if (cancelButton) {
    if (cancelButton.disabled) return;

    requestJson(`/api/rides/cancel/${cancelButton.dataset.cancelRide}`, { method: 'PUT' })
      .then(async () => {
        await loadDashboard();
        setTab('rides');
      })
      .catch((error) => {
        window.alert(error.message || 'Could not cancel ride.');
      });
    return;
  }

  if (!button) return;

  const ride = adminState.rides.find((item) => item._id === button.dataset.assignRide);
  const drivers = adminState.users.filter((user) => user.role === 'driver');
  if (!ride) return;

  document.getElementById('assignRideId').value = ride._id;
  document.getElementById('assignRideLabel').textContent = `${ride.pickup} to ${ride.dropoff}`;
  document.getElementById('assignDriverSelect').innerHTML = drivers.length
    ? drivers
        .map((driver) => `<option value="${escapeHtml(driver._id)}">${escapeHtml(driver.name)} (${escapeHtml(driver.email)})</option>`)
        .join('')
    : '<option value="">No drivers available</option>';

  openModal('assignModal');
});

document.getElementById('confirmAssignBtn')?.addEventListener('click', async () => {
  const rideId = document.getElementById('assignRideId').value;
  const driverId = document.getElementById('assignDriverSelect').value;

  if (!rideId || !driverId) {
    window.alert('Select a driver first.');
    return;
  }

  try {
    await requestJson('/api/rides/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId, driverId }),
    });

    closeModal('assignModal');
    await loadDashboard();
    setTab('rides');
  } catch (error) {
    window.alert(error.message || 'Could not assign driver.');
  }
});

document.getElementById('confirmDeleteUserBtn')?.addEventListener('click', async () => {
  const userId = document.getElementById('deleteUserId').value;
  if (!userId) return;

  try {
    await requestJson(`/api/auth/users/${userId}`, { method: 'DELETE' });
    closeModal('deleteUserModal');
    await loadDashboard();
    setTab('users');
  } catch (error) {
    window.alert(error.message || 'Could not delete user.');
  }
});

document.body.addEventListener('click', (event) => {
  const closeTarget = event.target.closest('[data-close-modal]');
  if (!closeTarget) return;
  closeModal(closeTarget.dataset.closeModal);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal('assignModal');
    closeModal('deleteUserModal');
    document.getElementById('adminSidebar')?.classList.remove('open');
  }
});

setTab('overview');
loadDashboard();
