// URL-uri pentru fiecare foaie publicată (redenumite ca stupi pentru interfață)
// ATENȚIE: Aceste URL-uri ar putea fi expirate dacă Google Sheets generează noi URL-uri de publicare
// Pentru a obține URL-uri actualizate, deschideți foaia de calcul, mergeți la Fișier > Publicare pe web
// Selectați opțiunea "Foaie de calcul" și formatul "Valori separate prin virgule (.csv)"
// Copiați link-ul generat și înlocuiți URL-urile de mai jos

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
        
        console.log(`Începe preluarea datelor pentru foaia ${sheetName} de la URL:`, SHEET_URLS[sheetName]);
        
        const response = await fetch(SHEET_URLS[sheetName]);
        
        // Verificăm statusul HTTP
        if (!response.ok) {
            console.error(`Eroare HTTP la preluarea datelor pentru foaia ${sheetName}: ${response.status} ${response.statusText}`);
            document.getElementById('table-body').innerHTML = 
                `<tr><td colspan="8" class="loading-message">Eroare la încărcarea datelor: HTTP ${response.status}</td></tr>`;
            return null;
        }
        
        const text = await response.text();
        
        console.log(`S-au primit ${text.length} caractere pentru foaia ${sheetName}`);
        
        // Verificăm dacă am primit un text gol sau prea scurt (posibilă eroare)
        if (!text || text.length < 10) {
            console.error(`Răspuns prea scurt sau gol pentru foaia ${sheetName}: "${text}"`);
            document.getElementById('table-body').innerHTML = 
                `<tr><td colspan="8" class="loading-message">Eroare: Răspuns gol sau invalid de la Google Sheets</td></tr>`;
            return null;
        }
        
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
        
        console.log(`Foaia ${sheetName}: s-au parsat ${rows.length} rânduri`);
        
        // Verificăm dacă avem rânduri valide
        if (rows.length < 2) {  // cel puțin antete + un rând de date
            console.error(`Prea puține rânduri pentru foaia ${sheetName}: ${rows.length}`);
            document.getElementById('table-body').innerHTML = 
                `<tr><td colspan="8" class="loading-message">Eroare: Date insuficiente sau format invalid</td></tr>`;
            return null;
        }
        
        // Prima linie conține anteturile
        const headers = rows[0];
        // Restul sunt date
        const dataRows = rows.slice(1);
        
        // Verificăm dacă antetele sunt valide
        if (headers.length < 5) {
            console.error(`Antete insuficiente pentru foaia ${sheetName}: ${headers.join(', ')}`);
            document.getElementById('table-body').innerHTML = 
                `<tr><td colspan="8" class="loading-message">Eroare: Format invalid al datelor</td></tr>`;
            return null;
        }
        
        // Debug - afișăm primul și ultimul rând
        if (dataRows.length > 0) {
            console.log(`Anteturi pentru foaia ${sheetName}:`, headers);
            console.log(`Primul rând pentru foaia ${sheetName}:`, dataRows[0]);
            console.log(`Ultimul rând pentru foaia ${sheetName}:`, dataRows[dataRows.length - 1]);
        } else {
            console.warn(`Foaia ${sheetName} nu conține date!`);
            return { headers, rows: [] };
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
        
        console.log(`Foaia ${sheetName}: ${processedRows.length} rânduri procesate și sortate`);
        
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

// Funcțiile de navigare între pagini - metode simple
function goToFirstPage() {
    console.log('goToFirstPage: Navigare la prima pagină');
    currentPage = 1;
    renderCurrentPage();
}

function goToPrevPage() {
    console.log('goToPrevPage: Pagina curentă:', currentPage);
    if (currentPage > 1) {
        currentPage--;
        renderCurrentPage();
    }
}

function goToNextPage() {
    const totalPages = getTotalPages();
    console.log('goToNextPage: Pagina curentă:', currentPage, 'din total:', totalPages);
    if (currentPage < totalPages) {
        currentPage++;
        renderCurrentPage();
    }
}

function goToLastPage() {
    const totalPages = getTotalPages();
    console.log('goToLastPage: Navigare la ultima pagină:', totalPages);
    currentPage = totalPages > 0 ? totalPages : 1;
    renderCurrentPage();
}

// Funcția pentru a schimba numărul de elemente pe pagină
function changeItemsPerPage() {
    const select = document.getElementById('items-per-page');
    itemsPerPage = parseInt(select.value);
    console.log('changeItemsPerPage: Număr nou de elemente pe pagină:', itemsPerPage);
    
    // Resetăm la prima pagină
    currentPage = 1;
    renderCurrentPage();
}

// Actualizează controalele de paginare
function updatePaginationControls() {
    const totalPages = getTotalPages();
    console.log('updatePaginationControls: Pagina curentă:', currentPage, 'din total:', totalPages);
    
    document.getElementById('pagination-text').textContent = `Pagina ${currentPage} din ${totalPages}`;
    
    // Actualizăm starea link-urilor de paginare
    const firstPageLink = document.getElementById('first-page');
    const prevPageLink = document.getElementById('prev-page');
    const nextPageLink = document.getElementById('next-page');
    const lastPageLink = document.getElementById('last-page');
    
    // Activăm/dezactivăm link-urile adăugând/eliminând clasa 'disabled'
    if (currentPage <= 1) {
        firstPageLink.classList.add('disabled');
        prevPageLink.classList.add('disabled');
    } else {
        firstPageLink.classList.remove('disabled');
        prevPageLink.classList.remove('disabled');
    }
    
    if (currentPage >= totalPages) {
        nextPageLink.classList.add('disabled');
        lastPageLink.classList.add('disabled');
    } else {
        nextPageLink.classList.remove('disabled');
        lastPageLink.classList.remove('disabled');
    }
    
    // Debug - afișăm starea link-urilor
    console.log('Stare link-uri paginare:', {
        'first-page': firstPageLink.classList.contains('disabled'),
        'prev-page': prevPageLink.classList.contains('disabled'),
        'next-page': nextPageLink.classList.contains('disabled'),
        'last-page': lastPageLink.classList.contains('disabled')
    });
}

// Randează pagina curentă din datele filtrate
function renderCurrentPage() {
    console.log('renderCurrentPage: Pagina curentă:', currentPage);
    if (!filteredData || filteredData.length === 0) {
        console.log('renderCurrentPage: Nu există date de afișat');
        return;
    }
    
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    
    // Adăugăm rândurile în ordine inversă (cele mai recente primele)
    const reversedRows = [...filteredData].reverse();
    
    // Calculăm indexul de start și stop pentru pagina curentă
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, reversedRows.length);
    
    console.log('renderCurrentPage: Afișare rânduri de la', startIndex, 'la', endIndex - 1);
    
    // Obținem datele pentru pagina curentă
    const rowsToShow = reversedRows.slice(startIndex, endIndex);
    
    // Verificăm dacă afișăm date de la toți stupii (pentru a adăuga o coloană suplimentară)
    const isShowingAllHives = currentSheet === 'all';
    
    // Adăugăm rândurile în tabel
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
    
    // Actualizăm controalele de paginare după randare
    updatePaginationControls();
}

// Funcția pentru a actualiza tabelul HTML
function updateTable(data, period = 'all') {
    if (!data) return;
    
    console.log('updateTable: Actualizare tabel cu perioada:', period);
    
    // Resetăm pagina curentă la 1 când se schimbă filtrul
    currentPage = 1;
    
    // Filtrare date în funcție de perioada selectată
    filteredData = filterDataByPeriod(data, period);
    
    const tableBody = document.getElementById('table-body');
    
    if (filteredData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="loading-message">Nu există date pentru perioada selectată</td></tr>';
        
        // Actualizăm controalele de paginare
        document.getElementById('pagination-text').textContent = 'Pagina 0 din 0';
        
        // Dezactivăm toate link-urile de paginare
        document.getElementById('first-page').classList.add('disabled');
        document.getElementById('prev-page').classList.add('disabled');
        document.getElementById('next-page').classList.add('disabled');
        document.getElementById('last-page').classList.add('disabled');
        
        return;
    }
    
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
    
    // Actualizăm statistici pentru perioada selectată
    const stats = calculatePeriodStats(filteredData);
    const periodName = getPeriodName(period);
    
    document.getElementById('period-harvest').textContent = stats.totalHarvest + ' kg';
    document.getElementById('period-temp').textContent = stats.avgTemperature + ' °C';
    document.getElementById('period-count').textContent = stats.count + ' măsurători';
    
    // Randăm pagina curentă
    renderCurrentPage();
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

// Funcția pentru a schimba perioada selectată
function changePeriod() {
    const periodSelect = document.getElementById('period-select');
    const customDateRange = document.getElementById('custom-date-range');
    
    // Actualizăm perioada curentă
    currentPeriod = periodSelect.value;
    console.log('changePeriod: Noua perioadă selectată:', currentPeriod);
    
    // Afișăm/ascundem selectorul de dată personalizată
    if (currentPeriod === 'custom') {
        customDateRange.style.display = 'flex';
    } else {
        customDateRange.style.display = 'none';
        
        // Actualizăm tabelul și statisticile pentru noua perioadă
        updateTable(allData, currentPeriod);
    }
}

// Funcția pentru a aplica intervalul de date personalizat
function applyCustomDateRange() {
    console.log('applyCustomDateRange: Aplicare interval de date personalizat');
    
    // Preluăm datele din selectoare
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    
    // Verificăm dacă sunt valide
    if (!startDateInput.value || !endDateInput.value) {
        alert('Vă rugăm să selectați ambele date pentru intervalul personalizat.');
        return;
    }
    
    // Creăm obiecte Date
    customStartDate = new Date(startDateInput.value);
    customEndDate = new Date(endDateInput.value);
    
    // Setăm sfârșitul zilei pentru data de sfârșit
    customEndDate.setHours(23, 59, 59, 999);
    
    // Verificăm dacă intervalul este valid
    if (customStartDate > customEndDate) {
        alert('Data de început trebuie să fie anterioară datei de sfârșit.');
        return;
    }
    
    // Actualizăm tabelul cu datele filtrate
    updateTable(allData, 'custom');
}

// Funcția pentru a combina datele de la toți stupii
function combineAllSheetsData() {
    const allSheets = Object.keys(SHEET_URLS);
    let combinedRows = [];
    
    console.log('Începe combinarea datelor de la toate foile:', allSheets);
    
    // Verificăm dacă avem date pentru toate foile
    const missingSheets = allSheets.filter(sheet => !sheetsData[sheet]);
    
    if (missingSheets.length > 0) {
        console.error('Lipsesc date pentru foile:', missingSheets);
        return null;
    }
    
    // Verificăm dacă fiecare foaie are date
    const emptySheetsCount = allSheets.filter(sheet => !sheetsData[sheet].rows || sheetsData[sheet].rows.length === 0).length;
    if (emptySheetsCount === allSheets.length) {
        console.error('Toate foile sunt goale!');
        return null;
    }
    
    // Combinăm toate datele într-un singur array
    allSheets.forEach(sheet => {
        if (sheetsData[sheet] && sheetsData[sheet].rows && sheetsData[sheet].rows.length > 0) {
            console.log(`Adăugare ${sheetsData[sheet].rows.length} rânduri de la foaia ${sheet}`);
            
            // Adăugăm un identificator pentru stup pentru a ști de unde provine fiecare rând
            const rowsWithSheetId = sheetsData[sheet].rows.map(row => {
                // Creăm o copie a rândului și adăugăm ID-ul foii
                const rowCopy = [...row];
                rowCopy.sheetId = sheet;
                return rowCopy;
            });
            
            combinedRows = combinedRows.concat(rowsWithSheetId);
        } else {
            console.warn(`Foaia ${sheet} nu are date sau nu este încă încărcată`);
        }
    });
    
    if (combinedRows.length === 0) {
        console.error('Nu s-a putut combina niciun rând de date!');
        return null;
    }
    
    console.log(`Total rânduri combinate: ${combinedRows.length}`);
    
    // Sortăm datele după dată (cele mai vechi primele)
    combinedRows.sort((a, b) => a.dateObj - b.dateObj);
    
    // Creăm un obiect similar cu cel returnat de fetchSheetData
    if (combinedRows.length > 0) {
        // Folosim anteturile de la prima foaie care are date
        const firstSheetWithData = allSheets.find(sheet => 
            sheetsData[sheet] && sheetsData[sheet].headers && sheetsData[sheet].rows.length > 0
        );
        
        if (!firstSheetWithData) {
            console.error('Nu s-a găsit nicio foaie cu date valide!');
            return null;
        }
        
        const headers = sheetsData[firstSheetWithData].headers;
        console.log('Combinare completă. Se returnează date combinate cu anteturile:', headers);
        return { headers, rows: combinedRows };
    }
    
    console.error('Nu s-a putut crea obiectul de date combinate!');
    return null;
}

// Funcția pentru a schimba foaia selectată (afișată ca stup în interfață)
function changeSheet() {
    const sheetSelect = document.getElementById('sheet-select');
    const newSheet = sheetSelect.value;
    
    console.log('changeSheet: Schimbare stup:', currentSheet, '->', newSheet);
    
    if (newSheet === currentSheet) {
        console.log('changeSheet: Același stup este deja selectat.');
        return;
    }
    
    currentSheet = newSheet;
    
    try {
        // Inițial ascundem containerul de eroare
        document.getElementById('error-container').style.display = 'none';
        
        // Verificăm dacă a fost selectată opțiunea "Toți stupii"
        if (currentSheet === 'all') {
            console.log('changeSheet: Preluăm date pentru toți stupii');
            
            // Arătăm un indicator de încărcare
            document.getElementById('table-body').innerHTML = 
                '<tr><td colspan="8" class="loading-message">Se încarcă datele pentru toți stupii...</td></tr>';
            
            // Preluăm toate foile care nu au fost încă încărcate
            const allSheets = Object.keys(SHEET_URLS);
            const missingSheets = allSheets.filter(sheet => !sheetsData[sheet]);
            
            if (missingSheets.length > 0) {
                console.log('changeSheet: Se vor încărca foile lipsă:', missingSheets);
                
                // Preluăm date pentru foile lipsă
                const fetchPromises = missingSheets.map(sheet => fetchSheetData(sheet).catch(err => {
                    console.error(`Eroare la preluarea datelor pentru foaia ${sheet}:`, err);
                    return null;
                }));
                
                Promise.all(fetchPromises).then((results) => {
                    const allFailed = results.every(result => result === null);
                    if (allFailed && missingSheets.length === allSheets.length) {
                        console.error('changeSheet: Toate preluările de date au eșuat!');
                        document.getElementById('error-container').style.display = 'block';
                        return;
                    }
                    
                    console.log('changeSheet: Toate foile lipsă au fost încărcate, se combină datele');
                    // Combinăm datele de la toate foile
                    combinedData = combineAllSheetsData();
                    
                    if (combinedData && combinedData.rows.length > 0) {
                        console.log(`changeSheet: S-au combinat ${combinedData.rows.length} rânduri de date`);
                        allData = combinedData;
                        
                        // Actualizăm tabelul pentru perioada curentă
                        updateTable(allData, currentPeriod);
                        
                        // Actualizăm statisticile
                        updateStats(allData);
                    } else {
                        console.error('changeSheet: Nu s-au putut combina datele după încărcarea foilor lipsă!');
                        document.getElementById('table-body').innerHTML = 
                            '<tr><td colspan="8" class="loading-message">Nu s-au putut încărca datele pentru toți stupii</td></tr>';
                        document.getElementById('error-container').style.display = 'block';
                    }
                });
            } else {
                console.log('changeSheet: Toate foile sunt deja încărcate, se combină datele');
                // Combinăm datele de la toate foile
                combinedData = combineAllSheetsData();
                
                if (combinedData && combinedData.rows.length > 0) {
                    console.log(`changeSheet: S-au combinat ${combinedData.rows.length} rânduri de date`);
                    allData = combinedData;
                    
                    // Actualizăm tabelul pentru perioada curentă
                    updateTable(allData, currentPeriod);
                    
                    // Actualizăm statisticile
                    updateStats(allData);
                } else {
                    console.error('changeSheet: Nu s-au putut combina datele!');
                    document.getElementById('table-body').innerHTML = 
                        '<tr><td colspan="8" class="loading-message">Nu s-au putut încărca datele pentru toți stupii</td></tr>';
                    document.getElementById('error-container').style.display = 'block';
                }
            }
        } else {
            // Preluăm date pentru stupul selectat dacă nu avem deja
            if (!sheetsData[currentSheet]) {
                console.log(`changeSheet: Preluăm date pentru stupul: ${currentSheet}`);
                // Arătăm un indicator de încărcare
                document.getElementById('table-body').innerHTML = 
                    '<tr><td colspan="7" class="loading-message">Se încarcă datele pentru stupul selectat...</td></tr>';
                
                // Preluăm date și actualizăm
                fetchSheetData(currentSheet).then(data => {
                    if (data && data.rows.length > 0) {
                        console.log(`changeSheet: S-au preluat ${data.rows.length} rânduri de date pentru stupul ${currentSheet}`);
                        allData = data;
                        
                        // Actualizăm tabelul pentru perioada curentă
                        updateTable(allData, currentPeriod);
                        
                        // Actualizăm statisticile
                        updateStats(allData);
                    } else {
                        console.error(`changeSheet: Nu s-au putut încărca date pentru stupul ${currentSheet} sau nu există date!`);
                        document.getElementById('table-body').innerHTML = 
                            '<tr><td colspan="7" class="loading-message">Nu există date pentru stupul selectat</td></tr>';
                        document.getElementById('error-container').style.display = 'block';
                    }
                }).catch(error => {
                    console.error(`Eroare la preluarea datelor pentru stupul ${currentSheet}:`, error);
                    document.getElementById('table-body').innerHTML = 
                        '<tr><td colspan="7" class="loading-message">Eroare la încărcarea datelor pentru stupul selectat</td></tr>';
                    document.getElementById('error-container').style.display = 'block';
                });
            } else {
                console.log(`changeSheet: Folosim datele existente pentru stupul: ${currentSheet}`);
                allData = sheetsData[currentSheet];
                
                if (allData && allData.rows.length > 0) {
                    // Actualizăm tabelul pentru perioada curentă
                    updateTable(allData, currentPeriod);
                    
                    // Actualizăm statisticile
                    updateStats(allData);
                } else {
                    console.error(`changeSheet: Datele pentru stupul ${currentSheet} există dar sunt goale!`);
                    document.getElementById('table-body').innerHTML = 
                        '<tr><td colspan="7" class="loading-message">Nu există date pentru stupul selectat</td></tr>';
                    document.getElementById('error-container').style.display = 'block';
                }
            }
        }
    } catch (error) {
        console.error('Eroare la schimbarea stupului:', error);
        document.getElementById('table-body').innerHTML = 
            '<tr><td colspan="8" class="loading-message">Eroare la schimbarea stupului: ' + error.message + '</td></tr>';
        document.getElementById('error-container').style.display = 'block';
    }
}

// Inițializarea controalelor
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
    
    // Evenimentele pentru link-urile de paginare sunt definite direct în HTML cu onClick
    // Putem elimina addEventListeners, deoarece folosim a href="javascript:void(0)" onclick="..." în HTML
    
    // Actualizăm ora și o vom actualiza în fiecare secundă
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
    
    try {
        // Inițial ascundem containerul de eroare
        document.getElementById('error-container').style.display = 'none';
        
        // Preluăm și afișăm datele pentru toți stupii
        if (currentSheet === 'all') {
            console.log('Preluăm date pentru toți stupii');
            
            // Arătăm un indicator de încărcare
            document.getElementById('table-body').innerHTML = 
                '<tr><td colspan="8" class="loading-message">Se încarcă datele pentru toți stupii...</td></tr>';
            
            // Preluăm date pentru toate foile
            const allSheets = Object.keys(SHEET_URLS);
            console.log('Se vor prelua date pentru foile:', allSheets);
            
            // Folosim promisiuni pentru a prelua datele în paralel
            const fetchPromises = [];
            for (const sheet of allSheets) {
                console.log(`Inițiere preluare date pentru foaia: ${sheet}`);
                fetchPromises.push(fetchSheetData(sheet).catch(err => {
                    console.error(`Eroare la preluarea datelor pentru foaia ${sheet}:`, err);
                    return null;
                }));
            }
            
            // Așteptăm ca toate promisiunile să fie rezolvate
            const results = await Promise.all(fetchPromises);
            console.log('Rezultate preluare date:', results.map(r => r ? 'succes' : 'eroare'));
            
            // Verificăm dacă toate preluările au eșuat
            const allFailed = results.every(result => result === null);
            if (allFailed) {
                console.error('Toate preluările de date au eșuat!');
                document.getElementById('error-container').style.display = 'block';
                return;
            }
            
            // Verificăm dacă toate foile au fost încărcate
            const missingSheets = allSheets.filter(sheet => !sheetsData[sheet]);
            if (missingSheets.length > 0) {
                console.warn('Nu s-au putut încărca date pentru foile:', missingSheets);
            }
            
            // Combinăm datele de la toate foile
            console.log('Încercare combinare date de la toate foile');
            combinedData = combineAllSheetsData();
            
            if (combinedData && combinedData.rows.length > 0) {
                console.log(`S-au combinat ${combinedData.rows.length} rânduri de date`);
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
            } else {
                console.error('Nu s-au putut combina datele de la toate foile!');
                document.getElementById('table-body').innerHTML = 
                    '<tr><td colspan="8" class="loading-message">Nu s-au putut încărca datele pentru toți stupii</td></tr>';
                document.getElementById('error-container').style.display = 'block';
            }
        } else {
            // Preluăm date doar pentru stupul selectat
            console.log(`Preluare date pentru stupul ${currentSheet}`);
            allData = await fetchSheetData(currentSheet);
            
            if (allData && allData.rows.length > 0) {
                console.log(`S-au preluat ${allData.rows.length} rânduri de date pentru stupul ${currentSheet}`);
                
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
            } else {
                console.error(`Nu s-au putut încărca date pentru stupul ${currentSheet}!`);
                document.getElementById('table-body').innerHTML = 
                    '<tr><td colspan="7" class="loading-message">Nu s-au putut încărca datele pentru stupul selectat</td></tr>';
                document.getElementById('error-container').style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Eroare la inițializarea paginii:', error);
        document.getElementById('table-body').innerHTML = 
            '<tr><td colspan="8" class="loading-message">Eroare la încărcarea datelor: ' + error.message + '</td></tr>';
        document.getElementById('error-container').style.display = 'block';
    }
}

// Actualizăm pagina periodic
window.onload = function() {
    initPage();
    
    // Actualizare la fiecare 15 minute
    setInterval(initPage, 15 * 60 * 1000);
}; 