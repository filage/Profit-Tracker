// Инициализация данных
let data = {
    itemTypes: ['Тип 1', 'Тип 2', 'Тип 3', 'Тип 4', 'Тип 5', 'Тип 6', 'Тип 7', 'Тип 8', 'Тип 9'],
    purchases: [],
    sales: [],
    rates: [],
    itemImages: {}
};

function getNowTimeHHMM() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

function initItemImagePicker() {
    const input = document.getElementById('itemImageFile');
    if (!input) return;

    input.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;

        const type = pendingItemImageType;
        pendingItemImageType = null;
        if (!type) return;

        if (!file.type || !file.type.startsWith('image/')) {
            alert('Выберите файл изображения');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('Файл слишком большой. Выбери картинку поменьше.');
            return;
        }

        try {
            const dataUrl = await readAndResizeImageToDataUrl(file, 256);
            if (!data.itemImages || typeof data.itemImages !== 'object') data.itemImages = {};
            data.itemImages[type] = dataUrl;
            saveData();
            renderInventory();
        } catch (err) {
            alert('Не удалось обработать изображение: ' + (err && err.message ? err.message : err));
        }
    });
}

function readAndResizeImageToDataUrl(file, maxSide) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Ошибка чтения файла'));
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const w = img.naturalWidth || img.width;
                const h = img.naturalHeight || img.height;

                if (!w || !h) {
                    reject(new Error('Неверное изображение'));
                    return;
                }

                const scale = Math.min(1, maxSide / Math.max(w, h));
                const outW = Math.max(1, Math.round(w * scale));
                const outH = Math.max(1, Math.round(h * scale));

                const canvas = document.createElement('canvas');
                canvas.width = outW;
                canvas.height = outH;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, outW, outH);

                let out;
                try {
                    out = canvas.toDataURL('image/webp', 0.85);
                } catch (_) {
                    out = canvas.toDataURL('image/jpeg', 0.85);
                }

                resolve(out);
            };
            img.onerror = () => reject(new Error('Ошибка загрузки изображения'));
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

// Переменные для графика
let profitChart = null;
let chartPeriod = 30;
let showPoints = true;

let pendingItemImageType = null;

let selectedPlatform = 'funpay';
const PLATFORM_STORAGE_KEY = 'profitTrackerPlatform';
const PLAYEROK_FEE_PERCENT_STORAGE_KEY = 'profitTrackerPlayerokFeePercent';
const PLAYEROK_SETTINGS_OPEN_STORAGE_KEY = 'profitTrackerPlayerokSettingsOpen';

let playerokFeePercent = 15;
let isPlayerokSettingsOpen = false;

// Загрузка данных из localStorage
function loadData() {
    const saved = localStorage.getItem('profitTrackerData');
    if (saved) {
        data = JSON.parse(saved);
    }

    if (!data || typeof data !== 'object') {
        data = {
            itemTypes: [],
            purchases: [],
            sales: [],
            rates: [],
            itemImages: {}
        };
    }

    if (!Array.isArray(data.itemTypes)) data.itemTypes = [];
    if (!Array.isArray(data.purchases)) data.purchases = [];
    if (!Array.isArray(data.sales)) data.sales = [];
    if (!Array.isArray(data.rates)) data.rates = [];
    if (!data.itemImages || typeof data.itemImages !== 'object') data.itemImages = {};

    // Совместимость со старыми/расширением: продажи без platform считаем FunPay
    data.sales.forEach(s => {
        if (s && !s.platform) s.platform = 'funpay';
    });
}

function loadPlatformSelection() {
    const saved = localStorage.getItem(PLATFORM_STORAGE_KEY);
    if (saved === 'funpay' || saved === 'playerok' || saved === 'overall') {
        selectedPlatform = saved;
    }
}

function loadPlayerokFeePercent() {
    const saved = localStorage.getItem(PLAYEROK_FEE_PERCENT_STORAGE_KEY);
    const n = saved !== null ? parseFloat(saved) : NaN;
    if (Number.isFinite(n) && n >= 0 && n <= 100) {
        playerokFeePercent = n;
    } else {
        playerokFeePercent = 15;
    }
}

function savePlayerokFeePercent(value) {
    const n = parseFloat(value);
    if (!Number.isFinite(n) || n < 0 || n > 100) return false;
    playerokFeePercent = n;
    localStorage.setItem(PLAYEROK_FEE_PERCENT_STORAGE_KEY, String(n));
    return true;
}

function loadPlayerokSettingsOpen() {
    const saved = localStorage.getItem(PLAYEROK_SETTINGS_OPEN_STORAGE_KEY);
    isPlayerokSettingsOpen = saved === '1';
}

function setPlayerokSettingsOpen(open) {
    isPlayerokSettingsOpen = !!open;
    localStorage.setItem(PLAYEROK_SETTINGS_OPEN_STORAGE_KEY, isPlayerokSettingsOpen ? '1' : '0');
    syncPlatformSettingsUi();
}

function getActivePlatform() {
    return selectedPlatform;
}

function setActivePlatform(platform) {
    if (platform !== 'funpay' && platform !== 'playerok' && platform !== 'overall') return;
    selectedPlatform = platform;
    localStorage.setItem(PLATFORM_STORAGE_KEY, platform);

    calendarProfitCache = null;
    calendarProfitCacheKey = null;

    // UI
    const switchEl = document.getElementById('platformSwitch');
    if (switchEl) {
        switchEl.querySelectorAll('.platform-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.platform === platform);
        });
    }

    syncSalePlatformUi();
    syncPlatformSettingsUi();

    updateStats();
    updateChart();
    renderCalendar();
}

function initPlatformSwitch() {
    loadPlatformSelection();
    loadPlayerokFeePercent();
    loadPlayerokSettingsOpen();
    const switchEl = document.getElementById('platformSwitch');
    if (!switchEl) return;

    switchEl.querySelectorAll('.platform-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setActivePlatform(btn.dataset.platform);
        });
    });

    // первичная синхронизация
    setActivePlatform(selectedPlatform);
}

function normalizeSalePlatform(sale) {
    return (sale && sale.platform) ? sale.platform : 'funpay';
}

function filterSalesByPlatform(sales, platform) {
    if (platform === 'overall') return sales;
    return sales.filter(s => normalizeSalePlatform(s) === platform);
}

function getPlatformCommissionMultiplier(platform) {
    if (platform === 'playerok') {
        const fee = Number.isFinite(playerokFeePercent) ? playerokFeePercent : 15;
        return 1 - (fee / 100);
    }
    return 0.97;
}

function getSalesForActivePlatform() {
    return filterSalesByPlatform(data.sales || [], getActivePlatform());
}

function getAllKnownItemTypesUpTo(maxDateStr) {
    const set = new Set();
    (data.itemTypes || []).forEach(t => {
        if (t) set.add(t);
    });
    (data.purchases || []).forEach(p => {
        if (!p || !p.itemType) return;
        if (maxDateStr && p.date > maxDateStr) return;
        set.add(p.itemType);
    });
    (data.sales || []).forEach(s => {
        if (!s || !s.itemType) return;
        if (maxDateStr && s.date > maxDateStr) return;
        set.add(s.itemType);
    });
    return [...set];
}

function calculatePurchaseAllocationForTypes(types, maxDateStr) {
    const purchases = (data.purchases || [])
        .filter(p => types.includes(p.itemType) && (!maxDateStr || p.date <= maxDateStr));

    const sales = (data.sales || [])
        .filter(s => types.includes(s.itemType) && (!maxDateStr || s.date <= maxDateStr));

    const carryover = {};
    types.forEach(type => {
        carryover[type] = [];
    });

    const byPurchaseId = {};
    const purchaseById = {};
    const costPerUnitById = {};

    const allDates = [...new Set([
        ...purchases.map(p => p.date),
        ...sales.map(s => s.date)
    ])].sort();

    allDates.forEach(dateStr => {
        const dayPurchases = purchases
            .filter(p => p.date === dateStr)
            .sort(sortByDateTime);

        dayPurchases.forEach(p => {
            purchaseById[p.id] = p;
            costPerUnitById[p.id] = getAmountInRub(p) / p.quantity;
            if (!byPurchaseId[p.id]) byPurchaseId[p.id] = { funpay: 0, playerok: 0 };

            if (!carryover[p.itemType]) carryover[p.itemType] = [];
            carryover[p.itemType].push({ purchaseId: p.id, qty: p.quantity });
        });

        const daySales = sales
            .filter(s => s.date === dateStr)
            .sort(sortByDateTime);

        daySales.forEach(s => {
            const type = s.itemType;
            let remainingToSell = s.quantity;
            const platform = normalizeSalePlatform(s);

            if (!carryover[type]) carryover[type] = [];

            while (remainingToSell > 0 && carryover[type].length > 0) {
                const oldest = carryover[type][0];
                const takeQty = Math.min(oldest.qty, remainingToSell);

                if (!byPurchaseId[oldest.purchaseId]) byPurchaseId[oldest.purchaseId] = { funpay: 0, playerok: 0 };
                if (platform === 'playerok') {
                    byPurchaseId[oldest.purchaseId].playerok += takeQty;
                } else {
                    byPurchaseId[oldest.purchaseId].funpay += takeQty;
                }

                oldest.qty -= takeQty;
                remainingToSell -= takeQty;
                if (oldest.qty <= 0) {
                    carryover[type].shift();
                }
            }
        });
    });

    return { byPurchaseId, purchaseById, costPerUnitById };
}

function getEffectivePurchaseQtyForPlatform(purchase, allocation, platform) {
    if (platform === 'overall') return purchase.quantity;

    const byId = (allocation && allocation.byPurchaseId) ? allocation.byPurchaseId : {};
    const consumed = byId[purchase.id] || { funpay: 0, playerok: 0 };
    const totalConsumed = (consumed.funpay || 0) + (consumed.playerok || 0);
    const remaining = Math.max(0, purchase.quantity - totalConsumed);
    const platformConsumed = platform === 'playerok' ? (consumed.playerok || 0) : (consumed.funpay || 0);

    return platformConsumed + remaining;
}

function syncSalePlatformUi() {
    const platform = getActivePlatform();
    const group = document.getElementById('salePlatformGroup');
    const select = document.getElementById('salePlatform');
    if (group && select) {
        if (platform === 'overall') {
            group.style.display = '';
        } else {
            group.style.display = 'none';
            select.value = platform;
        }
    }
}

function syncPlatformSettingsUi() {
    const active = getActivePlatform();
    const setting = document.getElementById('playerokFeeSetting');
    const input = document.getElementById('playerokFeePercent');
    if (!setting) return;

    const visible = (active === 'playerok' || active === 'overall') && isPlayerokSettingsOpen;
    setting.classList.toggle('visible', visible);
    if (input) {
        input.value = String(playerokFeePercent);
    }
}

function initPlatformSettings() {
    const btn = document.getElementById('savePlayerokFeeBtn');
    const input = document.getElementById('playerokFeePercent');
    const gearBtn = document.getElementById('playerokSettingsBtn');
    if (btn && input) {
        btn.addEventListener('click', () => {
            const ok = savePlayerokFeePercent(input.value);
            if (!ok) {
                alert('Введите корректный процент комиссии (0–100)');
                return;
            }
            updateStats();
            updateChart();
            renderCalendar();
        });
    }

    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (btn) btn.click();
            }
        });
    }

    if (gearBtn) {
        const onToggle = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setPlayerokSettingsOpen(!isPlayerokSettingsOpen);
        };
        gearBtn.addEventListener('click', onToggle);
        gearBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                onToggle(e);
            }
        });
    }

    syncPlatformSettingsUi();
}

// Сохранение данных в localStorage
function saveData() {
    localStorage.setItem('profitTrackerData', JSON.stringify(data));
    // Сбрасываем кэш прибыли при изменении данных
    calendarProfitCache = null;
    calendarProfitCacheKey = null;
}

// Текущий месяц для календаря
let currentDate = new Date();

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initPlatformSwitch();
    initPlatformSettings();
    initTabs();
    initModals();
    initForms();
    initItemImagePicker();
    initCalendar();
    initRates();
    initChart();
    initDetailsClicks();
    updateItemTypeSelects();
    
    updateStats();
    renderItemTypesList();
    renderInventory();
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

            if (tab.dataset.tab === 'inventory') {
                renderInventory();
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
    document.getElementById('itemTypeFilter').addEventListener('change', () => {
        updateStats();
        updateChart();
    });
    
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
            document.getElementById('dateFrom').value = '';
            document.getElementById('dateTo').value = '';
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
                    rates: imported.rates || [],
                    itemImages: imported.itemImages || {}
                };

                (data.sales || []).forEach(s => {
                    if (s && !s.platform) s.platform = 'funpay';
                });
                
                saveData();
                updateItemTypeSelects();
                updateStats();
                updateChart();
                renderCalendar();
                renderRatesList();
                renderItemTypesList();
                renderInventory();
                
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
        document.getElementById('purchaseTime').value = getNowTimeHHMM();
        document.getElementById('purchaseModal').classList.remove('hidden');
    });
    
    document.getElementById('addSaleBtn').addEventListener('click', () => {
        document.getElementById('saleDate').valueAsDate = new Date();
        document.getElementById('saleTime').value = getNowTimeHHMM();
        syncSalePlatformUi();
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
            renderInventory();
            input.value = '';
        }
    });
}

// Инициализация форм
function initForms() {
    // Форма покупки - с датой и временем
    document.getElementById('purchaseForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const itemType = document.getElementById('purchaseItemType').value;
        const purchaseDate = document.getElementById('purchaseDate').value;
        const purchaseTime = document.getElementById('purchaseTime').value || '';
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
            date: purchaseDate,
            time: purchaseTime
        });
        
        saveData();
        updateStats();
        updateChart();
        renderCalendar();
        renderInventory();
        document.getElementById('purchaseModal').classList.add('hidden');
        document.getElementById('purchaseForm').reset();
    });
    
    // Форма продажи - с датой и временем
    document.getElementById('saleForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const itemType = document.getElementById('saleItemType').value;
        const saleDate = document.getElementById('saleDate').value;
        const saleTime = document.getElementById('saleTime').value || '';
        const currency = document.getElementById('saleCurrency').value;
        const quantity = parseInt(document.getElementById('saleQuantity').value);
        const amount = parseFloat(document.getElementById('saleAmount').value);

        const activePlatform = getActivePlatform();
        const platform = activePlatform === 'overall'
            ? document.getElementById('salePlatform').value
            : activePlatform;
        
        // Цена за 1 шт. * количество = общая сумма
        const totalAmount = amount * quantity;
        
        data.sales.push({
            id: Date.now(),
            itemType,
            currency,
            originalAmount: totalAmount,
            quantity,
            date: saleDate,
            time: saleTime,
            platform
        });
        
        saveData();
        updateStats();
        updateChart();
        renderCalendar();
        renderInventory();
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

            if (data.itemImages && Object.prototype.hasOwnProperty.call(data.itemImages, oldName)) {
                data.itemImages[newName] = data.itemImages[oldName];
                delete data.itemImages[oldName];
            }
            
            saveData();
            updateItemTypeSelects();
            renderItemTypesList();
            updateStats();
            renderInventory();
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
        const newTime = document.getElementById('editTxTimeInput').value || '';
        const newCurrency = document.getElementById('editTxCurrency').value;
        const newPricePerUnit = parseFloat(document.getElementById('editTxAmount').value);
        const newQty = parseInt(document.getElementById('editTxQuantity').value, 10);
        const newPlatform = document.getElementById('editTxPlatform') ? document.getElementById('editTxPlatform').value : 'funpay';
        
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
        tx.time = newTime;
        tx.currency = newCurrency;
        tx.originalAmount = newPricePerUnit * newQty;
        tx.quantity = newQty;

        if (transType === 'income') {
            tx.platform = newPlatform || 'funpay';
        }
        
        saveData();
        updateStats();
        updateChart();
        renderCalendar();
        renderInventory();
        
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
            const oldName = data.itemTypes[index];
            data.itemTypes.splice(index, 1);

            if (data.itemImages && Object.prototype.hasOwnProperty.call(data.itemImages, oldName)) {
                delete data.itemImages[oldName];
            }
            saveData();
            updateItemTypeSelects();
            renderItemTypesList();
            updateStats();
            renderInventory();
        });
    });
}

function normalizeQty(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
}

function getInventoryRows() {
    const types = Array.isArray(data.itemTypes) ? data.itemTypes : [];

    const boughtByType = {};
    const soldByType = {};

    (data.purchases || []).forEach(p => {
        if (!p || !p.itemType) return;
        const t = p.itemType;
        boughtByType[t] = (boughtByType[t] || 0) + normalizeQty(p.quantity);
    });

    (data.sales || []).forEach(s => {
        if (!s || !s.itemType) return;
        const t = s.itemType;
        soldByType[t] = (soldByType[t] || 0) + normalizeQty(s.quantity);
    });

    const seen = new Set([...Object.keys(boughtByType), ...Object.keys(soldByType), ...types]);
    const rows = [];
    seen.forEach(type => {
        const bought = boughtByType[type] || 0;
        const sold = soldByType[type] || 0;
        const left = bought - sold;
        if (bought === 0 && sold === 0) return;
        rows.push({ type, bought, sold, left });
    });

    rows.sort((a, b) => {
        if (b.left !== a.left) return b.left - a.left;
        return a.type.localeCompare(b.type);
    });

    return rows;
}

function renderInventory() {
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;

    const rows = getInventoryRows();
    grid.innerHTML = '';

    if (rows.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'inventory-empty';
        empty.textContent = 'Пока нет данных по покупкам/продажам.';
        grid.appendChild(empty);
        return;
    }

    rows.forEach(r => {
        const card = document.createElement('div');
        card.className = 'inventory-card' + (r.left <= 0 ? ' inventory-card-empty' : '');
        card.dataset.itemType = r.type;

        const imgUrl = (data.itemImages && data.itemImages[r.type]) ? String(data.itemImages[r.type]) : '';
        const imgHtml = imgUrl
            ? `<img class="inventory-img" src="${imgUrl}" alt="${r.type}">`
            : `<div class="inventory-img inventory-img-placeholder">${String(r.type).trim().slice(0, 2).toUpperCase()}</div>`;

        card.innerHTML = `
            <div class="inventory-img-wrap">${imgHtml}</div>
            <div class="inventory-info">
                <div class="inventory-name">${r.type}</div>
                <div class="inventory-counts">
                    <div class="inventory-count bought">Куплено: ${r.bought}</div>
                    <div class="inventory-count sold">Продано: ${r.sold}</div>
                </div>
                <div class="inventory-left">Осталось: <span class="inventory-left-value">${r.left}</span></div>
            </div>
            <button class="inventory-img-btn" type="button" title="Картинка">🖼️</button>
        `;

        card.addEventListener('click', () => {
            showDetails('all', r.type);
        });

        const btn = card.querySelector('.inventory-img-btn');
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const hasImage = !!(data.itemImages && data.itemImages[r.type]);
            if (hasImage) {
                const shouldDelete = confirm('Удалить картинку?\n\nОК — удалить\nОтмена — заменить на новую');
                if (shouldDelete) {
                    delete data.itemImages[r.type];
                    saveData();
                    renderInventory();
                    return;
                }
            }

            pendingItemImageType = r.type;
            const input = document.getElementById('itemImageFile');
            if (input) input.click();
        });

        grid.appendChild(card);
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

function getSaleAmountInRub(sale) {
    const platform = normalizeSalePlatform(sale);
    return getAmountInRub(sale) * getPlatformCommissionMultiplier(platform);
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

function getSelectedTypes() {
    const filterType = document.getElementById('itemTypeFilter').value;
    return filterType === 'all' ? [...data.itemTypes] : [filterType];
}

function calculatePeriodTotalsWithCarryover(types, dateFrom, dateTo) {
    const platform = getActivePlatform();
    const carryover = {};
    types.forEach(type => {
        carryover[type] = [];
    });

    const purchases = data.purchases
        .filter(p => types.includes(p.itemType) && p.date <= dateTo)
        .sort(sortByDateTime);
    const sales = data.sales
        .filter(s => types.includes(s.itemType) && s.date <= dateTo)
        .sort(sortByDateTime);

    const allDates = [...new Set([
        ...purchases.map(p => p.date),
        ...sales.map(s => s.date)
    ])].sort();

    let totalIncome = 0;
    let totalExpense = 0;
    let matchedQtyInRange = 0;

    allDates.forEach(dateStr => {
        types.forEach(type => {
            const dayPurchases = purchases.filter(p => p.date === dateStr && p.itemType === type);
            dayPurchases.forEach(p => {
                const costPerUnit = getAmountInRub(p) / p.quantity;
                carryover[type].push({
                    qty: p.quantity,
                    costPerUnit,
                    date: p.date,
                    time: p.time || '00:00'
                });
            });

            const daySales = sales.filter(s => s.date === dateStr && s.itemType === type);
            daySales.forEach(s => {
                let remainingToSell = s.quantity;
                const saleUnitPrice = getSaleAmountInRub(s) / s.quantity;
                const salePlatform = normalizeSalePlatform(s);
                while (remainingToSell > 0 && carryover[type].length > 0) {
                    const oldest = carryover[type][0];
                    const takeQty = Math.min(oldest.qty, remainingToSell);
                    const isInRange = dateStr >= dateFrom && dateStr <= dateTo;
                    const platformMatches = platform === 'overall' || salePlatform === platform;

                    if (isInRange && platformMatches) {
                        matchedQtyInRange += takeQty;
                        totalIncome += takeQty * saleUnitPrice;
                        totalExpense += takeQty * oldest.costPerUnit;
                    }

                    oldest.qty -= takeQty;
                    remainingToSell -= takeQty;
                    if (oldest.qty <= 0) {
                        carryover[type].shift();
                    }
                }
            });
        });
    });

    return { totalIncome, totalExpense, matchedQtyInRange };
}

function calculateAllDaysProfitWithCarryoverForTypes(types, maxDateStr) {
    const platform = getActivePlatform();
    const carryover = {};
    types.forEach(type => {
        carryover[type] = [];
    });

    const purchases = data.purchases
        .filter(p => types.includes(p.itemType) && (!maxDateStr || p.date <= maxDateStr))
        .sort(sortByDateTime);
    const sales = data.sales
        .filter(s => types.includes(s.itemType) && (!maxDateStr || s.date <= maxDateStr))
        .sort(sortByDateTime);

    const allDates = [...new Set([
        ...purchases.map(p => p.date),
        ...sales.map(s => s.date)
    ])].sort();

    const result = {};

    allDates.forEach(dateStr => {
        let dayIncome = 0;
        let dayExpense = 0;

        types.forEach(type => {
            const dayPurchases = purchases.filter(p => p.date === dateStr && p.itemType === type);
            dayPurchases.forEach(p => {
                const costPerUnit = getAmountInRub(p) / p.quantity;
                carryover[type].push({
                    qty: p.quantity,
                    costPerUnit,
                    date: p.date,
                    time: p.time || '00:00'
                });
            });

            const daySales = sales.filter(s => s.date === dateStr && s.itemType === type);
            daySales.forEach(s => {
                let remainingToSell = s.quantity;
                const saleUnitPrice = getSaleAmountInRub(s) / s.quantity;
                const salePlatform = normalizeSalePlatform(s);
                const platformMatches = platform === 'overall' || salePlatform === platform;
                while (remainingToSell > 0 && carryover[type].length > 0) {
                    const oldest = carryover[type][0];
                    const takeQty = Math.min(oldest.qty, remainingToSell);

                    if (platformMatches) {
                        dayIncome += takeQty * saleUnitPrice;
                        dayExpense += takeQty * oldest.costPerUnit;
                    }

                    oldest.qty -= takeQty;
                    remainingToSell -= takeQty;
                    if (oldest.qty <= 0) {
                        carryover[type].shift();
                    }
                }
            });
        });

        if (dayIncome !== 0 || dayExpense !== 0) {
            result[dateStr] = { hasData: true, profit: dayIncome - dayExpense };
        }
    });

    return result;
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
        ? [...getSalesForActivePlatform()] 
        : getSalesForActivePlatform().filter(s => s.itemType === filterType);
    
    // Фильтрация по датам (всегда применяется)
    purchases = purchases.filter(p => p.date >= dateFrom && p.date <= dateTo);
    sales = sales.filter(s => s.date >= dateFrom && s.date <= dateTo);
    
    // Подсчет количества
    let totalBought = purchases.reduce((sum, p) => sum + p.quantity, 0);
    let totalSold = sales.reduce((sum, s) => sum + s.quantity, 0);
    
    // Суммы с динамическим пересчётом по курсу
    let totalSaleAmount = sales.reduce((sum, s) => sum + getSaleAmountInRub(s), 0);
    
    // Приравнивание: по каждому типу min(покупки, продажи)
    let displayBought = totalBought;
    let displaySold = totalSold;
    let totalExpense = 0;
    let totalIncome = 0;
    
    if (equalize) {
        const types = filterType === 'all' ? [...data.itemTypes] : [filterType];
        const totals = calculatePeriodTotalsWithCarryover(types, dateFrom, dateTo);
        totalIncome = totals.totalIncome;
        totalExpense = totals.totalExpense;
        displayBought = totals.matchedQtyInRange;
        displaySold = totals.matchedQtyInRange;
    } else {
        const platform = getActivePlatform();
        const types = filterType === 'all' ? getAllKnownItemTypesUpTo(dateTo) : [filterType];
        const allocation = calculatePurchaseAllocationForTypes(types, dateTo);

        totalBought = purchases.reduce((sum, p) => sum + getEffectivePurchaseQtyForPlatform(p, allocation, platform), 0);
        totalExpense = purchases.reduce((sum, p) => {
            const qty = getEffectivePurchaseQtyForPlatform(p, allocation, platform);
            const costPerUnit = getAmountInRub(p) / p.quantity;
            return sum + (qty * costPerUnit);
        }, 0);
        totalIncome = totalSaleAmount;
        displayBought = totalBought;
    }
    
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
        let bought = 0;
        let sold = 0;
        let boughtAmount = 0;
        let soldAmount = 0;
        
        if (equalize) {
            const totals = calculatePeriodTotalsWithCarryover([type], dateFrom, dateTo);
            bought = totals.matchedQtyInRange;
            sold = totals.matchedQtyInRange;
            boughtAmount = totals.totalExpense;
            soldAmount = totals.totalIncome;
        } else {
            const platform = getActivePlatform();
            const allocation = calculatePurchaseAllocationForTypes([type], dateTo);

            let purchases = (data.purchases || []).filter(p => p.itemType === type);
            let sales = getSalesForActivePlatform().filter(s => s.itemType === type);
            
            purchases = purchases.filter(p => p.date >= dateFrom && p.date <= dateTo);
            sales = sales.filter(s => s.date >= dateFrom && s.date <= dateTo);
            
            bought = purchases.reduce((sum, p) => sum + getEffectivePurchaseQtyForPlatform(p, allocation, platform), 0);
            sold = sales.reduce((sum, s) => sum + s.quantity, 0);
            
            boughtAmount = purchases.reduce((sum, p) => {
                const qty = getEffectivePurchaseQtyForPlatform(p, allocation, platform);
                const costPerUnit = getAmountInRub(p) / p.quantity;
                return sum + (qty * costPerUnit);
            }, 0);
            soldAmount = sales.reduce((sum, s) => sum + getSaleAmountInRub(s), 0);
        }
        
        if (bought === 0 && sold === 0) return;
        
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

    const monthProfitEl = document.getElementById('currentMonthProfit');
    if (monthProfitEl) {
        const allProfits = calculateAllDaysProfitWithCarryover();
        let monthProfit = 0;
        let hasMonthData = false;

        Object.entries(allProfits).forEach(([dateStr, info]) => {
            if (!info || !info.hasData) return;
            const d = new Date(dateStr);
            if (d.getFullYear() === year && d.getMonth() === month) {
                monthProfit += info.profit;
                hasMonthData = true;
            }
        });

        monthProfitEl.classList.remove('positive', 'negative', 'neutral');
        if (hasMonthData) {
            const sign = monthProfit >= 0 ? '+' : '−';
            monthProfitEl.textContent = `Профит: ${sign}${formatMoney(Math.abs(monthProfit))}`;
            monthProfitEl.classList.add(monthProfit >= 0 ? 'positive' : 'negative');
        } else {
            monthProfitEl.textContent = 'Профит: 0 ₽';
            monthProfitEl.classList.add('neutral');
        }
    }
    
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

// Кэш для расчёта прибыли с переносом остатка
let calendarProfitCache = null;
let calendarProfitCacheKey = null;
let calendarCarryoverState = null; // Состояние остатков для отображения в деталях дня

// Функция сортировки по дате+времени (от старых к новым)
function sortByDateTime(a, b) {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    // Сортируем по времени (если есть)
    const timeA = a.time || '00:00';
    const timeB = b.time || '00:00';
    return timeA.localeCompare(timeB);
}

// Рассчитать прибыль для всех дней с переносом остатка покупок
// КАЛЕНДАРЬ ВСЕГДА использует приравнивание
function calculateAllDaysProfitWithCarryover() {
    // Ключ для кэша
    const cacheKey = JSON.stringify({
        sales: (data.sales || []).map(s => s.id + s.date + (s.time || '') + normalizeSalePlatform(s)),
        purchases: (data.purchases || []).map(p => p.id + p.date + (p.time || '')),
        rates: data.rates
    });
    
    if (calendarProfitCacheKey === cacheKey && calendarProfitCache) {
        const platform = getActivePlatform();
        return (calendarProfitCache && calendarProfitCache[platform]) ? calendarProfitCache[platform] : {};
    }
    
    const resultByPlatform = { funpay: {}, playerok: {}, overall: {} };
    
    // Собираем все уникальные даты и сортируем
    const allDates = [...new Set([
        ...(data.sales || []).map(s => s.date),
        ...(data.purchases || []).map(p => p.date)
    ])].sort();
    
    // Остаток покупок по типам (очередь FIFO с датой+временем)
    // { itemType: [{ id, qty, costPerUnit, date, time }] }
    const carryover = {};
    
    data.itemTypes.forEach(type => {
        carryover[type] = [];
    });
    
    // Для отображения: какие покупки использованы в какой день
    // { purchaseId: { totalUsed, byDate: { dateStr: usedQty } } }
    const usedPurchases = {};
    // Какие покупки перенесены на какой день (остаток на начало дня)
    // { dateStr: [{ id, qty, costPerUnit, originalDate }] }
    const carryoverByDate = {};
    
    allDates.forEach(dateStr => {
        const dayIncome = { funpay: 0, playerok: 0, overall: 0 };
        const dayExpense = { funpay: 0, playerok: 0, overall: 0 };
        
        // Сохраняем состояние очереди на начало дня (для отображения переносов)
        carryoverByDate[dateStr] = {};
        data.itemTypes.forEach(type => {
            // Копируем текущий остаток (переносы с предыдущих дней)
            carryoverByDate[dateStr][type] = carryover[type]
                .filter(c => c.qty > 0)
                .map(c => ({ ...c }));
        });
        
        // Обрабатываем каждый тип отдельно
        data.itemTypes.forEach(type => {
            // Добавляем покупки этого дня в очередь (FIFO), сортируем по времени
            const dayPurchases = data.purchases
                .filter(p => p.date === dateStr && p.itemType === type)
                .sort(sortByDateTime);
            
            dayPurchases.forEach(p => {
                const costPerUnit = getAmountInRub(p) / p.quantity;
                carryover[type].push({ 
                    id: p.id,
                    qty: p.quantity, 
                    costPerUnit, 
                    date: p.date,
                    time: p.time || '00:00'
                });
            });
            
            // Продажи этого дня, сортируем по времени
            const daySales = data.sales
                .filter(s => s.date === dateStr && s.itemType === type)
                .sort(sortByDateTime);
            
            daySales.forEach(sale => {
                let remainingToSell = sale.quantity;
                const salePlatform = normalizeSalePlatform(sale);
                const saleUnitNet = sale.quantity ? (getSaleAmountInRub(sale) / sale.quantity) : 0;

                while (remainingToSell > 0 && carryover[type].length > 0) {
                    const oldest = carryover[type][0];
                    const takeQty = Math.min(oldest.qty, remainingToSell);
                    const expense = takeQty * oldest.costPerUnit;
                    const income = takeQty * saleUnitNet;

                    dayIncome[salePlatform] += income;
                    dayExpense[salePlatform] += expense;
                    dayIncome.overall += income;
                    dayExpense.overall += expense;

                    oldest.qty -= takeQty;
                    remainingToSell -= takeQty;

                    // Отмечаем что эта покупка использована В ЭТОТ ДЕНЬ
                    if (!usedPurchases[oldest.id]) {
                        usedPurchases[oldest.id] = { totalUsed: 0, byDate: {} };
                    }
                    if (!usedPurchases[oldest.id].byDate[dateStr]) {
                        usedPurchases[oldest.id].byDate[dateStr] = 0;
                    }
                    usedPurchases[oldest.id].totalUsed += takeQty;
                    usedPurchases[oldest.id].byDate[dateStr] += takeQty;

                    if (oldest.qty <= 0) {
                        carryover[type].shift();
                    }
                }
            });
        });

        ['funpay', 'playerok', 'overall'].forEach(p => {
            if (dayIncome[p] !== 0 || dayExpense[p] !== 0) {
                resultByPlatform[p][dateStr] = { hasData: true, profit: dayIncome[p] - dayExpense[p] };
            }
        });
    });
    
    // Сохраняем состояние для отображения в деталях дня
    calendarCarryoverState = { usedPurchases, carryover, carryoverByDate };
    calendarProfitCache = resultByPlatform;
    calendarProfitCacheKey = cacheKey;
    const platform = getActivePlatform();
    return (calendarProfitCache && calendarProfitCache[platform]) ? calendarProfitCache[platform] : {};
}

// Календарь ВСЕГДА использует приравнивание
function calculateDayProfit(dateStr) {
    const allProfits = calculateAllDaysProfitWithCarryover();
    return allProfits[dateStr] || { hasData: false, profit: 0 };
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
    
    const daySales = getSalesForActivePlatform().filter(s => s.date === dateStr);
    const dayPurchases = data.purchases.filter(p => p.date === dateStr);
    
    // Убедимся что кэш рассчитан
    calculateAllDaysProfitWithCarryover();
    const state = calendarCarryoverState || { usedPurchases: {}, carryover: {}, carryoverByDate: {} };
    
    // Проверяем есть ли перенесённые покупки
    const carryoverForDay = state.carryoverByDate[dateStr] || {};
    let hasCarryoverItems = false;
    data.itemTypes.forEach(type => {
        const items = carryoverForDay[type] || [];
        if (items.some(item => item.qty > 0)) hasCarryoverItems = true;
    });
    
    if (daySales.length === 0 && dayPurchases.length === 0 && !hasCarryoverItems) {
        container.innerHTML = '<p style="color: var(--text-secondary);">Нет транзакций за этот день</p>';
        return;
    }
    
    // Показываем перенесённые покупки с предыдущих дней
    let hasCarryover = false;
    data.itemTypes.forEach(type => {
        const items = carryoverForDay[type] || [];
        items.forEach(item => {
            if (item.qty > 0) {
                hasCarryover = true;
                const div = document.createElement('div');
                div.className = 'transaction-item expense carryover-in';
                const originalPurchase = data.purchases.find(p => p.id === item.id);
                const itemName = originalPurchase ? originalPurchase.itemType : type;
                div.innerHTML = `
                    <span>${itemName} <span class="tx-status tx-carryover-in">← перенос с ${formatDate(item.date)}</span></span>
                    <span>${item.qty} шт.</span>
                    <span>-${formatMoney(item.qty * item.costPerUnit)}</span>
                    <span></span>
                    <span></span>
                `;
                container.appendChild(div);
            }
        });
    });
    
    if (hasCarryover) {
        const separator = document.createElement('div');
        separator.className = 'day-separator';
        separator.innerHTML = '<span>Транзакции этого дня:</span>';
        container.appendChild(separator);
    }
    
    // Объединяем и сортируем по времени (от старых к новым)
    const allTransactions = [
        ...daySales.map(s => ({ ...s, transType: 'income' })),
        ...dayPurchases.map(p => ({ ...p, transType: 'expense' }))
    ].sort((a, b) => {
        const timeA = a.time || '00:00';
        const timeB = b.time || '00:00';
        return timeA.localeCompare(timeB); // Старые сверху
    });
    
    allTransactions.forEach(tx => {
        const div = document.createElement('div');
        let statusClass = '';
        let statusLabel = '';
        
        if (tx.transType === 'expense') {
            // Проверяем использована ли эта покупка В ЭТОТ ДЕНЬ
            const usedInfo = state.usedPurchases[tx.id];
            const usedInThisDay = usedInfo?.byDate?.[dateStr] || 0;
            
            if (usedInThisDay >= tx.quantity) {
                statusClass = 'used';
                statusLabel = '<span class="tx-status tx-used">✓ использовано</span>';
            } else if (usedInThisDay > 0) {
                statusClass = 'partial';
                statusLabel = `<span class="tx-status tx-partial">частично (${usedInThisDay}/${tx.quantity})</span>`;
            } else {
                statusClass = 'carryover';
            }
        }
        
        div.className = `transaction-item ${tx.transType === 'income' ? 'sale' : 'expense'} ${statusClass}`;
        
        const timeStr = tx.time ? `<span class="tx-time">${tx.time}</span>` : '';
        const sign = tx.transType === 'income' ? '+' : '-';
        const pricePerUnit = tx.originalAmount / tx.quantity;
        
        div.innerHTML = `
            <span>${tx.itemType} ${timeStr} ${statusLabel}</span>
            <span>${tx.quantity} шт.</span>
            <span>${sign}${formatMoney(tx.transType === 'income' ? getSaleAmountInRub(tx) : getAmountInRub(tx))}</span>
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

            const platformGroup = document.getElementById('editTxPlatformGroup');
            const platformSelect = document.getElementById('editTxPlatform');
            if (platformGroup && platformSelect) {
                if (transType === 'income') {
                    platformGroup.style.display = '';
                    platformSelect.value = normalizeSalePlatform(tx);
                } else {
                    platformGroup.style.display = 'none';
                    platformSelect.value = 'funpay';
                }
            }
            
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
            document.getElementById('editTxTimeInput').value = tx.time || '';
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
            datasets: [
                {
                    label: 'Прибыль (₽)',
                    data: [],
                    borderColor: '#00d26a',
                    backgroundColor: 'rgba(0, 210, 106, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#00d26a',
                    yAxisID: 'y'
                },
                {
                    label: 'Продано (шт.)',
                    data: [],
                    borderColor: '#4aa3ff',
                    backgroundColor: 'rgba(74, 163, 255, 0.0)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.35,
                    pointRadius: 4,
                    pointBackgroundColor: '#4aa3ff',
                    borderDash: [6, 4],
                    yAxisID: 'yQty'
                }
            ]
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
                },
                yQty: {
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: '#8b8b9e',
                        callback: value => value.toFixed(0) + ' шт.'
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
    const equalize = document.getElementById('equalizeToggle').checked;
    const types = getSelectedTypes();
    
    const labels = [];
    const profits = [];
    const soldQty = [];
    const dateStrs = [];
    
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

            labels.push(d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }));
            dateStrs.push(dateStr);
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
            
            labels.push(date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }));
            dateStrs.push(dateStr);
        }
    }

    const maxDateStr = dateStrs.length > 0 ? dateStrs[dateStrs.length - 1] : null;
    const profitByDate = equalize ? calculateAllDaysProfitWithCarryoverForTypes(types, maxDateStr) : null;
    const purchaseAllocation = !equalize ? calculatePurchaseAllocationForTypes(types, maxDateStr) : null;

    dateStrs.forEach(dateStr => {
        let profit = 0;
        if (equalize) {
            profit = (profitByDate && profitByDate[dateStr]) ? profitByDate[dateStr].profit : 0;
        } else {
            const daySales = getSalesForActivePlatform().filter(s => types.includes(s.itemType) && s.date === dateStr);
            const dayPurchases = (data.purchases || []).filter(p => types.includes(p.itemType) && p.date === dateStr);
            const dayIncome = daySales.reduce((sum, s) => sum + getSaleAmountInRub(s), 0);
            const platform = getActivePlatform();
            const dayExpense = dayPurchases.reduce((sum, p) => {
                const qty = getEffectivePurchaseQtyForPlatform(p, purchaseAllocation, platform);
                const costPerUnit = getAmountInRub(p) / p.quantity;
                return sum + (qty * costPerUnit);
            }, 0);
            profit = dayIncome - dayExpense;
        }

        const qty = getSalesForActivePlatform()
            .filter(s => types.includes(s.itemType) && s.date === dateStr)
            .reduce((sum, s) => sum + s.quantity, 0);

        profits.push(profit);
        soldQty.push(qty);
    });
    
    profitChart.data.labels = labels;
    profitChart.data.datasets[0].data = profits;
    if (profitChart.data.datasets[1]) {
        profitChart.data.datasets[1].data = soldQty;
    }
    
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
    profitChart.data.datasets.forEach(ds => {
        ds.pointRadius = showPoints ? 4 : 0;
    });
    profitChart.update();
}

// ==================== ДЕТАЛИЗАЦИЯ ====================

// Глобальная переменная для режима отображения валюты в детализации
let detailsShowCNY = false;

function showDetails(type, filterItemType = null) {
    const modal = document.getElementById('detailsModal');
    const title = document.getElementById('detailsTitle');
    const summary = document.getElementById('detailsSummary');
    const list = document.getElementById('detailsList');
    
    let transactions = [];
    let titleText = '';

    const activePlatform = getActivePlatform();
    const applyPlatformToPurchases = (purchasesArr) => {
        if (activePlatform === 'overall') return purchasesArr;

        const maxDateStr = null;
        const types = filterItemType ? [filterItemType] : getAllKnownItemTypesUpTo(maxDateStr);
        const allocation = calculatePurchaseAllocationForTypes(types, maxDateStr);

        return purchasesArr
            .map(p => {
                const qty = getEffectivePurchaseQtyForPlatform(p, allocation, activePlatform);
                if (!Number.isFinite(qty) || qty <= 0) return null;
                const ratio = p.quantity > 0 ? (qty / p.quantity) : 0;
                return {
                    ...p,
                    quantity: qty,
                    originalAmount: p.originalAmount * ratio,
                    _effectiveQty: qty
                };
            })
            .filter(Boolean);
    };
    
    if (type === 'income') {
        titleText = filterItemType ? `Продажи: ${filterItemType}` : 'Все продажи';
        transactions = filterItemType 
            ? getSalesForActivePlatform().filter(s => s.itemType === filterItemType)
            : [...getSalesForActivePlatform()];
        transactions = transactions.map(t => ({ ...t, transType: 'income' }));
    } else if (type === 'expense') {
        titleText = filterItemType ? `Покупки: ${filterItemType}` : 'Все покупки';
        const rawPurchases = filterItemType 
            ? (data.purchases || []).filter(p => p.itemType === filterItemType)
            : [...(data.purchases || [])];
        const purchases = applyPlatformToPurchases(rawPurchases);
        transactions = purchases;
        transactions = transactions.map(t => ({ ...t, transType: 'expense' }));
    } else if (type === 'all') {
        titleText = filterItemType ? `Все операции: ${filterItemType}` : 'Все операции';
        const sales = (filterItemType 
            ? getSalesForActivePlatform().filter(s => s.itemType === filterItemType)
            : [...getSalesForActivePlatform()]).map(t => ({ ...t, transType: 'income' }));
        const rawPurchases = (filterItemType 
            ? (data.purchases || []).filter(p => p.itemType === filterItemType)
            : [...(data.purchases || [])]);
        const purchases = applyPlatformToPurchases(rawPurchases).map(t => ({ ...t, transType: 'expense' }));
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
        .reduce((sum, t) => sum + getSaleAmountInRub(t), 0);
    const totalExpense = transactions.filter(t => t.transType === 'expense')
        .reduce((sum, t) => sum + getAmountInRub(t), 0);
    const totalQty = transactions.reduce((sum, t) => sum + t.quantity, 0);
    
    // Кнопка переключения валюты (только для расходов)
    const currencyToggle = (type === 'expense' || type === 'all') 
        ? `<button id="currencyToggleBtn" class="currency-toggle-btn">${detailsShowCNY ? '¥ Юани' : '₽ Рубли'}</button>`
        : '';
    
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
        ${currencyToggle}
    `;
    
    // Обработчик кнопки переключения валюты
    const toggleBtn = document.getElementById('currencyToggleBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            detailsShowCNY = !detailsShowCNY;
            showDetails(type, filterItemType); // Перерисовываем
        });
    }
    
    // Список транзакций
    list.innerHTML = '';
    if (transactions.length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Нет данных</p>';
    } else {
        transactions.forEach(t => {
            const div = document.createElement('div');
            div.className = `detail-item ${t.transType}`;
            
            // Формируем строку даты и времени
            const timeStr = t.time ? t.time : '';
            
            // Определяем отображаемую сумму
            let displayAmount;
            let currencySymbol;
            if (t.transType === 'expense' && detailsShowCNY) {
                // Показываем в юанях
                if (t.currency === 'CNY') {
                    displayAmount = t.originalAmount;
                } else {
                    // Конвертируем из рублей в юани по курсу на дату
                    const rate = getRateForDate(t.date);
                    displayAmount = rate > 0 ? t.originalAmount / rate : t.originalAmount;
                }
                currencySymbol = '¥';
            } else {
                // Показываем в рублях
                displayAmount = t.transType === 'income' ? getSaleAmountInRub(t) : getAmountInRub(t);
                currencySymbol = '₽';
            }
            
            const sign = t.transType === 'income' ? '+' : '-';
            
            div.innerHTML = `
                <div class="detail-info">
                    <div class="detail-type">${t.itemType}</div>
                    <div class="detail-date">${formatDate(t.date)}${timeStr ? ' ' + timeStr : ''}</div>
                </div>
                <div class="detail-qty">${t.quantity} шт.</div>
                <div class="detail-amount">${sign}${displayAmount.toFixed(2)} ${currencySymbol}</div>
                <div class="detail-actions">
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

                const platformGroup = document.getElementById('editTxPlatformGroup');
                const platformSelect = document.getElementById('editTxPlatform');
                if (platformGroup && platformSelect) {
                    if (transType === 'income') {
                        platformGroup.style.display = '';
                        platformSelect.value = normalizeSalePlatform(tx);
                    } else {
                        platformGroup.style.display = 'none';
                        platformSelect.value = 'funpay';
                    }
                }
                
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
                document.getElementById('editTxTimeInput').value = tx.time || '';
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
