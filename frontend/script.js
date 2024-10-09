const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const result = document.getElementById('result');
const startButton = document.getElementById('start-button');
const cameraContainer = document.getElementById('camera-container');

let scanning = false;
let freezeFrame = false;
let stream = null;

startButton.addEventListener('click', function() {
    if (scanning) {
        stopScanning();
    } else {
        startScanning();
    }
});

async function startScanning() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        video.play();

        scanning = true;
        freezeFrame = false;
        startButton.textContent = 'Stop Scanning';
        cameraContainer.style.display = 'block';

        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: video,
                constraints: {
                    facingMode: "environment"
                },
            },
            decoder: {
                readers: ["ean_reader", "ean_8_reader", "code_128_reader", "code_39_reader", "code_39_vin_reader", "codabar_reader", "upc_reader", "upc_e_reader", "i2of5_reader"]
            }
        }, function(err) {
            if (err) {
                console.log(err);
                return;
            }
            console.log("Quagga initialization finished. Ready to start");
            Quagga.start();
        });

        Quagga.onDetected(handleBarcode);
        requestAnimationFrame(tick);
    } catch (err) {
        console.error('Error accessing the camera:', err);
        result.textContent = 'Error accessing the camera. Please make sure you have given permission.';
    }
}

function stopScanning() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    scanning = false;
    freezeFrame = false;
    startButton.textContent = 'Start Scanning';
    cameraContainer.style.display = 'none';
    Quagga.stop();
}

function tick() {
    if (video.readyState === video.HAVE_ENOUGH_DATA && !freezeFrame) {
        canvas.hidden = false;
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });
        if (code) {
            handleQRCode(code.data);
        }
    }
    if (scanning && !freezeFrame) {
        requestAnimationFrame(tick);
    }
}

async function handleQRCode(data) {
    freezeFrame = true;
    await fetchAttendeeData(data, 'qr');
    setTimeout(unfreezeFrame, 5000);
}

async function handleBarcode(result) {
    freezeFrame = true;
    await fetchAttendeeData(result.codeResult.code, 'barcode');
    setTimeout(unfreezeFrame, 5000);
}

async function fetchAttendeeData(id, scanType) {
    try {
        const response = await fetch('https://backend-5b1y.onrender.com/getParticipant', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id, scanType }),
        });

        if (response.ok) {
            const attendeeData = await response.json();
            displayAttendeeInfo(attendeeData);
        } else {
            const errorData = await response.json();
            displayResult('Error', errorData.message);
        }
    } catch (err) {
        console.error('Error fetching attendee data:', err);
        displayResult('Error', 'An error occurred while fetching attendee data.');
    }
}

function unfreezeFrame() {
    freezeFrame = false;
    if (scanning) {
        requestAnimationFrame(tick);
    }
}

function displayResult(type, data) {
    result.textContent = `${type} detected: ${data}`;
    result.classList.add('success');

    setTimeout(() => {
        result.classList.remove('success');
    }, 3000);
}

function displayAttendeeInfo(data) {
    let eventsHtml = '';
    if (data.participatedEvents && data.participatedEvents.length > 0) {
        eventsHtml = `
            <strong>Registered Events:</strong><br>
            <ul class="event-list">
                ${data.participatedEvents.map(event => `
                    <li>${event.EventName}</li>
                `).join('')}
            </ul>
        `;
    } else {
        eventsHtml = '<strong>Registered Events:</strong> None<br>';
    }

    result.innerHTML = `
        <div class="attendee-info">
            <h2>${data.FirstName} ${data.LastName}</h2>
            <p><strong>Email:</strong> ${data.Email}</p>
            <p><strong>Phone:</strong> ${data.ContactNumber}</p>
            <p><strong>Institute:</strong> ${data.InstituteName}</p>
            <p><strong>State:</strong> ${data.State}</p>
            <p><strong>BandID:</strong> ${data.BandID}</p>
            <p><strong>UID:</strong> ${data.UID}</p>
        </div>
        <div class="events-info">
            ${eventsHtml}
        </div>
    `;
    result.classList.add('success');

    setTimeout(() => {
        result.classList.remove('success');
    }, 5000);
}