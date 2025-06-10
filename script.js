// Configurare pentru conectarea la Google Sheets
// IMPORTANT: Înlocuiește acest ID cu ID-ul real al foii tale Google Sheets
const SHEET_ID = '2PACX-1vQnbQPo-Mr3dghu2nMDTAPmI_gecKNthE8YrD-Gss9LcIc6D4rCGVp_ZQI5PfoA-ELmYyCTADZFzrKL';
const SHEET_NAME = 'Sheet1';
const SHEET_RANGE = 'A:G';

const PUBLISHED_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQnbQPo-Mr3dghu2nMDTAPmI_gecKNthE8YrD-Gss9LcIc6D4rCGVp_ZQI5PfoA-ELmYyCTADZFzrKL/pubhtml';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQnbQPo-Mr3dghu2nMDTAPmI_gecKNthE8YrD-Gss9LcIc6D4rCGVp_ZQI5PfoA-ELmYyCTADZFzrKL/pub?output=csv';

// Referințe la grafice
let weightChart = null;
let tempChart = null;
let harvestChart = null;
let batteryChart = null;

// Funcția pentru a prelua datele din Google Sheets (format CSV)
async function fetchSheetData() {
    try {
        const response = await fetch(SHEET_URL);
        const text = await response.text();
        
        // Parsare CSV
        const rows = text.split('\n').map(row => row.split(','));
        
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

// Funcția pentru a crea graficul de greutate
function createWeightChart(data) {
    if (!data || data.rows.length === 0) return;
    
    const dates = [];
    const weights = [];
    
    // Obținem ultimele 30 de zile de date pentru claritate
    const recentData = data.rows.slice(-30);
    
    recentData.forEach(row => {
        let date;
        try {
            date = new Date(row[0]);
            if (isNaN(date)) {
                // Dacă data nu este validă, folosim un format simplu de dată
                date = new Date();
            }
        } catch (e) {
            date = new Date();
        }
        
        dates.push(date);
        weights.push(parseFloat(row[1]));
    });
    
    const ctx = document.getElementById('weight-chart').getContext('2d');
    
    // Distrugem graficul existent dacă există
    if (weightChart) {
        weightChart.destroy();
    }
    
    weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Greutate (kg)',
                data: weights,
                borderColor: '#3a5a40',
                backgroundColor: 'rgba(58, 90, 64, 0.1)',
                tension: 0.3,
                fill: true,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'dd/MM'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Data'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Greutate (kg)'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Greutate: ${context.parsed.y.toFixed(2)} kg`;
                        }
                    }
                }
            }
        }
    });
}

// Funcția pentru a crea graficul de temperatură
function createTempChart(data) {
    if (!data || data.rows.length === 0) return;
    
    const dates = [];
    const temps = [];
    
    // Obținem ultimele 30 de zile de date pentru claritate
    const recentData = data.rows.slice(-30);
    
    recentData.forEach(row => {
        let date;
        try {
            date = new Date(row[0]);
            if (isNaN(date)) {
                date = new Date();
            }
        } catch (e) {
            date = new Date();
        }
        
        dates.push(date);
        temps.push(parseFloat(row[2]));
    });
    
    const ctx = document.getElementById('temp-chart').getContext('2d');
    
    // Distrugem graficul existent dacă există
    if (tempChart) {
        tempChart.destroy();
    }
    
    tempChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Temperatură (°C)',
                data: temps,
                borderColor: '#ff6b6b',
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                tension: 0.3,
                fill: true,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'dd/MM'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Data'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Temperatură (°C)'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Temperatură: ${context.parsed.y.toFixed(1)} °C`;
                        }
                    }
                }
            }
        }
    });
}

// Funcția pentru a crea graficul de recoltă
function createHarvestChart(data) {
    if (!data || data.rows.length === 0) return;
    
    const dates = [];
    const harvests = [];
    
    // Obținem ultimele 30 de zile de date pentru claritate
    const recentData = data.rows.slice(-30);
    
    recentData.forEach(row => {
        let date;
        try {
            date = new Date(row[0]);
            if (isNaN(date)) {
                date = new Date();
            }
        } catch (e) {
            date = new Date();
        }
        
        dates.push(date);
        harvests.push(parseFloat(row[4]));
    });
    
    const ctx = document.getElementById('harvest-chart').getContext('2d');
    
    // Distrugem graficul existent dacă există
    if (harvestChart) {
        harvestChart.destroy();
    }
    
    harvestChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Total recoltă (kg)',
                data: harvests,
                borderColor: '#4caf50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.3,
                fill: true,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'dd/MM'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Data'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Total recoltă (kg)'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Recoltă: ${context.parsed.y.toFixed(2)} kg`;
                        }
                    }
                }
            }
        }
    });
}

// Funcția pentru a crea graficul de baterie
function createBatteryChart(data) {
    if (!data || data.rows.length === 0) return;
    
    const dates = [];
    const batteries = [];
    
    // Obținem ultimele 30 de zile de date pentru claritate
    const recentData = data.rows.slice(-30);
    
    recentData.forEach(row => {
        let date;
        try {
            date = new Date(row[0]);
            if (isNaN(date)) {
                date = new Date();
            }
        } catch (e) {
            date = new Date();
        }
        
        dates.push(date);
        batteries.push(parseFloat(row[5]));
    });
    
    const ctx = document.getElementById('battery-chart').getContext('2d');
    
    // Distrugem graficul existent dacă există
    if (batteryChart) {
        batteryChart.destroy();
    }
    
    batteryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Baterie (V)',
                data: batteries,
                borderColor: '#ffa726',
                backgroundColor: 'rgba(255, 167, 38, 0.1)',
                tension: 0.3,
                fill: true,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'dd/MM'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Data'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Baterie (V)'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Baterie: ${context.parsed.y.toFixed(1)} V`;
                        }
                    }
                }
            }
        }
    });
}

// Inițializarea paginii
async function initPage() {
    // Setăm anul curent în footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Preluăm și afișăm datele
    const data = await fetchSheetData();
    if (data) {
        updateTable(data);
        updateStats(data);
        createWeightChart(data);
        createTempChart(data);
        createHarvestChart(data);
        createBatteryChart(data);
    }
}

// Actualizăm pagina periodic
window.onload = function() {
    initPage();
    
    // Actualizare la fiecare 15 minute
    setInterval(initPage, 15 * 60 * 1000);
}; 