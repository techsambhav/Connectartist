class PaymentDetailsForm {
    constructor() {
    this.bindEvents = this.bindEvents.bind(this);
    this.handleOptionClick = this.handleOptionClick.bind(this);
    this.handleCheckboxChange = this.handleCheckboxChange.bind(this);
    this.handleQrCodeUpload = this.handleQrCodeUpload.bind(this);
    this.handleFormSubmit = this.handleFormSubmit.bind(this);
    this.handleFormCancel = this.handleFormCancel.bind(this);

    // initialize handler placeholders so removeEventListener checks are safe
    this._savePrimaryHandler = null;
    this._editUpiHandler = null;
    this._editBankHandler = null;
    this._deleteUpiHandler = null;
    this._deleteBankHandler = null;
    this._deleteCashHandler = null;

    // bind handlers that are referenced later but may not be attached yet
    this.handleQrRemove = this.handleQrRemove.bind(this);
    // placeholders (actual assignment happens when elements exist)
    this._editUpiHandler = this._editUpiHandler; // keep placeholder
    this._editBankHandler = this._editBankHandler;
    this._deleteUpiHandler = this._deleteUpiHandler;
    this._deleteBankHandler = this._deleteBankHandler;
    this._deleteCashHandler = this._deleteCashHandler;
    }

    init() {
        console.log('Initializing PaymentDetailsForm...');
    // Clean duplicates and render primary options before binding events
    this.ensureSingleYourPaymentBlock();
    this.renderPrimaryOptions();
    this.bindEvents();
    }

    // Helper: return the container wrapper where modal content lives
    getContentWrapper() {
        return document.querySelector('.payment-content-wrapper');
    }

    // Ensure only one 'Your Payment Method' block exists (remove duplicates)
    ensureSingleYourPaymentBlock() {
        const wrapper = this.getContentWrapper();
        if (!wrapper) return;
        const blocks = wrapper.querySelectorAll('.your-payment-method, #yourPaymentMethodFallback');
        if (blocks.length <= 1) return;
        // Keep the last block, remove earlier ones
        for (let i = 0; i < blocks.length - 1; i++) blocks[i].remove();
    }

    // Get the yourPaymentList element (either original or fallback)
    getYourPaymentListElement() {
        return document.getElementById('yourPaymentList') || document.querySelector('#yourPaymentMethodFallback #yourPaymentList');
    }

    // Render the list of primary option radios from localStorage
    renderPrimaryOptions() {
        const yourPaymentList = this.getYourPaymentListElement();
        if (!yourPaymentList) return;
        const methods = [];
        const upi = localStorage.getItem('paymentMethod_upi');
        const bank = localStorage.getItem('paymentMethod_bank');
        const cash = localStorage.getItem('paymentMethod_cash');
        if (upi) methods.push({ key: 'upi', label: 'UPI Payment' });
        if (bank) methods.push({ key: 'bank', label: 'Bank Transfer' });
        if (cash) methods.push({ key: 'cash', label: 'Cash Payment' });

        yourPaymentList.innerHTML = '';
        if (!methods.length) {
            yourPaymentList.innerHTML = '<div class="detail-item">No payment methods saved. Add one above to select it as primary.</div>';
            return;
        }
        const primary = localStorage.getItem('primaryPaymentMethod');
        methods.forEach(m => {
            const id = 'primary_' + m.key;
            const item = document.createElement('label');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '0.5rem';
            item.style.cursor = 'pointer';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'primaryPayment';
            radio.id = id;
            radio.value = m.key;
            if (primary === m.key) radio.checked = true;

            const span = document.createElement('span');
            span.textContent = m.label;

            item.appendChild(radio);
            item.appendChild(span);
            yourPaymentList.appendChild(item);
        });
    }

    // Update saved methods UI from paymentDetails object (server response)
    // options: { syncLocalStorage: true } - when false, do not write to localStorage (useful when viewing another user's profile)
    updateSavedMethodsUI(paymentDetails, options = { syncLocalStorage: true }) {
        if (!paymentDetails) return;
        const pm = paymentDetails.paymentMethods || {};

        // Optionally sync localStorage to keep earlier client logic working.
        // When viewing another user's profile we should NOT overwrite the viewer's local storage.
        if (options.syncLocalStorage !== false) {
            if (pm.upi && pm.upi.enabled) {
                localStorage.setItem('paymentMethod_upi', JSON.stringify({ type: 'upi', upiId: pm.upi.upiId, qrCode: pm.upi.qrCode || null }));
            } else {
                localStorage.removeItem('paymentMethod_upi');
            }

            if (pm.bank && pm.bank.enabled) {
                localStorage.setItem('paymentMethod_bank', JSON.stringify({ type: 'bank', bankName: pm.bank.bankName, accountNumber: pm.bank.accountNumber, accountHolder: pm.bank.accountHolder, ifscCode: pm.bank.ifscCode }));
            } else {
                localStorage.removeItem('paymentMethod_bank');
            }

            if (pm.cash && pm.cash.enabled) {
                localStorage.setItem('paymentMethod_cash', JSON.stringify({ type: 'cash', enabled: true }));
            } else {
                localStorage.removeItem('paymentMethod_cash');
            }
        }

        // Update visible cards in the modal if present
        const upiCard = document.getElementById('upiPaymentCard');
        const bankCard = document.getElementById('bankPaymentCard');
        const cashCard = document.getElementById('cashPaymentCard');

        if (upiCard) {
            if (pm.upi && pm.upi.enabled) {
                document.getElementById('savedUpiId').textContent = pm.upi.upiId || '';
                const savedQr = document.getElementById('savedQrCode');
                if (pm.upi.qrCode && savedQr) {
                    savedQr.src = pm.upi.qrCode;
                    savedQr.style.display = 'block';
                }
                upiCard.style.display = 'block';
            } else {
                upiCard.style.display = 'none';
            }
        }

        if (bankCard) {
            if (pm.bank && pm.bank.enabled) {
                document.getElementById('savedBankName').textContent = pm.bank.bankName || '';
                document.getElementById('savedAccountNumber').textContent = pm.bank.accountNumber ? ('•••• ' + String(pm.bank.accountNumber).slice(-4)) : '';
                document.getElementById('savedAccountHolder').textContent = pm.bank.accountHolder || '';
                document.getElementById('savedIfscCode').textContent = pm.bank.ifscCode || '';
                bankCard.style.display = 'block';
            } else {
                bankCard.style.display = 'none';
            }
        }

        if (cashCard) {
            if (pm.cash && pm.cash.enabled) {
                cashCard.style.display = 'block';
            } else {
                cashCard.style.display = 'none';
            }
        }

        // Normalize duplicates and re-render primary options
        this.ensureSingleYourPaymentBlock();
        this.renderPrimaryOptions();
    }

    bindEvents() {
        console.log('Binding payment form events...');
        
        // Payment options
        const paymentOptions = document.querySelectorAll('.payment-option');
        console.log('Found payment options:', paymentOptions.length);
        
        paymentOptions.forEach(option => {
            option.removeEventListener('click', this.handleOptionClick);
            option.addEventListener('click', this.handleOptionClick);
            
            const checkbox = option.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.removeEventListener('change', this.handleCheckboxChange);
                checkbox.addEventListener('change', this.handleCheckboxChange);
            }
        });

        // QR Code upload
        const qrUpload = document.getElementById('qrCodeUpload');
        if (qrUpload) {
            qrUpload.removeEventListener('change', this.handleQrCodeUpload);
            qrUpload.addEventListener('change', this.handleQrCodeUpload);
        }

        // Form submissions
        ['upi', 'bank', 'cash'].forEach(type => {
            const saveBtn = document.getElementById('save' + type.charAt(0).toUpperCase() + type.slice(1));
            const cancelBtn = document.getElementById('cancel' + type.charAt(0).toUpperCase() + type.slice(1));
            
            if (saveBtn) {
                saveBtn.removeEventListener('click', this.handleFormSubmit);
                saveBtn.addEventListener('click', (e) => this.handleFormSubmit(e, type));
            }
            
            if (cancelBtn) {
                cancelBtn.removeEventListener('click', this.handleFormCancel);
                cancelBtn.addEventListener('click', () => this.handleFormCancel(type));
            }
        });

        // QR Code remove button
        const removeQrBtn = document.getElementById('removeQr');
        if (removeQrBtn) {
            removeQrBtn.removeEventListener('click', this.handleQrRemove);
            removeQrBtn.addEventListener('click', this.handleQrRemove);
        }

    // Edit / Delete handlers for saved payment cards
        // Edit UPI
        const editUpiBtn = document.getElementById('editUpi');
        if (editUpiBtn) {
            if (this._editUpiHandler) editUpiBtn.removeEventListener('click', this._editUpiHandler);
            this._editUpiHandler = () => {
                const savedUpiIdEl = document.getElementById('savedUpiId');
                const savedQr = document.getElementById('savedQrCode');
                const upiIdField = document.getElementById('upiId');
                const upiForm = document.getElementById('upiForm');
                const upiOption = document.getElementById('upiOption');
                const upiCard = document.getElementById('upiPaymentCard');

                if (savedUpiIdEl && upiIdField) upiIdField.value = savedUpiIdEl.textContent || '';
                if (savedQr && savedQr.src) {
                    const qrImage = document.getElementById('qrImage');
                    const qrPreview = document.getElementById('qrPreview');
                    if (qrImage) qrImage.src = savedQr.src;
                    if (qrPreview) qrPreview.style.display = 'block';
                }

                if (upiForm) upiForm.style.display = 'block';
                const enableUpi = document.getElementById('enableUpi');
                if (enableUpi) enableUpi.checked = true;
                if (upiOption) upiOption.classList.add('selected');
                if (upiCard) upiCard.style.display = 'none';
            };
            editUpiBtn.addEventListener('click', this._editUpiHandler);
        }

        // Edit Bank
        const editBankBtn = document.getElementById('editBank');
        if (editBankBtn) {
            if (this._editBankHandler) editBankBtn.removeEventListener('click', this._editBankHandler);
            this._editBankHandler = () => {
                const savedBankName = document.getElementById('savedBankName');
                const savedAccountHolder = document.getElementById('savedAccountHolder');
                const savedIfsc = document.getElementById('savedIfscCode');
                const bankNameField = document.getElementById('bankName');
                const accountHolderField = document.getElementById('accountHolder');
                const ifscField = document.getElementById('ifscCode');
                const bankForm = document.getElementById('bankForm');
                const bankOption = document.getElementById('bankOption');
                const bankCard = document.getElementById('bankPaymentCard');

                if (savedBankName && bankNameField) bankNameField.value = savedBankName.textContent || '';
                // Account number can't be displayed for security — leave blank
                if (accountHolderField && savedAccountHolder) accountHolderField.value = savedAccountHolder.textContent || '';
                if (ifscField && savedIfsc) ifscField.value = savedIfsc.textContent || '';

                if (bankForm) bankForm.style.display = 'block';
                const enableBank = document.getElementById('enableBank');
                if (enableBank) enableBank.checked = true;
                if (bankOption) bankOption.classList.add('selected');
                if (bankCard) bankCard.style.display = 'none';
            };
            editBankBtn.addEventListener('click', this._editBankHandler);
        }

        // Delete handlers
        const deleteUpiBtn = document.getElementById('deleteUpi');
        if (deleteUpiBtn) {
            if (this._deleteUpiHandler) deleteUpiBtn.removeEventListener('click', this._deleteUpiHandler);
            this._deleteUpiHandler = async () => {
                if (!confirm('Are you sure you want to remove your UPI payment details?')) return;
                const token = localStorage.getItem('token');
                if (!token) { alert('Please log in'); return; }
                try {
                    const res = await fetch('/api/payments/payment-details/upi', {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const data = await res.json();
                    if (data.success) {
                        this.showStatusMessage('UPI payment details removed', 'success');
                        this.updateSavedMethodsUI(data.paymentDetails);
                    } else {
                        this.showStatusMessage(data.message || 'Failed to remove UPI details', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    this.showStatusMessage('Error removing UPI details', 'error');
                }
            };
            deleteUpiBtn.addEventListener('click', this._deleteUpiHandler);
        }

        const deleteBankBtn = document.getElementById('deleteBank');
        if (deleteBankBtn) {
            if (this._deleteBankHandler) deleteBankBtn.removeEventListener('click', this._deleteBankHandler);
            this._deleteBankHandler = async () => {
                if (!confirm('Are you sure you want to remove your bank transfer details?')) return;
                const token = localStorage.getItem('token');
                if (!token) { alert('Please log in'); return; }
                try {
                    const res = await fetch('/api/payments/payment-details/bank', {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const data = await res.json();
                    if (data.success) {
                        this.showStatusMessage('Bank transfer details removed', 'success');
                        this.updateSavedMethodsUI(data.paymentDetails);
                    } else {
                        this.showStatusMessage(data.message || 'Failed to remove bank details', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    this.showStatusMessage('Error removing bank details', 'error');
                }
            };
            deleteBankBtn.addEventListener('click', this._deleteBankHandler);
        }

        const deleteCashBtn = document.getElementById('deleteCash');
        if (deleteCashBtn) {
            if (this._deleteCashHandler) deleteCashBtn.removeEventListener('click', this._deleteCashHandler);
            this._deleteCashHandler = async () => {
                if (!confirm('Are you sure you want to remove cash payment option?')) return;
                const token = localStorage.getItem('token');
                if (!token) { alert('Please log in'); return; }
                try {
                    const res = await fetch('/api/payments/payment-details/cash', {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const data = await res.json();
                    if (data.success) {
                        this.showStatusMessage('Cash payment option removed', 'success');
                        this.updateSavedMethodsUI(data.paymentDetails);
                    } else {
                        this.showStatusMessage(data.message || 'Failed to remove cash option', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    this.showStatusMessage('Error removing cash option', 'error');
                }
            };
            deleteCashBtn.addEventListener('click', this._deleteCashHandler);
        }

        // Initialize 'Your Payment Method' UI (primary selector)
        try {
            const yourPaymentList = document.getElementById('yourPaymentList') || document.querySelector('#yourPaymentMethodFallback #yourPaymentList');
            const savePrimaryBtn = document.getElementById('savePrimaryPayment') || document.querySelector('#yourPaymentMethodFallback #savePrimaryPayment');

            if (yourPaymentList && savePrimaryBtn) {
                const getAvailableMethods = () => {
                    const methods = [];
                    if (localStorage.getItem('paymentMethod_upi')) methods.push({ key: 'upi', label: 'UPI Payment' });
                    if (localStorage.getItem('paymentMethod_bank')) methods.push({ key: 'bank', label: 'Bank Transfer' });
                    if (localStorage.getItem('paymentMethod_cash')) methods.push({ key: 'cash', label: 'Cash Payment' });
                    return methods;
                };

                const renderOptions = () => {
                    const methods = getAvailableMethods();
                    yourPaymentList.innerHTML = '';
                    if (!methods.length) {
                        yourPaymentList.innerHTML = '<div class="detail-item">No payment methods saved. Add one above to select it as primary.</div>';
                        return;
                    }
                    const primary = localStorage.getItem('primaryPaymentMethod');
                    methods.forEach(m => {
                        const id = 'primary_' + m.key;
                        const item = document.createElement('label');
                        item.style.display = 'flex';
                        item.style.alignItems = 'center';
                        item.style.gap = '0.5rem';
                        item.style.cursor = 'pointer';

                        const radio = document.createElement('input');
                        radio.type = 'radio';
                        radio.name = 'primaryPayment';
                        radio.id = id;
                        radio.value = m.key;
                        if (primary === m.key) radio.checked = true;

                        const span = document.createElement('span');
                        span.textContent = m.label;

                        item.appendChild(radio);
                        item.appendChild(span);
                        yourPaymentList.appendChild(item);
                    });
                };

                if (this._savePrimaryHandler) savePrimaryBtn.removeEventListener('click', this._savePrimaryHandler);
                this._savePrimaryHandler = () => {
                    const selected = document.querySelector('input[name="primaryPayment"]:checked');
                    if (!selected) {
                        this.showStatusMessage('Please select a primary payment method before saving', 'error');
                        return;
                    }
                    localStorage.setItem('primaryPaymentMethod', selected.value);
                    this.showStatusMessage('Primary payment method saved', 'success');
                };
                savePrimaryBtn.addEventListener('click', this._savePrimaryHandler);

                // Initial render
                renderOptions();
            }
        } catch (err) {
            console.warn('Primary payment UI init failed', err);
        }
    }

    handleOptionClick(event) {
        const option = event.currentTarget;
        const checkbox = option.querySelector('input[type="checkbox"]');
        
        if (event.target === checkbox) return; // Don't handle if clicking checkbox directly
        
        console.log('Payment option clicked:', option.id);
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            this.togglePaymentForm(checkbox);
        }
    }

    handleCheckboxChange(event) {
        console.log('Checkbox changed:', event.target.id);
        this.togglePaymentForm(event.target);
    }

    togglePaymentForm(checkbox) {
        if (!checkbox) return;

        const paymentType = checkbox.id.replace('enable', '').toLowerCase();
        const formId = paymentType + 'Form';
        const form = document.getElementById(formId);

        // Update selected state
        const option = checkbox.closest('.payment-option');
        if (option) {
            option.classList.toggle('selected', checkbox.checked);
        }

        // Show/hide form
        if (form) {
            // Hide all forms first
            ['upi', 'bank', 'cash'].forEach(type => {
                const otherForm = document.getElementById(type + 'Form');
                const otherCheckbox = document.getElementById('enable' + type.charAt(0).toUpperCase() + type.slice(1));
                const otherOption = otherCheckbox?.closest('.payment-option');
                
                if (otherForm && type !== paymentType) {
                    otherForm.style.display = 'none';
                }
                if (otherCheckbox && type !== paymentType) {
                    otherCheckbox.checked = false;
                }
                if (otherOption && type !== paymentType) {
                    otherOption.classList.remove('selected');
                }
            });

            // Show selected form
            form.style.display = checkbox.checked ? 'block' : 'none';
        }
    }

    handleQrCodeUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('qrPreview');
            const image = document.getElementById('qrImage');
            if (preview && image) {
                image.src = e.target.result;
                preview.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }

    handleQrRemove() {
        const upload = document.getElementById('qrCodeUpload');
        const preview = document.getElementById('qrPreview');
        const image = document.getElementById('qrImage');
        
        if (upload) upload.value = '';
        if (image) image.src = '';
        if (preview) preview.style.display = 'none';
    }

    async handleFormSubmit(event, type) {
        event.preventDefault();
        console.log('Submitting form:', type);

        try {
            // Check if user is logged in
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Please log in to save payment details');
                window.location.href = '/login.html';
                return;
            }

            const userId = new URLSearchParams(window.location.search).get('id') || localStorage.getItem('userId');
            
            if (!userId) {
                throw new Error('User ID is required');
            }

            // Initialize payment data structure
            let paymentData = { type };

            if (type === 'upi') {
                const upiId = document.getElementById('upiId')?.value;
                const qrImage = document.getElementById('qrImage')?.src;
                
                if (!upiId) {
                    alert('Please enter your UPI ID');
                    return;
                }

                paymentData = {
                    type,
                    upiId,
                    qrCode: qrImage || null
                };
            } else if (type === 'bank') {
                const bankName = document.getElementById('bankName')?.value;
                const accountNumber = document.getElementById('accountNumber')?.value;
                const accountHolder = document.getElementById('accountHolder')?.value;
                const ifscCode = document.getElementById('ifscCode')?.value;

                if (!bankName || !accountNumber || !accountHolder || !ifscCode) {
                    alert('Please fill all bank details');
                    return;
                }

                paymentData = {
                    type,
                    bankName,
                    accountNumber,
                    accountHolder,
                    ifscCode
                };
            } else if (type === 'cash') {
                paymentData = {
                    type,
                    enabled: true
                };
            }

            // Log the data being sent
            const requestData = {
                ...paymentData,
                userId
            };
            console.log('Sending payment data:', requestData);

            // Create AbortController for timeout (guard for older browsers)
            const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
            const signal = controller ? controller.signal : undefined;
            const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null; // 10 second timeout

            try {
                // Send data to server with timeout
                const response = await fetch('/api/payments/payment-details', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    },
                    credentials: 'include',
                    ...(signal ? { signal } : {}),
                    body: JSON.stringify(requestData)
                });
                
                clearTimeout(timeoutId);
                const data = await response.json();
            
                if (!response.ok) {
                    if (response.status === 401) {
                        localStorage.removeItem('token');
                        this.showStatusMessage('Your session has expired. Please log in again.', 'error');
                        setTimeout(() => {
                            window.location.href = '/login.html';
                        }, 2000);
                        return;
                    }
                    throw new Error(data.message || `Server error: ${response.status}`);
                }

                if (data.success) {
                    // Show success message
                    this.showStatusMessage('Payment details saved successfully!', 'success');
                    
                    // Close the form
                    this.handleFormCancel(type);
                    
                    // Update UI from server response without reloading
                    if (data.paymentDetails) {
                        this.updateSavedMethodsUI(data.paymentDetails);
                    }
                } else {
                    throw new Error(data.message || 'Failed to save payment details');
                }
            } catch (error) {
                console.error('Error saving payment details:', error);
                let errorMessage = 'Error saving payment details';
                
                if (error.name === 'AbortError') {
                    errorMessage = 'Request timed out. Please try again.';
                } else if (error.message.includes('Failed to fetch')) {
                    errorMessage = 'Could not connect to the server. Please check your internet connection and try again.';
                } else if (error.message.includes('Token')) {
                    errorMessage = 'Authentication error. Please try logging in again.';
                    localStorage.removeItem('token');
                    setTimeout(() => {
                        window.location.href = '/login.html';
                    }, 2000);
                } else if (error.message.includes('User ID')) {
                    errorMessage = 'User ID is missing. Please try refreshing the page.';
                } else if (error.message.includes('ValidationError')) {
                    errorMessage = 'Please check all the payment details are entered correctly.';
                } else if (error.message.includes('Server error')) {
                    errorMessage = 'There was a problem saving your payment details. Please try again.';
                }
                this.showStatusMessage(errorMessage, 'error');
            }
        } catch (error) {
            console.error('Network or server error:', error);
            const errorMessage = 'Could not connect to the server. Please check your internet connection and try again.';
            this.showStatusMessage(errorMessage, 'error');
        }
    }

    handleFormCancel(type) {
        const checkbox = document.getElementById('enable' + type.charAt(0).toUpperCase() + type.slice(1));
        if (checkbox) {
            checkbox.checked = false;
            this.togglePaymentForm(checkbox);
        }
    }

    showStatusMessage(message, type = 'success') {
        const statusDiv = document.createElement('div');
        statusDiv.className = `payment-status-message ${type}`;
        statusDiv.textContent = message;
        
        // Remove any existing status messages
        const existingStatus = document.querySelector('.payment-status-message');
        if (existingStatus) {
            existingStatus.remove();
        }
        
        // Add the new status message
        const container = document.querySelector('.payment-container');
        if (container) {
            container.insertBefore(statusDiv, container.firstChild);
            
            // Remove the message after 5 seconds
            setTimeout(() => {
                statusDiv.remove();
            }, 5000);
        }
    }
} // End of PaymentDetailsForm class

// Payment Integration Class
class PaymentIntegration {
    constructor() {
        this.paymentDetails = null;
        this.paymentForm = null;
        this.initialized = false;
        console.log('PaymentIntegration: Initializing...');
        this.loadRequiredScripts();
    }

    async loadRequiredScripts() {
        if (!document.getElementById('payment-styles')) {
            const link = document.createElement('link');
            link.id = 'payment-styles';
            link.rel = 'stylesheet';
            link.href = 'css/payment-styles.css';
            document.head.appendChild(link);
        }

    // Mark scripts/styles loaded. Do NOT auto-init here — wait for explicit init(profileUserId, loggedInUserId)
    // so ownership checks use the exact profile id passed by the host page.
    this.scriptsLoaded = true;
    console.debug('PaymentIntegration: required scripts/styles loaded; awaiting explicit init(profileUserId, loggedInUserId) from host');
    }

    // init can be called with optional profileUserId and loggedInUserId to gate owner-only behavior.
    // If called without args, it will attempt to infer ownership from window globals or token.
    async init(profileUserId, loggedInUserId) {
    if (this.initialized) return;
    // Ensure global reference exists for other scripts that may call loadPaymentBox before init completes
    window.paymentIntegration = window.paymentIntegration || this;

        // If required scripts haven't finished loading (styles etc.), wait a short window to allow hosting page to finish setup
        if (!this.scriptsLoaded) {
            console.debug('PaymentIntegration.init: scripts not fully loaded yet; waiting 200ms');
            await new Promise(res => setTimeout(res, 200));
        }

        // Determine ownership
        let isOwner = undefined;
        // Treat empty strings as missing — only use direct comparison when both are truthy
        if (profileUserId && loggedInUserId) {
            isOwner = String(profileUserId) === String(loggedInUserId);
        } else if (window.__PROFILE_USER_ID && window.__LOGGED_IN_USER_ID) {
            isOwner = String(window.__PROFILE_USER_ID) === String(window.__LOGGED_IN_USER_ID);
        } else {
            // Best-effort JWT decode to determine viewer id
            const token = localStorage.getItem('token');
            if (!token) {
                console.log('PaymentIntegration: no ownership info and no token - skipping init for visitor');
                return;
            }
            try {
                const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
                const viewerId = payload.userId || payload.id || payload.sub || payload._id || payload.uid;
                isOwner = !!viewerId && (!profileUserId || String(viewerId) === String(profileUserId));
            } catch (err) {
                console.warn('PaymentIntegration: failed to decode token for ownership check, skipping init');
                return;
            }
        }

        if (!isOwner) {
            console.log('PaymentIntegration: viewer is not profile owner — skipping payment box creation', { profileUserId, loggedInUserId, inferred: { '__PROFILE_USER_ID': window.__PROFILE_USER_ID, '__LOGGED_IN_USER_ID': window.__LOGGED_IN_USER_ID } });
            return;
        }

        // Owner: create elements and wire form logic
        this.createPaymentBoxElements();
        this.paymentForm = new PaymentDetailsForm();
        this.initialized = true;

        // Check whether owner has any saved payment methods; auto-open if none.
        try {
            const token = localStorage.getItem('token');

            // If we have both profileUserId and the viewer is different, fetch the profile-specific methods
            let fetchedJson = null;
            if (profileUserId && loggedInUserId && String(profileUserId) !== String(loggedInUserId)) {
                // Fetch profile-specific payment details (public read)
                try {
                    const resProfile = await fetch(`/api/payments/payment-details/${profileUserId}`);
                    const jsonProfile = await resProfile.json().catch(() => ({}));
                    if (resProfile.ok && jsonProfile && jsonProfile.success && jsonProfile.paymentDetails) {
                        fetchedJson = jsonProfile;
                    }
                } catch (e) {
                    console.warn('PaymentIntegration: could not fetch profile-specific payment details', e);
                }
            }

            // If not fetched from profile or viewer is the owner, and we have a token, fetch viewer's methods
            if (!fetchedJson && token) {
                try {
                    const resSelf = await fetch('/api/payments/payment-details', { headers: { 'Authorization': 'Bearer ' + token } });
                    const jsonSelf = await resSelf.json().catch(() => ({}));
                    if (resSelf.ok && jsonSelf && jsonSelf.success && jsonSelf.paymentDetails) {
                        fetchedJson = jsonSelf;
                    }
                } catch (e) {
                    console.warn('PaymentIntegration: could not fetch viewer payment details', e);
                }
            }

            // Default: treat as no methods if nothing fetched
            if (fetchedJson && fetchedJson.paymentDetails) {
                const pm = fetchedJson.paymentDetails.paymentMethods || {};
                const hasAny = (pm.upi && pm.upi.enabled) || (pm.bank && pm.bank.enabled) || (pm.cash && pm.cash.enabled);
                window.paymentIntegration = window.paymentIntegration || {};
                window.paymentIntegration.lastFetchedPaymentDetails = fetchedJson.paymentDetails;

                if (!hasAny) {
                    this.loadPaymentBox();
                } else {
                    console.log('PaymentIntegration: owner (or profile) has saved methods — not auto-opening');
                }
            } else {
                console.log('PaymentIntegration: no payment details found for profile/viewer — auto-opening');
                this.loadPaymentBox();
            }
        } catch (err) {
            console.warn('PaymentIntegration: error checking saved methods — proceeding without auto-open', err);
        }

    }

    createPaymentBoxElements() {
            // If an overlay exists in static HTML, repair its internals; otherwise create fresh.
            let overlay = document.getElementById('paymentBoxOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'paymentBoxOverlay';
                overlay.className = 'payment-box-overlay';
                document.body.appendChild(overlay);
            }

            // Ensure container
            let container = document.getElementById('paymentBoxContainer');
            if (!container) {
                container = document.createElement('div');
                container.id = 'paymentBoxContainer';
                container.className = 'payment-box-container';
                overlay.appendChild(container);
                console.debug('PaymentIntegration: created paymentBoxContainer');
            }

            // Ensure close button
            let closeBtn = container.querySelector('.payment-close-btn');
            if (!closeBtn) {
                closeBtn = document.createElement('button');
                closeBtn.className = 'payment-close-btn';
                closeBtn.innerHTML = '&times;';
                // Prefer addEventListener so multiple handlers don't clobber existing ones
                closeBtn.addEventListener('click', () => this.closePaymentBox());
                container.insertBefore(closeBtn, container.firstChild || null);
            }

            // Also attach a delegated listener on the container to catch any dynamically-added close buttons
            container.addEventListener('click', (e) => {
                if (e.target && (e.target.classList && e.target.classList.contains('payment-close-btn'))) {
                    this.closePaymentBox();
                }
            });

            // Ensure content wrapper
            let contentWrapper = container.querySelector('.payment-content-wrapper');
            if (!contentWrapper) {
                contentWrapper = document.createElement('div');
                contentWrapper.className = 'payment-content-wrapper';
                container.appendChild(contentWrapper);
                console.debug('PaymentIntegration: created payment-content-wrapper');
            }

            // Attach click-to-close on overlay
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) {
                    this.closePaymentBox();
                }
            });
    }

    async loadPaymentBox() {
        console.log('PaymentIntegration: Loading payment box...');
    // Ensure required DOM exists. createPaymentBoxElements is idempotent.
    console.debug('PaymentIntegration.loadPaymentBox: ensuring DOM elements...');
    this.createPaymentBoxElements();
    if (!this.paymentForm) this.paymentForm = new PaymentDetailsForm();
    const container = document.getElementById('paymentBoxContainer');
    if (!container) {
        console.error('PaymentIntegration.loadPaymentBox: no container found after createPaymentBoxElements');
        return;
    }
        // Immediately show a lightweight loader so the modal opens fast when owner clicks the button
        try {
            let contentWrapper = container.querySelector('.payment-content-wrapper');
            if (!contentWrapper) {
                contentWrapper = document.createElement('div');
                contentWrapper.className = 'payment-content-wrapper';
                container.appendChild(contentWrapper);
            }
            contentWrapper.innerHTML = '<div style="padding:24px;text-align:center;color:#374151;"><strong>Loading payment settings...</strong><div style="margin-top:12px;">⏳</div></div>';
            console.debug('PaymentIntegration.loadPaymentBox: displayed lightweight loader');
            this.showPaymentBox();

            // Proceed to fetch and replace the content
            const response = await fetch('/PaymentDetailsBox.html');
            const html = await response.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            doc.querySelectorAll('style').forEach(style => {
                if (!document.getElementById(style.id)) {
                    document.head.appendChild(style.cloneNode(true));
                }
            });

            const paymentContainer = doc.querySelector('.payment-container');
            if (paymentContainer) {
                const contentWrapper = container.querySelector('.payment-content-wrapper');
                // Replace loading placeholder with fetched markup
                contentWrapper.innerHTML = paymentContainer.innerHTML;

                // If the saved-payments section exists in the source but was placed outside .payment-container,
                // inject it as well so saved methods are visible in the modal.
                if (!contentWrapper.querySelector('.saved-payments')) {
                    const docSaved = doc.querySelector('.saved-payments');
                    if (docSaved) {
                        contentWrapper.insertAdjacentHTML('beforeend', docSaved.outerHTML);
                    }
                }

                // Add a small, non-disruptive debug tracker so QA/dev can see fetch/apply status
                if (!contentWrapper.querySelector('#paymentDebugTracker')) {
                    const tracker = document.createElement('div');
                    tracker.id = 'paymentDebugTracker';
                    tracker.style.cssText = 'margin-top:10px;font-size:12px;color:#374151;opacity:0.9;';
                    tracker.innerHTML = '<strong>Payment Debug:</strong> idle';
                    contentWrapper.appendChild(tracker);
                }
                  
                // 'Your Payment Method' block appended elsewhere; we intentionally skip injecting the duplicate here.

                // Initialize form handlers after content is loaded and then load saved methods
                setTimeout(async () => {
                    this.paymentForm.init();

                    // Attempt to load saved payment details for the profile being viewed
                    const trackerEl = document.getElementById('paymentDebugTracker');
                    if (trackerEl) trackerEl.innerHTML = '<strong>Payment Debug:</strong> fetching saved payment details... <span style="color:#6b7280">(' + new Date().toLocaleTimeString() + ')</span>';

                    try {
                        const profileUserId = new URLSearchParams(window.location.search).get('id');
                        const token = localStorage.getItem('token');

                        // If logged in, prefer fetching current user's methods
                        if (token) {
                            const res = await fetch('/api/payments/payment-details', { headers: { 'Authorization': 'Bearer ' + token } });
                            const json = await res.json().catch(() => ({}));
                            if (res.ok && json && json.success && json.paymentDetails) {
                                window.paymentIntegration = window.paymentIntegration || {};
                                window.paymentIntegration.lastFetchedPaymentDetails = json.paymentDetails;
                                this.paymentForm.updateSavedMethodsUI(json.paymentDetails);
                                if (trackerEl) trackerEl.innerHTML = '<strong>Payment Debug:</strong> fetched current user methods OK <span style="color:#059669">(' + new Date().toLocaleTimeString() + ')</span>';
                                return;
                            }

                            // If authenticated fetch had no data and we have a profile id, try profile GET as fallback
                            if (profileUserId) {
                                const headers = { 'Authorization': 'Bearer ' + token };
                                const res2 = await fetch(`/api/payments/payment-details/${profileUserId}`, { headers });
                                const json2 = await res2.json().catch(() => ({}));
                                if (res2.ok && json2 && json2.success && json2.paymentDetails) {
                                    window.paymentIntegration = window.paymentIntegration || {};
                                    window.paymentIntegration.lastFetchedPaymentDetails = json2.paymentDetails;
                                    this.paymentForm.updateSavedMethodsUI(json2.paymentDetails, { syncLocalStorage: false });
                                    if (trackerEl) trackerEl.innerHTML = '<strong>Payment Debug:</strong> fetched profile methods OK <span style="color:#059669">(' + new Date().toLocaleTimeString() + ')</span>';
                                    return;
                                }
                            }

                            if (trackerEl) trackerEl.innerHTML = '<strong>Payment Debug:</strong> no saved methods for current user/profile <span style="color:#d97706">(' + new Date().toLocaleTimeString() + ')</span>';
                            return;
                        }

                        // Not logged in — fetch profile-specific methods if profile id present
                        if (profileUserId) {
                            const res = await fetch(`/api/payments/payment-details/${profileUserId}`);
                            const json = await res.json().catch(() => ({}));
                            if (res.ok && json && json.success && json.paymentDetails) {
                                window.paymentIntegration = window.paymentIntegration || {};
                                window.paymentIntegration.lastFetchedPaymentDetails = json.paymentDetails;
                                this.paymentForm.updateSavedMethodsUI(json.paymentDetails, { syncLocalStorage: false });
                                if (trackerEl) trackerEl.innerHTML = '<strong>Payment Debug:</strong> fetched profile methods OK <span style="color:#059669">(' + new Date().toLocaleTimeString() + ')</span>';
                                return;
                            }
                            if (trackerEl) trackerEl.innerHTML = '<strong>Payment Debug:</strong> no saved methods for profile <span style="color:#d97706">(' + new Date().toLocaleTimeString() + ')</span>';
                            return;
                        }

                        if (trackerEl) trackerEl.innerHTML = '<strong>Payment Debug:</strong> no token and no profile id - cannot fetch <span style="color:#d97706">(' + new Date().toLocaleTimeString() + ')</span>';
                    } catch (err) {
                        console.warn('Could not load saved payment details for modal:', err);
                        if (trackerEl) trackerEl.innerHTML = '<strong>Payment Debug:</strong> fetch error <span style="color:#dc2626">(' + new Date().toLocaleTimeString() + ')</span>';
                    } finally {
                        // Ensure the modal is visible after attempting hydration
                        this.showPaymentBox();
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Error loading payment box:', error);
        }
    }

    showPaymentBox() {
        const overlay = document.getElementById('paymentBoxOverlay');
        const container = document.getElementById('paymentBoxContainer');
        if (overlay && container) {
            overlay.classList.add('show');
            container.classList.add('show');
            // Defensive fallback in case CSS hasn't loaded yet
            overlay.style.display = overlay.style.display || 'block';
            container.style.display = container.style.display || 'block';
            console.debug('PaymentIntegration.showPaymentBox: overlay shown');
        }
    }

    closePaymentBox() {
        const overlay = document.getElementById('paymentBoxOverlay');
        const container = document.getElementById('paymentBoxContainer');
        if (overlay && container) {
            overlay.classList.remove('show');
            container.classList.remove('show');
            // Remove any defensive inline styles we may have set in showPaymentBox
            try {
                overlay.style.display = '';
                container.style.display = '';
            } catch (e) {
                // ignore in case elements are removed
            }
            console.debug('PaymentIntegration.closePaymentBox: overlay hidden');
        }
    }

    canAccessPaymentSettings() {
        return true; // Modify based on your authentication logic
    }
}
// Make onRazorpaySuccess globally available for Razorpay callback
window.onRazorpaySuccess = async function (razorpayResponse, bookingFormData) {
    try {
        // Send server the razorpay response + booking snapshot so it can create/save the booking
        const payload = { razorpay: razorpayResponse, booking: bookingFormData };
        const res = await fetch('/api/payments/success', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            console.error('Server responded with error:', data);
            alert('Payment succeeded but server side booking failed. Check logs.');
            return;
        }

        // Determine bookingId returned by the server (flexible checks)
        const bookingId = data.bookingId || (data.booking && data.booking._id) || bookingFormData.bookingId || bookingFormData.id;

        // Show a small status message (create element if not present)
        const message = document.getElementById('paymentMessage') || (function createMsg(){
            const el = document.createElement('div');
            el.id = 'paymentMessage';
            el.style.position = 'fixed';
            el.style.right = '20px';
            el.style.bottom = '20px';
            el.style.padding = '10px 14px';
            el.style.background = '#fff';
            el.style.border = '1px solid #e5e7eb';
            el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
            el.style.zIndex = 99999;
            document.body.appendChild(el);
            return el;
        })();

        message.textContent = '✅ Payment processed. Booking created. Preparing confirmation...';
        message.style.color = 'green';

        // Try to reset booking form if present (safe no-op otherwise)
        try {
            const bookingForm = document.querySelector('#bookingForm') || document.querySelector('form[name="booking"]');
            if (bookingForm && typeof bookingForm.reset === 'function') bookingForm.reset();
        } catch (e) {
            // ignore
        }

        // Poll booking status until webhook marks capture (or give up)
        if (!bookingId) {
            console.warn('No bookingId returned by server; cannot poll for confirmation PDF.');
            message.textContent = '✅ Payment processed. Confirmation will be emailed / sent by WhatsApp shortly.';
            if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'closeBookingModal' }, '*');
            return;
        }

        const maxAttempts = 10;
        let attempts = 0;
        const checkInterval = 2000; // ms

        async function poll() {
            attempts++;
            try {
                const st = await fetch(`/api/escrow/bookings/${bookingId}`);
                const js = await st.json().catch(() => ({}));
                if (st.ok && js && js.success && js.booking && js.booking.paymentStatus === 'captured') {
                    // get confirmation pdf
                    const pdfRes = await fetch(`/api/escrow/bookings/${bookingId}/confirmation`);
                    if (pdfRes.ok) {
                        const blob = await pdfRes.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `booking-${bookingId}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                    } else {
                        console.warn('Could not fetch confirmation PDF yet');
                    }
                    // close modal via postMessage
                    if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'closeBookingModal' }, '*');
                    // hide status message after a short delay
                    setTimeout(() => { try { message.remove(); } catch (e) {} }, 3000);
                    return;
                }
            } catch (err) {
                console.warn('poll error', err);
            }
            if (attempts < maxAttempts) setTimeout(poll, checkInterval);
            else {
                message.textContent = '✅ Payment processed. Confirmation will be emailed / sent by WhatsApp shortly.';
                if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'closeBookingModal' }, '*');
                setTimeout(() => { try { message.remove(); } catch (e) {} }, 4000);
            }
        }

        setTimeout(poll, 800); // small initial delay
    } catch (err) {
        console.error('onRazorpaySuccess error:', err);
        alert('Payment succeeded but there was an error processing booking.');
    }
};

// Initialize the payment integration
window.paymentIntegration = new PaymentIntegration();
