const { ipcRenderer } = require('electron');

function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(section => {
    section.style.display = 'none';
  });
  document.getElementById(sectionId).style.display = 'block';
  
  if (sectionId === 'products') loadProducts();
  if (sectionId === 'customers') loadCustomers();
  if (sectionId === 'invoices') loadInvoices();
}

// Products
function showCreateProductForm() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Нов Продукт</h2>
      <input type="text" id="product-name" placeholder="Име на продукта">
      <input type="number" id="product-price" step="0.01" placeholder="Цена">
      <input type="text" id="product-unit" placeholder="Мерна единица">
      <div class="button-group">
        <button onclick="saveProduct()">Запази</button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()">Отказ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = 'block';
}

function saveProduct() {
  const name = document.getElementById('product-name').value;
  const price = document.getElementById('product-price').value;
  const unit = document.getElementById('product-unit').value;
  if (name && price && unit) {
    ipcRenderer.send('create-product', { name, price, unit });
  }
}

function loadProducts() {
  ipcRenderer.send('get-products');
}

function editProduct(id) {
  // Fetch the product data from the database
  ipcRenderer.send('get-product', id);
}

// Listen for the response with the product data
ipcRenderer.on('get-product-response', (event, product) => {
  if (!product) {
    showNotification('Продуктът не е намерен', 'error');
    return;
  }

  // Create a modal to edit the product
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Редактиране на Продукт</h2>
      <input type="text" id="edit-product-name" placeholder="Име на продукта" value="${product.product_name}">
      <input type="number" id="edit-product-price" step="0.01" placeholder="Цена" value="${product.product_price}">
      <input type="text" id="edit-product-unit" placeholder="Мерна единица" value="${product.product_unit}">
      <div class="button-group">
        <button onclick="saveEditedProduct(${product.id})">Запази</button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()">Отказ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = 'block';
});

function saveEditedProduct(id) {
  const productData = {
    id: id,
    name: document.getElementById('edit-product-name').value,
    price: document.getElementById('edit-product-price').value,
    unit: document.getElementById('edit-product-unit').value
  };

  ipcRenderer.send('edit-product', productData);
  document.querySelector('.modal').remove();
}


function deleteProduct(id) {
  if (confirm('Сигурни ли сте, че искате да изтриете този продукт?')) {
    ipcRenderer.send('delete-product', id);
  }
}

// Customers
// Customer functions
function showCreateCustomerForm() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Нов Клиент</h2>
      <input type="text" id="customer-name" placeholder="Име на фирмата" required>
      <input type="text" id="customer-town" placeholder="Град" required>
      <input type="text" id="customer-street" placeholder="Адрес">
      <input type="text" id="customer-id" placeholder="ЕИК">
      <input type="text" id="customer-dds" placeholder="ДДС Номер">
      <input type="text" id="customer-mol" placeholder="МОЛ">
      <div class="button-group">
        <button onclick="saveCustomer()">Запази</button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()">Отказ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function saveCustomer() {
  const customerData = {
    name: document.getElementById('customer-name').value,
    town: document.getElementById('customer-town').value,
    street: document.getElementById('customer-street').value,
    id_number: document.getElementById('customer-id').value,
    dds_number: document.getElementById('customer-dds').value,
    mol: document.getElementById('customer-mol').value
  };

  if (!customerData.name || !customerData.town) {
    showNotification('Моля попълнете задължителните полета', 'error');
    return;
  }

  ipcRenderer.send('create-customer', customerData);
}

function loadCustomers() {
  ipcRenderer.send('get-customers');
}

function deleteCustomer(id) {
  if (confirm('Сигурни ли сте, че искате да изтриете този клиент?')) {
    ipcRenderer.send('delete-customer', id);
  }
}

function loadCustomers() {
  ipcRenderer.send('get-customers');
}

ipcRenderer.on('get-customers-response', (event, customers) => {
  const customerList = document.getElementById('customer-list');
  
  // Clear existing content
  customerList.innerHTML = '';
  
  // Add grid styling to the container
  customerList.style.display = 'grid';
  customerList.style.gridTemplateColumns = 'repeat(4, 1fr)';
  customerList.style.gap = '20px';
  customerList.style.padding = '20px';
  
  // Create a card for each customer
  customers.forEach(customer => {
    const card = document.createElement('div');
    card.className = 'customer-card';
    card.style.backgroundColor = '#f9f9f9';
    card.style.borderRadius = '8px';
    card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    card.style.padding = '15px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.height = '100%';
    card.style.minHeight = '180px';
    card.style.border = '1px solid #ddd';
    card.style.boxSizing = 'border-box';
    card.style.position = 'relative';
    card.style.transition = 'transform 0.2s, box-shadow 0.2s';
    
    // Add hover effect to the entire card
    card.addEventListener('mouseover', () => {
      card.style.transform = 'translateY(-5px)';
      card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    });
    
    card.addEventListener('mouseout', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    });
    
    // Customer info
    const customerInfo = document.createElement('div');
    customerInfo.style.flex = '1';
    customerInfo.style.marginBottom = '15px';
    
    // Customer name - larger and bold
    const customerName = document.createElement('h3');
    customerName.textContent = customer.name;
    customerName.style.margin = '0 0 10px 0';
    customerName.style.fontSize = '18px';
    customerName.style.color = '#333';
    
    // Customer location with icon
    const locationDiv = document.createElement('div');
    locationDiv.style.display = 'flex';
    locationDiv.style.alignItems = 'center';
    locationDiv.style.marginBottom = '8px';
    locationDiv.innerHTML = `
      <i class="fas fa-map-marker-alt" style="color: #666; margin-right: 8px;"></i>
      <span style="color: #666;">${customer.town || 'Не е посочен'}</span>
    `;
    
    // Optional: Add more customer details if available
    let detailsHTML = '';
    
    if (customer.street) {
      detailsHTML += `
        <div style="margin-bottom: 5px; color: #777; font-size: 14px;">
          <i class="fas fa-road" style="width: 16px; margin-right: 8px;"></i>
          ${customer.street}
        </div>
      `;
    }
    
    if (customer.id_number) {
      detailsHTML += `
        <div style="margin-bottom: 5px; color: #777; font-size: 14px;">
          <i class="fas fa-id-card" style="width: 16px; margin-right: 8px;"></i>
          ЕИК: ${customer.id_number}
        </div>
      `;
    }
    
    const detailsDiv = document.createElement('div');
    detailsDiv.innerHTML = detailsHTML;
    detailsDiv.style.marginTop = '10px';
    
    customerInfo.appendChild(customerName);
    customerInfo.appendChild(locationDiv);
    customerInfo.appendChild(detailsDiv);
    
    // Action buttons at the bottom
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    actions.style.display = 'flex';
    actions.style.justifyContent = 'center';
    actions.style.borderTop = '1px solid #eee';
    actions.style.paddingTop = '15px';
    actions.style.marginTop = 'auto';
    actions.innerHTML = `
      <button class="action-btn edit-btn" onclick="editCustomer(${customer.id})" 
        style="margin-right: 15px; background: none; border: 1px solid transparent; cursor: pointer; color: #008000; padding: 8px 15px; border-radius: 4px; transition: all 0.2s ease;">
        <i class="fas fa-edit"></i> Редактирай
      </button>
      <button class="action-btn delete-btn" onclick="deleteCustomer(${customer.id})" 
        style="background: none; border: 1px solid transparent; cursor: pointer; color: #cc0000; padding: 8px 15px; border-radius: 4px; transition: all 0.2s ease;">
        <i class="fas fa-trash"></i> Изтрий
      </button>
    `;
    
    // Add hover effects with event listeners
    const buttons = actions.querySelectorAll('button');
    buttons.forEach(button => {
      if (button.classList.contains('edit-btn')) {
        button.addEventListener('mouseover', () => {
          button.style.border = '1px solid #008000';
          button.style.backgroundColor = 'rgba(0, 128, 0, 0.05)';
        });
        button.addEventListener('mouseout', () => {
          button.style.border = '1px solid transparent';
          button.style.backgroundColor = 'transparent';
        });
      } else if (button.classList.contains('delete-btn')) {
        button.addEventListener('mouseover', () => {
          button.style.border = '1px solid #cc0000';
          button.style.backgroundColor = 'rgba(204, 0, 0, 0.05)';
        });
        button.addEventListener('mouseout', () => {
          button.style.border = '1px solid transparent';
          button.style.backgroundColor = 'transparent';
        });
      }
    });
    
    // Assemble the card
    card.appendChild(customerInfo);
    card.appendChild(actions);
    
    // Add the card to the container
    customerList.appendChild(card);
  });
  
  // If no customers, show a message
  if (customers.length === 0) {
    customerList.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
        <p style="color: #666; font-size: 16px;">Няма намерени клиенти</p>
      </div>
    `;
  }
});


function editCustomer(id) {
  // Fetch the customer data from the database
  ipcRenderer.send('get-customer', id);
}

// Listen for the response with the customer data
ipcRenderer.on('get-customer-response', (event, customer) => {
  if (!customer) {
    showNotification('Клиентът не е намерен', 'error');
    return;
  }

  // Create a modal to edit the customer
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Редактиране на Клиент</h2>
      <input type="text" id="edit-customer-name" placeholder="Име на фирмата" value="${customer.name}">
      <input type="text" id="edit-customer-town" placeholder="Град" value="${customer.town}">
      <input type="text" id="edit-customer-street" placeholder="Адрес" value="${customer.street}">
      <input type="text" id="edit-customer-id" placeholder="ЕИК" value="${customer.id_number}">
      <input type="text" id="edit-customer-dds" placeholder="ДДС Номер" value="${customer.dds_number}">
      <input type="text" id="edit-customer-mol" placeholder="МОЛ" value="${customer.mol}">
      <div class="button-group">
        <button onclick="saveEditedCustomer(${customer.id})">Запази</button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()">Отказ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = 'block';
});

function saveEditedCustomer(id) {
  const customerData = {
    id: id,
    name: document.getElementById('edit-customer-name').value,
    town: document.getElementById('edit-customer-town').value,
    street: document.getElementById('edit-customer-street').value,
    id_number: document.getElementById('edit-customer-id').value,
    dds_number: document.getElementById('edit-customer-dds').value,
    mol: document.getElementById('edit-customer-mol').value
  };

  ipcRenderer.send('edit-customer', customerData);
  document.querySelector('.modal').remove();
}


// Invoices
ipcRenderer.on('get-next-invoice-number-response', (event, number) => {
  document.getElementById('invoice-number').value = number;
});

// Add this new function to handle creating a product from the invoice form
function showCreateProductFormFromInvoice() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  // Use a higher z-index to appear above the invoice modal
  modal.style.zIndex = '1001';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Нов Продукт</h2>
      <input type="text" id="product-name" placeholder="Име на продукта">
      <input type="number" id="product-price" step="0.01" placeholder="Цена">
      <input type="text" id="product-unit" placeholder="Мерна единица">
      <div class="button-group">
        <button onclick="saveProductFromInvoice()">Запази</button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()">Отказ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = 'block';
}

function saveProductFromInvoice() {
  const name = document.getElementById('product-name').value;
  const price = document.getElementById('product-price').value;
  const unit = document.getElementById('product-unit').value;
  if (name && price && unit) {
    ipcRenderer.send('create-product', { name, price, unit });
    
    // Add a listener for the product creation success to refresh the dropdowns
    const refreshHandler = (event, notification) => {
      if (notification.type === 'success') {
        // Remove this one-time handler
        ipcRenderer.removeListener('notification', refreshHandler);
        // Refresh the product list in all dropdowns
        ipcRenderer.send('get-products');
        // Close the product creation modal
        document.querySelector('.modal[style*="z-index: 1001"]').remove();
      }
    };
    
    ipcRenderer.once('notification', refreshHandler);
  }
}

function showCreateInvoiceForm() {
  ipcRenderer.send('get-customers');
  ipcRenderer.send('get-products');
  ipcRenderer.send('get-next-invoice-number');

  // Format date as dd/mm/yyyy
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  const formattedDate = `${year}-${month}-${day}`;

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Нова Фактура</h2>
      
      <div class="invoice-header" style="display: flex; gap: 10px; margin-bottom: 15px;">
        <div class="invoice-number-group" style="flex: 1;">
          <label>Номер:</label>
          <input type="text" id="invoice-number" style="width: 100%; box-sizing: border-box;">
        </div>
        <div class="invoice-date-group" style="flex: 1;">
          <label>Дата:</label>
          <input type="date" id="invoice-date" value="${formattedDate}" style="width: 100%; box-sizing: border-box;">
        </div>
      </div>
      
      <div class="payment-type" style="display: flex; align-items: center; margin-bottom: 15px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
        <label style="margin-right: 15px; font-weight: bold;">Плащане:</label>
        
        <div style="display: flex; align-items: center; margin-right: 20px;">
          <input type="radio" id="cash" name="payment" value="В БРОЙ" style="margin-right: 5px; width: 16px; height: 16px; visibility: visible; opacity: 1;">
          <label for="cash" style="font-size: 0.9rem; white-space: nowrap;">В БРОЙ</label>
        </div>
        
        <div style="display: flex; align-items: center;">
          <input type="radio" id="transfer" name="payment" value="БАНКОВ ПРЕВОД" style="margin-right: 5px; width: 16px; height: 16px; visibility: visible; opacity: 1;">
          <label for="transfer" style="font-size: 0.9rem; white-space: nowrap;">С ПРЕВОД</label>
        </div>
      </div>

      <div class="reason-section" style="margin-bottom: 15px;">
        <label for="invoice-reason" style="display: block; margin-bottom: 5px;">Основание:</label>
        <textarea id="invoice-reason" style="width: 100%; padding: 8px; min-height: 60px; resize: vertical;"></textarea>
      </div>

      <div class="customer-section" style="margin-bottom: 15px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <select id="invoice-customer" style="flex: 1;"></select>
          <div style="display: flex; align-items: center;">
            <input type="checkbox" id="new-customer-checkbox" style="margin-right: 5px; width: 16px; height: 16px;">
            <label for="new-customer-checkbox">Нов клиент</label>
          </div>
        </div>
        
        <div id="new-customer-fields" style="display: none; background-color: #f5f5f5; padding: 10px; border-radius: 5px;">
          <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 14px;">Данни за нов клиент</h3>
          <input type="text" id="new-customer-name" placeholder="Име на фирмата" style="margin-bottom: 5px; width: 100%;">
          <input type="text" id="new-customer-town" placeholder="Град" style="margin-bottom: 5px; width: 100%;">
          <input type="text" id="new-customer-street" placeholder="Адрес" style="margin-bottom: 5px; width: 100%;">
          <input type="text" id="new-customer-id" placeholder="ЕИК" style="margin-bottom: 5px; width: 100%;">
          <input type="text" id="new-customer-dds" placeholder="ДДС Номер" style="margin-bottom: 5px; width: 100%;">
          <input type="text" id="new-customer-mol" placeholder="МОЛ" style="width: 100%;">
        </div>
      </div>
      
      <div id="invoice-products">
      <div style="display: flex; gap: 10px; margin-top: 10px; margin-bottom: 10px;">
        <button onclick="addProductRow()">Добави Продукт</button>
        <button onclick="showCreateProductFormFromInvoice()">Нов Продукт</button>
      </div>
      <div id="product-rows"></div>
    </div>
      
      <div class="totals">
        <input type="number" style="display: none" id="invoice-total" step="0.01" placeholder="Обща сума" readonly>
        <input type="number" style="display: none" id="invoice-total-without-vat" step="0.01" placeholder="Сума без ДДС" readonly>
      </div>
      
      <div class="button-group" style="margin-top: 20px;">
        <button onclick="saveInvoice()">Запази</button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()">Отказ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = 'block';
  
  // Add event listener for the checkbox
  document.getElementById('new-customer-checkbox').addEventListener('change', function() {
    const newCustomerFields = document.getElementById('new-customer-fields');
    const customerSelect = document.getElementById('invoice-customer');
    
    if (this.checked) {
      newCustomerFields.style.display = 'block';
      customerSelect.disabled = true;
    } else {
      newCustomerFields.style.display = 'none';
      customerSelect.disabled = false;
    }
  });
}




ipcRenderer.on('get-customers-response', (event, customers) => {
  const customerSelect = document.getElementById('invoice-customer');
  if (customerSelect) {
    customerSelect.innerHTML = '<option value="">Клиент</option>';
    customers.forEach(customer => {
      customerSelect.innerHTML += `
        <option value="${customer.id}">${customer.name}</option>
      `;
    });
  }
});

function updateTotals() {
  let totalWithoutVAT = 0;

  document.querySelectorAll('.product-row').forEach(row => {
    const productSelect = row.querySelector('.invoice-product');
    const amountInput = row.querySelector('.product-amount');
    let priceWithVAT = parseFloat(productSelect.selectedOptions[0].getAttribute('data-price')) || 0;
    let priceWithoutVAT = priceWithVAT / 1.20; // Convert price to exclude VAT
    const amount = parseFloat(amountInput.value) || 0;
    
    // Calculate the row total normally
    totalWithoutVAT += priceWithVAT * amount;
  
    const productPriceElement = row.querySelector('.product-price');
    if (productPriceElement) {
      productPriceElement.textContent = priceWithoutVAT.toFixed(2);
    }
  });
  
  // Round the base amount to the nearest integer
totalWithoutVAT = totalWithoutVAT;

// Calculate VAT based on the rounded base amount
const vat = totalWithoutVAT * 0.20;

// Calculate total as sum of rounded components
const total = totalWithoutVAT + vat;
  
  document.getElementById('invoice-total').value = total.toFixed(2);
  document.getElementById('invoice-total-without-vat').value = totalWithoutVAT.toFixed(2);
}


// Update the get-products-response handler to show price/unit as requested
ipcRenderer.on('get-products-response', (event, products) => {
  const productOptions = products.map(product => 
    `<option value="${product.id}" data-price="${product.product_price}">
      ${product.product_name} - ${product.product_price} лв/${product.product_unit}
     </option>`
  ).join('');
  
  document.querySelectorAll('.invoice-product').forEach(select => {
    select.innerHTML = productOptions;
  });
});

function addProductRow() {
  const row = document.createElement('div');
  row.className = 'product-row';
  row.innerHTML = `
    <select class="invoice-product" onchange="updateTotals()"></select>
    <input type="number" class="product-amount" placeholder="Количество" onchange="updateTotals()">
    <button class="delete-btn" onclick="this.parentElement.remove(); updateTotals();">
      <i class="fas fa-trash"></i>
    </button>
  `;
  document.getElementById('product-rows').appendChild(row);
  
  // Instead of reloading all products which resets existing selections,
  // just populate this new row with the existing product list
  const newSelect = row.querySelector('.invoice-product');
  const existingOptions = document.querySelector('.invoice-product')?.innerHTML;
  
  if (existingOptions) {
    // Re-use existing options if available
    newSelect.innerHTML = existingOptions;
  } else {
    // Only request products if this is the first row
    ipcRenderer.send('get-products');
  }
}


function saveInvoice() {
  const isNewCustomer = document.getElementById('new-customer-checkbox').checked;
  const customerId = document.getElementById('invoice-customer').value;
  
  // Validate customer information
  if (!isNewCustomer && !customerId) {
    showNotification('Моля изберете клиент!', 'error');
    return;
  }
  
  if (isNewCustomer) {
    const customerName = document.getElementById('new-customer-name').value;
    const customerTown = document.getElementById('new-customer-town').value;
    
    if (!customerName || !customerTown) {
      showNotification('Моля въведете име и град на новия клиент!', 'error');
      return;
    }
  }
  
  const products = Array.from(document.getElementsByClassName('product-row'));
  if (products.length === 0) {
    showNotification('Моля добавете Продукти и тяхно количество!', 'error');
    return;
  }
  
  const hasEmptyAmount = products.some(row => {
    const amount = row.querySelector('.product-amount').value;
    return !amount || amount <= 0;
  });

  if (hasEmptyAmount) {
    showNotification('Моля въведете количество за продуктите!', 'error');
    return;
  }
  
  // Check if payment type is selected
  const paymentType = document.querySelector('input[name="payment"]:checked')?.value;
  if (!paymentType) {
    showNotification('Моля изберете начин на плащане!', 'error');
    return;
  }
  
  // Prepare new customer data if the checkbox is checked
  let newCustomerData = null;
  if (isNewCustomer) {
    newCustomerData = {
      name: document.getElementById('new-customer-name').value,
      town: document.getElementById('new-customer-town').value,
      street: document.getElementById('new-customer-street').value,
      id_number: document.getElementById('new-customer-id').value,
      dds_number: document.getElementById('new-customer-dds').value,
      mol: document.getElementById('new-customer-mol').value
    };
  }
  
  const invoiceData = {
    number: document.getElementById('invoice-number').value,
    date: document.getElementById('invoice-date').value,
    payment_type: paymentType,
    customer_id: isNewCustomer ? null : customerId,
    new_customer: newCustomerData,
    total: parseFloat(document.getElementById('invoice-total').value),
    total_without_vat: parseFloat(document.getElementById('invoice-total-without-vat').value),
    reason: document.getElementById('invoice-reason').value,
    products: Array.from(document.getElementsByClassName('product-row')).map(row => ({
      product_id: row.querySelector('.invoice-product').value,
      amount: parseFloat(row.querySelector('.product-amount').value),
      price: parseFloat(row.querySelector('.invoice-product').selectedOptions[0].getAttribute('data-price'))
    }))
  };
  
  ipcRenderer.send('create-invoice', invoiceData);
}



function loadInvoices() {
  ipcRenderer.send('get-invoices');
}

function printInvoice(id) {
  ipcRenderer.send('print-invoice', id);
}
function deleteInvoice(id) {
  if (confirm('Сигурни ли сте, че искате да изтриете тази фактура?')) {
    ipcRenderer.send('delete-invoice', id);
  }
}

// Listen for the response after attempting to delete an invoice
ipcRenderer.on('delete-invoice-response', (event, { type, message }) => {
  showNotification(message, type);
  if (type === 'success') {
    loadInvoices(); // Refresh the invoice list after a successful delete
  }
});

// Export functions
function exportProductsToExcel() {
  ipcRenderer.send('export-products');
}

function exportCustomersToExcel() {
  ipcRenderer.send('export-customers');
}

function exportInvoicesToExcel() {
  ipcRenderer.send('export-invoices');
}

// Event listeners
ipcRenderer.on('notification', (event, { type, message }) => {
  showNotification(message, type);
  if (type === 'success') {
    // Find and remove the modal from the DOM
    const modal = document.querySelector('.modal');
    if (modal) {
      modal.style.display = 'none';
      modal.remove();
    }
  }
});


function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  showSection('invoices');
});

function showCompanySettings() {
  ipcRenderer.send('get-company-settings');
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Фирмени Данни</h2>
      <input type="text" id="company-name" placeholder="Име на фирмата">
      <input type="text" id="company-town" placeholder="Град">
      <input type="text" id="company-street" placeholder="Адрес">
      <input type="text" id="company-id" placeholder="ЕИК">
      <input type="text" id="company-dds" placeholder="ДДС Номер">
      <input type="text" id="company-iban" placeholder="IBAN">
      <input type="text" id="company-bic" placeholder="BIC">
      <input type="text" id="company-mol" placeholder="МОЛ">
      <div class="button-group">
        <button onclick="saveCompanySettings()">Запази</button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()">Отказ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = 'block';
}

ipcRenderer.on('company-settings-loaded', (event, data) => {
  if (data) {
    document.getElementById('company-name').value = data.name || '';
    document.getElementById('company-town').value = data.town || '';
    document.getElementById('company-street').value = data.street || '';
    document.getElementById('company-id').value = data.id_number || '';
    document.getElementById('company-dds').value = data.dds_number || '';
    document.getElementById('company-iban').value = data.iban || '';
    document.getElementById('company-bic').value = data.bic_code || '';
    document.getElementById('company-mol').value = data.mol || '';
  }
});

function saveCompanySettings() {
  const companyData = {
    name: document.getElementById('company-name').value,
    town: document.getElementById('company-town').value,
    street: document.getElementById('company-street').value,
    id_number: document.getElementById('company-id').value,
    dds_number: document.getElementById('company-dds').value,
    iban: document.getElementById('company-iban').value,
    bic_code: document.getElementById('company-bic').value,
    mol: document.getElementById('company-mol').value
  };
  
  ipcRenderer.send('save-company-settings', companyData);
}

ipcRenderer.on('company-settings-saved', (event, { type, message }) => {
  showNotification(message, type);
  if (type === 'success') {
    document.querySelector('.modal').remove();
  }
});

ipcRenderer.on('get-products-response', (event, products) => {
  const productList = document.getElementById('product-list');
  
  // Clear existing content
  productList.innerHTML = '';
  
  // Add grid styling to the container
  productList.style.display = 'grid';
  productList.style.gridTemplateColumns = 'repeat(4, 1fr)';
  productList.style.gap = '20px';
  productList.style.padding = '20px';
  
  // Create a card for each product
  products.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.backgroundColor = '#f9f9f9';
    card.style.borderRadius = '8px';
    card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    card.style.padding = '15px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.height = '100%';
    card.style.minHeight = '180px';
    card.style.border = '1px solid #ddd';
    card.style.boxSizing = 'border-box';
    card.style.position = 'relative';
    
    // Product info
    const productInfo = document.createElement('div');
    productInfo.style.flex = '1';
    productInfo.style.marginBottom = '15px';
    
    // Product name - larger and bold
    const productName = document.createElement('h3');
    productName.textContent = product.product_name;
    productName.style.margin = '0 0 10px 0';
    productName.style.fontSize = '18px';
    productName.style.color = '#333';
    
    // Price and unit
    const priceUnit = document.createElement('div');
    priceUnit.style.fontSize = '16px';
    priceUnit.style.color = '#0066cc';
    priceUnit.style.fontWeight = 'bold';
    priceUnit.textContent = `${product.product_price} лв / ${product.product_unit}`;
    
    productInfo.appendChild(productName);
    productInfo.appendChild(priceUnit);
    
    // Action buttons at the bottom
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    actions.style.display = 'flex';
    actions.style.justifyContent = 'center';
    actions.style.borderTop = '1px solid #eee';
    actions.style.paddingTop = '15px';
    actions.style.marginTop = 'auto';
    actions.innerHTML = `
      <button class="action-btn edit-btn" onclick="editProduct(${product.id})" 
        style="margin-right: 15px; background: none; border: 1px solid transparent; cursor: pointer; color: #008000; padding: 8px 15px; border-radius: 4px; transition: all 0.2s ease;">
        <i class="fas fa-edit"></i> Редактирай
      </button>
      <button class="action-btn delete-btn" onclick="deleteProduct(${product.id})" 
        style="background: none; border: 1px solid transparent; cursor: pointer; color: #cc0000; padding: 8px 15px; border-radius: 4px; transition: all 0.2s ease;">
        <i class="fas fa-trash"></i> Изтрий
      </button>
    `;
    
    // Add hover effects with event listeners
    const buttons = actions.querySelectorAll('button');
    buttons.forEach(button => {
      if (button.classList.contains('edit-btn')) {
        button.addEventListener('mouseover', () => {
          button.style.border = '1px solid #008000';
          button.style.backgroundColor = 'rgba(0, 128, 0, 0.05)';
        });
        button.addEventListener('mouseout', () => {
          button.style.border = '1px solid transparent';
          button.style.backgroundColor = 'transparent';
        });
      } else if (button.classList.contains('delete-btn')) {
        button.addEventListener('mouseover', () => {
          button.style.border = '1px solid #cc0000';
          button.style.backgroundColor = 'rgba(204, 0, 0, 0.05)';
        });
        button.addEventListener('mouseout', () => {
          button.style.border = '1px solid transparent';
          button.style.backgroundColor = 'transparent';
        });
      }
    });
    
    // Assemble the card
    card.appendChild(productInfo);
    card.appendChild(actions);
    
    // Add the card to the container
    productList.appendChild(card);
  });
  
  // If no products, show a message
  if (products.length === 0) {
    productList.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
        <p style="color: #666; font-size: 16px;">Няма намерени продукти</p>
      </div>
    `;
  }
});


// Add the function to show the edit invoice form
function showEditInvoiceForm(id) {
  // First, fetch the invoice data
  ipcRenderer.send('get-invoice-for-edit', id);
}

ipcRenderer.on('get-invoices-response', (event, invoices) => {
  const invoiceList = document.getElementById('invoice-list');
  if (invoiceList) {
    // Clear existing content and set up grid container
    invoiceList.innerHTML = '';
    invoiceList.style.display = 'grid';
    // Set exactly 3 columns with equal width
    invoiceList.style.gridTemplateColumns = 'repeat(3, 1fr)';
    // Increase row gap for better separation between rows
    invoiceList.style.gap = '15px';
    invoiceList.style.padding = '10px';
    
    // Create a card for each invoice
    invoices.forEach((invoice) => {
      const card = document.createElement('div');
      card.className = 'invoice-card';
      // Set all cards to the same background color
      card.style.backgroundColor = '#e9f5f8';
      card.style.borderRadius = '8px';
      card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      card.style.padding = '15px';
      card.style.position = 'relative';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      // Set a fixed minimum height to ensure consistency
      card.style.minHeight = '300px';
      card.style.height = '100%';
      card.style.border = '1px solid #ddd';
      card.style.boxSizing = 'border-box'; // Include padding in height calculation
      
      // Action buttons (moved to the top-right)
      const actions = document.createElement('div');
      actions.className = 'invoice-card-actions';
      actions.style.position = 'absolute';
      actions.style.top = '15px';
      actions.style.right = '15px';
      actions.innerHTML = `
        <button class="print-btn" onclick="printInvoice(${invoice.id})" 
          style="margin-right: 5px; background: none; border: 1px solid transparent; cursor: pointer; color: #0066cc; padding: 5px; border-radius: 4px; transition: all 0.2s ease;"
          onmouseover="this.style.border='1px solid #0066cc'; this.style.backgroundColor='rgba(0, 102, 204, 0.05)';" 
          onmouseout="this.style.border='1px solid transparent'; this.style.backgroundColor='transparent';">
          ПРИНТИРАЙ<i class="fas fa-print"></i>
        </button>
        
        <button class="edit-btn" onclick="showEditInvoiceForm(${invoice.id})" 
          style="margin-right: 5px; background: none; border: 1px solid transparent; cursor: pointer; color: #008000; padding: 5px; border-radius: 4px; transition: all 0.2s ease;"
          onmouseover="this.style.border='1px solid #008000'; this.style.backgroundColor='rgba(0, 128, 0, 0.05)';" 
          onmouseout="this.style.border='1px solid transparent'; this.style.backgroundColor='transparent';">
          РЕДАКТИРАЙ<i class="fas fa-edit"></i>
        </button>
        
        <button class="delete-btn" onclick="deleteInvoice(${invoice.id})" 
          style="background: none; border: 1px solid transparent; cursor: pointer; color: #cc0000; padding: 5px; border-radius: 4px; transition: all 0.2s ease;"
          onmouseover="this.style.border='1px solid #cc0000'; this.style.backgroundColor='rgba(204, 0, 0, 0.05)';" 
          onmouseout="this.style.border='1px solid transparent'; this.style.backgroundColor='transparent';">
          ИЗТРИЙ<i class="fas fa-trash"></i>
        </button>
      `;

      
      // Invoice header with main information
      const header = document.createElement('div');
      header.className = 'invoice-card-header';
      header.style.borderBottom = '1px solid #ddd';
      header.style.marginBottom = '15px';
      header.style.paddingBottom = '10px';
      // Add right padding to prevent overlap with buttons
      header.style.paddingRight = '60px';
      header.innerHTML = `
        <div>
          <h3 style="margin: 0; font-size: 18px;">Фактура №${invoice.number}</h3>
          <p style="margin: 5px 0; color: #666;">Дата: ${formatDate(invoice.date)}</p>
        </div>
        
        <div style="margin-top: 8px;">
          <p style="margin: 5px 0;"><strong>Клиент:</strong> ${invoice.customer_name}</p>
          <p style="margin: 5px 0;"><strong>Плащане:</strong> ${invoice.payment_type || 'Не е посочено'}</p>
          ${invoice.reason ? `<p style="margin: 5px 0;"><strong>Основание:</strong> ${invoice.reason}</p>` : ''}
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-top: 8px;">
          <span><strong>Дан. основа:</strong> ${invoice.total_without_vat} лв</span>
          <span><strong>ДДС:</strong> ${(invoice.total - invoice.total_without_vat).toFixed(2)} лв</span>
          <span style="font-weight: bold; color: #0066cc; font-size: 16px;">Общо: ${invoice.total} лв</span>
        </div>
      `;
      
      // Products table
      const productsSection = document.createElement('div');
      productsSection.className = 'invoice-card-products';
      productsSection.style.flex = '1'; // Allow this section to grow
      productsSection.style.overflowX = 'auto'; // Add horizontal scrolling if needed
      
      if (invoice.details && invoice.details.length > 0) {
        let tableHTML = `
          <h4 style="margin: 0 0 10px 0; font-size: 14px;">Продукти</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background-color: rgba(0,0,0,0.05);">
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Продукт</th>
                <th style="padding: 8px; text-align: center; border-bottom: 1px solid #ddd;">Кол.</th>
                <th style="padding: 8px; text-align: center; border-bottom: 1px solid #ddd;">Мярка</th>
                <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">Цена</th>
                <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">Общо</th>
              </tr>
            </thead>
            <tbody>
        `;
        
        invoice.details.forEach(detail => {
          // Use display_total if available, otherwise calculate
          const totalPrice = detail.display_total !== null && detail.display_total !== undefined ? 
                            detail.display_total : 
                            detail.amount * detail.price;
          
          tableHTML += `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${detail.product_name}</td>
              <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">${detail.amount}</td>
              <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">${detail.product_unit}</td>
              <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${detail.price.toFixed(2)} лв</td>
              <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${totalPrice.toFixed(2)} лв</td>
            </tr>
          `;
        });
        
        tableHTML += `
            </tbody>
          </table>
        `;
        
        productsSection.innerHTML = tableHTML;
      } else {
        productsSection.innerHTML = '<p style="color: #999; font-style: italic;">Няма добавени продукти</p>';
      }
      
      // Append all sections to the card
      card.appendChild(actions); // Add actions first to ensure they're on top
      card.appendChild(header);
      card.appendChild(productsSection);
      
      // Add the card to the invoice list
      invoiceList.appendChild(card);
    });
    
    // Add some CSS for empty state
    if (invoices.length === 0) {
      invoiceList.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
          <p style="color: #666; font-size: 16px;">Няма намерени фактури</p>
        </div>
      `;
    }
  }
});




// Function to toggle invoice details visibility
// function toggleInvoiceDetails(invoiceId) {
//   const detailsRow = document.getElementById(`invoice-details-${invoiceId}`);
//   if (detailsRow) {
//     const isHidden = detailsRow.style.display === 'none';
//     detailsRow.style.display = isHidden ? 'table-row' : 'none';
    
//     // Also toggle the icon
//     const button = event.target.closest('.expand-btn');
//     if (button) {
//       const icon = button.querySelector('i');
//       if (icon) {
//         icon.className = isHidden ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
//       }
//     }
//   }
// }

// Helper function to format date as DD/MM/YYYY
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
}

// Add this function to handle the backup
function backupDatabase() {
  ipcRenderer.send('backup-database');
}

// Add a listener for the backup response
ipcRenderer.on('backup-database-response', (event, { type, message, path }) => {
  showNotification(message, type);
  
  if (type === 'success' && path) {
    // Optionally show a dialog to open the folder
    const shouldOpen = confirm('Архивът е запазен успешно. Искате ли да отворите папката?');
    if (shouldOpen) {
      ipcRenderer.send('open-folder', path);
    }
  }
});

// Add this function to handle receiving invoice data and displaying edit form
ipcRenderer.on('get-invoice-for-edit-response', (event, invoice) => {
  if (!invoice) {
    showNotification('Фактурата не е намерена', 'error');
    return;
  }

  // Create the edit modal
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="width: 700px; max-width: 90%;">
      <h2>Редактиране на Фактура</h2>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
        <div>
          <p style="margin: 5px 0;"><strong>№:</strong> ${invoice.number}</p>
          <p style="margin: 5px 0;"><strong>Дата:</strong> ${formatDate(invoice.date)}</p>
          <p style="margin: 5px 0;"><strong>Клиент:</strong> ${invoice.customer_name}</p>
        </div>
        
        <div>
          <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 5px;"><strong>Начин на плащане:</strong></label>
            <select id="edit-payment-type" style="width: 100%; padding: 8px;">
              <option value="В БРОЙ" ${invoice.payment_type === 'В БРОЙ' ? 'selected' : ''}>В БРОЙ</option>
              <option value="БАНКОВ ПРЕВОД" ${invoice.payment_type === 'БАНКОВ ПРЕВОД' ? 'selected' : ''}>БАНКОВ ПРЕВОД</option>
            </select>
          </div>
          
          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <div>
              <label style="display: block; margin-bottom: 5px;"><strong>Дан. основа:</strong></label>
              <input type="number" id="edit-total-without-vat" value="${invoice.total_without_vat}" step="1" style="width: 120px; padding: 8px;">
            </div>
            <div>
              <label style="display: block; margin-bottom: 5px;"><strong>Общо:</strong></label>
              <input type="number" id="edit-total" value="${invoice.total}" step="1" style="width: 120px; padding: 8px;">
            </div>
          </div>
          <div style="margin-top: 20px;">
            <label style="display: block; margin-bottom: 5px;"><strong>Основание:</strong></label>
            <textarea id="edit-reason" style="width: 100%; padding: 8px; min-height: 60px; resize: vertical;">${invoice.reason || ''}</textarea>
          </div>
        </div>
      </div>
      
      <h3 style="margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Продукти</h3>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 10px; text-align: left;">Продукт</th>
            <th style="padding: 10px; text-align: center; width: 80px;">Кол.</th>
            <th style="padding: 10px; text-align: center; width: 80px;">Мярка</th>
            <th style="padding: 10px; text-align: right; width: 120px;">Цена</th>
            <th style="padding: 10px; text-align: right; width: 120px;">Общо</th>
          </tr>
        </thead>
        <tbody id="edit-product-rows">
          <!-- Product rows will be inserted here -->
        </tbody>
      </table>
      
      <div class="button-group" style="margin-top: 30px; text-align: right;">
        <button onclick="calculateEditedInvoiceTotals()" style="margin-right: 10px;">Преизчисли</button>
        <button onclick="saveEditedInvoice(${invoice.id})" style="margin-right: 10px;">Запази</button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()">Отказ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = 'block';

  // Populate product rows
  const productRowsContainer = document.getElementById('edit-product-rows');
  invoice.details.forEach(detail => {
    const rowTotal = detail.price * detail.amount;
    const row = document.createElement('tr');
    row.className = 'edit-product-row';
    row.dataset.detailId = detail.detail_id;
    row.dataset.productId = detail.product_id;
    row.innerHTML = `
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${detail.product_name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
        <input type="number" class="edit-product-amount" value="${detail.amount}" min="1" style="width: 60px; text-align: center; padding: 5px;">
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${detail.product_unit}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
        <input type="number" class="edit-product-price" value="${detail.price.toFixed(2)}" step="0.01" style="width: 100px; text-align: right; padding: 5px;">
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
        <input type="number" class="edit-product-total" value="${rowTotal.toFixed(2)}" step="0.01" style="width: 100px; text-align: right; padding: 5px;">
      </td>
    `;
    productRowsContainer.appendChild(row);
  });
});

// Function to recalculate all totals based on products - ONLY when the button is clicked
function calculateEditedInvoiceTotals() {
  let subtotal = 0;
  
  // Calculate the sum of all product totals
  document.querySelectorAll('.edit-product-row').forEach(row => {
    const total = parseFloat(row.querySelector('.edit-product-total').value) || 0;
    subtotal += total;
  });
  
  // Round subtotal to whole number
  subtotal = subtotal;
  
  // Calculate VAT (20%)
  const vat = (subtotal * 0.2).toFixed(2);
  
  // Calculate total
  const total = (subtotal + vat).toFixed(2);
  
  // Update the inputs
  document.getElementById('edit-total-without-vat').value = subtotal;
  document.getElementById('edit-total').value = total;
  
  showNotification('Сумите са преизчислени', 'info');
}

// Function to save edited invoice
// Modified function to save edited invoice
// Function to save edited invoice
function saveEditedInvoice(invoiceId) {
  // Get form values
  const paymentType = document.getElementById('edit-payment-type').value;
  const totalWithoutVat = parseFloat(document.getElementById('edit-total-without-vat').value);
  const total = parseFloat(document.getElementById('edit-total').value);
  const reason = document.getElementById('edit-reason').value;
  
  // Validate fields
  if (!paymentType || isNaN(totalWithoutVat) || isNaN(total)) {
    showNotification('Моля попълнете всички полета коректно', 'error');
    return;
  }
  
  // Get all product rows data
  const products = [];
  
  document.querySelectorAll('.edit-product-row').forEach(row => {
    const detailId = row.dataset.detailId;
    const amount = parseFloat(row.querySelector('.edit-product-amount').value) || 0;
    const price = parseFloat(row.querySelector('.edit-product-price').value) || 0;
    const userEditedTotal = parseFloat(row.querySelector('.edit-product-total').value) || 0;
    
    products.push({
      detail_id: detailId,
      product_id: row.dataset.productId,
      amount: amount,
      price: price
    });
    
    // Save the total override separately
    ipcRenderer.send('save-invoice-total-override', {
      detailId: detailId,
      displayTotal: userEditedTotal
    });
  });
  
  // Prepare invoice data
  const invoiceData = {
    id: invoiceId,
    payment_type: paymentType,
    total_without_vat: totalWithoutVat,
    total: total,
    reason: reason,
    products: products
  };
  
  // Send to server
  ipcRenderer.send('save-edited-invoice', invoiceData);
}
