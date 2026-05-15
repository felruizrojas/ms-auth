# MS-Auth — Sanos y Salvos

Microservicio de autenticación de la plataforma **Sanos y Salvos**. Gestiona credenciales de acceso, sesiones con Access Token y Refresh Token, recuperación de contraseña por OTP, caché de perfil en Redis y sincronización de usuarios mediante eventos de cola.

---

## Tecnologías

| Herramienta | Uso |
|---|---|
| Node.js 20 | Entorno de ejecución |
| Express 4 | Servidor HTTP |
| TypeScript 5 | Tipado estático |
| PostgreSQL 16 | Persistencia de credenciales y tokens |
| TypeORM 0.3 | ORM y sincronización de esquema |
| Redis + Bull | Caché de perfil y cola de eventos desde ms-users |
| ioredis | Cliente Redis para caché KV |
| jsonwebtoken | Generación y verificación de Access Tokens JWT |
| bcrypt | Hash de contraseñas |
| nodemailer | Envío de correos OTP vía Gmail |
| Swagger / OpenAPI 3.0 | Documentación interactiva de endpoints |
| Docker | Contenerización del servicio |

---

# Arquitectura

## Arquetipo

### Arquetipo Maven

- La totalidad del proyecto ms-auth.

- Microservicio construido con Java + Spring Boot + Maven que expone una API REST con autenticación JWT y gestión de credenciales.

- Aisla la autenticación en su propio proceso y base de datos, permitiendo desplegarlo, escalarlo y mantenerlo independientemente del resto de microservicios.

---

## Patrón de Arquitectura

### Arquitectura en Capas (Layered Architecture)

- src/routes/ → src/controllers/ → src/services/ → src/models/

- Cada capa tiene una responsabilidad única y solo se comunica con la capa inmediatamente inferior. Las rutas reciben la petición HTTP y delegan al controlador. El controlador valida y delega al servicio. El servicio contiene la lógica de negocio y accede a los modelos de TypeORM.

- Facilita el mantenimiento y la lectura del código. Un cambio en la base de datos no afecta al controlador; un cambio en la ruta no afecta al servicio. Las responsabilidades están claramente separadas.

### Arquitectura Orientada a Eventos — Consumidor (Event-Driven Architecture)

- src/queue/consumers.ts y src/config/redis.ts

- ms-auth consume eventos (`user.registered`, `user.updated`, `user.deleted`) desde la cola Bull sobre Redis, publicados por ms-users. Al recibir `user.registered`, crea la credencial en su propia base de datos y almacena el perfil en caché Redis. Al recibir `user.updated`, sincroniza los datos cacheados. Al recibir `user.deleted`, elimina la caché del usuario.

- ms-auth no necesita llamar a ms-users ni estar acoplado a su ciclo de vida. Procesa los eventos a medida que llegan, lo que permite sincronización asíncrona y tolerante a fallos.

## Patrón de Diseño:

### Repository (via TypeORM)

- src/factories/CredentialFactory.ts y src/services/auth.service.ts, mediante AppDataSource.getRepository(Entidad).

- TypeORM expone un Repository<T> por entidad que encapsula todas las operaciones sobre la base de datos (find, save, delete, update). El código de negocio nunca escribe SQL directamente; interactúa con objetos tipados a través del repositorio.

- Desacopla la lógica de negocio del motor de base de datos. Si en el futuro se cambiara de PostgreSQL a otro motor, solo se modifica la configuración de TypeORM, no la lógica del servicio.

### Factory Method

- src/factories/CredentialFactory.ts, métodos estáticos crearCredencial(), crearRefreshToken() y crearOtp().

- CredentialFactory centraliza la construcción de las tres entidades clave: crea credenciales con email normalizado y contraseña hasheada, genera refresh tokens con UUID y expiración de 7 días, y genera códigos OTP de 6 dígitos con expiración de 10 minutos. Cada método encapsula la lógica de construcción de su entidad respectiva.

- Evita duplicar la lógica de creación en múltiples puntos del servicio. Cualquier cambio en cómo se construye una credencial, un token o un OTP se hace en un único lugar.

### Singleton

- src/config/db.ts (AppDataSource), src/config/redis.ts (userEventsQueue y redisClient), src/utils/mailer.ts (transporter).

- Los tres módulos exportan instancias únicas. Node.js cachea los módulos en require, por lo que cualquier archivo que importe AppDataSource, userEventsQueue, redisClient o transporter obtiene siempre el mismo objeto.

- Una única conexión a la base de datos, una única cola Bull, un único cliente Redis KV y un único transporter de correo evitan abrir múltiples conexiones simultáneas innecesarias, lo que podría agotar los recursos del servidor.

---

## Requisitos previos

- Node.js 20+
- PostgreSQL 16+
- Redis
- Cuenta Gmail con contraseña de aplicación habilitada (para envío de OTP)

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

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_password
DB_NAME=ms_auth

REDIS_BROKER_URL=redis://localhost:6379
REDIS_CACHE_URL=redis://localhost:6379

JWT_SECRET=tu_secreto_minimo_64_caracteres
INTERNAL_API_KEY=clave_compartida_con_ms_users

GMAIL_USER=tu_correo@gmail.com
GMAIL_APP_PASSWORD=tu_app_password_gmail

NODE_ENV=development
```

> `JWT_SECRET` e `INTERNAL_API_KEY` deben ser idénticos a los configurados en ms-users.  
> Para obtener la contraseña de aplicación Gmail: Cuenta Google → Seguridad → Verificación en dos pasos → Contraseñas de aplicación.

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
[consumer] Consumers de eventos de usuario iniciados
🚀 MS-Auth corriendo en http://localhost:3001
```

---

## Levantar con Docker

```bash
docker compose up -d
```

No requiere tener Node.js, PostgreSQL ni Redis instalados. La imagen se descarga automáticamente desde Docker Hub (`felruiz/ms-auth:latest`).

```bash
# Detener
docker compose down

# Detener y eliminar datos
docker compose down -v
```

---

## Documentación Swagger

```
http://localhost:3001/api/docs
```

---

## Endpoints

### Autenticación pública

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | Inicio de sesión, retorna accessToken y refreshToken |
| `POST` | `/api/auth/refresh` | Renueva el accessToken usando el refreshToken |
| `POST` | `/api/auth/logout` | Cierra la sesión revocando ambos tokens |
| `POST` | `/api/auth/forgot-password` | Envía código OTP al correo para recuperar contraseña |
| `PATCH` | `/api/auth/reset-password` | Verifica OTP y actualiza la contraseña |

### Autenticación requerida (Bearer Token)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/auth/me` | Obtiene el perfil del usuario autenticado (desde caché Redis) |
| `PATCH` | `/api/auth/change-password` | Cambia la contraseña del usuario autenticado |

### Endpoints internos (x-api-key)

Llamados exclusivamente por ms-users. Requieren el header `x-api-key`.

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/register` | Crea credenciales al registrar un usuario |
| `PATCH` | `/api/auth/credentials/:id/role` | Actualiza el rol de una credencial |
| `PATCH` | `/api/auth/credentials/:id/deactivate` | Desactiva una credencial |
| `DELETE` | `/api/auth/credentials/:id` | Elimina una credencial (rollback de registro) |
| `POST` | `/api/auth/interno/por-email` | Obtiene el credential_id por email |

---

## Modelo de datos

### Tabla `credentials`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único de la credencial |
| `email` | string único | Correo del usuario |
| `password_hash` | string | Contraseña hasheada con bcrypt |
| `role` | string | Rol del usuario (ciudadano, veterinaria, etc.) |
| `permissions` | string[] | Permisos replicados desde ms-users |
| `cached_data` | jsonb | Datos de perfil cacheados (nombre, avatar, tipo) |
| `status` | string | active / inactive (sincronizado desde ms-users) |
| `is_active` | boolean | Estado de la cuenta |
| `created_at` | timestamp | Fecha de creación |
| `updated_at` | timestamp | Última actualización |

### Tabla `refresh_tokens`

| Campo | Tipo | Descripción |
|---|---|---|
| `token` | UUID (PK) | Token de renovación |
| `credential_id` | UUID | Referencia a la credencial |
| `expires_at` | timestamptz | Expiración a 7 días |
| `created_at` | timestamp | Fecha de creación |

### Tabla `revoked_tokens`

| Campo | Tipo | Descripción |
|---|---|---|
| `token` | text (PK) | Access Token revocado |
| `expires_at` | timestamptz | Fecha de expiración original del token |
| `created_at` | timestamp | Fecha de revocación |

### Tabla `password_reset_otps`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador |
| `email` | string | Correo al que se envió el OTP |
| `code` | string | Código de 6 dígitos |
| `expires_at` | timestamptz | Expiración a 10 minutos |
| `used` | boolean | Si el código ya fue utilizado |
| `created_at` | timestamp | Fecha de creación |

---

## Estructura del proyecto

```
ms-auth/
├── src/
│   ├── config/
│   │   ├── db.ts                   # Conexión PostgreSQL + TypeORM (Singleton)
│   │   ├── redis.ts                # Cola Bull + cliente Redis KV (Singleton)
│   │   └── swagger.ts              # Configuración OpenAPI 3.0
│   ├── controllers/
│   │   └── auth.controller.ts      # Handlers HTTP
│   ├── factories/
│   │   └── CredentialFactory.ts    # Factory Method — crea credenciales, tokens y OTPs
│   ├── middlewares/
│   │   ├── errorHandler.ts         # Manejo global de errores
│   │   ├── internalAuth.ts         # Verificación x-api-key para endpoints internos
│   │   ├── notFound.ts             # Ruta no encontrada
│   │   └── verifyToken.ts          # Verificación JWT
│   ├── models/
│   │   ├── Credential.ts           # Entidad credentials
│   │   ├── PasswordResetOtp.ts     # Entidad password_reset_otps
│   │   ├── RefreshToken.ts         # Entidad refresh_tokens
│   │   └── RevokedToken.ts         # Entidad revoked_tokens
│   ├── queue/
│   │   └── consumers.ts            # Consumidores de eventos desde ms-users
│   ├── routes/
│   │   └── auth.routes.ts          # Rutas + documentación Swagger inline
│   ├── services/
│   │   ├── auth.service.ts         # Lógica de negocio de autenticación
│   │   ├── types.ts                # Interfaces de eventos compartidos
│   │   └── user-cache.service.ts   # Sincronización de caché Redis
│   ├── utils/
│   │   ├── mailer.ts               # Transporter nodemailer (Singleton)
│   │   └── response.ts             # Helpers de respuesta HTTP estandarizada
│   ├── app.ts                      # Configuración Express y middlewares
│   └── server.ts                   # Punto de entrada, BD y consumers
├── .dockerignore
├── .gitattributes
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
| `docker compose up -d` | Levanta ms-auth, su PostgreSQL y su Redis propio en Docker |
| `docker compose down` | Detiene los contenedores |
| `docker compose down -v` | Detiene y elimina los volúmenes de datos |

---

## Puesta en marcha sin Docker

### macOS

#### 1. Instalar dependencias

```bash
# Homebrew (si no lo tienes)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js 20
brew install node@20

# PostgreSQL 16
brew install postgresql@16
brew services start postgresql@16

# Redis
brew install redis
brew services start redis
```

#### 2. Crear bases de datos

```bash
psql postgres -c "CREATE DATABASE ms_auth;"
psql postgres -c "CREATE DATABASE ms_users;"
```

#### 3. Configurar variables de entorno

En la carpeta de cada microservicio crea el archivo `.env` con los valores indicados en la sección **Variables de entorno** de cada README.

Para el frontend, crea `frontend-sanos-salvos/.env` con:

```env
VITE_MS_AUTH_URL=http://localhost:3001
VITE_MS_USERS_URL=http://localhost:3002
```

#### 4. Levantar los microservicios y el frontend

> **Orden importante:** ms-users primero, luego ms-auth, luego el frontend.

```bash
# Terminal 1 — ms-users (debe estar corriendo antes de ms-auth)
cd ms-users
npm install
npm run dev
```

```bash
# Terminal 2 — ms-auth
cd ms-auth
npm install
npm run dev
```

```bash
# Terminal 3 — frontend
cd frontend-sanos-salvos
npm install
npm run dev
```

El frontend queda disponible en `http://localhost:5173`.

#### 5. Crear el superadmin

> Al registrar un usuario, ms-auth crea su credencial y la guarda en **cuatro lugares**: ms-users PostgreSQL (perfil), ms-auth PostgreSQL (credencial + `cached_data`), y caché Redis de ms-auth. Si solo actualizas el rol en PostgreSQL pero no en Redis, el perfil seguirá mostrando "ciudadano" hasta que Redis expire (30 días). Ejecuta los cinco pasos siguientes **en orden exacto**.

Con los tres servicios corriendo, abre una nueva terminal.

**Paso 1 — Registrar el usuario:**

```bash
curl -X POST http://localhost:3002/api/users/register/ciudadano \
  -F "email=fe.ruizr@duocuc.cl" \
  -F "password=123456q" \
  -F "telefono=912345678" \
  -F "region=08" \
  -F "comuna=Concepción" \
  -F "primer_nombre=Felipe" \
  -F "apellido_paterno=Ruiz" \
  -F "run=11.111.111-1" \
  -F "direccion=Av. Principal 123"
```

La respuesta incluirá `"credential_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`. **Copia ese UUID** — lo necesitarás en el Paso 5.

**Paso 2 — Actualizar rol en ms-users PostgreSQL:**

```bash
psql -U postgres -d ms_users -c "UPDATE users SET rol='superadmin' WHERE email='fe.ruizr@duocuc.cl';"
```

Debe responder `UPDATE 1`.

**Paso 3 — Actualizar rol en ms-auth PostgreSQL:**

```bash
psql -U postgres -d ms_auth -c "UPDATE credentials SET role='superadmin' WHERE email='fe.ruizr@duocuc.cl';"
```

Debe responder `UPDATE 1`.

**Paso 4 — Actualizar `cached_data` en ms-auth PostgreSQL** (perfil en caché persistente):

```bash
psql -U postgres -d ms_auth -c "UPDATE credentials SET cached_data = cached_data || jsonb_build_object('role', 'superadmin') WHERE email='fe.ruizr@duocuc.cl';"
```

Debe responder `UPDATE 1`.

**Paso 5 — Eliminar la entrada de caché Redis** (reemplaza `CREDENTIAL_ID` por el UUID del Paso 1):

```bash
redis-cli DEL "user:CREDENTIAL_ID"
```

Debe responder `(integer) 1`. Si responde `(integer) 0`, no había caché activa — también es correcto, el sistema usará directamente el `cached_data` actualizado. Si no guardaste el `credential_id`, consúltalo así:

```bash
psql -U postgres -d ms_auth -c "SELECT id FROM credentials WHERE email='fe.ruizr@duocuc.cl';"
```

Ya puedes iniciar sesión en `http://localhost:5173` con `fe.ruizr@duocuc.cl` / `123456q`.

---

### Windows

#### 1. Instalar dependencias

Abre **PowerShell como Administrador** y ejecuta:

```powershell
# Node.js 20
winget install OpenJS.NodeJS.LTS

# PostgreSQL 16
winget install PostgreSQL.PostgreSQL.16
```

> Después de instalar PostgreSQL, cierra y vuelve a abrir PowerShell para que `psql` quede disponible. Si sigue sin reconocerse, agrega `C:\Program Files\PostgreSQL\16\bin` al PATH del sistema.

Para **Redis** en Windows hay dos opciones — elige una:

**Opción A (recomendada) — Memurai** (compatible 100% con Redis, instalador .exe para Windows):
Descarga desde [memurai.com](https://www.memurai.com) e instala. Queda corriendo como servicio de Windows automáticamente.

**Opción B — Solo para Redis, usar Docker:**
```powershell
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

#### 2. Crear bases de datos

```powershell
psql -U postgres -c "CREATE DATABASE ms_auth;"
psql -U postgres -c "CREATE DATABASE ms_users;"
```

#### 3. Configurar variables de entorno

En la carpeta de cada microservicio crea el archivo `.env` con los valores indicados en la sección **Variables de entorno** de cada README.

Para el frontend, crea `frontend-sanos-salvos\.env` con:

```env
VITE_MS_AUTH_URL=http://localhost:3001
VITE_MS_USERS_URL=http://localhost:3002
```

#### 4. Levantar los microservicios y el frontend

> **Orden importante:** ms-users primero, luego ms-auth, luego el frontend.

```powershell
# Terminal 1 — ms-users (debe estar corriendo antes de ms-auth)
cd ms-users
npm install
npm run dev
```

```powershell
# Terminal 2 — ms-auth
cd ms-auth
npm install
npm run dev
```

```powershell
# Terminal 3 — frontend
cd frontend-sanos-salvos
npm install
npm run dev
```

El frontend queda disponible en `http://localhost:5173`.

#### 5. Crear el superadmin

> Al registrar un usuario, ms-auth crea su credencial y la guarda en **cuatro lugares**: ms-users PostgreSQL (perfil), ms-auth PostgreSQL (credencial + `cached_data`), y caché Redis de ms-auth. Si solo actualizas el rol en PostgreSQL pero no en Redis, el perfil seguirá mostrando "ciudadano" hasta que Redis expire (30 días). Ejecuta los cinco pasos siguientes **en orden exacto**.

Con los tres servicios corriendo, abre una nueva terminal.

**Paso 1 — Registrar el usuario** (`curl.exe` es el curl real en PowerShell):

```powershell
curl.exe -X POST http://localhost:3002/api/users/register/ciudadano -F "email=fe.ruizr@duocuc.cl" -F "password=123456q" -F "telefono=912345678" -F "region=08" -F "comuna=Concepción" -F "primer_nombre=Felipe" -F "apellido_paterno=Ruiz" -F "run=11.111.111-1" -F "direccion=Av. Principal 123"
```

La respuesta incluirá `"credential_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`. **Copia ese UUID** — lo necesitarás en el Paso 5.

**Paso 2 — Actualizar rol en ms-users PostgreSQL:**

```powershell
psql -U postgres -d ms_users -c "UPDATE users SET rol='superadmin' WHERE email='fe.ruizr@duocuc.cl';"
```

Debe responder `UPDATE 1`.

**Paso 3 — Actualizar rol en ms-auth PostgreSQL:**

```powershell
psql -U postgres -d ms_auth -c "UPDATE credentials SET role='superadmin' WHERE email='fe.ruizr@duocuc.cl';"
```

Debe responder `UPDATE 1`.

**Paso 4 — Actualizar `cached_data` en ms-auth PostgreSQL** (perfil en caché persistente):

```powershell
psql -U postgres -d ms_auth -c "UPDATE credentials SET cached_data = cached_data || jsonb_build_object('role', 'superadmin') WHERE email='fe.ruizr@duocuc.cl';"
```

Debe responder `UPDATE 1`.

**Paso 5 — Eliminar la entrada de caché Redis** (reemplaza `CREDENTIAL_ID` por el UUID del Paso 1):

Si instalaste **Memurai**:
```powershell
redis-cli DEL "user:CREDENTIAL_ID"
```

Si usaste la **Opción B (Docker Redis)**:
```powershell
docker exec redis redis-cli DEL "user:CREDENTIAL_ID"
```

Debe responder `(integer) 1`. Si responde `(integer) 0`, no había caché activa — también es correcto, el sistema usará directamente el `cached_data` actualizado. Si no guardaste el `credential_id`, consúltalo así:

```powershell
psql -U postgres -d ms_auth -c "SELECT id FROM credentials WHERE email='fe.ruizr@duocuc.cl';"
```

Ya puedes iniciar sesión en `http://localhost:5173` con `fe.ruizr@duocuc.cl` / `123456q`.

---

## Puesta en marcha con Docker

> Requisito único: tener **Docker Desktop** instalado y corriendo. No se necesita Node.js, PostgreSQL ni Redis.
> - macOS: [docs.docker.com/desktop/install/mac-install](https://docs.docker.com/desktop/install/mac-install/)
> - Windows: [docs.docker.com/desktop/install/windows-install](https://docs.docker.com/desktop/install/windows-install/) — Docker Desktop activa WSL2 automáticamente durante la instalación

### macOS y Windows

#### 1. Levantar los microservicios

> **Orden obligatorio:** el broker PRIMERO — crea la red `broker_net` que ms-users y ms-auth necesitan para comunicarse.

```bash
# Paso 1 — broker (Redis standalone para la cola de eventos)
cd broker
docker compose up -d
```

Espera unos segundos a que el contenedor esté saludable, luego:

```bash
# Paso 2 — ms-users (levanta la app + PostgreSQL, se conecta al broker)
cd ms-users
docker compose up -d
```

```bash
# Paso 3 — ms-auth (levanta la app + PostgreSQL + Redis propio, se conecta al broker)
cd ms-auth
docker compose up -d
```

```bash
# Paso 4 — frontend
cd frontend-sanos-salvos
docker compose up -d
```

Los servicios quedan disponibles en:

| Servicio | URL |
|---|---|
| Frontend | http://localhost |
| ms-users | http://localhost:3002 |
| ms-auth | http://localhost:3001 |

#### 2. Crear el superadmin

> Los datos del usuario se almacenan en **cuatro lugares**: ms-users PostgreSQL, ms-auth PostgreSQL (credencial + `cached_data`), y caché Redis. Debes actualizar los cuatro para que el superadmin funcione correctamente. Los comandos `docker exec` son iguales en macOS y Windows.

Con los tres stacks corriendo, ejecuta los comandos **en orden exacto**:

**Paso 1 — Registrar el usuario:**

macOS:
```bash
curl -X POST http://localhost:3002/api/users/register/ciudadano \
  -F "email=fe.ruizr@duocuc.cl" \
  -F "password=123456q" \
  -F "telefono=912345678" \
  -F "region=08" \
  -F "comuna=Concepción" \
  -F "primer_nombre=Felipe" \
  -F "apellido_paterno=Ruiz" \
  -F "run=11.111.111-1" \
  -F "direccion=Av. Principal 123"
```

Windows (PowerShell):
```powershell
curl.exe -X POST http://localhost:3002/api/users/register/ciudadano -F "email=fe.ruizr@duocuc.cl" -F "password=123456q" -F "telefono=912345678" -F "region=08" -F "comuna=Concepción" -F "primer_nombre=Felipe" -F "apellido_paterno=Ruiz" -F "run=11.111.111-1" -F "direccion=Av. Principal 123"
```

La respuesta incluirá `"credential_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`. **Copia ese UUID** — lo necesitarás en el Paso 5.

**Paso 2 — Actualizar rol en ms-users PostgreSQL:**

```bash
docker exec ms-users-db psql -U postgres -d ms_users -c "UPDATE users SET rol='superadmin' WHERE email='fe.ruizr@duocuc.cl';"
```

Debe responder `UPDATE 1`.

**Paso 3 — Actualizar rol en ms-auth PostgreSQL:**

```bash
docker exec ms-auth-db psql -U postgres -d ms_auth -c "UPDATE credentials SET role='superadmin' WHERE email='fe.ruizr@duocuc.cl';"
```

Debe responder `UPDATE 1`.

**Paso 4 — Actualizar `cached_data` en ms-auth PostgreSQL** (perfil en caché persistente):

```bash
docker exec ms-auth-db psql -U postgres -d ms_auth -c "UPDATE credentials SET cached_data = cached_data || jsonb_build_object('role', 'superadmin') WHERE email='fe.ruizr@duocuc.cl';"
```

Debe responder `UPDATE 1`.

**Paso 5 — Eliminar la entrada de caché Redis** (reemplaza `CREDENTIAL_ID` por el UUID del Paso 1):

```bash
docker exec ms-auth-redis redis-cli DEL "user:CREDENTIAL_ID"
```

Debe responder `(integer) 1`. Si responde `(integer) 0`, no había caché activa — también es correcto, el sistema usará directamente el `cached_data` actualizado. Si no guardaste el `credential_id`, consúltalo así:

```bash
docker exec ms-auth-db psql -U postgres -d ms_auth -c "SELECT id FROM credentials WHERE email='fe.ruizr@duocuc.cl';"
```

Ya puedes iniciar sesión en `http://localhost` con `fe.ruizr@duocuc.cl` / `123456q`.
