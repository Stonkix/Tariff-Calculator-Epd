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
            title: 'Удалённая настройка рабочего места для работы с электронной подписью',
            items: [
                { id: 'sw1', label: 'Для Windows (nalog.ru или ЕСИА)', col: 'setup_win_1' },
                { id: 'sw2', label: 'Для Windows (nalog.ru и ЕСИА)', col: 'setup_win_2' },
                { id: 'sm1', label: 'Для MacOS (nalog.ru или ЕСИА)', col: 'setup_mac_1' },
                { id: 'sm2', label: 'Для MacOS (nalog.ru и ЕСИА)', col: 'setup_mac_2' }
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
                { id: 't1', label: 'Обучение пользователей 1 группа', col: 'training' }
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
    const detailsContent = document.getElementById('details-content');

    if (!mainContainer || !STATE.pricing[0]) return;

    let total = 0;
    let detailLines = []; 
    const count = STATE.docsYearly;

    if (count <= 0) {
        mainContainer.innerHTML = `<div class="placeholder-text">Введите количество документов</div>`;
        if (addonsContainer) addonsContainer.innerHTML = '';
        totalDisplay.textContent = '0 ₽';
        if (detailsContent) detailsContent.innerHTML = "Введите количество документов для формирования отчета";
        return;
    }

    const dataRow = STATE.pricing[0];
    const unitRow = STATE.pricing[1];

    // Определяем подходящий лимит пакета
    let idx = CONFIG.limits.findIndex(l => l >= count);
    const finalIdx = idx === -1 ? CONFIG.limits.length - 1 : idx;
    const key = CONFIG.tariffKeys[finalIdx];
    const limitValue = CONFIG.limits[finalIdx];

    // 1. БАЗОВЫЙ ТАРИФ
    const standardBasePrice = parseNum(dataRow[key]);
    const standardUnitPrice = parseNum(unitRow[key]);
    
    // В индивидуальном режиме используем кастомную цену за документ (или стандартную из JSON, если не ввели)
    let currentUnitPrice = STATE.customPrices['unit'] !== undefined ? STATE.customPrices['unit'] : standardUnitPrice;
    
    // РАСЧЕТ БАЗОВОЙ ЦЕНЫ:
    // Стандарт: цена из JSON. 
    // Индив: Полный лимит пакета * цена за док.
    let basePrice = (STATE.subMode === 'standard') 
        ? standardBasePrice 
        : (limitValue * currentUnitPrice);
    
    total += basePrice;

    // Формируем строку для детализации тарифа
    const tariffName = key.replace(/\n/g, ' ');
    if (STATE.subMode === 'standard') {
        detailLines.push(`${tariffName} (Стандарт) | ${Math.round(basePrice).toLocaleString()} ₽`);
    } else {
        detailLines.push(`${tariffName} (Индив.) | ${limitValue} док. x ${currentUnitPrice} ₽ | ${Math.round(basePrice).toLocaleString()} ₽`);
    }

    // 2. ПРОЕКТНОЕ РЕШЕНИЕ
    let projPrice = 0;
    if (STATE.mainMode === 'project') {
        projPrice = STATE.customPrices['project'] !== undefined 
            ? STATE.customPrices['project'] 
            : parseNum(dataRow["1С-ЭПД Проектное решение"]);
        total += projPrice;
        detailLines.push(`Проектное решение | ${Math.round(projPrice).toLocaleString()} ₽`);
    }

    // 3. ДОПЫ
    CONFIG.globalAddons.forEach(addon => {
        const state = STATE.addons[addon.id];
        if (state.enabled) {
            addon.items.forEach(item => {
                const qty = parseInt(state.values[item.id]) || 0;
                if (qty > 0) {
                    const jsonKey = CONFIG.columns[item.col]; 
                    const price = STATE.customPrices[item.col] !== undefined 
                        ? STATE.customPrices[item.col] 
                        : parseNum(dataRow[jsonKey]);
                    
                    const lineTotal = price * qty;
                    total += lineTotal;
                    detailLines.push(`${item.label} | ${price.toLocaleString()} ₽ x ${qty} | ${lineTotal.toLocaleString()} ₽`);
                }
            });
        }
    });

    renderMainCard(mainContainer, key, limitValue, basePrice, currentUnitPrice, projPrice);
    renderAddons(addonsContainer);
    
    totalDisplay.textContent = Math.round(total).toLocaleString('ru-RU') + ' ₽';
    if (detailsContent) {
        detailsContent.innerHTML = detailLines.join('<br>');
    }
}

function renderMainCard(container, key, limit, basePrice, unitPrice, projPrice) {
    const isIndividual = STATE.subMode === 'individual';
    
    // Чтобы курсор не прыгал, мы проверяем: если этот инпут уже существует в DOM и он в фокусе, 
    // мы не должны перерисовывать всю карточку через innerHTML.
    // Но для простоты реализации в данном коде, самый надежный способ — использовать тип text и onchange.
    
    container.innerHTML = `
        <div class="tariff-card animated-fade ${isIndividual ? 'individual-mode' : ''}">
            <div class="tariff-header">
                <span class="tariff-label">${!isIndividual ? 'Стандарт' : 'Индивидуально'}</span>
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
                        ${isIndividual 
                            ? `<input type="text" 
                                      class="inline-edit" 
                                      value="${unitPrice.toString().replace('.', ',')}" 
                                      onchange="window.updateCustomPrice('unit', this.value)"
                                      placeholder="0,00">`
                            : `<strong>${unitPrice.toString().replace('.', ',')}</strong>`
                        }
                         <span class="unit-text">₽</span>
                    </div>
                </div>
                ${STATE.mainMode === 'project' ? `
                <div class="detail-row project-row">
                    <span>Проектное решение</span>
                    <div class="price-edit-block">
                        ${isIndividual 
                            ? `<input type="text" 
                                      class="inline-edit" 
                                      value="${projPrice.toString().replace('.', ',')}" 
                                      onchange="window.updateCustomPrice('project', this.value)">`
                            : `<strong>${projPrice.toLocaleString()}</strong>`
                        }
                        <span class="unit-text">₽</span>
                    </div>
                </div>` : ''}
            </div>
        </div>`;
}

function renderAddons(container) {
    if (!container || !STATE.pricing[0]) return;
    const dataRow = STATE.pricing[0];
    const isIndividual = STATE.subMode === 'individual';

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
                
                ${isIndividual ? `
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
                </details>` : ''}
            </div>
        </div>`;
    }).join('');
}

window.toggleAddon = (id) => { STATE.addons[id].enabled = !STATE.addons[id].enabled; calculate(); };
window.updateAddonValue = (aId, iId, val) => { STATE.addons[aId].values[iId] = parseInt(val) || 0; calculate(); };
window.updateCustomPrice = (col, val) => { 
    if (val === '') {
        STATE.customPrices[col] = undefined;
    } else {
        // Заменяем запятую на точку для корректного parseFloat
        const normalizedVal = val.replace(',', '.');
        const num = parseFloat(normalizedVal);
        
        if (!isNaN(num)) {
            STATE.customPrices[col] = num;
        }
    }
    // Вызываем расчет
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