const DEVICES = {
        lightLiving: { power: 12, smartPower: 9, name: 'Lampu Tamu' },
        lightBedroom: { power: 12, smartPower: 9, name: 'Lampu Kamar' },
        lightKitchen: { power: 15, smartPower: 11, name: 'Lampu Dapur' },
        tv: { power: 80, standby: 2, smartPower: 60, name: 'Smart TV' },
        ac: { power: 1200, smartPower: 850, name: 'AC' },
        fan: { power: 55, smartPower: 40, name: 'Kipas' },
        heater: { power: 1500, smartPower: 1100, name: 'Heater' },
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

    let isSmartMode = false;
    let currentHour = 12;
    let simulationTime = 0;
    let manualConsumption = 0;
    let smartConsumption = 0;
    let manualEnergyTotal = 0;
    let smartEnergyTotal = 0;
    let currentPower = 0;
    let ambientTemp = 28;
    let baseAmbientTemp = 28;
    
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

    function init() {
        setupEventListeners();
        updateTimeOfDay();
        renderSmartSchedule();
        updateAllDevices();
        startSimulation();
    }

    function setupEventListeners() {
        modeToggle.addEventListener('click', toggleMode);
        timeSlider.addEventListener('input', handleTimeChange);
        
        document.getElementById('reset-simulation').addEventListener('click', resetSimulation);
        
        ['light-living', 'light-bedroom', 'light-kitchen'].forEach(id => {
            document.getElementById(id).addEventListener('click', () => {
                if (!isSmartMode) {
                    const deviceId = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                    deviceStates[deviceId] = !deviceStates[deviceId];
                    updateDevice(deviceId);
                }
            });
        });

        document.getElementById('tv-device').addEventListener('click', () => {
            if (!isSmartMode) {
                if (deviceStates.tv === 'off') deviceStates.tv = 'standby';
                else if (deviceStates.tv === 'standby') deviceStates.tv = 'on';
                else deviceStates.tv = 'off';
                updateDevice('tv');
            }
        });

        ['ac', 'fan', 'heater'].forEach(id => {
            document.getElementById(id + '-device').addEventListener('click', () => {
                if (!isSmartMode) {
                    deviceStates[id] = !deviceStates[id];
                    updateDevice(id);
                }
            });
        });
    }

    function resetSimulation() {
        simulationTime = 0;
        manualConsumption = 0;
        smartConsumption = 0;
        manualEnergyTotal = 0;
        smartEnergyTotal = 0;
        
        document.getElementById('simulation-time').textContent = '0 detik';
        document.getElementById('manual-consumption').textContent = '0.000';
        document.getElementById('smart-consumption').textContent = '0.000';
        document.getElementById('saving-percentage').textContent = '0.0%';
    }

    function toggleMode() {
        isSmartMode = !isSmartMode;
        modeToggle.classList.toggle('smart');
        
        if (isSmartMode) {
            roomArea.classList.remove('manual-mode');
            roomArea.classList.add('smart-mode');
            document.getElementById('mode-label-manual').classList.add('opacity-50');
            document.getElementById('mode-label-smart').classList.remove('opacity-50');
            document.getElementById('mode-description').textContent = 'Mode Smart: Automasi berdasarkan jadwal';
            applySmartSchedule();
        } else {
            roomArea.classList.remove('smart-mode');
            roomArea.classList.add('manual-mode');
            document.getElementById('mode-label-manual').classList.remove('opacity-50');
            document.getElementById('mode-label-smart').classList.add('opacity-50');
            document.getElementById('mode-description').textContent = 'Klik perangkat untuk kontrol manual';
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
            timePeriodEl.textContent = 'Pagi';
            timeIconEl.textContent = '🌅';
            roomArea.classList.add('day');
            sunIcon.style.opacity = '1';
            moonIcon.style.opacity = '0';
            baseAmbientTemp = 26 + (hour - 6) * 0.4;
        } else if (hour >= 11 && hour < 15) {
            timePeriodEl.textContent = 'Siang';
            timeIconEl.textContent = '☀️';
            roomArea.classList.add('day');
            sunIcon.style.opacity = '1';
            moonIcon.style.opacity = '0';
            baseAmbientTemp = 30 + (hour - 11) * 0.5;
        } else if (hour >= 15 && hour < 18) {
            timePeriodEl.textContent = 'Sore';
            timeIconEl.textContent = '🌤️';
            roomArea.classList.add('evening');
            sunIcon.style.opacity = '0.7';
            moonIcon.style.opacity = '0';
            baseAmbientTemp = 32 - (hour - 15) * 1;
        } else if (hour >= 18 && hour < 21) {
            timePeriodEl.textContent = 'Petang';
            timeIconEl.textContent = '🌆';
            roomArea.classList.add('evening');
            sunIcon.style.opacity = '0.3';
            moonIcon.style.opacity = '0.3';
            baseAmbientTemp = 29 - (hour - 18) * 0.5;
        } else {
            timePeriodEl.textContent = 'Malam';
            timeIconEl.textContent = '🌙';
            roomArea.classList.add('night');
            sunIcon.style.opacity = '0';
            moonIcon.style.opacity = '1';
            baseAmbientTemp = 25 - (hour >= 22 ? (hour - 22) * 0.3 : (hour + 2) * 0.3);
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

    function applySmartTemperatureControl() {
        const TEMP_THRESHOLD_HIGH = 28;
        const TEMP_THRESHOLD_LOW = 20;
        
        if (ambientTemp >= TEMP_THRESHOLD_HIGH) {
            if (!deviceStates.ac) {
                deviceStates.ac = true;
                updateDevice('ac');
            }
            if (!deviceStates.fan && currentHour >= 9 && currentHour < 22) {
                deviceStates.fan = true;
                updateDevice('fan');
            }
        } else if (ambientTemp < TEMP_THRESHOLD_HIGH - 2) {
            if (deviceStates.ac) {
                deviceStates.ac = false;
                updateDevice('ac');
            }
            if (!deviceStates.fan && currentHour >= 9 && currentHour < 22) {
                deviceStates.fan = true;
                updateDevice('fan');
            }
        }
        
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
        
        Object.keys(scheduleSnapshot).forEach(deviceId => {
            deviceStates[deviceId] = scheduleSnapshot[deviceId];
        });
        
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
        
        if (currentHour === 7) {
            deviceStates.heater = true;
        } else if (currentHour >= 8) {
            deviceStates.heater = false;
        }
        
        applySmartTemperatureControl();
        
        updateAllDevices();
        renderSmartSchedule();
    }

    function updateDevice(deviceId) {
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

    function startSimulation() {
        setInterval(() => {
            simulationTime++;
            
            const currentRate = currentPower / 1000 / 3600;
            
            if (isSmartMode) {
                smartConsumption += currentRate;
                const manualEquivalent = currentRate * 1.35;
                manualEnergyTotal += manualEquivalent;
            } else {
                manualConsumption += currentRate;
                const smartEquivalent = currentRate * 0.75;
                smartEnergyTotal += smartEquivalent;
            }
            
            document.getElementById('simulation-time').textContent = simulationTime + ' detik';
            document.getElementById('manual-consumption').textContent = manualConsumption.toFixed(3);
            document.getElementById('smart-consumption').textContent = smartConsumption.toFixed(3);
            
            const totalManual = manualConsumption + manualEnergyTotal;
            const totalSmart = smartConsumption + smartEnergyTotal;
            
            if (totalManual > 0 && totalSmart > 0) {
                const saving = ((totalManual - totalSmart) / totalManual * 100);
                document.getElementById('saving-percentage').textContent = Math.max(0, saving).toFixed(1) + '%';
            } else {
                document.getElementById('saving-percentage').textContent = '0.0%';
            }
            
            if (isSmartMode && simulationTime % 5 === 0) {
                applySmartTemperatureControl();
            }
        }, 1000);
    }

    init();