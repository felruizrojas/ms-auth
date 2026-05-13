import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const sendOtpEmail = async (email: string, code: string): Promise<void> => {
  await transporter.sendMail({
    from: `"Sanos y Salvos" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Recuperación de contraseña — Sanos y Salvos',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Recuperar contraseña</h2>
        <p>Tu código de verificación es:</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 24px 0; color: #2563eb;">
          ${code}
        </div>
        <p>Este código expira en <strong>10 minutos</strong>.</p>
        <p>Si no solicitaste esto, ignora este correo.</p>
      </div>
    `,
  });
};
