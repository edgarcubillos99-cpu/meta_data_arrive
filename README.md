🤖 Meta OmniChannel Ingestion Service – WhatsApp + IG + Messenger + NestJS

```plaintext
Sistema backend corporativo para ingesta omnicanal, con:

✅ Webhook centralizado para Meta API (WhatsApp, Messenger, Instagram)
✅ Normalización agnóstica de payloads dispares a formato único
✅ Preparación de contexto seguro para consumo por IA (LLM + MCP)
✅ Enrutamiento de eventos mediante RabbitMQ (telecom_exchange)
✅ Manejo eficiente de memoria mediante descargas por streams
✅ Escaneo de seguridad (ClamAV) contra malware en adjuntos vía TCP
✅ Validación estricta de MIME types (Magic Bytes)
✅ Almacenamiento local seguro sin dependencia de nubes externas
✅ Docker y Docker Compose listos para producción
```
---

# 📑 Índice

    🔎 Descripción General
    
    📁 Estructura del Proyecto
    
    🏗 Arquitectura del Sistema
    
    ⚙️ Configuración del Entorno
    
    ☁️ Configuración en Meta for Developers
    
    🐳 Ejecución con Docker
    
    🧩 Diseño del Sistema
    
    💾 Modelo de Datos (Payloads)
    
    ⚠️ Reglas de Enrutamiento (RabbitMQ)
    
    🛡️ Seguridad (MIME & ClamAV)
    
    🧪 Pruebas y Verificación
    
    🚨 Troubleshooting

---

# 🔎 Descripción General

Este microservicio actúa como la capa de entrada (Gateway) y orquestador de ingesta de datos para una empresa de telecomunicaciones. Su objetivo es centralizar los mensajes provenientes del ecosistema de Meta (WhatsApp, Instagram, Messenger), procesarlos y dejarlos listos en un bus de eventos.

El sistema es agnóstico al canal de origen: abstrae las diferencias de las APIs de Meta, descarga y asegura los archivos multimedia mediante escaneo antivirus aislado, y genera un payload estandarizado. El sistema no ejecuta procesamiento cognitivo de archivos; su función es entregar el evento enriquecido (con la URL local segura del archivo y su metadata) a los agentes de Inteligencia Artificial (LLM + MCP) para que estos decidan bajo demanda qué herramientas de transcripción o visión utilizar.

---

# 📁 Estructura del Proyecto

```plaintext
meta_data_arrive/
├── src/
│   ├── app.module.ts
│   ├── common/                 → DTOs y Tipos (NormalizedMessageDto)
│   ├── config/                 → Variables y validaciones de entorno (Joi)
│   ├── modules/
│   │   ├── media-handler/      → Descarga por streams, Magic Bytes y ClamAV
│   │   ├── meta-outbound/      → Servicios de envío de mensajes hacia Meta
│   │   ├── meta-webhook/       → Recepción de eventos y verificación de tokens
│   │   ├── normalizer/         → Estandarización de WhatsApp, Messenger e IG
│   │   └── rabbitmq/           → Integración de message broker y enrutamiento
│   └── main.ts                 → Bootstrap y configuración de recursos estáticos
├── uploads/                    → Volumen para persistencia de archivos multimedia
├── .env.template
├── docker-compose.yml
├── Dockerfile
└── package.json
```
---

# 🏗 Arquitectura del Sistema

```plaintext
A[Cliente WhatsApp/IG/Messenger] <-->|API de Meta| B[Webhook Controller]
B --> C[Normalizer Service]
C -->|¿Contiene Archivo?| D[Media Handler Service]
D -->|Validación Magic Bytes + Stream| E[ClamAV Container via TCP]
E -->|Limpio| F[Guardado Local: /uploads]
E -->|Infectado| X[Bloqueo FileSecurityBlockedError]
F --> G[Generación de URL Local y Metadata]
C --> H[RabbitMQ Publisher]
G --> H
H -->|telecom_exchange| I[Colas de RabbitMQ]
I -->|incoming_whatsapp / etc.| J[Consumidor: Agentes IA / LLM]
```
---

# ⚙️ Configuración del Entorno

## 1) ⚙️ Archivo .env
💻 Aplicación y Puerto

PORT=3000
--------------------------------------------------------
🌍 URL PÚBLICA (Ngrok o Producción)
--------------------------------------------------------
IMPORTANTE: Esta URL es necesaria para recibir webhooks de Meta
y para generar la URL pública de los archivos estáticos almacenados.

APP_BASE_URL=https://tu-dominio-seguro.com

--------------------------------------------------------
🟢 WEBHOOKS & SEGURIDAD META
--------------------------------------------------------
META_VERIFY_TOKEN=token_manual_para_webhook_super_seguro

META_APP_SECRET=secreto_de_la_app_en_meta_developers

--------------------------------------------------------
🐇 MESSAGE BROKER (RabbitMQ)
--------------------------------------------------------
RABBITMQ_URI=amqp://usuario:password@tu-servidor-rabbitmq:5672

--------------------------------------------------------
📱 CREDENCIALES CANALES (WhatsApp / Page)
--------------------------------------------------------
WHATSAPP_PHONE_NUMBER_ID=id_del_numero_de_whatsapp

WHATSAPP_GRAPH_API_TOKEN=token_permanente_del_usuario_del_sistema

META_PAGE_ID=id_de_la_pagina_facebook

META_PAGE_ACCESS_TOKEN=token_de_pagina_facebook

## 2) ☁️ Configuración en Meta for Developers

Para el correcto funcionamiento del sistema de ingesta, la aplicación debe configurarse en Meta de la siguiente manera:

### a) Creación de la Aplicación (Business)

Ingresa a Meta for Developers y crea una aplicación de tipo Negocios (Business). Esto es vital para integrar WhatsApp, Messenger e Instagram simultáneamente bajo un mismo ecosistema.

### b) Vinculación de Canales y Generación de Tokens

WhatsApp: Agrega el producto WhatsApp Cloud API, vincula el número de teléfono y obtén el WHATSAPP_PHONE_NUMBER_ID. Utiliza el Business Manager para generar un Token de Usuario del Sistema permanente (WHATSAPP_GRAPH_API_TOKEN).

Messenger / Instagram: Genera el token de acceso de la página de Facebook vinculada (META_PAGE_ACCESS_TOKEN) desde la configuración de la API de Messenger. Asegúrate de que la cuenta de Instagram sea Profesional y esté enlazada a dicha página.

### c) Configuración del Webhook Centralizado

En el panel de Meta, navega a Webhooks. Selecciona la URL de devolución (ej. https://<APP_BASE_URL>/webhooks/meta) e inyecta el META_VERIFY_TOKEN.
   
    Debes suscribir el webhook a tres objetos distintos:
    - WhatsApp Business Account: suscribir a messages.
    - Page: suscribir a messages, messaging_postbacks, messaging_optins.
    - Instagram: suscribir a messages.

## 4) Revisión de Aplicación (App Review)

Para operar en producción con clientes reales, deberás solicitar la aprobación de permisos críticos como whatsapp_business_messaging, pages_messaging e instagram_manage_messages.
---

# 🐳 Ejecución con Docker

El despliegue está contenerizado para garantizar el aislamiento del motor antivirus (ClamAV) y la aplicación NestJS.

Ejecutar:

```Bash
docker-compose up -d --build
```
El proceso:

Inicia un contenedor de ClamAV mapeado a una red interna para el escaneo TCP. (Nota: El primer inicio descargará las firmas de virus, puede tardar varios minutos).

Inicia el contenedor principal en Node.js/NestJS esperando a que ClamAV esté listo en el puerto 3310.

El volumen app_uploads se mapea a /app/uploads para persistencia segura de archivos.

Para ver registros en tiempo real:

```Bash
docker logs -f meta_data_arrive_app
```
---
🧩 Diseño del Sistema

✔ Abstracción de Canales (NormalizerService): Las estructuras de datos difieren drásticamente entre WhatsApp y Messenger/Instagram (entry[].messaging[]). El servicio de normalización procesa estas diferencias de raíz y genera un DTO homogéneo.

✔ Manejo Eficiente de Memoria: El MediaService procesa descargas multimedia a través de streams. Esto evita cargar los buffers enteros de archivos pesados (videos o PDFs) en la RAM de Node.js, previniendo saturación y caídas del servidor ante ráfagas de mensajes.

✔ Delegación a IA (No Code Execution): El backend no transcribe audio, ni lee PDFs, ni analiza imágenes con visión. Se limita estrictamente a descargar el activo de Meta, validarlo, persistirlo estáticamente y entregar en el evento la URL lista (http://.../uploads/...) para que el LLM del NOC ejecute las Tools necesarias bajo demanda.

---

💾 Modelo de Datos (Payloads)

El DTO normalizado que se publica en RabbitMQ y que el LLM consume es estrictamente estructurado:

```plaintext
{
  "source": "whatsapp", // whatsapp | messenger | instagram
  "messageId": "wamid.HBgLNTczMT...",
  "senderId": "573001234567",
  "recipientId": "10987654321",
  "timestamp": 1708945200,
  "type": "image", // text | image | audio | document | etc.
  "content": {
    "text": "Adjunto recibo de pago" // null si no hay texto
  },
  "metadata": {
    "file_id": "873645827364",
    "url": "https://api.tu-dominio.com/uploads/1708945200-image.jpeg",
    "mime_type": "image/jpeg"
  }
}
```
---

# ⚠️ Reglas de Enrutamiento (RabbitMQ)

Condiciones de Publicación:

El RabbitPublisherService despacha los eventos a un Exchange centralizado llamado telecom_exchange.

El enrutamiento (Routing Keys) se realiza dinámicamente utilizando la propiedad source del DTO normalizado, distribuyendo la carga hacia las colas correspondientes:

    incoming_whatsapp

    incoming_messenger

    incoming_instagram

Manejo de Errores y Tolerancia a Fallos:
Se recomienda declarar y bindear una Dead-Letter Queue (DLQ) para cada canal. Si el LLM o el consumidor falla en el procesamiento del evento, el mensaje se enviará a la DLQ para reintentos o auditoría manual, evitando la pérdida de interacciones con los clientes.

---

# 🛡️ Seguridad (MIME & ClamAV)

El manejo de archivos adjuntos en telecomunicaciones representa una superficie de ataque crítica. Este proyecto implementa confianza cero (Zero Trust) para la ingesta de medios:
1. Validación de Magic Bytes (Prevención de Spoofing)

El sistema intercepta el primer chunk del stream de red y verifica los "magic bytes" reales del archivo. Si un atacante intenta subir un script.sh renombrado a foto.jpg, el backend detectará la discrepancia del MIME type en la cabecera hexadecimal y descartará la petición inmediatamente.
2. Escaneo Antimalware Aislado (ClamAV)

Si el archivo es un tipo válido, se somete a un análisis heurístico y de firmas profundas utilizando ClamAV.

    Aislamiento: El análisis se delega vía TCP al contenedor clamav-service, completamente separado de Node.js.

    Veredicto: Si el motor responde OK, se guarda en el volumen /uploads. Si responde FOUND (Malware), se lanza un FileSecurityBlockedError, se purga el stream y el archivo infectado nunca toca el disco del sistema ni llega al flujo del LLM.

---

# 🧪 Pruebas y Verificación

✅ Validar Conexión de Webhook (Meta)
Puedes consultar la validación de suscripción simulando el reto de Meta:
```bash
curl "http://localhost:3000/webhooks/meta?hub.mode=subscribe&hub.challenge=1234&hub.verify_token=[TU_VERIFY_TOKEN]"
```
✅ Verificar Estado de ClamAV
Puedes ingresar al contenedor y ejecutar un ping a la base de firmas:
```bash
docker exec -it clamav_container ping -c 1 database.clamav.net
```

---

# 🚨 Troubleshooting

❌ "Error de Verificación" / HTTP 403 en Meta
Asegúrate de que la variable META_VERIFY_TOKEN coincida exactamente con la ingresada en el portal para Desarrolladores de Meta y que el túnel HTTPS (ej. ngrok/traefik) esté activo y apuntando al puerto 3000.

❌ El webhook recibe el evento pero no se guarda el archivo localmente
Asegúrate de que en el controlador de entrada o en el normalizador estés invocando asíncronamente a mediaService.processAttachment() antes de enviar el payload a RabbitMQ. Actualmente (WIP) se extrae el ID, pero la descarga directa debe conectarse.

❌ "Connection Refused" en ClamAV
El contenedor NestJS puede haber iniciado más rápido que ClamAV. El motor antivirus toma un tiempo considerable la primera vez descargando la base de datos de virus (archivos .cvd). Revisa los logs del contenedor de ClamAV y espera el mensaje socket found, listening...
