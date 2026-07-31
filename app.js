const posChannel = new BroadcastChannel('pos_channel');

// داتاکان لە مێشکدا (LocalStorage)
let products = JSON.parse(localStorage.getItem('pos_products')) || [
    { id: 1, name: "ئاڤا ماسي 500ml", cost: 150, price: 250, code: "1001", stock: 100 },
    { id: 2, name: "پێپسی قۆتی", cost: 350, price: 500, code: "1002", stock: 4 } // ⚠️ Stock < 5 ئاگاداری
];

let expenses = JSON.parse(localStorage.getItem('pos_expenses')) || [];
let debts = JSON.parse(localStorage.getItem('pos_debts')) || [];
let sales = JSON.parse(localStorage.getItem('pos_sales')) || [];
let cart = [];

function saveData() {
    localStorage.setItem('pos_products', JSON.stringify(products));
    localStorage.setItem('pos_expenses', JSON.stringify(expenses));
    localStorage.setItem('pos_debts', JSON.stringify(debts));
    localStorage.setItem('pos_sales', JSON.stringify(sales));
}

function openCustomerScreen() {
    window.open('customer.html', '_blank', 'width=1000,height=700');
}

function switchPage(page) {
    const pages = ['posView', 'inventoryView', 'debtsView', 'reportsView'];
    pages.forEach(p => document.getElementById(p).style.display = 'none');
    document.getElementById('cartSection').style.display = (page === 'pos') ? 'flex' : 'none';

    if (page === 'pos') { document.getElementById('posView').style.display = 'flex'; renderProducts(); }
    if (page === 'inventory') { document.getElementById('inventoryView').style.display = 'block'; renderInventory(); }
    if (page === 'debts') { document.getElementById('debtsView').style.display = 'block'; renderDebts(); }
    if (page === 'reports') { document.getElementById('reportsView').style.display = 'block'; renderReports(); }
}

// --- 📦 کۆگا ---
function renderInventory() {
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = '';
    products.forEach(p => {
        const tr = document.createElement('tr');
        const lowStock = p.stock <= 5 ? 'color: #ef4444; font-weight: bold;' : '';
        tr.innerHTML = `
            <td><code>${p.code}</code></td>
            <td><strong>${p.name}</strong></td>
            <td>${p.cost.toLocaleString()} د.ع</td>
            <td style="color: var(--accent-green); font-weight: bold;">${p.price.toLocaleString()} د.ع</td>
            <td style="${lowStock}">${p.stock} ${p.stock <= 5 ? '⚠️ (کەم ماویە!)' : ''}</td>
            <td><button style="color: var(--accent-red); background:none; border:none; cursor:pointer;" onclick="deleteProduct(${p.id})"><i class="fa-solid fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

function saveProduct(e) {
    e.preventDefault();
    products.push({
        id: Date.now(),
        name: document.getElementById('pName').value,
        code: document.getElementById('pCode').value,
        cost: parseFloat(document.getElementById('pCost').value),
        price: parseFloat(document.getElementById('pPrice').value),
        stock: parseInt(document.getElementById('pStock').value)
    });
    saveData(); closeModal('productModal'); renderInventory();
}

function deleteProduct(id) {
    if (confirm("ئەرێ دپشتڕاستی تە دڤێت ڤی کاڵایی بسڕی؟")) {
        products = products.filter(p => p.id !== id); saveData(); renderInventory();
    }
}

// --- 💰 قەرز ---
function renderDebts() {
    const tbody = document.getElementById('debtsTableBody');
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
    saveData(); closeModal('debtModal'); renderDebts();
}

function payDebt(id) {
    if (confirm("ئەرێ قەرزدار ئەم پارەیەی دایەوە بە تەواوی؟")) {
        debts = debts.filter(d => d.id !== id); saveData(); renderDebts();
    }
}

// --- 📊 مەسروفات و ڕاپۆرت ---
function saveExpense(e) {
    e.preventDefault();
    expenses.push({
        id: Date.now(),
        type: document.getElementById('expType').value,
        amount: parseFloat(document.getElementById('expAmount').value),
        note: document.getElementById('expNote').value,
        date: new Date().toLocaleDateString('ku-IQ')
    });
    saveData(); closeModal('expenseModal'); renderReports();
}

function renderReports() {
    let totalSales = sales.reduce((a, b) => a + b.grandTotal, 0);
    let totalExpenses = expenses.reduce((a, b) => a + b.amount, 0);
    let totalCost = sales.reduce((a, b) => a + b.totalCost, 0);
    let netProfit = totalSales - (totalCost + totalExpenses);

    document.getElementById('repTotalSales').innerText = `${totalSales.toLocaleString()} د.ع`;
    document.getElementById('repTotalExpenses').innerText = `${totalExpenses.toLocaleString()} د.ع`;
    document.getElementById('repTotalCost').innerText = `${totalCost.toLocaleString()} د.ع`;
    document.getElementById('repNetProfit').innerText = `${netProfit.toLocaleString()} د.ع`;

    const tbody = document.getElementById('expensesTableBody');
    tbody.innerHTML = '';
    expenses.forEach(exp => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${exp.type}</strong></td><td style="color:#ef4444;">${exp.amount.toLocaleString()} د.ع</td><td>${exp.date}</td><td>${exp.note}</td>`;
        tbody.appendChild(tr);
    });
}

// --- 🛒 شاشەی فرۆشتن ---
function renderProducts() {
    const grid = document.getElementById('productsGrid');
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
    const product = products.find(p => p.id === productId);
    if (!product || product.stock <= 0) return alert("ئەم کاڵایە لە کۆگا نەمایە!");
    const existing = cart.find(item => item.id === productId);
    if (existing) { if (existing.qty < product.stock) existing.qty += 1; }
    else { cart.push({ ...product, qty: 1 }); }
    renderCart();
}

function renderCart() {
    const cartItems = document.getElementById('cartItems');
    cartItems.innerHTML = '';
    let subtotal = 0;
    cart.forEach(item => {
        subtotal += item.price * item.qty;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `<div><strong>${item.name}</strong><br><small>${item.price.toLocaleString()} x ${item.qty}</small></div>
        <div><button class="btn-qty" onclick="changeQty(${item.id}, -1)">-</button><span style="margin:0 5px;">${item.qty}</span><button class="btn-qty" onclick="changeQty(${item.id}, 1)">+</button></div>`;
        cartItems.appendChild(div);
    });
    const discount = parseFloat(document.getElementById('discountInput').value) || 0;
    const grandTotal = Math.max(0, subtotal - discount);
    document.getElementById('subTotal').innerText = `${subtotal.toLocaleString()} د.ع`;
    document.getElementById('grandTotal').innerText = `${grandTotal.toLocaleString()} د.ع`;
    posChannel.postMessage({ type: 'UPDATE_CART', cart: cart, total: grandTotal });
}

function changeQty(id, change) {
    const idx = cart.findIndex(i => i.id === id);
    if (idx > -1) { cart[idx].qty += change; if (cart[idx].qty <= 0) cart.splice(idx, 1); }
    renderCart();
}

function clearCart() { cart = []; document.getElementById('discountInput').value = 0; renderCart(); posChannel.postMessage({ type: 'CLEAR_CART' }); }

function processPayment() {
    if (cart.length === 0) return alert("تکایە بەرهەمەکێ زێدە بکە!");
    const discount = parseFloat(document.getElementById('discountInput').value) || 0;
    let subtotal = 0; let totalCost = 0;

    cart.forEach(cartItem => {
        const p = products.find(prod => prod.id === cartItem.id);
        if (p) { p.stock -= cartItem.qty; totalCost += (p.cost * cartItem.qty); }
        subtotal += cartItem.price * cartItem.qty;
    });

    const grandTotal = Math.max(0, subtotal - discount);
    sales.push({ id: Date.now(), grandTotal, totalCost, date: new Date().toLocaleDateString('ku-IQ') });
    saveData();
    window.print();
    clearCart();
    renderProducts();
}

function openExpenseModal() { document.getElementById('expenseModal').style.display = 'flex'; }
function openDebtModal() { document.getElementById('debtModal').style.display = 'flex'; }
function openProductModal() { document.getElementById('productModal').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// بارکۆد سکێنەر
document.getElementById('barcodeInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        const p = products.find(prod => prod.code === this.value.trim());
        if (p) { addToCart(p.id); this.value = ''; }
        else { alert("ئەم بارکۆدە نێنیاسە!"); this.value = ''; }
    }
});

renderProducts();
