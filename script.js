// Configurare pentru conectarea la Google Sheets
const PUBLISHED_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQnbQPo-Mr3dghu2nMDTAPmI_gecKNthE8YrD-Gss9LcIc6D4rCGVp_ZQI5PfoA-ELmYyCTADZFzrKL/pub?output=csv';

// Variabile globale pentru a stoca datele și perioada curentă
let allData = null;
let currentPeriod = 'all';
let customStartDate = null;
let customEndDate = null;

// Variabile pentru paginare
let currentPage = 1;
let itemsPerPage = 15;
let filteredData = [];

// Funcție utilitară pentru parsarea sigură a numerelor
function safeParseFloat(value) {
    if (typeof value === 'string') {
        // Înlocuim virgula cu punct pentru parseFloat
        value = value.replace(',', '.');
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
}

// Funcție pentru actualizarea datei și orei curente
function updateCurrentDateTime() {
    const now = new Date();
    
    // Formatare dată în stil românesc
    const dateStr = formatDateRO(now);
    
    // Formatare oră
    const timeStr = now.toLocaleTimeString('ro-RO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    // Actualizare elemente HTML
    document.getElementById('current-date').textContent = dateStr;
    document.getElementById('current-time').textContent = timeStr;
}

// Funcție pentru a elimina posibile elemente de grafic care ar putea fi în cache
function cleanupOldChartElements() {
    // Verificăm dacă există elemente de grafic din versiunea anterioară
    const oldCharts = document.querySelectorAll('.charts, .chart-container, .chart-row, canvas');
    if (oldCharts.length > 0) {
        console.log('Eliminăm elemente de grafic rămase în cache:', oldCharts.length);
        oldCharts.forEach(el => {
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
    }
    
    // Verificăm și script-uri externe pentru Chart.js
    const oldScripts = document.querySelectorAll('script[src*="chart.js"]');
    if (oldScripts.length > 0) {
        console.log('Eliminăm script-uri Chart.js rămase în cache:', oldScripts.length);
        oldScripts.forEach(el => {
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
    }
}

// Funcția pentru a prelua datele din Google Sheets (format CSV)
async function fetchSheetData() {
    try {
        const response = await fetch(PUBLISHED_URL);
        const text = await response.text();
        
        // Debug - afișăm răspunsul brut
        console.log('Răspuns CSV brut:', text.substring(0, 500) + '...');
        
        // Parsare CSV
        const rows = text.split('\n').map(row => {
            // Gestionare corectă a virgulelor din CSV
            const values = [];
            let inQuotes = false;
            let currentValue = '';
            
            for (let i = 0; i < row.length; i++) {
                const char = row[i];
                
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(currentValue.trim());
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            }
            
            // Adăugare ultimă valoare
            values.push(currentValue.trim());
            return values;
        });
        
        // Prima linie conține anteturile
        const headers = rows[0];
        // Restul sunt date
        const dataRows = rows.slice(1);
        
        // Debug - afișăm primul și ultimul rând
        if (dataRows.length > 0) {
            console.log('Anteturi:', headers);
            console.log('Primul rând:', dataRows[0]);
            console.log('Ultimul rând:', dataRows[dataRows.length - 1]);
        }
        
        // Procesare date pentru a adăuga obiecte Date JavaScript
        const processedRows = dataRows.map(row => {
            const processedRow = [...row];  // copiem rândul
            try {
                // Convertim string-ul de dată în obiect Date
                processedRow.dateObj = new Date(row[0]);
            } catch (e) {
                // Dacă nu putem converti, folosim data curentă
                processedRow.dateObj = new Date();
                console.error('Eroare la conversie dată:', e, row[0]);
            }
            return processedRow;
        });
        
        // Sortăm datele după dată (cele mai vechi primele)
        processedRows.sort((a, b) => a.dateObj - b.dateObj);
        
        return { headers, rows: processedRows };
    } catch (error) {
        console.error('Eroare la preluarea datelor:', error);
        document.getElementById('table-body').innerHTML = 
            `<tr><td colspan="7" class="loading-message">Eroare la încărcarea datelor: ${error.message}</td></tr>`;
        return null;
    }
}

// Verifică dacă două date sunt în aceeași zi
function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

// Filtrare date în funcție de perioada selectată
function filterDataByPeriod(data, period) {
    if (!data || period === 'all') {
        return data.rows;
    }
    
    const now = new Date();
    let cutoffDate;
    
    switch(period) {
        case 'today':
            // Doar măsurătorile de azi
            return data.rows.filter(row => row.dateObj && isSameDay(row.dateObj, now));
            
        case 'week':
            // 7 zile în urmă
            cutoffDate = new Date(now);
            cutoffDate.setDate(now.getDate() - 7);
            break;
            
        case 'month':
            // 30 zile în urmă
            cutoffDate = new Date(now);
            cutoffDate.setDate(now.getDate() - 30);
            break;
            
        case 'year':
            // Începutul anului curent
            cutoffDate = new Date(now.getFullYear(), 0, 1);
            break;
            
        case 'custom':
            // Interval personalizat
            if (customStartDate && customEndDate) {
                const startDate = new Date(customStartDate);
                // Setăm ora end date la 23:59:59 pentru a include întreaga zi
                const endDate = new Date(customEndDate);
                endDate.setHours(23, 59, 59, 999);
                
                return data.rows.filter(row => {
                    return row.dateObj && row.dateObj >= startDate && row.dateObj <= endDate;
                });
            } else {
                // Dacă nu avem intervale definite, returnăm toate datele
                return data.rows;
            }
            
        default:
            return data.rows;
    }
    
    return data.rows.filter(row => row.dateObj && row.dateObj >= cutoffDate);
}

// Calculează statistici pentru perioada selectată
function calculatePeriodStats(filteredData) {
    if (!filteredData || filteredData.length === 0) {
        return {
            totalHarvest: 0,
            avgTemperature: 0,
            count: 0
        };
    }
    
    // Calculăm recolta totală adunând doar diferențele pozitive (recolta zilnică)
    let totalHarvest = 0;
    let totalTemp = 0;
    
    filteredData.forEach(row => {
        const dailyHarvest = safeParseFloat(row[3]);
        
        if (dailyHarvest > 0) {
            totalHarvest += dailyHarvest;
        }
        
        totalTemp += safeParseFloat(row[2]);
    });
    
    return {
        totalHarvest: totalHarvest.toFixed(2),
        avgTemperature: (totalTemp / filteredData.length).toFixed(1),
        count: filteredData.length
    };
}

// Formatează numele perioadei pentru afișare
function getPeriodName(period) {
    const periodNames = {
        'all': 'toate datele',
        'today': 'astăzi',
        'week': 'ultima săptămână',
        'month': 'ultima lună',
        'year': 'anul curent',
        'custom': 'intervalul personalizat'
    };
    
    return periodNames[period] || 'perioada selectată';
}

// Formatează data pentru afișare în formatul românesc
function formatDateRO(date) {
    if (!date) return '';
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}.${month}.${year}`;
}

// Calculează numărul total de pagini
function getTotalPages() {
    return Math.ceil(filteredData.length / itemsPerPage);
}

// Actualizează controalele de paginare
function updatePaginationControls() {
    const totalPages = getTotalPages();
    
    document.getElementById('pagination-text').textContent = `Pagina ${currentPage} din ${totalPages}`;
    
    // Activăm/dezactivăm butoanele de navigare
    document.getElementById('first-page').disabled = currentPage === 1;
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage === totalPages;
    document.getElementById('last-page').disabled = currentPage === totalPages;
}

// Funcția pentru a actualiza tabelul HTML
function updateTable(data, period = 'all') {
    if (!data) return;
    
    // Resetăm pagina curentă la 1 când se schimbă filtrul
    currentPage = 1;
    
    // Filtrare date în funcție de perioada selectată
    filteredData = filterDataByPeriod(data, period);
    
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    
    if (filteredData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="loading-message">Nu există date pentru perioada selectată</td></tr>';
        
        // Actualizăm controalele de paginare
        document.getElementById('pagination-text').textContent = 'Pagina 0 din 0';
        document.getElementById('first-page').disabled = true;
        document.getElementById('prev-page').disabled = true;
        document.getElementById('next-page').disabled = true;
        document.getElementById('last-page').disabled = true;
        
        return;
    }
    
    // Adăugăm rândurile în ordine inversă (cele mai recente primele)
    const reversedRows = [...filteredData].reverse();
    
    // Calculăm indexul de start și stop pentru pagina curentă
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, reversedRows.length);
    
    // Obținem datele pentru pagina curentă
    const rowsToShow = reversedRows.slice(startIndex, endIndex);
    
    rowsToShow.forEach(row => {
        const tr = document.createElement('tr');
        
        // Formatarea datei
        const dateCell = document.createElement('td');
        let dateValue = row[0];
        try {
            // Folosim obiectul Date creat anterior
            if (row.dateObj && !isNaN(row.dateObj)) {
                dateValue = formatDateRO(row.dateObj) + 
                    ' ' + row.dateObj.toLocaleTimeString('ro-RO', {hour: '2-digit', minute: '2-digit'});
            }
        } catch (e) {
            // Dacă nu se poate formata, folosim valoarea originală
        }
        dateCell.textContent = dateValue;
        tr.appendChild(dateCell);
        
        // Greutate
        const weightCell = document.createElement('td');
        weightCell.textContent = safeParseFloat(row[1]).toFixed(2) + ' kg';
        tr.appendChild(weightCell);
        
        // Temperatură
        const tempCell = document.createElement('td');
        tempCell.textContent = safeParseFloat(row[2]).toFixed(1) + ' °C';
        tr.appendChild(tempCell);
        
        // Recolta zilnică (diferență cu culoare)
        const diffCell = document.createElement('td');
        const diff = safeParseFloat(row[3]);
        diffCell.textContent = diff.toFixed(2) + ' kg';
        diffCell.className = diff >= 0 ? 'positive' : 'negative';
        tr.appendChild(diffCell);
        
        // Recolta totală
        const harvestCell = document.createElement('td');
        harvestCell.textContent = safeParseFloat(row[4]).toFixed(2) + ' kg';
        tr.appendChild(harvestCell);
        
        // Baterie
        const batteryCell = document.createElement('td');
        batteryCell.textContent = safeParseFloat(row[5]).toFixed(1) + ' V';
        tr.appendChild(batteryCell);
        
        // Ploaie
        const rainCell = document.createElement('td');
        rainCell.textContent = row[6];
        if (row[6] === 'Da') {
            rainCell.style.color = 'blue';
        }
        tr.appendChild(rainCell);
        
        tableBody.appendChild(tr);
    });
    
    // Actualizare statistici pentru perioada selectată
    const stats = calculatePeriodStats(filteredData);
    const periodName = getPeriodName(period);
    
    document.getElementById('period-harvest').textContent = stats.totalHarvest + ' kg';
    document.getElementById('period-temp').textContent = stats.avgTemperature + ' °C';
    document.getElementById('period-count').textContent = stats.count + ' măsurători';
    
    // Actualizăm controalele de paginare
    updatePaginationControls();
}

// Funcțiile de navigare între pagini
function goToFirstPage() {
    currentPage = 1;
    updateTable(allData, currentPeriod);
}

function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        updateTable(allData, currentPeriod);
    }
}

function goToNextPage() {
    if (currentPage < getTotalPages()) {
        currentPage++;
        updateTable(allData, currentPeriod);
    }
}

function goToLastPage() {
    currentPage = getTotalPages();
    updateTable(allData, currentPeriod);
}

// Funcția pentru a schimba numărul de elemente pe pagină
function changeItemsPerPage() {
    const select = document.getElementById('items-per-page');
    itemsPerPage = parseInt(select.value);
    
    // Recalculăm pagina curentă pentru a menține aceeași poziție aproximativă
    const totalItems = filteredData.length;
    const firstItemIndex = (currentPage - 1) * itemsPerPage;
    
    // Recalculăm pagina pentru a menține primul element vizibil
    currentPage = Math.floor(firstItemIndex / itemsPerPage) + 1;
    
    // Ne asigurăm că pagina curentă este validă
    if (currentPage < 1) {
        currentPage = 1;
    }
    
    const totalPages = getTotalPages();
    if (currentPage > totalPages) {
        currentPage = totalPages > 0 ? totalPages : 1;
    }
    
    updateTable(allData, currentPeriod);
}

// Funcția pentru a actualiza statisticile din dashboard
function updateStats(data) {
    if (!data || data.rows.length === 0) return;
    
    // Ultima înregistrare (cea mai recentă)
    const lastRow = data.rows[data.rows.length - 1];
    
    // Formatează data
    let lastDate = lastRow[0];
    try {
        // Folosim obiectul Date creat anterior
        if (lastRow.dateObj && !isNaN(lastRow.dateObj)) {
            lastDate = formatDateRO(lastRow.dateObj) + 
                ' ' + lastRow.dateObj.toLocaleTimeString('ro-RO', {hour: '2-digit', minute: '2-digit'});
        }
    } catch (e) {
        // Folosim valoarea originală dacă nu se poate formata
    }
    document.getElementById('last-update').textContent = lastDate;
    
    // Greutate curentă
    document.getElementById('current-weight').textContent = safeParseFloat(lastRow[1]).toFixed(2) + ' kg';
    
    // Temperatură curentă
    document.getElementById('current-temp').textContent = safeParseFloat(lastRow[2]).toFixed(1) + ' °C';
    
    // Recolta zilnică (diferența)
    // Debug pentru verificarea valorii din sheet
    console.log('Valoare recoltă zilnică din sheet:', lastRow[3]);
    
    const dailyHarvest = safeParseFloat(lastRow[3]);
    console.log('Valoare recoltă zilnică după parsare:', dailyHarvest);
    
    const dailyHarvestElement = document.getElementById('daily-harvest');
    dailyHarvestElement.textContent = dailyHarvest.toFixed(2) + ' kg';
    // Adăugăm culoare în funcție de valoare
    dailyHarvestElement.className = dailyHarvest >= 0 ? 'positive' : 'negative';
    
    // Total recoltă
    document.getElementById('total-harvest').textContent = safeParseFloat(lastRow[4]).toFixed(2) + ' kg';
    
    // Baterie
    document.getElementById('battery-level').textContent = safeParseFloat(lastRow[5]).toFixed(1) + ' V';
    
    // Ploaie
    document.getElementById('rain-status').textContent = lastRow[6];
}

// Funcția pentru a schimba perioada
function changePeriod() {
    const periodSelect = document.getElementById('period-select');
    currentPeriod = periodSelect.value;
    
    // Afișăm sau ascundem intervalul de date personalizate
    const customDateRangeDiv = document.getElementById('custom-date-range');
    if (currentPeriod === 'custom') {
        customDateRangeDiv.classList.add('visible');
        
        // Dacă nu sunt setate date, inițializăm cu valori implicite
        if (!customStartDate || !customEndDate) {
            const today = new Date();
            const lastMonth = new Date();
            lastMonth.setMonth(today.getMonth() - 1);
            
            document.getElementById('start-date').value = lastMonth.toISOString().split('T')[0];
            document.getElementById('end-date').value = today.toISOString().split('T')[0];
            
            customStartDate = lastMonth.toISOString().split('T')[0];
            customEndDate = today.toISOString().split('T')[0];
        }
    } else {
        customDateRangeDiv.classList.remove('visible');
    }
    
    if (allData) {
        updateTable(allData, currentPeriod);
    }
}

// Funcția pentru a aplica intervalul de date personalizat
function applyCustomDateRange() {
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    
    customStartDate = startDateInput.value;
    customEndDate = endDateInput.value;
    
    if (customStartDate && customEndDate && allData) {
        updateTable(allData, 'custom');
    }
}

// Funcția pentru a inițializa controalele
function initControls() {
    // Setăm data de astăzi ca valoare maximă pentru selectoarele de dată
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('start-date').max = today;
    document.getElementById('end-date').max = today;
    
    // Inițializăm evenimentul de schimbare a perioadei
    changePeriod();
    
    // Setăm valoarea implicită pentru numărul de elemente pe pagină
    document.getElementById('items-per-page').value = itemsPerPage.toString();
    
    // Inițializăm și începem actualizarea datei și orei
    updateCurrentDateTime();
    setInterval(updateCurrentDateTime, 1000);
}

// Inițializarea paginii
async function initPage() {
    // Setăm anul curent în footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Curățăm elementele vechi care ar putea fi în cache
    cleanupOldChartElements();
    
    // Inițializăm controalele
    initControls();
    
    // Preluăm și afișăm datele
    allData = await fetchSheetData();
    if (allData) {
        updateTable(allData, currentPeriod);
        updateStats(allData);
    }
}

// Actualizăm pagina periodic
window.onload = function() {
    initPage();
    
    // Actualizare la fiecare 15 minute
    setInterval(initPage, 15 * 60 * 1000);
}; 