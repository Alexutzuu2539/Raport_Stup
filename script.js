// Configurare pentru conectarea la Google Sheets
const PUBLISHED_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQnbQPo-Mr3dghu2nMDTAPmI_gecKNthE8YrD-Gss9LcIc6D4rCGVp_ZQI5PfoA-ELmYyCTADZFzrKL/pub?output=csv';

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
        
        return { headers, rows: dataRows };
    } catch (error) {
        console.error('Eroare la preluarea datelor:', error);
        document.getElementById('table-body').innerHTML = 
            `<tr><td colspan="7" class="loading-message">Eroare la încărcarea datelor: ${error.message}</td></tr>`;
        return null;
    }
}

// Funcția pentru a actualiza tabelul HTML
function updateTable(data) {
    if (!data) return;
    
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    
    // Adăugăm rândurile în ordine inversă (cele mai recente primele)
    const reversedRows = [...data.rows].reverse();
    
    // Limităm la maxim 50 de rânduri pentru performanță
    const rowsToShow = reversedRows.slice(0, 50);
    
    rowsToShow.forEach(row => {
        const tr = document.createElement('tr');
        
        // Formatarea datei
        const dateCell = document.createElement('td');
        let dateValue = row[0];
        try {
            // Încercăm să formatăm data dacă este în format corespunzător
            const date = new Date(dateValue);
            if (!isNaN(date)) {
                dateValue = date.toLocaleString('ro-RO');
            }
        } catch (e) {
            // Dacă nu se poate formata, folosim valoarea originală
        }
        dateCell.textContent = dateValue;
        tr.appendChild(dateCell);
        
        // Greutate
        const weightCell = document.createElement('td');
        weightCell.textContent = parseFloat(row[1]).toFixed(2) + ' kg';
        tr.appendChild(weightCell);
        
        // Temperatură
        const tempCell = document.createElement('td');
        tempCell.textContent = parseFloat(row[2]).toFixed(1) + ' °C';
        tr.appendChild(tempCell);
        
        // Diferență (cu culoare)
        const diffCell = document.createElement('td');
        const diff = parseFloat(row[3]);
        diffCell.textContent = diff.toFixed(2) + ' kg';
        diffCell.className = diff >= 0 ? 'positive' : 'negative';
        tr.appendChild(diffCell);
        
        // Total recoltă
        const harvestCell = document.createElement('td');
        harvestCell.textContent = parseFloat(row[4]).toFixed(2) + ' kg';
        tr.appendChild(harvestCell);
        
        // Baterie
        const batteryCell = document.createElement('td');
        batteryCell.textContent = parseFloat(row[5]).toFixed(1) + ' V';
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
}

// Funcția pentru a actualiza statisticile din dashboard
function updateStats(data) {
    if (!data || data.rows.length === 0) return;
    
    // Ultima înregistrare (cea mai recentă)
    const lastRow = data.rows[data.rows.length - 1];
    
    // Formatează data
    let lastDate = lastRow[0];
    try {
        const date = new Date(lastDate);
        if (!isNaN(date)) {
            lastDate = date.toLocaleString('ro-RO');
        }
    } catch (e) {
        // Folosim valoarea originală dacă nu se poate formata
    }
    document.getElementById('last-update').textContent = lastDate;
    
    // Greutate curentă
    document.getElementById('current-weight').textContent = parseFloat(lastRow[1]).toFixed(2) + ' kg';
    
    // Temperatură curentă
    document.getElementById('current-temp').textContent = parseFloat(lastRow[2]).toFixed(1) + ' °C';
    
    // Total recoltă
    document.getElementById('total-harvest').textContent = parseFloat(lastRow[4]).toFixed(2) + ' kg';
    
    // Baterie
    document.getElementById('battery-level').textContent = parseFloat(lastRow[5]).toFixed(1) + ' V';
    
    // Ploaie
    document.getElementById('rain-status').textContent = lastRow[6];
}

// Inițializarea paginii
async function initPage() {
    // Setăm anul curent în footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Curățăm elementele vechi care ar putea fi în cache
    cleanupOldChartElements();
    
    // Preluăm și afișăm datele
    const data = await fetchSheetData();
    if (data) {
        updateTable(data);
        updateStats(data);
    }
}

// Actualizăm pagina periodic
window.onload = function() {
    initPage();
    
    // Actualizare la fiecare 15 minute
    setInterval(initPage, 15 * 60 * 1000);
}; 