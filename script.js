// URL-uri pentru fiecare foaie publicată (redenumite ca stupi pentru interfață)
// ATENȚIE: Aceste URL-uri ar putea fi expirate dacă Google Sheets generează noi URL-uri de publicare
// Pentru a obține URL-uri actualizate, deschideți foaia de calcul, mergeți la Fișier > Publicare pe web
// Selectați opțiunea "Foaie de calcul" și formatul "Valori separate prin virgule (.csv)"
// Copiați link-ul generat și înlocuiți URL-urile de mai jos

// URL-uri pentru fiecare foaie
const SHEET_URLS = {
    // Folosim URL-uri directe către fișierele CSV publicate
    'foaie1': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQnbQPo-Mr3dghu2nMDTAPmI_gecKNthE8YrD-Gss9LcIc6D4rCGVp_ZQI5PfoA-ELmYyCTADZFzrKL/pub?gid=0&single=true&output=csv',
    'foaie2': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRE4-_BmtoGvaWD5I_lI0GG-OavL6mTa18wn_ON87Tvw-B1FoGWhBGI1Q-JHjU5pCVIEiYu09ii6bNB/pub?gid=0&single=true&output=csv',
    'foaie3': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTikN6b-AGCvrkBB8PM3TG4bc4_lBbe6BeP4NbJqK7lw2apxORR3x77QJlRAIIj6edAARg8PRWqvjRq/pub?gid=0&single=true&output=csv'
};

// Mapare între ID-uri de foi și ID-uri de spreadsheet pentru API-ul JSON
const SHEET_IDS = {
    'foaie1': '1w0Q6K4jO4Fko0-i7LTwQdxcOnbJ7U-ZvQkK_TeF_sxg',
    'foaie2': '1w0Q6K4jO4Fko0-i7LTwQdxcOnbJ7U-ZvQkK_TeF_sxg',
    'foaie3': '1w0Q6K4jO4Fko0-i7LTwQdxcOnbJ7U-ZvQkK_TeF_sxg'
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

// Funcția pentru a încerca din nou preluarea datelor cu întârziere
async function retryFetchWithDelay(sheetName, retries = 2, delay = 3000) {
    console.log(`Încercare de recuperare date pentru ${sheetName}, încercări rămase: ${retries}`);
    
    // Afișăm mesaj de încercare în tabel
    document.getElementById('table-body').innerHTML = 
        `<tr><td colspan="8" class="loading-message">Se încearcă din nou preluarea datelor... (${retries} încercări rămase)</td></tr>`;
    
    // Așteptăm perioada de delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
        // Încercăm din nou preluarea datelor
        const data = await fetchSheetData(sheetName);
        if (data) {
            console.log(`Recuperare reușită pentru ${sheetName} după reîncercare`);
            return data;
        } else if (retries > 1) {
            // Dacă încă nu avem date dar mai avem încercări, reîncercăm
            return retryFetchWithDelay(sheetName, retries - 1, delay);
        } else {
            console.error(`Toate încercările de recuperare pentru ${sheetName} au eșuat`);
            return null;
        }
    } catch (error) {
        console.error(`Eroare la reîncercarea preluării datelor pentru ${sheetName}:`, error);
        if (retries > 1) {
            return retryFetchWithDelay(sheetName, retries - 1, delay);
        }
        return null;
    }
}

// Funcția pentru a prelua datele din Google Sheets direct
async function fetchSheetData(sheetName = currentSheet) {
    return new Promise((resolve, reject) => {
        try {
            if (!SHEET_URLS[sheetName]) {
                console.error(`Foaia "${sheetName}" nu există.`);
                document.getElementById('table-body').innerHTML = 
                    `<tr><td colspan="8" class="loading-message">Eroare: Foaia "${sheetName}" nu există</td></tr>`;
                document.getElementById('error-container').style.display = 'block';
                reject(`Foaia "${sheetName}" nu există`);
                return;
            }
            
            console.log(`Începe preluarea datelor pentru foaia ${sheetName} de la URL:`, SHEET_URLS[sheetName]);
            
            // Încercăm mai întâi metoda directă prin fetch
            const fetchDirectly = async () => {
                try {
                    console.log(`Încercare preluare directă pentru foaia ${sheetName} de la URL:`, SHEET_URLS[sheetName]);
                    
                    const response = await fetch(SHEET_URLS[sheetName]);
                    if (!response.ok) {
                        throw new Error(`Eroare HTTP: ${response.status}`);
                    }
                    
                    const text = await response.text();
                    console.log(`S-au primit ${text.length} caractere pentru foaia ${sheetName}`);
                    
                    // Verificăm dacă am primit un text gol sau prea scurt
                    if (!text || text.length < 10) {
                        throw new Error('Răspuns prea scurt sau gol');
                    }
                    
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
                    if (rows.length < 2) {
                        throw new Error('Prea puține rânduri');
                    }
                    
                    // Prima linie conține anteturile
                    const headers = rows[0];
                    // Restul sunt date
                    const dataRows = rows.slice(1);
                    
                    // Verificăm dacă antetele sunt valide
                    if (headers.length < 5) {
                        throw new Error('Antete insuficiente');
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
                    
                    // Stocăm datele în obiectul global
                    sheetsData[sheetName] = processedRows;
                    
                    console.log(`Date salvate pentru foaia ${sheetName}: ${processedRows.length} rânduri`);
                    
                    // Ascundem containerul de eroare dacă era afișat
                    document.getElementById('error-container').style.display = 'none';
                    
                    // Returnăm datele procesate
                    return processedRows;
                } catch (error) {
                    console.error(`Eroare la preluarea directă pentru foaia ${sheetName}:`, error);
                    // Nu afișăm eroarea aici, încercăm metoda JSONP
                    throw error;
                }
            };
            
            // Încercăm mai întâi metoda directă
            fetchDirectly()
                .then(data => {
                    resolve(data);
                })
                .catch(error => {
                    console.log(`Preluare directă eșuată pentru foaia ${sheetName}, încercăm metoda JSONP:`, error);
                    
                    // Dacă metoda directă eșuează, încercăm metoda JSONP
                    // Folosim un script pentru a încărca datele și a evita problemele CORS
                    const scriptId = 'google-sheet-script';
                    let script = document.getElementById(scriptId);
                    
                    // Ștergem scriptul anterior dacă există
                    if (script) {
                        document.head.removeChild(script);
                    }
                    
                    // Creăm un callback global pentru a primi datele
                    const callbackName = 'googleSheetCallback_' + Date.now();
                    window[callbackName] = function(data) {
                        // Curățăm callback-ul după utilizare
                        delete window[callbackName];
                        
                        console.log(`S-au primit date pentru foaia ${sheetName} prin JSONP`);
                        
                        // Verificăm dacă am primit date valide
                        if (!data || !data.feed || !data.feed.entry || data.feed.entry.length === 0) {
                            console.error(`Date invalide primite pentru foaia ${sheetName}`);
                            document.getElementById('table-body').innerHTML = 
                                `<tr><td colspan="8" class="loading-message">Eroare: Date invalide primite de la Google Sheets</td></tr>`;
                            document.getElementById('error-container').style.display = 'block';
                            reject('Date invalide primite');
                            return;
                        }
                        
                        // Procesăm datele primite în format JSON
                        const entries = data.feed.entry;
                        const rows = [];
                        let currentRow = [];
                        let lastRow = 1;
                        
                        // Extragem anteturile (prima linie)
                        const headers = [];
                        for (let i = 0; i < entries.length; i++) {
                            const entry = entries[i];
                            const cellAddress = entry.gs$cell;
                            
                            if (cellAddress.row === '1') {
                                headers.push(entry.content.$t);
                            }
                        }
                        rows.push(headers);
                        
                        // Extragem restul datelor
                        for (let i = 0; i < entries.length; i++) {
                            const entry = entries[i];
                            const cellAddress = entry.gs$cell;
                            const rowNum = parseInt(cellAddress.row);
                            
                            if (rowNum === 1) {
                                // Am procesat deja anteturile
                                continue;
                            }
                            
                            // Dacă am trecut la un nou rând
                            if (rowNum !== lastRow) {
                                if (currentRow.length > 0) {
                                    rows.push(currentRow);
                                }
                                currentRow = [];
                                lastRow = rowNum;
                            }
                            
                            currentRow.push(entry.content.$t);
                        }
                        
                        // Adăugăm ultimul rând
                        if (currentRow.length > 0) {
                            rows.push(currentRow);
                        }
                        
                        console.log(`Foaia ${sheetName}: s-au parsat ${rows.length} rânduri`);
                        
                        // Verificăm dacă avem rânduri valide
                        if (rows.length < 2) {  // cel puțin antete + un rând de date
                            console.error(`Prea puține rânduri pentru foaia ${sheetName}: ${rows.length}`);
                            document.getElementById('table-body').innerHTML = 
                                `<tr><td colspan="8" class="loading-message">Eroare: Date insuficiente sau format invalid</td></tr>`;
                            document.getElementById('error-container').style.display = 'block';
                            reject(`Prea puține rânduri pentru foaia ${sheetName}: ${rows.length}`);
                            return;
                        }
                        
                        // Prima linie conține anteturile
                        const headerRow = rows[0];
                        // Restul sunt date
                        const dataRows = rows.slice(1);
                        
                        // Verificăm dacă antetele sunt valide
                        if (headerRow.length < 5) {
                            console.error(`Antete insuficiente pentru foaia ${sheetName}: ${headerRow.join(', ')}`);
                            document.getElementById('table-body').innerHTML = 
                                `<tr><td colspan="8" class="loading-message">Eroare: Format invalid al datelor</td></tr>`;
                            document.getElementById('error-container').style.display = 'block';
                            reject(`Antete insuficiente pentru foaia ${sheetName}: ${headerRow.join(', ')}`);
                            return;
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
                        
                        // Stocăm datele în obiectul global
                        sheetsData[sheetName] = processedRows;
                        
                        console.log(`Date salvate pentru foaia ${sheetName}: ${processedRows.length} rânduri`);
                        
                        // Ascundem containerul de eroare dacă era afișat
                        document.getElementById('error-container').style.display = 'none';
                        
                        // Returnăm datele procesate
                        resolve(processedRows);
                    };
                    
                    // Creăm un nou script pentru a încărca datele
                    script = document.createElement('script');
                    script.id = scriptId;
                    
                    // Folosim API-ul JSON pentru a obține datele (evită CORS)
                    // Obținem ID-ul spreadsheet-ului din mapare
                    const sheetId = SHEET_IDS[sheetName];
                    
                    if (!sheetId) {
                        console.error(`Nu există ID de spreadsheet pentru foaia ${sheetName}`);
                        document.getElementById('table-body').innerHTML = 
                            `<tr><td colspan="8" class="loading-message">Eroare: Nu există ID de spreadsheet pentru foaia ${sheetName}</td></tr>`;
                        document.getElementById('error-container').style.display = 'block';
                        reject(`Nu există ID de spreadsheet pentru foaia ${sheetName}`);
                        return;
                    }
                    
                    // Construim URL-ul pentru API-ul JSON
                    // Folosim 1 pentru prima foaie, 2 pentru a doua, etc.
                    const sheetNumber = sheetName === 'foaie1' ? 1 : (sheetName === 'foaie2' ? 2 : 3);
                    script.src = `https://spreadsheets.google.com/feeds/cells/${sheetId}/${sheetNumber}/public/values?alt=json-in-script&callback=${callbackName}`;
                    
                    console.log(`Încărcare script pentru foaia ${sheetName} de la URL: ${script.src}`);
                    
                    // Adăugăm un handler pentru erori
                    script.onerror = function() {
                        console.error(`Eroare la încărcarea scriptului pentru foaia ${sheetName}`);
                        document.getElementById('table-body').innerHTML = 
                            `<tr><td colspan="8" class="loading-message">Eroare la încărcarea datelor: Nu s-a putut accesa Google Sheets</td></tr>`;
                        document.getElementById('error-container').style.display = 'block';
                        reject('Eroare la încărcarea scriptului');
                    };
                    
                    // Adăugăm scriptul în document
                    document.head.appendChild(script);
                    
                    // Setăm un timeout pentru a evita blocarea în cazul în care callback-ul nu este apelat
                    setTimeout(() => {
                        if (window[callbackName]) {
                            delete window[callbackName];
                            console.error(`Timeout la preluarea datelor pentru foaia ${sheetName}`);
                            document.getElementById('table-body').innerHTML = 
                                `<tr><td colspan="8" class="loading-message">Eroare: Timeout la preluarea datelor</td></tr>`;
                            document.getElementById('error-container').style.display = 'block';
                            reject('Timeout la preluarea datelor');
                        }
                    }, 10000); // 10 secunde timeout
                    
                });
        } catch (error) {
            console.error(`Eroare la preluarea datelor pentru foaia ${sheetName}:`, error);
            document.getElementById('table-body').innerHTML = 
                `<tr><td colspan="8" class="loading-message">Eroare la încărcarea datelor: ${error.message}</td></tr>`;
            document.getElementById('error-container').style.display = 'block';
            reject(error);
        }
    });
}

// Funcția pentru a prelua date de la toate foile
async function fetchAllSheets() {
    const allSheets = Object.keys(SHEET_URLS);
    console.log(`Preluare date pentru toate cele ${allSheets.length} foi...`);
    
    // Resetăm datele existente
    sheetsData = {};
    
    // Folosim promisiuni pentru a prelua datele în paralel
    const fetchPromises = allSheets.map(sheet => {
        return fetchSheetData(sheet).catch(err => {
            console.error(`Eroare la preluarea datelor pentru foaia ${sheet}:`, err);
            // Încercăm din nou preluarea datelor pentru această foaie
            return retryFetchWithDelay(sheet);
        });
    });
    
    // Așteptăm toate promisiunile să se finalizeze
    const results = await Promise.all(fetchPromises);
    
    // Verificăm câte foi au fost încărcate cu succes
    const loadedSheets = Object.keys(sheetsData);
    const failedSheets = allSheets.filter(sheet => !sheetsData[sheet]);
    
    console.log(`S-au încărcat ${loadedSheets.length} foi din ${allSheets.length}`);
    
    if (failedSheets.length > 0) {
        console.warn(`Nu s-au putut încărca ${failedSheets.length} foi:`, failedSheets);
    }
    
    // Verificăm dacă am încărcat cel puțin o foaie
    if (loadedSheets.length === 0) {
        console.error('Nu s-a putut încărca nicio foaie!');
        document.getElementById('table-body').innerHTML = 
            '<tr><td colspan="8" class="loading-message">Eroare: Nu s-a putut încărca nicio foaie de date</td></tr>';
        // Afișăm containerul de eroare
        document.getElementById('error-container').style.display = 'block';
        return false;
    }
    
    // Ascundem containerul de eroare dacă era afișat, deoarece cel puțin o foaie s-a încărcat
    document.getElementById('error-container').style.display = 'none';
    
    return true;
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
    if (!filteredData || filteredData.length === 0) return 1;
    return Math.ceil(filteredData.length / itemsPerPage);
}

// Funcția pentru a merge la prima pagină
function goToFirstPage() {
    const firstPageLink = document.getElementById('first-page');
    // Verificăm dacă butonul este dezactivat
    if (firstPageLink.disabled || firstPageLink.classList.contains('disabled')) {
        console.log("Navigare la prima pagină: buton dezactivat");
        return false;
    }
    
    console.log("Navigare la prima pagină");
    if (currentPage !== 1) {
        currentPage = 1;
        displayCurrentPage();
    }
    return false; // Previne navigarea link-ului
}

// Funcția pentru a merge la pagina anterioară
function goToPrevPage() {
    const prevPageLink = document.getElementById('prev-page');
    // Verificăm dacă butonul este dezactivat
    if (prevPageLink.disabled || prevPageLink.classList.contains('disabled')) {
        console.log("Navigare la pagina anterioară: buton dezactivat");
        return false;
    }
    
    console.log("Navigare la pagina anterioară");
    if (currentPage > 1) {
        currentPage--;
        displayCurrentPage();
    }
    return false; // Previne navigarea link-ului
}

// Funcția pentru a merge la pagina următoare
function goToNextPage() {
    const nextPageLink = document.getElementById('next-page');
    // Verificăm dacă butonul este dezactivat
    if (nextPageLink.disabled || nextPageLink.classList.contains('disabled')) {
        console.log("Navigare la pagina următoare: buton dezactivat");
        return false;
    }
    
    console.log("Navigare la pagina următoare");
    const totalPages = getTotalPages();
    if (currentPage < totalPages) {
        currentPage++;
        displayCurrentPage();
    }
    return false; // Previne navigarea link-ului
}

// Funcția pentru a merge la ultima pagină
function goToLastPage() {
    const lastPageLink = document.getElementById('last-page');
    // Verificăm dacă butonul este dezactivat
    if (lastPageLink.disabled || lastPageLink.classList.contains('disabled')) {
        console.log("Navigare la ultima pagină: buton dezactivat");
        return false;
    }
    
    console.log("Navigare la ultima pagină");
    const totalPages = getTotalPages();
    if (currentPage !== totalPages) {
        currentPage = totalPages;
        displayCurrentPage();
    }
    return false; // Previne navigarea link-ului
}

// Schimbă numărul de elemente pe pagină
function changeItemsPerPage() {
    const select = document.getElementById('items-per-page');
    const newItemsPerPage = parseInt(select.value);
    console.log(`Schimbare număr elemente pe pagină: ${itemsPerPage} -> ${newItemsPerPage}`);
    
    // Dacă s-a schimbat numărul de elemente
    if (newItemsPerPage !== itemsPerPage) {
        itemsPerPage = newItemsPerPage;
        currentPage = 1; // Resetăm la prima pagină
        displayCurrentPage();
    }
}

// Actualizează controalele de paginare (text și stare butoane)
function updatePaginationControls() {
    const totalPages = getTotalPages();
    
    // Actualizăm textul cu numărul paginii
    document.getElementById('pagination-text').textContent = `Pagina ${currentPage} din ${totalPages}`;
    
    // Actualizăm starea link-urilor de paginare
    const firstPageLink = document.getElementById('first-page');
    const prevPageLink = document.getElementById('prev-page');
    const nextPageLink = document.getElementById('next-page');
    const lastPageLink = document.getElementById('last-page');
    
    // Prima pagină și Anterioară sunt dezactivate la prima pagină
    const isFirstPage = currentPage <= 1;
    firstPageLink.classList.toggle('disabled', isFirstPage);
    prevPageLink.classList.toggle('disabled', isFirstPage);
    
    // Actualizăm atributul disabled pentru prima pagină și pagina anterioară
    firstPageLink.disabled = isFirstPage;
    prevPageLink.disabled = isFirstPage;
    
    // Următoarea și Ultima sunt dezactivate la ultima pagină
    const isLastPage = currentPage >= totalPages;
    nextPageLink.classList.toggle('disabled', isLastPage);
    lastPageLink.classList.toggle('disabled', isLastPage);
    
    // Actualizăm atributul disabled pentru pagina următoare și ultima pagină
    nextPageLink.disabled = isLastPage;
    lastPageLink.disabled = isLastPage;
    
    console.log(`Paginare: Pagina ${currentPage}/${totalPages}, Elemente/pagină: ${itemsPerPage}`);
}

// Afișează pagina curentă (rândurile corespunzătoare)
function displayCurrentPage() {
    if (!filteredData || filteredData.length === 0) {
        console.log("Nu există date de afișat");
        return;
    }
    
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    
    // Afișăm datele în ordine inversă (cele mai recente primele)
    const reversedData = [...filteredData].reverse();
    
    // Calculăm intervalul de rânduri pentru pagina curentă
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, reversedData.length);
    
    console.log(`Afișare rânduri de la ${startIndex} la ${endIndex-1} din ${reversedData.length} total`);
    
    // Dacă nu există rânduri de afișat
    if (startIndex >= reversedData.length) {
        // Resetăm la prima pagină și reafișăm
        currentPage = 1;
        displayCurrentPage();
        return;
    }
    
    // Preluăm rândurile pentru pagina curentă
    const rowsToShow = reversedData.slice(startIndex, endIndex);
    
    // Verificăm dacă afișăm date de la toți stupii (pentru a adăuga o coloană suplimentară)
    const isShowingAllHives = currentSheet === 'all';
    
    // Pentru fiecare rând, creăm elementele HTML
    rowsToShow.forEach((row) => {
        const tr = document.createElement('tr');
        
        // Data
        const dateCell = document.createElement('td');
        let dateValue = row[0];
        try {
            if (row.dateObj && !isNaN(row.dateObj)) {
                dateValue = formatDateRO(row.dateObj) + 
                    ' ' + row.dateObj.toLocaleTimeString('ro-RO', {hour: '2-digit', minute: '2-digit'});
            }
        } catch (e) {
            console.warn("Eroare la formatarea datei:", e);
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
    
    // Actualizăm controalele de paginare după afișare
    updatePaginationControls();
}

// Funcția pentru a actualiza tabelul HTML cu noi date
function updateTable(data, period = 'all') {
    if (!data) {
        console.error("Nu s-au putut încărca datele");
        return;
    }
    
    console.log(`Actualizare tabel cu perioada: ${period}`);
    
    // Resetăm pagina curentă la 1 când se schimbă filtrul
    currentPage = 1;
    
    // Filtrare date în funcție de perioada selectată
    filteredData = filterDataByPeriod(data, period);
    
    const tableBody = document.getElementById('table-body');
    
    // Dacă nu există date după filtrare
    if (filteredData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="loading-message">Nu există date pentru perioada selectată</td></tr>';
        
        // Actualizăm textul de paginare
        document.getElementById('pagination-text').textContent = 'Pagina 0 din 0';
        
        // Dezactivăm toate link-urile de paginare folosind atât clasa cât și atributul disabled
        const paginationLinks = ['first-page', 'prev-page', 'next-page', 'last-page'];
        paginationLinks.forEach(id => {
            const link = document.getElementById(id);
            link.classList.add('disabled');
            link.disabled = true;
        });
        
        return;
    }
    
    // Verificăm dacă afișăm date de la toți stupii
    const isShowingAllHives = currentSheet === 'all';
    
    // Actualizăm antetul tabelului (adăugăm/eliminăm coloana Stup)
    const tableHeader = document.querySelector('table thead tr');
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
    
    // Actualizăm statisticile pentru perioada selectată
    const stats = calculatePeriodStats(filteredData);
    
    // Actualizăm statisticile afișate
    document.getElementById('period-harvest').textContent = stats.totalHarvest + ' kg';
    document.getElementById('period-temp').textContent = stats.avgTemperature + ' °C';
    document.getElementById('period-count').textContent = stats.count + ' măsurători';
    
    // Afișăm pagina curentă (prima pagină)
    displayCurrentPage();
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

// Funcția pentru a combina datele de la toate foile
function combineAllSheetsData() {
    console.log('Combinare date de la toate foile...');
    
    // Verificăm dacă avem date pentru foile
    const sheets = Object.keys(sheetsData);
    
    if (sheets.length === 0) {
        console.error('Nu există date pentru niciun stup');
        return null;
    }
    
    console.log(`Combinare date de la ${sheets.length} stupi:`, sheets);
    
    // Inițializăm array-ul combinat
    let combined = [];
    
    // Pentru fiecare foaie
    for (const sheet of sheets) {
        const sheetData = sheetsData[sheet];
        
        // Verificăm dacă există date pentru această foaie
        if (!sheetData || sheetData.length === 0) {
            console.warn(`Nu există date pentru foaia ${sheet}, se sare peste`);
            continue;
        }
        
        console.log(`Adăugare ${sheetData.length} rânduri de la foaia ${sheet}`);
        
        // Adăugăm fiecare rând cu informațiile suplimentare despre foaie
        for (const row of sheetData) {
            // Creăm o copie a rândului
            const newRow = [...row];
            
            // Adăugăm informații despre foaie
            newRow.sheetId = sheet;
            
            // Adăugăm la array-ul combinat
            combined.push(newRow);
        }
    }
    
    // Sortăm datele după dată (cele mai vechi primele)
    combined.sort((a, b) => {
        if (!a.dateObj || !b.dateObj) return 0;
        return a.dateObj - b.dateObj;
    });
    
    console.log(`S-au combinat ${combined.length} rânduri din ${sheets.length} stupi`);
    
    // Salvăm în variabila globală
    combinedData = combined;
    
    return combined;
}

// Funcția pentru a schimba foaia selectată (afișată ca stup în interfață)
function changeSheet() {
    const selector = document.getElementById('sheet-selector');
    const selectedSheet = selector.value;
    console.log(`Schimbare la stupul: ${selectedSheet}`);
    
    // Verificăm dacă s-a schimbat realmente selectorul
    if (selectedSheet === currentSheet) {
        console.log('Același stup selectat, nu facem nimic');
        return;
    }
    
    // Actualizăm variabila globală
    currentSheet = selectedSheet;
    
    // Resetăm paginarea la prima pagină
    currentPage = 1;
    
    // Cazul pentru "Toți stupii"
    if (selectedSheet === 'all') {
        console.log('Afișare date pentru toți stupii');
        
        // Verificăm dacă avem date combinate
        if (!combinedData || combinedData.length === 0) {
            console.log('Combinare date de la toți stupii');
            combineAllSheetsData();
        }
        
        // Verificăm din nou dacă avem date
        if (combinedData && combinedData.length > 0) {
            // Actualizăm tabelul și statisticile
            updateTable(combinedData, currentPeriod);
            updateStats(combinedData, 'all');
        } else {
            console.error('Nu există date combinate pentru toți stupii');
            document.getElementById('table-body').innerHTML = 
                '<tr><td colspan="8" class="loading-message">Nu există date disponibile pentru toți stupii</td></tr>';
        }
    } else {
        // Cazul pentru un stup specific
        console.log(`Afișare date pentru stupul ${selectedSheet}`);
        
        // Verificăm dacă avem date pentru acest stup
        if (sheetsData[selectedSheet] && sheetsData[selectedSheet].length > 0) {
            // Actualizăm tabelul și statisticile
            updateTable(sheetsData[selectedSheet], currentPeriod);
            updateStats(sheetsData[selectedSheet], selectedSheet);
        } else {
            console.error(`Nu există date pentru stupul ${selectedSheet}`);
            document.getElementById('table-body').innerHTML = 
                `<tr><td colspan="7" class="loading-message">Nu există date disponibile pentru Stupul ${selectedSheet.replace('foaie', '')}</td></tr>`;
            
            // Resetăm statisticile
            document.getElementById('current-weight').textContent = '0.00 kg';
            document.getElementById('current-temp').textContent = '0.0 °C';
            document.getElementById('current-battery').textContent = '0.0 V';
            document.getElementById('period-harvest').textContent = '0.00 kg';
            document.getElementById('period-temp').textContent = '0.0 °C';
            document.getElementById('period-count').textContent = '0 măsurători';
        }
    }
}

// Funcția pentru a inițializa controalele interfaței
function initControls() {
    console.log('Inițializare controale...');
    
    // Setăm anul curent în footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Inițializăm selectorul de perioade
    const periodSelector = document.getElementById('period-selector');
    periodSelector.value = currentPeriod;
    
    // Inițializăm câmpurile pentru perioada personalizată
    const today = new Date();
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);
    
    // Formatăm datele pentru input de tip date (YYYY-MM-DD)
    document.getElementById('custom-start-date').value = formatDateForInput(oneWeekAgo);
    document.getElementById('custom-end-date').value = formatDateForInput(today);
    
    // Ascundem inițial containerul pentru date personalizate
    document.getElementById('custom-date-container').style.display = 'none';
    
    // Adăugăm event listener pentru selectorul de perioade
    periodSelector.addEventListener('change', changePeriod);
    
    // Adăugăm event listener pentru selectorul de stupi
    const sheetSelector = document.getElementById('sheet-selector');
    sheetSelector.addEventListener('change', changeSheet);
    
    // Adăugăm event listener pentru butonul de aplicare a datelor personalizate
    document.getElementById('apply-custom-date').addEventListener('click', applyCustomDateRange);
    
    // Inițializăm controalele de paginare
    document.getElementById('first-page').addEventListener('click', function(e) {
        e.preventDefault();
        return goToFirstPage();
    });
    
    document.getElementById('prev-page').addEventListener('click', function(e) {
        e.preventDefault();
        return goToPrevPage();
    });
    
    document.getElementById('next-page').addEventListener('click', function(e) {
        e.preventDefault();
        return goToNextPage();
    });
    
    document.getElementById('last-page').addEventListener('click', function(e) {
        e.preventDefault();
        return goToLastPage();
    });
    
    // Inițializăm selectorul de elemente per pagină
    document.getElementById('items-per-page').value = itemsPerPage;
    
    // Inițial ascundem containerul de eroare
    if (document.getElementById('error-container')) {
        document.getElementById('error-container').style.display = 'none';
    }
    
    console.log('Controale inițializate');
}

// Funcție utilă pentru formatarea datei pentru input-uri HTML
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Funcție pentru a testa accesibilitatea URL-urilor
async function testSheetUrls() {
    console.log('Testare accesibilitate URL-uri...');
    const results = {};
    
    for (const [sheetName, url] of Object.entries(SHEET_URLS)) {
        try {
            console.log(`Testare URL pentru ${sheetName}: ${url}`);
            const response = await fetch(url, { method: 'HEAD' });
            
            results[sheetName] = {
                status: response.status,
                ok: response.ok,
                statusText: response.statusText
            };
            
            console.log(`Rezultat test pentru ${sheetName}: ${response.status} ${response.statusText}`);
        } catch (error) {
            console.error(`Eroare la testarea URL-ului pentru ${sheetName}:`, error);
            results[sheetName] = {
                status: 0,
                ok: false,
                statusText: error.message
            };
        }
    }
    
    console.log('Rezultate teste URL-uri:', results);
    return results;
}

// Inițializarea paginii
async function initPage() {
    console.log('Inițializare pagină...');
    
    // Eliminăm posibile elemente cache din grafice anterioare
    cleanupOldChartElements();
    
    // Actualizăm data și ora curentă
    updateCurrentDateTime();
    setInterval(updateCurrentDateTime, 1000); // Actualizare la fiecare secundă
    
    // Populăm selectorul de stupi
    populateSheetSelector();
    
    // Setăm perioada implicită la "astăzi"
    const periodSelector = document.getElementById('period-selector');
    periodSelector.value = 'today';
    currentPeriod = 'today';
    
    // Testăm URL-urile înainte de a încerca să preluăm datele
    const urlTests = await testSheetUrls();
    const allUrlsOk = Object.values(urlTests).every(result => result.ok);
    
    if (!allUrlsOk) {
        console.error("Unele URL-uri nu sunt accesibile. Verificați conexiunea și URL-urile.");
        document.getElementById('error-container').style.display = 'block';
    }
    
    // Preluăm datele pentru toți stupii
    console.log("Preluare date pentru toți stupii...");
    try {
        await fetchAllSheets();
        
        // Verificăm dacă am primit date
        if (Object.keys(sheetsData).length === 0) {
            console.error("Nu s-au putut prelua datele pentru niciun stup");
            document.getElementById('table-body').innerHTML = 
                '<tr><td colspan="8" class="loading-message">Eroare: Nu s-au putut prelua datele pentru niciun stup după mai multe încercări</td></tr>';
            document.getElementById('error-container').style.display = 'block';
            return;
        }
        
        // Combinăm datele de la toți stupii
        combineAllSheetsData();
        
        // Afișăm datele combinate (setăm și currentSheet = 'all')
        if (combinedData && combinedData.length > 0) {
            console.log("Inițializare cu date combinate:", combinedData.length, "înregistrări");
            currentSheet = 'all';
            updateTable(combinedData, currentPeriod);
            
            // Actualizăm selector la "Toți stupii"
            const sheetSelector = document.getElementById('sheet-selector');
            sheetSelector.value = 'all';
            
            // Actualizăm statisticile
            updateStats(combinedData, 'all');
        } else {
            console.error("Nu există date combinate");
            document.getElementById('table-body').innerHTML = 
                '<tr><td colspan="8" class="loading-message">Eroare: Nu există date disponibile</td></tr>';
        }
        
        // Inițializăm controalele pentru filtre și paginare
        initControls();
        
        // Resetăm la prima pagină și afișăm datele
        currentPage = 1;
        displayCurrentPage();
        
    } catch (error) {
        console.error('Eroare la inițializare:', error);
        document.getElementById('table-body').innerHTML = 
            `<tr><td colspan="8" class="loading-message">Eroare la inițializare: ${error.message}</td></tr>`;
    }
}

// Actualizăm pagina periodic
window.onload = function() {
    initPage();
    
    // Actualizare la fiecare 15 minute
    setInterval(initPage, 15 * 60 * 1000);
}; 