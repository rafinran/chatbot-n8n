# N8N Integration Architecture

This document explains how the Backend, Frontend, and N8N workflow are connected in the helpdesk chatbot system.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER BROWSER                             │
│  Frontend (React/Vite) → http://localhost                   │
└──────────────┬──────────────────────────────────────────────┘
               │
               │ HTTP/WebSocket
               │
┌──────────────▼──────────────────────────────────────────────┐
│                   NGINX PROXY                                │
│  - Port 80                                                   │
│  - Routes / → Frontend (3000)                               │
│  - Routes /api → Backend (8000)                             │
└──────────────┬──────────────────────────────────────────────┘
               │
               │ Container Network
               │
     ┌─────────┴─────────┐
     │                   │
┌────▼─────────┐  ┌─────▼──────────┐
│   BACKEND    │  │   DATABASE     │
│  (Node.js)   │  │  (PostgreSQL)  │
│  Port 8000   │  │  Port 5432     │
│              │  │                │
│ • Auth API   │  │ • Users        │
│ • Chat API   │  │ • Chat history │
│ • File API   │  │ • Logs         │
└──────┬───────┘  └────────────────┘
       │
       │ HTTPS Webhook Call
       │ (External Network)
       │
       ▼
  ┌────────────────────────────────────────┐
  │    N8N WORKFLOW (Sumopod or VPS)       │
  │    https://sumopod-domain.com          │
  │    or https://your-vps.com             │
  │                                        │
  │ • Query Processing                     │
  │ • LLM Integration (e.g., OpenAI)       │
  │ • Knowledge Base Search                │
  │ • Response Generation                  │
  └────────────────────────────────────────┘
```

## Flow Explanation

### 1. User sends a message
- Frontend (React) → Backend API: `POST /api/chat`
  - Payload: `{ message: "user question" }`
  - Auth: JWT token in Authorization header

### 2. Backend processes the request
- Validates user authentication (middleware)
- Validates message content
- Prepares payload with user context
- **Calls N8N Webhook** via HTTPS

### 3. Backend → N8N Webhook
```javascript
fetch(process.env.N8N_WEBHOOK_URL, {
  method: "POST",
  headers: { 
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ 
    question: message,
    user_id: user_id,
    user_email: user_email,
  }),
})
```

**Note:** No authentication header needed - webhook is public production line endpoint

### 4. N8N Workflow processes
- Receives webhook call
- Extracts question from request
- Performs workflow steps:
  - Query knowledge base
  - Call LLM (ChatGPT, Gemini, etc.)
  - Generate response
  - Return structured response

### 5. N8N returns response
```json
{
  "answer": "Response from workflow",
  "is_answered": true,
  "confidence": 0.95,
  "sources": ["faq_document_1"]
}
```

### 6. Backend stores and returns
- Logs chat interaction to database
- Stores in session history
- Returns to Frontend: `{ response: answer, is_answered: is_answered }`

### 7. Frontend displays response
- Shows assistant message to user
- Displays typing indicator during wait
- Shows error message if request fails

## Environment Configuration

### Required Environment Variable

```env
# N8N Webhook (Production Line - Sumopod or VPS)
N8N_WEBHOOK_URL=https://n8n-jn0r4cng3ydi.jkt5.sumopod.my.id/webhook/epson/chat/text
```

### How to Get the Webhook URL:

1. **On Sumopod (Production Line)**
   - Access your n8n instance on Sumopod
   - Go to your workflow
   - Add/configure webhook trigger node
   - Copy the webhook URL
   - Format: `https://n8n-jn0r4cng3ydi.jkt5.sumopod.my.id/webhook/epson/chat/text`

2. **On VPS (Self-hosted)**
   - Deploy n8n on your VPS
   - Add webhook trigger node in workflow
   - Copy the webhook URL
   - Format: `https://your-vps-domain.com/webhook/epson/chat/text`
   - Or: `https://your-vps-ip:port/webhook/epson/chat/text`

## Docker Compose Setup

```yaml
services:
  backend:
    environment:
      N8N_WEBHOOK_URL: ${N8N_WEBHOOK_URL}
    # No dependency on rag-service anymore
```

**Note:** Unlike the RAG service which was containerized locally, N8N runs externally (Sumopod or VPS), so:
- No docker build for n8n locally
- No service health check needed
- Backend makes outbound HTTPS calls instead
- Network connectivity to n8n required
- Public webhook endpoint (no authentication required)

## N8N Workflow Requirements

Your N8N workflow should:

1. **Accept webhook POST requests** with:
   - `question` (string): User's question
   - `user_id` (string): User identifier
   - `user_email` (string): User email for logging

2. **Return JSON response** with:
   ```json
   {
     "answer": "Response text",
     "is_answered": true,  // boolean: was the question answered
     "confidence": 0.95,   // optional: confidence score
     "sources": []         // optional: source documents
   }
   ```

3. **Error handling**: Return HTTP 200 with error in response, or HTTP 5xx for critical errors

## Testing the Integration

### 1. Test from Backend Container
```bash
docker exec helpdesk-backend curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"question":"test","user_id":"123","user_email":"user@example.com"}' \
  $N8N_WEBHOOK_URL
```

### 2. Test via Frontend
- Login to frontend
- Send a message in chat
- Check backend logs: `docker logs helpdesk-backend`
- Check N8N logs on Sumopod or VPS

### 3. Verify Connectivity
```bash
# Test if N8N webhook is reachable
curl -I $N8N_WEBHOOK_URL
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 404 Not Found | Verify `N8N_WEBHOOK_URL` is correct and webhook trigger is active |
| Connection timeout | Ensure firewall/security allows outbound HTTPS to webhook |
| Slow responses | n8n workflow might be processing long requests; increase `proxy_read_timeout` in nginx.conf |
| Empty responses | Check n8n workflow returns proper JSON structure with `answer` field |
| 503/502 Bad Gateway | N8N server might be down or webhook endpoint changed |

## Nginx Configuration

The nginx.conf is configured to handle n8n latency:
```nginx
# Timeout for backend to wait for n8n response
proxy_read_timeout 120s;
proxy_connect_timeout 10s;
```

Adjust these if n8n workflows take longer.

## Security Notes

- **N8N_WEBHOOK_URL**: Production line webhook (publicly accessible)
- Use HTTPS for all communication to webhook
- If webhook needs protection, configure IP whitelist or API gateway rules in n8n

## Migration from RAG Service

Changes made:
- ✅ Removed `rag-service` from docker-compose.yaml
- ✅ Removed rag dependencies from backend
- ✅ Updated `/api/chat` route to call n8n webhook
- ✅ Simplified environment variables (only N8N_WEBHOOK_URL)
- ✅ Updated error messages

No frontend changes needed - the chat UI works the same way!

## Next Steps

1. Set up n8n workflow on Sumopod or VPS
2. Configure webhook trigger in n8n
3. Create workflow logic (knowledge base search, LLM call, etc.)
4. Get webhook URL
5. Add to `.env` file
6. Deploy with `docker compose up -d`
7. Test chat functionality
