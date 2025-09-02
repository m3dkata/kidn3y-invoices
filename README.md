# ФактуриBG - Invoice Management Application

A modern, user-friendly desktop application for managing invoices, products, and customers. Built with Electron and designed specifically for Bulgarian businesses.

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows-brightgreen.svg)
![Language](https://img.shields.io/badge/language-Bulgarian-orange.svg)

## 📋 Features

### 🏦 Company Management
- Store company information (name, address, EIK, DDS number, IBAN, BIC, MOL)
- Professional invoice generation with company branding

### 🧾 Invoice Management
- Create, edit, and delete invoices
- Automatic invoice numbering with sequential generation
- Support for different payment types (cash, bank transfer)
- Add custom reasons/invoice purposes
- Professional PDF invoice generation
- VAT calculation (20% for Bulgarian businesses)
- Amount in words (Bulgarian language support)

### 📦 Product Management
- Create and manage product catalog
- Set product prices and units of measurement
- Edit and delete products
- Export products to Excel

### 👥 Customer Management
- Manage customer database
- Store customer details (name, address, EIK, DDS, MOL)
- Create new customers directly from invoice creation
- Edit and delete customers
- Export customers to Excel

### 💾 Data Management
- SQLite database for reliable data storage
- Database backup functionality
- Export data to Excel format
- Secure data handling with proper validation

### 🎨 User Interface
- Modern, intuitive interface with sidebar navigation
- Responsive card-based layouts
- Professional styling with Bulgarian language support
- Splash screen on application startup
- Real-time notifications for user actions

## 🚀 Installation

### Prerequisites
- Node.js (v12 or higher)
- npm (comes with Node.js)

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/kidn3y-invoices.git
   cd kidn3y-invoices
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   npm start
   ```

### Building for Production

```bash
# Build for 32-bit Windows
npm run build-win32

# Build for 64-bit Windows
npm run build-win64
```

## 📁 Project Structure

```
kidn3y-invoices/
├── main/
│   └── main.js              # Main Electron process
├── renderer/
│   ├── index.html           # Main HTML file
│   ├── app.js               # Frontend JavaScript logic
│   ├── styles.css           # Application styles
│   └── splash.html          # Splash screen
├── assets/
│   ├── fonts/               # Custom fonts
│   ├── icon.ico             # Application icon
│   ├── icon.png             # Application icon
│   └── black.png            # Company logo
├── package.json             # Project configuration
└── README.md                # This file
```

## 🔧 Technologies Used

### Core Technologies
- **Electron** - Cross-platform desktop application framework
- **SQLite3** - Lightweight database engine
- **PDFKit** - PDF generation library
- **ExcelJS** - Excel file manipulation

### Frontend
- **HTML5** - Markup structure
- **CSS3** - Styling with modern CSS features
- **JavaScript (ES6+)** - Frontend logic
- **Font Awesome** - Icon library

## 📖 Usage Guide

### Getting Started
1. Launch the application using `npm start`
2. Configure your company information in the Settings section
3. Add products to your product catalog
4. Add customers to your customer database
5. Start creating invoices!

### Creating an Invoice
1. Click "Нова Фактура" (New Invoice)
2. Enter invoice date or use current date
3. Select payment type (cash or bank transfer)
4. Choose an existing customer or create a new one
5. Add products to the invoice
6. Review totals and save
7. Generate PDF for printing

### Managing Data
- Use the export buttons to save data as Excel files
- Click the backup button to create database backups
- All data is stored locally in SQLite database

## 🎨 Screenshots

*(Note: Add actual screenshots here when available)*

- **Main Dashboard**: Overview of invoices, products, and customers
- **Invoice Creation**: Form for creating new invoices
- **PDF Invoice**: Generated invoice in PDF format
- **Settings**: Company configuration panel

## 🛡️ Security & Privacy

- All data is stored locally on your computer
- No cloud storage or external data transmission
- Database files are backed up regularly
- User authentication is handled locally

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- PDF generation powered by [PDFKit](https://pdfkit.org/)
- Excel export using [ExcelJS](https://github.com/exceljs/exceljs)
- Icons from [Font Awesome](https://fontawesome.com/)

## 📞 Support

If you encounter any issues or have questions, please:
1. Check the documentation
2. Search existing issues
3. Create a new issue with detailed description

---

**ФактуриBG** - Making invoice management simple and professional for Bulgarian businesses! 🇧🇬