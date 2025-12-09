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
    document.getElementById('dateFrom').addEventListener('change', () => {
        updateStats();
        updateChart();
    });
    document.getElementById('dateTo').addEventListener('change', () => {
        updateStats();
        updateChart();
    });
    document.getElementById('resetDatesBtn').addEventListener('click', () => {
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        updateStats();
        updateChart();
    });
    
    // Кнопки масштаба графика
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            chartPeriod = parseInt(btn.dataset.period);
            updateStats();
            updateChart();
        });
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
        
        // Цена за 1 шт. * количество = общая сумма
        const totalAmount = amount * quantity;
        
        data.purchases.push({
            id: Date.now(),
            itemType,
            currency,
            originalAmount: totalAmount,
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
        
        // Цена за 1 шт. * количество = общая сумма
        const totalAmount = amount * quantity;
        
        data.sales.push({
            id: Date.now(),
            itemType,
            currency,
            originalAmount: totalAmount,
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
    
    // Сохранение редактирования транзакции
    document.getElementById('saveEditTxBtn').addEventListener('click', () => {
        const idStr = document.getElementById('editTxId').value;
        const transType = document.getElementById('editTxType').value;
        const context = document.getElementById('editTxContext').value;
        const contextDateStr = document.getElementById('editTxDate').value;
        
        const newItemType = document.getElementById('editTxItemType').value;
        const newDate = document.getElementById('editTxDateInput').value;
        const newCurrency = document.getElementById('editTxCurrency').value;
        const newPricePerUnit = parseFloat(document.getElementById('editTxAmount').value);
        const newQty = parseInt(document.getElementById('editTxQuantity').value, 10);
        
        if (!newItemType) {
            alert('Выберите тип вещи');
            return;
        }
        if (!newDate) {
            alert('Укажите дату');
            return;
        }
        if (!isFinite(newPricePerUnit) || newPricePerUnit <= 0) {
            alert('Введите корректную цену');
            return;
        }
        if (!Number.isFinite(newQty) || newQty <= 0) {
            alert('Введите корректное количество');
            return;
        }
        
        const arr = transType === 'income' ? data.sales : data.purchases;
        const tx = arr.find(t => String(t.id) === idStr);
        if (!tx) return;
        
        // Обновляем все поля
        tx.itemType = newItemType;
        tx.date = newDate;
        tx.currency = newCurrency;
        tx.originalAmount = newPricePerUnit * newQty;
        tx.quantity = newQty;
        
        saveData();
        updateStats();
        updateChart();
        renderCalendar();
        
        document.getElementById('editTxModal').classList.add('hidden');
        
        // Обновляем нужный контекст
        if (context === 'day' && contextDateStr) {
            showDayDetails(contextDateStr);
        } else if (context === 'details' && window._editDetailsParams) {
            showDetails(window._editDetailsParams.type, window._editDetailsParams.filterItemType);
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

// Получить курс для даты (берём ближайший курс НА или ДО этой даты)
function getRateForDate(dateStr) {
    if (data.rates.length === 0) return 1;
    
    const targetDate = new Date(dateStr);
    targetDate.setHours(23, 59, 59, 999); // Конец дня
    
    // Сортируем по дате (новые первые)
    const sorted = [...data.rates].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Ищем курс на дату <= целевой
    for (const rate of sorted) {
        const rateDate = new Date(rate.date);
        rateDate.setHours(0, 0, 0, 0); // Начало дня
        if (rateDate <= targetDate) {
            return rate.value;
        }
    }
    
    // Если нет курса на эту дату или раньше — возвращаем 1
    return 1;
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

// Форматировать дату в YYYY-MM-DD (локальное время)
function formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Получить диапазон дат для статистики
function getStatsDateRange() {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    // Если заданы даты фильтра — используем их
    if (dateFrom && dateTo) {
        return { from: dateFrom, to: dateTo };
    }
    
    // Иначе используем chartPeriod (масштаб)
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Конец сегодняшнего дня
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - chartPeriod + 1);
    fromDate.setHours(0, 0, 0, 0);
    
    return {
        from: formatDateLocal(fromDate),
        to: formatDateLocal(today)
    };
}

// Обновление статистики с динамическим пересчётом курса
function updateStats() {
    const filterType = document.getElementById('itemTypeFilter').value;
    const equalize = document.getElementById('equalizeToggle').checked;
    const { from: dateFrom, to: dateTo } = getStatsDateRange();
    
    // Фильтрация по типу
    let purchases = filterType === 'all' 
        ? [...data.purchases] 
        : data.purchases.filter(p => p.itemType === filterType);
    
    let sales = filterType === 'all' 
        ? [...data.sales] 
        : data.sales.filter(s => s.itemType === filterType);
    
    // Фильтрация по датам (всегда применяется)
    purchases = purchases.filter(p => p.date >= dateFrom && p.date <= dateTo);
    sales = sales.filter(s => s.date >= dateFrom && s.date <= dateTo);
    
    // Подсчет количества
    let totalBought = purchases.reduce((sum, p) => sum + p.quantity, 0);
    let totalSold = sales.reduce((sum, s) => sum + s.quantity, 0);
    
    // Суммы с динамическим пересчётом по курсу
    let totalSaleAmount = sales.reduce((sum, s) => sum + getAmountInRub(s), 0);
    
    // Приравнивание: убираем самые новые покупки
    let displayBought = totalBought;
    let displaySold = totalSold;
    let totalExpense = 0;
    
    if (equalize && totalBought > totalSold && totalSold > 0) {
        // Сортируем покупки по дате (старые первые)
        const sortedPurchases = [...purchases].sort((a, b) => a.date.localeCompare(b.date));
        
        let remainingQty = totalSold;
        for (const p of sortedPurchases) {
            if (remainingQty <= 0) break;
            
            const pricePerUnit = getAmountInRub(p) / p.quantity;
            const takeQty = Math.min(p.quantity, remainingQty);
            totalExpense += takeQty * pricePerUnit;
            remainingQty -= takeQty;
        }
        displayBought = totalSold;
    } else {
        totalExpense = purchases.reduce((sum, p) => sum + getAmountInRub(p), 0);
    }
    
    let totalIncome = totalSaleAmount;
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
    
    const { from: dateFrom, to: dateTo } = getStatsDateRange();
    
    data.itemTypes.forEach(type => {
        let purchases = data.purchases.filter(p => p.itemType === type);
        let sales = data.sales.filter(s => s.itemType === type);
        
        // Фильтрация по датам (всегда применяется)
        purchases = purchases.filter(p => p.date >= dateFrom && p.date <= dateTo);
        sales = sales.filter(s => s.date >= dateFrom && s.date <= dateTo);
        
        let bought = purchases.reduce((sum, p) => sum + p.quantity, 0);
        let sold = sales.reduce((sum, s) => sum + s.quantity, 0);
        
        // Динамический пересчёт по курсу
        let boughtAmount = purchases.reduce((sum, p) => sum + getAmountInRub(p), 0);
        let soldAmount = sales.reduce((sum, s) => sum + getAmountInRub(s), 0);
        
        if (bought === 0 && sold === 0) return;
        
        // Приравнивание: убираем самые новые покупки
        if (equalize && bought > sold && sold > 0) {
            const sortedPurchases = [...purchases].sort((a, b) => a.date.localeCompare(b.date));
            
            let remainingQty = sold;
            boughtAmount = 0;
            for (const p of sortedPurchases) {
                if (remainingQty <= 0) break;
                
                const pricePerUnit = getAmountInRub(p) / p.quantity;
                const takeQty = Math.min(p.quantity, remainingQty);
                boughtAmount += takeQty * pricePerUnit;
                remainingQty -= takeQty;
            }
            bought = sold;
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
    
    // Закрытие деталей дня
    document.getElementById('closeDayDetails').addEventListener('click', () => {
        document.getElementById('dayDetails').classList.add('hidden');
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
        const dayData = calculateDayProfit(dateStr);
        
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        if (dayData.hasData) {
            dayEl.classList.add('has-data');
            if (dayData.profit < 0) {
                dayEl.classList.add('negative');
            }
        }
        
        let profitHtml = '';
        if (dayData.hasData && dayData.profit !== 0) {
            const profitClass = dayData.profit >= 0 ? 'day-profit-pos' : 'day-profit-neg';
            const sign = dayData.profit >= 0 ? '+' : '-';
            const absProfit = Math.abs(dayData.profit);
            profitHtml = `<span class="day-profit ${profitClass}">${sign}${formatMoney(absProfit)}</span>`;
        }
        
        dayEl.innerHTML = `
            <span class="day-number">${day}</span>
            ${profitHtml}
        `;
        
        if (dayData.hasData) {
            dayEl.addEventListener('click', () => {
                showDayDetails(dateStr);
            });
        }
        
        grid.appendChild(dayEl);
    }
}

function calculateDayProfit(dateStr) {
    const daySales = data.sales.filter(s => s.date === dateStr);
    const dayPurchases = data.purchases.filter(p => p.date === dateStr);
    
    const equalizeEl = document.getElementById('equalizeToggle');
    const equalize = equalizeEl ? equalizeEl.checked : false;
    
    // Без приравнивания: просто деньги по дням
    if (!equalize) {
        if (daySales.length === 0 && dayPurchases.length === 0) {
            return { hasData: false, profit: 0 };
        }
        
        const income = daySales.reduce((sum, s) => sum + getAmountInRub(s), 0);
        const expense = dayPurchases.reduce((sum, p) => sum + getAmountInRub(p), 0);
        
        return { hasData: true, profit: income - expense };
    }
    
    // С приравниванием: распределяем расходы по датам покупок FIFO по типам
    const equalizedCostByDate = {};
    
    data.itemTypes.forEach(type => {
        const typePurchases = data.purchases
            .filter(p => p.itemType === type)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        const typeSales = data.sales.filter(s => s.itemType === type);
        const totalSoldQty = typeSales.reduce((sum, s) => sum + s.quantity, 0);
        let remaining = totalSoldQty;
        
        typePurchases.forEach(p => {
            if (remaining <= 0) return;
            const useQty = Math.min(p.quantity, remaining);
            if (useQty <= 0) return;
            
            const fullCost = getAmountInRub(p);
            const costPart = fullCost * (useQty / p.quantity);
            remaining -= useQty;
            
            if (!equalizedCostByDate[p.date]) {
                equalizedCostByDate[p.date] = 0;
            }
            equalizedCostByDate[p.date] += costPart;
        });
    });
    
    const incomeEqualized = daySales.reduce((sum, s) => sum + getAmountInRub(s), 0);
    const expenseEqualized = equalizedCostByDate[dateStr] || 0;
    
    const hasAny = incomeEqualized !== 0 || expenseEqualized !== 0;
    return { hasData: hasAny, profit: incomeEqualized - expenseEqualized };
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
    
    // Объединяем и сортируем по времени
    const allTransactions = [
        ...daySales.map(s => ({ ...s, transType: 'income' })),
        ...dayPurchases.map(p => ({ ...p, transType: 'expense' }))
    ].sort((a, b) => {
        const timeA = a.time || '00:00';
        const timeB = b.time || '00:00';
        return timeB.localeCompare(timeA); // Новые сверху
    });
    
    allTransactions.forEach(tx => {
        const div = document.createElement('div');
        div.className = `transaction-item ${tx.transType === 'income' ? 'sale' : 'expense'}`;
        const pricePerUnit = tx.originalAmount / tx.quantity;
        const timeStr = tx.time ? `<span class="tx-time">${tx.time}</span>` : '';
        const sign = tx.transType === 'income' ? '' : '-';
        
        div.innerHTML = `
            <span>${tx.itemType} ${timeStr}</span>
            <span>${tx.quantity} шт.</span>
            <span>${sign}${formatMoney(getAmountInRub(tx))}</span>
            <button class="day-edit" data-id="${tx.id}" data-type="${tx.transType === 'income' ? 'income' : 'expense'}" data-price="${pricePerUnit}">Изменить</button>
            <button class="day-delete" data-id="${tx.id}" data-type="${tx.transType === 'income' ? 'income' : 'expense'}">Удалить</button>
        `;
        container.appendChild(div);
    });
    
    // Обработчики редактирования для дня — открываем модалку
    container.querySelectorAll('.day-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const idStr = btn.dataset.id;
            const transType = btn.dataset.type;
            const arr = transType === 'income' ? data.sales : data.purchases;
            const tx = arr.find(t => String(t.id) === idStr);
            if (!tx) return;
            
            // Заполняем select типов вещей
            const itemTypeSelect = document.getElementById('editTxItemType');
            itemTypeSelect.innerHTML = '';
            data.itemTypes.forEach(type => {
                const opt = document.createElement('option');
                opt.value = type;
                opt.textContent = type;
                itemTypeSelect.appendChild(opt);
            });
            itemTypeSelect.value = tx.itemType;
            
            const pricePerUnit = tx.originalAmount / tx.quantity;
            document.getElementById('editTxAmount').value = pricePerUnit.toFixed(2);
            document.getElementById('editTxQuantity').value = tx.quantity;
            document.getElementById('editTxDateInput').value = tx.date;
            document.getElementById('editTxCurrency').value = tx.currency || 'RUB';
            document.getElementById('editTxId').value = idStr;
            document.getElementById('editTxType').value = transType;
            document.getElementById('editTxContext').value = 'day';
            document.getElementById('editTxDate').value = dateStr;
            document.getElementById('editTxModal').classList.remove('hidden');
        });
    });
    
    container.querySelectorAll('.day-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const idStr = btn.dataset.id;
            const transType = btn.dataset.type;
            
            if (transType === 'income') {
                data.sales = data.sales.filter(s => String(s.id) !== idStr);
            } else {
                data.purchases = data.purchases.filter(p => String(p.id) !== idStr);
            }
            
            saveData();
            updateStats();
            updateChart();
            renderCalendar();
            showDayDetails(dateStr);
        });
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
    
    sorted.forEach(rate => {
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
    
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    const labels = [];
    const profits = [];
    
    // Если заданы даты фильтра — используем их диапазон
    if (dateFrom && dateTo) {
        const start = new Date(dateFrom);
        const end = new Date(dateTo);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = [
                d.getFullYear(),
                String(d.getMonth() + 1).padStart(2, '0'),
                String(d.getDate()).padStart(2, '0')
            ].join('-');
            
            const dayData = calculateDayProfit(dateStr);
            labels.push(d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }));
            profits.push(dayData.profit);
        }
    } else {
        // Иначе используем период (7/30/365 дней)
        const today = new Date();
        for (let i = chartPeriod - 1; i >= 0; i--) {
            const date = new Date(today);
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
    
    // Сортировка по дате и времени (новые сверху)
    transactions.sort((a, b) => {
        const dateA = new Date(a.date + (a.time ? 'T' + a.time : 'T00:00'));
        const dateB = new Date(b.date + (b.time ? 'T' + b.time : 'T00:00'));
        return dateB - dateA;
    });
    
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
            
            // Формируем строку даты и времени
            const timeStr = t.time ? ` ${t.time}` : '';
            const currencyLabel = t.currency === 'CNY' ? ' (¥)' : '';
            
            // Кнопка конвертации только для расходов в рублях
            const convertBtn = (t.transType === 'expense' && t.currency === 'RUB') 
                ? `<button class="convert-btn" data-id="${t.id}" title="Конвертировать в юани">¥</button>`
                : '';
            
            div.innerHTML = `
                <div class="detail-info">
                    <div class="detail-type">${t.itemType}</div>
                    <div class="detail-date">${formatDate(t.date)}${timeStr}${currencyLabel}</div>
                </div>
                <div class="detail-qty">${t.quantity} шт.</div>
                <div class="detail-amount">${t.transType === 'income' ? '+' : '-'}${formatMoney(getAmountInRub(t))}</div>
                <div class="detail-actions">
                    ${convertBtn}
                    <button class="edit-btn" data-id="${t.id}" data-type="${t.transType}">Изменить</button>
                    <button class="delete-btn" data-id="${t.id}" data-type="${t.transType}">Удалить</button>
                </div>
            `;
            list.appendChild(div);
        });
        
        // Редактирование транзакций — открываем модалку
        list.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idStr = btn.dataset.id;
                const transType = btn.dataset.type;
                const arr = transType === 'income' ? data.sales : data.purchases;
                const tx = arr.find(tr => String(tr.id) === idStr);
                if (!tx) return;
                
                // Заполняем select типов вещей
                const itemTypeSelect = document.getElementById('editTxItemType');
                itemTypeSelect.innerHTML = '';
                data.itemTypes.forEach(itemType => {
                    const opt = document.createElement('option');
                    opt.value = itemType;
                    opt.textContent = itemType;
                    itemTypeSelect.appendChild(opt);
                });
                itemTypeSelect.value = tx.itemType;
                
                const pricePerUnit = tx.originalAmount / tx.quantity;
                document.getElementById('editTxAmount').value = pricePerUnit.toFixed(2);
                document.getElementById('editTxQuantity').value = tx.quantity;
                document.getElementById('editTxDateInput').value = tx.date;
                document.getElementById('editTxCurrency').value = tx.currency || 'RUB';
                document.getElementById('editTxId').value = idStr;
                document.getElementById('editTxType').value = transType;
                document.getElementById('editTxContext').value = 'details';
                document.getElementById('editTxDate').value = '';
                
                // Сохраняем параметры для повторного открытия showDetails
                window._editDetailsParams = { type, filterItemType };
                
                document.getElementById('editTxModal').classList.remove('hidden');
            });
        });
        
        // Конвертация валюты (RUB -> CNY)
        list.querySelectorAll('.convert-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idStr = btn.dataset.id;
                const purchase = data.purchases.find(p => String(p.id) === idStr);
                if (!purchase || purchase.currency !== 'RUB') return;
                
                const rate = getRateForDate(purchase.date);
                if (rate <= 0) {
                    alert('Курс для этой даты не найден!');
                    return;
                }
                
                // Конвертируем RUB в CNY
                const amountInCny = purchase.originalAmount / rate;
                purchase.originalAmount = Math.round(amountInCny * 100) / 100;
                purchase.currency = 'CNY';
                
                saveData();
                updateStats();
                updateChart();
                renderCalendar();
                showDetails(type, filterItemType);
            });
        });
        
        // Удаление транзакций
        list.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idStr = btn.dataset.id;
                const transType = btn.dataset.type;
                
                if (transType === 'income') {
                    data.sales = data.sales.filter(s => String(s.id) !== idStr);
                } else {
                    data.purchases = data.purchases.filter(p => String(p.id) !== idStr);
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
