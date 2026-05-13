
# MS-Auth — Sanos y Salvos

Microservicio de autenticación de la plataforma **Sanos y Salvos**. Gestiona el ciclo completo de identidad: registro de credenciales, inicio de sesión con emisión de tokens JWT, renovación automática de sesión mediante Refresh Token Rotation, cierre de sesión con invalidación inmediata, recuperación de contraseña vía OTP por correo electrónico y cambio de contraseña autenticado.

---

## Tecnologías

| Herramienta | Uso |
|---|---|
| Node.js 18+ | Entorno de ejecución |
| Express 4 | Servidor HTTP |
| TypeScript 5 | Tipado estático |
| PostgreSQL 16+ | Persistencia de credenciales, tokens y OTPs |
| TypeORM 0.3 | ORM y sincronización de esquema |
| jsonwebtoken | Emisión y verificación de Access Tokens (JWT HS256) |
| bcrypt | Hashing de contraseñas (salt 10) |
| uuid | Generación de Refresh Tokens |
| Nodemailer | Envío de correos OTP vía Gmail SMTP |
| Swagger / OpenAPI 3.0 | Documentación interactiva de endpoints |

---

## Requisitos previos

- Node.js 18+
- PostgreSQL 16+
- Cuenta de Gmail con [App Password](https://myaccount.google.com/apppasswords) habilitada

---

## Instalación

```bash
git clone <url-del-repositorio>
cd ms-auth
npm install
```

---

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
PORT=3001

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_password
DB_NAME=ms_auth

# JWT — solo el secret; duraciones definidas en código (15 min access, 7 días refresh)
JWT_SECRET=tu_secreto_super_seguro_minimo_64_caracteres

# Comunicación interna entre microservicios
INTERNAL_API_KEY=clave_compartida_con_ms_users

# Gmail para envío de OTP
GMAIL_USER=tu_cuenta@gmail.com
GMAIL_APP_PASSWORD=xxxx_xxxx_xxxx_xxxx

NODE_ENV=development
```

> Genera `INTERNAL_API_KEY` con: `openssl rand -hex 32`

---

## Base de datos

```bash
psql -U postgres
CREATE DATABASE ms_auth;
\q
```

TypeORM con `synchronize: true` crea y actualiza las tablas automáticamente al iniciar.

---

## Levantar el servidor

```bash
# Desarrollo (hot reload)
npm run dev

# Producción
npm run build
npm start
```

Salida esperada:
```
✅ Conexión a PostgreSQL establecida
🚀 MS-Auth corriendo en http://localhost:3001
```

---

## Documentación Swagger

```
http://localhost:3001/api/docs
```

---

## Endpoints

### Públicos

| Método | Ruta | RF | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/login` | RF-01 | Inicio de sesión — emite Access Token y Refresh Token |
| `POST` | `/api/auth/refresh` | RF-02 | Renueva el Access Token usando el Refresh Token (con rotación) |
| `POST` | `/api/auth/logout` | RF-04 | Cierra sesión e invalida ambos tokens |
| `POST` | `/api/auth/forgot-password` | RF-03 | Solicita código OTP de recuperación al correo |
| `PATCH` | `/api/auth/reset-password` | RF-03 | Verifica OTP y actualiza la contraseña |

### Autenticados (Bearer Token)

| Método | Ruta | Descripción |
|---|---|---|
| `PATCH` | `/api/auth/change-password` | Cambia la contraseña del usuario autenticado |

### Internos (header `x-api-key` — solo MS-Users)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/register` | Registra credenciales al crear un nuevo usuario |
| `PATCH` | `/api/auth/credentials/:id/role` | Actualiza el rol en la credencial al cambiar rol |
| `PATCH` | `/api/auth/credentials/:id/deactivate` | Desactiva credencial al desactivar una cuenta |
| `DELETE` | `/api/auth/credentials/:id` | Elimina credencial (rollback si falla el registro en MS-Users) |

---

## Estrategia de tokens

### Access Token
- Tipo: JWT firmado con `HS256`
- Duración: **15 minutos** (constante en código — no configurable por `.env`)
- Payload: `{ id, email, role }`
- En cada request protegido se verifica la firma y se consulta `revoked_tokens` para detectar logout previo

### Refresh Token
- Tipo: UUID v4 (no JWT)
- Duración: **7 días**
- Almacenado en tabla `refresh_tokens` con su `expires_at`
- **Rotación en cada uso:** al renovar, el token anterior se elimina y se emite uno nuevo
- Límite de **5 sesiones simultáneas** por usuario — la más antigua se elimina automáticamente

### Recuperación de contraseña (OTP)
- Código numérico de **6 dígitos** generado aleatoriamente
- Válido por **10 minutos**
- Se elimina de la base de datos al ser usado
- `forgot-password` responde siempre el mismo mensaje sin revelar si el correo existe (previene enumeración)

---

## Modelo de datos

### `credentials`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `email` | string único | Correo del usuario |
| `password_hash` | string | Hash bcrypt |
| `role` | enum | `ciudadano` · `veterinaria` · `municipalidad` · `moderador` · `administrador` · `superadmin` |
| `is_active` | boolean | Estado de la credencial |

### `refresh_tokens`

| Campo | Tipo | Descripción |
|---|---|---|
| `token` | UUID | Valor del Refresh Token |
| `credential_id` | UUID | Referencia a la credencial |
| `expires_at` | timestamptz | Expiración (7 días desde emisión) |
| `created_at` | timestamptz | Fecha de creación |

### `revoked_tokens`

| Campo | Tipo | Descripción |
|---|---|---|
| `token` | string | Access Token revocado en logout |
| `expires_at` | timestamptz | Expiración original del JWT |

### `password_reset_otps`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `email` | string | Correo destino |
| `code` | string | Código OTP de 6 dígitos |
| `expires_at` | timestamptz | Expiración (10 minutos) |
| `used` | boolean | Si ya fue utilizado |

---

## Ejemplos de uso

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{ "email": "usuario@sanos.cl", "password": "123456" }
```
```json
{ "ok": true, "data": { "accessToken": "eyJ...", "refreshToken": "uuid" } }
```

### Renovar sesión
```bash
POST /api/auth/refresh
Content-Type: application/json

{ "refreshToken": "uuid-anterior" }
```
```json
{ "ok": true, "data": { "accessToken": "eyJ...nuevo" } }
```

### Cerrar sesión
```bash
POST /api/auth/logout
Authorization: Bearer eyJ...
Content-Type: application/json

{ "refreshToken": "uuid" }
```

### Recuperar contraseña — Paso 1 (solicitar OTP)
```bash
POST /api/auth/forgot-password
Content-Type: application/json

{ "email": "usuario@sanos.cl" }
```

### Recuperar contraseña — Paso 2 (verificar OTP)
```bash
PATCH /api/auth/reset-password
Content-Type: application/json

{ "email": "usuario@sanos.cl", "code": "482913", "newPassword": "nueva123" }
```

### Cambiar contraseña (autenticado)
```bash
PATCH /api/auth/change-password
Authorization: Bearer eyJ...
Content-Type: application/json

{ "currentPassword": "123456", "newPassword": "nueva123" }
```

---

## Estructura del proyecto

```
ms-auth/
├── src/
│   ├── config/
│   │   ├── db.ts                   # Conexión PostgreSQL + TypeORM
│   │   └── swagger.ts              # Configuración OpenAPI 3.0
│   ├── controllers/
│   │   └── auth.controller.ts      # Handlers HTTP
│   ├── middlewares/
│   │   ├── errorHandler.ts         # Manejo global de errores
│   │   ├── internalAuth.ts         # Validación x-api-key (comunicación inter-servicios)
│   │   ├── notFound.ts             # Ruta no encontrada
│   │   └── verifyToken.ts          # Verificación JWT + consulta revoked_tokens
│   ├── models/
│   │   ├── Credential.ts           # Entidad de credenciales
│   │   ├── PasswordResetOtp.ts     # Entidad de códigos OTP
│   │   ├── RefreshToken.ts         # Refresh tokens activos
│   │   └── RevokedToken.ts         # Access tokens revocados
│   ├── routes/
│   │   └── auth.routes.ts          # Rutas + documentación Swagger inline
│   ├── services/
│   │   └── auth.service.ts         # Lógica de negocio
│   ├── utils/
│   │   ├── mailer.ts               # Envío de OTP por Gmail (Nodemailer)
│   │   └── response.ts             # Helpers de respuesta HTTP estandarizada
│   ├── app.ts                      # Configuración Express y middlewares
│   └── server.ts                   # Punto de entrada y conexión a BD
├── .env
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

---

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor en modo desarrollo con hot reload |
| `npm run build` | Compila TypeScript a JavaScript en `/dist` |
| `npm start` | Ejecuta la versión compilada |
| `docker compose up --build` | Levanta el servicio con PostgreSQL en Docker |
| `docker compose down` | Detiene los contenedores |
| `docker compose down -v` | Detiene y elimina los volúmenes de datos |

---

## Decisiones técnicas

| Decisión | Motivo |
|---|---|
| **Access Token de 15 min** | Minimiza el tiempo de exposición ante un token comprometido |
| **Refresh Token Rotation** | Cada renovación invalida el token anterior; detecta uso de tokens robados |
| **Duraciones en código, no en `.env`** | Evita configuraciones erróneas que extiendan los tiempos a valores inseguros |
| **OTP de 6 dígitos con 10 min de vida** | Balance entre usabilidad y seguridad; se elimina tras el uso |
| **Respuesta genérica en forgot-password** | No revela si un correo está registrado (previene enumeración de usuarios) |
| **Revocación en PostgreSQL** | Invalidación inmediata del Access Token en logout sin dependencia de caché externa |
| **bcrypt salt 10** | Balance entre seguridad y rendimiento adecuado para el contexto |
| **UUID como identificador** | Previene enumeración maliciosa de recursos (IDOR) |
| **x-api-key para endpoints internos** | Los endpoints de gestión de credenciales solo son accesibles entre microservicios |
| **Rol determinado por MS-Users** | MS-Auth no asigna roles; los recibe de MS-Users y es notificado cuando cambian |
