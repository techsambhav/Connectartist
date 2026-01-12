/**
 * Payment Details Module for ConnectArtist
 * Handles all payment-related functionality including:
 * - Payment status boxes (yellow/green)
 * - Payment modal with forms
 * - Saving/editing payment details
 * - Role-based visibility
 */

class PaymentDetails {
    constructor(options = {}) {
        // Configuration options
        this.options = {
            userId: null,             // Current logged-in user ID
            profileUserId: null,      // Profile being viewed user ID
            isArtist: false,          // If current user is an artist
            apiBaseUrl: '/api',       // Base API URL
            ...options
        };

        // DOM Elements
        this.elements = {
            paymentStatusBox: null,
            paymentModal: null,
            paymentForm: null,
            savedDetails: null,
            statusMessage: null
        };

        // State
        this.state = {
            paymentDetails: null,
            isComplete: false
        };

        // Initialize
        this.init();
    }

    /**
     * Initialize the payment details system
     */
    async init() {
        // Check if we should show payment functionality
        if (!this.shouldShowPaymentUI()) return;

        // Create and inject the payment status box
        this.injectPaymentStatusBox();

        // Load payment details
        await this.loadPaymentDetails();

        // If details aren't complete and this is the artist's own profile, show modal
        if (!this.state.isComplete && this.isOwnProfile()) {
            this.showPaymentModal();
        }
    }

    /**
     * Check if payment UI should be shown
     */
    shouldShowPaymentUI() {
        return this.options.isArtist && this.isOwnProfile();
    }

    /**
     * Check if current user is viewing their own profile
     */
    isOwnProfile() {
        return this.options.userId && this.options.profileUserId && 
               this.options.userId === this.options.profileUserId;
    }

    /**
     * Inject the payment status box into the DOM
     */
    injectPaymentStatusBox() {
        // Create the status box element
        const statusBox = document.createElement('div');
        statusBox.id = 'paymentStatusBox';
        statusBox.className = 'payment-status-box';
        statusBox.innerHTML = `
            <div class="payment-status-content">
                <i class="fas ${this.state.isComplete ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
                <span>${this.state.isComplete ? 'Payment Details Complete' : 'Payment Setup Required'}</span>
                <button class="payment-status-btn">
                    ${this.state.isComplete ? 'View Details' : 'Setup Now'}
                </button>
            </div>
        `;

        // Add to the bottom of the profile container
        const profileContainer = document.querySelector('.profile-container');
        if (profileContainer) {
            profileContainer.appendChild(statusBox);
            this.elements.paymentStatusBox = statusBox;

            // Add click handler
            statusBox.querySelector('.payment-status-btn').addEventListener('click', () => {
                this.showPaymentModal();
            });
        }

        // Add styles if not already present
        this.injectStyles();
    }

    /**
     * Inject necessary styles for payment components
     */
    injectStyles() {
        if (document.getElementById('paymentDetailsStyles')) return;

        const style = document.createElement('style');
        style.id = 'paymentDetailsStyles';
        style.textContent = `
            .payment-status-box {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background-color: ${this.state.isComplete ? '#4CAF50' : '#FF9800'};
                color: white;
                padding: 15px 25px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                z-index: 100;
                cursor: pointer;
                transition: all 0.3s ease;
                max-width: 90%;
                width: max-content;
            }
            
            .payment-status-box:hover {
                transform: translateX(-50%) translateY(-3px);
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
            }
            
            .payment-status-content {
                display: flex;
                align-items: center;
                gap: 12px;
                font-weight: 500;
            }
            
            .payment-status-box i {
                font-size: 1.2em;
            }
            
            .payment-status-btn {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
                transition: background 0.2s;
                margin-left: 10px;
            }
            
            .payment-status-btn:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .payment-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }
            
            .payment-modal-overlay.active {
                opacity: 1;
                pointer-events: all;
            }
            
            .payment-modal {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 600px;
                max-height: 90vh;
                overflow-y: auto;
                transform: translateY(20px);
                transition: transform 0.3s ease;
                color: #333;
            }
            
            .payment-modal-overlay.active .payment-modal {
                transform: translateY(0);
            }
            
            .payment-modal-header {
                padding: 20px;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .payment-modal-title {
                font-size: 1.5rem;
                font-weight: 600;
            }
            
            .payment-modal-close {
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: #666;
            }
            
            .payment-modal-body {
                padding: 20px;
            }
            
            .payment-tabs {
                display: flex;
                border-bottom: 1px solid #eee;
                margin-bottom: 20px;
            }
            
            .payment-tab {
                padding: 10px 20px;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
            }
            
            .payment-tab.active {
                border-bottom-color: #4a6fa5;
                color: #4a6fa5;
                font-weight: 500;
            }
            
            .payment-tab-content {
                display: none;
            }
            
            .payment-tab-content.active {
                display: block;
            }
            
            .payment-form-group {
                margin-bottom: 15px;
            }
            
            .payment-form-group label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
            }
            
            .payment-form-control {
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 1rem;
            }
            
            .payment-form-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 20px;
            }
            
            .payment-btn {
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s;
            }
            
            .payment-btn-primary {
                background: #4a6fa5;
                color: white;
                border: none;
            }
            
            .payment-btn-primary:hover {
                background: #3a5a8f;
            }
            
            .payment-btn-secondary {
                background: #f5f5f5;
                color: #333;
                border: 1px solid #ddd;
            }
            
            .payment-btn-secondary:hover {
                background: #e9e9e9;
            }
            
            .payment-details-card {
                background: #f9f9f9;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
            }
            
            .payment-details-row {
                display: flex;
                margin-bottom: 10px;
            }
            
            .payment-details-label {
                font-weight: 500;
                min-width: 120px;
                color: #666;
            }
            
            .payment-details-value {
                flex: 1;
            }
            
            .payment-status-message {
                padding: 10px;
                border-radius: 4px;
                margin-bottom: 15px;
                display: none;
            }
            
            .payment-status-success {
                background: rgba(76, 175, 80, 0.1);
                color: #4CAF50;
                border: 1px solid #4CAF50;
            }
            
            .payment-status-error {
                background: rgba(244, 67, 54, 0.1);
                color: #F44336;
                border: 1px solid #F44336;
            }
            
            .qr-code-container {
                text-align: center;
                margin: 20px 0;
            }
            
            .qr-code-preview {
                max-width: 200px;
                margin: 0 auto;
                border: 1px solid #eee;
                padding: 10px;
            }
            
            @media (max-width: 768px) {
                .payment-modal {
                    width: 95%;
                }
                
                .payment-details-row {
                    flex-direction: column;
                }
                
                .payment-details-label {
                    margin-bottom: 5px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * Load payment details from the server
     */
    async loadPaymentDetails() {
        try {
            const response = await fetch(`${this.options.apiBaseUrl}/payment-details`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.state.paymentDetails = data.details || null;
                this.state.isComplete = data.isComplete || false;
                
                // Update status box if it exists
                if (this.elements.paymentStatusBox) {
                    this.updateStatusBox();
                }
            }
        } catch (error) {
            console.error('Error loading payment details:', error);
        }
    }

    /**
     * Update the payment status box appearance
     */
    updateStatusBox() {
        if (!this.elements.paymentStatusBox) return;

        const isComplete = this.state.isComplete;
        const box = this.elements.paymentStatusBox;
        
        box.style.backgroundColor = isComplete ? '#4CAF50' : '#FF9800';
        box.innerHTML = `
            <div class="payment-status-content">
                <i class="fas ${isComplete ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
                <span>${isComplete ? 'Payment Details Complete' : 'Payment Setup Required'}</span>
                <button class="payment-status-btn">
                    ${isComplete ? 'View Details' : 'Setup Now'}
                </button>
            </div>
        `;

        // Re-add click handler
        box.querySelector('.payment-status-btn').addEventListener('click', () => {
            this.showPaymentModal();
        });
    }

    /**
     * Show the payment modal with appropriate content
     */
    showPaymentModal() {
        // Create modal if it doesn't exist
        if (!this.elements.paymentModal) {
            this.createPaymentModal();
        }

        // Show the modal
        document.body.appendChild(this.elements.paymentModal);
        setTimeout(() => {
            this.elements.paymentModal.classList.add('active');
        }, 10);
    }

    /**
     * Create the payment modal with all necessary content
     */
    createPaymentModal() {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'payment-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="payment-modal">
                <div class="payment-modal-header">
                    <h3 class="payment-modal-title">Payment Settings</h3>
                    <button class="payment-modal-close">&times;</button>
                </div>
                <div class="payment-modal-body">
                    <div id="paymentStatusMessage" class="payment-status-message"></div>
                    
                    ${this.state.isComplete ? this.createSavedDetailsView() : this.createPaymentForm()}
                </div>
            </div>
        `;

        // Close button handler
        modalOverlay.querySelector('.payment-modal-close').addEventListener('click', () => {
            this.hidePaymentModal();
        });

        // Overlay click handler
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.hidePaymentModal();
            }
        });

        this.elements.paymentModal = modalOverlay;
        this.elements.statusMessage = modalOverlay.querySelector('#paymentStatusMessage');
    }

    /**
     * Create the saved payment details view
     */
    createSavedDetailsView() {
        return `
            <div class="payment-details-card">
                <h4>Your Payment Details</h4>
                ${this.renderPaymentDetails()}
            </div>
            <div class="payment-form-actions">
                <button class="payment-btn payment-btn-secondary" id="paymentEditBtn">Edit Details</button>
                <button class="payment-btn payment-btn-primary" id="paymentCloseBtn">Close</button>
            </div>
        `;
    }

    /**
     * Render the payment details based on type
     */
    renderPaymentDetails() {
        if (!this.state.paymentDetails) return '<p>No payment details found.</p>';

        const details = this.state.paymentDetails;
        let html = '';

        if (details.type === 'upi') {
            html = `
                <div class="payment-details-row">
                    <div class="payment-details-label">Payment Method:</div>
                    <div class="payment-details-value">UPI Payment</div>
                </div>
                <div class="payment-details-row">
                    <div class="payment-details-label">UPI ID:</div>
                    <div class="payment-details-value">${details.upiId || 'Not provided'}</div>
                </div>
            `;

            if (details.qrCode) {
                html += `
                    <div class="payment-details-row">
                        <div class="payment-details-label">QR Code:</div>
                        <div class="payment-details-value">
                            <img src="${details.qrCode}" class="qr-code-preview" alt="UPI QR Code">
                        </div>
                    </div>
                `;
            }
        } else if (details.type === 'bank') {
            html = `
                <div class="payment-details-row">
                    <div class="payment-details-label">Payment Method:</div>
                    <div class="payment-details-value">Bank Transfer</div>
                </div>
                <div class="payment-details-row">
                    <div class="payment-details-label">Bank Name:</div>
                    <div class="payment-details-value">${details.bankName || 'Not provided'}</div>
                </div>
                <div class="payment-details-row">
                    <div class="payment-details-label">Account Number:</div>
                    <div class="payment-details-value">•••• ${details.accountNumber?.slice(-4) || '••••'}</div>
                </div>
                <div class="payment-details-row">
                    <div class="payment-details-label">Account Holder:</div>
                    <div class="payment-details-value">${details.accountHolder || 'Not provided'}</div>
                </div>
                <div class="payment-details-row">
                    <div class="payment-details-label">IFSC Code:</div>
                    <div class="payment-details-value">${details.ifscCode || 'Not provided'}</div>
                </div>
            `;
        } else if (details.type === 'cash') {
            html = `
                <div class="payment-details-row">
                    <div class="payment-details-label">Payment Method:</div>
                    <div class="payment-details-value">Cash Payment</div>
                </div>
                <div class="payment-details-row">
                    <div class="payment-details-label">Note:</div>
                    <div class="payment-details-value">
                        You'll need to arrange cash payments directly with event organizers
                    </div>
                </div>
            `;
        }

        return html;
    }

    /**
     * Create the payment form for setup
     */
    createPaymentForm() {
        return `
            <div class="payment-tabs">
                <div class="payment-tab active" data-tab="upi">UPI</div>
                <div class="payment-tab" data-tab="bank">Bank Transfer</div>
                <div class="payment-tab" data-tab="cash">Cash</div>
            </div>
            
            <div class="payment-tab-content active" id="upi-tab">
                <form id="upiPaymentForm">
                    <div class="payment-form-group">
                        <label for="upiId">UPI ID</label>
                        <input type="text" id="upiId" class="payment-form-control" placeholder="yourname@upi" required>
                    </div>
                    <div class="payment-form-group">
                        <label>QR Code (Optional)</label>
                        <input type="file" id="upiQrCode" accept="image/*" class="payment-form-control">
                        <div id="qrCodePreview" class="qr-code-container" style="display:none;">
                            <img id="qrCodeImage" class="qr-code-preview" src="" alt="UPI QR Code">
                            <button type="button" id="removeQrCode" class="payment-btn payment-btn-secondary">Remove QR Code</button>
                        </div>
                    </div>
                </form>
            </div>
            
            <div class="payment-tab-content" id="bank-tab">
                <form id="bankPaymentForm">
                    <div class="payment-form-group">
                        <label for="bankName">Bank Name</label>
                        <input type="text" id="bankName" class="payment-form-control" required>
                    </div>
                    <div class="payment-form-group">
                        <label for="accountNumber">Account Number</label>
                        <input type="text" id="accountNumber" class="payment-form-control" required>
                    </div>
                    <div class="payment-form-group">
                        <label for="accountHolder">Account Holder Name</label>
                        <input type="text" id="accountHolder" class="payment-form-control" required>
                    </div>
                    <div class="payment-form-group">
                        <label for="ifscCode">IFSC Code</label>
                        <input type="text" id="ifscCode" class="payment-form-control" required>
                    </div>
                </form>
            </div>
            
            <div class="payment-tab-content" id="cash-tab">
                <p>For cash payments, you'll need to arrange payment directly with the event organizer.</p>
            </div>
            
            <div class="payment-form-actions">
                <button class="payment-btn payment-btn-secondary" id="paymentCancelBtn">Cancel</button>
                <button class="payment-btn payment-btn-primary" id="paymentSaveBtn">Save Details</button>
            </div>
        `;
    }

    /**
     * Hide the payment modal
     */
    hidePaymentModal() {
        if (this.elements.paymentModal) {
            this.elements.paymentModal.classList.remove('active');
            setTimeout(() => {
                if (this.elements.paymentModal.parentNode) {
                    this.elements.paymentModal.parentNode.removeChild(this.elements.paymentModal);
                }
            }, 300);
        }
    }

    /**
     * Show a status message in the modal
     */
    showStatusMessage(message, type = 'success') {
        if (!this.elements.statusMessage) return;

        const element = this.elements.statusMessage;
        element.textContent = message;
        element.className = `payment-status-message payment-status-${type}`;
        element.style.display = 'block';

        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }

    /**
     * Setup event listeners for the payment modal
     */
    setupModalEventListeners() {
        if (!this.elements.paymentModal) return;

        // Tab switching
        this.elements.paymentModal.querySelectorAll('.payment-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                
                // Update active tab
                this.elements.paymentModal.querySelectorAll('.payment-tab').forEach(t => {
                    t.classList.remove('active');
                });
                tab.classList.add('active');
                
                // Update active content
                this.elements.paymentModal.querySelectorAll('.payment-tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                this.elements.paymentModal.querySelector(`#${tabName}-tab`).classList.add('active');
            });
        });

        // QR Code preview
        const qrCodeInput = this.elements.paymentModal.querySelector('#upiQrCode');
        if (qrCodeInput) {
            qrCodeInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const preview = this.elements.paymentModal.querySelector('#qrCodePreview');
                        const img = this.elements.paymentModal.querySelector('#qrCodeImage');
                        img.src = event.target.result;
                        preview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Remove QR Code
        const removeQrBtn = this.elements.paymentModal.querySelector('#removeQrCode');
        if (removeQrBtn) {
            removeQrBtn.addEventListener('click', () => {
                const qrCodeInput = this.elements.paymentModal.querySelector('#upiQrCode');
                const preview = this.elements.paymentModal.querySelector('#qrCodePreview');
                qrCodeInput.value = '';
                preview.style.display = 'none';
            });
        }

        // Save button
        const saveBtn = this.elements.paymentModal.querySelector('#paymentSaveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.savePaymentDetails();
            });
        }

        // Edit button
        const editBtn = this.elements.paymentModal.querySelector('#paymentEditBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.showEditView();
            });
        }

        // Close button
        const closeBtn = this.elements.paymentModal.querySelector('#paymentCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hidePaymentModal();
            });
        }

        // Cancel button
        const cancelBtn = this.elements.paymentModal.querySelector('#paymentCancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hidePaymentModal();
            });
        }
    }

    /**
     * Show the edit view of payment details
     */
    showEditView() {
        if (!this.elements.paymentModal || !this.state.paymentDetails) return;

        const details = this.state.paymentDetails;
        let html = '';

        if (details.type === 'upi') {
            html = `
                <div class="payment-tabs">
                    <div class="payment-tab active" data-tab="upi">UPI</div>
                </div>
                
                <div class="payment-tab-content active" id="upi-tab">
                    <form id="upiPaymentForm">
                        <div class="payment-form-group">
                            <label for="upiId">UPI ID</label>
                            <input type="text" id="upiId" class="payment-form-control" value="${details.upiId || ''}" required>
                        </div>
                        <div class="payment-form-group">
                            <label>QR Code (Optional)</label>
                            <input type="file" id="upiQrCode" accept="image/*" class="payment-form-control">
                            ${details.qrCode ? `
                                <div id="qrCodePreview" class="qr-code-container">
                                    <img id="qrCodeImage" class="qr-code-preview" src="${details.qrCode}" alt="UPI QR Code">
                                    <button type="button" id="removeQrCode" class="payment-btn payment-btn-secondary">Remove QR Code</button>
                                </div>
                            ` : ''}
                        </div>
                    </form>
                </div>
                
                <div class="payment-form-actions">
                    <button class="payment-btn payment-btn-secondary" id="paymentCancelBtn">Cancel</button>
                    <button class="payment-btn payment-btn-primary" id="paymentSaveBtn">Save Changes</button>
                </div>
            `;
        } else if (details.type === 'bank') {
            html = `
                <div class="payment-tabs">
                    <div class="payment-tab active" data-tab="bank">Bank Transfer</div>
                </div>
                
                <div class="payment-tab-content active" id="bank-tab">
                    <form id="bankPaymentForm">
                        <div class="payment-form-group">
                            <label for="bankName">Bank Name</label>
                            <input type="text" id="bankName" class="payment-form-control" value="${details.bankName || ''}" required>
                        </div>
                        <div class="payment-form-group">
                            <label for="accountNumber">Account Number</label>
                            <input type="text" id="accountNumber" class="payment-form-control" required>
                            <small>For security, please re-enter your full account number</small>
                        </div>
                        <div class="payment-form-group">
                            <label for="accountHolder">Account Holder Name</label>
                            <input type="text" id="accountHolder" class="payment-form-control" value="${details.accountHolder || ''}" required>
                        </div>
                        <div class="payment-form-group">
                            <label for="ifscCode">IFSC Code</label>
                            <input type="text" id="ifscCode" class="payment-form-control" value="${details.ifscCode || ''}" required>
                        </div>
                    </form>
                </div>
                
                <div class="payment-form-actions">
                    <button class="payment-btn payment-btn-secondary" id="paymentCancelBtn">Cancel</button>
                    <button class="payment-btn payment-btn-primary" id="paymentSaveBtn">Save Changes</button>
                </div>
            `;
        }

        this.elements.paymentModal.querySelector('.payment-modal-body').innerHTML = `
            <div id="paymentStatusMessage" class="payment-status-message"></div>
            ${html}
        `;

        this.elements.statusMessage = this.elements.paymentModal.querySelector('#paymentStatusMessage');
        this.setupModalEventListeners();
    }

    /**
     * Save payment details to the server
     */
    async savePaymentDetails() {
        try {
            // Determine which tab is active
            const activeTab = this.elements.paymentModal.querySelector('.payment-tab.active');
            if (!activeTab) throw new Error('No active payment method selected');

            const tabName = activeTab.getAttribute('data-tab');
            let paymentData = { type: tabName };

            // Validate and collect data based on payment type
            if (tabName === 'upi') {
                const upiId = this.elements.paymentModal.querySelector('#upiId').value.trim();
                if (!upiId) throw new Error('UPI ID is required');
                if (!this.validateUpiId(upiId)) throw new Error('Please enter a valid UPI ID (e.g., yourname@upi)');

                paymentData.upiId = upiId;

                // Handle QR code if present
                const qrCodeInput = this.elements.paymentModal.querySelector('#upiQrCode');
                if (qrCodeInput.files.length > 0) {
                    paymentData.qrCode = await this.getBase64(qrCodeInput.files[0]);
                } else {
                    const existingImg = this.elements.paymentModal.querySelector('#qrCodeImage');
                    if (existingImg && existingImg.src) {
                        paymentData.qrCode = existingImg.src;
                    }
                }
            } else if (tabName === 'bank') {
                const bankName = this.elements.paymentModal.querySelector('#bankName').value.trim();
                const accountNumber = this.elements.paymentModal.querySelector('#accountNumber').value.trim();
                const accountHolder = this.elements.paymentModal.querySelector('#accountHolder').value.trim();
                const ifscCode = this.elements.paymentModal.querySelector('#ifscCode').value.trim();

                if (!bankName || !accountNumber || !accountHolder || !ifscCode) {
                    throw new Error('All bank details are required');
                }

                if (!this.validateIfscCode(ifscCode)) {
                    throw new Error('Please enter a valid IFSC code (11 characters)');
                }

                paymentData.bankName = bankName;
                paymentData.accountNumber = accountNumber;
                paymentData.accountHolder = accountHolder;
                paymentData.ifscCode = ifscCode;
            } else if (tabName === 'cash') {
                // No additional data needed for cash payments
            }

            // Send to server
            const response = await fetch(`${this.options.apiBaseUrl}/payment-details`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    ...paymentData,
                    userId: this.options.userId
                })
            });

            const data = await response.json();

            if (data.success) {
                // Update local state with the saved data from server
                this.state.paymentDetails = data.paymentDetails;
                this.state.isComplete = true;

                // Update status box
                this.updateStatusBox();

                // Show success message
                this.showStatusMessage('Payment details saved successfully!');

                // Show saved details view
                this.elements.paymentModal.querySelector('.payment-modal-body').innerHTML = `
                    <div id="paymentStatusMessage" class="payment-status-message payment-status-success">
                        Payment details saved successfully!
                    </div>
                    ${this.createSavedDetailsView()}
                `;

                // Re-setup event listeners
                this.setupModalEventListeners();
            } else {
                throw new Error(data.message || 'Error saving payment details');
            }
        } catch (error) {
            console.error('Error saving payment details:', error);
            this.showStatusMessage(error.message, 'error');
        }
    }

    /**
     * Validate UPI ID format
     */
    validateUpiId(upiId) {
        return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(upiId);
    }

    /**
     * Validate IFSC code format
     */
    validateIfscCode(ifscCode) {
        return /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifscCode);
    }

    /**
     * Convert file to base64
     */
    getBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentDetails;
} else {
    window.PaymentDetails = PaymentDetails;
}