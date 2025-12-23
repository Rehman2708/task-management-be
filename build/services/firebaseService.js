import nodemailer from "nodemailer";
// Create transporter once at module load for better performance
let transporter = null;
let isTestMode = false;
async function getTransporter() {
    if (transporter)
        return transporter;
    // Try Gmail first, fallback to Ethereal for testing
    if (process.env.GMAIL_USER &&
        process.env.GMAIL_APP_PASSWORD &&
        process.env.GMAIL_APP_PASSWORD !== "your-actual-16-char-app-password") {
        // Use Gmail if proper credentials are provided
        transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
            pool: true, // Use connection pooling
            maxConnections: 5, // Maximum concurrent connections
            maxMessages: 100, // Maximum messages per connection
        });
    }
    else {
        // Use Ethereal for testing (creates temporary test emails)
        console.log("🧪 Using Ethereal test email service...");
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
            pool: true,
            maxConnections: 3,
            maxMessages: 50,
        });
        isTestMode = true;
    }
    return transporter;
}
export class FirebaseEmailService {
    /**
     * Send OTP email using Nodemailer with Gmail - OPTIMIZED
     */
    static async sendOTPEmail(email, otp, name) {
        try {
            const emailTransporter = await getTransporter();
            // Email template
            const mailOptions = {
                from: isTestMode
                    ? '"RMK Task App" <noreply@taskapp.com>'
                    : process.env.GMAIL_USER,
                to: email,
                subject: "🔐 Your OTP Code - RMK Task App",
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #3F87E9;">♥️ RMK</h1>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
              <h2 style="color: #333; margin-bottom: 20px;">Hello ${name}! 👋</h2>
              
              <p style="color: #666; font-size: 16px; margin-bottom: 30px;">
                Your verification code for Task Management App is:
              </p>
              
              <div style="background-color: #3F87E9; color: white; padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                ${otp}
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                ⏰ This code will expire in <strong>10 minutes</strong>
              </p>
              
              <p style="color: #999; font-size: 12px; margin-top: 20px;">
                If you didn't request this code, please ignore this email.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
              <p>© 2025 RMK Task App. Made with ❤️</p>
            </div>
          </div>
        `,
            };
            // Send email
            const info = await emailTransporter.sendMail(mailOptions);
            if (isTestMode) {
                console.log(`🧪 Test email sent! Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
                console.log(`📧 OTP for ${email}: ${otp}`);
            }
            else {
                console.log(`✅ OTP email sent successfully to ${email}`);
            }
            return true;
        }
        catch (error) {
            console.error("❌ Failed to send OTP email:", error);
            return false;
        }
    }
    /**
     * Generate a 6-digit OTP
     */
    static generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
}
