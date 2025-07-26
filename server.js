// server.js

const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = 3000;

// Database setup
const db = new sqlite3.Database('./database.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS prayers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    request TEXT,
    date TEXT
  )`);
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Serves index.html and calendar.html

// Handle form submissions
app.post('/submit', (req, res) => {
  const { name, request, date } = req.body;
  const finalName = name.trim() === '' ? 'Anonymous' : name;

  db.run(
    `INSERT INTO prayers (name, request, date) VALUES (?, ?, ?)`,
    [finalName, request, date],
    (err) => {
      if (err) {
        console.error('Error inserting into DB:', err);
        return res.send('Error saving your prayer.');
      }
      res.send(`<p>Thank you for your prayer. <a href="/">Submit another</a></p>`);
    }
  );
});

// Download all prayer requests as PDF
app.get('/download', (req, res) => {
  db.all(`SELECT * FROM prayers ORDER BY date`, [], (err, rows) => {
    if (err) {
      console.error('DB fetch error:', err);
      return res.status(500).send('Error generating PDF');
    }

    const doc = new PDFDocument();
    const filePath = path.join(__dirname, 'prayer_requests.pdf');
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    doc.fontSize(18).text('Prayer Requests', { align: 'center' });
    doc.moveDown();

    rows.forEach((row, index) => {
      doc.fontSize(12).text(`${index + 1}. ${row.date} - ${row.name}`);
      doc.fontSize(12).text(`   ${row.request}`);
      doc.moveDown();
    });

    doc.end();

    writeStream.on('finish', () => {
      res.download(filePath, 'prayer_requests.pdf', (err) => {
        if (err) {
          console.error('Download error:', err);
          res.status(500).send('Error sending the PDF.');
        }
      });
    });
  });
});

// Calendar events endpoint
app.get('/events', (req, res) => {
  db.all(`SELECT * FROM prayers`, [], (err, rows) => {
    if (err) {
      console.error('Error fetching events:', err);
      return res.status(500).json([]);
    }

    const events = rows.map((row) => ({
      title: row.name === 'Anonymous' ? 'Prayer' : `${row.name}`,
      date: row.date,
      description: row.request
    }));

    res.json(events);
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});
