📱 Meta OmniChannel Ingestion Service

Este proyecto es un microservicio backend de alto rendimiento desarrollado en NestJS diseñado para la ingesta, normalización y enrutamiento de mensajes provenientes del ecosistema de Meta (WhatsApp Cloud API, Messenger e Instagram). Actúa como la capa de entrada (Gateway) y preparación de datos para sistemas de Inteligencia Artificial (LLM + MCP), utilizando RabbitMQ como bus de eventos.
#📑 Tabla de Contenidos

    Arquitectura del Sistema

    Estado Actual y Evaluación

    Flujo de Preparación para IA

    Requisitos Previos

    Configuración en Meta for Developers

        A. Creación de la App

        B. Vinculación de Canales

        C. Configuración del Webhook

        D. Permisos para Producción

    Configuración del Entorno

    Despliegue

##1. Arquitectura del Sistema

El sistema sigue una arquitectura orientada a eventos estrictamente desacoplada:

    Ingesta (Webhooks): Un único endpoint centralizado recibe los eventos de Meta, validando firmas y tokens de seguridad.

    Normalización: Los payloads dispares de WhatsApp (Graph API) y Messenger/Instagram se transforman en un DTO estándar estandarizado.

    Manejo de Archivos (Seguro): - Descarga mediante streams para optimizar el uso de memoria.

        Validación de "magic bytes" (MIME type real).

        Escaneo antivirus mediante ClamAV (vía TCP).

        Almacenamiento en volumen local (sin servicios en la nube externos).

    Enrutamiento (RabbitMQ): El mensaje procesado (con la URL local del archivo y su metadata) se publica en el telecom_exchange hacia colas específicas por canal.

##2. Estado Actual y Evaluación
✅ Puntos Fuertes Implementados

    Eficiencia de Memoria: El uso de streams en MediaService evita cargar buffers grandes en memoria al descargar multimedia.

    Seguridad Robusta: La intercepción de "magic bytes" y la conexión TCP aislada con el contenedor de ClamAV evitan vectores de ataque vía archivos maliciosos.

    Abstracción de Canales: El NormalizerService maneja de forma elegante las inconsistencias de las APIs de Meta.

⚠️ Roadmap y Correcciones Críticas (WIP)

    Integración Webhook-MediaService: Actualmente el controlador delega la normalización, pero falta inyectar la llamada explícita a mediaService.processAttachment() antes de publicar en RabbitMQ. Los archivos deben descargarse localmente primero.

    Topología RabbitMQ: Se debe implementar la aserción explícita de colas (incoming_whatsapp, incoming_messenger, incoming_instagram) y la configuración de sus respectivas Dead-Letter Queues (DLQ) en RabbitPublisherService para asegurar tolerancia a fallos.

##3. Flujo de Preparación para IA

Este microservicio NO ejecuta procesamiento cognitivo de archivos. Su responsabilidad termina al entregar un evento enriquecido y seguro al message broker.

El payload entregado a los consumidores (Agentes LLM/MCP) incluye:

    file_id

    url (Ruta local estática, ej: https://api.tudominio.com/uploads/archivo.pdf)

    type (MIME validado)

    user_id y metadatos del canal.

El LLM consumidor es responsable de: Decidir bajo demanda qué tool (herramienta) utilizar para transcribir el audio, analizar la imagen (Vision) o extraer texto del PDF utilizando la URL proporcionada.
##4. Requisitos Previos

    Node.js v18+ y NestJS CLI

    Docker y Docker Compose

    Cuenta de desarrollador en Meta for Developers

    Una cuenta de Meta Business Manager (para paso a producción)

    Un servidor expuesto con HTTPS (ej. ngrok para desarrollo, Nginx/Traefik para producción)

##5. Configuración en Meta for Developers
   
A. Creación de la App

    En Meta for Developers, ve a Mis aplicaciones > Crear aplicación.

    Selecciona "Otro" (o "Empresa" según tu interfaz) > Tipo: Negocios (Business).

    Asigna un nombre (ej. Telecom OmniBot) y vincula tu Business Manager.

    Añade los productos: WhatsApp, Messenger e Instagram Graph API.

B. Vinculación de Canales

    WhatsApp Cloud API:

        En WhatsApp > Configuración de la API, registra un número o usa el de prueba.

        Obtén el WHATSAPP_PHONE_NUMBER_ID y genera un Token de Usuario del Sistema en el Business Manager (no el temporal de 24h).

    Messenger:

        En Messenger > Configuración de la API, genera un token para tu Página de Facebook (META_PAGE_ACCESS_TOKEN).

    Instagram Direct:

        Asegúrate de que la cuenta de IG sea Profesional y esté vinculada a la Página de Facebook. Autoriza el acceso a mensajes en la configuración.

C. Configuración del Webhook

    Define un META_VERIFY_TOKEN seguro en tu archivo .env.

    En el panel de Meta, ve a la sección Webhooks.

    Configura la URL de devolución: https://tudominio.com/webhooks/meta

    Suscríbete a los siguientes objetos y campos:

        WhatsApp Business Account: messages

        Page: messages, messaging_postbacks, messaging_optins

        Instagram: messages

D. Permisos para Producción (App Review)

Para operar con usuarios finales, solicita revisión para:

    whatsapp_business_messaging

    pages_messaging

    instagram_manage_messages

    instagram_basic y pages_show_list

##6. Configuración del Entorno

Copia el archivo .env.template a .env y configura las variables:
Fragmento de código

# Servidor NestJS
PORT=3000
APP_BASE_URL=https://tu-dominio-seguro.com

# Webhooks & Seguridad Meta
META_VERIFY_TOKEN=tu_token_seguro_inventado
META_APP_SECRET=secreto_de_la_app_en_meta

# Message Broker
RABBITMQ_URI=amqp://usuario:password@tu-servidor-rabbitmq:5672

# Credenciales Canales
WHATSAPP_PHONE_NUMBER_ID=id_del_numero_de_whatsapp
WHATSAPP_GRAPH_API_TOKEN=token_permanente_del_usuario_del_sistema
META_PAGE_ID=id_de_la_pagina_facebook
META_PAGE_ACCESS_TOKEN=token_de_pagina_facebook

##7. Despliegue

El despliegue está contenerizado para garantizar el aislamiento del motor antivirus (ClamAV) y la aplicación NestJS.

    Construye y levanta los servicios:
    Bash

    docker-compose up -d --build

    Notas sobre el despliegue:

        Persistencia: El docker-compose.yml mapea un volumen app_uploads hacia /app/uploads. Esto asegura que los archivos multimedia descargados no se pierdan si el contenedor se reinicia. Los archivos se exponen como recursos estáticos vía NestJS.

        Inicio de ClamAV: En el primer arranque, el servicio clamav descargará la base de datos de firmas virales. Esto puede tardar unos minutos. La API esperará a que el puerto 3310 esté disponible para inicializar el MediaService.
