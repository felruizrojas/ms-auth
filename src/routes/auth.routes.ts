import { Router } from 'express';
import * as AuthController from '../controllers/auth.controller';
import { internalAuth } from '../middlewares/internalAuth';
import { verifyToken } from '../middlewares/verifyToken';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registro de credenciales (RF-05)
 *     tags: [Auth]
 *     description: Llamado exclusivamente por MS-02. El rol es determinado por MS-02 según el tipo de registro.
 *     parameters:
 *       - in: header
 *         name: x-api-key
 *         required: true
 *         schema:
 *           type: string
 *         description: API key interna compartida entre microservicios
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, role]
 *             properties:
 *               email:
 *                 type: string
 *                 example: test@sanos.cl
 *               password:
 *                 type: string
 *                 example: "123456"
 *               role:
 *                 type: string
 *                 example: ciudadano
 *                 enum: [ciudadano, veterinaria, municipalidad, moderador, administrador, superadmin]
 *     responses:
 *       201:
 *         description: Credenciales creadas exitosamente
 *       400:
 *         description: El correo ya está registrado
 */
router.post('/register', internalAuth, AuthController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Inicio de sesión (RF-01)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: test@sanos.cl
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login exitoso, retorna accessToken y refreshToken
 *       401:
 *         description: Credenciales inválidas
 */
router.post('/login', AuthController.login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Renovación de sesión (RF-02)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: uuid-del-refresh-token
 *     responses:
 *       200:
 *         description: Nuevo accessToken generado
 *       401:
 *         description: Refresh token inválido o expirado
 */
router.post('/refresh', AuthController.refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cierre de sesión (RF-04)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: uuid-del-refresh-token
 *     responses:
 *       200:
 *         description: Sesión cerrada correctamente
 *       400:
 *         description: Refresh token y Access token requeridos
 */
router.post('/logout', AuthController.logout);

/**
 * @swagger
 * /api/auth/credentials/{id}/role:
 *   patch:
 *     summary: Actualizar rol de credencial
 *     tags: [Auth]
 *     description: Endpoint interno. Solo llamado por MS-02 cuando el rol de un usuario cambia.
 *     parameters:
 *       - in: header
 *         name: x-api-key
 *         required: true
 *         schema:
 *           type: string
 *         description: API key interna compartida entre microservicios
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID de la credencial
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 example: moderador
 *                 enum: [ciudadano, veterinaria, municipalidad, moderador, administrador, superadmin]
 *     responses:
 *       200:
 *         description: Rol actualizado correctamente
 *       404:
 *         description: Credencial no encontrada
 */
/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Solicitar código OTP para recuperar contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: test@sanos.cl
 *     responses:
 *       200:
 *         description: Respuesta genérica independiente de si el correo existe (medida de seguridad)
 */
router.post('/forgot-password', AuthController.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   patch:
 *     summary: Verificar OTP y cambiar contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code, newPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 example: test@sanos.cl
 *               code:
 *                 type: string
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 example: "nuevapass123"
 *     responses:
 *       200:
 *         description: Contraseña actualizada correctamente
 *       400:
 *         description: Código inválido o expirado
 */
router.patch('/reset-password', AuthController.resetPassword);

/**
 * @swagger
 * /api/auth/change-password:
 *   patch:
 *     summary: Cambiar contraseña del usuario autenticado
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 example: "nueva123"
 *     responses:
 *       200:
 *         description: Contraseña actualizada correctamente
 *       400:
 *         description: La contraseña actual es incorrecta o la nueva tiene menos de 6 caracteres
 *       401:
 *         description: Token requerido
 */
router.patch('/change-password', verifyToken, AuthController.changePassword);

router.patch('/credentials/:id/role', internalAuth, AuthController.updateRole);

/**
 * @swagger
 * /api/auth/credentials/{id}/deactivate:
 *   patch:
 *     summary: Desactivar credencial (interno)
 *     tags: [Auth]
 *     description: Endpoint interno. Solo llamado por MS-02 al desactivar una cuenta.
 *     parameters:
 *       - in: header
 *         name: x-api-key
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Credencial desactivada correctamente
 *       404:
 *         description: Credencial no encontrada
 */
router.patch('/credentials/:id/deactivate', internalAuth, AuthController.deactivateCredential);

/**
 * @swagger
 * /api/auth/credentials/{id}:
 *   delete:
 *     summary: Eliminar credencial (interno — rollback)
 *     tags: [Auth]
 *     description: Endpoint interno. Solo llamado por MS-02 para hacer rollback cuando el registro de usuario falla tras crear la credencial.
 *     parameters:
 *       - in: header
 *         name: x-api-key
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Credencial eliminada correctamente
 */
router.delete('/credentials/:id', internalAuth, AuthController.deleteCredential);

export default router;