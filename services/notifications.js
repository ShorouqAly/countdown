const nodemailer = require('nodemailer');

class NotificationService {
  async sendRequestNotification(companyEmail, request) {
    // Send email when journalist requests product
  }

  async sendApprovalNotification(journalistEmail, request) {
    // Send email when request is approved
  }

  async sendReminderNotification(journalistEmail, request) {
    // Send reminder before deadline
  }
}

module.exports = new NotificationService();