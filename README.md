# bhashya-ai
An AI based full video content generator agent ready for posting to platforms

## Firebase Hosting with Reverse Proxy

This project uses Firebase Hosting to serve a web application that reverse proxies API requests to a backend server without exposing the backend host in client code.

- **Frontend**: Firebase Hosting
- **Reverse Proxy**: Cloud Run service (NOT Cloud Functions)
- **Backend**: Configurable via environment variables (e.g., media.semibit.in)

### Quick Start

See [SETUP.md](SETUP.md) for detailed deployment instructions.

### Features

✅ API requests to `/api/generate` are proxied to backend  
✅ Backend host hidden via environment variables  
✅ No backend URL exposed in client code or repository  
✅ CORS enabled by default  
✅ Easy to deploy and configure
