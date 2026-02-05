const CONFIG = {
    columns: {
        annual: "Стоимость пакета на 12 месяцев",
        unit: "Стоимость одного документа",
        project: "1С-ЭПД Проектное решение",
        setup_win_1: "OC Windows\nnalog.ru или ЕСИА",
        setup_win_2: "OC Windows\nnalog.ru и ЕСИА",
        setup_mac_1: "OC MacOS nalog.ru или ЕСИА",
        setup_mac_2: "OC MacOS nalog.ru и ЕСИА",
        mchd_start: "Старт работы с МЧД в сервисе 1С-ЭДО",
        mchd_issue: "Выпуск МЧД и добавление в ЭДО",
        install_base: "Типовая Установка пр",
        training: "Обучение пользователей по работе с Пр"
    },
    globalAddons: [
        {
            id: 'setup',
            title: 'Настройка рабочего места',
            items: [
                { id: 'sw1', label: 'Win (nalog.ru или ЕСИА)', col: 'setup_win_1' },
                { id: 'sw2', label: 'Win (nalog.ru и ЕСИА)', col: 'setup_win_2' },
                { id: 'sm1', label: 'Mac (nalog.ru или ЕСИА)', col: 'setup_mac_1' },
                { id: 'sm2', label: 'Mac (nalog.ru и ЕСИА)', col: 'setup_mac_2' }
            ]
        },
        {
            id: 'mchd',
            title: 'Работа с МЧД',
            items: [
                { id: 'm1', label: 'Старт работы с МЧД', col: 'mchd_start' },
                { id: 'm2', label: 'Выпуск и добавление МЧД', col: 'mchd_issue' }
            ]
        },
        {
            id: 'service',
            title: 'Внедрение и обучение',
            items: [
                { id: 'i1', label: 'Типовая установка', col: 'install_base' },
                { id: 't1', label: 'Обучение пользователей', col: 'training' }
            ]
        }
    ],
    tariffKeys: [
        "1С-ЭПД 600 документов", 
        "1С-ЭПД 1 000 документов", 
        "1С-ЭПД 5 000 документов", 
        "1С-ЭПД \n10 000 документов", 
        "1С-ЭПД \n50 000 документов\n", 
        "1С-ЭПД \n100 000 документов\n"
    ],
    limits: [600, 1000, 5000, 10000, 50000, 100000]
};

const STATE = {
    mainMode: 'typical',
    subMode: 'standard',
    docsYearly: 0,
    customPrices: {}, 
    addons: {},       
    pricing: []       
};

// Хелпер для превращения "3 600" в 3600
const parseNum = (val) => {
    if (!val) return 0;
    return parseFloat(val.toString().replace(/\s/g, '').replace(',', '.')) || 0;
};

CONFIG.globalAddons.forEach(addon => {
    STATE.addons[addon.id] = { enabled: false, values: {} };
});

document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    try {
        const res = await fetch('Цены для калькулятора ЭПД.json');
        const text = await res.text();
        // Исправляем возможные ошибки в JSON
        try {
            STATE.pricing = JSON.parse(text);
        } catch(e) {
            STATE.pricing = JSON.parse("[" + text.replace(/}\s*{/g, "},{") + "]");
        }
        calculate(); 
    } catch (e) { console.error("Ошибка загрузки цен"); }
});

function calculate() {
    const mainContainer = document.getElementById('dynamic-content');
    const addonsContainer = document.getElementById('addons-container');
    const totalDisplay = document.getElementById('total-price');

    if (!mainContainer || !STATE.pricing[0]) return;

    let total = 0;
    const count = STATE.docsYearly;

    if (count <= 0) {
        mainContainer.innerHTML = `<div class="placeholder-text">Введите количество документов</div>`;
        if (addonsContainer) addonsContainer.innerHTML = '';
        totalDisplay.textContent = '0 ₽';
        return;
    }

    // Данные из JSON (первый объект, где лежат все цены)
    const dataRow = STATE.pricing[0];
    const unitRow = STATE.pricing[1]; // второй объект для цены за 1 док

    let idx = CONFIG.limits.findIndex(l => l >= count);
    const finalIdx = idx === -1 ? CONFIG.limits.length - 1 : idx;
    const key = CONFIG.tariffKeys[finalIdx];
    const limitValue = CONFIG.limits[finalIdx];

    // 1. БАЗОВЫЙ ТАРИФ
    const standardBasePrice = parseNum(dataRow[key]);
    const standardUnitPrice = parseNum(unitRow[key]);
    
    let currentUnitPrice = STATE.customPrices['unit'] !== undefined ? STATE.customPrices['unit'] : standardUnitPrice;
    let basePrice = (STATE.subMode === 'standard') ? standardBasePrice : (count * currentUnitPrice);
    total += basePrice;

    // 2. ПРОЕКТНОЕ РЕШЕНИЕ (ключ: "1С-ЭПД Проектное решение")
    let projPrice = 0;
    if (STATE.mainMode === 'project') {
        projPrice = STATE.customPrices['project'] !== undefined 
            ? STATE.customPrices['project'] 
            : parseNum(dataRow["1С-ЭПД Проектное решение"]);
        total += projPrice;
    }

    // 3. ДОПЫ
    CONFIG.globalAddons.forEach(addon => {
        const state = STATE.addons[addon.id];
        if (state.enabled) {
            addon.items.forEach(item => {
                const qty = parseInt(state.values[item.id]) || 0;
                if (qty > 0) {
                    // Ищем цену напрямую по ключу из JSON
                    const jsonKey = CONFIG.columns[item.col]; 
                    const price = STATE.customPrices[item.col] !== undefined 
                        ? STATE.customPrices[item.col] 
                        : parseNum(dataRow[jsonKey]);
                    
                    total += price * qty;
                }
            });
        }
    });

    renderMainCard(mainContainer, key, limitValue, basePrice, currentUnitPrice, projPrice);
    renderAddons(addonsContainer);
    totalDisplay.textContent = Math.round(total).toLocaleString('ru-RU') + ' ₽';
}

function renderMainCard(container, key, limit, basePrice, unitPrice, projPrice) {
    container.innerHTML = `
        <div class="tariff-card animated-fade ${STATE.subMode === 'individual' ? 'individual-mode' : ''}">
            <div class="tariff-header">
                <span class="tariff-label">${STATE.subMode === 'standard' ? 'Стандарт' : 'Индивидуально'}</span>
                <h3 class="tariff-title">${key.replace(/\n/g, ' ')}</h3>
            </div>
            <div class="detailing-section">
                <div class="detail-row">
                    <span>Пакет документов (${limit} шт.)</span>
                    <strong>${Math.round(basePrice).toLocaleString('ru-RU')} ₽</strong>
                </div>
                <div class="detail-row highlight">
                    <span>Цена за 1 документ</span>
                    <div class="price-edit-block">
                         <input type="number" class="inline-edit" value="${unitPrice}" step="0.1" oninput="window.updateCustomPrice('unit', this.value)">
                         <span class="unit-text">₽</span>
                    </div>
                </div>
                ${STATE.mainMode === 'project' ? `
                <div class="detail-row project-row">
                    <span>Проектное решение</span>
                    <div class="price-edit-block">
                        <input type="number" class="inline-edit" value="${projPrice}" oninput="window.updateCustomPrice('project', this.value)">
                        <span class="unit-text">₽</span>
                    </div>
                </div>` : ''}
            </div>
        </div>`;
}

function renderAddons(container) {
    if (!container || !STATE.pricing[0]) return;
    const dataRow = STATE.pricing[0];

    container.innerHTML = `<h3 class="section-title">Дополнительные услуги</h3>` + CONFIG.globalAddons.map(addon => {
        const state = STATE.addons[addon.id];
        return `
        <div class="addon-card ${state.enabled ? 'active' : ''}">
            <div class="addon-header">
                <span class="addon-title">${addon.title}</span>
                <label class="custom-switch">
                    <input type="checkbox" ${state.enabled ? 'checked' : ''} onchange="window.toggleAddon('${addon.id}')">
                    <span class="slider round"></span>
                </label>
            </div>
            <div class="addon-variants" style="${state.enabled ? 'display:block' : 'display:none'}">
                ${addon.items.map(item => `
                    <div class="variant-row">
                        <span class="v-label">${item.label}</span>
                        <div class="v-controls">
                            <input type="number" class="qty-input" min="0" placeholder="0" value="${state.values[item.id] || ''}" oninput="window.updateAddonValue('${addon.id}', '${item.id}', this.value)">
                            <span class="unit-text">шт.</span>
                        </div>
                    </div>`).join('')}
                <details class="custom-price-details">
                    <summary>Настроить цены за ед.</summary>
                    <div class="custom-price-content">
                        ${addon.items.map(item => {
                            const jsonKey = CONFIG.columns[item.col];
                            const defaultPrice = parseNum(dataRow[jsonKey]);
                            return `
                            <div class="variant-row price-row">
                                <span>${item.label}</span>
                                <input type="number" class="price-input" value="${STATE.customPrices[item.col] !== undefined ? STATE.customPrices[item.col] : defaultPrice}" oninput="window.updateCustomPrice('${item.col}', this.value)">
                            </div>`;
                        }).join('')}
                    </div>
                </details>
            </div>
        </div>`;
    }).join('');
}
window.toggleAddon = (id) => { STATE.addons[id].enabled = !STATE.addons[id].enabled; calculate(); };
window.updateAddonValue = (aId, iId, val) => { STATE.addons[aId].values[iId] = parseInt(val) || 0; calculate(); };
window.updateCustomPrice = (col, val) => { 
    if (val === '') STATE.customPrices[col] = undefined;
    else STATE.customPrices[col] = parseFloat(val); 
    calculate(); 
};

window.updateDocs = (type, val) => {
    const v = parseInt(val) || 0;
    if(type === 'month') { 
        STATE.docsYearly = v * 12; 
        document.getElementById('docs-year').value = STATE.docsYearly; 
    } else { 
        STATE.docsYearly = v; 
        document.getElementById('docs-month').value = Math.round(v/12); 
    }
    calculate();
};

function setupEventListeners() {
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.onclick = (e) => {
            const group = e.target.closest('.toggle-group');
            group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            if (group.id === 'main-mode-toggle') STATE.mainMode = e.target.dataset.mode;
            if (group.id === 'sub-mode-toggle') STATE.subMode = e.target.dataset.sub;
            calculate();
        };
    });
}