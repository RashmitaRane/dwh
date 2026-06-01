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
    
    const container = document.querySelector('#inventory-table').parentElement;
    if (!document.getElementById('add-product-btn')) {
        const addBtn = document.createElement('button');
        addBtn.id = 'add-product-btn';
        addBtn.className = 'btn-action btn-success';
        addBtn.style.marginBottom = '15px';
        addBtn.innerHTML = '<i class="ph ph-plus"></i> Add New Product';
        addBtn.onclick = openAddProductModal;
        container.insertBefore(addBtn, document.querySelector('#inventory-table'));
    }

    if (allProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No products in inventory. Add one to get started.</td></tr>';
        return;
    }

    tbody.innerHTML = allProducts.map(p => `
        <tr>
            <td><img src="${p.image_url || p.image}" alt="${p.name}" class="table-img" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"></td>
            <td style="font-weight:500;">${p.name}</td>
            <td>${p.brand}</td>
            <td style="font-weight:600;">₹${parseFloat(p.price).toLocaleString('en-IN')}</td>
            <td>${p.is_bestseller ? '<span class="status-badge" style="background:#111; color:#fff;">Yes</span>' : '<span style="color:#aaa;">No</span>'}</td>
            <td>
                <button onclick="editProduct(${p.id})" class="btn-action btn-outline" style="padding: 6px; margin-right: 5px;"><i class="ph ph-pencil"></i> Edit</button>
                <button onclick="deleteProduct(${p.id})" class="btn-action btn-danger" style="padding: 6px;"><i class="ph ph-trash"></i></button>
            </td>
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

window.deleteProduct = async function(id) {
    if(!confirm("Are you sure you want to delete this product?")) return;
    try {
        const res = await fetch(`/api/staff/products/${id}/delete/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCsrfToken() },
            credentials: 'same-origin'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Action failed.');
        
        alert("Success: " + data.message);
        await loadDashboardData();
    } catch (err) {
        alert("Error: " + err.message);
    }
};

window.openAddProductModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="auth-modal-box admin-box" style="width:400px; max-height: 90vh; overflow-y: auto;">
            <button type="button" class="modal-close" aria-label="Close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            <div class="modal-header"><h2>ADD PRODUCT</h2></div>
            <form id="add-product-form" enctype="multipart/form-data" style="display: flex; flex-direction: column; gap: 12px;">
                <div class="input-group"><input type="text" name="name" placeholder="Product Name" required></div>
                <div class="input-group"><input type="text" name="brand" placeholder="Brand (e.g. HMT)" value="HMT" required></div>
                <div class="input-group"><input type="number" name="price" placeholder="Price" required step="0.01"></div>
                <div class="input-group" style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" name="is_bestseller" id="is_bestseller" style="width:auto;">
                    <label for="is_bestseller" style="color:#333; font-size: 0.9rem;">Mark as Bestseller?</label>
                </div>
                <div class="input-group">
                    <label style="font-size:0.85rem; color:#666; margin-bottom:5px; display:block;">Main Product Image</label>
                    <input type="file" name="image" accept="image/jpeg,image/png,image/webp">
                </div>
                <div class="input-group" style="margin-bottom: 5px;">
                    <label style="font-size:0.85rem; color:#666; margin-bottom:5px; display:block;">Product Gallery Images (Optional)</label>
                    <input type="file" name="gallery_images" accept="image/jpeg,image/png,image/webp" multiple>
                    <span style="font-size:0.75rem; color:#888; display:block; margin-top:4px;">Hold Ctrl/Cmd to select multiple images.</span>
                </div>
                <button type="submit" class="auth-submit-btn admin-btn">Save Product</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('add-product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        formData.set('is_bestseller', e.target.is_bestseller.checked ? 'true' : 'false');
        
        try {
            const res = await fetch('/api/staff/products/add/', {
                method: 'POST',
                headers: { 'X-CSRFToken': getCsrfToken() },
                credentials: 'same-origin',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Action failed.');
            alert("Success: " + data.message);
            modal.remove();
            await loadDashboardData();
        } catch (err) {
            alert("Error: " + err.message);
        }
    });
};

window.editProduct = function(id) {
    const product = allProducts.find(p => p.id === id);
    if (!product) return;

    const safeName = (product.name || '').replace(/"/g, '&quot;');
    const safeBrand = (product.brand || '').replace(/"/g, '&quot;');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="auth-modal-box admin-box" style="width:400px; max-height: 90vh; overflow-y: auto;">
            <button type="button" class="modal-close" aria-label="Close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            <div class="modal-header"><h2>EDIT PRODUCT</h2></div>
            <form id="edit-product-form" enctype="multipart/form-data" style="display: flex; flex-direction: column; gap: 12px;">
                <div class="input-group"><input type="text" name="name" placeholder="Product Name" value="${safeName}" required></div>
                <div class="input-group"><input type="text" name="brand" placeholder="Brand (e.g. HMT)" value="${safeBrand}" required></div>
                <div class="input-group"><input type="number" name="price" placeholder="Price" value="${product.price}" required step="0.01"></div>
                <div class="input-group" style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" name="is_bestseller" id="edit_is_bestseller" style="width:auto;" ${product.is_bestseller ? 'checked' : ''}>
                    <label for="edit_is_bestseller" style="color:#333; font-size: 0.9rem;">Mark as Bestseller?</label>
                </div>
                <div class="input-group">
                    <label style="font-size:0.85rem; color:#666; margin-bottom:5px; display:block;">Update Main Product Image (Leave empty to keep current)</label>
                    <input type="file" name="image" accept="image/jpeg,image/png,image/webp">
                </div>
                <div class="input-group" style="margin-bottom: 5px;">
                    <label style="font-size:0.85rem; color:#666; margin-bottom:5px; display:block;">Add Gallery Images</label>
                    <input type="file" name="gallery_images" accept="image/jpeg,image/png,image/webp" multiple>
                    <span style="font-size:0.75rem; color:#888; display:block; margin-top:4px;">Select additional images to append to the gallery.</span>
                </div>
                <button type="submit" class="auth-submit-btn admin-btn">Update Product</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('edit-product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        formData.set('is_bestseller', e.target.is_bestseller.checked ? 'true' : 'false');
        
        try {
            const res = await fetch(`/api/staff/products/${id}/edit/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCsrfToken() },
                credentials: 'same-origin',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Action failed.');
            alert("Success: " + data.message);
            modal.remove();
            await loadDashboardData();
        } catch (err) {
            alert("Error: " + err.message);
        }
    });
};