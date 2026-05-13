import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../config/db';
import { Credential } from '../models/Credential';
import { RefreshToken } from '../models/RefreshToken';
import { RevokedToken } from '../models/RevokedToken';
import { PasswordResetOtp } from '../models/PasswordResetOtp';
import { sendOtpEmail } from '../utils/mailer';

const credentialRepo = () => AppDataSource.getRepository(Credential);
const refreshTokenRepo = () => AppDataSource.getRepository(RefreshToken);
const revokedTokenRepo = () => AppDataSource.getRepository(RevokedToken);
const otpRepo = () => AppDataSource.getRepository(PasswordResetOtp);

const ACCESS_TOKEN_TTL = 15 * 60;              // 15 minutos en segundos
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60;   // 7 días en segundos

// RF-01 — Login
export const login = async (email: string, password: string) => {
  email = email.toLowerCase();
  const credential = await credentialRepo().findOne({ where: { email, is_active: true } });
  if (!credential) throw new Error('Credenciales inválidas');

  const valid = await bcrypt.compare(password, credential.password_hash);
  if (!valid) throw new Error('Credenciales inválidas');

  const accessToken = jwt.sign(
    { id: credential.id, email: credential.email, role: credential.role },
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

  const activeSessions = await refreshTokenRepo().count({ where: { credential_id: credential.id } });
  if (activeSessions >= 5) {
    const oldest = await refreshTokenRepo().find({
      where: { credential_id: credential.id },
      order: { created_at: 'ASC' },
      take: 1,
    });
    if (oldest.length) await refreshTokenRepo().delete({ token: oldest[0].token });
  }

  const refreshToken = uuidv4();
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);
  await refreshTokenRepo().save({
    token: refreshToken,
    credential_id: credential.id,
    expires_at: refreshExpiresAt,
  });

  return { accessToken, refreshToken };
};

// RF-02 — Refresh Token
export const refreshSession = async (token: string) => {
  const refreshRecord = await refreshTokenRepo().findOne({ where: { token } });

  if (!refreshRecord || refreshRecord.expires_at <= new Date()) {
    await refreshTokenRepo().delete({ token });
    throw new Error('Refresh token inválido o expirado');
  }

  const credential = await credentialRepo().findOne({
    where: { id: refreshRecord.credential_id, is_active: true },
  });
  if (!credential) throw new Error('Usuario no encontrado');

  await refreshTokenRepo().delete({ token });

  const accessToken = jwt.sign(
    { id: credential.id, email: credential.email, role: credential.role },
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

  const newRefreshToken = uuidv4();
  const newRefreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);
  await refreshTokenRepo().save({
    token: newRefreshToken,
    credential_id: credential.id,
    expires_at: newRefreshExpiresAt,
  });

  return { accessToken, refreshToken: newRefreshToken };
};

// RF-04 — Logout
export const logout = async (refreshToken: string, accessToken: string) => {
  await refreshTokenRepo().delete({ token: refreshToken });

  const decoded = jwt.decode(accessToken) as jwt.JwtPayload | string | null;
  if (decoded && typeof decoded !== 'string' && decoded.exp) {
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await revokedTokenRepo().upsert(
        {
          token: accessToken,
          expires_at: new Date(decoded.exp * 1000),
        },
        ['token']
      );
    }
  }
};

// RF-05 — Registro (el rol lo determina MS-02, por defecto ciudadano)
export const register = async (email: string, password: string, role: string = 'ciudadano') => {
  email = email.toLowerCase();
  const exists = await credentialRepo().findOne({ where: { email } });
  if (exists) throw new Error('El correo ya está registrado');

  const password_hash = await bcrypt.hash(password, 10);
  const credential = credentialRepo().create({ email, password_hash, role });
  await credentialRepo().save(credential);

  return { id: credential.id, email: credential.email, role: credential.role };
};

// Paso 1 — Solicitar OTP de recuperación
export const forgotPassword = async (email: string) => {
  email = email.toLowerCase();
  const credential = await credentialRepo().findOne({ where: { email } });

  if (credential) {
    await otpRepo().delete({ email });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000);

    await otpRepo().save({ email, code, expires_at, used: false });
    await sendOtpEmail(email, code);
  }

  return { message: 'Si el correo está registrado, recibirás un código de verificación' };
};

// Paso 2 — Verificar OTP y cambiar contraseña
export const resetPassword = async (email: string, code: string, newPassword: string) => {
  email = email.toLowerCase();

  const otp = await otpRepo().findOne({ where: { email, code, used: false } });

  if (!otp) throw Object.assign(new Error('Código inválido'), { status: 400 });
  if (otp.expires_at <= new Date()) {
    await otpRepo().delete({ id: otp.id });
    throw Object.assign(new Error('Código expirado'), { status: 400 });
  }

  await otpRepo().delete({ id: otp.id });

  const password_hash = await bcrypt.hash(newPassword, 10);
  await credentialRepo().update({ email }, { password_hash });

  return { message: 'Contraseña actualizada correctamente' };
};

// Interno — Actualización de rol llamada por MS-02
export const updateRole = async (credentialId: string, role: string) => {
  const credential = await credentialRepo().findOne({ where: { id: credentialId } });
  if (!credential) throw new Error('Credencial no encontrada');

  await credentialRepo().update({ id: credentialId }, { role });
};

// Interno — Desactivar credencial llamada por MS-02
export const deactivateCredential = async (credentialId: string) => {
  const credential = await credentialRepo().findOne({ where: { id: credentialId } });
  if (!credential) throw new Error('Credencial no encontrada');

  await credentialRepo().update({ id: credentialId }, { is_active: false });
};

// Interno — Eliminar credencial (rollback de registro fallido)
export const deleteCredential = async (credentialId: string) => {
  await credentialRepo().delete({ id: credentialId });
};

// RF — Cambiar contraseña (usuario autenticado)
export const changePassword = async (credentialId: string, currentPassword: string, newPassword: string) => {
  const credential = await credentialRepo().findOne({ where: { id: credentialId, is_active: true } });
  if (!credential) throw new Error('Credencial no encontrada');

  const valid = await bcrypt.compare(currentPassword, credential.password_hash);
  if (!valid) throw Object.assign(new Error('La contraseña actual es incorrecta'), { status: 400 });

  const password_hash = await bcrypt.hash(newPassword, 10);
  await credentialRepo().update({ id: credentialId }, { password_hash });

  return { message: 'Contraseña actualizada correctamente' };
};
