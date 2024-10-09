// api/index.js
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const serverless = require('serverless-http');
require('dotenv').config();
const app = express();
// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const connection = mysql.createConnection({
  host:process.env.DB_HOST,       // # Replace with your host, e.g., 'localhost'
  database:process.env.DB_NAME, // # Replace with your database name
  user:process.env.DB_USER,      //Replace with your username
  password:process.env.DB_PASSWORD   // Replace with your password
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    // It's better to handle the error gracefully in a serverless environment
  } else {
    console.log('Connected to the database.');
  }
});


app.get('/',(req,res)=>{
  res.status(200);
})
// Endpoint
app.post('/getParticipant', (req, res) => {
  const { id, scanType } = req.body;
  
  let query;
  if (scanType === 'qr') {
    query = 'SELECT * FROM attendees WHERE UID = ?;';
  } else if (scanType === 'barcode') {
    query = 'SELECT * FROM attendees WHERE BandID = ?;';
  } else {
    res.status(400).json({ message: 'Invalid scan type.' });
    return;
  }
  
  connection.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).json({ error: 'An error occurred while fetching participant information.' });
      return;
    }
    
    if (results.length > 0) {
      res.json(results[0]);
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