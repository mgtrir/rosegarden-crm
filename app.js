const DEFAULT_FLOWER_IMAGE = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80';

const firebaseConfig = {
    apiKey: "AIzaSyC5pdi-fTgYpXN3nL7Ei4tLbDcTvO1WV5E",
    authDomain: "rosegarden-db.firebaseapp.com",
    databaseURL: "https://rosegarden-db-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "rosegarden-db",
    storageBucket: "rosegarden-db.firebasestorage.app",
    messagingSenderId: "455411771135",
    appId: "1:455411771135:web:62cdd2d0197835a0f3ceca",
    measurementId: "G-ZP6YZX6CZQ"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let userRole = 'Blocked';
let isRegisterMode = false;
let flowers = [];
let clients = [];
let orders = [];
let procurements = [];
let currentProcurementItems = [];
let cart = {};
let activeOrderItems = [];

try {
    const savedCart = localStorage.getItem('rosegarden_cart');
    if (savedCart) cart = JSON.parse(savedCart);
} catch (e) { cart = {}; }

let selectedTypeFilter = 'ALL';
let selectedSizeFilter = 'ALL';
let selectedNameFilter = 'ALL';

db.ref('clients').on('value', (s) => {
    clients = s.val() ? Object.values(s.val()) : [];
    if (document.getElementById('clientsModal').classList.contains('active')) {
        renderClientsTable();
    }
});

window.setCardSize = function(size, el) {
    document.querySelectorAll('#cardSizeFilters .size-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    const root = document.documentElement;
    if (size === 'compact') {
        root.style.setProperty('--card-min-width', '200px');
        root.style.setProperty('--image-height', '160px');
    } else if (size === 'medium') {
        root.style.setProperty('--card-min-width', '260px');
        root.style.setProperty('--image-height', '240px');
    } else if (size === 'large') {
        root.style.setProperty('--card-min-width', '340px');
        root.style.setProperty('--image-height', '320px');
    }
};

window.openClientsModal = function() { document.getElementById('clientsModal').classList.add('active'); renderClientsTable(); };
window.closeClientsModal = function() { document.getElementById('clientsModal').classList.remove('active'); };

window.openOrdersModal = function() {
    document.getElementById('ordersModal').classList.add('active');
    db.ref('orders').on('value', (s) => {
        orders = s.val() ? Object.values(s.val()) : [];
        renderOrdersTable();
    });
};
window.closeOrdersModal = function() { document.getElementById('ordersModal').classList.remove('active'); };

window.exportOrdersExcel = function() {
    if (!orders || orders.length === 0) return alert('Нет заказов!');
    const wb = XLSX.utils.book_new();
    const wsData = [
        ["🌸 РОУЗ ГАРДЕН — ЗАКАЗЫ"],
        ["№ Заказа", "Дата", "Клиент", "Телефон", "Статус", "Состав", "Сумма"]
    ];
    let total = 0;
    orders.forEach(o => {
        total += Number(o.totalPrice || 0);
        let itemsStr = (o.items || []).map(i => `${i.name}: ${i.packs} пач. (${i.price} ${i.currency || '֏'})`).join(' | ');
        wsData.push([o.id, o.date, o.clientName, o.clientPhone, o.status, itemsStr, o.totalPrice]);
    });
    wsData.push([], ["ИТОГО", "", "", "", "", "", total]);
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Заказы");
    XLSX.writeFile(wb, `RoseGarden_Orders_${Date.now()}.xlsx`);
};

window.openProcurementsModal = function() {
    document.getElementById('procurementsModal').classList.add('active');
    populateProcurementFlowerSelect();
    db.ref('procurements').on('value', (s) => {
        procurements = s.val() ? Object.values(s.val()) : [];
        renderProcurementsTable();
    });
};
window.closeProcurementsModal = function() { document.getElementById('procurementsModal').classList.remove('active'); };

window.openFinanceModal = function() { document.getElementById('financeModal').classList.add('active'); calculateFinance(); };
window.closeFinanceModal = function() { document.getElementById('financeModal').classList.remove('active'); };

window.openAnalyticsModal = function() { document.getElementById('analyticsModal').classList.add('active'); renderCharts(); };
window.closeAnalyticsModal = function() { document.getElementById('analyticsModal').classList.remove('active'); };

window.openRolesModal = function() { document.getElementById('rolesModal').classList.add('active'); renderRolesTable(); };
window.closeRolesModal = function() { document.getElementById('rolesModal').classList.remove('active'); };

window.openAdminModal = function() { document.getElementById('adminModal').classList.add('active'); renderAdminTable(); };
window.closeAdminModal = function() { document.getElementById('adminModal').classList.remove('active'); };

window.showWarehouseSection = function(sec) {
    document.getElementById('warehouseListSection').style.display = sec === 'list' ? 'block' : 'none';
    document.getElementById('warehouseAddSection').style.display = sec === 'add' ? 'block' : 'none';
    if (sec === 'add' && !document.getElementById('editItemId').value) setDefaultPiecesForCategory();
};

window.setDefaultPiecesForCategory = function() {
    const cat = document.getElementById('flowerCategory').value;
    const pcsInput = document.getElementById('flowerPcsPerPack');
    if (pcsInput) pcsInput.value = (cat === 'Одноголовая') ? 15 : 10;
};

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        db.ref('users/' + user.uid).on('value', (snapshot) => {
            const userData = snapshot.val();
            if (userData) {
                userRole = userData.role || 'Blocked';
                document.getElementById('currentUserInfo').innerHTML = `👤 ${userData.name || user.email} (${getRoleBadge(userRole)})`;
                applyRolePermissions();
            } else {
                const isAdmin = user.email.includes('admin') || user.email === 'mgtir11@gmail.com';
                userRole = isAdmin ? 'Admin' : 'Blocked';
                db.ref('users/' + user.uid).set({ email: user.email, name: user.email.split('@')[0], role: userRole });
            }
            document.getElementById('authOverlay').style.display = 'none';
        });
    } else {
        currentUser = null;
        document.getElementById('authOverlay').style.display = 'flex';
    }
});

function applyRolePermissions() {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = userRole === 'Admin' ? 'inline-flex' : 'none');
}

function getRoleBadge(role) {
    if (role === 'Admin') return '<span class="role-badge role-admin">Админ</span>';
    if (role === 'Manager') return '<span class="role-badge role-manager">Менеджер</span>';
    return '<span class="role-badge role-blocked">Заблокирован</span>';
}

window.toggleAuthMode = function() {
    isRegisterMode = !isRegisterMode;
    document.getElementById('authTitle').innerText = isRegisterMode ? 'Регистрация' : 'Вход в CRM';
    document.getElementById('authSubmitBtn').innerText = isRegisterMode ? 'Зарегистрироваться' : 'Войти';
    document.getElementById('authToggleText').innerText = isRegisterMode ? 'Уже есть аккаунт?' : 'Нет аккаунта?';
    document.getElementById('authToggleBtn').innerText = isRegisterMode ? 'Войти' : 'Зарегистрироваться';
    document.getElementById('authNameGroup').style.display = isRegisterMode ? 'block' : 'none';
};

window.handleAuthSubmit = function(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value;

    if (isRegisterMode) {
        auth.createUserWithEmailAndPassword(email, password).then((cred) => {
            const isAdmin = email.includes('admin') || email === 'mgtir11@gmail.com';
            db.ref('users/' + cred.user.uid).set({ email, name: name || email.split('@')[0], role: isAdmin ? 'Admin' : 'Blocked' });
            alert('Успешно!');
        }).catch(err => alert(err.message));
    } else {
        auth.signInWithEmailAndPassword(email, password).catch(err => alert('Ошибка: ' + err.message));
    }
};

window.handleLogout = function() { auth.signOut(); };

window.exportStockExcel = function() {
    if (!flowers || flowers.length === 0) return alert('Пусто!');
    const wb = XLSX.utils.book_new();
    const wsData = [
        ["🌸 РОУЗ ГАРДЕН — ОСТАТКИ"],
        ["№", "Вид", "Сорт", "Размер", "Штук/пач", "Пачки", "Штук"]
    ];
    let tPacks = 0, tQty = 0;
    flowers.forEach((f, idx) => {
        tPacks += Number(f.packs || 0);
        tQty += Number(f.stock || 0);
        wsData.push([idx+1, f.category, f.name, f.size, f.pcsPerPack || 15, f.packs || 0, f.stock || 0]);
    });
    wsData.push([], ["ИТОГО", "", "", "", tPacks, tQty]);
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Склад");
    XLSX.writeFile(wb, `RoseGarden_Stock_${Date.now()}.xlsx`);
};

window.importDailyStock = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
            if (rows.length === 0) return alert('Пустой файл!');

            const sizeColumns = [
                { stockColIdx: 1, packColIdx: 2, size: '30 см' },
                { stockColIdx: 3, packColIdx: 4, size: '40 см' },
                { stockColIdx: 5, packColIdx: 6, size: '50 см' },
                { stockColIdx: 7, packColIdx: 8, size: '60 см' },
                { stockColIdx: 9, packColIdx: 10, size: '70 см' },
                { stockColIdx: 11, packColIdx: 12, size: '80 см' },
                { stockColIdx: 13, packColIdx: 14, size: '90 см' },
                { stockColIdx: 15, packColIdx: 16, size: '100 см' }
            ];

            for (let i = 6; i < rows.length; i++) {
                const row = rows[i];
                const flowerName = row[0] ? String(row[0]).trim() : '';
                if (!flowerName || flowerName.includes('Итого') || flowerName.includes('Itogo')) continue;

                sizeColumns.forEach(item => {
                    if (item.packColIdx >= row.length) return;

                    let pcsVal = parseInt(row[item.stockColIdx], 10) || 0;
                    let packsVal = parseInt(row[item.packColIdx], 10) || 0;
                    
                    let existingByExact = flowers.find(f => f.name.toLowerCase() === flowerName.toLowerCase() && f.size === item.size);
                    let existingAnySize = flowers.find(f => f.name.toLowerCase() === flowerName.toLowerCase());

                    if (existingByExact) {
                        existingByExact.stock = pcsVal;
                        existingByExact.packs = packsVal;
                    } else if (pcsVal > 0 || packsVal > 0) {
                        let category = existingAnySize ? existingAnySize.category : 'Одноголовая';
                        let image = existingAnySize ? existingAnySize.image : DEFAULT_FLOWER_IMAGE;

                        flowers.push({
                            id: 'FLW-' + Date.now() + '-' + Math.floor(Math.random()*1000),
                            name: flowerName, 
                            category: category, 
                            size: item.size,
                            pcsPerPack: 15, 
                            stock: pcsVal, 
                            packs: packsVal, 
                            image: image
                        });
                    }
                });
            }
            db.ref('inventory').set(flowers);
            alert('Остатки успешно импортированы!');
        } catch(err) { alert('Ошибка: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
};

db.ref('inventory').on('value', (snapshot) => {
    const data = snapshot.val();
    flowers = data ? (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)) : [];
    renderNameFilterChips();
    renderCatalog();
    renderAdminTable();
    populateProcurementFlowerSelect();
    populateEditOrderFlowerSelect();
    updateCartBar();
});

function renderNameFilterChips() {
    const container = document.getElementById('nameFilterChips');
    if (!container) return;
    let available = selectedTypeFilter === 'ALL' ? flowers : flowers.filter(f => f.category === selectedTypeFilter);
    let uniqueNames = [...new Set(available.map(f => f.name))].sort();
    container.innerHTML = `<span class="size-chip ${selectedNameFilter === 'ALL' ? 'active' : ''}" onclick="filterName('ALL', this)">Все сорта</span>`;
    uniqueNames.forEach(name => {
        container.innerHTML += `<span class="size-chip ${selectedNameFilter === name ? 'active' : ''}" onclick="filterName('${name}', this)">${name}</span>`;
    });
}

window.filterType = function(type, el) {
    selectedTypeFilter = type;
    document.querySelectorAll('#typeFilters .size-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    renderNameFilterChips();
    renderCatalog();
};

window.filterName = function(name, el) {
    selectedNameFilter = name;
    document.querySelectorAll('#nameFilterChips .size-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    renderCatalog();
};

window.filterSize = function(size, el) {
    selectedSizeFilter = size;
    document.querySelectorAll('#sizeFilters .size-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    renderCatalog();
};

function renderCatalog() {
    const grid = document.getElementById('catalogGrid');
    const search = document.getElementById('searchInput').value.toLowerCase();
    grid.innerHTML = '';
    flowers.filter(f => {
        return (f.name.toLowerCase().includes(search)) &&
               (selectedTypeFilter === 'ALL' || f.category === selectedTypeFilter) &&
               (selectedSizeFilter === 'ALL' || f.size.includes(selectedSizeFilter)) &&
               (selectedNameFilter === 'ALL' || f.name === selectedNameFilter);
    }).forEach(f => {
        grid.innerHTML += `
            <div class="card">
                <div class="image-wrapper">
                    <img src="${f.image || DEFAULT_FLOWER_IMAGE}">
                    <div class="size-tag">${f.size}</div>
                    <div class="category-tag">${f.category || 'Одноголовая'}</div>
                </div>
                <div class="card-body">
                    <h3 class="card-title">${f.name}</h3>
                    <p style="margin-bottom:0.5rem; font-size:0.90rem;">Остаток: <strong>${f.packs || 0} пач (${f.stock || 0} шт)</strong></p>
                    <div class="card-footer-action">
                        <div class="cart-input-box">
                            <button class="btn btn-outline btn-sm" onclick="adjustCardQty('${f.id}', -1)">-</button>
                            <input type="number" id="cardQty_${f.id}" class="cart-qty-input" value="1">
                            <button class="btn btn-outline btn-sm" onclick="adjustCardQty('${f.id}', 1)">+</button>
                            <button class="btn btn-success btn-sm" style="flex:1;" onclick="addToCartDirect('${f.id}')">🛒 В корзину</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
}

window.adjustCardQty = function(id, delta) {
    const input = document.getElementById(`cardQty_${id}`);
    if (input) input.value = Math.max(1, (parseInt(input.value, 10) || 0) + delta);
};

window.addToCartDirect = function(id) {
    const flower = flowers.find(f => f.id === id);
    if (!flower) return;
    const packs = parseInt(document.getElementById(`cardQty_${id}`).value, 10) || 1;
    if (!cart[id]) cart[id] = { flowerId: flower.id, packs: 0 };
    cart[id].packs += packs;
    localStorage.setItem('rosegarden_cart', JSON.stringify(cart));
    updateCartBar();
};

function updateCartBar() {
    const bar = document.getElementById('cartBar');
    const items = Object.values(cart);
    if (items.length === 0) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    let tPacks = 0;
    items.forEach(i => { tPacks += i.packs; });
    document.getElementById('cartCount').innerText = tPacks;
}

window.clearCart = function() { cart = {}; localStorage.removeItem('rosegarden_cart'); updateCartBar(); };

function populateEditOrderFlowerSelect() {
    const sel = document.getElementById('editAddFlowerSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Добавить сорт --</option>';
    flowers.forEach(f => sel.innerHTML += `<option value="${f.id}">${f.name} (${f.size})</option>`);
}

window.openSaveOrderModal = function() {
    if (Object.keys(cart).length === 0) return alert('Корзина пуста!');
    document.getElementById('saveOrderModal').classList.add('active');
    document.getElementById('orderModalTitle').innerText = '💾 Оформление Продажи';
    document.getElementById('editingOrderId').value = '';
    
    activeOrderItems = Object.values(cart).map(i => {
        let f = flowers.find(fl => fl.id === i.flowerId);
        return {
            flowerId: i.flowerId,
            name: f ? f.name : 'Цветок',
            category: f ? (f.category || 'Одноголовая') : 'Одноголовая',
            size: f ? f.size : '60 см',
            pcsPerPack: f ? (f.pcsPerPack || 15) : 15,
            packs: i.packs,
            price: 0,
            currency: 'AMD'
        };
    });
    loadClientsIntoSelect('');
    applyClientPricesToActiveOrder();
    renderCheckoutItemsTable();
};
window.closeSaveOrderModal = function() { document.getElementById('saveOrderModal').classList.remove('active'); };

function loadClientsIntoSelect(selectedId) {
    const sel = document.getElementById('orderClientSelect');
    sel.innerHTML = '<option value="">-- Выберите клиента --</option>';
    clients.forEach(c => sel.innerHTML += `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name} (${c.phone})</option>`);
}

window.onClientSelectChanged = function() {
    applyClientPricesToActiveOrder();
    renderCheckoutItemsTable();
};

function applyClientPricesToActiveOrder() {
    const clientId = document.getElementById('orderClientSelect').value;
    const client = clients.find(c => c.id === clientId);
    
    activeOrderItems.forEach(item => {
        let f = flowers.find(fl => fl.id === item.flowerId);
        let cat = f ? f.category : item.category;
        let size = f ? f.size : item.size;
        let key = `${cat}_${size}`.replace(/\s+/g, '_');

        if (client && client.customPrices && client.customPrices[key]) {
            let cp = client.customPrices[key];
            if (cp.currency === 'USD' && Number(cp.usdPrice) > 0) {
                item.price = Number(cp.usdPrice);
                item.currency = 'USD';
            } else if (Number(cp.amdPrice) > 0) {
                item.price = Number(cp.amdPrice);
                item.currency = 'AMD';
            } else if (Number(cp.usdPrice) > 0) {
                item.price = Number(cp.usdPrice);
                item.currency = 'USD';
            }
        } else {
            item.price = 0;
            item.currency = 'AMD';
        }
    });
}

function renderCheckoutItemsTable() {
    const tbody = document.getElementById('checkoutItemsTableBody');
    tbody.innerHTML = '';
    let sumTotalAmd = 0;
    let sumTotalUsd = 0;
    let hasUsd = false;
    let hasAmd = false;

    activeOrderItems.forEach((item, idx) => {
        let totalPieces = item.packs * (item.pcsPerPack || 15);
        let s = totalPieces * item.price;
        if (item.currency === 'USD') {
            sumTotalUsd += s;
            hasUsd = true;
        } else {
            sumTotalAmd += s;
            hasAmd = true;
        }

        tbody.innerHTML += `
            <tr>
                <td><strong>${item.name} (${item.size})</strong></td>
                <td>
                    <select class="form-control" style="padding:2px; width:80px;" onchange="activeOrderItems[${idx}].currency=this.value; applyClientPricesToActiveOrder(); renderCheckoutItemsTable();">
                        <option value="AMD" ${item.currency==='AMD'?'selected':''}>AMD (֏)</option>
                        <option value="USD" ${item.currency==='USD'?'selected':''}>USD ($)</option>
                    </select>
                </td>
                <td><input type="number" class="form-control" style="width:90px; padding:2px;" value="${item.price}" onchange="activeOrderItems[${idx}].price=Number(this.value); renderCheckoutItemsTable();"></td>
                <td><input type="number" class="form-control" style="width:70px; padding:2px;" value="${item.packs}" onchange="activeOrderItems[${idx}].packs=Math.max(1,parseInt(this.value)||1); renderCheckoutItemsTable();"></td>
                <td><strong>${s.toLocaleString()} ${item.currency === 'USD' ? '$' : '֏'}</strong></td>
                <td><button type="button" class="btn btn-dark btn-sm" onclick="activeOrderItems.splice(${idx},1); renderCheckoutItemsTable();">🗑️</button></td>
            </tr>
        `;
    });

    let totalStr = '';
    if (hasAmd) totalStr += `${sumTotalAmd.toLocaleString()} ֏ `;
    if (hasUsd) totalStr += `${hasAmd ? '+ ' : ''}${sumTotalUsd.toLocaleString()} $`;
    document.getElementById('checkoutTotalSum').innerText = totalStr || '0';
}

window.addFlowerToEditingOrder = function() {
    const fId = document.getElementById('editAddFlowerSelect').value;
    const packs = parseInt(document.getElementById('editAddPacksInput').value, 10) || 1;
    if (!fId) return;
    const f = flowers.find(fl => fl.id === fId);
    if (!f) return;
    
    activeOrderItems.push({ 
        flowerId: f.id, 
        name: f.name, 
        category: f.category || 'Одноголовая', 
        size: f.size,
        pcsPerPack: f.pcsPerPack || 15, 
        packs, 
        price: 0,
        currency: 'AMD'
    });
    applyClientPricesToActiveOrder();
    renderCheckoutItemsTable();
};

window.handleCheckoutSubmit = function(e) {
    e.preventDefault();
    const clientId = document.getElementById('orderClientSelect').value;
    if (!clientId) return alert('Выберите клиента!');
    const client = clients.find(c => c.id === clientId);
    const editingId = document.getElementById('editingOrderId').value;
    const orderId = editingId || 'ORD-' + Date.now().toString().slice(-6);

    let totalPriceCalc = activeOrderItems.reduce((acc, i) => acc + (i.packs * (i.pcsPerPack || 15) * i.price), 0);
    
    db.ref('orders/' + orderId).set({
        id: orderId, 
        clientId: client.id, 
        clientName: client.name, 
        clientPhone: client.phone || '',
        date: new Date().toLocaleDateString('ru-RU'), 
        totalPrice: totalPriceCalc, 
        status: document.getElementById('orderStatusSelect').value, 
        items: activeOrderItems
    });

    if (!editingId) clearCart();
    closeSaveOrderModal();
    alert('Сохранено!');
};

window.editOrder = function(id) {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    document.getElementById('saveOrderModal').classList.add('active');
    document.getElementById('orderModalTitle').innerText = '✏️ Редактирование ' + order.id;
    document.getElementById('editingOrderId').value = order.id;
    document.getElementById('orderStatusSelect').value = order.status || 'Новый';
    loadClientsIntoSelect(order.clientId);
    activeOrderItems = JSON.parse(JSON.stringify(order.items || []));
    renderCheckoutItemsTable();
};

window.openClientPricesModal = function(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    document.getElementById('pricingClientId').value = client.id;
    document.getElementById('pricingClientName').innerText = client.name;

    let combinations = [
        { category: 'Одноголовая', size: '30 см' },
        { category: 'Одноголовая', size: '40 см' },
        { category: 'Одноголовая', size: '50 см' },
        { category: 'Одноголовая', size: '60 см' },
        { category: 'Одноголовая', size: '70 см' },
        { category: 'Одноголовая', size: '80 см' },
        { category: 'Одноголовая', size: '90 см' },
        { category: 'Одноголовая', size: '100 см' },
        { category: 'Кустовая', size: '50 см' },
        { category: 'Кустовая', size: '60 см' },
        { category: 'Кустовая', size: '70 см' },
        { category: 'Эксклюзивная', size: '60 см' },
        { category: 'Эксклюзивная', size: '70 см' }
    ];

    flowers.forEach(f => {
        if (!combinations.some(c => c.category === f.category && c.size === f.size)) {
            combinations.push({ category: f.category || 'Одноголовая', size: f.size || '60 см' });
        }
    });

    const tbody = document.getElementById('clientPricesTableBody');
    tbody.innerHTML = '';

    combinations.forEach(comb => {
        let key = `${comb.category}_${comb.size}`.replace(/\s+/g, '_');
        let savedAmd = '';
        let savedUsd = '';
        let savedCurr = 'AMD';

        if (client.customPrices && client.customPrices[key]) {
            savedAmd = client.customPrices[key].amdPrice || '';
            savedUsd = client.customPrices[key].usdPrice || '';
            savedCurr = client.customPrices[key].currency || 'AMD';
        }

        tbody.innerHTML += `
            <tr data-key="${key}" data-cat="${comb.category}" data-size="${comb.size}">
                <td><strong>${comb.category}</strong> (${comb.size})</td>
                <td><input type="number" class="form-control price-amd" value="${savedAmd}" placeholder="Цена за ед. AMD"></td>
                <td>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <input type="number" class="form-control price-usd" value="${savedUsd}" placeholder="Цена за ед. USD">
                        <select class="form-control price-curr" style="width:90px;">
                            <option value="AMD" ${savedCurr==='AMD'?'selected':''}>AMD</option>
                            <option value="USD" ${savedCurr==='USD'?'selected':''}>USD</option>
                        </select>
                    </div>
                </td>
            </tr>
        `;
    });

    document.getElementById('clientPricesModal').classList.add('active');
};

window.closeClientPricesModal = function() {
    document.getElementById('clientPricesModal').classList.remove('active');
};

window.saveClientPrices = function() {
    const clientId = document.getElementById('pricingClientId').value;
    const rows = document.querySelectorAll('#clientPricesTableBody tr');
    let customPrices = {};

    rows.forEach(row => {
        let key = row.getAttribute('data-key');
        let amdPrice = row.querySelector('.price-amd').value;
        let usdPrice = row.querySelector('.price-usd').value;
        let currency = row.querySelector('.price-curr').value;

        if (amdPrice || usdPrice) {
            customPrices[key] = {
                amdPrice: amdPrice ? Number(amdPrice) : 0,
                usdPrice: usdPrice ? Number(usdPrice) : 0,
                currency: currency
            };
        }
    });

    db.ref('clients/' + clientId + '/customPrices').set(customPrices).then(() => {
        alert('Персональные цены успешно сохранены!');
        closeClientPricesModal();
    }).catch(err => {
        alert('Ошибка: ' + err.message);
    });
};

// Стандартный английский инвойс (с ручным номером и датой)
window.printOrderInvoice = function(id) {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const client = clients.find(c => c.id === order.clientId);

    document.getElementById('customInvNumber').value = order.id;
    document.getElementById('customInvDate').value = order.date;
    document.getElementById('invClientName').innerText = order.clientName;
    
    let totalAmountUsd = 0;
    let totalAmountAmd = 0;
    let totalUnits = 0;
    let totalBoxes = order.items.length;

    const tbody = document.getElementById('invItemsTableBody');
    tbody.innerHTML = '';
    
    order.items.forEach((item, idx) => {
        const f = flowers.find(fl => fl.id === item.flowerId) || flowers.find(fl => fl.name === item.name);
        const pcsPerPack = item.pcsPerPack || (f ? f.pcsPerPack : 15) || 15;
        
        let totalPieces = item.packs * pcsPerPack;
        totalUnits += totalPieces;

        let cat = f ? f.category : (item.category || 'Одноголовая');
        let size = f ? f.size : (item.size || '60 см');
        let key = `${cat}_${size}`.replace(/\s+/g, '_');

        let pricePerPcs = item.price || 0;
        let currency = item.currency || 'AMD';

        if (client && client.customPrices && client.customPrices[key]) {
            let cp = client.customPrices[key];
            if (cp.currency === 'USD' && Number(cp.usdPrice) > 0) {
                pricePerPcs = Number(cp.usdPrice);
                currency = 'USD';
            } else if (Number(cp.amdPrice) > 0) {
                pricePerPcs = Number(cp.amdPrice);
                currency = 'AMD';
            } else if (Number(cp.usdPrice) > 0) {
                pricePerPcs = Number(cp.usdPrice);
                currency = 'USD';
            }
        }

        let sum = totalPieces * pricePerPcs;
        if (currency === 'USD') {
            totalAmountUsd += sum;
        } else {
            totalAmountAmd += sum;
        }

        let sizeNum = size ? size.replace(/[^0-9]/g, '') : '60';
        let formattedPrice = `${currency === 'USD' ? '$' : ''}${Number(pricePerPcs).toFixed(2).replace('.', ',')}`;
        let formattedSum = `${currency === 'USD' ? '$' : ''}${Number(sum).toFixed(2).replace('.', ',')}`;

        tbody.innerHTML += `
            <tr>
                <td style="border:1px solid #333; padding:5px 8px;">${item.name}</td>
                <td style="border:1px solid #333; padding:5px 8px; text-align:center;">${sizeNum}</td>
                <td style="border:1px solid #333; padding:5px 8px; text-align:center;">${totalPieces}</td>
                <td style="border:1px solid #333; padding:5px 8px; text-align:right;">${formattedPrice}</td>
                <td style="border:1px solid #333; padding:5px 8px; text-align:right;">${formattedSum}</td>
            </tr>
        `;
    });

    let mainCurrencySymbol = totalAmountUsd > 0 ? '$' : '֏';
    let mainTotalValue = totalAmountUsd > 0 ? totalAmountUsd : totalAmountAmd;

    document.getElementById('invTopAmountUsd').innerText = `${mainCurrencySymbol}${Number(mainTotalValue).toFixed(2).replace('.', ',')}`;
    document.getElementById('invTopTotalUnits').innerText = totalUnits;
    document.getElementById('inputBoxes').value = totalBoxes;

    document.getElementById('printInvoiceModal').classList.add('active');
};
window.closePrintModal = function() { document.getElementById('printInvoiceModal').classList.remove('active'); };

// Русский инвойс для СТ-1
window.printSt1Invoice = function(id) {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const client = clients.find(c => c.id === order.clientId);

    document.getElementById('st1InvOrderId').innerText = order.id;
    document.getElementById('st1InvOrderDate').innerText = order.date;
    document.getElementById('st1InvClientName').innerText = order.clientName;
    
    let totalAmountUsd = 0;
    let totalAmountAmd = 0;
    let totalUnits = 0;
    let totalBoxes = order.items.length;

    const tbody = document.getElementById('st1InvItemsTableBody');
    tbody.innerHTML = '';
    
    order.items.forEach((item, idx) => {
        const f = flowers.find(fl => fl.id === item.flowerId) || flowers.find(fl => fl.name === item.name);
        const pcsPerPack = item.pcsPerPack || (f ? f.pcsPerPack : 15) || 15;
        
        let totalPieces = item.packs * pcsPerPack;
        totalUnits += totalPieces;

        let cat = f ? f.category : (item.category || 'Одноголовая');
        let size = f ? f.size : (item.size || '60 см');
        let key = `${cat}_${size}`.replace(/\s+/g, '_');

        let pricePerPcs = item.price || 0;
        let currency = item.currency || 'AMD';

        if (client && client.customPrices && client.customPrices[key]) {
            let cp = client.customPrices[key];
            if (cp.currency === 'USD' && Number(cp.usdPrice) > 0) {
                pricePerPcs = Number(cp.usdPrice);
                currency = 'USD';
            } else if (Number(cp.amdPrice) > 0) {
                pricePerPcs = Number(cp.amdPrice);
                currency = 'AMD';
            } else if (Number(cp.usdPrice) > 0) {
                pricePerPcs = Number(cp.usdPrice);
                currency = 'USD';
            }
        }

        let sum = totalPieces * pricePerPcs;
        if (currency === 'USD') {
            totalAmountUsd += sum;
        } else {
            totalAmountAmd += sum;
        }

        let sizeNum = size ? size.replace(/[^0-9]/g, '') : '60';
        let formattedPrice = `${currency === 'USD' ? '$' : ''}${Number(pricePerPcs).toFixed(2).replace('.', ',')}`;
        let formattedSum = `${currency === 'USD' ? '$' : ''}${Number(sum).toFixed(2).replace('.', ',')}`;

        tbody.innerHTML += `
            <tr>
                <td style="border:1px solid #333; padding:5px 8px;">${item.name}</td>
                <td style="border:1px solid #333; padding:5px 8px; text-align:center;">${sizeNum}</td>
                <td style="border:1px solid #333; padding:5px 8px; text-align:center;">${totalPieces}</td>
                <td style="border:1px solid #333; padding:5px 8px; text-align:right;">${formattedPrice}</td>
                <td style="border:1px solid #333; padding:5px 8px; text-align:right;">${formattedSum}</td>
            </tr>
        `;
    });

    let mainCurrencySymbol = totalAmountUsd > 0 ? '$' : '֏';
    let mainTotalValue = totalAmountUsd > 0 ? totalAmountUsd : totalAmountAmd;

    document.getElementById('st1InvTopAmount').innerText = `${mainCurrencySymbol}${Number(mainTotalValue).toFixed(2).replace('.', ',')}`;
    document.getElementById('st1InvTopUnits').innerText = totalUnits;
    document.getElementById('st1InputBoxes').value = totalBoxes;

    document.getElementById('printSt1InvoiceModal').classList.add('active');
};
window.closeSt1PrintModal = function() { document.getElementById('printSt1InvoiceModal').classList.remove('active'); };

window.printWarehouseInvoice = function(id) {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    document.getElementById('whInvOrderId').innerText = order.id;
    document.getElementById('whInvOrderDate').innerText = order.date;
    document.getElementById('whInvClientName').innerText = order.clientName;

    const tbody = document.getElementById('whInvItemsTableBody');
    tbody.innerHTML = '';
    let totalPacks = 0, totalPieces = 0;
    let groupedByCategory = {};

    order.items.forEach((item, idx) => {
        const packs = Number(item.packs || 0);
        totalPacks += packs;
        
        const f = flowers.find(fl => fl.id === item.flowerId) || flowers.find(fl => fl.name === item.name);
        const pcs = item.pcsPerPack || (f ? f.pcsPerPack : 15) || 15;
        const itemPieces = packs * pcs;
        totalPieces += itemPieces;

        let cat = (f ? f.category : '') || item.category || 'Одноголовая';
        let sizeVal = item.size || (f ? f.size : '60 см');
        if (!sizeVal.includes('cm') && !sizeVal.includes('см')) sizeVal += ' cm';

        if (!groupedByCategory[cat]) groupedByCategory[cat] = {};
        if (!groupedByCategory[cat][sizeVal]) {
            groupedByCategory[cat][sizeVal] = { packs: 0, pieces: 0 };
        }
        groupedByCategory[cat][sizeVal].packs += packs;
        groupedByCategory[cat][sizeVal].pieces += itemPieces;

        let sizeStr = sizeVal.includes('cm') || sizeVal.includes('см') ? sizeVal : sizeVal + ' cm';
        let cleanName = item.name.replace(/\s*\(\d+\s*(см|cm)\)/gi, '');
        let displayName = `${cleanName} (${sizeStr})`;

        tbody.innerHTML += `
            <tr>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center;">${idx+1}</td>
                <td style="border:1px solid #cbd5e1; padding:5px;"><strong>${displayName}</strong></td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center; font-weight:bold;">${packs} packs</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center;">${pcs} pcs/pack</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right; font-weight:bold;">${itemPieces} pcs.</td>
            </tr>
        `;
    });

    const catTranslations = {
        'Одноголовая': 'Single-head Roses',
        'Кустовая': 'Spray Roses',
        'Эксклюзивная': 'Exclusive Roses'
    };

    let summaryHtmlEn = '';

    for (let [catName, sizesObj] of Object.entries(groupedByCategory)) {
        let icon = '🌹';
        if (catName.includes('Кустовая')) icon = '🌿';
        if (catName.includes('Эксклюзивная')) icon = '🌟';

        let catEn = catTranslations[catName] || catName;

        let catTotalPacks = 0;
        let catTotalPieces = 0;
        let sizesHtmlEn = '';

        for (let [sizeName, data] of Object.entries(sizesObj)) {
            catTotalPacks += data.packs;
            catTotalPieces += data.pieces;
            sizesHtmlEn += `
                <div style="margin-left: 15px; font-size: 0.78rem;">
                    — ${sizeName.replace('см', 'cm')}: ${data.packs} packs / ${data.pieces} pcs.
                </div>
            `;
        }

        summaryHtmlEn += `
            <div style="margin-bottom: 8px;">
                <strong>${icon} ${catEn}:</strong>
                ${sizesHtmlEn}
                <div style="margin-left: 15px; font-size: 0.78rem; font-weight: bold; color: var(--accent); margin-top: 2px;">
                    Total for «${catEn}»: ${catTotalPacks} packs / ${catTotalPieces} pcs.
                </div>
            </div>
        `;
    }

    document.getElementById('whInvCategorySummary').innerHTML = `
        <div style="font-weight:bold; margin-bottom:6px;">Assembly Summary by Types and Sizes:</div>
        <div style="font-size: 0.8rem; line-height: 1.4;">
            ${summaryHtmlEn}
        </div>
    `;

    document.getElementById('whInvTotalPacks').innerText = totalPacks;
    document.getElementById('whInvTotalPieces').innerText = totalPieces;
    document.getElementById('printWarehouseInvoiceModal').classList.add('active');
};
window.closeWarehouseInvoiceModal = function() { document.getElementById('printWarehouseInvoiceModal').classList.remove('active'); };

window.printPackingList = function(id) {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    document.getElementById('packOrderId').innerText = order.id;
    document.getElementById('packOrderDate').innerText = order.date;
    document.getElementById('packClientName').innerText = order.clientName;

    const tbody = document.getElementById('packItemsTableBody');
    tbody.innerHTML = '';
    let total = 0;
    order.items.forEach((item, idx) => {
        total += item.packs;
        tbody.innerHTML += `
            <tr>
                <td style="border:1px solid #cbd5e1; padding:4px; text-align:center;">Box №${idx+1}</td>
                <td style="border:1px solid #cbd5e1; padding:4px;">${item.name} (${item.size})</td>
                <td style="border:1px solid #cbd5e1; padding:4px; text-align:center;">${item.packs} packs</td>
                <td style="border:1px solid #cbd5e1; padding:4px; text-align:center;">Packed</td>
            </tr>
        `;
    });
    document.getElementById('packTotalPacks').innerText = total;
    document.getElementById('printPackingModal').classList.add('active');
};
window.closePackingModal = function() { document.getElementById('printPackingModal').classList.remove('active'); };

function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = '';
    orders.forEach(o => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${o.id}</strong></td><td>${o.date}</td><td>${o.clientName}</td>
                <td><strong>${Number(o.totalPrice || 0).toLocaleString()}</strong></td>
                <td><select onchange="db.ref('orders/${o.id}').update({status:this.value})" class="form-control" style="padding:2px;"><option value="Новый" ${o.status==='Новый'?'selected':''}>Новый</option><option value="В работе" ${o.status==='В работе'?'selected':''}>В работе</option><option value="Выполнен" ${o.status==='Выполнен'?'selected':''}>Выполнен</option></select></td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="printOrderInvoice('${o.id}')">📄 Invoice (EN)</button>
                    <button class="btn btn-success btn-sm" onclick="printSt1Invoice('${o.id}')">📄 Invoice (ST-1 RU)</button>
                    <button class="btn btn-outline btn-sm" onclick="printWarehouseInvoice('${o.id}')">📋 Склад</button>
                    <button class="btn btn-outline btn-sm" onclick="printPackingList('${o.id}')">📦 Упаковка</button>
                </td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="editOrder('${o.id}')">✏️</button>
                    <button class="btn btn-dark btn-sm" onclick="if(confirm('Удалить?')) db.ref('orders/${o.id}').remove();">🗑️</button>
                </td>
            </tr>
        `;
    });
}

function populateProcurementFlowerSelect() {
    const sel = document.getElementById('procSelectFlower');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Сорт --</option>';
    flowers.forEach(f => sel.innerHTML += `<option value="${f.id}">${f.name} (${f.size})</option>`);
}

window.openNewProcurementForm = function() {
    document.getElementById('newProcurementSection').style.display = 'block';
    document.getElementById('procFormTitle').innerText = 'Новый Закуп';
    document.getElementById('editingProcId').value = '';
    document.getElementById('procDocNum').value = 'ЗКП-' + Date.now().toString().slice(-4);
    document.getElementById('procDate').value = new Date().toISOString().split('T')[0];
    currentProcurementItems = [];
    renderProcurementItemsTable();
};
window.closeNewProcurementForm = function() { document.getElementById('newProcurementSection').style.display = 'none'; };

window.addProcurementRow = function() {
    const fId = document.getElementById('procSelectFlower').value;
    const price = Number(document.getElementById('procPriceInput').value);
    const packs = Number(document.getElementById('procQtyInput').value);
    if (!fId || price <= 0 || packs <= 0) return;
    const f = flowers.find(fl => fl.id === fId);
    currentProcurementItems.push({ flowerId: f.id, name: f.name, size: f.size, price, packs, sum: price * packs });
    renderProcurementItemsTable();
};

function renderProcurementItemsTable() {
    const tbody = document.getElementById('procurementItemsTable');
    tbody.innerHTML = '';
    let total = 0;
    currentProcurementItems.forEach((item, idx) => {
        total += item.sum;
        tbody.innerHTML += `<tr><td>${item.name} (${item.size})</td><td>${item.price} ֏</td><td><strong>${item.packs} пач</strong></td><td>${item.sum.toLocaleString()} ֏</td><td><button type="button" class="btn btn-dark btn-sm" onclick="currentProcurementItems.splice(${idx},1); renderProcurementItemsTable();">🗑️</button></td></tr>`;
    });
    document.getElementById('procTotalDisplay').innerText = total.toLocaleString();
}

window.handleSaveProcurement = function(e) {
    e.preventDefault();
    if (currentProcurementItems.length === 0) return;
    const id = document.getElementById('editingProcId').value || document.getElementById('procDocNum').value;
    currentProcurementItems.forEach(item => {
        let f = flowers.find(fl => fl.id === item.flowerId);
        if (f) f.packs = (f.packs || 0) + item.packs;
    });
    db.ref('procurements/' + id).set({
        id, supplier: document.getElementById('procSupplier').value,
        date: document.getElementById('procDate').value,
        totalPrice: currentProcurementItems.reduce((a,b)=>a+b.sum,0), items: currentProcurementItems
    });
    db.ref('inventory').set(flowers);
    closeNewProcurementForm();
    alert('Закуп проведен!');
};

function renderProcurementsTable() {
    const tbody = document.getElementById('procurementsTableBody');
    tbody.innerHTML = '';
    procurements.forEach(p => {
        tbody.innerHTML += `<tr><td><strong>${p.id}</strong></td><td>${p.date}</td><td>${p.supplier}</td><td>${Number(p.totalPrice||0).toLocaleString()} ֏</td><td><button class="btn btn-dark btn-sm" onclick="db.ref('procurements/${p.id}').remove()">🗑️</button></td></tr>`;
    });
}

window.openAddClientForm = function(id = '') {
    document.getElementById('addClientSection').style.display = 'block';
    if (id) {
        const client = clients.find(c => c.id === id);
        if (client) {
            document.getElementById('clientFormTitle').innerText = 'Редактировать Клиента';
            document.getElementById('clientId').value = client.id;
            document.getElementById('clientName').value = client.name || '';
            document.getElementById('clientPhone').value = client.phone || '';
            document.getElementById('clientCity').value = client.city || '';
        }
    } else {
        document.getElementById('clientFormTitle').innerText = 'Добавить Клиента';
        document.getElementById('clientId').value = '';
        document.getElementById('clientName').value = '';
        document.getElementById('clientPhone').value = '';
        document.getElementById('clientCity').value = '';
    }
};

window.closeAddClientForm = function() { 
    document.getElementById('addClientSection').style.display = 'none'; 
};

window.handleSaveClient = function(e) {
    e.preventDefault();
    const editId = document.getElementById('clientId').value;
    const id = editId || 'CLI-' + Date.now().toString().slice(-6);
    
    const existingClient = clients.find(c => c.id === id);

    const clientData = {
        id, 
        name: document.getElementById('clientName').value,
        phone: document.getElementById('clientPhone').value, 
        city: document.getElementById('clientCity').value,
        customPrices: existingClient ? (existingClient.customPrices || {}) : {}
    };

    db.ref('clients/' + id).set(clientData).then(() => {
        closeAddClientForm();
        renderClientsTable();
        alert('Клиент успешно сохранен!');
    }).catch(err => {
        alert('Ошибка сохранения: ' + err.message);
    });
};

function renderClientsTable() {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const search = (document.getElementById('clientSearchInput')?.value || '').toLowerCase();
    
    clients.filter(c => 
        (c.name && c.name.toLowerCase().includes(search)) || 
        (c.phone && c.phone.toLowerCase().includes(search)) || 
        (c.city && c.city.toLowerCase().includes(search))
    ).forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${c.name}</strong></td>
                <td>${c.phone}</td>
                <td>${c.city || ''}</td>
                <td style="text-align:center;">
                    <button class="btn btn-outline btn-sm" onclick="openClientPricesModal('${c.id}')">⚙️ Настроить Прайс</button>
                </td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="openAddClientForm('${c.id}')">✏️</button>
                    <button class="btn btn-dark btn-sm" onclick="if(confirm('Удалить клиента?')) db.ref('clients/${c.id}').remove()">🗑️</button>
                </td>
            </tr>
        `;
    });
}

function calculateFinance() {
    let income = 0; orders.forEach(o => income += Number(o.totalPrice || 0));
    let expense = 0; procurements.forEach(p => expense += Number(p.totalPrice || 0));
    document.getElementById('finTotalIncome').innerText = income.toLocaleString() + ' ֏';
    document.getElementById('finTotalExpense').innerText = expense.toLocaleString() + ' ֏';
    document.getElementById('finNetProfit').innerText = (income - expense).toLocaleString() + ' ֏';
}

function renderCharts() {
    new Chart(document.getElementById('categoryChart').getContext('2d'), { type: 'pie', data: { labels: ['Одноголовые', 'Кустовые', 'Эксклюзивные'], datasets: [{ data: [65, 20, 15], backgroundColor: ['#d45d79', '#2e7d32', '#f59e0b'] }] } });
    new Chart(document.getElementById('revenueChart').getContext('2d'), { type: 'bar', data: { labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], datasets: [{ label: 'Выручка', data: [150, 210, 180, 250, 320, 480, 410], backgroundColor: '#d45d79' }] } });
}

function renderAdminTable() {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    flowers.forEach((f, idx) => {
        tbody.innerHTML += `
            <tr>
                <td><img src="${f.image || DEFAULT_FLOWER_IMAGE}" style="width:36px; height:36px; object-fit:cover; border-radius:4px;"></td>
                <td>${f.category || 'Одноголовая'}</td>
                <td><strong>${f.name}</strong></td>
                <td>${f.size}</td>
                <td style="text-align:center;"><input type="number" class="stock-direct-input" value="${f.pcsPerPack || 15}" onchange="flowers[${idx}].pcsPerPack=Number(this.value); db.ref('inventory').set(flowers);"></td>
                <td style="text-align:center;"><input type="number" class="stock-direct-input" value="${f.packs || 0}" onchange="flowers[${idx}].packs=Number(this.value); db.ref('inventory').set(flowers);"></td>
                <td style="text-align:center;"><input type="number" class="stock-direct-input" value="${f.stock || 0}" onchange="flowers[${idx}].stock=Number(this.value); db.ref('inventory').set(flowers);"></td>
                <td>
                    <div class="stock-action-box">
                        <input type="number" id="batch_${idx}" class="stock-num-input" value="10">
                        <button class="btn btn-success btn-sm" onclick="flowers[${idx}].packs=(flowers[${idx}].packs||0)+Number(document.getElementById('batch_${idx}').value); db.ref('inventory').set(flowers);">+</button>
                        <button class="btn btn-danger btn-sm" onclick="flowers[${idx}].packs=(flowers[${idx}].packs||0)-Number(document.getElementById('batch_${idx}').value); db.ref('inventory').set(flowers);">-</button>
                    </div>
                </td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="editFlower('${f.id}')">✏️</button>
                    <button class="btn btn-dark btn-sm" onclick="flowers=flowers.filter(x=>x.id!=='${f.id}'); db.ref('inventory').set(flowers);">🗑️</button>
                </td>
            </tr>
        `;
    });
}

window.handleFlowerFormSubmit = function(e) {
    e.preventDefault();
    const id = document.getElementById('editItemId').value || 'FLW-' + Date.now();
    const newItem = {
        id, category: document.getElementById('flowerCategory').value,
        name: document.getElementById('flowerName').value, size: document.getElementById('flowerSize').value,
        pcsPerPack: Number(document.getElementById('flowerPcsPerPack').value || 15),
        packs: Number(document.getElementById('flowerPacks').value || 0),
        stock: Number(document.getElementById('flowerStock').value || 0),
        image: document.getElementById('flowerImage').value || DEFAULT_FLOWER_IMAGE
    };
    let idx = flowers.findIndex(f => f.id === id);
    if (idx >= 0) flowers[idx] = newItem; else flowers.push(newItem);
    db.ref('inventory').set(flowers);
    showWarehouseSection('list');
};

window.editFlower = function(id) {
    const f = flowers.find(fl => fl.id === id);
    if (!f) return;
    showWarehouseSection('add');
    document.getElementById('flowerFormTitle').innerText = 'Изменить Сорт';
    document.getElementById('editItemId').value = f.id;
    document.getElementById('flowerCategory').value = f.category || 'Одноголовая';
    document.getElementById('flowerName').value = f.name;
    document.getElementById('flowerSize').value = f.size;
    document.getElementById('flowerPcsPerPack').value = f.pcsPerPack || 15;
    document.getElementById('flowerPacks').value = f.packs || 0;
    document.getElementById('flowerStock').value = f.stock || 0;
    document.getElementById('flowerImage').value = f.image || DEFAULT_FLOWER_IMAGE;
};

function renderRolesTable() {
    const tbody = document.getElementById('rolesTableBody');
    tbody.innerHTML = '';
    db.ref('users').once('value', (s) => {
        const users = s.val() ? Object.entries(s.val()) : [];
        users.forEach(([uid, u]) => {
            tbody.innerHTML += `<tr><td><strong>${u.name || ''}</strong></td><td>${u.email}</td><td>${getRoleBadge(u.role)}</td><td><select onchange="db.ref('users/${uid}').update({role:this.value})" class="form-control" style="padding:2px;"><option value="Blocked" ${u.role==='Blocked'?'selected':''}>Blocked</option><option value="Manager" ${u.role==='Manager'?'selected':''}>Manager</option><option value="Admin" ${u.role==='Admin'?'selected':''}>Admin</option></select></td></tr>`;
        });
    });
}