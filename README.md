# MediStock — Medicine Stock Intelligence

MediStock (Medicine Stock Intelligence) is a local-first healthcare inventory app for pharmacies, clinics, hospitals, and medical distributors.

It uses free and open-source tools only:
- React
- Vite
- Express
- MongoDB
- Chart.js
- Axios
- JWT
- jsPDF
- XLSX utilities

There are no paid APIs required for the default setup. The frontend uses the local `/api` proxy in development, and the server uses a local MongoDB instance by default.

## Features

- Medicine inventory management
- Expiry and stock alerts
- Supplier, purchase, and report workflows
- CSV/XLSX import & export
- PDF report preview and download
- Local forecasting and dashboard charts
- Email verification flow backed by the local API

## Run Locally

```bash
npm install
npm run dev
```

## Validation

```bash
npm run build
npm run lint
```

## Configuration

```env
NODE_ENV=development
PORT=5002
MONGO_URI=mongodb://localhost:27017/smart_medicine_db
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

If you want to point the frontend to a different backend, set `VITE_API_URL`. Otherwise, it stays on the local `/api` route.

## Vercel Environment Variables

In the Vercel project, open **Settings > Environment Variables** and add these variables for **Production**:

```env
NODE_ENV=production
MONGO_URI=<your MongoDB Atlas connection string>
JWT_ACCESS_SECRET=<long random secret>
JWT_REFRESH_SECRET=<different long random secret>
```

Leave `VITE_API_URL` unset when the frontend and API use the same Vercel project. If the API is hosted separately, add `VITE_API_URL` with the backend URL, for example `https://api.example.com/api`.

After saving the variables, redeploy the project. See `.env.example` for the local variable names; never commit real secrets.