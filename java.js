// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И ИНИЦИАЛИЗАЦИЯ ==========
    let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let users = JSON.parse(localStorage.getItem('users')) || getDefaultUsers();
    let products = JSON.parse(localStorage.getItem('products')) || getDefaultProducts();
    let reviews = JSON.parse(localStorage.getItem('reviews')) || getDefaultReviews();
    let orders = JSON.parse(localStorage.getItem('orders')) || [];
    let currentPage = 'home';
    let room3d = null;
    let selectedFurnitureType = 'table';
    let configuratorData = {
      step: 1,
      category: '',
      size: '',
      budget: '',
      material: '',
      results: []
    };
    let isDarkTheme = localStorage.getItem('darkTheme') === 'true';

    // Инициализация Coloris (с проверкой наличия библиотеки)
    if (typeof Coloris !== 'undefined') {
      Coloris({
        theme: 'default',
        themeMode: 'auto',
        format: 'hex',
        alpha: false,
        margin: 2,
        wrap: true,
        defaultColor: '#1a365d'
      });
    }

    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    document.addEventListener('DOMContentLoaded', function() {
      initTheme();
      initApp();
      setupEventListeners();
      
      // Загружаем каталог с задержкой для гарантии загрузки данных
      setTimeout(() => {
        loadCatalog();
        loadFurnitureSelector();
      }, 100);
      
      loadReviews();
      initFittingRoom();
      updateUI();
      updateCartCounter();
      
      setTimeout(() => {
        if (!currentUser && !localStorage.getItem('welcomeShown')) {
          showWelcomeModal();
          localStorage.setItem('welcomeShown', 'true');
        }
      }, 2000);
    });

    function initTheme() {
      const themeToggle = document.getElementById('theme-toggle');
      if (isDarkTheme) {
        document.body.classList.add('dark-theme');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
      } else {
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
      }
    }

    function toggleTheme() {
      isDarkTheme = !isDarkTheme;
      localStorage.setItem('darkTheme', isDarkTheme);
      document.body.classList.toggle('dark-theme');
      const themeToggle = document.getElementById('theme-toggle');
      if (isDarkTheme) {
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
      } else {
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
      }
      
      // Обновляем Coloris для новой темы
      if (typeof Coloris !== 'undefined') {
        Coloris.setInstance('.coloris', {
          theme: isDarkTheme ? 'dark' : 'default',
          themeMode: 'auto'
        });
      }
    }

    function initApp() {
      updateCartDisplay();
      updateCartCounter();
      initConfigurator();
      initMap();
    }

    function setupEventListeners() {
      // Навигация
      document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          const page = this.getAttribute('data-page');
          switchPage(page);
        });
      });
      
      // Фильтры каталога
      document.querySelectorAll('.filter-tag[data-category]').forEach(tag => {
        tag.addEventListener('click', function() {
          document.querySelectorAll('.filter-tag[data-category]').forEach(t => t.classList.remove('active'));
          this.classList.add('active');
          const category = this.getAttribute('data-category');
          filterProducts(category);
        });
      });
      
      // Админ вкладки
      document.querySelectorAll('.filter-tag[data-tab]').forEach(tab => {
        tab.addEventListener('click', function() {
          document.querySelectorAll('.filter-tag[data-tab]').forEach(t => t.classList.remove('active'));
          this.classList.add('active');
          const tabName = this.getAttribute('data-tab');
          if (currentUser && currentUser.role === 'admin') {
            showAdminTab(tabName);
          }
        });
      });
      
      // Выбор мебели в 3D примерке
      document.addEventListener('click', function(e) {
        if (e.target.closest('.furniture-option')) {
          const option = e.target.closest('.furniture-option');
          document.querySelectorAll('.furniture-option').forEach(o => o.classList.remove('selected'));
          option.classList.add('selected');
          selectedFurnitureType = option.getAttribute('data-type');
        }
      });
      
      // Обновление значений ползунков
      ['room-length', 'room-width', 'room-height'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
          element.addEventListener('input', function() {
            updateSliderValue(id, this.value);
            if (room3d) updateRoom();
          });
        }
      });
      
      // Цвета стен и пола
      document.getElementById('wall-color')?.addEventListener('input', function() {
        if (room3d) updateRoom();
      });
      
      document.getElementById('floor-color')?.addEventListener('input', function() {
        if (room3d) updateRoom();
      });
      
      // Звезды рейтинга
      document.querySelectorAll('#rating-stars i').forEach(star => {
        star.addEventListener('click', function() {
          const rating = parseInt(this.getAttribute('data-rating'));
          setRating(rating);
        });
      });
    }

    function loadFurnitureSelector() {
      const container = document.getElementById('furniture-selector');
      if (!container) return;
      
      const categories = [...new Set(products.map(p => p.category))];
      let html = '';
      
      categories.forEach(category => {
        const product = products.find(p => p.category === category);
        if (!product) return;
        
        const icon = product.icon || 'fa-cube';
        const name = getCategoryName(category);
        
        html += `
          <div class="furniture-option ${category === 'table' ? 'selected' : ''}" data-type="${category}">
            <i class="fas ${icon}"></i>
            <div>${name}</div>
          </div>`;
      });
      
      container.innerHTML = html;
      selectedFurnitureType = 'table';
      
      // Добавляем обработчик событий
      container.addEventListener('click', function(e) {
        const option = e.target.closest('.furniture-option');
        if (option) {
          document.querySelectorAll('.furniture-option').forEach(o => o.classList.remove('selected'));
          option.classList.add('selected');
          selectedFurnitureType = option.getAttribute('data-type');
          showRecommendedFurniture();
        }
      });
    }

    // ========== ОСНОВНЫЕ ФУНКЦИИ ПРИЛОЖЕНИЯ ==========
    function switchPage(pageName) {
      // Скрываем все страницы
      document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
      });
      
      // Удаляем активный класс у всех ссылок
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
      });
      
      // Находим нужную страницу
      const pageElement = document.getElementById(pageName);
      if (pageElement) {
        pageElement.classList.add('active');
        
        // Находим ссылку на эту страницу и делаем ее активной
        const navLink = document.querySelector(`[data-page="${pageName}"]`);
        if (navLink) {
          navLink.classList.add('active');
        }
        
        currentPage = pageName;
        
        // Закрываем мобильное меню
        const navLinks = document.getElementById('nav-links');
        if (navLinks) {
          navLinks.classList.remove('active');
        }
        
        // Загружаем контент для конкретной страницы
        switch (pageName) {
          case 'catalog':
            loadCatalog();
            break;
          case 'profile':
            updateProfile();
            break;
          case 'fitting':
            initFittingRoom();
            break;
          case 'configurator':
            initConfigurator();
            break;
          case 'reviews':
            loadReviews();
            break;
          case 'tracking':
            loadOrderTracking();
            break;
          case 'admin':
            if (currentUser && currentUser.role === 'admin') {
              initAdminPanel();
            } else {
              switchPage('home');
            }
            break;
          case 'contacts':
            setTimeout(initMap, 100); // Даем время для рендеринга карты
            break;
        }
      } else {
        console.error('Страница не найдена:', pageName);
      }
    }

    function toggleMobileMenu() {
      const navLinks = document.getElementById('nav-links');
      if (navLinks) {
        navLinks.classList.toggle('active');
      }
    }

    function updateUI() {
      const authBtn = document.getElementById('auth-btn');
      const logoutBtn = document.getElementById('logout-btn');
      const loginProfileBtn = document.getElementById('login-profile-btn');
      const trackingTab = document.getElementById('tracking-tab');
      const adminTab = document.getElementById('admin-tab');
      const addReviewBtn = document.getElementById('add-review-btn');
      const profileSubtitle = document.getElementById('profile-subtitle');
      
      if (currentUser) {
        authBtn.innerHTML = `<i class="fas fa-user"></i>${currentUser.name.split(' ')[0]}`;
        authBtn.onclick = function() {
          if (currentPage !== 'profile') switchPage('profile');
        };
        
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (loginProfileBtn) loginProfileBtn.style.display = 'none';
        
        if (trackingTab) trackingTab.style.display = 'block';
        if (addReviewBtn) addReviewBtn.style.display = 'block';
        
        if (profileSubtitle) profileSubtitle.textContent = currentUser.email;
        
        if (currentUser.role === 'admin' && adminTab) {
          adminTab.style.display = 'block';
        } else if (adminTab) {
          adminTab.style.display = 'none';
        }
      } else {
        authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i>Войти';
        authBtn.onclick = toggleAuthModal;
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (loginProfileBtn) loginProfileBtn.style.display = 'block';
        if (trackingTab) trackingTab.style.display = 'none';
        if (adminTab) adminTab.style.display = 'none';
        if (addReviewBtn) addReviewBtn.style.display = 'none';
        if (profileSubtitle) profileSubtitle.textContent = 'Не авторизован';
      }
    }

    // ========== КАТАЛОГ И ТОВАРЫ ==========
    function loadCatalog() {
      const container = document.getElementById('products-container');
      if (!container) return;
      
      let html = '';
      products.forEach(product => {
        const badgeClass = `badge-${product.type}`;
        const badgeText = product.type === 'standard' ? 'Стандарт' :
          product.type === 'premier' ? 'Премьер' : 'Престиж';
        const cartItem = cart.find(item => item.id === product.id);
        const inCart = cartItem ? true : false;
        const quantity = cartItem ? cartItem.quantity : 0;
        const buttonText = quantity > 0 ? `В корзине (${quantity})` : 'В корзину';
        const buttonClass = inCart ? 'btn btn-secondary added' : 'btn btn-primary';
        
        // Безопасное получение цвета
        const color = product.color || '#1a365d';
        const darkColor = darkenColor(color, 30);
        
        html += `
          <div class="product-card" data-category="${product.category}" data-type="${product.type}" data-id="${product.id}">
            <div class="product-badge ${badgeClass}">${badgeText}</div>
            <div class="product-image" style="background: linear-gradient(135deg, ${color} 0%, ${darkColor} 100%);">
              <i class="fas ${product.icon || 'fa-cube'}"></i>
            </div>
            <div class="product-content">
              <h3 class="product-title">${product.name}</h3>
              
              <div class="product-meta">
                <span class="product-material">${product.material || 'Не указано'}</span>
                <span class="product-dimensions">${product.dimensions || 'Не указано'}</span>
              </div>
              
              <p class="product-description">${product.description || ''}</p>
              
              <div class="product-price">${formatPrice(product.price)}</div>
              
              <div class="product-actions">
                <button class="${buttonClass} btn-add-cart" data-id="${product.id}">
                  <i class="fas ${inCart ? 'fa-check' : 'fa-cart-plus'}"></i>
                  ${buttonText}
                </button>
                <button class="btn btn-icon" data-id="${product.id}" data-action="details">
                  <i class="fas fa-info"></i>
                </button>
              </div>
            </div>
          </div>`;
      });
      container.innerHTML = html;
      
      // Добавляем делегирование событий
      container.addEventListener('click', function(e) {
        const addToCartBtn = e.target.closest('.btn-add-cart');
        const detailsBtn = e.target.closest('[data-action="details"]');
        
        if (addToCartBtn) {
          const productId = parseInt(addToCartBtn.getAttribute('data-id'));
          addToCart(productId);
        }
        
        if (detailsBtn) {
          const productId = parseInt(detailsBtn.getAttribute('data-id'));
          showProductDetails(productId);
        }
      });
    }

    function filterProducts(category) {
      const productElements = document.querySelectorAll('#products-container .product-card');
      productElements.forEach(product => {
        if (category === 'all' || product.getAttribute('data-category') === category) {
          product.style.display = 'block';
        } else {
          product.style.display = 'none';
        }
      });
    }

    function showProductDetails(productId) {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      
      const modal = document.createElement('div');
      modal.className = 'modal-overlay active';
      modal.innerHTML = `
        <div class="modal" style="max-width: 600px;">
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
            <i class="fas fa-times"></i>
          </button>
          
          <h2 class="modal-title">${product.name}</h2>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 25px;">
            <div style="height: 250px; background: linear-gradient(135deg, ${product.color || '#1a365d'} 0%, ${darkenColor(product.color || '#1a365d', 30)} 100%); border-radius: var(--radius); display: flex; align-items: center; justify-content: center;">
              <i class="fas ${product.icon || 'fa-cube'}" style="font-size: 100px; color: white;"></i>
            </div>
            
            <div>
              <div style="background: ${product.type === 'standard' ? 'var(--dark-gray)' : product.type === 'premier' ? 'var(--primary)' : 'var(--secondary)'}; color: ${product.type === 'prestige' ? '#000' : 'white'}; padding: 8px 20px; border-radius: 20px; display: inline-block; font-weight: 700; margin-bottom: 15px;">
                ${product.type === 'standard' ? 'Стандарт' : product.type === 'premier' ? 'Премьер' : 'Престиж'}
              </div>
              
              <div style="font-size: 32px; font-weight: 700; color: var(--primary); margin-bottom: 20px;">
                ${formatPrice(product.price)}
              </div>
              
              <div style="margin-bottom: 15px;">
                <strong>Материалы:</strong> ${product.material || 'Не указано'}
              </div>
              
              <div style="margin-bottom: 15px;">
                <strong>Размеры:</strong> ${product.dimensions || 'Не указано'}
              </div>
              
              <div style="margin-bottom: 20px;">
                <strong>Категория:</strong> ${getCategoryName(product.category)}
              </div>
            </div>
          </div>
          
          <div style="margin-bottom: 25px;">
            <h3 style="margin-bottom: 10px; color: var(--text-color);">Описание</h3>
            <p style="line-height: 1.6; color: var(--text-secondary);">${product.description || ''}</p>
          </div>
          
          <button class="btn btn-secondary" onclick="addToCart(${product.id}); this.closest('.modal-overlay').remove();" style="width: 100%; padding: 16px;">
            <i class="fas fa-cart-plus"></i>Добавить в корзину
          </button>
        </div>`;
      
      document.body.appendChild(modal);
    }

    function getCategoryName(category) {
      const categories = {
        'table': 'Стол',
        'chair': 'Стул',
        'wardrobe': 'Шкаф',
        'bed': 'Кровать',
        'shelf': 'Полка',
        'kitchen': 'Кухня',
        'sofa': 'Диван',
        'cabinet': 'Тумба',
        'dresser': 'Комод',
        'all': 'Все товары'
      };
      return categories[category] || category;
    }

    // ========== КОРЗИНА ==========
    function toggleCart() {
      document.getElementById('cart-overlay').classList.toggle('active');
      document.getElementById('cart-sidebar').classList.toggle('active');
      updateCartDisplay();
    }

    function addToCart(productId) {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      
      const existingItem = cart.find(item => item.id === productId);
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        cart.push({
          id: product.id,
          quantity: 1
        });
      }
      
      localStorage.setItem('cart', JSON.stringify(cart));
      updateCartDisplay();
      updateCartCounter();
      loadCatalog();
      showNotification(`"${product.name}" добавлен в корзину`, 'success');
    }

    function updateCartItem(productId, delta) {
      const itemIndex = cart.findIndex(item => item.id === productId);
      if (itemIndex === -1) return;
      
      cart[itemIndex].quantity += delta;
      if (cart[itemIndex].quantity <= 0) {
        cart.splice(itemIndex, 1);
      }
      
      localStorage.setItem('cart', JSON.stringify(cart));
      updateCartDisplay();
      updateCartCounter();
      loadCatalog();
    }

    function removeFromCart(productId) {
      cart = cart.filter(item => item.id !== productId);
      localStorage.setItem('cart', JSON.stringify(cart));
      updateCartDisplay();
      updateCartCounter();
      loadCatalog();
      showNotification('Товар удален из корзины', 'info');
    }

    function updateCartDisplay() {
      const container = document.getElementById('cart-content');
      const totalElement = document.getElementById('cart-total');
      const countElement = document.getElementById('cart-count');
      
      if (!cart || cart.length === 0) {
        container.innerHTML = `
          <div class="cart-empty">
            <i class="fas fa-shopping-cart cart-empty-icon"></i>
            <h3>Корзина пуста</h3>
            <p>Добавьте товары из каталога</p>
          </div>
        `;
        totalElement.textContent = '0 ₽';
        if (countElement) countElement.textContent = '0';
        return;
      }
      
      let html = '<div class="cart-items">';
      let total = 0;
      let totalItems = 0;
      
      cart.forEach(item => {
        const product = products.find(p => p.id === item.id);
        if (!product) return;
        
        const itemTotal = product.price * item.quantity;
        total += itemTotal;
        totalItems += item.quantity;
        
        // Безопасное получение цвета
        const color = product.color || '#1a365d';
        const darkColor = darkenColor(color, 30);
        
        html += `
          <div class="cart-item">
            <div class="cart-item-image" style="background: linear-gradient(135deg, ${color} 0%, ${darkColor} 100%);">
              <i class="fas ${product.icon || 'fa-cube'}"></i>
            </div>
            <div class="cart-item-info">
              <h4 class="cart-item-title">${product.name}</h4>
              <div class="cart-item-price">${formatPrice(product.price)}</div>
              <div class="cart-item-actions">
                <div class="quantity-control">
                  <button class="quantity-btn" onclick="updateCartItem(${item.id}, -1)">
                    <i class="fas fa-minus"></i>
                  </button>
                  <span style="font-weight: 600; min-width: 30px; text-align: center;">${item.quantity}</span>
                  <button class="quantity-btn" onclick="updateCartItem(${item.id}, 1)">
                    <i class="fas fa-plus"></i>
                  </button>
                </div>
                <button class="btn btn-icon" onclick="removeFromCart(${item.id})" style="background: #fee; color: var(--danger);">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>`;
      });
      
      html += '</div>';
      container.innerHTML = html;
      totalElement.textContent = formatPrice(total);
      if (countElement) countElement.textContent = totalItems;
    }

    function updateCartCounter() {
      if (!cart || !Array.isArray(cart)) {
        const cartCount = document.getElementById('cart-count');
        if (cartCount) {
          cartCount.textContent = '0';
        }
        return;
      }
      
      const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const cartCount = document.getElementById('cart-count');
      if (cartCount) {
        cartCount.textContent = totalItems;
      }
    }

    function checkout() {
      if (!cart || cart.length === 0) {
        showNotification('Корзина пуста', 'error');
        return;
      }
      
      if (!currentUser) {
        toggleAuthModal();
        showNotification('Для оформления заказа необходимо авторизоваться', 'info');
        return;
      }
      
      const total = cart.reduce((sum, item) => {
        const product = products.find(p => p.id === item.id);
        return sum + (product ? product.price * item.quantity : 0);
      }, 0);
      
      const order = {
        id: Date.now(),
        userId: currentUser.id,
        userName: currentUser.name,
        items: [...cart],
        total: total,
        status: 'processing',
        date: new Date().toISOString().split('T')[0],
        estimatedDelivery: getDeliveryDate()
      };
      
      orders.push(order);
      localStorage.setItem('orders', JSON.stringify(orders));
      
      if (currentUser) {
        currentUser.totalSpent = (currentUser.totalSpent || 0) + total;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        const userIndex = users.findIndex(u => u.id === currentUser.id);
        if (userIndex !== -1) {
          users[userIndex] = currentUser;
          localStorage.setItem('users', JSON.stringify(users));
        }
      }
      
      cart = [];
      localStorage.setItem('cart', JSON.stringify(cart));
      toggleCart();
      updateCartDisplay();
      updateCartCounter();
      loadCatalog();
      
      showNotification(`Заказ оформлен на сумму ${formatPrice(total)}!`, 'success');
      
      setTimeout(() => {
        alert(`Заказ №${order.id} оформлен!\n\nСумма: ${formatPrice(total)}\nДата оформления: ${order.date}\nПримерная дата доставки: ${order.estimatedDelivery}\n\nСтатус заказа можно отслеживать в личном кабинете.`);
        if (currentPage === 'profile') {
          updateProfile();
        }
      }, 500);
    }

    // ========== АВТОРИЗАЦИЯ И ПРОФИЛЬ ==========
    function toggleAuthModal() {
      const modal = document.getElementById('auth-modal');
      modal.classList.toggle('active');
      showLoginForm();
    }

    function showLoginForm() {
      document.getElementById('login-form').style.display = 'block';
      document.getElementById('register-form').style.display = 'none';
    }

    function showRegisterForm() {
      document.getElementById('login-form').style.display = 'none';
      document.getElementById('register-form').style.display = 'block';
    }

    function login() {
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      
      if (!email || !password) {
        showNotification('Заполните все поля', 'error');
        return;
      }
      
      if (email === 'admin58' && password === '585858') {
        const adminUser = users.find(u => u.role === 'admin') || users[0];
        currentUser = adminUser;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        toggleAuthModal();
        updateUI();
        updateProfile();
        showNotification('Администратор вошел в систему', 'success');
        return;
      }
      
      const user = users.find(u => u.email === email && u.password === password);
      if (user) {
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        toggleAuthModal();
        updateUI();
        updateProfile();
        showNotification('Успешный вход в систему', 'success');
      } else {
        showNotification('Неверный email или пароль', 'error');
      }
    }

    function register() {
      const name = document.getElementById('register-name').value;
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;
      
      if (!name || !email || !password) {
        showNotification('Заполните все поля', 'error');
        return;
      }
      
      if (users.some(u => u.email === email)) {
        showNotification('Пользователь с таким email уже существует', 'error');
        return;
      }
      
      const newUser = {
        id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
        name: name,
        email: email,
        password: password,
        role: 'user',
        totalSpent: 0,
        registrationDate: new Date().toISOString().split('T')[0]
      };
      
      users.push(newUser);
      localStorage.setItem('users', JSON.stringify(users));
      currentUser = newUser;
      localStorage.setItem('currentUser', JSON.stringify(newUser));
      toggleAuthModal();
      updateUI();
      updateProfile();
      showNotification('Регистрация прошла успешно!', 'success');
    }

    function logout() {
      currentUser = null;
      localStorage.removeItem('currentUser');
      updateUI();
      updateProfile();
      showNotification('Вы вышли из системы', 'info');
      
      if (currentPage === 'profile' || currentPage === 'tracking' || currentPage === 'admin') {
        switchPage('home');
      }
    }

    function updateProfile() {
      const profileName = document.getElementById('profile-name');
      const profileEmail = document.getElementById('profile-email');
      const profileAvatar = document.getElementById('profile-avatar');
      const loyaltyCard = document.getElementById('loyalty-card');
      const logoutBtn = document.getElementById('logout-btn');
      const loginProfileBtn = document.getElementById('login-profile-btn');
      const ordersList = document.getElementById('orders-list');
      
      if (currentUser) {
        profileName.textContent = currentUser.name;
        profileEmail.textContent = currentUser.email;
        profileAvatar.innerHTML = currentUser.name.charAt(0);
        
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (loginProfileBtn) loginProfileBtn.style.display = 'none';
        
        if (loyaltyCard) {
          loyaltyCard.classList.remove('hidden');
          updateLoyaltyCard();
        }
        
        if (ordersList) {
          const userOrders = orders.filter(o => o.userId === currentUser.id);
          if (userOrders.length === 0) {
            ordersList.innerHTML = `
              <i class="fas fa-box-open" style="font-size: 60px; margin-bottom: 20px; opacity: 0.3;"></i>
              <p>Заказов пока нет</p>
            `;
          } else {
            let html = '';
            userOrders.slice(0, 5).forEach(order => {
              const statusColor = getStatusColor(order.status);
              html += `
                <div style="background: var(--surface-color); border-radius: var(--radius); padding: 20px; margin-bottom: 15px; border: 1px solid var(--border-color);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                      <strong>Заказ №${order.id}</strong>
                      <div style="font-size: 14px; color: var(--gray);">${order.date}</div>
                    </div>
                    <span style="background: ${statusColor}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 14px;">
                      ${getStatusText(order.status)}
                    </span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>${order.items.length} товар(ов)</div>
                    <div style="font-weight: 700; color: var(--primary);">${formatPrice(order.total)}</div>
                  </div>
                </div>`;
            });
            ordersList.innerHTML = html;
          }
        }
      } else {
        profileName.textContent = 'Гость';
        profileEmail.textContent = 'Для входа нажмите "Войти"';
        profileAvatar.innerHTML = '<i class="fas fa-user"></i>';
        
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (loginProfileBtn) loginProfileBtn.style.display = 'block';
        
        if (loyaltyCard) loyaltyCard.classList.add('hidden');
        
        if (ordersList) {
          ordersList.innerHTML = `
            <i class="fas fa-box-open" style="font-size: 60px; margin-bottom: 20px; opacity: 0.3;"></i>
            <p>Для просмотра истории заказов необходимо авторизоваться</p>
          `;
        }
      }
    }

    function updateLoyaltyCard() {
      if (!currentUser) return;
      
      const totalSpent = currentUser.totalSpent || 0;
      let level = 'bronze';
      let discount = 0;
      let nextLevel = '100 000 ₽';
      let progress = (totalSpent / 100000) * 100;
      
      if (totalSpent >= 500000) {
        level = 'gold';
        discount = 5;
        nextLevel = 'Максимальный уровень';
        progress = 100;
      } else if (totalSpent >= 250000) {
        level = 'silver';
        discount = 2.5;
        nextLevel = '500 000 ₽';
        progress = ((totalSpent - 250000) / 250000) * 100;
      } else if (totalSpent >= 100000) {
        level = 'silver';
        discount = 1;
        nextLevel = '250 000 ₽';
        progress = ((totalSpent - 100000) / 150000) * 100;
      }
      
      const card = document.getElementById('loyalty-card');
      const title = document.getElementById('loyalty-title');
      const progressBar = document.getElementById('loyalty-progress');
      const discountPercent = document.getElementById('discount-percent');
      const nextLevelSpan = document.getElementById('next-level');
      
      if (card && title) {
        title.textContent =
          level === 'gold' ? 'Золотой уровень' :
          level === 'silver' ? 'Серебряный уровень' : 'Бронзовый уровень';
        
        // Установка класса для текстуры
        card.className = 'loyalty-card ' + level;
      }
      
      if (progressBar) progressBar.style.width = Math.min(progress, 100) + '%';
      if (discountPercent) discountPercent.textContent = discount + '%';
      if (nextLevelSpan) nextLevelSpan.textContent = nextLevel;
    }

    // ========== 3D ПРИМЕРКА ==========
    function initFittingRoom() {
      room3d = {
        length: 4,
        width: 3,
        height: 2.5,
        furniture: [],
        rotation: -15
      };
      updateRoom();
      showRecommendedFurniture();
    }

    function updateSliderValue(sliderId, value) {
      const displayElement = document.getElementById(sliderId.replace('room-', '') + '-value');
      if (displayElement) {
        displayElement.textContent = value + (sliderId.includes('height') ? ' м' : ' м');
      }
    }

    function updateRoom() {
      if (!room3d) return;
      
      room3d.length = parseFloat(document.getElementById('room-length').value);
      room3d.width = parseFloat(document.getElementById('room-width').value);
      room3d.height = parseFloat(document.getElementById('room-height').value);
      
      const container = document.getElementById('room-3d');
      if (!container) return;
      
      const scale = 50;
      const width = room3d.width * scale;
      const length = room3d.length * scale;
      const height = room3d.height * scale;
      
      container.innerHTML = '';
      container.style.width = width + 'px';
      container.style.height = length + 'px';
      container.style.transform = `rotateY(${room3d.rotation}deg)`;
      
      const floor = document.createElement('div');
      floor.className = 'room-walls';
      floor.style.width = width + 'px';
      floor.style.height = length + 'px';
      floor.style.bottom = '0';
      floor.style.left = '0';
      floor.style.background = document.getElementById('floor-color').value || '#8B4513';
      floor.style.transform = `rotateX(90deg) translateZ(${-height/2}px)`;
      container.appendChild(floor);
      
      const walls = [{
          width: width,
          height: height,
          transform: `translateZ(${length/2}px)`
        },
        {
          width: width,
          height: height,
          transform: `rotateY(90deg) translateZ(${width/2}px)`
        },
        {
          width: length,
          height: height,
          transform: `rotateY(-90deg) translateZ(${length/2}px)`
        }
      ];
      
      const wallColor = document.getElementById('wall-color').value || '#f5f5f5';
      
      walls.forEach((wall, index) => {
        const wallElement = document.createElement('div');
        wallElement.className = 'room-walls';
        wallElement.style.width = wall.width + 'px';
        wallElement.style.height = wall.height + 'px';
        wallElement.style.background = wallColor;
        wallElement.style.transform = wall.transform;
        container.appendChild(wallElement);
      });
      
      room3d.furniture.forEach(item => {
        addFurnitureToRoom(item.type, item.x, item.y, item.width, item.height);
      });
    }

    function addSelectedFurniture() {
      if (!selectedFurnitureType || !room3d) return;
      
      const furnitureSizes = {
        'table': { width: 1.2, height: 0.8 },
        'chair': { width: 0.5, height: 0.5 },
        'wardrobe': { width: 0.8, height: 2.0 },
        'bed': { width: 1.6, height: 2.0 },
        'shelf': { width: 0.5, height: 1.5 },
        'kitchen': { width: 2.0, height: 0.6 },
        'sofa': { width: 1.8, height: 0.8 },
        'cabinet': { width: 0.6, height: 0.8 },
        'dresser': { width: 1.0, height: 0.9 }
      };
      
      const size = furnitureSizes[selectedFurnitureType] || { width: 1, height: 1 };
      
      // Проверяем, чтобы мебель помещалась в комнату
      const maxX = room3d.width - size.width;
      const maxY = room3d.length - size.height;
      
      if (maxX <= 0 || maxY <= 0) {
        showNotification('Комната слишком маленькая для этой мебели', 'error');
        return;
      }
      
      const x = Math.random() * maxX;
      const y = Math.random() * maxY;
      
      room3d.furniture.push({
        type: selectedFurnitureType,
        x: x,
        y: y,
        width: size.width,
        height: size.height
      });
      
      updateRoom();
      showNotification(`${getCategoryName(selectedFurnitureType)} добавлен в комнату`, 'success');
    }

    function addFurnitureToRoom(type, x, y, width, height) {
      const container = document.getElementById('room-3d');
      if (!container) return;
      
      const scale = 50;
      const furniture = document.createElement('div');
      furniture.className = 'furniture-item-3d';
      furniture.style.width = width * scale + 'px';
      furniture.style.height = height * scale + 'px';
      furniture.style.left = x * scale + 'px';
      furniture.style.top = y * scale + 'px';
      furniture.innerHTML = `<i class="fas ${getFurnitureIcon(type)}" style="font-size: ${Math.min(width, height) * 20}px; color: var(--secondary);"></i>`;
      
      makeDraggable3D(furniture, type, x, y, width, height);
      container.appendChild(furniture);
    }

    function makeDraggable3D(element, type, x, y, width, height) {
      let isDragging = false;
      let startX, startY;
      
      element.addEventListener('mousedown', function(e) {
        isDragging = true;
        startX = e.clientX - element.offsetLeft;
        startY = e.clientY - element.offsetTop;
        element.style.zIndex = '100';
        e.preventDefault();
      });
      
      document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        const scale = 50;
        const newLeft = e.clientX - startX;
        const newTop = e.clientY - startY;
        
        if (newLeft >= 0 && newLeft <= room3d.width * scale - width * scale &&
          newTop >= 0 && newTop <= room3d.length * scale - height * scale) {
          element.style.left = newLeft + 'px';
          element.style.top = newTop + 'px';
          
          const furnitureIndex = room3d.furniture.findIndex(f =>
            f.type === type &&
            Math.abs(f.x * scale - x * scale) < 5 &&
            Math.abs(f.y * scale - y * scale) < 5
          );
          
          if (furnitureIndex !== -1) {
            room3d.furniture[furnitureIndex].x = newLeft / scale;
            room3d.furniture[furnitureIndex].y = newTop / scale;
          }
        }
      });
      
      document.addEventListener('mouseup', function() {
        isDragging = false;
        element.style.zIndex = '10';
      });
    }

    function rotateView(direction) {
      if (!room3d) return;
      
      const container = document.getElementById('room-3d');
      if (!container) return;
      
      room3d.rotation += direction === 'left' ? -15 : 15;
      container.style.transform = `rotateY(${room3d.rotation}deg)`;
    }

    function resetView() {
      if (!room3d) return;
      
      room3d.rotation = -15;
      const container = document.getElementById('room-3d');
      if (container) {
        container.style.transform = `rotateY(${room3d.rotation}deg)`;
      }
    }

    function resetRoom() {
      if (!room3d) return;
      
      room3d.furniture = [];
      updateRoom();
      showNotification('Комната сброшена', 'info');
    }

    function getFurnitureIcon(type) {
      const product = products.find(p => p.category === type);
      return product ? product.icon : 'fa-cube';
    }

    function getFurnitureName(type) {
      const product = products.find(p => p.category === type);
      return product ? getCategoryName(product.category) : 'Мебель';
    }

    function showRecommendedFurniture() {
      const container = document.getElementById('recommended-furniture');
      if (!container) return;
      
      const recommendedProducts = products
        .filter(p => p.category === selectedFurnitureType)
        .slice(0, 3);
      
      if (recommendedProducts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray);">Нет рекомендаций для этой категории</p>';
        return;
      }
      
      let html = '';
      recommendedProducts.forEach(product => {
        const color = product.color || '#1a365d';
        const darkColor = darkenColor(color, 30);
        
        html += `
          <div style="background: var(--surface-color); border-radius: var(--radius); padding: 16px; text-align: center; border: 1px solid var(--border-color);">
            <div style="width: 60px; height: 60px; background: linear-gradient(135deg, ${color} 0%, ${darkColor} 100%); border-radius: var(--radius); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; color: white;">
              <i class="fas ${product.icon || 'fa-cube'}" style="font-size: 28px;"></i>
            </div>
            <p style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">${product.name}</p>
            <p style="color: var(--primary); font-weight: 700; margin-bottom: 12px;">${formatPrice(product.price)}</p>
            <button class="btn btn-primary" onclick="addToCart(${product.id})" style="width: 100%; padding: 10px; font-size: 14px;">
              <i class="fas fa-cart-plus"></i>В корзину
            </button>
          </div>`;
      });
      
      container.innerHTML = html;
    }

    // ========== КОНФИГУРАТОР ==========
    function initConfigurator() {
      configuratorData = {
        step: 1,
        category: '',
        size: '',
        budget: '',
        material: '',
        results: []
      };
      showConfiguratorStep(1);
    }

    function showConfiguratorStep(step) {
      configuratorData.step = step;
      const content = document.getElementById('configurator-content');
      if (!content) return;
      
      for (let i = 1; i <= 5; i++) {
        const stepElement = document.getElementById(`step-${i}`);
        if (stepElement) {
          stepElement.classList.remove('active', 'completed');
          if (i === step) {
            stepElement.classList.add('active');
          } else if (i < step) {
            stepElement.classList.add('completed');
          }
        }
      }
      
      const prevBtn = document.getElementById('prev-step');
      const nextBtn = document.getElementById('next-step');
      prevBtn.style.display = step > 1 ? 'block' : 'none';
      nextBtn.innerHTML = step === 5 ? 'Завершить<i class="fas fa-check"></i>' : 'Далее<i class="fas fa-arrow-right"></i>';
      nextBtn.onclick = step === 5 ? finishConfigurator : nextStep;
      
      let html = '';
      
      switch (step) {
        case 1:
          html = `
            <div class="step-content">
              <h3 style="text-align: center; margin-bottom: 30px; color: var(--text-color);">Какой тип мебели вас интересует?</h3>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                <div class="config-option ${configuratorData.category === 'table' ? 'selected' : ''}" onclick="selectConfigOption('category', 'table')">
                  <i class="fas fa-table" style="font-size: 48px; color: var(--primary); margin-bottom: 15px;"></i>
                  <h4>Столы</h4>
                  <p style="font-size: 14px; color: var(--text-secondary);">Обеденные, рабочие, журнальные</p>
                </div>
                <div class="config-option ${configuratorData.category === 'chair' ? 'selected' : ''}" onclick="selectConfigOption('category', 'chair')">
                  <i class="fas fa-chair" style="font-size: 48px; color: var(--primary); margin-bottom: 15px;"></i>
                  <h4>Стулья</h4>
                  <p style="font-size: 14px; color: var(--text-secondary);">Офисные, обеденные, барные</p>
                </div>
                <div class="config-option ${configuratorData.category === 'wardrobe' ? 'selected' : ''}" onclick="selectConfigOption('category', 'wardrobe')">
                  <i class="fas fa-archive" style="font-size: 48px; color: var(--primary); margin-bottom: 15px;"></i>
                  <h4>Шкафы</h4>
                  <p style="font-size: 14px; color: var(--text-secondary);">Купе, гардеробные, книжные</p>
                </div>
                <div class="config-option ${configuratorData.category === 'bed' ? 'selected' : ''}" onclick="selectConfigOption('category', 'bed')">
                  <i class="fas fa-bed" style="font-size: 48px; color: var(--primary); margin-bottom: 15px;"></i>
                  <h4>Кровати</h4>
                  <p style="font-size: 14px; color: var(--text-secondary);">Односпальные, двуспальные</p>
                </div>
                <div class="config-option ${configuratorData.category === 'shelf' ? 'selected' : ''}" onclick="selectConfigOption('category', 'shelf')">
                  <i class="fas fa-border-all" style="font-size: 48px; color: var(--primary); margin-bottom: 15px;"></i>
                  <h4>Полки</h4>
                  <p style="font-size: 14px; color: var(--text-secondary);">Настенные, напольные, модульные</p>
                </div>
                <div class="config-option ${configuratorData.category === 'kitchen' ? 'selected' : ''}" onclick="selectConfigOption('category', 'kitchen')">
                  <i class="fas fa-utensils" style="font-size: 48px; color: var(--primary); margin-bottom: 15px;"></i>
                  <h4>Кухни</h4>
                  <p style="font-size: 14px; color: var(--text-secondary);">Линейные, угловые, островные</p>
                </div>
              </div>
            </div>`;
          break;
        case 2:
          html = `
            <div class="step-content">
              <h3 style="text-align: center; margin-bottom: 30px; color: var(--text-color);">Какой размер вам нужен?</h3>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                <div class="config-option ${configuratorData.size === 'small' ? 'selected' : ''}" onclick="selectConfigOption('size', 'small')">
                  <i class="fas fa-compress-arrows-alt" style="font-size: 48px; color: var(--primary); margin-bottom: 15px;"></i>
                  <h4>Компактный</h4>
                  <p style="font-size: 14px; color: var(--text-secondary);">Для небольших помещений</p>
                </div>
                <div class="config-option ${configuratorData.size === 'medium' ? 'selected' : ''}" onclick="selectConfigOption('size', 'medium')">
                  <i class="fas fa-arrows-alt-h" style="font-size: 48px; color: var(--primary); margin-bottom: 15px;"></i>
                  <h4>Средний</h4>
                  <p style="font-size: 14px; color: var(--text-secondary);">Стандартные размеры</p>
                </div>
                <div class="config-option ${configuratorData.size === 'large' ? 'selected' : ''}" onclick="selectConfigOption('size', 'large')">
                  <i class="fas fa-expand-arrows-alt" style="font-size: 48px; color: var(--primary); margin-bottom: 15px;"></i>
                  <h4>Большой</h4>
                  <p style="font-size: 14px; color: var(--text-secondary);">Для просторных комнат</p>
                </div>
              </div>
            </div>`;
          break;
        case 3:
          html = `
            <div class="step-content">
              <h3 style="text-align: center; margin-bottom: 30px; color: var(--text-color);">Какой материал предпочитаете?</h3>
              <div class="material-selection" style="grid-template-columns: repeat(3, 1fr);">
                <div class="material-option ${configuratorData.material === 'Дерево' ? 'selected' : ''}" onclick="selectConfigOption('material', 'Дерево')">
                  <i class="fas fa-tree" style="font-size: 36px; color: var(--primary); margin-bottom: 10px;"></i>
                  <h4>Дерево</h4>
                  <p style="font-size: 12px; color: var(--text-secondary);">Натуральное дерево</p>
                </div>
                <div class="material-option ${configuratorData.material === 'Металл' ? 'selected' : ''}" onclick="selectConfigOption('material', 'Металл')">
                  <i class="fas fa-cog" style="font-size: 36px; color: var(--primary); margin-bottom: 10px;"></i>
                  <h4>Металл</h4>
                  <p style="font-size: 12px; color: var(--text-secondary);">Сталь, алюминий</p>
                </div>
                <div class="material-option ${configuratorData.material === 'Стекло' ? 'selected' : ''}" onclick="selectConfigOption('material', 'Стекло')">
                  <i class="fas fa-glass-whiskey" style="font-size: 36px; color: var(--primary); margin-bottom: 10px;"></i>
                  <h4>Стекло</h4>
                  <p style="font-size: 12px; color: var(--text-secondary);">Закаленное стекло</p>
                </div>
                <div class="material-option ${configuratorData.material === 'Пластик' ? 'selected' : ''}" onclick="selectConfigOption('material', 'Пластик')">
                  <i class="fas fa-vial" style="font-size: 36px; color: var(--primary); margin-bottom: 10px;"></i>
                  <h4>Пластик</h4>
                  <p style="font-size: 12px; color: var(--text-secondary);">Высококачественный</p>
                </div>
                <div class="material-option ${configuratorData.material === 'Комбинированный' ? 'selected' : ''}" onclick="selectConfigOption('material', 'Комбинированный')">
                  <i class="fas fa-th" style="font-size: 36px; color: var(--primary); margin-bottom: 10px;"></i>
                  <h4>Комбинированный</h4>
                  <p style="font-size: 12px; color: var(--text-secondary);">Сочетание материалов</p>
                </div>
              </div>
            </div>`;
          break;
        case 4:
          html = `
            <div class="step-content">
              <h3 style="text-align: center; margin-bottom: 30px; color: var(--text-color);">Какой бюджет вы рассматриваете?</h3>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                <div class="config-option ${configuratorData.budget === 'economy' ? 'selected' : ''}" onclick="selectConfigOption('budget', 'economy')">
                  <div style="font-size: 32px; font-weight: 700; color: var(--primary); margin-bottom: 15px;">до 20 000 ₽</div>
                  <h4>Эконом</h4>
                  <p style="font-size: 14px; color: var(--text-secondary);">Бюджетные варианты</p>
                </div>
                <div class="config-option ${configuratorData.budget === 'standard' ? 'selected' : ''}" onclick="selectConfigOption('budget', 'standard')">
                  <div style="font-size: 32px; font-weight: 700; color: var(--primary); margin-bottom: 15px;">20-50 000 ₽</div>
                  <h4>Стандарт</h4>
                  <p style="font-size: 14px; color: var(--text-secondary);">Оптимальное соотношение</p>
                </div>
                <div class="config-option ${configuratorData.budget === 'premium' ? 'selected' : ''}" onclick="selectConfigOption('budget', 'premium')">
                  <div style="font-size: 32px; font-weight: 700; color: var(--primary); margin-bottom: 15px;">от 50 000 ₽</div>
                  <h4>Премиум</h4>
                  <p style="font-size: 14px; color: var(--text-secondary);">Высокое качество</p>
                </div>
              </div>
            </div>`;
          break;
        case 5:
          const results = getConfiguratorResults();
          configuratorData.results = results;
          
          html = `
            <div class="step-content">
              <h3 style="text-align: center; margin-bottom: 30px; color: var(--text-color);">Подходящие варианты для вас</h3>`;
          
          if (results.length === 0) {
            html += `
              <div style="text-align: center; padding: 40px 20px;">
                <i class="fas fa-search" style="font-size: 60px; color: var(--gray); opacity: 0.5; margin-bottom: 20px;"></i>
                <h4 style="color: var(--text-color); margin-bottom: 15px;">Не найдено точных совпадений</h4>
                <p style="color: var(--text-secondary); margin-bottom: 25px;">Вот несколько рекомендуемых товаров:</p>
              </div>`;
            
            // Показываем рекомендуемые товары из выбранной категории или все товары
            const fallbackProducts = configuratorData.category ? 
              products.filter(p => p.category === configuratorData.category).slice(0, 3) : 
              products.slice(0, 3);
              
            results.push(...fallbackProducts);
          }
          
          if (results.length > 0) {
            html += `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">`;
            
            results.slice(0, 3).forEach(product => {
              // Безопасное получение цвета
              const color = product.color || '#1a365d';
              const darkColor = darkenColor(color, 30);
              
              html += `
                <div class="card" style="text-align: center;">
                  <div style="width: 80px; height: 80px; background: linear-gradient(135deg, ${color} 0%, ${darkColor} 100%); border-radius: var(--radius); display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; color: white;">
                    <i class="fas ${product.icon || 'fa-cube'}" style="font-size: 40px;"></i>
                  </div>
                  <h4 style="margin-bottom: 10px;">${product.name}</h4>
                  <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px;">${product.material || 'Не указано'}</p>
                  <div style="font-size: 24px; font-weight: 700; color: var(--primary); margin-bottom: 15px;">
                    ${formatPrice(product.price)}
                  </div>
                  <div style="display: flex; gap: 10px;">
                    <button class="btn btn-secondary" onclick="addToCart(${product.id})" style="flex: 1; padding: 10px;">
                      <i class="fas fa-cart-plus"></i>
                    </button>
                    <button class="btn btn-outline" onclick="switchPage('catalog')" style="flex: 1; padding: 10px;">
                      <i class="fas fa-eye"></i>
                    </button>
                  </div>
                </div>`;
            });
            
            html += `</div>`;
          }
          
          html += `</div>`;
          break;
      }
      
      content.innerHTML = html;
    }

    function selectConfigOption(type, value) {
      configuratorData[type] = value;
      showConfiguratorStep(configuratorData.step);
    }

    function nextStep() {
      if (configuratorData.step < 5) {
        let isValid = false;
        switch (configuratorData.step) {
          case 1:
            isValid = configuratorData.category !== '';
            break;
          case 2:
            isValid = configuratorData.size !== '';
            break;
          case 3:
            isValid = configuratorData.material !== '';
            break;
          case 4:
            isValid = configuratorData.budget !== '';
            break;
        }
        
        if (isValid) {
          showConfiguratorStep(configuratorData.step + 1);
        } else {
          showNotification('Пожалуйста, сделайте выбор на текущем шаге', 'error');
        }
      }
    }

    function prevStep() {
      if (configuratorData.step > 1) {
        showConfiguratorStep(configuratorData.step - 1);
      }
    }

    function finishConfigurator() {
      if (configuratorData.results.length > 0) {
        showNotification('Найдено ' + configuratorData.results.length + ' подходящих товаров!', 'success');
        switchPage('catalog');
      } else {
        showNotification('Попробуйте изменить критерии поиска', 'info');
      }
    }

    function getConfiguratorResults() {
      let filteredProducts = [...products];
      
      if (configuratorData.category) {
        filteredProducts = filteredProducts.filter(p => p.category === configuratorData.category);
      }
      
      if (configuratorData.material) {
        filteredProducts = filteredProducts.filter(p => {
          if (!p.material) return false;
          return p.material.toLowerCase().includes(configuratorData.material.toLowerCase());
        });
      }
      
      if (configuratorData.budget) {
        if (configuratorData.budget === 'economy') {
          filteredProducts = filteredProducts.filter(p => p.price < 20000);
        } else if (configuratorData.budget === 'standard') {
          filteredProducts = filteredProducts.filter(p => p.price >= 20000 && p.price <= 50000);
        } else if (configuratorData.budget === 'premium') {
          filteredProducts = filteredProducts.filter(p => p.price > 50000);
        }
      }
      
      return filteredProducts.slice(0, 3);
    }

    // ========== ОТЗЫВЫ ==========
    function loadReviews() {
      const container = document.getElementById('reviews-list');
      if (!container) return;
      
      let html = '';
      reviews.forEach(review => {
        const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
        const date = new Date(review.date).toLocaleDateString('ru-RU');
        
        html += `
          <div class="review-card">
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
              <div style="width: 50px; height: 50px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                ${review.userName.charAt(0)}
              </div>
              <div>
                <h4 style="margin-bottom: 5px; color: var(--text-color);">${review.userName}</h4>
                <p style="font-size: 14px; color: var(--gray);">${date}</p>
              </div>
            </div>
            <div class="stars">${stars}</div>
            <p style="line-height: 1.6; color: var(--text-secondary);">${review.text}</p>
          </div>`;
      });
      
      container.innerHTML = html;
    }

    function showReviewModal() {
      if (!currentUser) {
        toggleAuthModal();
        showNotification('Для добавления отзыва необходимо авторизоваться', 'info');
        return;
      }
      
      document.getElementById('review-modal').classList.add('active');
    }

    function closeReviewModal() {
      document.getElementById('review-modal').classList.remove('active');
      document.getElementById('review-text').value = '';
      setRating(5);
    }

    function setRating(rating) {
      document.getElementById('review-rating').value = rating;
      const stars = document.querySelectorAll('#rating-stars i');
      stars.forEach((star, index) => {
        if (index < rating) {
          star.style.color = '#fbbf24';
        } else {
          star.style.color = '#ddd';
        }
      });
    }

    function submitReview() {
      if (!currentUser) return;
      
      const rating = parseInt(document.getElementById('review-rating').value);
      const text = document.getElementById('review-text').value.trim();
      
      if (!text) {
        showNotification('Введите текст отзыва', 'error');
        return;
      }
      
      if (text.length < 10) {
        showNotification('Отзыв должен содержать не менее 10 символов', 'error');
        return;
      }
      
      const newReview = {
        id: reviews.length > 0 ? Math.max(...reviews.map(r => r.id)) + 1 : 1,
        userId: currentUser.id,
        userName: currentUser.name,
        rating: rating,
        text: text,
        date: new Date().toISOString().split('T')[0]
      };
      
      reviews.unshift(newReview);
      localStorage.setItem('reviews', JSON.stringify(reviews));
      closeReviewModal();
      loadReviews();
      showNotification('Отзыв успешно опубликован!', 'success');
    }

    // ========== КАРТА ==========
    function initMap() {
      const mapElement = document.getElementById('map');
      if (!mapElement || mapElement._leaflet_id) return;
      
      try {
        const map = L.map('map').setView([55.7558, 37.6173], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);
        
        L.marker([55.7558, 37.6173])
          .addTo(map)
          .bindPopup(`
            <strong>Удобство 58</strong><br>
            ул. Мебельная, д. 58<br>
            Москва, Россия<br>
            <a href="tel:+78005555858">+7 (800) 555-58-58</a>
          `)
          .openPopup();
      } catch (error) {
        console.log('Карта не загружена:', error);
        mapElement.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--gray);">Карта временно недоступна</p>';
      }
    }

    // ========== АДМИН ПАНЕЛЬ ==========
    function initAdminPanel() {
      showAdminTab('products');
    }

    function showAdminTab(tabName) {
      const content = document.getElementById('admin-content');
      if (!content) return;
      
      switch (tabName) {
        case 'products':
          content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <h3 style="color: var(--text-color);">Управление товарами</h3>
              <button class="btn btn-secondary" onclick="showAdminProductModal()">
                <i class="fas fa-plus"></i>Добавить товар
              </button>
            </div>
            <div id="admin-products-list">
              <!-- Список товаров -->
            </div>`;
          loadAdminProducts();
          break;
        case 'orders':
          content.innerHTML = `
            <h3 style="color: var(--text-color); margin-bottom: 20px;">Управление заказами</h3>
            <div id="admin-orders-list">
              <!-- Список заказов -->
            </div>`;
          loadAdminOrders();
          break;
        case 'reviews-admin':
          content.innerHTML = `
            <h3 style="color: var(--text-color); margin-bottom: 20px;">Управление отзывами</h3>
            <div id="admin-reviews-list">
              <!-- Список отзывов -->
            </div>`;
          loadAdminReviews();
          break;
        case 'users':
          content.innerHTML = `
            <h3 style="color: var(--text-color); margin-bottom: 20px;">Пользователи</h3>
            <div id="admin-users-list">
              <!-- Список пользователей -->
            </div>`;
          loadAdminUsers();
          break;
      }
    }

    function loadAdminProducts() {
      const container = document.getElementById('admin-products-list');
      if (!container) return;
      
      if (products.length === 0) {
        container.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 40px;">Товары не найдены</p>';
        return;
      }
      
      let html = '<div style="display: grid; gap: 15px;">';
      products.forEach(product => {
        const badgeColor = product.type === 'standard' ? 'var(--dark-gray)' : product.type === 'premier' ? 'var(--primary)' : 'var(--secondary)';
        // Безопасное получение цвета
        const color = product.color || '#1a365d';
        const darkColor = darkenColor(color, 30);
        
        html += `
          <div style="background: var(--surface-color); border-radius: var(--radius); padding: 20px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 15px;">
              <div style="width: 50px; height: 50px; background: linear-gradient(135deg, ${color} 0%, ${darkColor} 100%); border-radius: var(--radius); display: flex; align-items: center; justify-content: center; color: white;">
                <i class="fas ${product.icon || 'fa-cube'}"></i>
              </div>
              <div>
                <h4 style="margin-bottom: 5px; color: var(--text-color);">${product.name}</h4>
                <div style="display: flex; gap: 10px; font-size: 14px;">
                  <span style="background: ${badgeColor}; color: ${product.type === 'prestige' ? '#000' : 'white'}; padding: 4px 12px; border-radius: 12px;">
                    ${product.type === 'standard' ? 'Стандарт' : product.type === 'premier' ? 'Премьер' : 'Престиж'}
                  </span>
                  <span style="color: var(--gray);">${product.category}</span>
                  <span style="color: var(--primary); font-weight: 700;">${formatPrice(product.price)}</span>
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 10px;">
              <button class="btn btn-icon" onclick="editAdminProduct(${product.id})" style="background: var(--primary); color: white;">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-icon" onclick="deleteAdminProduct(${product.id})" style="background: var(--danger); color: white;">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>`;
      });
      
      html += '</div>';
      container.innerHTML = html;
    }

    function editAdminProduct(productId) {
      showNotification('Редактирование товара', 'info');
    }

    function deleteAdminProduct(productId) {
      if (confirm('Вы уверены, что хотите удалить этот товар?')) {
        products = products.filter(p => p.id !== productId);
        localStorage.setItem('products', JSON.stringify(products));
        loadAdminProducts();
        showNotification('Товар удален', 'success');
      }
    }

    function loadAdminOrders() {
      const container = document.getElementById('admin-orders-list');
      if (!container) return;
      
      if (orders.length === 0) {
        container.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 40px;">Заказы не найдены</p>';
        return;
      }
      
      let html = '<div style="display: grid; gap: 15px;">';
      orders.forEach(order => {
        const statusColor = getStatusColor(order.status);
        html += `
          <div style="background: var(--surface-color); border-radius: var(--radius); padding: 20px; border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <div>
                <h4 style="color: var(--text-color); margin-bottom: 5px;">Заказ №${order.id}</h4>
                <p style="color: var(--gray); font-size: 14px;">${order.userName} • ${order.date}</p>
              </div>
              <div style="display: flex; gap: 10px; align-items: center;">
                <span style="background: ${statusColor}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 14px;">
                  ${getStatusText(order.status)}
                </span>
                <div style="font-size: 20px; font-weight: 700; color: var(--primary);">
                  ${formatPrice(order.total)}
                </div>
              </div>
            </div>
            <div>
              <p style="color: var(--gray); margin-bottom: 10px;">Товары: ${order.items.length} шт.</p>
              <div style="display: flex; gap: 10px;">
                <button class="btn btn-outline" onclick="updateOrderStatus(${order.id}, 'processing')" style="padding: 8px 16px; font-size: 14px;">
                  Обработка
                </button>
                <button class="btn btn-outline" onclick="updateOrderStatus(${order.id}, 'delivery')" style="padding: 8px 16px; font-size: 14px;">
                  Доставка
                </button>
                <button class="btn btn-outline" onclick="updateOrderStatus(${order.id}, 'delivered')" style="padding: 8px 16px; font-size: 14px;">
                  Доставлен
                </button>
              </div>
            </div>
          </div>`;
      });
      
      html += '</div>';
      container.innerHTML = html;
    }

    function updateOrderStatus(orderId, status) {
      const orderIndex = orders.findIndex(o => o.id === orderId);
      if (orderIndex !== -1) {
        orders[orderIndex].status = status;
        localStorage.setItem('orders', JSON.stringify(orders));
        loadAdminOrders();
        showNotification('Статус заказа обновлен', 'success');
      }
    }

    function loadAdminReviews() {
      const container = document.getElementById('admin-reviews-list');
      if (!container) return;
      
      if (reviews.length === 0) {
        container.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 40px;">Отзывы не найдены</p>';
        return;
      }
      
      let html = '<div style="display: grid; gap: 15px;">';
      reviews.forEach(review => {
        const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
        html += `
          <div style="background: var(--surface-color); border-radius: var(--radius); padding: 20px; border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
              <div>
                <h4 style="color: var(--text-color); margin-bottom: 5px;">${review.userName}</h4>
                <p style="color: var(--gray); font-size: 14px;">${review.date}</p>
              </div>
              <div class="stars" style="font-size: 18px;">${stars}</div>
            </div>
            <p style="color: var(--text-secondary); line-height: 1.6;">${review.text}</p>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
              <button class="btn btn-icon" onclick="deleteAdminReview(${review.id})" style="background: var(--danger); color: white; padding: 8px;">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>`;
      });
      
      html += '</div>';
      container.innerHTML = html;
    }

    function deleteAdminReview(reviewId) {
      if (confirm('Вы уверены, что хотите удалить этот отзыв?')) {
        reviews = reviews.filter(r => r.id !== reviewId);
        localStorage.setItem('reviews', JSON.stringify(reviews));
        loadAdminReviews();
        showNotification('Отзыв удален', 'success');
      }
    }

    function loadAdminUsers() {
      const container = document.getElementById('admin-users-list');
      if (!container) return;
      
      if (users.length === 0) {
        container.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 40px;">Пользователи не найдены</p>';
        return;
      }
      
      let html = '<div style="display: grid; gap: 15px;">';
      users.forEach(user => {
        html += `
          <div style="background: var(--surface-color); border-radius: var(--radius); padding: 20px; border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h4 style="color: var(--text-color); margin-bottom: 5px;">${user.name}</h4>
                <p style="color: var(--gray); font-size: 14px;">${user.email}</p>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                  <span style="background: ${user.role === 'admin' ? 'var(--primary)' : 'var(--gray)'}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
                    ${user.role === 'admin' ? 'Админ' : 'Пользователь'}
                  </span>
                  <span style="color: var(--primary); font-weight: 700;">Потрачено: ${formatPrice(user.totalSpent || 0)}</span>
                </div>
              </div>
              <div style="display: flex; gap: 10px;">
                ${user.role !== 'admin' ? `
                  <button class="btn btn-icon" onclick="makeAdmin(${user.id})" style="background: var(--primary); color: white; padding: 8px;">
                    <i class="fas fa-user-shield"></i>
                  </button>
                ` : ''}
                ${user.id !== 1 ? `
                  <button class="btn btn-icon" onclick="deleteAdminUser(${user.id})" style="background: var(--danger); color: white; padding: 8px;">
                    <i class="fas fa-trash"></i>
                  </button>
                ` : ''}
              </div>
            </div>
          </div>`;
      });
      
      html += '</div>';
      container.innerHTML = html;
    }

    function makeAdmin(userId) {
      if (confirm('Вы уверены, что хотите сделать этого пользователя администратором?')) {
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
          users[userIndex].role = 'admin';
          localStorage.setItem('users', JSON.stringify(users));
          loadAdminUsers();
          showNotification('Пользователь стал администратором', 'success');
        }
      }
    }

    function deleteAdminUser(userId) {
      if (userId === 1) {
        showNotification('Нельзя удалить главного администратора', 'error');
        return;
      }
      
      if (confirm('Вы уверены, что хотите удалить этого пользователя?')) {
        users = users.filter(u => u.id !== userId);
        localStorage.setItem('users', JSON.stringify(users));
        loadAdminUsers();
        showNotification('Пользователь удален', 'success');
      }
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
    function getDefaultUsers() {
      return [{
        id: 1,
        name: "Администратор",
        email: "admin58",
        password: "585858",
        role: "admin",
        totalSpent: 0,
        registrationDate: "2024-01-01"
      }];
    }

    function getDefaultProducts() {
      return [
        // Столы (5 товаров)
        {
          id: 1,
          name: "Стол обеденный 'Дуб Премиум'",
          category: "table",
          type: "premier",
          price: 35999,
          material: "Массив дуба, сталь (Премьер: Итальянская сталь, немецкая фурнитура)",
          dimensions: "150×90×75 см",
          description: "Классический обеденный стол из массива дуба на 6 персон с металлическими ножками",
          icon: "fa-table",
          color: "#8B4513"
        },
        {
          id: 2,
          name: "Стол компьютерный 'Профи'",
          category: "table",
          type: "standard",
          price: 18999,
          material: "ЛДСП, металл (Стандарт: Российское ЛДСП, отечественная фурнитура)",
          dimensions: "140×70×75 см",
          description: "Эргономичный компьютерный стол с регулируемой высотой и кабель-менеджментом",
          icon: "fa-table",
          color: "#718096"
        },
        {
          id: 3,
          name: "Стол журнальный 'Минимал'",
          category: "table",
          type: "premier",
          price: 12999,
          material: "Стекло, сталь (Премьер: Закаленное стекло, итальянская сталь)",
          dimensions: "80×50×45 см",
          description: "Современный журнальный стол из закаленного стекла и хромированной стали",
          icon: "fa-table",
          color: "#2d3748"
        },
        {
          id: 4,
          name: "Стол письменный 'Классик'",
          category: "table",
          type: "prestige",
          price: 45999,
          material: "Массив ореха, кожа (Престиж: Отборный орех, итальянская кожа)",
          dimensions: "160×80×75 см",
          description: "Роскошный письменный стол из массива ореха с кожаной столешницей",
          icon: "fa-table",
          color: "#5C4033"
        },
        {
          id: 5,
          name: "Стол барный 'Лофт'",
          category: "table",
          type: "premier",
          price: 24999,
          material: "Металл, дерево (Премьер: Состаренное дерево, кованый металл)",
          dimensions: "120×60×110 см",
          description: "Стильный барный стол в индустриальном стиле для кухни и гостиной",
          icon: "fa-table",
          color: "#4a5568"
        },

        // Стулья (5 товаров)
        {
          id: 6,
          name: "Стул офисный 'Эрго Про'",
          category: "chair",
          type: "premier",
          price: 12999,
          material: "Экокожа, металл (Премьер: Немецкая экокожа, итальянский механизм)",
          dimensions: "55×55×85 см",
          description: "Эргономичный офисный стул с поддержкой поясницы и регулировкой высоты",
          icon: "fa-chair",
          color: "#1a365d"
        },
        {
          id: 7,
          name: "Стул барный 'Модерн'",
          category: "chair",
          type: "standard",
          price: 7999,
          material: "Металл, пластик (Стандарт: Отечественный пластик, российский металл)",
          dimensions: "45×45×95 см",
          description: "Стильный барный стул для кухни и гостиной с регулировкой высоты",
          icon: "fa-chair",
          color: "#4a5568"
        },
        {
          id: 8,
          name: "Стул обеденный 'Венский'",
          category: "chair",
          type: "premier",
          price: 8999,
          material: "Гнутая фанера, сталь (Премьер: Австрийская фанера, немецкая сталь)",
          dimensions: "42×42×85 см",
          description: "Классический венский стул с гнутой спинкой и металлическим каркасом",
          icon: "fa-chair",
          color: "#805ad5"
        },
        {
          id: 9,
          name: "Кресло компьютерное 'Геймер'",
          category: "chair",
          type: "prestige",
          price: 29999,
          material: "Кожа, металл (Престиж: Натуральная кожа, карбоновые элементы)",
          dimensions: "70×70×130 см",
          description: "Профессиональное геймерское кресло с подсветкой и полной эргономикой",
          icon: "fa-chair",
          color: "#2d3748"
        },
        {
          id: 10,
          name: "Стул детский 'Растущий'",
          category: "chair",
          type: "standard",
          price: 5999,
          material: "Пластик, металл (Стандарт: Безопасный пластик, регулируемый механизм)",
          dimensions: "40×40×75 см",
          description: "Детский стул с регулировкой высоты и глубины сиденья",
          icon: "fa-chair",
          color: "#4299e1"
        },

        // Шкафы (5 товаров)
        {
          id: 11,
          name: "Шкаф-купе 'Минимал'",
          category: "wardrobe",
          type: "prestige",
          price: 58999,
          material: "ЛДСП, зеркало, алюминий (Престиж: Австрийское ЛДСП, итальянская фурнитура)",
          dimensions: "200×60×220 см",
          description: "Вместительный шкаф-купе с зеркальными дверями и подсветкой",
          icon: "fa-archive",
          color: "#2d3748"
        },
        {
          id: 12,
          name: "Комод 'Классик'",
          category: "wardrobe",
          type: "premier",
          price: 28999,
          material: "Массив сосны (Премьер: Отборная сосна, немецкие направляющие)",
          dimensions: "100×45×85 см",
          description: "Классический комод с 4 выдвижными ящиками",
          icon: "fa-archive",
          color: "#8B4513"
        },
        {
          id: 13,
          name: "Шкаф книжный 'Библио'",
          category: "wardrobe",
          type: "standard",
          price: 18999,
          material: "ЛДСП, стекло (Стандарт: Российское ЛДСП, закаленное стекло)",
          dimensions: "180×35×200 см",
          description: "Книжный шкаф с стеклянными дверцами и регулируемыми полками",
          icon: "fa-archive",
          color: "#718096"
        },
        {
          id: 14,
          name: "Гардеробная система 'Премиум'",
          category: "wardrobe",
          type: "prestige",
          price: 89999,
          material: "МДФ, металл, стекло (Престиж: Немецкий МДФ, австрийская фурнитура)",
          dimensions: "300×60×220 см",
          description: "Полноценная гардеробная система с различными секциями",
          icon: "fa-archive",
          color: "#1a365d"
        },
        {
          id: 15,
          name: "Шкаф для прихожей 'Холл'",
          category: "wardrobe",
          type: "premier",
          price: 34999,
          material: "МДФ, зеркало (Премьер: Итальянское МДФ, немецкое зеркало)",
          dimensions: "120×40×200 см",
          description: "Узкий шкаф для прихожей с зеркалом и крючками для одежды",
          icon: "fa-archive",
          color: "#4a5568"
        },

        // Кровати (5 товаров)
        {
          id: 16,
          name: "Кровать двуспальная 'Орто Комфорт'",
          category: "bed",
          type: "premier",
          price: 45999,
          material: "Массив ореха, ткань (Премьер: Отборный орех, бельгийская ткань)",
          dimensions: "200×160×110 см",
          description: "Кровать с ортопедическим основанием, ящиками для белья и мягким изголовьем",
          icon: "fa-bed",
          color: "#c19a6b"
        },
        {
          id: 17,
          name: "Кровать односпальная 'Юниор'",
          category: "bed",
          type: "standard",
          price: 23999,
          material: "ЛДСП, металл (Стандарт: Российское ЛДСП, ортопедическое основание)",
          dimensions: "200×90×100 см",
          description: "Односпальная кровать для подростков с ортопедическим основанием",
          icon: "fa-bed",
          color: "#4299e1"
        },
        {
          id: 18,
          name: "Кровать с подъемным механизмом 'Смарт'",
          category: "bed",
          type: "premier",
          price: 38999,
          material: "МДФ, механизм (Премьер: Немецкий МДФ, австрийский механизм)",
          dimensions: "200×160×110 см",
          description: "Кровать с подъемным механизмом для дополнительного хранения",
          icon: "fa-bed",
          color: "#4a5568"
        },
        {
          id: 19,
          name: "Кровать круглая 'Небесная'",
          category: "bed",
          type: "prestige",
          price: 78999,
          material: "Ротанг, текстиль (Престиж: Индонезийский ротанг, итальянский текстиль)",
          dimensions: "220×220×120 см",
          description: "Роскошная круглая кровать с балдахином и подсветкой",
          icon: "fa-bed",
          color: "#805ad5"
        },
        {
          id: 20,
          name: "Кровать двухъярусная 'Детская'",
          category: "bed",
          type: "standard",
          price: 32999,
          material: "Массив, металл (Стандарт: Отечественный массив, безопасные перила)",
          dimensions: "200×90×180 см",
          description: "Безопасная двухъярусная кровать для детей с лестницей и перилами",
          icon: "fa-bed",
          color: "#38a169"
        },

        // Полки (5 товаров)
        {
          id: 21,
          name: "Полка настенная 'Фьюжн'",
          category: "shelf",
          type: "premier",
          price: 15999,
          material: "Стекло, сталь (Премьер: Закаленное стекло, хромированная сталь)",
          dimensions: "120×30×15 см",
          description: "Дизайнерская настенная полка из закаленного стекла и хромированной стали",
          icon: "fa-border-all",
          color: "#1a365d"
        },
        {
          id: 22,
          name: "Стеллаж напольный 'Модуль'",
          category: "shelf",
          type: "standard",
          price: 12999,
          material: "ЛДСП, металл (Стандарт: Российское ЛДСП, регулируемые полки)",
          dimensions: "180×40×200 см",
          description: "Модульный стеллаж с регулируемыми полками",
          icon: "fa-border-all",
          color: "#718096"
        },
        {
          id: 23,
          name: "Полка угловая 'Эконом'",
          category: "shelf",
          type: "standard",
          price: 4999,
          material: "ЛДСП (Стандарт: Отечественное ЛДСП, простая сборка)",
          dimensions: "80×80×30 см",
          description: "Угловая полка для экономии пространства",
          icon: "fa-border-all",
          color: "#4a5568"
        },
        {
          id: 24,
          name: "Стеллаж книжный 'Библиотека'",
          category: "shelf",
          type: "premier",
          price: 28999,
          material: "Массив дуба (Премьер: Отборный дуб, ручная обработка)",
          dimensions: "200×35×220 см",
          description: "Массивный книжный стеллаж из натурального дуба",
          icon: "fa-border-all",
          color: "#8B4513"
        },
        {
          id: 25,
          name: "Полка для обуви 'Прихожая'",
          category: "shelf",
          type: "standard",
          price: 8999,
          material: "Металл, пластик (Стандарт: Прочный металл, износостойкий пластик)",
          dimensions: "100×30×80 см",
          description: "Компактная полка для обуви с 12 отделениями",
          icon: "fa-border-all",
          color: "#2d3748"
        },

        // Кухни (5 товаров)
        {
          id: 26,
          name: "Кухня 'Милан'",
          category: "kitchen",
          type: "prestige",
          price: 249999,
          material: "МДФ, искусственный камень (Престиж: Итальянский МДФ, кварцевый камень)",
          dimensions: "300×60×220 см",
          description: "Современная кухня с каменной столешницей, подсветкой и встроенной техникой",
          icon: "fa-utensils",
          color: "#2d3748"
        },
        {
          id: 27,
          name: "Кухня 'Сканди'",
          category: "kitchen",
          type: "premier",
          price: 189999,
          material: "Массив, пластик (Премьер: Скандинавский массив, немецкий пластик)",
          dimensions: "250×60×220 см",
          description: "Скандинавская кухня в светлых тонах с деревянными фасадами",
          icon: "fa-utensils",
          color: "#cbd5e0"
        },
        {
          id: 28,
          name: "Кухня 'Лофт'",
          category: "kitchen",
          type: "premier",
          price: 219999,
          material: "Металл, дерево, бетон (Премьер: Кованый металл, состаренное дерево)",
          dimensions: "280×60×220 см",
          description: "Индустриальная кухня в стиле лофт с бетонными столешницами",
          icon: "fa-utensils",
          color: "#4a5568"
        },
        {
          id: 29,
          name: "Кухня 'Классик'",
          category: "kitchen",
          type: "prestige",
          price: 299999,
          material: "Массив, мрамор (Престиж: Отборный массив, итальянский мрамор)",
          dimensions: "320×60×240 см",
          description: "Классическая кухня из массива дерева с мраморными столешницами",
          icon: "fa-utensils",
          color: "#8B4513"
        },
        {
          id: 30,
          name: "Кухня угловая 'Компакт'",
          category: "kitchen",
          type: "standard",
          price: 149999,
          material: "ЛДСП, пластик (Стандарт: Отечественное ЛДСП, практичный пластик)",
          dimensions: "220×60×220 см",
          description: "Угловая кухня для небольших помещений с максимальной функциональностью",
          icon: "fa-utensils",
          color: "#718096"
        },

        // Диваны (5 товаров)
        {
          id: 31,
          name: "Диван 'Стокгольм'",
          category: "sofa",
          type: "premier",
          price: 65999,
          material: "Ткань, дерево (Премьер: Шведская ткань, финское дерево)",
          dimensions: "220×90×85 см",
          description: "Удобный диван с механизмом трансформации в спальное место",
          icon: "fa-couch",
          color: "#1a365d"
        },
        {
          id: 32,
          name: "Диван угловой 'Люкс'",
          category: "sofa",
          type: "prestige",
          price: 89999,
          material: "Кожа, металл (Престиж: Натуральная кожа, хромированный металл)",
          dimensions: "280×160×90 см",
          description: "Роскошный угловой диван с кожаной обивкой и подсветкой",
          icon: "fa-couch",
          color: "#2d3748"
        },
        {
          id: 33,
          name: "Диван компактный 'Мини'",
          category: "sofa",
          type: "standard",
          price: 34999,
          material: "Ткань, дерево (Стандарт: Износостойкая ткань, прочное дерево)",
          dimensions: "180×80×85 см",
          description: "Компактный диван для небольших помещений с механизмом трансформации",
          icon: "fa-couch",
          color: "#718096"
        },
        {
          id: 34,
          name: "Диван-кровать 'Трансформер'",
          category: "sofa",
          type: "premier",
          price: 54999,
          material: "Ткань, металл (Премьер: Бельгийская ткань, немецкий механизм)",
          dimensions: "200×90×85 см",
          description: "Практичный диван-кровать с удобным механизмом трансформации",
          icon: "fa-couch",
          color: "#4a5568"
        },
        {
          id: 35,
          name: "Диван угловой 'Модуль'",
          category: "sofa",
          type: "standard",
          price: 78999,
          material: "Ткань, дерево (Стандарт: Износостойкая ткань, модульная конструкция)",
          dimensions: "320×180×90 см",
          description: "Модульный угловой диван с возможностью перестановки секций",
          icon: "fa-couch",
          color: "#1a365d"
        },

        // Тумбы (5 товаров)
        {
          id: 36,
          name: "Тумба прикроватная 'Ночь'",
          category: "cabinet",
          type: "premier",
          price: 12999,
          material: "Дерево, стекло (Премьер: Массив дерева, закаленное стекло)",
          dimensions: "50×40×55 см",
          description: "Элегантная прикроватная тумба с выдвижным ящиком и полкой",
          icon: "fa-dice-d6",
          color: "#8B4513"
        },
        {
          id: 37,
          name: "Тумба под TV 'Медиа'",
          category: "cabinet",
          type: "standard",
          price: 21999,
          material: "ЛДСП, металл (Стандарт: Отечественное ЛДСП, прочный металл)",
          dimensions: "180×45×60 см",
          description: "Телевизионная тумба с отделениями для медиатехники",
          icon: "fa-dice-d6",
          color: "#2d3748"
        },
        {
          id: 38,
          name: "Тумба под раковину 'Ванная'",
          category: "cabinet",
          type: "standard",
          price: 14999,
          material: "МДФ, пластик (Стандарт: Влагостойкий МДФ, практичный пластик)",
          dimensions: "80×48×60 см",
          description: "Тумба для ванной комнаты с раковиной и двумя ящиками",
          icon: "fa-dice-d6",
          color: "#cbd5e0"
        },
        {
          id: 39,
          name: "Тумба комодная 'Премиум'",
          category: "cabinet",
          type: "prestige",
          price: 32999,
          material: "Массив ореха (Престиж: Отборный орех, итальянская фурнитура)",
          dimensions: "120×40×85 см",
          description: "Роскошная тумба-комод из массива ореха с тремя ящиками",
          icon: "fa-dice-d6",
          color: "#5C4033"
        },

        // Комоды (5 товаров)
        {
          id: 40,
          name: "Комод 4-х ящичный 'Практик'",
          category: "dresser",
          type: "standard",
          price: 18999,
          material: "ЛДСП, металл (Стандарт: Российское ЛДСП, плавные направляющие)",
          dimensions: "100×45×85 см",
          description: "Практичный комод с 4 выдвижными ящиками для хранения белья",
          icon: "fa-archive",
          color: "#4a5568"
        },
        {
          id: 41,
          name: "Комод с зеркалом 'Элегант'",
          category: "dresser",
          type: "premier",
          price: 28999,
          material: "МДФ, зеркало (Премьер: Итальянское МДФ, французское зеркало)",
          dimensions: "120×45×90 см",
          description: "Элегантный комод с большим зеркалом и вместительными ящиками",
          icon: "fa-archive",
          color: "#cbd5e0"
        },
        {
          id: 42,
          name: "Комод 6-ти ящичный 'Премиум'",
          category: "dresser",
          type: "prestige",
          price: 45999,
          material: "Массив ореха (Престиж: Отборный орех, ручная полировка)",
          dimensions: "120×45×90 см",
          description: "Шикарный комод из массива ореха с шестью выдвижными ящиками",
          icon: "fa-archive",
          color: "#5C4033"
        },
        {
          id: 43,
          name: "Комод детский 'Радуга'",
          category: "dresser",
          type: "standard",
          price: 15999,
          material: "ЛДСП, пластик (Стандарт: Безопасное ЛДСП, яркие фасады)",
          dimensions: "90×40×75 см",
          description: "Яркий детский комод с 4 ящиками для хранения игрушек и одежды",
          icon: "fa-archive",
          color: "#4299e1"
        },
        {
          id: 44,
          name: "Комод узкий 'Коридор'",
          category: "dresser",
          type: "premier",
          price: 22999,
          material: "МДФ, металл (Премьер: Итальянское МДФ, скрытые ручки)",
          dimensions: "150×35×85 см",
          description: "Узкий комод для прихожей или коридора с 5 выдвижными ящиками",
          icon: "fa-archive",
          color: "#2d3748"
        }
      ];
    }

    function getDefaultReviews() {
      return [{
          id: 1,
          userId: 2,
          userName: "Анна Петрова",
          rating: 5,
          text: "Заказывали кухню в этом магазине. Отличное качество, все идеально подошло по размерам. Сборщики работали аккуратно и профессионально. Очень довольны результатом!",
          date: "2024-01-15"
        },
        {
          id: 2,
          userId: 3,
          userName: "Сергей Иванов",
          rating: 4,
          text: "Покупал шкаф-купе для спальни. Доставили вовремя, собрали быстро. Единственный минус - небольшие царапины на одной из панелей, но их оперативно заменили. Обслуживание на высоте!",
          date: "2024-02-10"
        },
        {
          id: 3,
          userId: 4,
          userName: "Мария Сидорова",
          rating: 5,
          text: "Диван просто шикарный! Мягкий, удобный, цвет полностью соответствует образцу. Заказывали с доставкой, привезли точно в срок. Рекомендую этот магазин!",
          date: "2024-03-05"
        },
        {
          id: 4,
          userId: 5,
          userName: "Дмитрий Козлов",
          rating: 5,
          text: "Приобрел обеденный стол и 6 стульев. Качество на высшем уровне, сборка точная. Особенно порадовала система доставки - все привезли в назначенное время.",
          date: "2024-03-20"
        },
        {
          id: 5,
          userId: 6,
          userName: "Елена Васнецова",
          rating: 4,
          text: "Кровать просто супер! Ортопедическое основание очень комфортное. Единственное - ждали доставку дольше обещанного, но результат того стоил.",
          date: "2024-04-10"
        },
        {
          id: 6,
          userId: 7,
          userName: "Александр Новиков",
          rating: 5,
          text: "Заказывал офисную мебель для компании. Большой выбор, профессиональные консультанты, гибкая система скидок при оптовом заказе. Буду сотрудничать дальше!",
          date: "2024-05-15"
        }
      ];
    }

    function formatPrice(price) {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0
      }).format(price);
    }

    function darkenColor(color, percent) {
      if (!color || typeof color !== 'string') {
        return '#1a365d';
      }
      
      // Удаляем # если есть
      let hex = color.replace("#", "");
      
      // Если цвет в формате RGB
      if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
      }
      
      if (!/^[0-9A-F]{6}$/i.test(hex)) {
        return '#1a365d';
      }
      
      const num = parseInt(hex, 16);
      if (isNaN(num)) {
        return '#1a365d';
      }
      
      const amt = Math.round(255 * (percent / 100));
      
      // Извлекаем компоненты RGB
      let R = (num >> 16) - amt;
      let G = (num >> 8 & 0x00FF) - amt;
      let B = (num & 0x0000FF) - amt;
      
      // Ограничиваем значения от 0 до 255
      R = R < 0 ? 0 : (R > 255 ? 255 : R);
      G = G < 0 ? 0 : (G > 255 ? 255 : G);
      B = B < 0 ? 0 : (B > 255 ? 255 : B);
      
      // Возвращаем HEX
      return "#" + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1).toUpperCase();
    }

    function showNotification(message, type = 'success') {
      document.querySelectorAll('.notification').forEach(n => n.remove());
      
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
      `;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'slideOutRight 0.3s ease';
          setTimeout(() => notification.remove(), 300);
        }
      }, 4000);
    }

    function showWelcomeModal() {
      setTimeout(() => {
        if (!currentUser && !localStorage.getItem('welcomeShown')) {
          if (confirm(
            'Добро пожаловать в магазин "Удобство 58"!\n\n' +
            'Зарегистрируйтесь, чтобы получить:\n' +
            '• Накопительную скидку до 5%\n' +
            '• 3D планировщик комнаты\n' +
            '• Историю заказов и статусы\n' +
            '• Подарки и акции\n\n' +
            'Хотите зарегистрироваться сейчас?'
          )) {
            toggleAuthModal();
            showRegisterForm();
          }
        }
      }, 2000);
    }

    function getDeliveryDate() {
      const date = new Date();
      date.setDate(date.getDate() + Math.floor(Math.random() * 7) + 3);
      return date.toLocaleDateString('ru-RU');
    }

    function getStatusText(status) {
      const statuses = {
        'processing': 'Обработка',
        'assembly': 'На сборке',
        'ready': 'Готов к отправке',
        'delivery': 'В доставке',
        'delivered': 'Доставлен'
      };
      return statuses[status] || status;
    }

    function getStatusColor(status) {
      const colors = {
        'processing': 'var(--info)',
        'assembly': 'var(--warning)',
        'ready': 'var(--success)',
        'delivery': 'var(--primary)',
        'delivered': 'var(--secondary)'
      };
      return colors[status] || 'var(--gray)';
    }

    function loadOrderTracking() {
      const container = document.getElementById('order-tracking');
      if (!container) return;
      
      if (!currentUser) {
        container.innerHTML = `
          <div class="card" style="text-align: center; padding: 40px;">
            <i class="fas fa-shopping-cart" style="font-size: 60px; color: var(--light-gray); margin-bottom: 20px;"></i>
            <h3 style="color: var(--text-color); margin-bottom: 15px;">История заказов</h3>
            <p style="color: var(--gray);">Для просмотра заказов необходимо авторизоваться</p>
          </div>`;
        return;
      }
      
      const userOrders = orders.filter(o => o.userId === currentUser.id);
      if (userOrders.length === 0) {
        container.innerHTML = `
          <div class="card" style="text-align: center; padding: 40px;">
            <i class="fas fa-box-open" style="font-size: 60px; color: var(--light-gray); margin-bottom: 20px;"></i>
            <h3 style="color: var(--text-color); margin-bottom: 15px;">Заказов пока нет</h3>
            <p style="color: var(--gray);">Перейдите в каталог, чтобы сделать заказ</p>
            <button class="btn btn-secondary" onclick="switchPage('catalog')" style="margin-top: 20px;">
              <i class="fas fa-shopping-cart"></i>Перейти в каталог
            </button>
          </div>`;
        return;
      }
      
      let html = '';
      userOrders.forEach(order => {
        const statusText = getStatusText(order.status);
        const statusColor = getStatusColor(order.status);
        
        html += `
          <div class="card" style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <div>
                <h3 style="color: var(--text-color); margin-bottom: 5px;">Заказ №${order.id}</h3>
                <p style="color: var(--gray); font-size: 14px;">${order.date}</p>
              </div>
              <div style="background: ${statusColor}; color: white; padding: 8px 20px; border-radius: 20px; font-weight: 600;">
                ${statusText}
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 25px;">
              <div>
                <p style="color: var(--gray); font-size: 14px;">Сумма заказа</p>
                <p style="color: var(--text-color); font-size: 24px; font-weight: 700;">${formatPrice(order.total)}</p>
              </div>
              <div>
                <p style="color: var(--gray); font-size: 14px;">Дата доставки</p>
                <p style="color: var(--text-color); font-size: 16px;">${order.estimatedDelivery}</p>
              </div>
            </div>
            
            <div>
              <p style="color: var(--gray); font-size: 14px; margin-bottom: 10px;">Товары:</p>
              <ul style="color: var(--text-color); padding-left: 20px;">
                ${order.items.map(item => {
                  const product = products.find(p => p.id === item.id);
                  return `<li>${product ? product.name : 'Товар'} × ${item.quantity}</li>`;
                }).join('')}
              </ul>
            </div>
          </div>`;
      });
      
      container.innerHTML = html;
    }

    // Инициализация выбранной мебели в 3D примерке
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(() => {
        const firstOption = document.querySelector('.furniture-option');
        if (firstOption) {
          firstOption.classList.add('selected');
          selectedFurnitureType = firstOption.getAttribute('data-type');
        }
      }, 100);
    });
