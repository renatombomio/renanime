# Renanime's Gallery

Biblioteca personal de anime con una experiencia visual centrada en descubrir títulos, organizar lo que has visto y mantener tu lista pendiente. Renanime se está preparando para una nueva etapa con funciones sociales y una arquitectura de autenticación más segura.

> **Estado del proyecto:** Renanime está temporalmente en mantenimiento mientras se prepara la migración de autenticación de la versión 2.0. La migración aún no está activa en producción. No despliegues ni desactives el modo mantenimiento hasta completar las pruebas indicadas en la documentación de seguridad.

## Funcionalidades

- **Descubrir anime:** explorar recomendaciones, joyas escondidas, tendencias, temporada, próximos estrenos y títulos mejor valorados.
- **Colección personal:** organizar anime visto y mantener el estado de cada entrada.
- **Mi lista:** guardar anime pendiente de ver.
- **Favoritos y géneros:** explorar y organizar títulos con vistas adaptadas a móvil.
- **Fichas y franquicias:** consultar información de anime y títulos relacionados.
- **Interfaz bilingüe:** español e inglés.
- **Diseño mobile-first:** navegación y carruseles adaptados a pantallas pequeñas.

Las fuentes de datos de anime incluyen AniList y Jikan. Las cuotas y límites de las API externas deben respetarse; las consultas deben agruparse y evitar solicitudes innecesarias.

## Stack tecnológico

- [Astro](https://astro.build/) con renderizado SSR y adaptador de Vercel.
- React y TypeScript.
- Tailwind CSS 4.
- GSAP para animaciones.
- Supabase/PostgreSQL para datos y servicios backend.
- AniList API y Jikan API para datos de anime.
- pnpm como gestor de paquetes.
- Vitest para pruebas.

La migración a Supabase Auth está en preparación. La implementación actual todavía contiene autenticación heredada de Renanime; no se debe asumir que registro, login, recuperación por email o Google OAuth de Supabase están ya operativos.

## Requisitos

- Node.js \`>=22.12.0\`.
- pnpm compatible con el lockfile del repositorio.

## Desarrollo local

1. Clona el repositorio:

   \`\`\`bash
   git clone https://github.com/renatombomio/renanime.git
   cd renanime
   \`\`\`

2. Instala las dependencias:

   \`\`\`bash
   pnpm install --frozen-lockfile
   \`\`\`

3. Configura las variables de entorno locales en \`.env.local\`. Usa únicamente las credenciales del entorno al que vayas a conectarte y no subas secretos a Git.

   Las variables usadas por la configuración actual incluyen:

   - \`PUBLIC_SUPABASE_URL\`: URL del proyecto Supabase.
   - \`SUPABASE_SECRET_KEY\`: clave secreta solo de servidor. Nunca debe exponerse al navegador ni publicarse en el repositorio.

   Consulta la configuración del entorno de desarrollo antes de añadir otras variables. Durante la migración, el cliente SSR deberá utilizar la clave pública/publishable de Supabase; la clave secreta seguirá reservada para tareas confiables de servidor y nunca para una sesión de usuario.

4. Inicia el servidor de desarrollo:

   \`\`\`bash
   pnpm dev
   \`\`\`

   Astro suele servir el proyecto en \`http://localhost:4321\`.

## Comandos disponibles

| Comando | Descripción |
| --- | --- |
| \`pnpm dev\` | Inicia el servidor de desarrollo. |
| \`pnpm build\` | Construye el proyecto para producción. |
| \`pnpm preview\` | Previsualiza localmente la compilación. |
| \`pnpm test\` | Ejecuta las pruebas con Vitest. |
| \`pnpm test:watch\` | Ejecuta Vitest en modo interactivo. |
| \`pnpm astro -- --help\` | Muestra la ayuda de Astro. |

Antes de abrir o fusionar cambios, ejecuta al menos:

\`\`\`bash
pnpm install --frozen-lockfile
pnpm test
pnpm build
\`\`\`

Si cambias dependencias, actualiza \`pnpm-lock.yaml\` usando pnpm y confirma ambos archivos. No edites el lockfile manualmente.

## Estructura del proyecto

La estructura exacta evoluciona con el desarrollo. Las principales áreas son:

- \`src/pages/\`: páginas y endpoints API de Astro.
- \`src/components/\`: componentes reutilizables de interfaz.
- \`src/lib/\`: clientes y lógica compartida del backend.
- \`public/\`: imágenes, vídeos, audio y otros recursos estáticos.
- \`docs/security/\`: planificación de seguridad y migración de autenticación.

## Seguridad y autenticación

La migración completa a Supabase Auth se está preparando en la rama \`feature/supabase-auth-migration\` y la PR [#13](https://github.com/renatombomio/renanime/pull/13).

Documentos de referencia:

- [Plan de migración](docs/security/supabase-auth-migration-plan.md)
- [Propuesta de mapeo de identidades — solo revisión](docs/security/001_identity_mapping_review_only.sql)
- [Contrato de implementación y criterios de corte](docs/security/002-auth-implementation-contract.md)

Principios obligatorios:

- No vincular cuentas antiguas basándose únicamente en el nombre visible o en un email no verificado.
- Preservar los UUID antiguos y las entradas existentes de biblioteca.
- No aplicar la propuesta SQL de revisión sin una revisión explícita y un plan de respaldo.
- Mantener el modo mantenimiento hasta que autenticación, biblioteca, callbacks y recuperación pasen las pruebas.
- No exponer claves secretas ni credenciales en código cliente, logs o commits.
- No retirar las funciones de autenticación heredadas hasta verificar la migración y el procedimiento de rollback.

## Flujo de trabajo

- Trabaja en ramas de funcionalidad y abre una Pull Request hacia \`main\`.
- Mantén los cambios acotados y documenta los cambios de esquema o autenticación.
- No hagas cambios destructivos en producción como parte de una tarea de documentación.
- Comprueba los resultados de build y tests; no declares una validación si no se ha ejecutado.

## Estado de la migración

La migración a Supabase Auth todavía no está completada. La PR #13 contiene documentación y una propuesta de mapeo; no activa el nuevo sistema ni cambia datos de producción. El sitio debe permanecer en mantenimiento hasta que la implementación y las pruebas estén listas.

## Enlaces

- Repositorio: https://github.com/renatombomio/renanime
- Astro: https://docs.astro.build/
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase SSR: https://supabase.com/docs/guides/auth/server-side
