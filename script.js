// --- VARIABEL KONSTANTA DAN GLOBAL ---
const DEVICES = {
    lightLiving: { power: 12, smartPower: 9, name: 'Lampu Tamu' },
    lightBedroom: { power: 12, smartPower: 9, name: 'Lampu Kamar' },
    lightKitchen: { power: 15, smartPower: 11, name: 'Lampu Dapur' },
    tv: { power: 80, standby: 2, smartPower: 60, name: 'Smart TV' },
    ac: { power: 800, smartPower: 650, name: 'AC' },
    fan: { power: 55, smartPower: 40, name: 'Kipas' },
    heater: { power: 1100, smartPower: 900, name: 'Heater' },
    fridge: { power: 100, smartPower: 100, name: 'Kulkas' },
    router: { power: 8, smartPower: 8, name: 'Router' }
};

const SMART_SCHEDULES = [
    { time: 6, devices: ['lightKitchen'], description: 'Lampu dapur ON' },
    { time: 7, devices: ['lightLiving', 'heater'], description: 'Heater ON (mandi)' },
    { time: 8, devices: ['heater'], off: true, description: 'Heater OFF' },
    { time: 18, devices: ['lightLiving', 'lightKitchen'], description: 'Lampu ON (sore)' },
    { time: 19, devices: ['tv'], description: 'TV ON' },
    { time: 22, devices: ['lightLiving', 'lightKitchen', 'tv'], off: true, description: 'Matikan kecuali kamar' },
    { time: 23, devices: ['lightBedroom'], off: true, description: 'Semua lampu OFF' }
];

const ELECTRICITY_RATE = 1444; 
const VA_CAPACITY = 2200; 

let isSmartMode = false;
let currentHour = 12;
let simulationTime = 0;
let manualConsumption = 0;
let smartConsumption = 0;
let currentPower = 0;
let ambientTemp = 28;
let baseAmbientTemp = 28;
let isSimulationRunning = false;
let simulationInterval;
let manualOverrides = {}; // Objek untuk menyimpan kunci manual (device: timestamp)
const OVERRIDE_DURATION = 60 * 5; // Durasi kunci manual: 5 menit (dalam detik simulasi)

const SIM_INTERVAL_MS = 100;
const TIME_STEP = SIM_INTERVAL_MS / 1000; 

let deviceStates = {
    lightLiving: false,
    lightBedroom: false,
    lightKitchen: false,
    tv: 'standby',
    ac: false,
    fan: false,
    heater: false,
    fridge: true,
    router: true
};

// --- ELEMEN DOM ---
const modeToggle = document.getElementById('mode-toggle');
const roomArea = document.getElementById('room-area');
const timeSlider = document.getElementById('time-slider');
const currentTimeEl = document.getElementById('current-time');
const timePeriodEl = document.getElementById('time-period');
const timeIconEl = document.getElementById('time-icon');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');
const roomTemp = document.getElementById('room-temp');
const currentPowerEl = document.getElementById('current-power');
const smartScheduleEl = document.getElementById('smart-schedule');
const toggleSimButton = document.getElementById('toggle-sim-control');
const guideModal = document.getElementById('guide-modal');
const openGuideButton = document.getElementById('open-guide-modal');
const closeGuideButton = document.getElementById('close-guide-modal');
const infoModal = document.getElementById('info-modal');
const openInfoFromGuideButton = document.getElementById('open-info-modal-from-guide');
const closeInfoButton = document.getElementById('close-info-modal');
const devicePowerTableBody = document.getElementById('device-power-table');
const smartScheduleInfoEl = document.getElementById('smart-schedule-info');


// --- FUNGSI UTAMA DAN EVENT LISTENER ---

function init() {
    setupEventListeners();
    updateTimeOfDay();
    renderSmartSchedule();
    updateAllDevices();
}

function setupEventListeners() {
    modeToggle.addEventListener('click', toggleMode);
    timeSlider.addEventListener('input', handleTimeChange);
    
    document.getElementById('reset-simulation').addEventListener('click', resetSimulation);
    toggleSimButton.addEventListener('click', toggleSimulation);

    // --- PERBAIKAN: MENGHAPUS KUNCI isSmartMode DARI PERANGKAT ---
    
    // Perangkat Lampu
    ['light-living', 'light-bedroom', 'light-kitchen'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => {
            const deviceId = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            deviceStates[deviceId] = !deviceStates[deviceId];
            updateDevice(deviceId); // updateDevice sekarang menangani logika override
        });
    });

    // Perangkat TV
    document.getElementById('tv-device').addEventListener('click', () => {
        if (deviceStates.tv === 'off') deviceStates.tv = 'standby';
        else if (deviceStates.tv === 'standby') deviceStates.tv = 'on';
        else deviceStates.tv = 'off';
        updateDevice('tv');
    });

    // Perangkat Suhu (AC, Kipas, Heater)
    ['ac', 'fan', 'heater'].forEach(id => {
        document.getElementById(id + '-device').addEventListener('click', () => {
            deviceStates[id] = !deviceStates[id];
            updateDevice(id);
        });
    });
    
    // LISTENER MODAL
    openGuideButton.addEventListener('click', () => { guideModal.classList.remove('hidden'); });
    closeGuideButton.addEventListener('click', () => { guideModal.classList.add('hidden'); });
    guideModal.addEventListener('click', (e) => {
        if (e.target === guideModal) { guideModal.classList.add('hidden'); }
    });

    openInfoFromGuideButton.addEventListener('click', () => {
        guideModal.classList.add('hidden'); 
        renderInfoModalContent();
        infoModal.classList.remove('hidden');
    });
    
    closeInfoButton.addEventListener('click', () => { infoModal.classList.add('hidden'); });
    infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) { infoModal.classList.add('hidden'); }
    });
}

function toggleSimulation() {
    isSimulationRunning = !isSimulationRunning;
    
    if (isSimulationRunning) {
        simulationInterval = setInterval(runSimulationStep, SIM_INTERVAL_MS);
        toggleSimButton.textContent = '⏸ Jeda';
        toggleSimButton.classList.remove('bg-blue-600');
        toggleSimButton.classList.add('bg-orange-600');
    } else {
        clearInterval(simulationInterval);
        toggleSimButton.textContent = '▶ Lanjutkan';
        toggleSimButton.classList.remove('bg-orange-600');
        toggleSimButton.classList.add('bg-blue-600');
    }
}

function resetSimulation() {
    if (isSimulationRunning) {
        toggleSimulation();
    }
    
    simulationTime = 0;
    manualConsumption = 0;
    smartConsumption = 0;
    manualOverrides = {}; // Reset overrides
    
    toggleSimButton.textContent = '▶ Mulai'; 
    toggleSimButton.classList.remove('bg-orange-600');
    toggleSimButton.classList.add('bg-blue-600');
    
    document.getElementById('simulation-time').textContent = '0 detik';
    document.getElementById('manual-consumption').textContent = '0.000';
    document.getElementById('smart-consumption').textContent = '0.000';
    document.getElementById('saving-percentage').textContent = '0.0%';
    document.getElementById('saved-kwh').textContent = '0.000 kWh';
    document.getElementById('manual-cost').textContent = formatRupiah(0);
    document.getElementById('smart-cost').textContent = formatRupiah(0);
    document.getElementById('saved-cost').textContent = formatRupiah(0);
}

function toggleMode() {
    isSmartMode = !isSmartMode;
    modeToggle.classList.toggle('smart');
    
    if (isSmartMode) {
        roomArea.classList.remove('manual-mode');
        roomArea.classList.add('smart-mode');
        document.getElementById('mode-label-manual').classList.add('opacity-50');
        document.getElementById('mode-label-smart').classList.remove('opacity-50');
        document.getElementById('mode-description').textContent = 'Mode Smart: Automasi berdasarkan jadwal (Manual Override Aktif)';
        applySmartSchedule();
    } else {
        roomArea.classList.remove('smart-mode');
        roomArea.classList.add('manual-mode');
        document.getElementById('mode-label-manual').classList.remove('opacity-50');
        document.getElementById('mode-label-smart').classList.add('opacity-50');
        document.getElementById('mode-description').textContent = 'Klik perangkat untuk kontrol manual';
        manualOverrides = {}; // Bersihkan overrides saat kembali ke Manual
    }
    
    updateAllDevices();
}

function handleTimeChange(e) {
    currentHour = parseInt(e.target.value);
    updateTimeOfDay();
    if (isSmartMode) {
        applySmartSchedule();
    }
}

function updateTimeOfDay() {
    const hour = currentHour;
    currentTimeEl.textContent = `${hour.toString().padStart(2, '0')}:00`;
    
    roomArea.classList.remove('night', 'day', 'evening');
    
    if (hour >= 6 && hour < 11) {
        timePeriodEl.textContent = 'Pagi Sejuk';
        timeIconEl.textContent = '🌅';
        roomArea.classList.add('day');
        sunIcon.style.opacity = '1';
        moonIcon.style.opacity = '0';
        baseAmbientTemp = 19 + (hour - 6) * 1.5;
    } else if (hour >= 11 && hour < 15) {
        timePeriodEl.textContent = 'Siang Panas';
        timeIconEl.textContent = '☀️';
        roomArea.classList.add('day');
        sunIcon.style.opacity = '1';
        moonIcon.style.opacity = '0';
        baseAmbientTemp = 28 + (hour - 11) * 0.4;
    } else if (hour >= 15 && hour < 18) {
        timePeriodEl.textContent = 'Sore Mendung';
        timeIconEl.textContent = '🌤️';
        roomArea.classList.add('evening');
        sunIcon.style.opacity = '0.7';
        moonIcon.style.opacity = '0';
        baseAmbientTemp = 30 - (hour - 15) * 2;
    } else if (hour >= 18 && hour < 21) {
        timePeriodEl.textContent = 'Petang Dingin';
        timeIconEl.textContent = '🌆';
        roomArea.classList.add('evening');
        sunIcon.style.opacity = '0.3';
        moonIcon.style.opacity = '0.3';
        baseAmbientTemp = 24 - (hour - 18) * 0.6;
    } else {
        timePeriodEl.textContent = 'Malam Sejuk';
        timeIconEl.textContent = '🌙';
        roomArea.classList.add('night');
        sunIcon.style.opacity = '0';
        moonIcon.style.opacity = '1';
        if (hour >= 21) {
            baseAmbientTemp = 22 - (hour - 21) * 0.15;
        } else {
            baseAmbientTemp = 21.4 - (hour * 0.2);
        }
    }
    
    ambientTemp = baseAmbientTemp;
    updateTemperature();
    
    if (isSmartMode) {
        applySmartTemperatureControl();
    }
}

function updateTemperature() {
    let displayTemp = ambientTemp;
    
    if (deviceStates.heater) {
        displayTemp += 2;
    }
    
    if (deviceStates.ac) {
        displayTemp = isSmartMode ? 24 : 22;
    }
    
    roomTemp.textContent = Math.round(displayTemp) + '°C';
}

// FUNGSI UNTUK MEMERIKSA APAKAH PERANGKAT DI-OVERRIDE
const isDeviceOverridden = (deviceId) => {
    return manualOverrides[deviceId] && (simulationTime - manualOverrides[deviceId]) < OVERRIDE_DURATION;
};

function applySmartTemperatureControl() {
    const TEMP_THRESHOLD_HIGH = 28;
    const TEMP_THRESHOLD_LOW = 20;
    
    // --- KONTROL AC (Hanya jika tidak di-override) ---
    if (!isDeviceOverridden('ac')) {
        if (ambientTemp >= TEMP_THRESHOLD_HIGH) {
            if (!deviceStates.ac) {
                deviceStates.ac = true;
                updateDevice('ac');
            }
        } else if (ambientTemp < TEMP_THRESHOLD_HIGH - 2) {
            if (deviceStates.ac) {
                deviceStates.ac = false;
                updateDevice('ac');
            }
        }
    }
    
    // --- KONTROL KIPAS (Hanya jika tidak di-override) ---
    if (!isDeviceOverridden('fan')) {
        if (ambientTemp >= TEMP_THRESHOLD_HIGH) {
            if (!deviceStates.fan && currentHour >= 9 && currentHour < 22) {
                deviceStates.fan = true;
                updateDevice('fan');
            }
        } else if (ambientTemp < TEMP_THRESHOLD_HIGH - 2) {
            if (deviceStates.fan && currentHour >= 9 && currentHour < 22) {
                deviceStates.fan = false;
                updateDevice('fan');
            }
        }
    }
    
    // --- KONTROL HEATER (Hanya jika tidak di-override) ---
    if (!isDeviceOverridden('heater')) {
        if (ambientTemp < TEMP_THRESHOLD_LOW) {
            if (!deviceStates.heater && currentHour >= 7 && currentHour < 8) {
                deviceStates.heater = true;
                updateDevice('heater');
            }
        } else {
            if (deviceStates.heater) {
                deviceStates.heater = false;
                updateDevice('heater');
            }
        }
    }
}

function renderSmartSchedule() {
    smartScheduleEl.innerHTML = '';
    
    SMART_SCHEDULES.sort((a, b) => a.time - b.time).forEach(schedule => {
        const div = document.createElement('div');
        div.className = 'schedule-item';
        div.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="font-semibold">${schedule.time.toString().padStart(2, '0')}:00</span>
                <span class="text-gray-400">${schedule.description}</span>
            </div>
        `;
        
        if (isSmartMode && currentHour === schedule.time) {
            div.classList.add('active');
        }
        
        smartScheduleEl.appendChild(div);
    });
}

function applySmartSchedule() {
    const scheduleSnapshot = {};
    
    SMART_SCHEDULES.forEach(schedule => {
        if (currentHour >= schedule.time) {
            schedule.devices.forEach(deviceId => {
                if (schedule.off) {
                    scheduleSnapshot[deviceId] = false;
                    if (deviceId === 'tv') scheduleSnapshot[deviceId] = 'off';
                } else {
                    scheduleSnapshot[deviceId] = true;
                    if (deviceId === 'tv') scheduleSnapshot[deviceId] = 'on';
                }
            });
        }
    });
    
    // --- PERBAIKAN: JANGAN TIMPA JIKA ADA OVERRIDE MANUAL ---
    Object.keys(deviceStates).forEach(deviceId => {
        if (!isDeviceOverridden(deviceId)) { 
            if (scheduleSnapshot.hasOwnProperty(deviceId)) {
                deviceStates[deviceId] = scheduleSnapshot[deviceId];
            }
        }
    });
    
    // Logika penyesuaian waktu (jika tidak ada di scheduleSnapshot, gunakan logika ini)
    if (!isDeviceOverridden('lightLiving') && !isDeviceOverridden('lightKitchen') && !isDeviceOverridden('lightBedroom') && !isDeviceOverridden('fan') && !isDeviceOverridden('tv')) {
        if (currentHour >= 18 || currentHour < 7) {
            if (currentHour >= 23 || currentHour < 6) {
                deviceStates.lightLiving = false;
                deviceStates.lightKitchen = false;
                deviceStates.lightBedroom = false;
                deviceStates.fan = false;
                deviceStates.tv = 'off';
            } else if (currentHour >= 22) {
                deviceStates.lightLiving = false;
                deviceStates.lightKitchen = false;
            } else if (currentHour >= 18) {
                deviceStates.lightLiving = true;
                deviceStates.lightKitchen = true;
                deviceStates.lightBedroom = true
            }
        } else if (currentHour >= 7 && currentHour < 18) {
            deviceStates.lightLiving = false;
            deviceStates.lightBedroom = false;
        }
        
        if (currentHour === 6) {
            deviceStates.lightKitchen = true;
        }
    }
    
    // Heater sudah ditangani oleh applySmartTemperatureControl
    
    applySmartTemperatureControl();
    
    updateAllDevices();
    renderSmartSchedule();
}

function updateDevice(deviceId) {
    // --- PERBAIKAN: SET OVERRIDE HANYA JIKA KLIK DILAKUKAN DI MODE SMART ---
    if (isSmartMode) {
        manualOverrides[deviceId] = simulationTime; 
    }
    // --- AKHIR PERBAIKAN ---

    const device = DEVICES[deviceId];
    const state = deviceStates[deviceId];
    
    if (deviceId.startsWith('light')) {
        const elementId = deviceId.replace(/([A-Z])/g, '-$1').toLowerCase();
        const element = document.getElementById(elementId);
        const icon = element.querySelector('.device-icon');
        const status = element.querySelector('.light-status');
        const powerBar = element.querySelector('.power-bar-fill');
        const powerText = element.querySelector('.light-power');
        
        if (state) {
            icon.classList.add('light-on');
            element.classList.add('active');
            status.textContent = 'Menyala';
            status.classList.add('text-yellow-400');
            status.classList.remove('text-gray-400');
            powerBar.style.width = '100%';
            powerText.textContent = isSmartMode ? device.smartPower : device.power;
        } else {
            icon.classList.remove('light-on');
            element.classList.remove('active');
            status.textContent = 'Mati';
            status.classList.remove('text-yellow-400');
            status.classList.add('text-gray-400');
            powerBar.style.width = '0%';
            powerText.textContent = '0';
        }
    }
    
    if (deviceId === 'tv') {
        const icon = document.getElementById('tv-icon');
        const status = document.getElementById('tv-status');
        const powerBar = document.getElementById('tv-power-bar');
        const powerText = document.getElementById('tv-power');
        const element = document.getElementById('tv-device');
        
        if (state === 'on') {
            icon.classList.add('tv-on');
            element.classList.add('active');
            status.textContent = 'Aktif';
            status.classList.add('text-blue-400');
            status.classList.remove('text-gray-400');
            powerBar.style.width = '100%';
            powerText.textContent = isSmartMode ? device.smartPower : device.power;
        } else if (state === 'standby') {
            icon.classList.remove('tv-on');
            element.classList.remove('active');
            status.textContent = 'Standby';
            status.classList.remove('text-blue-400');
            status.classList.add('text-gray-400');
            powerBar.style.width = '10%';
            powerText.textContent = device.standby;
        } else {
            icon.classList.remove('tv-on');
            element.classList.remove('active');
            status.textContent = 'Mati';
            status.classList.remove('text-blue-400');
            status.classList.add('text-gray-400');
            powerBar.style.width = '0%';
            powerText.textContent = '0';
        }
    }
    
    if (deviceId === 'ac') {
        const icon = document.getElementById('ac-icon');
        const status = document.getElementById('ac-status');
        const powerBar = document.getElementById('ac-power-bar');
        const powerText = document.getElementById('ac-power');
        const element = document.getElementById('ac-device');
        
        if (state) {
            icon.classList.add('ac-active');
            element.classList.add('active');
            if (isSmartMode) {
                status.textContent = 'Efisien';
                status.classList.add('text-green-400');
                status.classList.remove('text-red-400', 'text-gray-400');
                powerBar.style.width = '70%';
                powerText.textContent = device.smartPower;
            } else {
                status.textContent = 'Penuh';
                status.classList.add('text-red-400');
                status.classList.remove('text-green-400', 'text-gray-400');
                powerBar.style.width = '100%';
                powerText.textContent = device.power;
            }
        } else {
            icon.classList.remove('ac-active');
            element.classList.remove('active');
            status.textContent = 'Mati';
            status.classList.remove('text-green-400', 'text-red-400');
            status.classList.add('text-gray-400');
            powerBar.style.width = '0%';
            powerText.textContent = '0';
        }
    }
    
    if (deviceId === 'fan') {
        const icon = document.getElementById('fan-icon');
        const status = document.getElementById('fan-status');
        const powerBar = document.getElementById('fan-power-bar');
        const powerText = document.getElementById('fan-power');
        const element = document.getElementById('fan-device');
        
        if (state) {
            icon.classList.add('fan-on');
            element.classList.add('active');
            status.textContent = 'Aktif';
            status.classList.add('text-blue-300');
            status.classList.remove('text-gray-400');
            powerBar.style.width = '70%';
            powerText.textContent = isSmartMode ? device.smartPower : device.power;
        } else {
            icon.classList.remove('fan-on');
            element.classList.remove('active');
            status.textContent = 'Mati';
            status.classList.remove('text-blue-300');
            status.classList.add('text-gray-400');
            powerBar.style.width = '0%';
            powerText.textContent = '0';
        }
    }
    
    if (deviceId === 'heater') {
        const icon = document.getElementById('heater-icon');
        const status = document.getElementById('heater-status');
        const powerBar = document.getElementById('heater-power-bar');
        const powerText = document.getElementById('heater-power');
        const element = document.getElementById('heater-device');
        
        if (state) {
            icon.classList.add('heater-on');
            element.classList.add('active');
            status.textContent = isSmartMode ? 'Hemat' : 'Aktif';
            status.classList.add('text-red-400');
            status.classList.remove('text-gray-400');
            powerBar.style.width = isSmartMode ? '73%' : '100%';
            powerText.textContent = isSmartMode ? device.smartPower : device.power;
        } else {
            icon.classList.remove('heater-on');
            element.classList.remove('active');
            status.textContent = 'Mati';
            status.classList.remove('text-red-400');
            status.classList.add('text-gray-400');
            powerBar.style.width = '0%';
            powerText.textContent = '0';
        }
    }
    
    calculateCurrentPower();
    updateActiveDevicesList();
    updateTemperature();
}

function updateAllDevices() {
    Object.keys(deviceStates).forEach(deviceId => {
        updateDevice(deviceId);
    });
}

function calculateCurrentPower() {
    let total = 0;
    
    Object.keys(deviceStates).forEach(deviceId => {
        const device = DEVICES[deviceId];
        const state = deviceStates[deviceId];
        
        if (deviceId.startsWith('light')) {
            if (state) total += isSmartMode ? device.smartPower : device.power;
        } else if (deviceId === 'tv') {
            if (state === 'on') total += isSmartMode ? device.smartPower : device.power;
            else if (state === 'standby') total += device.standby;
        } else if (state) {
            total += isSmartMode ? device.smartPower : device.power;
        }
    });
    
    currentPower = total;
    currentPowerEl.textContent = Math.round(total) + ' W';
}

function updateActiveDevicesList() {
    let html = '';
    
    Object.keys(deviceStates).forEach(deviceId => {
        const device = DEVICES[deviceId];
        const state = deviceStates[deviceId];
        
        let power = 0;
        let isActive = false;
        
        if (deviceId.startsWith('light')) {
            if (state) {
                power = isSmartMode ? device.smartPower : device.power;
                isActive = true;
            }
        } else if (deviceId === 'tv') {
            if (state === 'on') {
                power = isSmartMode ? device.smartPower : device.power;
                isActive = true;
            } else if (state === 'standby') {
                power = device.standby;
                html += `<div>📺 ${device.name}: ${power}W <span class="text-yellow-500">(Standby)</span></div>`;
                return;
            }
        } else if (state) {
            power = isSmartMode ? device.smartPower : device.power;
            isActive = true;
        }
        
        if (isActive) {
            const icon = getDeviceIcon(deviceId);
            html += `<div>${icon} ${device.name}: ${Math.round(power)}W</div>`;
        }
    });
    
    if (html === '') {
        html = '<div class="text-gray-500">Hanya perangkat standby</div>';
    }
    
    document.getElementById('active-devices').innerHTML = html;
}

function getDeviceIcon(deviceId) {
    const icons = {
        lightLiving: '💡', lightBedroom: '💡', lightKitchen: '💡',
        tv: '📺', ac: '❄️', fan: '🌀', heater: '♨️',
        fridge: '🧊', router: '📡'
    };
    return icons[deviceId] || '⚡';
}

function renderInfoModalContent() {
    // 1. Isi Tabel Nilai Daya Perangkat
    let tableHtml = '';
    Object.keys(DEVICES).forEach(deviceId => {
        const device = DEVICES[deviceId];
        const manualPower = device.power || device.standby || 0;
        const smartPower = device.smartPower || device.standby || 0;
        const potentialSaving = manualPower > smartPower ? (manualPower - smartPower) : 0;
        const savingPercentage = manualPower > 0 ? (potentialSaving / manualPower * 100).toFixed(0) : 0;

        tableHtml += `
            <tr class="bg-gray-800 border-b border-gray-700">
                <th scope="row" class="px-3 py-2 font-medium text-white">${device.name}</th>
                <td class="px-3 py-2 text-center text-red-400">${manualPower}</td>
                <td class="px-3 py-2 text-center text-green-400">${smartPower}</td>
                <td class="px-3 py-2 text-center text-blue-300">${savingPercentage}%</td>
            </tr>
        `;
    });
    devicePowerTableBody.innerHTML = tableHtml;

    // 2. Isi Jadwal Smart
    let scheduleHtml = '';
    SMART_SCHEDULES.sort((a, b) => a.time - b.time).forEach(schedule => {
        scheduleHtml += `
            <div class="flex justify-between items-center text-gray-300">
                <span class="font-bold text-yellow-300">${schedule.time.toString().padStart(2, '0')}:00</span>
                <span class="text-sm">${schedule.description}</span>
            </div>
        `;
    });
    smartScheduleInfoEl.innerHTML = scheduleHtml;
}

function formatRupiah(amount) {
    if (amount < 0) return '- ' + formatRupiah(Math.abs(amount));
    const formatted = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `Rp ${formatted}`;
}

function runSimulationStep() {
    simulationTime += TIME_STEP;
    
    const currentPowerW = currentPower; 
    const currentRateKWh = (currentPowerW / 1000) * (TIME_STEP / 3600); 
    
    // --- LOGIKA KONSUMSI RIIL ---
    if (isSmartMode) {
        smartConsumption += currentRateKWh;
    } else {
        manualConsumption += currentRateKWh;
    }
    
    // 1. Perbarui Waktu
    if (simulationTime % 1 < TIME_STEP) { 
        document.getElementById('simulation-time').textContent = Math.round(simulationTime) + ' detik';
    }

    // 2. Perbarui Konsumsi kWh
    document.getElementById('manual-consumption').textContent = (manualConsumption).toFixed(3);
    document.getElementById('smart-consumption').textContent = (smartConsumption).toFixed(3);

    // 3. Perhitungan Biaya
    const manualCost = manualConsumption * ELECTRICITY_RATE;
    const smartCost = smartConsumption * ELECTRICITY_RATE;

    // 4. Perbarui Biaya
    document.getElementById('manual-cost').textContent = formatRupiah(manualCost);
    document.getElementById('smart-cost').textContent = formatRupiah(smartCost);
    
    // 5. LOGIKA PENGHEMATAN
    let savingPercentage = 0.0;
    let savedKWh = 0.0;
    let savedCost = 0;
    
    if (manualConsumption > 0) {
        savedKWh = manualConsumption - smartConsumption;
        
        if (savedKWh > 0) {
            savingPercentage = (savedKWh / manualConsumption) * 100;
            savedCost = manualCost - smartCost;
        }
    }
    
    document.getElementById('saving-percentage').textContent = savingPercentage.toFixed(1) + '%';
    document.getElementById('saved-kwh').textContent = savedKWh.toFixed(3) + ' kWh';
    document.getElementById('saved-cost').textContent = formatRupiah(savedCost);

    // 6. Kontrol Smart
    if (isSmartMode && simulationTime % 5 < TIME_STEP) { 
        applySmartTemperatureControl();
    }
}

init();