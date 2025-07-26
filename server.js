const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3000;

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

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Handle prayer submission
app.post('/submit', (req, res) => {
  const { name, request, date } = req.body;
  const finalName = name.trim() === '' ? 'Anonymous' : name;

  db.run(
    `INSERT INTO prayers (name, request, date) VALUES (?, ?, ?)`,
    [finalName, request, date],
    (err) => {
      if (err) {
        return res.send('Error saving prayer.');
      }
      res.send(`<p>Thank you for your prayer. <a href="/">Submit another</a></p>`);
    }
  );
});

// Route to download all prayers as PDF
app.get('/download', (req, res) => {
  db.all(`SELECT * FROM prayers ORDER BY date`, [], (err, rows) => {
    if (err) return res.status(500).send('Error generating PDF');

    const doc = new PDFDocument();
    const filePath = path.join(__dirname, 'prayer_requests.pdf');
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).text('Prayer Requests', { align: 'center' });
    doc.moveDown();

    rows.forEach((row, index) => {
      doc.fontSize(12).text(`${index + 1}. ${row.date} - ${row.name}`);
      doc.fontSize(12).text(`   ${row.request}`);
      doc.moveDown();
    });

    doc.end();

    stream.on('finish', () => {
      res.download(filePath);
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
