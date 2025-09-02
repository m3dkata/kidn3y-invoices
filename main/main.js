const { app, shell, BrowserWindow, ipcMain } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');

let win;
let splashScreen;
const db = new sqlite3.Database('./db.sqlite3');

db.serialize(() => {
  db.run(`ALTER TABLE Invoice ADD COLUMN reason TEXT DEFAULT ''`, (err) => {
    // Ignore error if column already exists
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding reason column:', err);
    }
  });
  db.run(`CREATE TABLE IF NOT EXISTS Company (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    town TEXT,
    street TEXT,
    id_number TEXT,
    dds_number TEXT,
    iban TEXT,
    bic_code TEXT,
    mol TEXT
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS Product (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT,
    product_price REAL,
    product_unit TEXT,
    product_is_delete INTEGER DEFAULT 0
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS Customer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    town TEXT,
    street TEXT,
    id_number TEXT,
    dds_number TEXT,
    mol TEXT,
    is_deleted INTEGER DEFAULT 0
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS Invoice (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    number TEXT UNIQUE,
    customer_id INTEGER,
    total REAL,
    total_without_vat REAL,
    payment_type TEXT,
    is_deleted INTEGER DEFAULT 0
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS InvoiceDetail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER,
    product_id INTEGER,
    amount INTEGER,
    price REAL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS InvoiceDetailOverrides (
    detail_id INTEGER PRIMARY KEY,
    display_total REAL
  )`);
});
ipcMain.on('save-invoice-total-override', (event, { detailId, displayTotal }) => {
  db.run(
    `INSERT OR REPLACE INTO InvoiceDetailOverrides (detail_id, display_total) VALUES (?, ?)`,
    [detailId, displayTotal],
    (err) => {
      if (err) {
        console.error('Error saving total override:', err);
      }
    }
  );
});
// Add this handler to get invoice data for editing
ipcMain.on('get-invoice-for-edit', (event, id) => {
  // First get the invoice basic information
  db.get(
    `SELECT i.*, c.name as customer_name, c.id as customer_id 
     FROM Invoice i 
     JOIN Customer c ON i.customer_id = c.id 
     WHERE i.id = ?`,
    [id],
    (err, invoice) => {
      if (err || !invoice) {
        event.reply('notification', {
          type: 'error',
          message: 'Грешка при зареждане на фактура'
        });
        return;
      }

      // Then get the invoice details (products)
      db.all(
        `SELECT id.*, id.id as detail_id, p.id as product_id, p.product_name, p.product_unit 
         FROM InvoiceDetail id
         JOIN Product p ON id.product_id = p.id
         WHERE id.invoice_id = ?`,
        [id],
        (err, details) => {
          if (err) {
            event.reply('notification', {
              type: 'error',
              message: 'Грешка при зареждане на детайли на фактура'
            });
            return;
          }
          
          // Send the complete invoice with details to the renderer
          invoice.details = details;
          event.reply('get-invoice-for-edit-response', invoice);
        }
      );
    }
  );
});

// Add handler to save edited invoice
// Update this handler to save edited invoice
ipcMain.on('save-edited-invoice', (event, invoiceData) => {
  // Begin a transaction to ensure all operations succeed or fail together
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Update the invoice basic information
    db.run(
      `UPDATE Invoice 
       SET payment_type = ?, total = ?, total_without_vat = ?, reason = ?
       WHERE id = ?`,
      [invoiceData.payment_type, invoiceData.total, invoiceData.total_without_vat, invoiceData.reason || '', invoiceData.id],
      (err) => {
        if (err) {
          db.run('ROLLBACK');
          event.reply('notification', {
            type: 'error',
            message: 'Грешка при обновяване на фактура'
          });
          return;
        }
        
        // Create promises for updating each product detail
        const detailPromises = invoiceData.products.map(product => {
          return new Promise((resolve, reject) => {
            // Store exact values without recalculating
            db.run(
              `UPDATE InvoiceDetail 
               SET amount = ?, price = ?
               WHERE id = ?`,
              [product.amount, product.price, product.detail_id],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        });
        
        Promise.all(detailPromises)
          .then(() => {
            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK');
                event.reply('notification', {
                  type: 'error',
                  message: 'Грешка при запазване на промените'
                });
                return;
              }
              
              event.reply('notification', {
                type: 'success',
                message: 'Успешно редактирана фактура'
              });
              
              // Refresh the invoice list
              loadInvoices(event);
            });
          })
          .catch(err => {
            console.error('Error updating invoice details:', err);
            db.run('ROLLBACK');
            event.reply('notification', {
              type: 'error',
              message: 'Грешка при запазване на промени в продуктите'
            });
          });
      }
    );
  });
});


// Product handlers
ipcMain.on('create-product', (event, { name, price, unit }) => {
  db.run(
    `INSERT INTO Product (product_name, product_price, product_unit) VALUES (?, ?, ?)`,
    [name, price, unit],
    (err) => {
      event.reply('notification', {
        type: err ? 'error' : 'success',
        message: err ? 'Грешка при създаване на продукт' : 'Успешно създаден продукт'
      });
      if (!err) loadProducts(event);
    }
  );
});

ipcMain.on('get-products', (event) => loadProducts(event));

ipcMain.on('delete-product', (event, id) => {
  db.run(`UPDATE Product SET product_is_delete = 1 WHERE id = ?`, [id], (err) => {
    event.reply('notification', {
      type: err ? 'error' : 'success',
      message: err ? 'Грешка при изтриване' : 'Успешно изтрит продукт'
    });
    if (!err) loadProducts(event);
  });
});

// Customer handlers
ipcMain.on('create-customer', (event, customer) => {
    db.run(
      `INSERT INTO Customer (name, town, street, id_number, dds_number, mol) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [customer.name, customer.town, customer.street, customer.id_number, 
       customer.dds_number, customer.mol],
      (err) => {
        event.reply('notification', {
          type: err ? 'error' : 'success',
          message: err ? 'Грешка при създаване на клиент' : 'Успешно създаден клиент'
        });
        if (!err) {
          loadCustomers(event);
        }
      }
    );
  });
  
  
  ipcMain.on('get-customers', (event) => {
    db.all(`SELECT * FROM Customer WHERE is_deleted = 0`, [], (err, rows) => {
      if (err) {
        event.reply('get-customers-response', []);
      } else {
        event.reply('get-customers-response', rows);
      }
    });
  });
  
  ipcMain.on('delete-customer', (event, id) => {
    db.run(`UPDATE Customer SET is_deleted = 1 WHERE id = ?`, [id], (err) => {
      event.reply('notification', {
        type: err ? 'error' : 'success',
        message: err ? 'Грешка при изтриване' : 'Успешно изтрит клиент'
      });
      if (!err) {
        loadCustomers(event);
      }
    });
  });
  
  ipcMain.on('get-customer', (event, id) => {
    db.get(`SELECT * FROM Customer WHERE id = ? AND is_deleted = 0`, [id], (err, row) => {
      event.reply('get-customer-response', err ? null : row);
    });
  });
  

// Invoice handlers
async function getNextInvoiceNumber() {
  return new Promise((resolve, reject) => {
    db.get('SELECT MAX(CAST(number AS INTEGER)) as maxNum FROM Invoice WHERE is_deleted = 0', [], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      const nextNum = row.maxNum ? row.maxNum + 1 : 1;
      resolve(nextNum.toString().padStart(10, '0'));
    });
  });
}

// Then in the create-invoice handler, update the number generation:
ipcMain.on('create-invoice', async (event, invoiceData) => {
  try {
    // Check if we need to create a new customer first
    let customerId = invoiceData.customer_id;
    
    if (invoiceData.new_customer) {
      // Create the new customer and get its ID
      customerId = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO Customer (name, town, street, id_number, dds_number, mol) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            invoiceData.new_customer.name, 
            invoiceData.new_customer.town, 
            invoiceData.new_customer.street, 
            invoiceData.new_customer.id_number, 
            invoiceData.new_customer.dds_number, 
            invoiceData.new_customer.mol,
          ],
          function(err) {
            if (err) {
              console.error('Error creating customer:', err);
              reject(err);
              return;
            }
            resolve(this.lastID);
          }
        );
      });
    }

    db.run(
      `INSERT INTO Invoice (date, number, customer_id, total, total_without_vat, payment_type, reason) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [invoiceData.date, invoiceData.number, customerId, invoiceData.total, invoiceData.total_without_vat, invoiceData.payment_type, invoiceData.reason || ''],
      function(err) {
        if (err) {
          console.error('Error creating invoice:', err);
          event.reply('notification', {
            type: 'error',
            message: 'Грешка при създаване на фактура: ' + err.message
          });
          return;
        }

        const invoiceId = this.lastID;
        invoiceData.products.forEach(product => {
          db.run(
            `INSERT INTO InvoiceDetail (invoice_id, product_id, amount, price) 
             VALUES (?, ?, ?, (SELECT product_price FROM Product WHERE id = ?))`,
            [invoiceId, product.product_id, product.amount, product.product_id]
          );
        });

        event.reply('notification', {
          type: 'success',
          message: 'Успешно създадена фактура'
        });
        loadInvoices(event);
      }
    );
  } catch (error) {
    console.error('Error in create-invoice handler:', error);
    event.reply('notification', {
      type: 'error',
      message: 'Грешка при създаване на фактура: ' + error.message
    });
  }
});


ipcMain.on('get-invoices', (event) => loadInvoices(event));

ipcMain.on('print-invoice', async (event, id) => {
  try {
    // Get invoice number for filename
    const invoice = await new Promise((resolve, reject) => {
      db.get('SELECT number FROM Invoice WHERE id = ?', [id], (err, row) => {
        err ? reject(err) : resolve(row);
      });
    });
    
    // Generate the PDF
    await generateInvoicePDF(id, event);
    
    // Wait to ensure file is fully written
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Open the file
    const fileName = `${invoice.number}.pdf`;
    const filePath = path.join(app.getPath('downloads'), fileName);
    shell.openPath(filePath);
  } catch (error) {
    console.error('Error handling invoice:', error);
    event.reply('notification', {
      type: 'error',
      message: 'Грешка при обработка на фактурата'
    });
  }
});


// Export handlers
ipcMain.on('export-products', (event) => {
  exportToExcel('Product', event);
});

ipcMain.on('export-customers', (event) => {
  exportToExcel('Customer', event);
});

ipcMain.on('export-invoices', (event) => {
  exportToExcel('Invoice', event);
});

// Helper functions
function loadProducts(event) {
  db.all(`SELECT * FROM Product WHERE product_is_delete = 0`, [], (err, rows) => {
    event.reply('get-products-response', err ? [] : rows);
  });
}

// Add this helper function
function loadCustomers(event) {
  db.all(`SELECT * FROM Customer WHERE is_deleted IS NULL OR is_deleted = 0`, [], (err, rows) => {
    event.reply('get-customers-response', err ? [] : rows);
  });
}

  
function loadInvoices(event) {
  db.all(
    `SELECT i.*, c.name as customer_name 
     FROM Invoice i 
     JOIN Customer c ON i.customer_id = c.id 
     WHERE i.is_deleted = 0
     ORDER BY i.number DESC`,
    [],
    (err, invoices) => {
      if (err) {
        event.reply('get-invoices-response', []);
        return;
      }
      
      // Create a promises array to fetch details for each invoice
      const detailPromises = invoices.map(invoice => {
        return new Promise((resolve, reject) => {
          db.all(
            `SELECT id.*, p.product_name, p.product_unit, id.id as detail_id,
             o.display_total
             FROM InvoiceDetail id
             JOIN Product p ON id.product_id = p.id
             LEFT JOIN InvoiceDetailOverrides o ON id.id = o.detail_id
             WHERE id.invoice_id = ?`,
            [invoice.id],
            (err, details) => {
              if (err) {
                reject(err);
              } else {
                invoice.details = details;
                resolve(invoice);
              }
            }
          );
        });
      });
      
      Promise.all(detailPromises)
        .then(invoicesWithDetails => {
          event.reply('get-invoices-response', invoicesWithDetails);
        })
        .catch(error => {
          event.reply('get-invoices-response', invoices);
        });
    }
  );
}

  
  ipcMain.on('delete-invoice', (event, id) => {
    // Begin a transaction to ensure both operations complete or fail together
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // First delete the invoice details
      db.run(`DELETE FROM InvoiceDetail WHERE invoice_id = ?`, [id], (err) => {
        if (err) {
          db.run('ROLLBACK');
          event.reply('delete-invoice-response', {
            type: 'error',
            message: 'Грешка при изтриване на детайли на фактура'
          });
          return;
        }
        
        // Then delete the invoice completely
        db.run(`DELETE FROM Invoice WHERE id = ?`, [id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            event.reply('delete-invoice-response', {
              type: 'error',
              message: 'Грешка при изтриване на фактура'
            });
            return;
          }
          
          // If both operations are successful, commit the transaction
          db.run('COMMIT', (err) => {
            if (err) {
              db.run('ROLLBACK');
              event.reply('delete-invoice-response', {
                type: 'error',
                message: 'Грешка при запазване на промените'
              });
              return;
            }
            
            event.reply('delete-invoice-response', {
              type: 'success',
              message: 'Успешно изтрита фактура'
            });
            
            // Refresh the invoice list
            loadInvoices(event);
          });
        });
      });
    });
  });
  
  function numberToWordsBG(num) {
    const units = ['', 'един', 'два', 'три', 'четири', 'пет', 'шест', 'седем', 'осем', 'девет'];
    const unitsF = ['', 'една', 'две', 'три', 'четири', 'пет', 'шест', 'седем', 'осем', 'девет']; // Feminine form
    const teens = ['десет', 'единадесет', 'дванадесет', 'тринадесет', 'четиринадесет', 'петнадесет', 'шестнадесет', 'седемнадесет', 'осемнадесет', 'деветнадесет'];
    const tens = ['', 'десет', 'двадесет', 'тридесет', 'четиридесет', 'петдесет', 'шестдесет', 'седемдесет', 'осемдесет', 'деветдесет'];
    const hundreds = ['', 'сто', 'двеста', 'триста', 'четиристотин', 'петстотин', 'шестстотин', 'седемстотин', 'осемстотин', 'деветстотин'];
    
    function convertLessThanThousand(n, isFeminine = false) {
      let result = '';
      
      // Convert hundreds
      if (n >= 100) {
        result += hundreds[Math.floor(n / 100)];
        n %= 100;
        
        // Only add "и" if there are remaining digits
        if (n > 0) {
          result += ' и ';
        }
      }
      
      // Convert tens and units
      if (n >= 10 && n <= 19) {
        result += teens[n - 10];
      } else if (n >= 20) {
        result += tens[Math.floor(n / 10)];
        if (n % 10 > 0) {
          const unitList = isFeminine ? unitsF : units;
          result += ' и ' + unitList[n % 10];
        }
      } else if (n > 0) {
        const unitList = isFeminine ? unitsF : units;
        result += unitList[n];
      }
      
      return result.trim();
    }
    
    // Split number into integer and decimal parts
    const parts = num.toFixed(2).split('.');
    let intPart = parseInt(parts[0]);
    const decPart = parseInt(parts[1]);
    
    if (intPart === 0) return 'нула лева';
    
    let result = '';
    
    // Handle billions
    if (intPart >= 1000000000) {
      const billions = Math.floor(intPart / 1000000000);
      if (billions === 1) {
        result += 'един милиард';
      } else {
        result += convertLessThanThousand(billions) + ' милиарда';
      }
      intPart %= 1000000000;
      
      // Add space if there are remaining digits
      if (intPart > 0) {
        result += ' ';
      }
    }
    
    // Handle millions
    if (intPart >= 1000000) {
      const millions = Math.floor(intPart / 1000000);
      if (millions === 1) {
        result += 'един милион';
      } else {
        result += convertLessThanThousand(millions) + ' милиона';
      }
      intPart %= 1000000;
      
      // Add space if there are remaining digits
      if (intPart > 0) {
        result += ' ';
      }
    }
    
    // Handle thousands
    if (intPart >= 1000) {
      const thousands = Math.floor(intPart / 1000);
      if (thousands === 1) {
        result += 'хиляда';
      } else if (thousands === 2) {
        result += 'две хиляди';
      } else {
        result += convertLessThanThousand(thousands, true) + ' хиляди';
      }
      intPart %= 1000;
      
      // Add space if there are remaining digits, and "и" only if less than 100
      if (intPart > 0) {
        if (intPart < 100 || intPart % 100 === 0) {
          result += ' и ';
        } else {
          result += ' ';
        }
      }
    }
    
    // Handle hundreds, tens, and units
    if (intPart > 0) {
      result += convertLessThanThousand(intPart);
    }
    
    // Add 'leva' (Bulgarian currency)
    result += ' лева';
    
    // Add decimal part if not zero
    if (decPart > 0) {
      result += ' и ';
      if (decPart < 10) {
        result += convertLessThanThousand(decPart) + '0 стотинки';
      } else {
        result += convertLessThanThousand(decPart) + ' стотинки';
      }
    }
    
    return result.trim();
  }
  
  
  async function generateInvoicePDF(invoiceId, event) {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        font: path.join(__dirname, '../assets/fonts/condensed.ttf')
      });
      const currentY = doc.y;
      const logoPath = path.join(__dirname, '../assets/black.png'); // Adjust path as needed
      if (fs.existsSync(logoPath)) {
        // Position the logo at top left, with some margin from edges
        doc.image(logoPath, 20, 20, { 
          width: 70, // Adjust width as needed
          height: 70 // Adjust height as needed
        });
      }
      doc.y = currentY;
      const invoice = await new Promise((resolve, reject) => {
        db.get(
          `SELECT i.*, 
                  c.name AS customer_name, 
                  c.town AS customer_town,
                  c.street AS customer_street,
                  c.id_number AS customer_id_number,
                  c.dds_number AS customer_dds_number,
                  c.mol AS customer_mol,
                  comp.*
           FROM Invoice i
           JOIN Customer c ON i.customer_id = c.id
           JOIN Company comp ON 1=1
           WHERE i.id = ?
           LIMIT 1`,
          [invoiceId],
          (err, row) => err ? reject(err) : resolve(row)
        );        
      });
  
      const details = await new Promise((resolve, reject) => {
        db.all(
          `SELECT p.*, id.id as detail_id, id.amount, id.price, o.display_total
           FROM InvoiceDetail id
           JOIN Product p ON id.product_id = p.id
           LEFT JOIN InvoiceDetailOverrides o ON id.id = o.detail_id
           WHERE id.invoice_id = ?`,
          [invoiceId],
          (err, rows) => err ? reject(err) : resolve(rows)
        );
      });
  
      const fileName = `${invoice.number}.pdf`;
      const filePath = path.join(app.getPath('downloads'), fileName);
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);
  
      doc.font(path.join(__dirname, '../assets/fonts/condensed.ttf'));
  
      const pageHeight = doc.page.height - 80;
      const headerHeight = 150;
      const companyBoxHeight = 160;
      const footerHeight = 100;
      const rowHeight = 20;
      const tableHeaderHeight = 20;
      const totalsHeight = 60;
      const tableHeight = (details.length * rowHeight) + tableHeaderHeight + totalsHeight;
  
      const headerTop = 40;
      const companyBoxTop = headerTop + 100;
      const tableTop = companyBoxTop + 130;
  
      doc.fontSize(20).text('ФАКТУРА-ОРИГИНАЛ', { align: 'center' });
      doc.fontSize(12);
      doc.text(`№: ${invoice.number}`, { align: 'center' });
      doc.text(`Дата: ${formatDate(invoice.date)}`, { align: 'center' });
      
      // Calculate dimensions for the supplier and recipient boxes
      const boxWidth = 230;                // Width of each box
      const boxHeight = 110;               // Height to fit all content
      const supplierBoxX = 50;             // Reduced from 90 to start earlier
      const recipientBoxX = 300;           // Reduced from 340 to start earlier
      const boxY = companyBoxTop - 5;      // Just above the titles

      // Draw the supplier box (left)
      doc.rect(supplierBoxX, boxY, boxWidth, boxHeight)
        .stroke();

      // Draw the recipient box (right)
      doc.rect(recipientBoxX, boxY, boxWidth, boxHeight)
        .stroke();

      // Continue with existing text content
      doc.fontSize(12);
      doc.text('ДОСТАВЧИК', 120, companyBoxTop);
      doc.fontSize(8);
      doc.text(`Име: ${invoice.name}`, 60, companyBoxTop + 20);
      doc.text(`Град: ${invoice.town}`, 60, companyBoxTop + 32);
      doc.text(`Адрес: ${invoice.street}`, 60, companyBoxTop + 44);
      doc.text(`ЕИК: ${invoice.id_number}`, 60, companyBoxTop + 56);
      doc.text(`ИН по ДДС: ${invoice.dds_number}`, 60, companyBoxTop + 68);
      // doc.text(`BIC: ${invoice.bic_code}`, 100, companyBoxTop + 95);
      // doc.text(`IBAN: ${invoice.iban}`, 100, companyBoxTop + 110);
      doc.text(`М.О.Л.: ${invoice.mol}`, 60, companyBoxTop + 80);

      doc.fontSize(12);
      doc.text('ПОЛУЧАТЕЛ', 370, companyBoxTop);
      doc.fontSize(8);
      doc.text(`Име: ${invoice.customer_name}`, 310, companyBoxTop + 20);
      doc.text(`Град: ${invoice.customer_town || '-'}`, 310, companyBoxTop + 32);
      doc.text(`Адрес: ${invoice.customer_street || '-'}`, 310, companyBoxTop + 44);
      doc.text(`ЕИК: ${invoice.customer_id_number || '-'}`, 310, companyBoxTop + 56);
      doc.text(`ИН по ДДС: ${invoice.customer_dds_number || '-'}`, 310, companyBoxTop + 68);
      doc.text(`М.О.Л.: ${invoice.customer_mol || '-'}`, 310, companyBoxTop + 80);
  
      const tableHeaders = ['№', 'продукт', 'ед. цена', 'мярка', 'к-во', 'общо'];
      const colWidths = [30, 210, 60, 60, 40, 80];
      const tableWidth = 480; // Total width of the table

      // Draw table outline
      doc.fontSize(8);
      doc.rect(50, tableTop, tableWidth, 20).stroke(); // Header row border

      // Draw header text in black (no colored background)
      let currentX = 50;
      tableHeaders.forEach((header, i) => {
        doc.text(header, currentX + 5, tableTop + 5); // Add small padding
        currentX += colWidths[i];
        
        // Draw vertical border line for columns (except the last one)
        if (i < tableHeaders.length - 1) {
          doc.moveTo(currentX, tableTop)
            .lineTo(currentX, tableTop + 20)
            .stroke();
        }
      });

      // Table data rows
      let yPos = tableTop + tableHeaderHeight;
      details.forEach((item, idx) => {
        // Draw horizontal row border
        doc.moveTo(50, yPos)
          .lineTo(50 + tableWidth, yPos)
          .stroke();
        
        currentX = 50;
        const total = item.display_total !== null && item.display_total !== undefined ? 
                   item.display_total : 
                   item.price * item.amount;
        
        // Row data
        doc.text(idx + 1, currentX + 5, yPos + 5);
        
        currentX += colWidths[0];
        doc.moveTo(currentX, yPos).lineTo(currentX, yPos + rowHeight).stroke(); // Vertical line
        doc.text(item.product_name, currentX + 5, yPos + 5);
        
        currentX += colWidths[1];
        doc.moveTo(currentX, yPos).lineTo(currentX, yPos + rowHeight).stroke(); // Vertical line
        doc.text((item.price).toFixed(2), currentX + 5, yPos + 5);
        
        currentX += colWidths[2];
        doc.moveTo(currentX, yPos).lineTo(currentX, yPos + rowHeight).stroke(); // Vertical line
        doc.text(item.product_unit, currentX + 5, yPos + 5);
        
        currentX += colWidths[3];
        doc.moveTo(currentX, yPos).lineTo(currentX, yPos + rowHeight).stroke(); // Vertical line
        doc.text(item.amount, currentX + 5, yPos + 5);
        
        currentX += colWidths[4];
        doc.moveTo(currentX, yPos).lineTo(currentX, yPos + rowHeight).stroke(); // Vertical line
        doc.text(total.toFixed(2), currentX + 5, yPos + 5);
        
        // Draw outer vertical borders
        doc.moveTo(50, yPos).lineTo(50, yPos + rowHeight).stroke();
        doc.moveTo(50 + tableWidth, yPos).lineTo(50 + tableWidth, yPos + rowHeight).stroke();
        
        yPos += rowHeight;
      });

      // Draw bottom border of the table
      doc.moveTo(50, yPos)
        .lineTo(50 + tableWidth, yPos)
        .stroke();

      // Totals section with borders instead of color
      // After totals section and before bank account info
    const totalsTop = yPos + 0;
    doc.rect(50, totalsTop, tableWidth, 60).stroke(); // Border around totals

    // Add inner borders for the totals section
    doc.moveTo(50 + tableWidth/2, totalsTop)
      .lineTo(50 + tableWidth/2, totalsTop + 60)
      .stroke();

    // Add amount in words on the left side
    const amountInWords = numberToWordsBG(invoice.total);
    doc.fontSize(8); // Smaller font for potentially long text
    doc.text('Словом:', 155, totalsTop + 5);
    // Word-wrap the amount in words in the left rectangle
    doc.text(amountInWords, 55, totalsTop + 15, {
      width: (tableWidth/2) - 10,
      align: 'center'
    });
    doc.text(`ПЛАЩАНЕ: ${invoice.payment_type}`, 55, totalsTop + 40, {
      width: (tableWidth/2) - 10,
      align: 'center'
    });
    // Reset font size for totals
    doc.fontSize(8);

    // Totals text on the right side
    doc.text(`Данъчна основа: ${invoice.total_without_vat.toFixed(2)} лв.`, 385, totalsTop + 5);
    doc.text(`ДДС: ${(invoice.total - invoice.total_without_vat).toFixed(2)} лв.`, 385, totalsTop + 25);
    doc.text(`Сума за плащане: ${invoice.total} лв.`, 385, totalsTop + 45);
    
    // Add reason in a bordered rectangle if it exists
    const bankInfoTop = totalsTop + 70; // Position right after totals section with some margin
    
    if (invoice.reason && invoice.reason.trim()) {
      // Draw a bordered rectangle for the reason
      doc.rect(50, bankInfoTop, tableWidth, 30).stroke();
      
      doc.fontSize(8);
      doc.text('Основание:', 50, bankInfoTop + 5, {
        width: tableWidth,
        align: 'center'
      });
      
      doc.text(invoice.reason.trim(), 50, bankInfoTop + 15, {
        width: tableWidth,
        align: 'center'
      });
      
      // Adjust the bank info position to be after the reason box
      const adjustedBankInfoTop = bankInfoTop + 40;
      
      // Add bank account info
      doc.fontSize(8);
      doc.text(`СМЕТКА: IBAN: ${invoice.iban} - BIC: ${invoice.bic_code}`, 50, adjustedBankInfoTop, {
        width: tableWidth,
        align: 'center'
      });
      
      // Adjust footer position
      const footerTop = doc.page.height - 110;
      doc.fillColor('#000000');
      doc.fontSize(10);
      doc.text('Съставил: . . . . . . . . . . . . . . . . . . . . . . . .', 300, footerTop);
      doc.text(`/${invoice.mol || 'име, фамилия и подпис'}/`, 370, footerTop + 15);
  
      doc.fontSize(8);
      doc.text(`${invoice.name} | МОЛ: ${invoice.mol}`, 50, footerTop + 40, { align: 'center' });
      doc.text('Съгл. чл. 7 ал. 1 от ЗСч., ЗДДС и ППЗДДС печат и подпис не са задължителни реквизити на фактурата.', 50, footerTop + 55, { align: 'center' });
    } else {
      // If no reason, just add bank account info at the original position
      doc.fontSize(8);
      doc.text(`СМЕТКА: IBAN: ${invoice.iban} - BIC: ${invoice.bic_code}`, 50, bankInfoTop, {
        width: tableWidth,
        align: 'center'
      });
      
      const footerTop = doc.page.height - 110;
      doc.fillColor('#000000');
      doc.fontSize(10);
      doc.text('Съставил: . . . . . . . . . . . . . . . . . . . . . . . .', 300, footerTop);
      doc.text(`/${invoice.mol || 'име, фамилия и подпис'}/`, 370, footerTop + 15);
  
      doc.fontSize(8);
      doc.text(`${invoice.name} | МОЛ: ${invoice.mol}`, 50, footerTop + 40, { align: 'center' });
      doc.text('Съгл. чл. 7 ал. 1 от ЗСч., ЗДДС и ППЗДДС печат и подпис не са задължителни реквизити на фактурата.', 50, footerTop + 55, { align: 'center' });
    }
      doc.end();
      await new Promise(resolve => writeStream.on('finish', resolve));
      event.reply('notification', {
        type: 'success',
        message: `PDF файлът е запазен в ${filePath}`
      });
  
    } catch (error) {
      console.error('Error generating PDF:', error);
      event.reply('notification', {
        type: 'error',
        message: 'Грешка при генериране на PDF'
      });
    }
  }
  
  ipcMain.on('get-next-invoice-number', async (event) => {
    const number = await getNextInvoiceNumber();
    event.reply('get-next-invoice-number-response', number);
  });

  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  }

  // ipcMain.on('print-invoice', async (event, invoiceId) => {
  //   try {
  //     const invoice = await new Promise((resolve, reject) => {
  //       db.get(
  //         `SELECT i.*, 
  //                 c.name AS customer_name, 
  //                 c.town AS customer_town,
  //                 c.street AS customer_street,
  //                 c.id_number AS customer_id_number,
  //                 c.dds_number AS customer_dds_number,
  //                 c.mol AS customer_mol,
  //                 comp.*
  //          FROM Invoice i
  //          JOIN Customer c ON i.customer_id = c.id
  //          JOIN Company comp ON 1=1
  //          WHERE i.id = ?
  //          LIMIT 1`,
  //         [invoiceId],
  //         (err, row) => err ? reject(err) : resolve(row)
  //       );
  //     });
  
  //     const fileName = `${invoice.number}.pdf`;
  //     const filePath = path.join(app.getPath('downloads'), fileName);
      
  //     const doc = new PDFDocument({
  //       size: 'A4',
  //       margin: 40,
  //       font: path.join(__dirname, '../assets/fonts/condensed.ttf')
  //     });
  
  //     const writeStream = fs.createWriteStream(filePath);
  //     doc.pipe(writeStream);
  //     doc.font(path.join(__dirname, '../assets/fonts/condensed.ttf'));
  
  //     const details = await new Promise((resolve, reject) => {
  //       db.all(
  //         `SELECT p.*, id.amount, id.price
  //          FROM InvoiceDetail id
  //          JOIN Product p ON id.product_id = p.id
  //          WHERE id.invoice_id = ?`,
  //         [invoiceId],
  //         (err, rows) => err ? reject(err) : resolve(rows)
  //       );
  //     });
  
  //     const pageHeight = doc.page.height - 80;
  //     const headerHeight = 150;
  //     const companyBoxHeight = 160;
  //     const footerHeight = 100;
  //     const rowHeight = 20;
  //     const tableHeaderHeight = 20;
  //     const totalsHeight = 60;
  //     const tableHeight = (details.length * rowHeight) + tableHeaderHeight + totalsHeight;
  
  //     const headerTop = 40;
  //     const companyBoxTop = headerTop + 100;
  //     const tableTop = companyBoxTop + 140;
  
  //     doc.fontSize(20).text('ФАКТУРА-ОРИГИНАЛ', { align: 'center' });
  //     doc.fontSize(12);
  //     doc.text(`№: ${invoice.number}`, { align: 'center' });
  //     doc.text(`Дата: ${formatDate(invoice.date)}`, { align: 'center' });
      
  
  //     doc.fontSize(12);
  //     doc.text('ДОСТАВЧИК', 120, companyBoxTop);
  //     doc.fontSize(8);
  //     doc.text(invoice.name, 100, companyBoxTop + 20);
  //     doc.text(invoice.town, 100, companyBoxTop + 35);
  //     doc.text(invoice.street, 100, companyBoxTop + 50);
  //     doc.text(`ЕИК: ${invoice.id_number}`, 100, companyBoxTop + 65);
  //     doc.text(`ДДС №: ${invoice.dds_number}`, 100, companyBoxTop + 80);
  //     // doc.text(`BIC: ${invoice.bic_code}`, 100, companyBoxTop + 95);
  //     // doc.text(`IBAN: ${invoice.iban}`, 100, companyBoxTop + 110);
  //     // doc.text(`М.О.Л.: ${invoice.mol}`, 100, companyBoxTop + 125);
  
  //     doc.fontSize(12);
  //     doc.text('ПОЛУЧАТЕЛ', 370, companyBoxTop);
  //     doc.fontSize(8);
  //     doc.text(invoice.customer_name, 350, companyBoxTop + 20);
  //     doc.text(invoice.customer_town || '-', 350, companyBoxTop + 35);
  //     doc.text(invoice.customer_street || '-', 350, companyBoxTop + 50);
  //     doc.text(`ЕИК: ${invoice.customer_id_number || '-'}`, 350, companyBoxTop + 65);
  //     doc.text(`ДДС №: ${invoice.customer_dds_number || '-'}`, 350, companyBoxTop + 80);
  //     // doc.text(`М.О.Л.: ${invoice.customer_mol || '-'}`, 350, companyBoxTop + 95);
  
  //     const tableHeaders = ['№', 'продукт', 'ед. цена', 'мярка', 'к-во', 'ддс', 'основа', 'общо'];
  //     const colWidths = [30, 140, 60, 50, 40, 60, 60, 60];
  
  //     doc.rect(50, tableTop, 500, 20).fill('#767ca3');
  //     doc.fillColor('#FFFFFF');
  //     // Draw header text with center alignment
  //     let currentX = 50;
  //     tableHeaders.forEach((header, i) => {
  //       // Center align all headers
  //       doc.text(header, currentX, tableTop + 5, {
  //         width: colWidths[i],
  //         align: 'center'
  //       });
        
  //       currentX += colWidths[i];
        
  //       // Draw vertical border line for columns (except the last one)
  //       if (i < tableHeaders.length - 1) {
  //         doc.moveTo(currentX, tableTop)
  //           .lineTo(currentX, tableTop + 20)
  //           .stroke();
  //       }
  //     });
  
  //     doc.fillColor('#000000');
  //     let yPos = tableTop + tableHeaderHeight + 5;
  
  //     details.forEach((item, idx) => {
  //       currentX = 50;
  //       const total = item.price * item.amount;
  //       const base = total / 1.2;
  //       const vat = total - base;
  
  //       doc.text(idx + 1, currentX, yPos);
  //       doc.text(item.product_name, currentX += colWidths[0], yPos);
  //       doc.text(item.price.toFixed(2), currentX += colWidths[1], yPos);
  //       doc.text(item.product_unit, currentX += colWidths[2], yPos);
  //       doc.text(item.amount, currentX += colWidths[3], yPos);
  //       doc.text(vat.toFixed(2), currentX += colWidths[4], yPos);
  //       doc.text(base.toFixed(2), currentX += colWidths[5], yPos);
  //       doc.text(total.toFixed(2), currentX += colWidths[6], yPos);
  
  //       yPos += rowHeight;
  //     });
  
  //     const totalsTop = yPos + 10;
  //     doc.rect(50, totalsTop, 500, 60).fill('#767ca3');
  //     doc.fillColor('#FFFFFF');
  //     doc.text(`Данъчна основа: ${invoice.total_without_vat.toFixed(2)} лв.`, 350, totalsTop + 5);
  //     doc.text(`ДДС: ${(invoice.total - invoice.total_without_vat).toFixed(2)} лв.`, 350, totalsTop + 25);
  //     doc.text(`Сума за плащане: ${invoice.total.toFixed(2)} лв.`, 350, totalsTop + 45);
  
  //     const footerTop = doc.page.height - 110;
  //     doc.fillColor('#000000');
  //     doc.fontSize(10);
  //     doc.text('Съставил: . . . . . . . . . . . . . . . . . . . . . . . . . . . .', 300, footerTop);
  //     doc.text(`/${invoice.mol || 'име, фамилия и подпис'}/`, 360, footerTop + 15);
  //     doc.fontSize(8);
  //     doc.text(`${invoice.name} | МОЛ: ${invoice.mol}`, 50, footerTop + 40, { align: 'center' });
  //     doc.text('Фактурата е валидна без подпис и печат съгласно чл.7 от Закона за счетоводството', 50, footerTop + 55, { align: 'center' });
  
  //     doc.end();
  //     await new Promise(resolve => writeStream.on('finish', resolve));
  
  //     const { shell } = require('electron');
  //     await shell.openPath(filePath);
  
  //     event.reply('notification', {
  //       type: 'success',
  //       message: 'Фактурата е отворена за преглед и печат'
  //     });
  
  //   } catch (error) {
  //     console.error('Error handling invoice:', error);
  //     event.reply('notification', {
  //       type: 'error',
  //       message: 'Грешка при обработка на фактурата'
  //     });
  //   }
  // });
  
// Add this handler for database backup
ipcMain.on('backup-database', (event) => {
  try {
    const dbPath = path.join(__dirname, '../db.sqlite3');
    const downloadsPath = app.getPath('downloads');
    const date = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupFileName = `db.sqlite3`;
    const backupPath = path.join(downloadsPath, backupFileName);
    
    // Simple file copy instead of zip
    fs.copyFileSync(dbPath, backupPath);
    
    event.reply('backup-database-response', {
      type: 'success',
      message: `База данни архивирана успешно в ${backupPath}`,
      path: backupPath
    });
  } catch (error) {
    console.error('Backup error:', error);
    event.reply('backup-database-response', {
      type: 'error',
      message: `Грешка при архивиране: ${error.message}`
    });
  }
});

// Add handler to open folder when user confirms
ipcMain.on('open-folder', (event, folderPath) => {
  shell.showItemInFolder(folderPath);
});
  
async function exportToExcel(table, event) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(table);
  
  const query = `SELECT * FROM ${table} WHERE is_deleted = 0`;
  
  db.all(query, [], async (err, rows) => {
    if (err) {
      event.reply('notification', {
        type: 'error',
        message: 'Грешка при експорт'
      });
      return;
    }

    // Add headers
    const headers = Object.keys(rows[0]);
    worksheet.addRow(headers);

    // Add data
    rows.forEach(row => {
      worksheet.addRow(Object.values(row));
    });

    const fileName = `${table}_${Date.now()}.xlsx`;
    const filePath = path.join(app.getPath('downloads'), fileName);
    
    await workbook.xlsx.writeFile(filePath);
    
    event.reply('notification', {
      type: 'success',
      message: `Excel файлът е запазен в ${filePath}`
    });
  });
}

ipcMain.on('save-company-settings', (event, companyData) => {
    // First delete any existing company data
    db.run(`DELETE FROM Company`, [], (err) => {
      if (err) {
        event.reply('company-settings-saved', {
          type: 'error',
          message: 'Грешка при запазване на настройките'
        });
        return;
      }
      
      // Then insert new company data
      db.run(
        `INSERT INTO Company (name, town, street, id_number, dds_number, iban, bic_code, mol) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [companyData.name, companyData.town, companyData.street, companyData.id_number, 
         companyData.dds_number, companyData.iban, companyData.bic_code, companyData.mol],
        (err) => {
          event.reply('company-settings-saved', {
            type: err ? 'error' : 'success',
            message: err ? 'Грешка при запазване' : 'Настройките са запазени успешно'
          });
        }
      );
    });
  });

  ipcMain.on('get-company-settings', (event) => {
    db.get(`SELECT * FROM Company LIMIT 1`, [], (err, row) => {
      event.reply('company-settings-loaded', err ? null : row);
    });
  });

  ipcMain.on('edit-customer', (event, customer) => {
    db.run(
      `UPDATE Customer SET name = ?, town = ?, street = ?, id_number = ?, dds_number = ?, mol = ? WHERE id = ?`,
      [customer.name, customer.town, customer.street, customer.id_number, customer.dds_number, customer.mol, customer.id],
      (err) => {
        event.reply('notification', {
          type: err ? 'error' : 'success',
          message: err ? 'Грешка при редактиране' : 'Успешно редактиран клиент'
        });
        if (!err) {
          loadCustomers(event);
        }
      }
    );
  });
  
  // Handler to get a single product
ipcMain.on('get-product', (event, id) => {
    db.get(`SELECT * FROM Product WHERE id = ? AND product_is_delete = 0`, [id], (err, row) => {
      event.reply('get-product-response', err ? null : row);
    });
  });
  
  // Handler to update a product
  ipcMain.on('edit-product', (event, product) => {
    db.run(
      `UPDATE Product SET product_name = ?, product_price = ?, product_unit = ? WHERE id = ?`,
      [product.name, product.price, product.unit, product.id],
      (err) => {
        event.reply('notification', {
          type: err ? 'error' : 'success',
          message: err ? 'Грешка при редактиране на продукт' : 'Успешно редактиран продукт'
        });
        if (!err) {
          loadProducts(event);
        }
      }
    );
  });
  
  function createSplashScreen() {
    splashScreen = new BrowserWindow({
      width: 400,
      height: 400,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      center: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      }
    });
    
    splashScreen.loadFile('renderer/splash.html');
    splashScreen.on('closed', () => splashScreen = null);
  }

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.loadFile('renderer/index.html');
  win.maximize();
  // win.webContents.openDevTools();

  win.once('ready-to-show', () => {
    if (splashScreen) {
      splashScreen.close();
    }
    win.show();
  });
  
  win.on('closed', () => {
    win = null;
  });
}

app.whenReady().then(() => {
  createSplashScreen();
  // Add a small delay before loading the main window
  setTimeout(createWindow, 1500); // 1.5 seconds delay
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
