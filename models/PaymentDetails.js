const mongoose = require('mongoose');

const paymentDetailsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    paymentMethods: {
        upi: {
            enabled: {
                type: Boolean,
                default: false
            },
            upiId: String,
            qrCode: String
        },
        bank: {
            enabled: {
                type: Boolean,
                default: false
            },
            bankName: String,
            accountNumber: String,
            accountHolder: String,
            ifscCode: String
        },
        cash: {
            enabled: {
                type: Boolean,
                default: false
            }
        }
    },
    // Common fields
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt field before saving
paymentDetailsSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('PaymentDetails', paymentDetailsSchema);
