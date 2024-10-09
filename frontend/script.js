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
        const response = await fetch('http://localhost:3000/getParticipant', {
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
    result.innerHTML = `
        <strong>FullName:</strong> ${data.FirstName} ${data.LastName} <br>
        <strong>Email:</strong> ${data.Email} <br>
        <strong>Phone:</strong> ${data.ContactNumber} <br>
        <strong>BandID:</strong> ${data.BandID} <br>
        <strong>UID:</strong> ${data.UID} <br>
    `;
    result.classList.add('success');

    setTimeout(() => {
        result.classList.remove('success');
    }, 3000);
}