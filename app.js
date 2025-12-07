// Инициализация данных
let data = {
    itemTypes: ['Тип 1', 'Тип 2', 'Тип 3', 'Тип 4', 'Тип 5', 'Тип 6', 'Тип 7', 'Тип 8', 'Тип 9'],
    purchases: [],
    sales: [],
    rates: []
};

// Переменные для графика
let profitChart = null;
let chartPeriod = 30;
let showPoints = true;

// Загрузка данных из localStorage
function loadData() {
    const saved = localStorage.getItem('profitTrackerData');
    if (saved) {
        data = JSON.parse(saved);
    }
}

// Сохранение данных в localStorage
function saveData() {
    localStorage.setItem('profitTrackerData', JSON.stringify(data));
}

// Текущий месяц для календаря
let currentDate = new Date();

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initTabs();
    initModals();
    initForms();
    initCalendar();
    initRates();
    initChart();
    initDetailsClicks();
    updateItemTypeSelects();
    updateStats();
    renderItemTypesList();
});

// Инициализация вкладок
function initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
            
            if (tab.dataset.tab === 'calendar') {
                renderCalendar();
            }
        });
    });

    // Переключатель приравнивания
    document.getElementById('equalizeToggle').addEventListener('change', () => {
        updateStats();
        updateChart();
        renderCalendar();
    });
    
    // Фильтр по типу
    document.getElementById('itemTypeFilter').addEventListener('change', updateStats);
    
    // Фильтр по датам
    document.getElementById('dateFrom').addEventListener('change', updateStats);
    document.getElementById('dateTo').addEventListener('change', updateStats);
    document.getElementById('resetDatesBtn').addEventListener('click', () => {
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        updateStats();
    });
    
    // Экспорт данных
    document.getElementById('exportBtn').addEventListener('click', exportData);
    
    // Импорт данных
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', importData);
    
    // Кнопка управления типами
    document.getElementById('manageItemsBtn').addEventListener('click', () => {
        document.getElementById('itemsModal').classList.remove('hidden');
    });
}

// Экспорт данных в JSON файл
function exportData() {
    const exportObj = {
        ...data,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };
    
    const dataStr = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `profit-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
}

// Импорт данных из JSON файла
function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            
            // Проверка структуры
            if (!imported.itemTypes || !imported.purchases || !imported.sales) {
                alert('Неверный формат файла!');
                return;
            }
            
            if (confirm('Заменить текущие данные на импортированные?')) {
                data = {
                    itemTypes: imported.itemTypes,
                    purchases: imported.purchases,
                    sales: imported.sales,
                    rates: imported.rates || []
                };
                
                saveData();
                updateItemTypeSelects();
                updateStats();
                updateChart();
                renderCalendar();
                renderRatesList();
                renderItemTypesList();
                
                alert('Данные успешно импортированы!');
            }
        } catch (err) {
            alert('Ошибка чтения файла: ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

// Инициализация модальных окон
function initModals() {
    // Кнопки открытия
    document.getElementById('addPurchaseBtn').addEventListener('click', () => {
        document.getElementById('purchaseDate').valueAsDate = new Date();
        document.getElementById('purchaseModal').classList.remove('hidden');
    });
    
    document.getElementById('addSaleBtn').addEventListener('click', () => {
        document.getElementById('saleDate').valueAsDate = new Date();
        document.getElementById('saleModal').classList.remove('hidden');
    });
    
    // Закрытие модалок
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.add('hidden');
        });
    });
    
    // Закрытие по клику вне модалки
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });
    
    // Добавление нового типа
    document.getElementById('addItemTypeBtn').addEventListener('click', () => {
        const input = document.getElementById('newItemName');
        const name = input.value.trim();
        if (name && !data.itemTypes.includes(name)) {
            data.itemTypes.push(name);
            saveData();
            updateItemTypeSelects();
            renderItemTypesList();
            input.value = '';
        }
    });
}

// Инициализация форм
function initForms() {
    // Форма покупки - с датой
    document.getElementById('purchaseForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const itemType = document.getElementById('purchaseItemType').value;
        const purchaseDate = document.getElementById('purchaseDate').value;
        const currency = document.getElementById('purchaseCurrency').value;
        const quantity = parseInt(document.getElementById('purchaseQuantity').value);
        const amount = parseFloat(document.getElementById('purchaseAmount').value);
        
        data.purchases.push({
            id: Date.now(),
            itemType,
            currency,
            originalAmount: amount,
            quantity,
            date: purchaseDate
        });
        
        saveData();
        updateStats();
        updateChart();
        document.getElementById('purchaseModal').classList.add('hidden');
        document.getElementById('purchaseForm').reset();
    });
    
    // Форма продажи - НЕ конвертируем сразу, храним оригинал
    document.getElementById('saleForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const itemType = document.getElementById('saleItemType').value;
        const saleDate = document.getElementById('saleDate').value;
        const currency = document.getElementById('saleCurrency').value;
        const quantity = parseInt(document.getElementById('saleQuantity').value);
        const amount = parseFloat(document.getElementById('saleAmount').value);
        
        data.sales.push({
            id: Date.now(),
            itemType,
            currency,
            originalAmount: amount,
            quantity,
            date: saleDate
        });
        
        saveData();
        updateStats();
        updateChart();
        renderCalendar();
        document.getElementById('saleModal').classList.add('hidden');
        document.getElementById('saleForm').reset();
    });
    
    // Редактирование типа вещи
    document.getElementById('saveItemEditBtn').addEventListener('click', () => {
        const index = parseInt(document.getElementById('editItemIndex').value);
        const newName = document.getElementById('editItemName').value.trim();
        
        if (newName && !data.itemTypes.includes(newName)) {
            const oldName = data.itemTypes[index];
            data.itemTypes[index] = newName;
            
            // Обновляем все транзакции с этим типом
            data.purchases.forEach(p => {
                if (p.itemType === oldName) p.itemType = newName;
            });
            data.sales.forEach(s => {
                if (s.itemType === oldName) s.itemType = newName;
            });
            
            saveData();
            updateItemTypeSelects();
            renderItemTypesList();
            updateStats();
            document.getElementById('editItemModal').classList.add('hidden');
        }
    });
}

// Обновление селектов типов вещей
function updateItemTypeSelects() {
    const selects = ['itemTypeFilter', 'purchaseItemType', 'saleItemType'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        const currentValue = select.value;
        
        if (selectId === 'itemTypeFilter') {
            select.innerHTML = '<option value="all">Все</option>';
        } else {
            select.innerHTML = '';
        }
        
        data.itemTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            select.appendChild(option);
        });
        
        if (currentValue && [...select.options].some(o => o.value === currentValue)) {
            select.value = currentValue;
        }
    });
}

// Список типов вещей с редактированием
function renderItemTypesList() {
    const container = document.getElementById('itemTypesList');
    container.innerHTML = '';
    
    data.itemTypes.forEach((type, index) => {
        const row = document.createElement('div');
        row.className = 'item-type-row';
        row.innerHTML = `
            <span>${type}</span>
            <div class="item-actions">
                <button class="edit-item" data-index="${index}">Изменить</button>
                <button class="delete-item" data-index="${index}">Удалить</button>
            </div>
        `;
        container.appendChild(row);
    });
    
    // Редактирование
    container.querySelectorAll('.edit-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            document.getElementById('editItemIndex').value = index;
            document.getElementById('editItemName').value = data.itemTypes[index];
            document.getElementById('editItemModal').classList.remove('hidden');
        });
    });
    
    // Удаление
    container.querySelectorAll('.delete-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            data.itemTypes.splice(index, 1);
            saveData();
            updateItemTypeSelects();
            renderItemTypesList();
            updateStats();
        });
    });
}

// Получить текущий курс
function getCurrentRate() {
    if (data.rates.length === 0) return 1;
    const sorted = [...data.rates].sort((a, b) => new Date(b.date) - new Date(a.date));
    return sorted[0].value;
}

// Получить курс для даты
function getRateForDate(dateStr) {
    if (data.rates.length === 0) return 1;
    
    const targetDate = new Date(dateStr);
    const sorted = [...data.rates].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    for (const rate of sorted) {
        if (new Date(rate.date) <= targetDate) {
            return rate.value;
        }
    }
    
    return sorted[sorted.length - 1].value;
}

// Конвертировать сумму транзакции в рубли (динамически по текущему курсу)
function getAmountInRub(transaction) {
    if (transaction.currency === 'RUB') {
        return transaction.originalAmount;
    }
    // Для юаней берём курс на дату транзакции
    const rate = getRateForDate(transaction.date);
    return transaction.originalAmount * rate;
}

// Обновление статистики с динамическим пересчётом курса
function updateStats() {
    const filterType = document.getElementById('itemTypeFilter').value;
    const equalize = document.getElementById('equalizeToggle').checked;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    // Фильтрация по типу
    let purchases = filterType === 'all' 
        ? [...data.purchases] 
        : data.purchases.filter(p => p.itemType === filterType);
    
    let sales = filterType === 'all' 
        ? [...data.sales] 
        : data.sales.filter(s => s.itemType === filterType);
    
    // Фильтрация по датам
    if (dateFrom) {
        purchases = purchases.filter(p => p.date >= dateFrom);
        sales = sales.filter(s => s.date >= dateFrom);
    }
    if (dateTo) {
        purchases = purchases.filter(p => p.date <= dateTo);
        sales = sales.filter(s => s.date <= dateTo);
    }
    
    // Подсчет количества
    let totalBought = purchases.reduce((sum, p) => sum + p.quantity, 0);
    let totalSold = sales.reduce((sum, s) => sum + s.quantity, 0);
    
    // Суммы с динамическим пересчётом по курсу
    let totalPurchaseAmount = purchases.reduce((sum, p) => sum + getAmountInRub(p), 0);
    let totalSaleAmount = sales.reduce((sum, s) => sum + getAmountInRub(s), 0);
    
    // Средняя цена покупки и продажи
    let avgPurchasePrice = totalBought > 0 ? totalPurchaseAmount / totalBought : 0;
    let avgSalePrice = totalSold > 0 ? totalSaleAmount / totalSold : 0;
    
    // Приравнивание: уменьшаем количество покупок до количества продаж
    let displayBought = totalBought;
    let displaySold = totalSold;
    
    if (equalize && totalBought > totalSold && totalSold > 0) {
        displayBought = totalSold;
    }
    
    // Расчет сумм с учётом приравнивания
    let totalExpense = displayBought * avgPurchasePrice;
    let totalIncome = displaySold * avgSalePrice;
    let profit = totalIncome - totalExpense;
    
    // Обновление UI
    document.getElementById('totalIncome').textContent = formatMoney(totalIncome);
    document.getElementById('totalExpense').textContent = formatMoney(totalExpense);
    document.getElementById('totalSold').textContent = displaySold;
    document.getElementById('totalBought').textContent = displayBought;
    
    const profitEl = document.getElementById('totalProfit');
    profitEl.textContent = formatMoney(profit);
    profitEl.className = 'profit-amount' + (profit < 0 ? ' negative' : '');
    
    // Статистика по типам
    renderItemStats(equalize);
}

// Статистика по типам вещей с динамическим курсом (кликабельные строки)
function renderItemStats(equalize) {
    const container = document.getElementById('itemStats');
    container.innerHTML = '<h3>Статистика по типам вещей</h3>';
    
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    data.itemTypes.forEach(type => {
        let purchases = data.purchases.filter(p => p.itemType === type);
        let sales = data.sales.filter(s => s.itemType === type);
        
        // Фильтрация по датам
        if (dateFrom) {
            purchases = purchases.filter(p => p.date >= dateFrom);
            sales = sales.filter(s => s.date >= dateFrom);
        }
        if (dateTo) {
            purchases = purchases.filter(p => p.date <= dateTo);
            sales = sales.filter(s => s.date <= dateTo);
        }
        
        let bought = purchases.reduce((sum, p) => sum + p.quantity, 0);
        let sold = sales.reduce((sum, s) => sum + s.quantity, 0);
        
        // Динамический пересчёт по курсу
        let boughtAmount = purchases.reduce((sum, p) => sum + getAmountInRub(p), 0);
        let soldAmount = sales.reduce((sum, s) => sum + getAmountInRub(s), 0);
        
        if (bought === 0 && sold === 0) return;
        
        // Приравнивание
        if (equalize && bought > sold && sold > 0) {
            const avgPrice = boughtAmount / bought;
            bought = sold;
            boughtAmount = bought * avgPrice;
        }
        
        const profit = soldAmount - boughtAmount;
        
        const row = document.createElement('div');
        row.className = 'item-stat-row';
        row.dataset.itemType = type;
        row.innerHTML = `
            <span class="item-stat-name">${type}</span>
            <div class="item-stat-values">
                <span class="item-stat-bought">Куплено: ${bought} шт. (${formatMoney(boughtAmount)})</span>
                <span class="item-stat-sold">Продано: ${sold} шт. (${formatMoney(soldAmount)})</span>
                <span style="color: ${profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">Прибыль: ${formatMoney(profit)}</span>
            </div>
        `;
        
        // Клик по строке - детализация по этому типу
        row.addEventListener('click', () => {
            showDetails('all', type);
        });
        
        container.appendChild(row);
    });
}

// Форматирование денег
function formatMoney(amount) {
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
}

// Инициализация календаря
function initCalendar() {
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
    
    renderCalendar();
}

// Отрисовка календаря
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;
    
    const grid = document.getElementById('calendarGrid');
    // Удаляем старые дни, оставляя заголовки
    grid.querySelectorAll('.calendar-day').forEach(el => el.remove());
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Получаем день недели первого дня (0 = воскресенье, нужно преобразовать в понедельник = 0)
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;
    
    // Пустые ячейки в начале
    for (let i = 0; i < startDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        grid.appendChild(empty);
    }
    
    // Дни месяца
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayProfit = calculateDayProfit(dateStr);
        
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        if (dayProfit.hasData) {
            dayEl.classList.add('has-data');
        }
        
        dayEl.innerHTML = `
            <span class="day-number">${day}</span>
            ${dayProfit.hasData ? `<span class="day-profit ${dayProfit.profit >= 0 ? 'positive' : 'negative'}">${dayProfit.profit >= 0 ? '+' : ''}${dayProfit.profit.toFixed(0)}₽</span>` : ''}
        `;
        
        dayEl.addEventListener('click', () => showDayDetails(dateStr));
        grid.appendChild(dayEl);
    }
}

// Расчет прибыли за день (для графика/календаря)
function calculateDayProfit(dateStr) {
    const daySales = data.sales.filter(s => s.date === dateStr);
    const dayPurchases = data.purchases.filter(p => p.date === dateStr);
    
    // Нет ни продаж, ни покупок — нет данных для дня
    if (daySales.length === 0 && dayPurchases.length === 0) {
        return { hasData: false, profit: 0 };
    }
    
    // Только покупки (инвестиция ещё не реализована) — отмечаем день, но прибыль считаем как 0
    if (daySales.length === 0 && dayPurchases.length > 0) {
        return { hasData: true, profit: 0 };
    }
    
    let totalIncome = 0;
    let totalExpense = 0;
    
    // Группируем продажи по типу
    const salesByType = {};
    daySales.forEach(sale => {
        if (!salesByType[sale.itemType]) {
            salesByType[sale.itemType] = { quantity: 0, amount: 0 };
        }
        salesByType[sale.itemType].quantity += sale.quantity;
        salesByType[sale.itemType].amount += getAmountInRub(sale);
    });
    
    // Для каждого типа считаем расход с приравниванием
    Object.keys(salesByType).forEach(type => {
        const sold = salesByType[type];
        const typePurchases = data.purchases.filter(p => p.itemType === type);
        const totalBought = typePurchases.reduce((sum, p) => sum + p.quantity, 0);
        const totalBoughtAmount = typePurchases.reduce((sum, p) => sum + getAmountInRub(p), 0);
        
        totalIncome += sold.amount;
        
        // Средняя цена покупки с динамическим курсом
        if (totalBought > 0) {
            const avgPurchasePrice = totalBoughtAmount / totalBought;
            // Приравниваем: берем столько покупок, сколько продаж
            totalExpense += sold.quantity * avgPurchasePrice;
        }
    });
    
    return { hasData: true, profit: totalIncome - totalExpense };
}

// Показать детали дня
function showDayDetails(dateStr) {
    const details = document.getElementById('dayDetails');
    details.classList.remove('hidden');
    
    document.getElementById('selectedDate').textContent = formatDate(dateStr);
    
    const rate = getRateForDate(dateStr);
    document.getElementById('dayRate').textContent = `1 ¥ = ${rate.toFixed(2)} ₽`;
    
    const container = document.getElementById('dayTransactions');
    container.innerHTML = '';
    
    const daySales = data.sales.filter(s => s.date === dateStr);
    const dayPurchases = data.purchases.filter(p => p.date === dateStr);
    
    if (daySales.length === 0 && dayPurchases.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">Нет транзакций за этот день</p>';
        return;
    }
    
    daySales.forEach(sale => {
        const div = document.createElement('div');
        div.className = 'transaction-item sale';
        div.innerHTML = `
            <span>${sale.itemType}</span>
            <span>${sale.quantity} шт.</span>
            <span>${formatMoney(getAmountInRub(sale))}</span>
        `;
        container.appendChild(div);
    });
    
    dayPurchases.forEach(purchase => {
        const div = document.createElement('div');
        div.className = 'transaction-item expense';
        div.innerHTML = `
            <span>${purchase.itemType}</span>
            <span>${purchase.quantity} шт.</span>
            <span>-${formatMoney(getAmountInRub(purchase))}</span>
        `;
        container.appendChild(div);
    });
    
    const dayProfit = calculateDayProfit(dateStr);
    const profitDiv = document.createElement('div');
    profitDiv.style.marginTop = '15px';
    profitDiv.style.fontWeight = 'bold';
    profitDiv.innerHTML = `<span style="color: ${dayProfit.profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">Прибыль за день: ${formatMoney(dayProfit.profit)}</span>`;
    container.appendChild(profitDiv);
}

// Форматирование даты
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Инициализация курсов
function initRates() {
    document.getElementById('rateDate').valueAsDate = new Date();
    
    document.getElementById('saveRateBtn').addEventListener('click', () => {
        const value = parseFloat(document.getElementById('rateValue').value);
        const date = document.getElementById('rateDate').value;
        
        if (!value || !date) {
            alert('Заполните все поля');
            return;
        }
        
        // Удаляем старый курс за эту дату если есть
        data.rates = data.rates.filter(r => r.date !== date);
        
        data.rates.push({ value, date });
        saveData();
        renderRatesList();
        
        // Обновляем статистику т.к. курс влияет на суммы
        updateStats();
        updateChart();
        renderCalendar();
        
        document.getElementById('rateValue').value = '';
    });
    
    renderRatesList();
}

// Отрисовка списка курсов
function renderRatesList() {
    const container = document.getElementById('rateList');
    container.innerHTML = '';
    
    const sorted = [...data.rates].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (sorted.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">Курсы не добавлены</p>';
        return;
    }
    
    sorted.forEach((rate, index) => {
        const div = document.createElement('div');
        div.className = 'rate-item';
        div.innerHTML = `
            <span class="rate-date">${formatDate(rate.date)}</span>
            <span class="rate-value">1 ¥ = ${rate.value.toFixed(2)} ₽</span>
            <button class="delete-rate" data-date="${rate.date}">Удалить</button>
        `;
        container.appendChild(div);
    });
    
    container.querySelectorAll('.delete-rate').forEach(btn => {
        btn.addEventListener('click', () => {
            data.rates = data.rates.filter(r => r.date !== btn.dataset.date);
            saveData();
            renderRatesList();
            updateStats();
            updateChart();
            renderCalendar();
        });
    });
}

// ==================== ГРАФИК ====================

function initChart() {
    const ctx = document.getElementById('profitChart').getContext('2d');
    
    profitChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Прибыль (₽)',
                data: [],
                borderColor: '#00d26a',
                backgroundColor: 'rgba(0, 210, 106, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#00d26a'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#8b8b9e' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { 
                        color: '#8b8b9e',
                        callback: value => value.toFixed(0) + '₽'
                    }
                }
            }
        }
    });
    
    // Кнопки периода
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            chartPeriod = parseInt(btn.dataset.period);
            updateChart();
        });
    });
    
    // Кнопка точек - toggle
    document.getElementById('togglePointsBtn').addEventListener('click', () => {
        showPoints = !showPoints;
        document.getElementById('togglePointsBtn').classList.toggle('active', showPoints);
        updatePointsVisibility();
    });
    
    updateChart();
}

function updateChart() {
    if (!profitChart) return;
    
    const today = new Date();
    const labels = [];
    const profits = [];
    
    for (let i = chartPeriod - 1; i >= 0; i--) {
        const date = new Date(today);
        // работаем с локальной датой без сдвига по таймзоне
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - i);

        const dateStr = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');

        const dayData = calculateDayProfit(dateStr);
        
        labels.push(date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }));
        profits.push(dayData.profit);
    }
    
    profitChart.data.labels = labels;
    profitChart.data.datasets[0].data = profits;
    
    // Цвет линии в зависимости от общего результата
    const total = profits.reduce((a, b) => a + b, 0);
    const color = total >= 0 ? '#00d26a' : '#ff4757';
    profitChart.data.datasets[0].borderColor = color;
    profitChart.data.datasets[0].pointBackgroundColor = color;
    profitChart.data.datasets[0].backgroundColor = total >= 0 
        ? 'rgba(0, 210, 106, 0.1)' 
        : 'rgba(255, 71, 87, 0.1)';
    
    updatePointsVisibility();
    profitChart.update();
}

function updatePointsVisibility() {
    if (!profitChart) return;
    profitChart.data.datasets[0].pointRadius = showPoints ? 4 : 0;
    profitChart.update();
}

// ==================== ДЕТАЛИЗАЦИЯ ====================

function showDetails(type, filterItemType = null) {
    const modal = document.getElementById('detailsModal');
    const title = document.getElementById('detailsTitle');
    const summary = document.getElementById('detailsSummary');
    const list = document.getElementById('detailsList');
    
    let transactions = [];
    let titleText = '';
    
    if (type === 'income') {
        titleText = filterItemType ? `Продажи: ${filterItemType}` : 'Все продажи';
        transactions = filterItemType 
            ? data.sales.filter(s => s.itemType === filterItemType)
            : [...data.sales];
        transactions = transactions.map(t => ({ ...t, transType: 'income' }));
    } else if (type === 'expense') {
        titleText = filterItemType ? `Покупки: ${filterItemType}` : 'Все покупки';
        transactions = filterItemType 
            ? data.purchases.filter(p => p.itemType === filterItemType)
            : [...data.purchases];
        transactions = transactions.map(t => ({ ...t, transType: 'expense' }));
    } else if (type === 'all') {
        titleText = filterItemType ? `Все операции: ${filterItemType}` : 'Все операции';
        const sales = (filterItemType 
            ? data.sales.filter(s => s.itemType === filterItemType)
            : [...data.sales]).map(t => ({ ...t, transType: 'income' }));
        const purchases = (filterItemType 
            ? data.purchases.filter(p => p.itemType === filterItemType)
            : [...data.purchases]).map(t => ({ ...t, transType: 'expense' }));
        transactions = [...sales, ...purchases];
    }
    
    // Сортировка по дате (новые сверху)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    title.textContent = titleText;
    
    // Подсчёт итогов
    const totalIncome = transactions.filter(t => t.transType === 'income')
        .reduce((sum, t) => sum + getAmountInRub(t), 0);
    const totalExpense = transactions.filter(t => t.transType === 'expense')
        .reduce((sum, t) => sum + getAmountInRub(t), 0);
    const totalQty = transactions.reduce((sum, t) => sum + t.quantity, 0);
    
    summary.innerHTML = `
        <div class="summary-card income">
            <div class="label">Доход</div>
            <div class="value">${formatMoney(totalIncome)}</div>
        </div>
        <div class="summary-card expense">
            <div class="label">Расход</div>
            <div class="value">${formatMoney(totalExpense)}</div>
        </div>
        <div class="summary-card">
            <div class="label">Всего операций</div>
            <div class="value" style="color: var(--text-primary)">${transactions.length} (${totalQty} шт.)</div>
        </div>
    `;
    
    // Список транзакций
    list.innerHTML = '';
    if (transactions.length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Нет данных</p>';
    } else {
        transactions.forEach(t => {
            const div = document.createElement('div');
            div.className = `detail-item ${t.transType}`;
            div.innerHTML = `
                <div class="detail-info">
                    <div class="detail-type">${t.itemType}</div>
                    <div class="detail-date">${formatDate(t.date)} ${t.currency === 'CNY' ? '(¥)' : ''}</div>
                </div>
                <div class="detail-qty">${t.quantity} шт.</div>
                <div class="detail-amount">${t.transType === 'income' ? '+' : '-'}${formatMoney(getAmountInRub(t))}</div>
                <div class="detail-actions">
                    <button class="delete-btn" data-id="${t.id}" data-type="${t.transType}">Удалить</button>
                </div>
            `;
            list.appendChild(div);
        });
        
        // Удаление транзакций
        list.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const transType = btn.dataset.type;
                
                if (transType === 'income') {
                    data.sales = data.sales.filter(s => s.id !== id);
                } else {
                    data.purchases = data.purchases.filter(p => p.id !== id);
                }
                
                saveData();
                updateStats();
                updateChart();
                renderCalendar();
                
                // Обновить модалку
                showDetails(type, filterItemType);
            });
        });
    }
    
    modal.classList.remove('hidden');
}

// Инициализация кликов на карточки
function initDetailsClicks() {
    // Клик на карточку дохода
    document.querySelector('.stat-card.income').addEventListener('click', () => {
        showDetails('income');
    });
    
    // Клик на карточку расхода
    document.querySelector('.stat-card.expense').addEventListener('click', () => {
        showDetails('expense');
    });
}
