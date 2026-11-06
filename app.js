// Конфигурация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC5pdi-FtGyPXN3nL7Ei4LbDcTVo1WV5E",
    authDomain: "rosegarden-db.firebaseapp.com",
    databaseURL: "https://rosegarden-db-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "rosegarden-db",
    storageBucket: "rosegarden-db.appspot.com",
    messagingSenderId: "455411771135",
    appId: "1:455411771135:web:62cdd2d0197835a0f3ceca",
    measurementId: "G-ZP6YZX6CZQ"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;

// Стандартные данные цветов с надежными URL изображений для каталога
const defaultFlowers = [
    { name: "Red Naomi", grade: "60-80 cm", price: "0.46 - 0.62", img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80" },
    { name: "Ayala", grade: "60 cm", price: "0.98", img: "https://images.unsplash.com/photo-1559563362-c6731ba8f535?auto=format&fit=crop&w=600&q=80" },
    { name: "Silva Pink", grade: "50-70 cm", price: "0.88 - 1.08", img: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=600&q=80" },
    { name: "Gelato", grade: "60-90 cm", price: "0.98 - 1.24", img: "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=600&q=80" },
    { name: "Misty Bubbles", grade: "50-70 cm", price: "0.88 - 1.08", img: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80" },
    { name: "Bombastic", grade: "50-90 cm", price: "0.88 - 1.24", img: "https://images.unsplash.com/photo-1508615039623-a25605d2b022?auto=format&fit=crop&w=600&q=80" }
];

// Отслеживание состояния авторизации
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        document.getElementById('current-user-name').innerText = `Пользователь: ${user.email}`;
        document.getElementById('logout-btn').style.display = 'inline-block';
        loadCatalog();
    } else {
        currentUser = null;
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('main-content').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'none';
    }
});

// Функция входа
function login() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(email, pass)
        .catch((error) => {
            alert("Ошибка входа: " + error.message);
        });
}

// Функция выхода
function logout() {
    auth.signOut();
}

// Переключение между вкладками
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById('tab-' + tabId).style.display = 'block';
    event.currentTarget.classList.add('active');
}

// Загрузка и отображение каталога цветов
function loadCatalog() {
    const catalogContainer = document.getElementById('flower-catalog');
    if (!catalogContainer) return;

    catalogContainer.innerHTML = '';
    
    defaultFlowers.forEach(flower => {
        const card = document.createElement('div');
        card.className = 'flower-card card';
        card.innerHTML = `
            <img src="${flower.img}" alt="${flower.name}" style="width:100%; height:180px; object-fit:cover; border-radius:4px;">
            <h3>${flower.name}</h3>
            <p>Ростовка: ${flower.grade}</p>
            <p><strong>Цена:</strong> $${flower.price}</p>
        `;
        catalogContainer.appendChild(card);
    });
}
