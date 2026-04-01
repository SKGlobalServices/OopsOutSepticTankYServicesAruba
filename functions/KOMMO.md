# Integración Kommo (OAuth, webhook, WhatsApp / Chats)

## Variables de entorno (Cloud Functions)

Definir en el entorno de despliegue (o en `.env` local para emuladores). Resumen:

| Variable | Obligatoria para | Uso |
|----------|------------------|-----|
| `KOMMO_CLIENT_ID` | OAuth, API CRM | Client ID de la integración |
| `KOMMO_CLIENT_SECRET` | OAuth, API CRM | Secret de la integración |
| `KOMMO_DOMAIN` | **Sí** (enviar / talks) | Subdominio sin `.kommo.com` |
| `KOMMO_CHANNEL_SECRET` | WhatsApp real (Amojo) | Secret del canal Chats |
| `KOMMO_SCOPE_ID` | WhatsApp real | `scope_id` del canal conectado |
| `KOMMO_AMOJO_ACCOUNT_ID` | WhatsApp real | `account_id` devuelto al conectar el canal |
| `KOMMO_AMOJO_SENDER_ID` | Opcional | Identificador del remitente en el payload (default `integration`) |
| `KOMMO_AMOJO_SENDER_NAME` | Opcional | Nombre mostrado (default `Oops`) |
| `KOMMO_AMOJO_MD5_MODE` | Opcional | `hex` (default) o `base64` si Amojo rechaza la firma |
| `KOMMO_SEND_FALLBACK_NOTES` | Opcional | `true` = si falla Amojo o no hay conversación, enviar nota CRM al lead |
| `KOMMO_DEFAULT_COUNTRY_CODE` | Opcional | Default `297` (Aruba) para cruce de teléfonos RTDB ↔ Kommo |

Detalle en [`.env.example`](.env.example).

### Código de autorización OAuth (query `code`)

- **No lo guardes** en `.env` ni en `functions/.env`: es **de un solo uso** y **caduca** en minutos.
- Flujo correcto: inicia sesión en la app con **Google** → autoriza en Kommo → el navegador abre `/#/kommo-oauth-callback` con `code` en la URL → la página llama a la callable `kommoOAuth` → los **tokens** quedan en Firestore `kommo_tokens/default`.
- Si el código ya expiró o se usó, vuelve a abrir el enlace de autorización de Kommo para obtener uno nuevo.

### WhatsApp real vs nota CRM

- **Producción recomendada:** configurar **Amojo** (`KOMMO_CHANNEL_SECRET`, `KOMMO_SCOPE_ID`, `KOMMO_AMOJO_ACCOUNT_ID`) según la [documentación Chats API](https://developers.kommo.com/reference/send-import-messages) y el flujo de conexión de canal.
- La callable resuelve `conversation_id` con la API CRM `GET /api/v4/talks` filtrando por `leadId`, o puedes pasar `talkId` / `conversationId` directamente desde `/#/kommo-admin`.
- Si Amojo no está configurado y **no** pones `KOMMO_SEND_FALLBACK_NOTES=true`, el envío fallará con un mensaje que indica qué variables faltan.

## Redirect URI (OAuth)

1. En Kommo → integración, registra **exactamente** la URL de callback (hash router):

   `https://<host>/<ruta-base-si-existe>/#/kommo-oauth-callback`

   Ejemplo con el `homepage` de este repo:

   `https://skglobalservices.github.io/OopsOutSepticTankYServicesAruba/#/kommo-oauth-callback`

2. Si Kommo **no acepta** `#` en la Redirect URI, hace falta un callback HTTP en Cloud Functions (no incluido aquí).

3. Tras autorizar, la página `KommoOAuthCallback` llama a la callable `kommoOAuth`, que guarda tokens en Firestore: `kommo_tokens/default` (el frontend **no** lee los tokens).

## Firebase Auth y callables

`kommoOAuth` y `kommoSendMessage` son **callables** y requieren `request.auth` (Firebase Auth).

- Login solo con **email/contraseña** en RTDB **no** crea sesión en Firebase Auth; para Kommo usa **Google** u otro proveedor que deje `auth.currentUser`.

## Callable `kommoSendMessage`

Entrada:

```json
{
  "message": "texto",
  "leadId": 12345,
  "talkId": 67890,
  "conversationId": "uuid-o-id-de-chats"
}
```

- `message` (string, obligatorio).
- Al menos uno de: `leadId`, `talkId`, `conversationId`.

Respuesta incluye `delivery`: `"amojo"` o `"crm_note"`, y opcionalmente `noteId`, `amojoStatus`.

## Webhook `kommoWebhook`

- URL: función HTTP `kommoWebhook` (región `us-central1`), invocación pública.
- Soporta cuerpo JSON, `x-www-form-urlencoded`, y `payload` / `data` / `body` como **string JSON** (CRM y Chats).
- Eventos CRM útiles: `leads.*`, `contacts.*`, `notes.*`.
- Chats: incluir eventos de mensajes según [webhooks de Chats](https://developers.kommo.com/reference/receiving-chat-webhooks) si Kommo los expone en tu cuenta.
- **Deduplicación:** mensajes entrantes con texto se registran en `kommo_webhook_dedup` (hash del id de mensaje o del payload) para evitar duplicados por reintentos.
- **Historial:** `kommo_messages/{clienteId|phone_*}/messages/*` en Firestore; metadatos: `conversation_id`, `talk_id`, `channel`, `delivery`, `kommo_message_id`.

## Matching clientes (RTDB)

- Se busca por `kommo_contact_id`, `kommo_lead_id`, o teléfonos `telefono1` / `telefono2` / `telefono3` / `telefono`.
- Normalización con código de país por defecto **297** (configurable con `KOMMO_DEFAULT_COUNTRY_CODE`).
- Tras resolver el cliente, se actualizan en RTDB `kommo_contact_id` y `kommo_lead_id` cuando vienen en el webhook.

## Flujo recomendado (end-to-end)

1. Configurar secretos Firebase para todas las variables necesarias y `firebase deploy --only functions`.
2. Registrar Redirect URI en Kommo y completar OAuth (admin con Google).
3. Conectar canal Chats en Kommo y copiar `scope_id`, `channel_secret`, `account_id` a las variables Amojo.
4. Configurar webhook apuntando a `kommoWebhook`; probar mensaje entrante y revisar Firestore (`kommo_messages`, `kommo_webhook_dedup`).
5. Probar envío desde `/#/kommo-admin` con `leadId` y/o `talkId` / `conversationId`.

## Verificación local

```bash
cd functions && npm run build
```

En la raíz del repo (requiere `REACT_APP_*` si compilas la app):

```bash
npm run build
```

## Referencias

- [Kommo developers](https://es-developers.kommo.com/docs/kommo-desarrolladores)
- [OAuth 2.0](https://es-developers.kommo.com/docs/oauth-20)
- [Import / send messages (Amojo)](https://developers.kommo.com/reference/send-import-messages)
- [Webhooks](https://es-developers.kommo.com/docs/webhooks)
