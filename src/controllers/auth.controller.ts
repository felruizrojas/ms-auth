import { Request, Response } from 'express';
import * as AuthService from '../services/auth.service';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middlewares/verifyToken';

// RF-01
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { errorResponse(res, 'Email y contraseña requeridos'); return; }
    const data = await AuthService.login(email, password);
    successResponse(res, data);
  } catch (err: any) {
    errorResponse(res, err.message, 401);
  }
};

// RF-02
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { errorResponse(res, 'Refresh token requerido'); return; }
    const data = await AuthService.refreshSession(refreshToken);
    successResponse(res, data);
  } catch (err: any) {
    errorResponse(res, err.message, 401);
  }
};

// RF-04
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    const authHeader = req.headers['authorization'];
    const accessToken = authHeader && authHeader.split(' ')[1];

    if (!refreshToken || !accessToken) {
      errorResponse(res, 'Refresh token y Access token requeridos');
      return;
    }

    await AuthService.logout(refreshToken, accessToken);
    successResponse(res, { message: 'Sesión cerrada correctamente' });
  } catch (err: any) {
    errorResponse(res, err.message);
  }
};

// RF-05 — Llamado por MS-02, quien determina y envía el rol en el body
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) { errorResponse(res, 'Email y contraseña requeridos'); return; }
    if (!role) { errorResponse(res, 'Rol requerido'); return; }
    if (password.length < 6) { errorResponse(res, 'La contraseña debe tener al menos 6 caracteres'); return; }
    const data = await AuthService.register(email, password, role);
    successResponse(res, data, 201);
  } catch (err: any) {
    errorResponse(res, err.message);
  }
};

// Paso 1 — Solicitar OTP
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) { errorResponse(res, 'Email requerido'); return; }
    const data = await AuthService.forgotPassword(email);
    successResponse(res, data);
  } catch (err: any) {
    errorResponse(res, err.message, err.status ?? 400);
  }
};

// Paso 2 — Verificar OTP y cambiar contraseña
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) { errorResponse(res, 'Email, código y nueva contraseña requeridos'); return; }
    if (newPassword.length < 6) { errorResponse(res, 'La contraseña debe tener al menos 6 caracteres'); return; }
    const data = await AuthService.resetPassword(email, code, newPassword);
    successResponse(res, data);
  } catch (err: any) {
    errorResponse(res, err.message, err.status ?? 400);
  }
};

// Interno — Solo llamado por MS-02
export const updateRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { role } = req.body;
    if (!role) { errorResponse(res, 'Rol requerido'); return; }
    await AuthService.updateRole(id, role);
    successResponse(res, { message: 'Rol actualizado correctamente' });
  } catch (err: any) {
    errorResponse(res, err.message);
  }
};

// Interno — Desactivar credencial
export const deactivateCredential = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await AuthService.deactivateCredential(id);
    successResponse(res, { message: 'Credencial desactivada correctamente' });
  } catch (err: any) {
    errorResponse(res, err.message, 404);
  }
};

// RF — Cambiar contraseña
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) { errorResponse(res, 'Contraseña actual y nueva contraseña requeridas'); return; }
    if (newPassword.length < 6) { errorResponse(res, 'La nueva contraseña debe tener al menos 6 caracteres'); return; }
    const data = await AuthService.changePassword(req.user!.id, currentPassword, newPassword);
    successResponse(res, data);
  } catch (err: any) {
    errorResponse(res, err.message, err.status ?? 400);
  }
};

// Interno — Eliminar credencial (rollback)
export const deleteCredential = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await AuthService.deleteCredential(id);
    successResponse(res, { message: 'Credencial eliminada correctamente' });
  } catch (err: any) {
    errorResponse(res, err.message);
  }
};