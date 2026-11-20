/* =========================================================
   Lucky Foods – dynamic menu, cart & WhatsApp ordering
   To change the menu, prices or WhatsApp number, edit CONFIG
   and MENU below – the page rebuilds itself automatically.
   ========================================================= */

const CONFIG = {
    whatsappNumber: '256779671678',   // international format, no "+" or spaces
    currency: 'UGX',
    openHour: 7,                      // 7:00 AM
    closeHour: 22,                    // 10:00 PM
    timeZone: 'Africa/Kampala',
    fallbackImage: 'images/default.jpg'
};

const CATEGORIES = [
    { id: 'all',    label: 'All' },
    { id: 'mains',  label: '🍛 Main Meals' },
    { id: 'fresh',  label: '🥗 Fresh & Salads' },
    { id: 'drinks', label: '🥤 Drinks' }
];

const MENU = [
    { id: 'katogo',  category: 'mains',  name: 'Katogo',        price: 7000, img: 'images/katogo.jpg',  tag: 'Popular',
      desc: 'Katogo served with creamy beans, slow-cooked for rich flavor and authentic taste.' },
    { id: 'pilau',   category: 'mains',  name: 'Pilau',         price: 8000, img: 'images/pilau.jpg',   tag: "Chef's pick",
      desc: 'Fragrant spiced rice cooked with tender beef and traditional East African spices.' },
    { id: 'matooke', category: 'mains',  name: 'Matooke',       price: 3000, img: 'images/matooke.jpg',
      desc: 'Soft, steamed mashed plantain prepared the traditional Ugandan way.' },
    { id: 'carrots', category: 'fresh',  name: 'Fresh Carrots', price: 1500, img: 'images/carrot.jpg',
      desc: 'Bright, sweet, and crunchy shredded carrots lightly dressed for a refreshing taste.' },
    { id: 'greenz',  category: 'fresh',  name: 'Greenz Salad',  price: 1000, img: 'images/greenz.jpg',
      desc: 'Vibrant mix of fresh leafy greens, washed and served crisp for a healthy meal.' },
    { id: 'cabbage', category: 'fresh',  name: 'Fresh Cabbage', price: 1200, img: 'images/cabbage.jpg',
      desc: 'Freshly shredded cabbage mixed with light vegetables for a crisp, refreshing taste.' },
    { id: 'soda',    category: 'drinks', name: 'Ice Cold Soda', price: 5000, img: 'images/soda.jpg',
      desc: 'Nice and fresh ice cold soda to quench your thirst.' },
    { id: 'water',   category: 'drinks', name: 'Pure Water',    price: 2000, img: 'images/water.jpg',
      desc: 'Pure bottled water in big and small sizes, served cold to keep you refreshed.' },
    { id: 'juice',   category: 'drinks', name: 'Tropical Juice', price: 9000, img: 'images/juice.jpg', tag: 'Fresh',
      desc: 'Tropical fruit juice bursting with natural flavor, served chilled.' }
];

/* ---------- Safe storage (works even if localStorage is blocked) ---------- */
const store = {
    get(key, fallback) {
        try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
        catch { return fallback; }
    },
    set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
    },
    remove(key) {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
};

/* ---------- State ---------- */
const menuById = Object.fromEntries(MENU.map(item => [item.id, item]));
// cart is stored as { itemId: qty }; prices always come from MENU so they stay current
let cart = sanitizeCart(store.get('luckyFoodsCart_v2', {}));
let activeCategory = 'all';
let searchTerm = '';
let orderType = 'delivery';

function sanitizeCart(raw) {
    const clean = {};
    if (raw && typeof raw === 'object') {
        for (const [id, qty] of Object.entries(raw)) {
            if (menuById[id] && Number.isInteger(qty) && qty > 0) clean[id] = Math.min(qty, 99);
        }
    }
    return clean;
}

/* ---------- Helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const formatPrice = (n) => `${CONFIG.currency} ${Number(n).toLocaleString('en-US')}`;
const escapeHTML = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const waLink = (text) => `https://wa.me/${CONFIG.whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

function cartLines() {
    return Object.entries(cart).map(([id, qty]) => ({ ...menuById[id], qty, lineTotal: menuById[id].price * qty }));
}
function cartTotals() {
    const lines = cartLines();
    return {
        lines,
        count: lines.reduce((s, l) => s + l.qty, 0),
        total: lines.reduce((s, l) => s + l.lineTotal, 0)
    };
}

let toastTimer;
function showToast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

/* ---------- Opening hours ---------- */
function kampalaNow() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: CONFIG.timeZone, hour: 'numeric', minute: 'numeric', hour12: false })
        .formatToParts(new Date());
    const get = (type) => Number(parts.find(p => p.type === type)?.value || 0);
    return { hour: get('hour') % 24, minute: get('minute') };
}
function isOpen() {
    const { hour } = kampalaNow();
    return hour >= CONFIG.openHour && hour < CONFIG.closeHour;
}
function renderOpenStatus() {
    const pill = $('#openStatus');
    const open = isOpen();
    pill.classList.toggle('open', open);
    pill.classList.toggle('closed', !open);
    pill.textContent = open ? 'Open now · orders go out today' : 'Closed now · order for tomorrow from 7 AM';
}

/* ---------- Menu rendering ---------- */
function renderFilters() {
    $('#filters').innerHTML = CATEGORIES.map(cat => {
        const count = cat.id === 'all' ? MENU.length : MENU.filter(m => m.category === cat.id).length;
        return `<button class="filter ${cat.id === activeCategory ? 'active' : ''}" data-cat="${cat.id}" role="tab"
                    aria-selected="${cat.id === activeCategory}">${cat.label}<small>${count}</small></button>`;
    }).join('');
}

function itemControls(item) {
    const qty = cart[item.id] || 0;
    if (!qty) return `<button class="add-btn" data-action="add" data-id="${item.id}">Add 🛒</button>`;
    return `<div class="stepper">
                <button data-action="dec" data-id="${item.id}" aria-label="Remove one ${escapeHTML(item.name)}">−</button>
                <span>${qty}</span>
                <button data-action="inc" data-id="${item.id}" aria-label="Add one ${escapeHTML(item.name)}">+</button>
            </div>`;
}

function renderMenu() {
    const term = searchTerm.toLowerCase();
    // Searching looks across the whole menu; otherwise show the chosen category
    const items = MENU.filter(m => term
        ? m.name.toLowerCase().includes(term) || m.desc.toLowerCase().includes(term)
        : activeCategory === 'all' || m.category === activeCategory
    );

    $('#menuGrid').innerHTML = items.map((item, i) => `
        <article class="card" style="animation-delay:${i * 40}ms">
            <div class="card-img">
                <img src="${item.img}" alt="${escapeHTML(item.name)}" loading="lazy" onerror="this.onerror=null;this.src='${CONFIG.fallbackImage}'">
                ${item.tag ? `<span class="tag ${item.tag === 'Popular' ? 'hot' : ''}">${escapeHTML(item.tag)}</span>` : ''}
            </div>
            <div class="card-body">
                <h3>${escapeHTML(item.name)}</h3>
                <p>${escapeHTML(item.desc)}</p>
                <div class="card-foot">
                    <span class="price">${formatPrice(item.price)}</span>
                    <span class="controls" data-controls="${item.id}">${itemControls(item)}</span>
                </div>
            </div>
        </article>`).join('');

    $('#noResults').hidden = items.length > 0;
}

// Update only the buttons on cards (avoids re-animating the whole grid)
function refreshCardControls() {
    document.querySelectorAll('[data-controls]').forEach(el => {
        el.innerHTML = itemControls(menuById[el.dataset.controls]);
    });
}

/* ---------- Cart ---------- */
function setQty(id, qty) {
    if (!menuById[id]) return;
    if (qty <= 0) delete cart[id];
    else cart[id] = Math.min(qty, 99);
    store.set('luckyFoodsCart_v2', cart);
    renderCart();
    refreshCardControls();
}

function addToCart(id) {
    setQty(id, (cart[id] || 0) + 1);
    showToast(`${menuById[id].name} added to cart`);
    const btn = $('#cartBtn');
    btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
}

function renderCart() {
    const { lines, count, total } = cartTotals();
    $('#cartCount').textContent = count;
    $('#cartItemsCount').textContent = count;
    $('#cartTotal').textContent = formatPrice(total);
    $('#checkoutBtn').disabled = count === 0;
    $('#clearCart').hidden = count === 0;

    if (!lines.length) {
        $('#cartItems').innerHTML = `<div class="cart-empty"><div>🍽️</div><p>Your cart is empty</p><p><small>Add some delicious food!</small></p></div>`;
        return;
    }
    $('#cartItems').innerHTML = lines.map(l => `
        <div class="cart-line">
            <img src="${l.img}" alt="${escapeHTML(l.name)}" onerror="this.onerror=null;this.src='${CONFIG.fallbackImage}'">
            <div class="cart-line-info">
                <h4>${escapeHTML(l.name)}</h4>
                <div class="sub">${formatPrice(l.price)} each</div>
                <div class="stepper">
                    <button data-action="dec" data-id="${l.id}" aria-label="Remove one">−</button>
                    <span>${l.qty}</span>
                    <button data-action="inc" data-id="${l.id}" aria-label="Add one">+</button>
                </div>
            </div>
            <div style="text-align:right">
                <div class="line-total">${formatPrice(l.lineTotal)}</div>
                <button class="remove" data-action="remove" data-id="${l.id}" title="Remove ${escapeHTML(l.name)}">🗑️</button>
            </div>
        </div>`).join('');
}

/* ---------- Drawer & modal ---------- */
function openCart() {
    $('#cartDrawer').classList.add('open');
    $('#cartDrawer').setAttribute('aria-hidden', 'false');
    $('#overlay').classList.add('open');
    document.body.classList.add('no-scroll');
}
function closeCart() {
    $('#cartDrawer').classList.remove('open');
    $('#cartDrawer').setAttribute('aria-hidden', 'true');
    $('#overlay').classList.remove('open');
    document.body.classList.remove('no-scroll');
}

function openCheckout() {
    const { lines, total } = cartTotals();
    if (!lines.length) return;
    $('#orderSummary').innerHTML =
        lines.map(l => `<div class="row"><span>${escapeHTML(l.name)} × ${l.qty}</span><span>${formatPrice(l.lineTotal)}</span></div>`).join('') +
        `<div class="row total"><span>Total</span><span>${formatPrice(total)}</span></div>`;

    // Restore saved customer details
    const saved = store.get('luckyFoodsCustomer', null);
    if (saved) {
        $('#customerName').value ||= saved.name || '';
        $('#customerPhone').value ||= saved.phone || '';
        $('#customerAddress').value ||= saved.address || '';
        if (saved.orderType) setOrderType(saved.orderType);
    }
    closeCart();
    $('#checkoutModal').classList.add('open');
    $('#checkoutModal').setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    setTimeout(() => $('#customerName').focus(), 50);
}
function closeCheckout() {
    $('#checkoutModal').classList.remove('open');
    $('#checkoutModal').setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
}

function setOrderType(type) {
    orderType = type === 'pickup' ? 'pickup' : 'delivery';
    document.querySelectorAll('#orderType .seg').forEach(b => b.classList.toggle('active', b.dataset.type === orderType));
    $('#addressField').hidden = orderType === 'pickup';
}

/* ---------- Validation & WhatsApp ---------- */
function setError(id, msg) {
    const field = document.getElementById(id).closest('.field');
    field.classList.toggle('invalid', !!msg);
    field.querySelector('.error').textContent = msg || '';
    return !msg;
}

function validate() {
    const name = $('#customerName').value.trim();
    const phone = $('#customerPhone').value.trim();
    const address = $('#customerAddress').value.trim();
    const digits = phone.replace(/\D/g, '');

    const ok = [
        setError('customerName', name.length < 2 ? 'Please enter your name.' : ''),
        setError('customerPhone', digits.length < 9 || digits.length > 15 ? 'Please enter a valid phone number.' : ''),
        setError('customerAddress', orderType === 'delivery' && address.length < 4 ? 'Please enter your delivery address.' : '')
    ].every(Boolean);

    if (!ok) document.querySelector('.field.invalid input, .field.invalid textarea')?.focus();
    return ok;
}

function buildOrderMessage(orderId) {
    const { lines, total } = cartTotals();
    const name = $('#customerName').value.trim();
    const phone = $('#customerPhone').value.trim();
    const address = $('#customerAddress').value.trim();
    const notes = $('#orderNotes').value.trim();
    const when = $('#orderTime').value;

    let msg = `🍀 *NEW ORDER - LUCKY FOODS*\n`;
    msg += `🧾 *Order #:* ${orderId}\n\n`;
    msg += `👤 *Customer:* ${name}\n`;
    msg += `📞 *Phone:* ${phone}\n`;
    msg += `${orderType === 'delivery' ? '🛵' : '🏪'} *Type:* ${orderType === 'delivery' ? 'Delivery' : 'Pickup'}\n`;
    if (orderType === 'delivery') msg += `📍 *Address:* ${address}\n`;
    msg += `⏰ *When:* ${when}\n`;
    msg += `\n📋 *ORDER DETAILS:*\n`;
    lines.forEach(l => { msg += `• ${l.name} × ${l.qty} = ${formatPrice(l.lineTotal)}\n`; });
    msg += `\n💰 *TOTAL: ${formatPrice(total)}*\n`;
    if (notes) msg += `\n📝 *Notes:* ${notes}\n`;
    msg += `\n✅ Please confirm my order. Thank you!`;
    return msg;
}

function makeOrderId() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `LF-${pad(d.getMonth() + 1)}${pad(d.getDate())}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function submitOrder(e) {
    e.preventDefault();
    if (!cartTotals().count) { showToast('Your cart is empty'); return; }
    if (!validate()) return;

    const orderId = makeOrderId();
    const url = waLink(buildOrderMessage(orderId));

    if ($('#rememberMe').checked) {
        store.set('luckyFoodsCustomer', {
            name: $('#customerName').value.trim(),
            phone: $('#customerPhone').value.trim(),
            address: $('#customerAddress').value.trim(),
            orderType
        });
    } else {
        store.remove('luckyFoodsCustomer');
    }

    // Open WhatsApp (new tab on desktop; the WhatsApp app on phones).
    const win = window.open(url, '_blank');
    if (!win) window.location.href = url;   // popup blocked → navigate directly

    cart = {};
    store.set('luckyFoodsCart_v2', cart);
    renderCart();
    refreshCardControls();
    $('#orderNotes').value = '';
    closeCheckout();
    showToast(`Order ${orderId} ready – tap Send in WhatsApp 📱`);
}

/* ---------- Events ---------- */
function bindEvents() {
    // Category filter
    $('#filters').addEventListener('click', (e) => {
        const btn = e.target.closest('.filter');
        if (!btn) return;
        activeCategory = btn.dataset.cat;
        renderFilters();
        renderMenu();
    });

    // Search (debounced)
    let t;
    $('#searchInput').addEventListener('input', (e) => {
        clearTimeout(t);
        t = setTimeout(() => { searchTerm = e.target.value.trim(); renderMenu(); }, 150);
    });

    // Add / + / − / remove buttons anywhere on the page (event delegation)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const { action, id } = btn.dataset;
        if (action === 'add') addToCart(id);
        else if (action === 'inc') setQty(id, (cart[id] || 0) + 1);
        else if (action === 'dec') setQty(id, (cart[id] || 0) - 1);
        else if (action === 'remove') { setQty(id, 0); showToast('Item removed'); }
    });

    $('#cartBtn').addEventListener('click', openCart);
    $('#closeCart').addEventListener('click', closeCart);
    $('#overlay').addEventListener('click', closeCart);
    $('#checkoutBtn').addEventListener('click', openCheckout);
    $('#clearCart').addEventListener('click', () => {
        cart = {};
        store.set('luckyFoodsCart_v2', cart);
        renderCart();
        refreshCardControls();
        showToast('Cart cleared');
    });

    $('#closeCheckout').addEventListener('click', closeCheckout);
    $('#cancelCheckout').addEventListener('click', closeCheckout);
    $('#checkoutModal').addEventListener('click', (e) => { if (e.target.id === 'checkoutModal') closeCheckout(); });
    $('#orderType').addEventListener('click', (e) => {
        const seg = e.target.closest('.seg');
        if (seg) setOrderType(seg.dataset.type);
    });
    $('#checkoutForm').addEventListener('submit', submitOrder);
    ['customerName', 'customerPhone', 'customerAddress'].forEach(id =>
        document.getElementById(id).addEventListener('input', () => setError(id, '')));

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if ($('#checkoutModal').classList.contains('open')) closeCheckout();
        else if ($('#cartDrawer').classList.contains('open')) closeCart();
    });

    // Mobile nav
    $('#menuToggle').addEventListener('click', () => $('#navLinks').classList.toggle('open'));
    $('#navLinks').addEventListener('click', (e) => { if (e.target.tagName === 'A') $('#navLinks').classList.remove('open'); });

    // Header shadow on scroll
    window.addEventListener('scroll', () => $('#header').classList.toggle('scrolled', window.scrollY > 10), { passive: true });

    // Keep cart in sync across open tabs
    window.addEventListener('storage', (e) => {
        if (e.key === 'luckyFoodsCart_v2') {
            cart = sanitizeCart(store.get('luckyFoodsCart_v2', {}));
            renderCart();
            refreshCardControls();
        }
    });
}

/* ---------- Init ---------- */
function init() {
    const chatUrl = waLink('Hello Lucky Foods! 👋 I have a question.');
    $('#waFloat').href = chatUrl;
    $('#heroWhatsApp').href = chatUrl;
    $('#heroWhatsApp').target = '_blank';
    $('#heroWhatsApp').rel = 'noopener';
    $('#itemCountStat').textContent = MENU.length;
    $('#year').textContent = new Date().getFullYear();

    renderOpenStatus();
    setInterval(renderOpenStatus, 60 * 1000);
    renderFilters();
    renderMenu();
    renderCart();
    setOrderType(orderType);
    bindEvents();
}

document.addEventListener('DOMContentLoaded', init);
