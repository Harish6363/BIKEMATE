const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  level: { 
    type: String, 
    enum: ['INFO', 'SECURITY', 'WARNING', 'ERROR', 'SOS'], 
    default: 'INFO' 
  },
  actionEvent: { type: String, required: true },
  user: { type: String, default: 'System Admin' },
  details: { type: String, default: '' }
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
