document.addEventListener('DOMContentLoaded', async () => {
    // Basic Auth Check
    const res = await fetch('/api/check-auth/', { credentials: 'same-origin' });
    if (res.ok) {
        const auth = await res.json();
        if (!auth.is_staff && !auth.is_admin) {
            window.location.href = '/catalog.html';
            return;
        }
    }
    
    // Load all data on boot
    await loadDashboardData();
});

// --- UI NAVIGATION ---
window.switchView = function(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sidebar-menu a').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`view-${viewId}`).classList.add('active');
    document.querySelector(`[data-view="${viewId}"]`).classList.add('active');
    
    const titles = { 'dashboard': 'Dashboard Overview', 'orders': 'Order Management', 'inventory': 'Stock & Inventory' };
    document.getElementById('topbar-title').innerText = titles[viewId];
};

function getCsrfToken() {
    const parts = (`; ${document.cookie}`).split('; csrftoken=');
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
}

// --- DATA FETCHING & MATH ---
let allOrders = [];
let allProducts = [];

async function loadDashboardData() {
    try {
        const [ordersRes, productsRes] = await Promise.all([
            fetch('/api/staff/orders/', { credentials: 'same-origin' }),
            fetch('/api/products/')
        ]);
        
        const ordersData = await ordersRes.json();
        const productsData = await productsRes.json();

        allOrders = ordersData.orders || [];
        allProducts = productsData.products || [];

        calculateMetrics();
        renderRecentOrders();
        renderAllOrders();
        renderInventory();
    } catch (err) {
        console.error("Failed to load dashboard data", err);
    }
}

function calculateMetrics() {
    let revenue = 0;
    let pending = 0;

    allOrders.forEach(o => {
        // Only count CONFIRMED orders as actual Profit/Revenue
        if (o.status === 'confirmed') revenue += parseFloat(o.total_amount);
        if (o.status === 'awaiting_confirmation') pending++;
    });

    document.getElementById('metric-revenue').innerText = `₹${revenue.toLocaleString('en-IN')}`;
    document.getElementById('metric-orders').innerText = allOrders.length;
    document.getElementById('metric-pending').innerText = pending;
    document.getElementById('metric-products').innerText = allProducts.length;

    const badge = document.getElementById('sidebar-pending-badge');
    if(pending > 0) {
        badge.style.display = 'inline-block';
        badge.innerText = pending;
    } else {
        badge.style.display = 'none';
    }
}

// --- TABLE RENDERING ---
function getStatusBadge(status) {
    if (status === 'confirmed') return '<span class="status-badge status-confirmed">Confirmed</span>';
    if (status === 'rejected') return '<span class="status-badge status-rejected">Rejected</span>';
    return '<span class="status-badge status-awaiting">Awaiting</span>';
}

function renderRecentOrders() {
    const tbody = document.querySelector('#recent-orders-table tbody');
    const recent = allOrders.slice(0, 5); // Just the top 5
    
    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No recent orders found.</td></tr>';
        return;
    }

    tbody.innerHTML = recent.map(o => `
        <tr>
            <td><strong>${o.order_number}</strong></td>
            <td>${o.address.first_name} ${o.address.last_name}</td>
            <td>${o.created_at}</td>
            <td style="font-weight:600;">₹${parseFloat(o.total_amount).toLocaleString('en-IN')}</td>
            <td>${getStatusBadge(o.status)}</td>
        </tr>
    `).join('');
}

function renderAllOrders() {
    const tbody = document.querySelector('#all-orders-table tbody');
    
    if (allOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No orders found.</td></tr>';
        return;
    }

    tbody.innerHTML = allOrders.map(o => {
        const itemString = (o.items || []).map(i => `${i.quantity}x ${i.name}`).join('<br>');
        
        let actions = `<a href="${o.payment_proof_url}" target="_blank" class="btn-action btn-outline" style="padding: 6px;"><i class="ph ph-file-pdf"></i> PDF</a>`;
        
        if (o.status === 'awaiting_confirmation') {
            actions += `
                <button onclick="confirmOrder('${o.id}')" class="btn-action btn-success" style="padding: 6px; margin-left: 5px;"><i class="ph ph-check"></i></button>
                <button onclick="rejectOrder('${o.id}')" class="btn-action btn-danger" style="padding: 6px; margin-left: 5px;"><i class="ph ph-x"></i></button>
            `;
        }
        
        return `
        <tr>
            <td><strong>${o.order_number}</strong><br><span style="font-size:0.8rem; color:#888;">${o.created_at}</span></td>
            <td>
                ${o.address.first_name} ${o.address.last_name}<br>
                <span style="font-size:0.8rem; color:#666;"><i class="ph ph-phone"></i> ${o.address.phone}</span>
            </td>
            <td style="font-size:0.85rem; line-height:1.4;">${itemString}</td>
            <td style="font-weight:600;">₹${parseFloat(o.total_amount).toLocaleString('en-IN')}</td>
            <td>${getStatusBadge(o.status)}</td>
            <td style="white-space: nowrap;">${actions}</td>
        </tr>
        `;
    }).join('');
}

function renderInventory() {
    const tbody = document.querySelector('#inventory-table tbody');
    
    if (allProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No products in inventory. Add one to get started.</td></tr>';
        return;
    }

    tbody.innerHTML = allProducts.map(p => `
        <tr>
            <td><img src="${p.image_url || p.image}" alt="${p.name}" class="table-img"></td>
            <td style="font-weight:500;">${p.name}</td>
            <td>${p.brand}</td>
            <td style="font-weight:600;">₹${parseFloat(p.price).toLocaleString('en-IN')}</td>
            <td>${p.is_bestseller ? '<span class="status-badge" style="background:#111; color:#fff;">Yes</span>' : '<span style="color:#aaa;">No</span>'}</td>
        </tr>
    `).join('');
}

// --- ADMIN ACTIONS ---
window.confirmOrder = async function(id) {
    if(!confirm("Are you sure you want to CONFIRM this order? This will email the customer.")) return;
    await actOnOrder(id, 'confirm');
};

window.rejectOrder = async function(id) {
    const note = prompt("Reason for rejection (this will be emailed to the customer):");
    if (note === null) return; 
    await actOnOrder(id, 'reject', note);
};

async function actOnOrder(id, action, note = '') {
    const url = action === 'confirm' ? `/api/staff/orders/${id}/confirm/` : `/api/staff/orders/${id}/reject/`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
            credentials: 'same-origin',
            body: JSON.stringify({ admin_note: note }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Action failed.');
        
        alert("Success: " + data.message);
        await loadDashboardData(); // Refresh all tables and profit metrics instantly
    } catch (err) {
        alert("Error: " + err.message);
    }
}