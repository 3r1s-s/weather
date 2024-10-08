if (!localStorage.getItem("weather-settings")) {
    const settings = {
        "temperature": 0, // 1 = F, 0 = C
        "measure": 0, // 1 = miles, 0 = km;
        "theme": 0, // 1 = dark, 0 = light;
    };
    
    localStorage.setItem("weather-settings", JSON.stringify(settings));
}

if (localStorage.getItem("weather-settings").theme === 1) {
    document.body.classList.add("dark");
} else if (localStorage.getItem("weather-settings").theme === 2) {
    document.body.classList.add("mono");
}

let searching;

async function getWeather(station) {
    placeholders(station);
    if (document.querySelector(".sidebar.open")) {
        toggleSidebar();
    }
    try {
        const response = await fetch('https://api.weather.gov/stations/' + station + '/observations');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        const st = data.features[0].properties.station.replace(/^https:\/\/api\.weather\.gov\/stations\//, '');

        document.getElementById("refresh").setAttribute('onclick', `getWeather('${st}')`);

        const stationResp = await fetch(`https://api.weather.gov/stations/${station}`);
        const stationData = await stationResp.json();
        const name = stationData.properties.name;

        let desc
        if (data.features[0].properties.textDescription) {
            desc = data.features[0].properties.textDescription;
        } else {
            desc = data.features[1].properties.textDescription;
        }

        let temperature
        if (data.features[0].properties.temperature.value) {
            temperature = data.features[0].properties.temperature.value;
        } else {
            temperature = data.features[1].properties.temperature.value;
        }

        if (desc === "Fog/Mist") {
            document.body.className = '';
            document.body.classList.add('fog');
        } else if (desc === "Mostly Cloudy") {
            document.body.className = '';
            document.body.classList.add('cloudy');
        } else if (desc === "Mostly Clear") {
            document.body.className = '';
            document.body.classList.add('clear');
        } else if (desc === "Light Rain") {
            document.body.className = '';
            document.body.classList.add('rain');
        } else {
            document.body.className = '';
            if (desc) {
                document.body.classList.add(desc.toLowerCase().replace(/\s+/g, '-'));
            }
        }

        if (JSON.parse(localStorage.getItem("weather-settings")).theme === 1) {
            document.body.classList.add("dark");
        } else if (JSON.parse(localStorage.getItem("weather-settings")).theme === 2) {
            document.body.classList.add("mono");
        }

        const meta = document.querySelector('meta[name="theme-color"]');
        meta.setAttribute('content', getComputedStyle(document.body).getPropertyValue('--back'));

        const barometricPressure = data.features[0].properties.barometricPressure.value;
        const windSpeed = data.features[0].properties.windSpeed.value;
        const windDirection = data.features[0].properties.windDirection.value;
        const visibility = data.features[0].properties.visibility.value;
        const heatIndex = data.features[1].properties.heatIndex.value;
        const dewpoint = data.features[1].properties.dewpoint.value;
        const relativeHumidity = data.features[1].properties.relativeHumidity.value;
        const precipitationLast6Hours = data.features[1].properties.precipitationLast6Hours.value;
        
        document.getElementById("temperature").innerText = convertTemperature(temperature, 0, JSON.parse(localStorage.getItem("weather-settings")).temperature);
        document.getElementById("loc").innerText = st;
        document.getElementById("location-full").innerText = name;
        document.getElementById("description").innerText = desc;

        document.getElementById("barometricPressure").querySelector(".tile-value").innerText = Math.round(barometricPressure * 0.0002953);
        document.getElementById("windSpeed").querySelector(".tile-value").innerText = convertDistance(windSpeed, 0, JSON.parse(localStorage.getItem("weather-settings")).measure);
        document.getElementById("windSpeed").querySelector(".compass").style.transform = `rotate(${windDirection}deg)`;
        document.getElementById("visibility").querySelector(".tile-value").innerText = convertDistance(visibility / 1000, 0, JSON.parse(localStorage.getItem("weather-settings")).measure);
        document.getElementById("heatIndex").querySelector(".tile-value").innerHTML = `<span class="str"><span>${convertTemperature(heatIndex, 0, JSON.parse(localStorage.getItem("weather-settings")).temperature)}</span><span class="symbol small">°</span></span>`;
        document.getElementById("dewpoint").querySelector(".tile-value").innerHTML = `<span class="str"><span>${convertTemperature(dewpoint, 0, JSON.parse(localStorage.getItem("weather-settings")).temperature)}</span><span class="symbol small">°</span></span>`;
        document.getElementById("relativeHumidity").querySelector(".tile-value").innerText = Math.round(relativeHumidity) + '%';
        document.getElementById("precipitationLast6Hours").querySelector(".tile-value").innerHTML = `<span class='str'><span>${convertLength(precipitationLast6Hours, 0, JSON.parse(localStorage.getItem("weather-settings")).measure)}</span><span class='symbol small'>${JSON.parse(localStorage.getItem("weather-settings")).measure === 1 ? '"' : ''}</span></span>`;

        const latitude = data.features[0].geometry.coordinates[1];
        const longitude = data.features[0].geometry.coordinates[0];
        const pointsUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
        const pointsResponse = await fetch(pointsUrl);
        const pointsData = await pointsResponse.json();
        const { gridId, gridX, gridY } = pointsData.properties;

        const forecastUrl = `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly`;
        const forecastResponse = await fetch(forecastUrl);
        const forecastData = await forecastResponse.json();

        const periods = forecastData.properties.periods;

        const highTemp = convertTemperature(
            Math.max(...periods.map(period => period.temperature)),
            1,
            JSON.parse(localStorage.getItem("weather-settings")).temperature
        );
        
        const lowTemp = convertTemperature(
            Math.min(...periods.map(period => period.temperature)),
            1,
            JSON.parse(localStorage.getItem("weather-settings")).temperature
        );
        
        document.getElementById("high-temp").innerText = `${highTemp}°`;
        document.getElementById("low-temp").innerText = `${lowTemp}°`;

        const forecastContainer = document.getElementById('forecast');
        forecastContainer.innerHTML = '';
        
        const now = new Date();
        const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        let maxChanceOfRain = 0;
        
        forecastData.properties.periods
            .filter(period => new Date(period.startTime) <= next24Hours)
            .forEach(period => {
                const date = new Date(period.startTime);
                const hours = date.getHours();
                const formattedHour = hours % 12 || 12;
                const ampm = hours >= 12 ? 'PM' : 'AM';
        
                const forecastDiv = document.createElement('div');
                forecastDiv.innerHTML = `
                    <span class="forcast-temp">${convertTemperature(period.temperature, 1, JSON.parse(localStorage.getItem("weather-settings")).temperature)}<span class="symbol">°</span></span>
                    <span class="forcast-time">${formattedHour}${ampm}</span>
                `;
                forecastContainer.appendChild(forecastDiv);

                if (period.probabilityOfPrecipitation.value > maxChanceOfRain) {
                    maxChanceOfRain = period.probabilityOfPrecipitation.value;
                }
            });

        document.getElementById("chanceOfRain").querySelector(".tile-value").innerText = maxChanceOfRain + '%';

        document.getElementById("heatIndex").querySelector(".tile-unit").innerText = `${JSON.parse(localStorage.getItem("weather-settings")).temperature === 1 ? 'F°' : 'C°'}`;
        document.getElementById("dewpoint").querySelector(".tile-unit").innerText = `${JSON.parse(localStorage.getItem("weather-settings")).temperature === 1 ? 'F°' : 'C°'}`;
        document.getElementById("windSpeed").querySelector(".tile-unit").innerText = `${JSON.parse(localStorage.getItem("weather-settings")).measure === 1 ? 'mph' : 'km/h'}`;
        document.getElementById("visibility").querySelector(".tile-unit").innerText = `${JSON.parse(localStorage.getItem("weather-settings")).measure === 1 ? 'mi' : 'km'}`;
        document.getElementById("precipitationLast6Hours").querySelector(".tile-unit").innerText = `${JSON.parse(localStorage.getItem("weather-settings")).measure === 1 ? 'in' : 'cm'}`;
    } catch (error) {
        console.error('Error fetching temperature:', error);
    }
}

function placeholders(station) {
    if (JSON.parse(localStorage.getItem("weather-settings")).theme === 1) {
        document.body.classList.add("dark");
    } else if (JSON.parse(localStorage.getItem("weather-settings")).theme === 2) {
        document.body.classList.add("mono");
    }

    document.getElementById("temperature").innerText = '--';
    document.getElementById("loc").innerText = station;
    document.getElementById("location-full").innerText = '####';
    document.getElementById("description").innerText = '####';
    document.getElementById("low-temp").innerText = '--';
    document.getElementById("high-temp").innerText = '--';

    const forecastContainer = document.getElementById('forecast');
    forecastContainer.innerHTML = '';

    document.getElementById("barometricPressure").querySelector(".tile-value").innerText = '--';
    document.getElementById("windSpeed").querySelector(".tile-value").innerText = '--';
    document.getElementById("visibility").querySelector(".tile-value").innerText = '--';
    document.getElementById("heatIndex").querySelector(".tile-value").innerHTML = `<span class="str">--</span>`;
    document.getElementById("dewpoint").querySelector(".tile-value").innerHTML = `<span class="str">--</span>`;
    document.getElementById("precipitationLast6Hours").querySelector(".tile-value").innerHTML = `<span class="str">--</span>`;
    document.getElementById("relativeHumidity").querySelector(".tile-value").innerText = '--';
    document.getElementById("precipitationLast6Hours").querySelector(".tile-value").innerHTML = `--`;
}

function getMoonPhase(date) {
    // Reference date: January 11, 2024
    const referenceDate = new Date('2024-01-11');
    
    const diffTime = date - referenceDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const lunarCycle = 29.53059;
    
    const moonPhase = (diffDays % lunarCycle) / lunarCycle;
    
    return moonPhase;
}

function setMoon() {
    const date = new Date();
    const phase = getMoonPhase(date);

    let illumination;
    if (phase <= 0.5) {
        illumination = phase * 2 * 100;
    } else {
        illumination = (1 - phase) * 2 * 100;
    }
    
    let phaseName;
    if (phase === 0 || phase === 1) {
        phaseName = "New Moon";
    } else if (phase > 0 && phase < 0.25) {
        phaseName = "Waxing Crescent";
    } else if (phase === 0.25) {
        phaseName = "First Quarter";
    } else if (phase > 0.25 && phase < 0.5) {
        phaseName = "Waxing Gibbous";
    } else if (phase === 0.5) {
        phaseName = "Full Moon";
    } else if (phase > 0.5 && phase < 0.75) {
        phaseName = "Waning Gibbous";
    } else if (phase === 0.75) {
        phaseName = "Last Quarter";
    } else if (phase > 0.75 && phase < 1) {
        phaseName = "Waning Crescent";
    }
    
    const r = document.querySelector(':root');
    const percentage = Math.round(illumination);
    
    r.style.setProperty('--phase', `${percentage}%`);
    r.style.setProperty('--flip', phase <= 0.5 ? '0deg' : '180deg');

    document.getElementById("moon").querySelector(".tile-value").innerText = `${Math.round(illumination)}%`;
    document.getElementById('moon-icon').style.setProperty('--phase', `${illumination}%`);
    document.getElementById('moon-icon').style.setProperty('--flip', phase <= 0.5 ? '0deg' : '180deg');

    document.getElementById("moon").querySelector(".tile-unit").innerText = phaseName;
}

function convertTemperature(val, from, to) {
    // 1 = f, 0 = c
    if (from === 1 && to === 0) {
        return Math.round((val - 32) * 5 / 9);
    } else if (from === 0 && to === 1) {
        return Math.round((val * 9 / 5) + 32);
    } else {
        return Math.round(val);
    }
}

function convertDistance(val, from, to) {
    // 1 = mi, 0 = km
    if (from === 1 && to === 0) {
        return Math.round(val * 1.60934);
    } else if (from === 0 && to === 1) {
        return Math.round(val / 1.60934);
    } else {
        return Math.round(val);
    }
}

function convertLength(val, from, to) {
    // 1 = in, 0 = cm
    if (from === 1 && to === 0) {
        return Math.round(val * 2.54);
    } else if (from === 0 && to === 1) {
        return Math.round(val / 2.54);
    } else {
        return Math.round(val);
    }
}

function convertToC(f) {
    return (f - 32) * 5 / 9;
}

async function searchStations(query) {
    document.getElementById('search-input').blur();
    if (query) {
        document.querySelector('.sidebar-main').innerHTML = '';
        document.getElementById('search-input').value = '';

        const results = document.createElement('div');
        results.className = 'results';

        results.innerHTML = 
            `<span class="saved-loc-name">
                <span>Results for "${query}"</span>
                </span>
                <span class="result-left" onclick="clearSearch()">
                <span class="loading"></span>
                <span class="pointer">Back</span>
            </span>
            `;

        searching = true;
        document.querySelector('.sidebar-main').appendChild(results);
        try {
            const locationResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json`);
            const locationData = await locationResponse.json();

            if (locationData.length > 0) {
                const { lat, lon } = locationData[0];

                const stationsResponse = await fetch(`https://api.weather.gov/points/${lat},${lon}/stations`);
                const stationsData = await stationsResponse.json();
                const stations = stationsData.features;

                if (stations.length > 0) {
                    const pinnedLocations = JSON.parse(localStorage.getItem("weather-pinneds")) || [];

                    for (let i = 0; i < Math.min(stations.length, 10) && searching; i++) {
                        const station = stations[i];
                        const stationId = station.properties.stationIdentifier;

                        try {
                            const observationResponse = await fetch(`https://api.weather.gov/stations/${stationId}/observations/`);
                            const data = await observationResponse.json();
                            let temperature;
                            if (data.features[0].properties.temperature.value) {
                                temperature = data.features[0].properties.temperature.value;
                            } else {
                                temperature = data.features[1].properties.temperature.value;
                            }

                            const stationResp = await fetch(`https://api.weather.gov/stations/${stationId}`);
                            const stationData = await stationResp.json();
                            const name = stationData.properties.name;

                            const savedLocDiv = document.createElement('div');
                            savedLocDiv.className = 'saved-loc';
                            savedLocDiv.id = stationId;

                            savedLocDiv.innerHTML = 
                                `
                                <div class="result-wrapper" onclick="getWeather('${stationId}')">
                                    <span class="saved-loc-name">
                                        ${stationId} - ${name}
                                    </span>
                                    <div class="saved-loc-title">
                                        <span id="loc-temp">${temperature ? convertTemperature(temperature, 0, JSON.parse(localStorage.getItem("weather-settings")).temperature) : 'N/A'}°</span>
                                    </div>
                                </div>
                                    <div class="pin-button" onclick="pinLocation('${stationId}')">
                                    <span>Pin</span>
                                    </div>
                                `;

                            document.querySelector('.sidebar-main').appendChild(savedLocDiv);
                        } catch (error) {
                            console.error('Error fetching temperature data:', error);
                        }
                    }
                    document.querySelectorAll('.loading').forEach(element => element.remove());
                } else {
                    console.error('No weather stations found');
                }
            } else {
                console.error('Location not found');
            }
        } catch (error) {
            console.error('Error fetching location coordinates:', error);
        }
    } else {
        console.log('No location entered');
    }
}


function toggleSidebar() {
    if (document.querySelector(".sidebar.open")) {
        document.querySelector(".sidebar").classList.remove("open")
    } else {
        document.querySelector(".sidebar").classList.add("open")
    }
}

function toggleSettings(override) {
    const modalOuter = document.querySelector(".modal-outer");
    const bodyInner = document.querySelector(".body-inner");
    if (override === 0 || override === 0) {
        if (override === 1) {
            bodyInner.classList.remove("fade");
            document.querySelector('meta[name="theme-color"]').setAttribute('content', getComputedStyle(document.body).getPropertyValue('--back'));
            modalOuter.classList.remove("open");
    
            setTimeout(() => {
                modalOuter.style.visibility = "hidden";
                document.querySelector(".modal-inner").innerHTML = ``;
                document.querySelector(".modal-options").innerHTML = ``;
            }, 500);
            
        } else {
            modalOuter.style.visibility = "visible";
            loadSettings();
            modalOuter.classList.add("open");
            bodyInner.classList.add("fade");
            document.querySelector('meta[name="theme-color"]').setAttribute('content', '#000');
        }
    } else {
        if (modalOuter.classList.contains("open")) {
            bodyInner.classList.remove("fade");
            document.querySelector('meta[name="theme-color"]').setAttribute('content', getComputedStyle(document.body).getPropertyValue('--back'));
            modalOuter.classList.remove("open");
    
            setTimeout(() => {
                modalOuter.style.visibility = "hidden";
                document.querySelector(".modal-inner").innerHTML = ``;
                document.querySelector(".modal-options").innerHTML = ``;
            }, 500);
            
        } else {
            modalOuter.style.visibility = "visible";
            loadSettings();
            modalOuter.classList.add("open");
            bodyInner.classList.add("fade");
            document.querySelector('meta[name="theme-color"]').setAttribute('content', '#000');
        }
    }
}

function loadSettings() {
    document.querySelector(".modal-inner").innerHTML = `
    <span class="modal-header">Settings</span>
    <span class="modal-subheader">Temperature Unit</span>
    <div class="unit-toggle" id='unit-temperature'>
    <div class="unit-toggle-button enabled" id="unit-c" data-unit="0" onclick="setUnit(0, 1)">C°</div>
    <div class="unit-toggle-button" id="unit-f" data-unit="1" onclick="setUnit(1, 1)">F°</div>
    </div>
    <span class="modal-subheader">Measurement System</span>
    <div class="unit-toggle" id='unit-measure'>
    <div class="unit-toggle-button" id="unit-km" data-unit="0" onclick="setUnit(0, 2)">Metric</div>
    <div class="unit-toggle-button enabled" id="unit-mi" data-unit="1" onclick="setUnit(1, 2)">American</div>
    </div>
    <span class="modal-subheader">App Theme</span>
    <div class="unit-toggle" id='unit-theme'>
    <div class="unit-toggle-button" id="theme-light" data-unit="0" onclick="setUnit(0, 3)">Light</div>
    <div class="unit-toggle-button enabled" id="theme-dark" data-unit="1" onclick="setUnit(1, 3)">Dark</div>
    <div class="unit-toggle-button" id="theme-mono" data-unit="2" onclick="setUnit(2, 3)">Mono</div>
    </div>
    `;
    document.querySelector(".modal-options").innerHTML = `
    <button class="modal-button" onclick="applySettings()">Apply</button>
    <button class="modal-button" onclick="toggleSettings()">Close</button>
    `;
    document.querySelector(`#unit-${JSON.parse(localStorage.getItem("weather-settings")).temperature ? 'f' : 'c'}`).classList.add("enabled");
    document.querySelector(`#unit-${JSON.parse(localStorage.getItem("weather-settings")).temperature ? 'c' : 'f'}`).classList.remove("enabled");
    document.querySelector(`#unit-${JSON.parse(localStorage.getItem("weather-settings")).measure ? 'mi' : 'km'}`).classList.add("enabled");
    document.querySelector(`#unit-${JSON.parse(localStorage.getItem("weather-settings")).measure ? 'km' : 'mi'}`).classList.remove("enabled");
    if (JSON.parse(localStorage.getItem("weather-settings")).theme === 0) {
        document.querySelector('#theme-light').classList.add("enabled");
        document.querySelector('#theme-dark').classList.remove("enabled");
        document.querySelector('#theme-mono').classList.remove("enabled");
    } else if (JSON.parse(localStorage.getItem("weather-settings")).theme === 1) {
        document.querySelector('#theme-dark').classList.add("enabled");
        document.querySelector('#theme-light').classList.remove("enabled");
        document.querySelector('#theme-mono').classList.remove("enabled");
    } else if (JSON.parse(localStorage.getItem("weather-settings")).theme === 2) {
        document.querySelector('#theme-mono').classList.add("enabled");
        document.querySelector('#theme-light').classList.remove("enabled");
        document.querySelector('#theme-dark').classList.remove("enabled");
    }
}
function setUnit(unit, target) {
    // 1 = temp, 2 = measure
    if (target == 1) {
        document.querySelector(`#unit-${unit ? 'f' : 'c'}`).classList.add("enabled");
        document.querySelector(`#unit-${unit ? 'c' : 'f'}`).classList.remove("enabled");
    } else if (target == 2) {
        document.querySelector(`#unit-${unit ? 'mi' : 'km'}`).classList.add("enabled");
        document.querySelector(`#unit-${unit ? 'km' : 'mi'}`).classList.remove("enabled");
    } else if (target == 3) {
        if (unit === 0) {
            document.querySelector('#theme-light').classList.add("enabled");
            document.querySelector('#theme-dark').classList.remove("enabled");
            document.querySelector('#theme-mono').classList.remove("enabled");
        } else if (unit === 1) {
            document.querySelector('#theme-dark').classList.add("enabled");
            document.querySelector('#theme-light').classList.remove("enabled");
            document.querySelector('#theme-mono').classList.remove("enabled");
        } else if (unit === 2) {
            document.querySelector('#theme-mono').classList.add("enabled");
            document.querySelector('#theme-light').classList.remove("enabled");
            document.querySelector('#theme-dark').classList.remove("enabled");
        }
    }
}

function applySettings() {
    const currentSettings = JSON.parse(localStorage.getItem("weather-settings"));
    currentSettings.temperature = parseInt(document.querySelector("#unit-temperature .unit-toggle-button.enabled").getAttribute("data-unit"));
    currentSettings.measure = parseInt(document.querySelector("#unit-measure .unit-toggle-button.enabled").getAttribute("data-unit"));
    currentSettings.theme = parseInt(document.querySelector("#unit-theme .unit-toggle-button.enabled").getAttribute("data-unit"));
    // save

    localStorage.setItem("weather-settings", JSON.stringify(currentSettings));
    setTimeout(() => {
        toggleSettings(1);
    }, 100);
    setTimeout(() => {
        location.reload();
    }, 200);
}

function clearSearch() {
    document.querySelector('.sidebar-main').innerHTML = '';
    searching = false;
}

function displayPinnedLocations() {
    const pinnedLocations = JSON.parse(localStorage.getItem("weather-pinneds")) || [];
    document.querySelector('.sidebar-main').innerHTML = '';

    if (pinnedLocations.length > 0) {
        pinnedLocations.forEach(async (stationId) => {
            try {
                const observationResponse = await fetch(`https://api.weather.gov/stations/${stationId}/observations/`);
                const data = await observationResponse.json();
                let temperature;
                if (data.features[0].properties.temperature.value) {
                    temperature = data.features[0].properties.temperature.value;
                } else {
                    temperature = data.features[1].properties.temperature.value;
                }

                const stationResp = await fetch(`https://api.weather.gov/stations/${stationId}`);
                const stationData = await stationResp.json();
                const name = stationData.properties.name;

                const savedLocDiv = document.createElement('div');
                savedLocDiv.className = 'saved-loc';
                savedLocDiv.id = stationId;
                savedLocDiv.innerHTML = 
                `
                <div class="result-wrapper" onclick="getWeather('${stationId}')">
                    <span class="saved-loc-name">
                        ${stationId} - ${name}
                    </span>
                    <div class="saved-loc-title">
                        <span id="loc-temp">${temperature ? convertTemperature(temperature, 0, JSON.parse(localStorage.getItem("weather-settings")).temperature) : 'N/A'}°</span>
                    </div>
                </div>
                    <div class="pin-button" onclick="unpinLocation('${stationId}')">
                    <span>Unpin</span>
                    </div>
                `;
                document.querySelector('.sidebar-main').appendChild(savedLocDiv);
            } catch (error) {
                console.error('Error fetching pinned location data:', error);
            }
        });
    } else {
        document.querySelector('.sidebar-main').innerHTML = '<span class="saved-loc-name">No pinned locations</span>';
    }
}

function pinLocation(stationId) {
    clearSearch();
    event.stopPropagation();
    const pinnedLocations = JSON.parse(localStorage.getItem("weather-pinneds")) || [];
    if (!pinnedLocations.includes(stationId)) {
        pinnedLocations.push(stationId);
        localStorage.setItem("weather-pinneds", JSON.stringify(pinnedLocations));
        displayPinnedLocations();
    }
}

function unpinLocation(stationId) {
    let pinnedLocations = JSON.parse(localStorage.getItem("weather-pinneds")) || [];
    pinnedLocations = pinnedLocations.filter(id => id !== stationId);
    localStorage.setItem("weather-pinneds", JSON.stringify(pinnedLocations));
    displayPinnedLocations();
}

setMoon();

window.onload = function() {
    displayPinnedLocations();
    const pinnedLocations = JSON.parse(localStorage.getItem("weather-pinneds")) || [];
    if (pinnedLocations.length > 0) {
        getWeather(pinnedLocations[0]);
    } else {
        getWeather('KPHX');
    }
};