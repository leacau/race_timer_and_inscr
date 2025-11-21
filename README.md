# Race Timer & Inscription Suite

Starter multi-tenant para gestionar eventos deportivos cronometrados (running, trail, ciclismo, triatlón, rally/etapas, motor y postas) con Next.js, Prisma y Tailwind.

## Características
- **Multi-tenant**: Organizaciones aisladas con roles (super admin, organizador, timer, staff, participante) y autenticación JWT.
- **Modelado listo para producción**: Eventos, carreras, etapas, categorías, equipos/postas, inscripciones, pagos, puntos de control, lecturas y resultados.
- **Cronometraje en vivo**: Endpoints para recepción de lecturas (`/api/timing/reads`) preparados para extender a WebSockets.
- **Rankings**: Cálculo de bruto/neto, splits, penalizaciones y ranking general/género/categoría.
- **Inscripciones públicas**: Formularios y endpoints públicos para crear/consultar inscripciones y registrar pagos.

## Stack
- Next.js 15 + TypeScript
- Tailwind CSS
- Prisma ORM + PostgreSQL
- JWT + bcrypt
- Vitest para pruebas de dominio

## Inicio rápido
1. **Configura variables**

   Crea `.env` con tu base de datos y secreto JWT:
   ```bash
   DATABASE_URL="postgresql://user:password@localhost:5432/race_timer"
   JWT_SECRET="super-secret"
   ```

2. **Dependencias**

   ```bash
   npm install
   ```

   La instalación ejecuta `prisma generate` (postinstall). Si usas un entorno sin scripts automáticos, corre `npm run db:generate` antes de `npm run build` para evitar errores de `@prisma/client`.

3. **Migraciones y seed**

   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```

4. **Desarrollo**

   ```bash
   npm run dev
   ```

5. **Pruebas**

   ```bash
   npm test
   ```

## Modelos (Prisma)
Revisa `prisma/schema.prisma` para la definición completa de:
- Organization, User (roles), Event, Race (disciplinas), Stage
- Category (edad/género/solistas/equipos), Team, Participant
- Registration (estado, dorsal, chip), Payment (webhooks), TimingPoint, TimeRead, Result
- Enums para estados (registro, pago, resultado), género y tipos de punto de control

## Endpoints clave
- **Auth**: `POST /api/auth/login` → token JWT.
- **Organizaciones**: `GET/POST /api/organizations`
- **Eventos**: `GET/POST /api/events`
- **Inscripciones públicas**: `GET/POST /api/registrations`
- **Pagos**: `GET/POST /api/payments` (preparado para webhooks de pasarela)
- **Cronometraje**: `POST /api/timing/reads` (lecturas de chip/manual)
- **Resultados**: `GET /api/results/:raceId`

Ejemplo de inscripción pública:
```bash
curl -X POST http://localhost:9002/api/registrations \
  -H 'Content-Type: application/json' \
  -d '{
    "raceId": "seed-race-10k",
    "participant": {
      "firstName": "Alex",
      "lastName": "Ruiz",
      "email": "alex@example.com",
      "birthDate": "1990-01-01",
      "gender": "MALE"
    }
  }'
```

Ejemplo de lectura de tiempo:
```bash
curl -X POST http://localhost:9002/api/timing/reads \
  -H 'Content-Type: application/json' \
  -d '{
    "registrationId": "<registration-id>",
    "timingPointCode": "TP-FINISH-10K",
    "recordedAt": "2025-02-10T10:50:00.000Z"
  }'
```

## Estructura de carpetas
- `src/domain`: reglas de negocio (categorías, resultados, penalizaciones).
- `src/lib`: utilidades (Prisma, auth, helpers de API).
- `src/app/api`: handlers HTTP (auth, organizaciones, eventos, inscripciones, pagos, timing, resultados).
- `src/components`: UI reusable y landing de demo.
- `prisma`: `schema.prisma` + `seed.ts` con datos de ejemplo.
- `tests`: pruebas unitarias de dominio con Vitest.

## Notas de extensión
- Habilita WebSockets (p.ej. `socket.io` o `ws`) para emitir lecturas y rankings en tiempo real.
- Integra Stripe/Mercado Pago agregando manejadores de webhook en `/api/payments`.
- Usa `TimingPoint.type` para validar splits y calcular resultados por etapa (rally o triatlón).
