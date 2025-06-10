// URL-uri pentru fiecare foaie publicată (redenumite ca stupi pentru interfață)
const SHEET_URLS = {
    'foaie1': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQnbQPo-Mr3dghu2nMDTAPmI_gecKNthE8YrD-Gss9LcIc6D4rCGVp_ZQI5PfoA-ELmYyCTADZFzrKL/pub?output=csv',
    'foaie2': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRE4-_BmtoGvaWD5I_lI0GG-OavL6mTa18wn_ON87Tvw-B1FoGWhBGI1Q-JHjU5pCVIEiYu09ii6bNB/pub?output=csv',
    'foaie3': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTikN6b-AGCvrkBB8PM3TG4bc4_lBbe6BeP4NbJqK7lw2apxORR3x77QJlRAIIj6edAARg8PRWqvjRq/pub?output=csv'
};

// URL-ul implicit (prima foaie)
const DEFAULT_SHEET_URL = SHEET_URLS['foaie1'];

// Variabile globale pentru a stoca datele și perioada curentă
let allData = null;
let currentPeriod = 'today';
let customStartDate = null;
let customEndDate = null;

// Variabile pentru gestionarea foilor (afișate ca stupi în interfață)
let currentSheet = 'all'; // Foaia curentă selectată (sau 'all' pentru toți stupii)
let sheetsData = {}; // Stocăm datele pentru fiecare foaie
let combinedData = null; // Stocăm datele combinate de la toți stupii

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
async function fetchSheetData(sheetName = currentSheet) {
    try {
        if (!SHEET_URLS[sheetName]) {
            console.error(`Foaia "${sheetName}" nu există.`);
            return null;
        }
        
        const response = await fetch(SHEET_URLS[sheetName]);
        const text = await response.text();
        
        // Debug - afișăm răspunsul brut
        console.log(`Răspuns CSV brut pentru foaia ${sheetName}:`, text.substring(0, 500) + '...');
        
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
            console.log(`Anteturi pentru foaia ${sheetName}:`, headers);
            console.log(`Primul rând pentru foaia ${sheetName}:`, dataRows[0]);
            console.log(`Ultimul rând pentru foaia ${sheetName}:`, dataRows[dataRows.length - 1]);
        }
        
        // Verifică dacă există coloana pentru ID-ul stupului
        // Presupunem că este ultima coloană (după Ploaie)
        const hiveIdColumnIndex = 7; // Coloana 8 (index 7) - după data, greutate, temp, recoltă zilnică, recoltă totală, baterie, ploaie
        const hasHiveIdColumn = headers.length > hiveIdColumnIndex && headers[hiveIdColumnIndex] === 'Stup ID';
        
        // Procesare date pentru a adăuga obiecte Date JavaScript și organizare pe stupi
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
        
        // Organizăm datele pe stupi
        sheetsData[sheetName] = { headers, rows: processedRows };
        
        return sheetsData[sheetName];
    } catch (error) {
        console.error(`Eroare la preluarea datelor pentru foaia ${sheetName}:`, error);
        document.getElementById('table-body').innerHTML = 
            `<tr><td colspan="8" class="loading-message">Eroare la încărcarea datelor: ${error.message}</td></tr>`;
        return null;
    }
}

// Funcția pentru a prelua date din toate foile disponibile
async function fetchAllSheets() {
    const results = {};
    const sheetNames = Object.keys(SHEET_URLS);
    
    console.log('Preluăm date din toate foile:', sheetNames);
    
    for (const sheetName of sheetNames) {
        console.log(`Preluăm date din foaia: ${sheetName}`);
        results[sheetName] = await fetchSheetData(sheetName);
    }
    
    return results;
}

// Verifică dacă două date sunt în aceeași zi
function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

// Filtrare date în funcție de perioada selectată
function filterDataByPeriod(data, period) {
    if (!data) return [];
    
    // Obținem datele corecte în funcție de perioada selectată
    let rowsToFilter = data.rows;
    
    // Dacă perioada este 'all', returnăm toate datele
    if (period === 'all') {
        return rowsToFilter;
    }
    
    const now = new Date();
    let cutoffDate;
    
    switch(period) {
        case 'today':
            // Doar măsurătorile de azi
            return rowsToFilter.filter(row => row.dateObj && isSameDay(row.dateObj, now));
            
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
                
                return rowsToFilter.filter(row => {
                    return row.dateObj && row.dateObj >= startDate && row.dateObj <= endDate;
                });
            } else {
                // Dacă nu avem intervale definite, returnăm toate datele
                return rowsToFilter;
            }
            
        default:
            return rowsToFilter;
    }
    
    return rowsToFilter.filter(row => row.dateObj && row.dateObj >= cutoffDate);
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
    
    // Verificăm dacă afișăm date de la toți stupii (pentru a adăuga o coloană suplimentară)
    const isShowingAllHives = currentSheet === 'all';
    
    // Actualizăm antetul tabelului pentru a adăuga sau elimina coloana "Stup"
    const tableHeader = document.querySelector('table thead tr');
    
    // Verificăm dacă există deja o coloană pentru stup
    const hasHiveColumn = Array.from(tableHeader.children).some(th => th.textContent === 'Stup');
    
    if (isShowingAllHives && !hasHiveColumn) {
        // Adăugăm coloana pentru stup
        const hiveHeader = document.createElement('th');
        hiveHeader.textContent = 'Stup';
        tableHeader.appendChild(hiveHeader);
    } else if (!isShowingAllHives && hasHiveColumn) {
        // Eliminăm coloana pentru stup
        const lastHeaderColumn = tableHeader.lastElementChild;
        if (lastHeaderColumn && lastHeaderColumn.textContent === 'Stup') {
            tableHeader.removeChild(lastHeaderColumn);
        }
    }
    
    // Actualizăm colspan pentru mesajul de încărcare
    const colspan = isShowingAllHives ? 8 : 7;
    tableBody.innerHTML = '<tr><td colspan="' + colspan + '" class="loading-message">Se încarcă datele...</td></tr>';
    tableBody.innerHTML = '';
    
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
        
        // Adăugăm coloana pentru stup dacă afișăm date de la toți stupii
        if (isShowingAllHives && row.sheetId) {
            const hiveCell = document.createElement('td');
            const hiveNumber = row.sheetId.replace('foaie', '');
            hiveCell.textContent = 'Stup ' + hiveNumber;
            tr.appendChild(hiveCell);
        }
        
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
function updateStats(data, hive = currentSheet) {
    if (!data || data.rows.length === 0) return;
    
    // Obține datele pentru stupul selectat
    let stupData = data.rows;
    
    // Verificăm dacă avem date
    if (stupData.length === 0) {
        document.getElementById('last-update').textContent = 'Nu există date';
        document.getElementById('current-weight').textContent = '0.00 kg';
        document.getElementById('current-temp').textContent = '0.0 °C';
        document.getElementById('daily-harvest').textContent = '0.00 kg';
        document.getElementById('total-harvest').textContent = '0.00 kg';
        document.getElementById('battery-level').textContent = '0.0 V';
        document.getElementById('rain-status').textContent = 'Nu';
        return;
    }
    
    // Ultima înregistrare (cea mai recentă)
    const lastRow = stupData[stupData.length - 1];
    
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
    
    // Actualizăm titlul pentru a indica stupul selectat
    const dashboardTitle = document.querySelector('.dashboard h2');
    if (dashboardTitle) {
        if (currentSheet === 'all') {
            dashboardTitle.textContent = 'Tablou de Bord - Toți Stupii';
        } else {
            // Obținem numărul stupului din ID-ul foii
            const stupNumber = currentSheet.replace('foaie', '');
            dashboardTitle.textContent = `Tablou de Bord - Stup ${stupNumber}`;
        }
    }
    
    // Adăugăm informații despre stupul sursă dacă afișăm date de la toți stupii
    if (currentSheet === 'all' && lastRow.sheetId) {
        const stupNumber = lastRow.sheetId.replace('foaie', '');
        // Adăugăm informații despre stupul sursă pentru ultimele date
        document.getElementById('last-update').textContent += ` (Stup ${stupNumber})`;
    }
}

// Funcția pentru a popula selectorul de foi (afișat ca selector de stupi)
function populateSheetSelector() {
    const sheetSelect = document.getElementById('sheet-select');
    
    // Verificăm dacă selectorul există
    if (!sheetSelect) return;
    
    // Setăm foaia curentă
    sheetSelect.value = currentSheet;
}

// Funcția pentru a schimba perioada
function changePeriod() {
    const periodSelect = document.getElementById('period-select');
    const newPeriod = periodSelect.value;
    
    console.log('Schimbare perioadă:', currentPeriod, '->', newPeriod);
    currentPeriod = newPeriod;
    
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
        // Actualizăm tabelul pentru noua perioadă
        console.log('Actualizare tabel pentru perioada:', currentPeriod);
        updateTable(allData, currentPeriod);
        
        // Asigurăm-ne că statisticile perioadei sunt actualizate
        const filteredData = filterDataByPeriod(allData, currentPeriod);
        const stats = calculatePeriodStats(filteredData);
        console.log('Statistici calculate pentru perioada', currentPeriod, ':', stats);
        
        // Actualizăm manual statisticile
        document.getElementById('period-harvest').textContent = stats.totalHarvest + ' kg';
        document.getElementById('period-temp').textContent = stats.avgTemperature + ' °C';
        document.getElementById('period-count').textContent = stats.count + ' măsurători';
    }
}

// Funcția pentru a aplica intervalul de date personalizat
function applyCustomDateRange() {
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    
    customStartDate = startDateInput.value;
    customEndDate = endDateInput.value;
    
    console.log('Interval personalizat aplicat:', customStartDate, 'până la', customEndDate);
    
    if (customStartDate && customEndDate && allData) {
        // Setăm perioada curentă la 'custom' în caz că nu era deja setată
        currentPeriod = 'custom';
        document.getElementById('period-select').value = 'custom';
        
        // Actualizăm tabelul
        console.log('Actualizare tabel pentru interval personalizat');
        updateTable(allData, 'custom');
        
        // Asigurăm-ne că statisticile perioadei sunt actualizate
        const filteredData = filterDataByPeriod(allData, 'custom');
        const stats = calculatePeriodStats(filteredData);
        console.log('Statistici calculate pentru interval personalizat:', stats);
        
        // Actualizăm manual statisticile
        document.getElementById('period-harvest').textContent = stats.totalHarvest + ' kg';
        document.getElementById('period-temp').textContent = stats.avgTemperature + ' °C';
        document.getElementById('period-count').textContent = stats.count + ' măsurători';
    }
}

// Funcția pentru a combina datele de la toți stupii
function combineAllSheetsData() {
    const allSheets = Object.keys(SHEET_URLS);
    let combinedRows = [];
    
    // Verificăm dacă avem date pentru toate foile
    const missingSheets = allSheets.filter(sheet => !sheetsData[sheet]);
    
    if (missingSheets.length > 0) {
        console.log('Lipsesc date pentru foile:', missingSheets);
        return null;
    }
    
    // Combinăm toate datele într-un singur array
    allSheets.forEach(sheet => {
        if (sheetsData[sheet] && sheetsData[sheet].rows) {
            // Adăugăm un identificator pentru stup pentru a ști de unde provine fiecare rând
            const rowsWithSheetId = sheetsData[sheet].rows.map(row => {
                // Creăm o copie a rândului și adăugăm ID-ul foii
                const rowCopy = [...row];
                rowCopy.sheetId = sheet;
                return rowCopy;
            });
            
            combinedRows = combinedRows.concat(rowsWithSheetId);
        }
    });
    
    // Sortăm datele după dată (cele mai vechi primele)
    combinedRows.sort((a, b) => a.dateObj - b.dateObj);
    
    // Creăm un obiect similar cu cel returnat de fetchSheetData
    if (combinedRows.length > 0 && sheetsData[allSheets[0]]) {
        // Folosim anteturile de la prima foaie
        const headers = sheetsData[allSheets[0]].headers;
        return { headers, rows: combinedRows };
    }
    
    return null;
}

// Funcția pentru a schimba foaia selectată (afișată ca stup în interfață)
function changeSheet() {
    const sheetSelect = document.getElementById('sheet-select');
    const newSheet = sheetSelect.value;
    
    console.log('Schimbare stup:', currentSheet, '->', newSheet);
    
    if (newSheet === currentSheet) {
        console.log('Același stup este deja selectat.');
        return;
    }
    
    currentSheet = newSheet;
    
    // Verificăm dacă a fost selectată opțiunea "Toți stupii"
    if (currentSheet === 'all') {
        console.log('Preluăm date pentru toți stupii');
        
        // Preluăm toate foile care nu au fost încă încărcate
        const allSheets = Object.keys(SHEET_URLS);
        const missingSheets = allSheets.filter(sheet => !sheetsData[sheet]);
        
        if (missingSheets.length > 0) {
            // Arătăm un indicator de încărcare
            document.getElementById('table-body').innerHTML = 
                '<tr><td colspan="8" class="loading-message">Se încarcă datele pentru toți stupii...</td></tr>';
            
            // Preluăm date pentru foile lipsă
            const fetchPromises = missingSheets.map(sheet => fetchSheetData(sheet));
            
            Promise.all(fetchPromises).then(() => {
                // Combinăm datele de la toate foile
                combinedData = combineAllSheetsData();
                
                if (combinedData) {
                    allData = combinedData;
                    
                    // Actualizăm tabelul și statisticile
                    updateTable(allData, currentPeriod);
                    updateStats(allData);
                }
            });
        } else {
            // Combinăm datele de la toate foile
            combinedData = combineAllSheetsData();
            
            if (combinedData) {
                allData = combinedData;
                
                // Actualizăm tabelul și statisticile
                updateTable(allData, currentPeriod);
                updateStats(allData);
            }
        }
    } else {
        // Preluăm date pentru stupul selectat dacă nu avem deja
        if (!sheetsData[currentSheet]) {
            console.log(`Preluăm date pentru stupul: ${currentSheet}`);
            // Arătăm un indicator de încărcare
            document.getElementById('table-body').innerHTML = 
                '<tr><td colspan="7" class="loading-message">Se încarcă datele pentru stupul selectat...</td></tr>';
            
            // Preluăm date și actualizăm
            fetchSheetData(currentSheet).then(data => {
                if (data) {
                    allData = data;
                    
                    // Actualizăm tabelul și statisticile
                    updateTable(allData, currentPeriod);
                    updateStats(allData);
                }
            });
        } else {
            console.log(`Folosim datele existente pentru stupul: ${currentSheet}`);
            allData = sheetsData[currentSheet];
            
            // Actualizăm tabelul și statisticile
            updateTable(allData, currentPeriod);
            updateStats(allData);
        }
    }
}

// Funcția pentru a inițializa controalele
function initControls() {
    // Setăm data de astăzi ca valoare maximă pentru selectoarele de dată
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('start-date').max = today;
    document.getElementById('end-date').max = today;
    
    // Inițializăm selectoarele
    populateSheetSelector();
    
    // Setăm valoarea selectată a selectorului de perioadă
    document.getElementById('period-select').value = currentPeriod;
    
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
    
    // Preluăm și afișăm datele pentru toți stupii
    if (currentSheet === 'all') {
        console.log('Preluăm date pentru toți stupii');
        
        // Arătăm un indicator de încărcare
        document.getElementById('table-body').innerHTML = 
            '<tr><td colspan="8" class="loading-message">Se încarcă datele pentru toți stupii...</td></tr>';
        
        // Preluăm date pentru toate foile
        const allSheets = Object.keys(SHEET_URLS);
        const fetchPromises = allSheets.map(sheet => fetchSheetData(sheet));
        
        await Promise.all(fetchPromises);
        
        // Combinăm datele de la toate foile
        combinedData = combineAllSheetsData();
        
        if (combinedData) {
            allData = combinedData;
            
            // Actualizăm tabelul și statisticile
            updateTable(allData, currentPeriod);
            updateStats(allData);
            
            // Asigurăm-ne că statisticile perioadei sunt actualizate corect
            const filteredData = filterDataByPeriod(allData, currentPeriod);
            const stats = calculatePeriodStats(filteredData);
            console.log('Statistici inițiale calculate pentru perioada', currentPeriod, ':', stats);
            
            // Actualizăm manual statisticile
            document.getElementById('period-harvest').textContent = stats.totalHarvest + ' kg';
            document.getElementById('period-temp').textContent = stats.avgTemperature + ' °C';
            document.getElementById('period-count').textContent = stats.count + ' măsurători';
        }
    } else {
        // Preluăm date doar pentru stupul selectat
        allData = await fetchSheetData(currentSheet);
        if (allData) {
            console.log('Date preluate cu succes, actualizăm pentru perioada:', currentPeriod);
            
            // Actualizăm tabelul pentru perioada curentă
            updateTable(allData, currentPeriod);
            
            // Actualizăm statisticile
            updateStats(allData);
            
            // Asigurăm-ne că statisticile perioadei sunt actualizate corect
            const filteredData = filterDataByPeriod(allData, currentPeriod);
            const stats = calculatePeriodStats(filteredData);
            console.log('Statistici inițiale calculate pentru perioada', currentPeriod, ':', stats);
            
            // Actualizăm manual statisticile
            document.getElementById('period-harvest').textContent = stats.totalHarvest + ' kg';
            document.getElementById('period-temp').textContent = stats.avgTemperature + ' °C';
            document.getElementById('period-count').textContent = stats.count + ' măsurători';
        }
    }
}

// Actualizăm pagina periodic
window.onload = function() {
    initPage();
    
    // Actualizare la fiecare 15 minute
    setInterval(initPage, 15 * 60 * 1000);
}; 