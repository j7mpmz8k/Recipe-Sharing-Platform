// public/js/admin-dashboard.js
// Client-side interactions, modal controls, and real-time polling for the Admin Dashboard

const STATUS_DESCRIPTIONS = {
    200: "200 OK - Request succeeded",
    201: "201 Created - Resource created successfully",
    204: "204 No Content - Action succeeded with empty response",
    301: "301 Moved Permanently - Resource has permanently moved",
    302: "302 Found - Temporary redirect to another URL",
    304: "304 Not Modified - Cached copy is fresh",
    400: "400 Bad Request - Malformed request syntax or invalid input",
    401: "401 Unauthorized - Authentication required to access",
    403: "403 Forbidden - Access denied / insufficient permissions",
    404: "404 Not Found - Requested endpoint does not exist",
    405: "405 Method Not Allowed - HTTP method not supported on this endpoint",
    422: "422 Unprocessable Entity - Validation error on submitted data",
    429: "429 Too Many Requests - Rate limit exceeded (client throttled)",
    500: "500 Internal Server Error - Unexpected server-side failure",
    502: "502 Bad Gateway - Reverse proxy received invalid upstream response",
    503: "503 Service Unavailable - Server temporarily down for maintenance or overloaded",
    504: "504 Gateway Timeout - Upstream server timed out"
};

function getStatusHint(code) {
    if (STATUS_DESCRIPTIONS[code]) return STATUS_DESCRIPTIONS[code];
    if (code >= 500) return `${code} Server Error`;
    if (code >= 400) return `${code} Client Error`;
    if (code >= 300) return `${code} Redirect`;
    if (code >= 200) return `${code} Success`;
    return `${code} Status Code`;
}

function openEditUserModal(id, username, firstName, lastName) {
    const modal = document.getElementById('editUserModalBackdrop');
    const form = document.getElementById('editUserForm');
    const title = document.getElementById('editUserModalTitle');
    const uInput = document.getElementById('edit_username');
    const fnInput = document.getElementById('edit_first_name');
    const lnInput = document.getElementById('edit_last_name');

    if (form) form.action = '/admin/users/' + encodeURIComponent(id) + '/edit';
    if (title) title.textContent = 'Edit Profile (User #' + id + ')';
    if (uInput) uInput.value = username || '';
    if (fnInput) fnInput.value = firstName || '';
    if (lnInput) lnInput.value = lastName || '';

    if (modal) modal.style.display = 'flex';
}

function closeEditUserModal() {
    const modal = document.getElementById('editUserModalBackdrop');
    if (modal) modal.style.display = 'none';
}

function copyInviteLink(url, btn) {
    navigator.clipboard.writeText(url).then(() => {
        const orig = btn.innerText;
        btn.innerText = 'Copied!';
        setTimeout(() => { btn.innerText = orig; }, 2000);
    }).catch(() => {
        prompt('Copy this invite link:', url);
    });
}

async function deleteInviteAjax(inviteId, btn) {
    if (!confirm('Are you sure you want to delete this invite?')) return;
    try {
        btn.disabled = true;
        const res = await fetch('/admin/invites/' + encodeURIComponent(inviteId) + '/delete', {
            method: 'POST',
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            const tr = document.getElementById('invite-row-' + inviteId) || btn.closest('tr');
            if (tr) {
                tr.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
                tr.style.opacity = '0';
                tr.style.transform = 'translateX(15px)';
                setTimeout(() => {
                    tr.remove();
                    const tbody = document.getElementById('invites-table-body');
                    const rows = tbody ? tbody.querySelectorAll('tr') : [];
                    if (rows.length === 0) {
                        const wrapper = document.getElementById('invites-table-wrapper');
                        const emptyNotice = document.getElementById('invites-empty-notice');
                        if (wrapper) wrapper.style.display = 'none';
                        if (emptyNotice) emptyNotice.style.display = 'block';
                    }
                    const totalEl = document.getElementById('stat-total-invites');
                    if (totalEl) {
                        const count = parseInt(totalEl.textContent, 10);
                        if (!isNaN(count) && count > 0) totalEl.textContent = count - 1;
                    }
                }, 250);
            }
        } else {
            alert('Could not delete invite.');
            btn.disabled = false;
        }
    } catch (e) {
        console.error('Failed to delete invite:', e);
        btn.disabled = false;
    }
}

// Refresh all admin dashboard data in real-time
async function refreshAdminDashboard() {
    try {
        const res = await fetch('/admin/api/dashboard');
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success) return;

        // 1. Metric counters
        const totalUsersEl = document.getElementById('stat-total-users');
        if (totalUsersEl && typeof data.totalUsers === 'number') totalUsersEl.textContent = data.totalUsers;

        const onlineCountEl = document.getElementById('stat-online-count');
        if (onlineCountEl && typeof data.onlineCount === 'number') onlineCountEl.textContent = data.onlineCount;

        const onlineUsersEl = document.getElementById('stat-online-users');
        if (onlineUsersEl && typeof data.onlineUsersCount === 'number') onlineUsersEl.textContent = data.onlineUsersCount;

        const activeGuestsEl = document.getElementById('stat-active-guests');
        if (activeGuestsEl && typeof data.activeGuestsCount === 'number') activeGuestsEl.textContent = data.activeGuestsCount;

        const rateLimitedEl = document.getElementById('stat-rate-limited');
        if (rateLimitedEl && typeof data.rateLimitedCount === 'number') rateLimitedEl.textContent = data.rateLimitedCount;

        const totalInvitesEl = document.getElementById('stat-total-invites');
        if (totalInvitesEl && typeof data.totalInvites === 'number') totalInvitesEl.textContent = data.totalInvites;

        // Header online counter
        const headerOnlineEl = document.getElementById('online-count-text');
        if (headerOnlineEl && typeof data.onlineCount === 'number') {
            headerOnlineEl.textContent = data.onlineCount + ' online';
        }

        // 2. Community Members status & last active
        if (Array.isArray(data.users)) {
            data.users.forEach(u => {
                const statusCell = document.getElementById('user-status-' + u.id);
                if (statusCell) {
                    if (u.isBlocked) {
                        statusCell.innerHTML = '<span style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.775rem; font-weight: 700; background: #fee2e2; color: #991b1b;"><span style="width: 6px; height: 6px; background: #ef4444; border-radius: 50%;"></span>Suspended</span>';
                    } else if (u.isOnline) {
                        statusCell.innerHTML = '<span style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.775rem; font-weight: 600; background: #def7ec; color: #03543f;"><span style="width: 6px; height: 6px; background: #22c55e; border-radius: 50%;"></span>Online now</span>';
                    } else {
                        statusCell.innerHTML = '<span style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.775rem; font-weight: 500; background: #f3f4f6; color: #6b7280;"><span style="width: 6px; height: 6px; background: #9ca3af; border-radius: 50%;"></span>Offline</span>';
                    }
                }
                const lastOnlineCell = document.getElementById('user-lastonline-' + u.id);
                if (lastOnlineCell && u.lastOnline) {
                    lastOnlineCell.textContent = u.lastOnline;
                }
            });
        }

        // 3. Active Guests table
        const guestsBadge = document.getElementById('active-guests-badge');
        if (guestsBadge && typeof data.activeGuestsCount === 'number') {
            guestsBadge.textContent = data.activeGuestsCount + ' Online (Last 3 Mins)';
        }
        const guestsTbody = document.getElementById('guests-table-body');
        if (guestsTbody && Array.isArray(data.guests)) {
            if (data.guests.length === 0) {
                guestsTbody.innerHTML = '<tr><td colspan="4" style="padding: 1rem; color: var(--text-muted);">No anonymous guest visitors active in the last 3 minutes.</td></tr>';
            } else {
                guestsTbody.innerHTML = data.guests.map(g => `
                    <tr style="border-bottom: 1px solid var(--card-border, #edf2f7);">
                        <td style="padding: 0.7rem 0.5rem; font-family: monospace; font-weight: 600; color: #1e40af;">${g.ip}</td>
                        <td style="padding: 0.7rem 0.5rem; color: #16a34a; font-weight: 500;">● ${g.lastSeen}</td>
                        <td style="padding: 0.7rem 0.5rem; color: var(--text-secondary); font-family: monospace; font-size: 0.85rem;">${g.lastPath}</td>
                        <td style="padding: 0.7rem 0.5rem; color: var(--text-muted);">${g.device}</td>
                    </tr>
                `).join('');
            }
        }

        // 4. Live Logs table
        const logsBadge = document.getElementById('log-count-badge');
        if (logsBadge && Array.isArray(data.logs)) {
            logsBadge.textContent = 'Latest ' + data.logs.length + ' Requests';
        }
        const logsTbody = document.getElementById('logs-table-body');
        if (logsTbody && Array.isArray(data.logs)) {
            if (data.logs.length === 0) {
                logsTbody.innerHTML = '<tr><td colspan="7" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No requests recorded yet.</td></tr>';
            } else {
                logsTbody.innerHTML = data.logs.map(log => {
                    let statusStyle = 'background: #def7ec; color: #03543f;';
                    let methodColor = '#16a34a';
                    if (log.isRedirect) { statusStyle = 'background: #e1effe; color: #1e429f;'; methodColor = '#2563eb'; }
                    else if (log.isClientError) { statusStyle = 'background: #fef3c7; color: #92400e;'; methodColor = '#d97706'; }
                    else if (log.isServerError) { statusStyle = 'background: #fee2e2; color: #991b1b;'; methodColor = '#dc2626'; }

                    const userHtml = log.isUser 
                        ? `<span style="background: #e0f2fe; color: #0369a1; padding: 0.15rem 0.45rem; border-radius: 4px; font-weight: 600;">${log.user}</span>`
                        : `<span style="color: var(--text-muted);">guest</span>`;

                    const statusHint = log.statusHint || getStatusHint(log.status);

                    return `
                        <tr style="border-bottom: 1px solid var(--card-border, #edf2f7); font-family: monospace;">
                            <td style="padding: 0.5rem 0.65rem; color: var(--text-muted); white-space: nowrap;">${log.time}</td>
                            <td style="padding: 0.5rem 0.65rem; color: #1e40af; font-weight: 600; white-space: nowrap;">${log.ip}</td>
                            <td style="padding: 0.5rem 0.65rem; white-space: nowrap;">${userHtml}</td>
                            <td style="padding: 0.5rem 0.65rem; font-weight: 700;"><span style="color: ${methodColor};">${log.method}</span></td>
                            <td style="padding: 0.5rem 0.65rem; color: var(--text-primary); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${log.path}</td>
                            <td style="padding: 0.5rem 0.65rem; white-space: nowrap;">
                                <span title="${statusHint}" style="cursor: help; display: inline-block; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 700; font-size: 0.775rem; ${statusStyle}">${log.status}</span>
                            </td>
                            <td style="padding: 0.5rem 0.65rem; text-align: right; color: var(--text-muted); white-space: nowrap;">${log.duration}</td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // 5. Invites table (unaccepted at top, accepted at bottom)
        const invitesTbody = document.getElementById('invites-table-body');
        const invitesWrapper = document.getElementById('invites-table-wrapper');
        const invitesEmpty = document.getElementById('invites-empty-notice');
        if (invitesTbody && Array.isArray(data.invites)) {
            if (data.invites.length === 0) {
                if (invitesWrapper) invitesWrapper.style.display = 'none';
                if (invitesEmpty) invitesEmpty.style.display = 'block';
            } else {
                if (invitesWrapper) invitesWrapper.style.display = 'block';
                if (invitesEmpty) invitesEmpty.style.display = 'none';
                invitesTbody.innerHTML = data.invites.map(inv => {
                    let statusBadgeStyle = 'background: #def7ec; color: #03543f;';
                    if (inv.isAccepted) statusBadgeStyle = 'background: #e1effe; color: #1e429f;';
                    else if (inv.isExpired) statusBadgeStyle = 'background: #fde8e8; color: #9b1c1c;';

                    let acceptedHtml = '<span style="color: var(--text-muted);">-</span>';
                    if (inv.acceptedBy) {
                        acceptedHtml = `<div>${inv.acceptedBy}</div>`;
                        if (inv.acceptedAt) {
                            acceptedHtml += `<div style="font-size: 0.775rem; color: var(--text-muted); margin-top: 0.15rem;">${inv.acceptedAt}</div>`;
                        }
                    }

                    const copyBtn = inv.isUsable ? `
                        <button type="button" class="btn btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.775rem; font-weight: 600;" onclick="copyInviteLink('${window.location.origin}/register?token=${inv.token}', this)" title="Copy registration link">📋 Copy</button>
                    ` : '';

                    return `
                        <tr id="invite-row-${inv.id}" style="border-bottom: 1px solid var(--card-border, #edf2f7);">
                            <td style="padding: 0.65rem 0.5rem; font-weight: 600;">${inv.name}</td>
                            <td style="padding: 0.65rem 0.5rem;">
                                <span style="display: inline-block; padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.75rem; font-weight: 600; ${statusBadgeStyle}">
                                    ${inv.status}
                                </span>
                            </td>
                            <td style="padding: 0.65rem 0.5rem; color: var(--text-secondary);">${acceptedHtml}</td>
                            <td style="padding: 0.65rem 0.5rem; color: var(--text-muted);">${inv.createdAt}</td>
                            <td style="padding: 0.65rem 0.5rem; color: var(--text-muted);">${inv.expiresAt}</td>
                            <td style="padding: 0.65rem 0.5rem; text-align: right;">
                                <div style="display: inline-flex; gap: 0.5rem; align-items: center; justify-content: flex-end;">
                                    ${copyBtn}
                                    <button type="button" class="btn-text" style="color: #e53e3e; font-size: 0.8rem; background: none; border: none; cursor: pointer; padding: 0.35rem 0.5rem;" title="Delete this invite" onclick="deleteInviteAjax(${inv.id}, this)">🗑️ Delete</button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.error('Error refreshing admin dashboard:', err);
    }
}

// Manual refresh button alias for live logs
function refreshAdminLogs() {
    refreshAdminDashboard();
}

function initAdminDashboard() {
    // Close modal when clicking outside dialog container
    const modalBackdrop = document.getElementById('editUserModalBackdrop');
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', function(e) {
            if (e.target === this) {
                closeEditUserModal();
            }
        });
    }

    // Intercept invite creation form submission to avoid full-page reload or jump
    const inviteForm = document.getElementById('createInviteForm');
    if (inviteForm) {
        inviteForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const input = document.getElementById('inviteNameInput');
            const submitBtn = document.getElementById('generateInviteBtn');
            const nameVal = input ? input.value : '';

            try {
                submitBtn.disabled = true;
                submitBtn.innerText = '⏳ Generating...';

                const res = await fetch('/admin/invites', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ name: nameVal })
                });

                if (!res.ok) throw new Error('Server returned ' + res.status);
                const data = await res.json();
                if (!data.success) throw new Error(data.error || 'Failed');

                // Auto-copy to clipboard
                if (data.inviteUrl) {
                    navigator.clipboard.writeText(data.inviteUrl).catch(() => {});
                }

                // Show inline confirmation alert inside #invites container
                const alertBox = document.getElementById('invite-ajax-alert');
                if (alertBox) {
                    alertBox.innerHTML = `
                        <div class="alert alert-success" style="padding: 1.15rem 1.25rem; border-radius: 8px;">
                            <p style="font-weight: 600; margin-bottom: 0.5rem;">✉️ Link generated &amp; copied to clipboard!</p>
                            <div>
                                <label style="display: block; font-size: 0.85rem; margin-bottom: 0.35rem; color: var(--text-secondary);">
                                    Share this unique registration link with your invited guest:
                                </label>
                                <div style="display: flex; gap: 0.5rem; align-items: center;">
                                    <input 
                                        type="text" 
                                        value="${data.inviteUrl}" 
                                        readonly 
                                        style="flex: 1; padding: 0.65rem 0.75rem; font-family: monospace; font-size: 0.9rem; border-radius: 6px; border: 1px solid var(--input-border, #cbd5e0); background: #ffffff;"
                                    >
                                    <button 
                                        type="button" 
                                        class="btn btn-primary" 
                                        onclick="navigator.clipboard.writeText('${data.inviteUrl}'); const b = this; b.innerText = 'Copied!'; setTimeout(() => { b.innerText = '📋 Copy Link'; }, 2000);"
                                        style="white-space: nowrap; padding: 0.65rem 1rem;"
                                    >
                                        📋 Copy Link
                                    </button>
                                </div>
                                <small style="display: block; margin-top: 0.5rem; color: var(--text-muted); font-size: 0.825rem;">
                                    ⏳ This invite link expires in 48 hours and becomes invalid once an account is registered.
                                </small>
                            </div>
                        </div>
                    `;
                    alertBox.style.display = 'block';
                }

                // Clear name input
                if (input) input.value = '';

                // Update Total Invites count card
                const totalEl = document.getElementById('stat-total-invites');
                if (totalEl) {
                    const count = parseInt(totalEl.textContent, 10);
                    if (!isNaN(count)) totalEl.textContent = count + 1;
                }

                // Show table wrapper, hide empty notice
                const wrapper = document.getElementById('invites-table-wrapper');
                const emptyNotice = document.getElementById('invites-empty-notice');
                if (wrapper) wrapper.style.display = 'block';
                if (emptyNotice) emptyNotice.style.display = 'none';

                // Prepend new row to table
                const tbody = document.getElementById('invites-table-body');
                if (tbody && data.invite) {
                    const inv = data.invite;
                    const tr = document.createElement('tr');
                    tr.id = 'invite-row-' + inv.id;
                    tr.style.borderBottom = '1px solid var(--card-border, #edf2f7)';
                    tr.style.backgroundColor = '#f0fdf4';
                    tr.innerHTML = `
                        <td style="padding: 0.65rem 0.5rem; font-weight: 600;">${inv.name}</td>
                        <td style="padding: 0.65rem 0.5rem;">
                            <span style="display: inline-block; padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.75rem; font-weight: 600; background: #def7ec; color: #03543f;">Active</span>
                        </td>
                        <td style="padding: 0.65rem 0.5rem; color: var(--text-secondary);"><span style="color: var(--text-muted);">-</span></td>
                        <td style="padding: 0.65rem 0.5rem; color: var(--text-muted);">${inv.createdAt}</td>
                        <td style="padding: 0.65rem 0.5rem; color: var(--text-muted);">${inv.expiresAt}</td>
                        <td style="padding: 0.65rem 0.5rem; text-align: right;">
                            <div style="display: inline-flex; gap: 0.5rem; align-items: center; justify-content: flex-end;">
                                <button type="button" class="btn btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.775rem; font-weight: 600;" onclick="copyInviteLink('${data.inviteUrl}', this)">📋 Copy</button>
                                <button type="button" class="btn-text" style="color: #e53e3e; font-size: 0.8rem; background: none; border: none; cursor: pointer; padding: 0.35rem 0.5rem;" onclick="deleteInviteAjax(${inv.id}, this)">🗑️ Delete</button>
                            </div>
                        </td>
                    `;
                    tbody.prepend(tr);
                    setTimeout(() => {
                        tr.style.transition = 'background-color 1s ease';
                        tr.style.backgroundColor = 'transparent';
                    }, 2000);
                }
            } catch (err) {
                console.error('Invite generation error:', err);
                alert('Failed to generate invite link. Please try again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = '➕ Generate Invite Link';
            }
        });
    }

    // Start recurring poller every 10 seconds
    setInterval(refreshAdminDashboard, 10000);
}

// Auto-initialize once DOM content is parsed
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminDashboard);
} else {
    initAdminDashboard();
}

// Ensure global functions are accessible to inline HTML onclick handlers
window.openEditUserModal = openEditUserModal;
window.closeEditUserModal = closeEditUserModal;
window.copyInviteLink = copyInviteLink;
window.deleteInviteAjax = deleteInviteAjax;
window.refreshAdminDashboard = refreshAdminDashboard;
window.refreshAdminLogs = refreshAdminLogs;
