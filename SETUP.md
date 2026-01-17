# Firebase Hosting with Reverse Proxy Setup

This project sets up a Firebase Hosting application that reverse proxies API requests to hide the backend host.

## Architecture

- **Firebase Hosting**: Serves static files from the `public/` directory
- **Cloud Run**: Runs a lightweight reverse proxy service (NOT Cloud Functions)
- **Reverse Proxy**: Maps `/api/generate` → `https://media.semibit.in/api/generate`

The backend host (media.semibit.in) is configured via environment variables and never exposed in client-side code.

## Setup Instructions

### Prerequisites

- Firebase CLI installed: `npm install -g firebase-tools`
- Google Cloud SDK installed (for Cloud Run deployment)
- Firebase project created
- Docker installed (for building Cloud Run image)

### 1. Configure Firebase Project

```bash
# Login to Firebase
firebase login

# Update .firebaserc with your project ID
# Replace "your-project-id" with your actual Firebase project ID
```

### 2. Deploy Cloud Run Proxy Service

```bash
# Navigate to the proxy directory
cd cloud-run-proxy

# Build and deploy to Cloud Run
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/reverse-proxy
gcloud run deploy reverse-proxy \
  --image gcr.io/YOUR_PROJECT_ID/reverse-proxy \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars BACKEND_HOST=media.semibit.in
```

**Important**: Replace `YOUR_PROJECT_ID` with your actual Google Cloud project ID.

### 3. Update Firebase Configuration

After deploying to Cloud Run, the service will have a name like `reverse-proxy`. This should match the `serviceId` in `firebase.json`.

### 4. Deploy Firebase Hosting

```bash
# From the project root
firebase deploy --only hosting
```

## Environment Variables

The backend host is configured via the `BACKEND_HOST` environment variable in Cloud Run:

- **Production**: Set via `gcloud run deploy` command (see above)
- **Local Development**: Create a `.env` file in `cloud-run-proxy/` directory

Example `.env` file:
```
BACKEND_HOST=media.semibit.in
```

## Local Development

### Run Cloud Run Proxy Locally

```bash
cd cloud-run-proxy
npm install
BACKEND_HOST=media.semibit.in npm start
```

The proxy will be available at `http://localhost:8080`

### Test the Proxy

```bash
curl -X POST http://localhost:8080/api/generate \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### Run Firebase Hosting Locally

```bash
firebase serve
```

Then open `http://localhost:5000` in your browser.

## How It Works

1. Client makes request to `/api/generate`
2. Firebase Hosting rewrites the request to Cloud Run service
3. Cloud Run proxy forwards the request to `https://media.semibit.in/api/generate`
4. Response is returned through the same chain
5. Backend host remains hidden from client code

## Security Notes

- The actual backend host (media.semibit.in) is only stored in Cloud Run environment variables
- Never commit `.env` files with real credentials
- Use `.env.example` as a template
- The backend host is NEVER exposed in client-side code or repository

## File Structure

```
.
├── firebase.json          # Firebase Hosting configuration
├── .firebaserc           # Firebase project configuration
├── .env.example          # Example environment variables
├── public/               # Static files served by Firebase Hosting
│   └── index.html        # Demo page
├── cloud-run-proxy/      # Cloud Run reverse proxy service
│   ├── server.js         # Express server for proxying
│   ├── package.json      # Node.js dependencies
│   ├── Dockerfile        # Container image definition
│   └── .dockerignore     # Docker ignore file
└── README.md             # This file
```

## Testing the Deployment

After deployment, visit your Firebase Hosting URL and click the "Test API Endpoint" button to verify the reverse proxy is working.

## Troubleshooting

### Cloud Run service not found
- Make sure you've deployed the Cloud Run service first
- Verify the `serviceId` in `firebase.json` matches your Cloud Run service name

### CORS errors
- The proxy includes CORS headers by default
- Check that the backend (media.semibit.in) also returns appropriate CORS headers

### 500 errors
- Check Cloud Run logs: `gcloud run services logs read reverse-proxy`
- Verify BACKEND_HOST environment variable is set correctly
