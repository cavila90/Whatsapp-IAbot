# Agente local de WhatsApp

Agente local que conecta un número real de WhatsApp Web mediante Baileys, responde con la API de OpenAI y ofrece un dashboard para revisar conversaciones y atender chats manualmente. La base de datos SQLite y la sesión de WhatsApp se guardan en el equipo donde corre la aplicación.

## Requisitos

- Node.js 22 o 24.
- Una clave de API de OpenAI con facturación habilitada.
- Un teléfono con WhatsApp para vincular el dispositivo.

## Configuración local

1. Copia `.env.example` a `.env.local` y configura `OPENAI_API_KEY` con una clave creada en la plataforma de OpenAI.
2. Puedes cambiar `OPENAI_MODEL`; el valor inicial es `gpt-5.6-luna`, un modelo de menor costo disponible en la API de OpenAI. La facturación y el acceso dependen de tu proyecto de API.
3. Instala dependencias con `npm install`.
4. En una terminal ejecuta `npm run start:bot`.
5. En otra ejecuta `npm run dev` y abre [http://localhost:3000](http://localhost:3000).
6. Escanea el QR que aparece en el dashboard desde WhatsApp → Dispositivos vinculados. El bot también imprime un QR ASCII en la terminal como ayuda de diagnóstico.

La sesión persiste en `./auth/` y los mensajes en `./data/messages.db`. Al reiniciar el bot se reutiliza la sesión mientras WhatsApp la mantenga válida. Para ejecutar la web compilada junto con el bot usa `npm run build` y después `npm run start:all`.

## Personalizar las respuestas

Edita `src/lib/system-prompt.ts` para adaptar el tono, las instrucciones y la información del negocio. Reinicia el proceso del bot después de cambiarlo. Configura el modelo en `OPENAI_MODEL`. Consulta los precios y límites vigentes en la documentación oficial de OpenAI.

## Uso del dashboard

- Selecciona una conversación para leer el historial; la lista y los mensajes se actualizan cada dos segundos.
- En modo IA el agente genera y envía respuestas automáticamente.
- En modo Humano el agente deja de responder y habilita el compositor del dashboard. Los mensajes se envían por Baileys.
- Puedes borrar una conversación desde su panel o desconectar el número desde el encabezado. Desconectar elimina la sesión local y requiere escanear un nuevo QR.

## Despliegue en EasyPanel o Railway

El repositorio incluye `Procfile`, `nixpacks.toml` y `.nvmrc`. Configura las variables de entorno y monta volúmenes persistentes en `/app/data` y `/app/auth`; sin ellos se perderán las conversaciones y la sesión deberá vincularse otra vez después de cada despliegue.

**Bloqueante para producción pública:** el dashboard no tiene autenticación. Antes de exponerlo a internet, protege el acceso con autenticación básica en el proxy (EasyPanel, Caddy o Nginx) o Cloudflare Access. Sin esa protección, cualquier persona con la URL puede leer conversaciones y enviar mensajes en nombre del dueño.

## Diagnóstico

- **Código 405:** el cliente intenta obtener la versión actual de Baileys al iniciar. Comprueba la conexión del servidor y reinicia el bot.
- **Código 440 repetido:** se usa `Browsers.macOS("Desktop")` y se aplica una espera de reconexión de 15 segundos. En el teléfono, abre Configuración → Dispositivos vinculados y elimina dispositivos viejos de pruebas. Si continúa, espera un tiempo o prueba desde otra IP.
- **Código 515:** suele formar parte del proceso de emparejamiento; deja que Baileys reconecte.
- **Error 429 de OpenAI:** se alcanzó un límite de solicitudes o cuota. Revisa el uso y la facturación del proyecto de API.
- **No aparece el QR:** confirma que `npm run start:bot` sigue activo; el dashboard detecta el estado del bot mediante polling.
- **Procesos Node antiguos en Windows:** si quedan procesos huérfanos, localízalos con `tasklist | findstr node` y termina los PID correspondientes con `taskkill /PID <PID> /F`.

## Mejoras pendientes

- Enviar imágenes de productos.
- Añadir function calling con herramientas de OpenAI.
- Cambiar automáticamente a modo Humano al detectar una frase acordada.
- Sustituir polling por WebSocket si se requiere actualización instantánea.
- Incorporar autenticación en la aplicación si no se protege con el proxy.
