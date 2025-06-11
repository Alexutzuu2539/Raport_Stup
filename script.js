// URL-uri pentru datele publice (CSV) ale foilor de calcul Google Sheets
// Notă: Aceste URL-uri trebuie actualizate dacă se modifică setările de publicare
const sheetUrls = {
    foaie1: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQnbQPo-Mr3dghu2nMDTAPmI_gecKNthE8YrD-Gss9LcIc6D4rCGVp_ZQI5PfoA-ELmYyCTADZFzrKL/pub?gid=0&single=true&output=csv",
    foaie2: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQnbQPo-Mr3dghu2nMDTAPmI_gecKNthE8YrD-Gss9LcIc6D4rCGVp_ZQI5PfoA-ELmYyCTADZFzrKL/pub?gid=690799216&single=true&output=csv",
    foaie3: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQnbQPo-Mr3dghu2nMDTAPmI_gecKNthE8YrD-Gss9LcIc6D4rCGVp_ZQI5PfoA-ELmYyCTADZFzrKL/pub?gid=1535587101&single=true&output=csv"
};

// URL pentru API-ul Web Apps
// IMPORTANT: Înlocuiește acest URL cu cel generat după publicarea scriptului ca Web App
const webAppUrl = "https://script.google.com/macros/s/AKfycbz55c1crpkT5QTyAq8k17qKFwanuOetxaieyAdAS6jhKaaAzqJkzYNbAIUUDaUE0f8H/exec";
// Exemplu URL nou: https://script.google.com/macros/s/CODUL_TAU_UNIC_GENERAT_DE_GOOGLE/exec

// Funcție pentru a încărca date direct de la Web App API
async function fetchDataFromWebAppAPI(sheetName = null) {
    try {
        console.log(`Încercăm să preluăm date direct de la Web App API${sheetName ? ' pentru foaia ' + sheetName : ''}`);
        
        // Construim URL-ul pentru cerere
        let url = webAppUrl;
        if (sheetName) {
            url += `?sheet=${sheetName}`;
        }
        
        // Adăugăm un timestamp pentru a evita cache-ul
        url += `${url.includes('?') ? '&' : '?'}timestamp=${Date.now()}`;
        
        // Facem cererea
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Eroare necunoscută');
        }
        
        console.log(`Date primite cu succes de la Web App API${sheetName ? ' pentru foaia ' + sheetName : ''}`);
        return data;
    } catch (error) {
        console.error(`Eroare la preluarea datelor de la Web App API${sheetName ? ' pentru foaia ' + sheetName : ''}:`, error);
        throw error;
    }
}

// Funcție pentru a procesa datele primite de la API
function processApiData(data) {
    if (!data || !data.success) {
        console.error("Nu s-au putut încărca date de la API:", data ? data.message : "Răspuns gol");
        // Încărcăm datele de test ca fallback
        loadDemoData();
        return;
    }
    
    console.log("Date încărcate cu succes de la API:", data);
    
    // Convertim datele primite într-un format compatibil cu aplicația
    const processedData = data.data.map(item => {
        // Adaptăm structura datelor primite de la API la structura așteptată de aplicație
        return {
            date: item.Dată || item.Data || new Date().toISOString().split('T')[0],
            weight: parseFloat(item.Greutate || 0),
            temperature: parseFloat(item.Temperatură || item.Temperatura || 0),
            dailyHarvest: parseFloat(item.RecoltaZilnică || item["Recolta zilnică"] || 0),
            totalHarvest: parseFloat(item.RecoltaTotală || item["Recolta totală"] || 0),
            battery: parseFloat(item.Baterie || 0),
            rain: item.Ploaie || "Nu",
            // Adăugăm și câmpul dateObj pentru compatibilitate
            dateObj: new Date(item.Dată || item.Data || new Date())
        };
    });
    
    // Actualizăm interfața cu datele primite
    if (processedData && processedData.length > 0) {
        // Actualizăm datele globale
        sheetsData = { 'api': processedData };
        combinedData = processedData;
        
        // Actualizăm interfața
        updateTable(processedData, 'today');
        updateStats(processedData, 'api');
        
        // Resetăm paginarea
        currentPage = 1;
        displayCurrentPage();
    }
}

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

// Log de erori pentru debugging
let errorLog = [];

// Funcție pentru logarea erorilor
function logError(message, error = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        message,
        error: error ? (error.message || error.toString()) : null
    };
    
    console.error(`[${timestamp}] ${message}`, error);
    errorLog.push(logEntry);
    
    // Actualizăm detaliile erorii în interfață dacă există elementul
    const errorDetails = document.getElementById('error-details');
    if (errorDetails) {
        errorDetails.textContent = errorLog
            .slice(-5) // Ultimele 5 erori
            .map(entry => `[${entry.timestamp}] ${entry.message}: ${entry.error || ''}`)
            .join('\n');
    }
    
    // Afișăm containerul de eroare și ne asigurăm că rămâne vizibil
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
        errorContainer.style.display = 'block';
        
        // Adăugăm un flag pentru a nu ascunde automat containerul
        window.keepErrorVisible = true;
    }
    
    return logEntry;
}

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

// Funcția pentru a încărca toate foile de calcul disponibile
async function loadAllSheets() {
    try {
        const promises = Object.keys(sheetUrls).map(sheetKey => 
            fetchCSV(sheetUrls[sheetKey], sheetKey)
        );
        
        const results = await Promise.allSettled(promises);
        
        // Verificăm dacă am încărcat cu succes cel puțin o foaie
        const successfulSheets = results.filter(result => result.status === 'fulfilled');
        
        if (successfulSheets.length === 0) {
            console.error("Nu s-a putut încărca nicio foaie de calcul");
            return null;
        }
        
        // Combinăm datele din toate foile
        let allData = [];
        successfulSheets.forEach(result => {
            if (result.value && result.value.data) {
                allData = allData.concat(result.value.data);
            }
        });
        
        // Sortăm toate datele după dată
        allData.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return allData;
    } catch (error) {
        console.error("Eroare la încărcarea foilor de calcul:", error);
        return null;
    }
}

// Funcție pentru a încărca un fișier CSV
async function fetchCSV(url, sheetKey) {
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const csvText = await response.text();
        const parsedData = parseCSV(csvText);
        
        return {
            key: sheetKey,
            data: parsedData
        };
    } catch (error) {
        console.error(`Eroare la încărcarea foii ${sheetKey}:`, error);
        return null;
    }
}

// Funcție simplă pentru parsarea CSV
function parseCSV(csvText, sheetKey) {
    try {
        // Împărțim textul CSV în linii
        const lines = csvText.split('\n');
        if (lines.length === 0) {
            console.error("CSV gol pentru foaia", sheetKey);
            return [];
        }
        
        // Extragem anteturile (prima linie)
        const headers = lines[0].split(',').map(header => header.trim());
        
        // Verificăm dacă avem anteturi valide
        if (headers.length === 0) {
            console.error("Anteturi CSV invalide pentru foaia", sheetKey);
            return [];
        }
        
        const results = [];
        
        // Parcurgem restul liniilor pentru a extrage datele
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue; // Sărim peste linii goale
            
            const values = lines[i].split(',');
            if (values.length !== headers.length) {
                console.warn(`Linia ${i} din foaia ${sheetKey} are un număr diferit de valori față de anteturi: ${values.length} vs ${headers.length}`);
                continue; // Sărim peste linii cu număr greșit de valori
            }
            
            const entry = {};
            
            // Mapăm valorile la cheile corespunzătoare
            headers.forEach((header, index) => {
                entry[header] = values[index] ? values[index].trim() : '';
            });
            
            // Adăugăm și câmpuri calculate pentru compatibilitate
            
            // Adăugăm data ca obiect Date pentru filtrare
            try {
                entry.dateObj = new Date(entry.date || entry.Data || entry.Dată);
            } catch (e) {
                console.warn(`Eroare la parsarea datei pentru linia ${i} din foaia ${sheetKey}:`, e);
                entry.dateObj = new Date(); // Folosim data curentă ca fallback
            }
            
            // Adăugăm sursa datelor
            entry.source = sheetKey;
            
            results.push(entry);
        }
        
        return results;
    } catch (error) {
        console.error(`Eroare la parsarea CSV pentru foaia ${sheetKey}:`, error);
        return [];
    }
}

// Funcție pentru a afișa erori în UI
function displayError(error) {
    const errorContainer = document.getElementById('error-container');
    const errorDetails = document.getElementById('error-details');
    
    if (errorContainer && errorDetails) {
        errorDetails.textContent = `Detalii eroare: ${error.message || error}`;
        errorContainer.style.display = 'block';
    }
    
    console.error("Eroare:", error);
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
            logError(`Toate încercările de recuperare pentru ${sheetName} au eșuat`);
            return null;
        }
    } catch (error) {
        logError(`Eroare la reîncercarea preluării datelor pentru ${sheetName}`, error);
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
                logError(`Foaia "${sheetName}" nu există.`);
                document.getElementById('table-body').innerHTML = 
                    `<tr><td colspan="8" class="loading-message">Eroare: Foaia "${sheetName}" nu există</td></tr>`;
                document.getElementById('error-container').style.display = 'block';
                reject(`Foaia "${sheetName}" nu există`);
                return;
            }
            
            console.log(`Începe preluarea datelor pentru foaia ${sheetName} de la URL:`, SHEET_URLS[sheetName]);
            
            // Adăugăm un parametru unic pentru a evita cache-ul
            const cacheParam = `&timestamp=${Date.now()}`;
            const sheetUrl = SHEET_URLS[sheetName] + cacheParam;
            
            // Încercăm mai întâi metoda directă prin fetch
            const fetchDirectly = async () => {
                try {
                    console.log(`Încercare preluare directă pentru foaia ${sheetName} de la URL:`, sheetUrl);
                    
                    const response = await fetch(sheetUrl, {
                        method: 'GET',
                        cache: 'no-store', // Forțăm fără cache
                        headers: {
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache'
                        }
                    });
                    
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
                            logError('Eroare la conversie dată:', e);
                        }
                        return processedRow;
                    });
                    
                    // Sortăm datele după dată (cele mai vechi primele)
                    processedRows.sort((a, b) => a.dateObj - b.dateObj);
                    
                    // Stocăm datele în obiectul global
                    sheetsData[sheetName] = processedRows;
                    
                    console.log(`Date salvate pentru foaia ${sheetName}: ${processedRows.length} rânduri`);
                    
                    // Nu ascundem containerul de eroare dacă a fost un flag setat
                    if (!window.keepErrorVisible) {
                        document.getElementById('error-container').style.display = 'none';
                    }
                    
                    // Returnăm datele procesate
                    return processedRows;
                } catch (error) {
                    logError(`Eroare la preluarea directă pentru foaia ${sheetName}`, error);
                    // Nu afișăm eroarea aici, încercăm metoda JSONP
                    throw error;
                }
            };
            
            // Folosim date de test
            const generateTestData = () => {
                console.log("Folosim date de test pentru a permite demonstrarea funcționalității");
                
                // Generăm date de exemplu pentru demonstrație
                const sampleRows = [];
                const today = new Date();
                
                // Generăm 30 de zile de date de exemplu
                for (let i = 30; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    
                    // Valori de exemplu
                    const weight = 35 + Math.random() * 5; // 35-40kg
                    const temp = 20 + Math.random() * 10; // 20-30°C
                    const diff = (Math.random() > 0.7) ? -0.2 : 0.2 + Math.random() * 0.5; // Majoritar pozitiv
                    const harvest = 15 + Math.random() * 5; // 15-20kg
                    const battery = 12 - (Math.random() * i / 30); // 11-12V
                    const rain = Math.random() > 0.8 ? "Da" : "Nu"; // 20% șansă de ploaie
                    
                    const row = [
                        formatDateRO(date),
                        weight.toFixed(2),
                        temp.toFixed(1),
                        diff.toFixed(2),
                        harvest.toFixed(2),
                        battery.toFixed(1),
                        rain
                    ];
                    
                    // Adăugăm și obiectul date pentru sortare și filtrare
                    row.dateObj = date;
                    
                    sampleRows.push(row);
                }
                
                // Stocăm datele în obiectul global
                sheetsData[sheetName] = sampleRows;
                
                // Afișăm un mesaj că folosim date de exemplu
                document.getElementById('error-container').style.display = 'block';
                document.getElementById('error-details').textContent = 
                    "Se folosesc date de EXEMPLU pentru demonstrație. Aceste date NU sunt reale.\n" +
                    "Verificați conexiunea la internet și setările Google Sheets.\n" +
                    "Eroare: Blocaj CORS la accesarea API-ului Google Sheets.";
                
                return sampleRows;
            };
            
            // Încercăm mai întâi metoda directă
            fetchDirectly()
                .then(data => {
                    resolve(data);
                })
                .catch(error => {
                    console.log(`Preluare directă eșuată pentru foaia ${sheetName}, încercăm metoda JSONP:`, error);
                    
                    // Dacă metoda directă eșuează, folosim direct datele de test
                    const testData = generateTestData();
                    resolve(testData);
                });
        } catch (error) {
            logError(`Eroare neașteptată la preluarea datelor pentru foaia ${sheetName}`, error);
            
            // Ca ultimă soluție, generăm date de test
            const testData = generateTestData();
            resolve(testData);
        }
    });
}

// Funcția pentru a încărca toate foile disponibile
async function fetchAllSheets() {
    console.log("Preluare date pentru toate cele " + Object.keys(SHEET_URLS).length + " foi...");
    
    try {
        const promises = Object.entries(SHEET_URLS).map(([sheetName, url]) => {
            return fetchSheetDataWithFallback(url, sheetName)
                .then(result => {
                    if (result && result.data) {
                        sheetsData[sheetName] = result.data;
                        return {
                            name: sheetName,
                            success: true,
                            count: result.data.length
                        };
                    }
                    return {
                        name: sheetName,
                        success: false,
                        error: "Nu s-au putut încărca date"
                    };
                })
                .catch(error => {
                    console.error(`Eroare la încărcarea foii ${sheetName}:`, error);
                    return {
                        name: sheetName,
                        success: false,
                        error: error.message || "Eroare necunoscută"
                    };
                });
        });
        
        const results = await Promise.all(promises);
        
        const successCount = results.filter(r => r.success).length;
        console.log(`S-au încărcat ${successCount} foi din ${results.length}`);
        
        if (successCount === 0) {
            console.error("Nu s-a putut încărca nicio foaie");
            throw new Error("Nu s-a putut încărca nicio foaie");
        }
        
        return sheetsData;
    } catch (error) {
        console.error("Eroare la încărcarea foilor:", error);
        throw error;
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
    // Verificăm dacă avem date valide
    if (!data || !Array.isArray(data)) {
        console.error("Date invalide pentru filtrare:", data);
        return [];
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Verificăm dacă datele au câmpul 'date' sau 'data'
    const firstItem = data[0];
    const dateField = firstItem && (firstItem.date || firstItem.data || firstItem.Dată || 'date');
    
    return data.filter(item => {
        // Verificăm dacă item există și are un câmp de dată
        if (!item || !item[dateField]) {
            return false;
        }
        
        let itemDate;
        try {
            itemDate = new Date(item[dateField]);
            if (isNaN(itemDate.getTime())) {
                console.warn("Dată invalidă:", item[dateField]);
                return false;
            }
        } catch (e) {
            console.warn("Eroare la parsarea datei:", e);
            return false;
        }
        
        switch (period) {
            case 'today':
                return itemDate >= today;
            case 'week':
                const oneWeekAgo = new Date(today);
                oneWeekAgo.setDate(today.getDate() - 7);
                return itemDate >= oneWeekAgo;
            case 'month':
                const oneMonthAgo = new Date(today);
                oneMonthAgo.setMonth(today.getMonth() - 1);
                return itemDate >= oneMonthAgo;
            case 'year':
                const thisYear = new Date(today.getFullYear(), 0, 1);
                return itemDate >= thisYear;
            case 'custom':
                // Implementat în altă parte
                return true;
            default:
                return true; // 'all' sau orice altă valoare
        }
    });
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
    try {
        console.log('Actualizare tabel cu perioada:', period);
        
        if (!data || !Array.isArray(data)) {
            logError('Date invalide pentru actualizare tabel');
            document.getElementById('table-body').innerHTML = 
                '<tr><td colspan="8" class="loading-message">Eroare: Date invalide pentru afișare</td></tr>';
            return;
        }
        
        // Filtrăm datele după perioadă
        filteredData = filterDataByPeriod(data, period);
        
        if (filteredData.length === 0) {
            document.getElementById('table-body').innerHTML = 
                `<tr><td colspan="8" class="loading-message">Nu există date pentru perioada selectată (${getPeriodName(period)})</td></tr>`;
            return;
        }
        
        // Calculăm statisticile pentru perioada filtrată
        calculatePeriodStats(filteredData);
        
        // Resetăm paginarea la prima pagină
        currentPage = 1;
        
        // Afișăm paginarea
        displayCurrentPage();
        
        // Actualizăm controalele de paginare
        updatePaginationControls();
        
    } catch (error) {
        logError('Eroare la actualizarea tabelului', error);
        document.getElementById('table-body').innerHTML = 
            `<tr><td colspan="8" class="loading-message">Eroare la afișarea datelor: ${error.message}</td></tr>`;
    }
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
            const response = await fetch(url + `&timestamp=${Date.now()}`, {
                method: 'HEAD',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
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

// Funcție pentru testarea conexiunii la Google Sheets
async function testConnections() {
    const results = {};
    document.getElementById('error-details').textContent = "Testare conexiuni...";
    
    // Testăm fiecare URL
    for (const [sheetName, url] of Object.entries(SHEET_URLS)) {
        try {
            console.log(`Testare URL pentru ${sheetName}: ${url}`);
            const response = await fetch(url + `&timestamp=${Date.now()}`, {
                method: 'HEAD',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
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
    
    // Afișăm rezultatele
    let resultsText = "Rezultate teste conexiune:\n\n";
    for (const [sheetName, result] of Object.entries(results)) {
        resultsText += `${sheetName}: ${result.ok ? 'OK' : 'EȘUAT'} (${result.status} ${result.statusText})\n`;
    }
    
    document.getElementById('error-details').textContent = resultsText;
    document.getElementById('error-container').style.display = 'block';
    
    console.log('Rezultate teste URL-uri:', results);
    return results;
}

// Modificăm inițializarea paginii pentru a încerca mai multe metode de încărcare a datelor
async function initPage() {
    console.log('Inițializare pagină...');
    
    // Eliminăm posibile elemente cache din grafice anterioare
    if (typeof cleanupOldChartElements === 'function') {
        cleanupOldChartElements();
    }
    
    // Actualizăm data și ora curentă
    updateCurrentDateTime();
    setInterval(updateCurrentDateTime, 1000); // Actualizare la fiecare secundă
    
    // Setăm anul curent în footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Populăm selectorul de stupi dacă există
    if (typeof populateSheetSelector === 'function') {
        populateSheetSelector();
    }
    
    // Adăugăm listener pentru butonul de debugging dacă există
    if (document.getElementById('debug-btn')) {
        document.getElementById('debug-btn').addEventListener('click', function() {
            if (typeof testConnections === 'function') {
                testConnections();
            }
        });
    }
    
    try {
        // Încercăm mai întâi să încărcăm datele de la Web App API
        console.log("Încercăm să încărcăm datele de la Web App API...");
        
        const apiData = await fetchDataFromWebAppAPI().catch(e => null);
        
        if (apiData && apiData.success && apiData.data) {
            console.log("Date încărcate cu succes de la Web App API");
            
            // Procesăm datele primite
            sheetsData = {};
            
            // Verificăm structura datelor primite
            if (Array.isArray(apiData.data)) {
                // Dacă datele sunt un array, le tratăm ca pe o singură foaie
                sheetsData['api'] = processApiDataArray(apiData.data);
                combinedData = sheetsData['api'];
            } else {
                // Dacă datele sunt un obiect, le tratăm ca pe mai multe foi
                for (const sheetName in apiData.data) {
                    if (Array.isArray(apiData.data[sheetName])) {
                        sheetsData[sheetName] = processApiDataArray(apiData.data[sheetName]);
                    }
                }
                
                // Combinăm datele de la toate foile
                if (typeof combineAllSheetsData === 'function') {
                    combineAllSheetsData();
                }
            }
            
            // Afișăm datele
            if (combinedData && combinedData.length > 0) {
                console.log("Inițializare cu date combinate:", combinedData.length, "înregistrări");
                currentSheet = 'all';
                updateTable(combinedData, 'today');
                
                // Actualizăm statisticile
                updateStats(combinedData, 'all');
                
                // Resetăm la prima pagină și afișăm datele
                currentPage = 1;
                displayCurrentPage();
                
                return; // Ieșim din funcție dacă am reușit să încărcăm datele
            }
        }
        
        // Dacă API-ul nu a funcționat, încercăm metoda standard
        console.log("Încercăm metoda standard de încărcare a datelor...");
        
        // Verificăm dacă funcțiile necesare există
        if (typeof fetchAllSheets === 'function') {
            await fetchAllSheets();
            
            // Verificăm dacă am primit date
            if (sheetsData && Object.keys(sheetsData).length > 0) {
                console.log("Date încărcate cu succes prin metoda standard");
                
                // Combinăm datele de la toți stupii dacă funcția există
                if (typeof combineAllSheetsData === 'function') {
                    combineAllSheetsData();
                }
                
                // Afișăm datele combinate
                if (combinedData && combinedData.length > 0) {
                    console.log("Inițializare cu date combinate:", combinedData.length, "înregistrări");
                    currentSheet = 'all';
                    updateTable(combinedData, 'today');
                    
                    // Actualizăm statisticile
                    updateStats(combinedData, 'all');
                    
                    // Resetăm la prima pagină și afișăm datele
                    currentPage = 1;
                    displayCurrentPage();
                    
                    return; // Ieșim din funcție dacă am reușit să încărcăm datele
                }
            }
        }
        
        // Dacă am ajuns aici, înseamnă că ambele metode au eșuat
        throw new Error("Toate metodele de încărcare a datelor au eșuat");
        
    } catch (error) {
        console.error("Eroare la încărcarea datelor:", error);
        
        // Încercăm să preluăm datele prin JSONP
        console.log("Încercăm să preluăm datele prin JSONP...");
        
        fetchDataFromWebApp(function(data) {
            if (data && data.success) {
                processApiData(data);
            } else {
                console.error("Nu s-au putut încărca date prin JSONP");
                
                // Încărcăm datele de test ca ultimă soluție
                if (typeof loadDemoData === 'function') {
                    console.log("Încărcăm datele de test...");
                    loadDemoData();
                } else {
                    // Generăm date de test pentru toate foile
                    console.log("Generăm date de test pentru toate foile...");
                    sheetsData = {};
                    
                    for (const sheetName of ['foaie1', 'foaie2', 'foaie3']) {
                        const testData = generateTestData(sheetName);
                        if (testData && testData.data) {
                            sheetsData[sheetName] = testData.data;
                        }
                    }
                    
                    // Combinăm datele de la toate foile
                    if (typeof combineAllSheetsData === 'function') {
                        combineAllSheetsData();
                    }
                    
                    // Afișăm datele combinate
                    if (combinedData && combinedData.length > 0) {
                        console.log("Inițializare cu date de test:", combinedData.length, "înregistrări");
                        currentSheet = 'all';
                        updateTable(combinedData, 'today');
                        
                        // Actualizăm statisticile
                        updateStats(combinedData, 'all');
                        
                        // Resetăm la prima pagină și afișăm datele
                        currentPage = 1;
                        displayCurrentPage();
                    } else {
                        // Afișăm un mesaj de eroare
                        document.getElementById('table-body').innerHTML = 
                            `<tr><td colspan="8" class="loading-message">Eroare la încărcarea datelor. Vă rugăm reîncărcați pagina sau contactați administratorul.</td></tr>`;
                        
                        displayError(new Error("Nu s-au putut încărca datele prin nicio metodă disponibilă"));
                    }
                }
            }
        });
    }
    
    // Actualizare la fiecare 15 minute
    setInterval(initPage, 15 * 60 * 1000);
}

// Funcție pentru procesarea datelor primite de la API
function processApiDataArray(dataArray) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
        return [];
    }
    
    return dataArray.map(item => {
        // Convertim datele primite într-un format compatibil cu aplicația
        const processedItem = {
            date: item.Data || item.Dată || item.date || new Date().toISOString().split('T')[0],
            weight: safeParseFloat(item.Greutate || item.weight || 0),
            temperature: safeParseFloat(item.Temperatură || item.Temperatura || item.temperature || 0),
            dailyHarvest: safeParseFloat(item.RecoltaZilnică || item["Recolta zilnică"] || item.dailyHarvest || 0),
            totalHarvest: safeParseFloat(item.RecoltaTotală || item["Recolta totală"] || item.totalHarvest || 0),
            battery: safeParseFloat(item.Baterie || item.battery || 0),
            rain: item.Ploaie || item.rain || "Nu",
            // Adăugăm și câmpul dateObj pentru filtrare
            dateObj: new Date(item.Data || item.Dată || item.date || new Date())
        };
        
        return processedItem;
    });
}

// Funcție pentru a încărca un fișier CSV prin proxy pentru a evita CORS
async function fetchCSVViaProxy(url, sheetKey) {
    try {
        // În loc să accesăm direct URL-ul Google Sheets, folosim un proxy CORS
        // Opțiunea 1: Folosim CORS Anywhere (pentru testare)
        // const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        
        // Opțiunea 2: Folosim AllOrigins (mai fiabil)
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        
        // Opțiunea 3: Folosim Web App-ul nostru ca proxy
        // const proxyUrl = `${webAppUrl}?proxy=true&url=`;
        
        const encodedUrl = encodeURIComponent(url);
        const proxiedUrl = proxyUrl + encodedUrl;
        
        console.log(`Încercăm să accesăm ${sheetKey} prin proxy: ${proxiedUrl}`);
        
        const response = await fetch(proxiedUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const csvText = await response.text();
        return parseCSV(csvText, sheetKey);
    } catch (error) {
        console.error(`Eroare la încărcarea foii ${sheetKey} prin proxy:`, error);
        return null;
    }
}

// Funcție pentru a încărca un CSV prin JSONP
async function fetchCSVViaJSONP(url, sheetKey) {
    return new Promise((resolve, reject) => {
        console.log(`Încercare preluare JSONP pentru foaia ${sheetKey}`);
        
        // Creăm un element script pentru cererea JSONP
        const script = document.createElement('script');
        
        // Generăm un nume unic pentru funcția callback
        const callbackName = `jsonp_callback_${Date.now()}_${Math.round(Math.random() * 1000000)}`;
        
        // Definim funcția callback globală
        window[callbackName] = function(data) {
            // Curățăm după ce am primit răspunsul
            document.body.removeChild(script);
            delete window[callbackName];
            
            // Rezolvăm promisiunea cu datele primite
            resolve({
                key: sheetKey,
                data: data
            });
        };
        
        // Adăugăm gestionarea erorilor
        script.onerror = function() {
            // Curățăm în caz de eroare
            document.body.removeChild(script);
            delete window[callbackName];
            
            // Respingem promisiunea
            reject(new Error(`Eroare la încărcarea scriptului JSONP pentru foaia ${sheetKey}`));
        };
        
        // Setăm URL-ul cu parametrul callback
        // Notă: Aceasta este doar o simulare, în realitate serverul trebuie să suporte JSONP
        script.src = `${url}&callback=${callbackName}`;
        
        // Adăugăm scriptul la document pentru a iniția cererea
        document.body.appendChild(script);
    });
}

// Funcție pentru a încărca un fișier CSV prin proxy pentru a evita CORS
async function fetchCSVViaProxy(url, sheetKey) {
    try {
        // În loc să accesăm direct URL-ul Google Sheets, folosim un proxy CORS
        // Opțiunea 1: Folosim CORS Anywhere (pentru testare)
        // const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        
        // Opțiunea 2: Folosim AllOrigins (mai fiabil)
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        
        // Opțiunea 3: Folosim Web App-ul nostru ca proxy
        // const proxyUrl = `${webAppUrl}?proxy=true&url=`;
        
        const encodedUrl = encodeURIComponent(url);
        const proxiedUrl = proxyUrl + encodedUrl;
        
        console.log(`Încercăm să accesăm ${sheetKey} prin proxy: ${proxiedUrl}`);
        
        const response = await fetch(proxiedUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const csvText = await response.text();
        return parseCSV(csvText, sheetKey);
    } catch (error) {
        console.error(`Eroare la încărcarea foii ${sheetKey} prin proxy:`, error);
        return null;
    }
}

// Funcție pentru a încerca toate metodele disponibile pentru a încărca un CSV
async function fetchSheetDataWithFallback(url, sheetKey) {
    try {
        // Încercăm mai întâi metoda directă
        console.log(`Încercăm să încărcăm ${sheetKey} direct...`);
        const directData = await fetchDirectly(url, sheetKey).catch(e => null);
        
        if (directData) {
            console.log(`Date încărcate cu succes direct pentru ${sheetKey}`);
            return directData;
        }
        
        // Dacă metoda directă eșuează, încercăm prin proxy
        console.log(`Încercăm să încărcăm ${sheetKey} prin proxy...`);
        const proxyData = await fetchCSVViaProxy(url, sheetKey).catch(e => null);
        
        if (proxyData) {
            console.log(`Date încărcate cu succes prin proxy pentru ${sheetKey}`);
            return proxyData;
        }
        
        // Dacă și proxy-ul eșuează, încercăm JSONP
        console.log(`Încercăm să încărcăm ${sheetKey} prin JSONP...`);
        const jsonpData = await fetchCSVViaJSONP(url, sheetKey).catch(e => null);
        
        if (jsonpData) {
            console.log(`Date încărcate cu succes prin JSONP pentru ${sheetKey}`);
            return jsonpData;
        }
        
        // Dacă toate metodele eșuează, încărcăm date de test pentru acest stup
        console.log(`Toate metodele au eșuat pentru ${sheetKey}, folosim date de test`);
        return generateTestData(sheetKey);
    } catch (error) {
        console.error(`Toate metodele de încărcare au eșuat pentru ${sheetKey}:`, error);
        return generateTestData(sheetKey);
    }
}

// Funcție pentru a genera date de test pentru un stup specific
function generateTestData(sheetKey) {
    console.log(`Generăm date de test pentru ${sheetKey}`);
    
    const today = new Date();
    const data = [];
    
    // Generăm 30 de zile de date de test
    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        
        // Generăm valori aleatorii pentru simulare
        const weight = 50 + Math.random() * 10; // 50-60kg
        const temperature = 20 + Math.random() * 15; // 20-35°C
        const dailyHarvest = Math.random() < 0.7 ? Math.random() * 0.5 : -Math.random() * 0.2; // Majoritatea zilelor pozitive
        const battery = 3.5 + Math.random() * 1; // 3.5-4.5V
        const rain = Math.random() < 0.2 ? "Da" : "Nu"; // 20% șanse de ploaie
        
        // Calculăm recolta totală
        let totalHarvest = 0;
        for (let j = data.length - 1; j >= 0; j--) {
            if (data[j].dailyHarvest > 0) {
                totalHarvest += parseFloat(data[j].dailyHarvest);
            }
        }
        totalHarvest += dailyHarvest > 0 ? dailyHarvest : 0;
        
        data.push({
            date: date.toISOString().split('T')[0],
            dateObj: date,
            weight: weight.toFixed(2),
            temperature: temperature.toFixed(1),
            dailyHarvest: dailyHarvest.toFixed(2),
            totalHarvest: totalHarvest.toFixed(2),
            battery: battery.toFixed(2),
            rain: rain,
            source: `demo-${sheetKey}`
        });
    }
    
    return {
        key: sheetKey,
        data: data
    };
}

// Funcție pentru preluarea directă a datelor CSV
async function fetchDirectly(url, sheetKey) {
    try {
        console.log(`Încercare preluare directă pentru foaia ${sheetKey} de la URL: ${url}`);
        
        // Adăugăm un timestamp pentru a evita cache-ul
        const timestampedUrl = `${url}${url.includes('?') ? '&' : '?'}timestamp=${Date.now()}`;
        
        // Eliminăm headerele care cauzează eroarea CORS
        const response = await fetch(timestampedUrl, {
            method: 'GET',
            // Nu mai setăm headere personalizate care ar putea cauza erori CORS
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const csvText = await response.text();
        
        // Parsăm CSV-ul și returnăm datele
        const parsedData = parseCSV(csvText, sheetKey);
        
        return {
            key: sheetKey,
            data: parsedData
        };
    } catch (error) {
        console.error(`Eroare la preluarea directă pentru foaia ${sheetKey}:`, error);
        throw error;
    }
}

// Funcție pentru a face cereri către Web App API cu JSONP pentru compatibilitate CORS
function fetchDataFromWebApp(callback) {
    console.log("Încercăm să preluăm datele direct de la Web App folosind JSONP...");
    
    // Creăm un element script pentru cererea JSONP
    const script = document.createElement('script');
    
    // Definim o funcție globală care va fi apelată de răspunsul JSONP
    window.handleWebAppResponse = function(data) {
        console.log("Am primit răspuns de la Web App:", data);
        callback(data);
        // Curățăm după ce am primit răspunsul
        document.body.removeChild(script);
        delete window.handleWebAppResponse;
    };
    
    // Adăugăm gestionarea erorilor
    script.onerror = function() {
        console.error("Eroare la încărcarea scriptului JSONP pentru Web App");
        callback(null);
        document.body.removeChild(script);
        delete window.handleWebAppResponse;
    };
    
    // Setăm URL-ul cu parametrul callback
    script.src = `${webAppUrl}?callback=handleWebAppResponse`;
    
    // Adăugăm scriptul la document pentru a iniția cererea
    document.body.appendChild(script);
}

// Actualizăm pagina periodic
window.onload = function() {
    initPage();
};