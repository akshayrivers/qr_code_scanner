const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const serverless = require('serverless-http');
require('dotenv').config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 100,
    queueLimit: 0,
});

// Root Endpoint
app.get('/', (req, res) => {
    res.status(200).send('API is working properly.');
});

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP' });
});

// Get Participant Endpoint
app.post('/getParticipant', (req, res) => {
    const { id, scanType } = req.body;
    
    let query;
    if (scanType === 'qr') {
        query = 'SELECT * FROM attendees WHERE UID = ?;';
    } else if (scanType === 'barcode') {
        query = 'SELECT * FROM attendees WHERE BandID = ?;';
    } else {
        return res.status(400).json({ message: 'Invalid scan type.' });
    }

    pool.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: 'An error occurred while fetching participant information.' });
        }
        
        if (results.length > 0) {
            const attendee = results[0];
            const eventsQuery = `
                SELECT e.EventName, e.EventType, e.EventTier, e.EventPrice, p.attended
                FROM participating p
                JOIN events e ON p.EventID = e.EventID
                WHERE p.UserID = ?;
            `;
            pool.query(eventsQuery, [attendee.UID], (eventErr, eventResults) => {
                if (eventErr) {
                    console.error('Error fetching participated events:', eventErr);
                    return res.status(500).json({ error: 'An error occurred while fetching participated events.' });
                }
                
                attendee.participatedEvents = eventResults;
                res.json(attendee);
            });
        } else {
            res.status(404).json({ message: 'Participant not found.' });
        }
    });
});

const port = process.env.PORT || 3000; // Fallback for local development
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Export the handler
module.exports = serverless(app);
