// ==========================================
// 1. STATE & LOCALSTORAGE MANAGEMENT
// ==========================================
const posChannel = new BroadcastChannel('pos_channel');

let products = JSON.parse(localStorage.getItem('pos_products')) || [
    { id: 1, code: '101', name: 'چپسی لایز', cost: 500, price: 750, stock: 15, expiry: '2026-08-10' },
    { id: 2, code: '102', name: 'کۆلا 330ml', cost: 400, price: 500, stock: 3, expiry: '2026-12-01' },
    { id: 3, code: '103', name: 'شیر 1L', cost: 1000, price: 1250, stock: 8, expiry: '2026-08-04' }
];

let expenses = JSON.parse(localStorage.getItem('pos_expenses')) || [];
let debts = JSON.parse(localStorage.getItem('pos_debts')) || [];
let sales = JSON.parse(localStorage.getItem('pos_sales')) || [];

let cart = [];
let heldOrders = [];
let auditLogs = [];

function saveData() {
    localStorage.setItem('pos_products', JSON.stringify(products));
    localStorage.setItem('pos_expenses', JSON.stringify(expenses));
    localStorage.setItem('pos_debts', JSON.stringify(debts));
    localStorage.setItem('pos_sales', JSON.stringify(sales));
}

// ==========================================
// 2. INITIALIZATION & NAVIGATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    renderProducts();
    runAIEngine();
    setupBarcodeScanner();
});

function switchPage(pageId) {
    const pages = ['posView', 'inventoryView', 'debtsView', 'reportsView', 'aiAnalyticsView'];
    pages.forEach(p => {
        const el = document.getElementById(p);
        if (el) el.style.display = 'none';
    });

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const cartSec = document.getElementById('cartSection');
    if (cartSec) cartSec.style.display = (pageId === 'pos') ? 'flex' : 'none';

    if (pageId === 'pos') {
        showElement('posView', 'flex');
        renderProducts();
    } else if (pageId === 'inventory') {
        showElement('inventoryView', 'block');
        renderInventory();
    } else if (pageId === 'debts') {
        showElement('debtsView', 'block');
        renderDebts();
    } else if (pageId === 'reports') {
        showElement('reportsView', 'block');
        renderReports();
    } else if (pageId === 'ai-analytics') {
        showElement('aiAnalyticsView', 'block');
        renderAuditLogs();
    }
}

function showElement(id, displayType) {
    const el = document.getElementById(id);
    if (el) el.style.display = displayType;
}

// ==========================================
// 3. POS & CART SYSTEM
// ==========================================
function renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.onclick = () => addToCart(p.id);
        card.innerHTML = `
            <div class="product-name">${p.name}</div>
            <div style="font-size: 11px; color: #94a3b8;">کۆد: ${p.code} | کۆگا: ${p.stock}</div>
            <div class="product-price" style="margin-top: 8px;">${p.price.toLocaleString()} د.ع</div>
        `;
        grid.appendChild(card);
    });
}

function addToCart(productId) {
    const prod = products.find(p => p.id === productId);
    if (!prod || prod.stock <= 0) return alert('ئەم کاڵایە لە کۆگا نەماوە!');

    const existing = cart.find(c => c.id === productId);
    if (existing) {
        if (existing.qty < prod.stock) {
            existing.qty++;
        } else {
            alert('ناتوانی لە بڕی بەردەست لە کۆگا زیاتر زێدە بکەی!');
        }
    } else {
        cart.push({ ...prod, qty: 1 });
    }

    renderCart();
    checkAICrossSell(prod);
}

function renderCart() {
    const container = document.getElementById('cartItems');
    if (!container) return;
    container.innerHTML = '';
    let subTotal = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        subTotal += itemTotal;
        container.innerHTML += `
            <div class="cart-item">
                <div>
                    <strong>${item.name}</strong><br>
                    <small>${item.qty} x ${item.price.toLocaleString()}</small>
                </div>
                <div>
                    <button class="btn-qty" onclick="changeQty(${item.id}, -1)">-</button>
                    <span style="margin: 0 5px;">${item.qty}</span>
                    <button class="btn-qty" onclick="changeQty(${item.id}, 1)">+</button>
                </div>
            </div>
        `;
    });

    const discountInput = document.getElementById('discountInput');
    const discount = discountInput ? (parseFloat(discountInput.value) || 0) : 0;
    const grandTotal = Math.max(0, subTotal - discount);

    const subTotalEl = document.getElementById('subTotal');
    const grandTotalEl = document.getElementById('grandTotal');

    if (subTotalEl) subTotalEl.innerText = subTotal.toLocaleString() + ' د.ع';
    if (grandTotalEl) grandTotalEl.innerText = grandTotal.toLocaleString() + ' د.ع';

    // ڕوانگەی ئاگادارکردنەوە بۆ شاشەی کڕیار
    posChannel.postMessage({ type: 'UPDATE_CART', cart: cart, total: grandTotal });
}

function changeQty(id, change) {
    const idx = cart.findIndex(i => i.id === id);
    if (idx > -1) {
        const prod = products.find(p => p.id === id);
        if (change > 0 && prod && cart[idx].qty >= prod.stock) {
            alert('بڕی زیاتر لە کۆگا نییە!');
            return;
        }
        cart[idx].qty += change;
        if (cart[idx].qty <= 0) cart.splice(idx, 1);
    }
    renderCart();
}

function clearCart(isCashierAction = false) {
    if (isCashierAction && cart.length > 0) {
        const totalEl = document.getElementById('grandTotal');
        const amountText = totalEl ? totalEl.innerText : '0';
        logFraud('کاشێر پسوولەی سڕییەوە بە بڕی ' + amountText);
    }
    cart = [];
    const discountInput = document.getElementById('discountInput');
    if (discountInput) discountInput.value = 0;

    renderCart();
    posChannel.postMessage({ type: 'CLEAR_CART' });
}

function processPayment() {
    if (cart.length === 0) return alert("تکایە بەرهەمەکێ زێدە بکە!");

    const discountInput = document.getElementById('discountInput');
    const discount = discountInput ? (parseFloat(discountInput.value) || 0) : 0;
    let subtotal = 0;
    let totalCost = 0;

    cart.forEach(cartItem => {
        const p = products.find(prod => prod.id === cartItem.id);
        if (p) {
            p.stock -= cartItem.qty;
            totalCost += (p.cost * cartItem.qty);
        }
        subtotal += cartItem.price * cartItem.qty;
    });

    const grandTotal = Math.max(0, subtotal - discount);

    sales.push({
        id: Date.now(),
        grandTotal,
        totalCost,
        date: new Date().toLocaleDateString('ku-IQ')
    });

    saveData();
    window.print();
    clearCart(false);
    renderProducts();
    runAIEngine();
}

// ==========================================
// 4. HELD ORDERS MANAGEMENT
// ==========================================
function holdCurrentOrder() {
    if (cart.length === 0) return;
    heldOrders.push([...cart]);
    clearCart(false);
    renderHeldOrders();
}

function renderHeldOrders() {
    const list = document.getElementById('heldOrdersList');
    if (!list) return;
    list.innerHTML = '';
    heldOrders.forEach((order, index) => {
        list.innerHTML += `<button class="btn-hold" onclick="restoreOrder(${index})">پسوولا ${index + 1}</button>`;
    });
}

function restoreOrder(index) {
    cart = heldOrders[index];
    heldOrders.splice(index, 1);
    renderHeldOrders();
    renderCart();
}

// ==========================================
// 5. INVENTORY & EXPIRY MANAGEMENT
// ==========================================
function renderInventory() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const today = new Date();

    products.forEach(p => {
        const expDate = p.expiry ? new Date(p.expiry) : null;
        const diffDays = expDate ? Math.ceil((expDate - today) / (1000 * 60 * 60 * 24)) : 999;

        let statusTag = '<span style="color:#10b981;">باشە</span>';
        if (diffDays <= 7) {
            statusTag = '<span style="color:#ef4444; font-weight:bold;">ئۆفەری خێرا بکە! (%50)</span>';
        } else if (p.stock <= 5) {
            statusTag = '<span style="color:#f59e0b; font-weight:bold;">⚠️ کەم ماویە!</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><code>${p.code}</code></td>
            <td><strong>${p.name}</strong></td>
            <td>${p.cost.toLocaleString()} د.ع</td>
            <td style="color: var(--accent-green); font-weight: bold;">${p.price.toLocaleString()} د.ع</td>
            <td>${p.stock}</td>
            <td>${p.expiry || 'دیاری نەکراوە'}</td>
            <td>${statusTag}</td>
            <td>
                <button onclick="applyAIOffer(${p.id})" style="padding: 4px 8px; cursor:pointer;">داشکاندنا AI</button>
                <button onclick="deleteProduct(${p.id})" style="color: var(--accent-red); background:none; border:none; cursor:pointer; margin-right: 5px;"><i class="fa-solid fa-trash"></i> سڕینەوە</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function saveProduct(e) {
    e.preventDefault();
    const name = document.getElementById('pName').value;
    const code = document.getElementById('pCode').value;
    const cost = parseFloat(document.getElementById('pCost').value);
    const price = parseFloat(document.getElementById('pPrice').value);
    const stock = parseInt(document.getElementById('pStock').value);
    const expiry = document.getElementById('pExpiry') ? document.getElementById('pExpiry').value : '';

    products.push({
        id: Date.now(),
        name,
        code,
        cost,
        price,
        stock,
        expiry
    });

    saveData();
    closeModal('productModal');
    renderInventory();
    renderProducts();
    runAIEngine();
}

function deleteProduct(id) {
    if (confirm("ئەرێ دپشتڕاستی تە دڤێت ڤی کاڵایی بسڕی؟")) {
        products = products.filter(p => p.id !== id);
        saveData();
        renderInventory();
        renderProducts();
        runAIEngine();
    }
}

// ==========================================
// 6. DEBTS MANAGEMENT
// ==========================================
function renderDebts() {
    const tbody = document.getElementById('debtsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    debts.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${d.name}</strong></td>
            <td>${d.phone}</td>
            <td style="color: #ef4444; font-weight: bold;">${d.amount.toLocaleString()} د.ع</td>
            <td>${d.date}</td>
            <td>${d.dueDate}</td>
            <td><button style="background:#10b981; color:#000; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-weight:bold;" onclick="payDebt(${d.id})">دانەوەی قەرز</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function saveDebt(e) {
    e.preventDefault();
    debts.push({
        id: Date.now(),
        name: document.getElementById('dName').value,
        phone: document.getElementById('dPhone').value,
        amount: parseFloat(document.getElementById('dAmount').value),
        date: new Date().toLocaleDateString('ku-IQ'),
        dueDate: document.getElementById('dDueDate').value
    });
    saveData();
    closeModal('debtModal');
    renderDebts();
}

function payDebt(id) {
    if (confirm("ئەرێ قەرزدار ئەم پارەیەی دایەوە بە تەواوی؟")) {
        debts = debts.filter(d => d.id !== id);
        saveData();
        renderDebts();
    }
}

// ==========================================
// 7. EXPENSES & REPORTS MANAGEMENT
// ==========================================
function saveExpense(e) {
    e.preventDefault();
    expenses.push({
        id: Date.now(),
        type: document.getElementById('expType').value,
        amount: parseFloat(document.getElementById('expAmount').value),
        note: document.getElementById('expNote').value,
        date: new Date().toLocaleDateString('ku-IQ')
    });
    saveData();
    closeModal('expenseModal');
    renderReports();
}

function renderReports() {
    let totalSales = sales.reduce((a, b) => a + b.grandTotal, 0);
    let totalExpenses = expenses.reduce((a, b) => a + b.amount, 0);
    let totalCost = sales.reduce((a, b) => a + b.totalCost, 0);
    let netProfit = totalSales - (totalCost + totalExpenses);

    const repSales = document.getElementById('repTotalSales');
    const repExp = document.getElementById('repTotalExpenses');
    const repCost = document.getElementById('repTotalCost');
    const repProfit = document.getElementById('repNetProfit');

    if (repSales) repSales.innerText = `${totalSales.toLocaleString()} د.ع`;
    if (repExp) repExp.innerText = `${totalExpenses.toLocaleString()} د.ع`;
    if (repCost) repCost.innerText = `${totalCost.toLocaleString()} د.ع`;
    if (repProfit) repProfit.innerText = `${netProfit.toLocaleString()} د.ع`;

    const tbody = document.getElementById('expensesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    expenses.forEach(exp => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${exp.type}</strong></td><td style="color:#ef4444;">${exp.amount.toLocaleString()} د.ع</td><td>${exp.date}</td><td>${exp.note}</td>`;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 8. AI ENGINE, VOICE & FRAUD DETECTION
// ==========================================
function runAIEngine() {
    const today = new Date();
    let expiringCount = 0;
    let autoStockCount = 0;

    products.forEach(p => {
        if (p.expiry) {
            const expDate = new Date(p.expiry);
            const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) expiringCount++;
        }
        if (p.stock <= 5) autoStockCount++;
    });

    const expEl = document.getElementById('expiryAlertCount');
    const stockEl = document.getElementById('autoStockCount');

    if (expEl) expEl.innerText = expiringCount + ' کاڵا نزیکین بەسەر بچن';
    if (stockEl) stockEl.innerText = autoStockCount + ' کاڵا پێویستی ب داواکرنێ هەیە';
}

function applyAIOffer(id) {
    const p = products.find(prod => prod.id === id);
    if (p) {
        p.price = Math.round(p.price / 2);
        saveData();
        alert('نرخی ' + p.name + ' بە ڕێژەی %50 کەمکرایەوە بۆ ڕزگاربوون لە بەسەرچوون!');
        renderInventory();
        renderProducts();
    }
}

function checkAICrossSell(prod) {
    const banner = document.getElementById('aiCrossSellAlert');
    if (!banner) return;

    if (prod.name.includes('چپس')) {
        banner.style.display = 'block';
        banner.innerHTML = '💡 <strong>ڕاسپاردەی AI:</strong> بڵێ ب کڕیاری پێویستی ب شەربەت یان کۆلا نییە؟';
    } else {
        banner.style.display = 'none';
    }
}

function logFraud(message) {
    const time = new Date().toLocaleTimeString('ku');
    auditLogs.push(`[${time}] ${message}`);
}

function renderAuditLogs() {
    const ul = document.getElementById('auditLogList');
    if (!ul) return;
    ul.innerHTML = '';
    if (auditLogs.length === 0) {
        ul.innerHTML = '<li>چ کردارەکێ گوماناوی نەهاتیە تۆمارکرن.</li>';
    } else {
        auditLogs.forEach(log => {
            ul.innerHTML += `<li>${log}</li>`;
        });
    }
}

function toggleVoiceAI() {
    const status = document.getElementById('voiceStatus');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert('بڕاوسەرەکەت پشتگیری قسەکردن ناکات. Chrome بەکاربهێنە!');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ckb-IQ';
    if (status) status.innerText = 'گوێت لێدەگرم...';

    recognition.onresult = function (event) {
        const text = event.results[0][0].transcript;
        if (status) status.innerText = 'وتت: ' + text;

        if (text.includes('قازانج') || text.includes('فرۆشتن') || text.includes('ڕاپۆرت')) {
            switchPage('reports');
            alert('شاشەی ڕاپۆرت و قازانج کرایەوە.');
        } else if (text.includes('کۆگا')) {
            switchPage('inventory');
        } else {
            alert('داواکاریەکەت تێگەیشتم: ' + text);
        }
    };

    recognition.start();
}

// ==========================================
// 9. BARCODE SCANNER & MODALS & CUSTOMER SCREEN
// ==========================================
function setupBarcodeScanner() {
    const barcodeInput = document.getElementById('barcodeInput');
    if (!barcodeInput) return;

    barcodeInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            const p = products.find(prod => prod.code === this.value.trim());
            if (p) {
                addToCart(p.id);
                this.value = '';
            } else {
                alert("ئەم بارکۆدە نێنیاسە!");
                this.value = '';
            }
        }
    });
}

function openCustomerScreen() {
    window.open('customer.html', '_blank', 'width=1000,height=700');
}

function openExpenseModal() { showElement('expenseModal', 'flex'); }
function openDebtModal() { showElement('debtModal', 'flex'); }
function openProductModal() { showElement('productModal', 'flex'); }
function closeModal(id) { showElement(id, 'none'); }
