# TitleFlow

TitleFlow is a modern full-stack demo app for title and closing operations. It pairs a React + Tailwind CSS order/file workspace with a Flask API for transaction data, rule-driven checklists, closing cost estimates, and closing email drafts.

## Features

- Dashboard with a searchable file/order list
- Dedicated file workspace with active file header, progress, status, lender, property, and missing item count
- Workspace tabs for Overview, Property, Contacts, Loan, Payoffs, Documents, Checklist, Emails, Notes, and Title Commitment
- Editable fields across each file tab, saved in browser `localStorage`
- File numbering in the `1-2026`, `2-2026` format with newest files sorted first and year filtering
- Purchase price and closing date fields shown in the file header and Overview tab
- Deep navy, muted teal, and warm gold product styling for a proptech/title operations feel
- Contacts workspace for buyer, seller, listing agent, buyer's agent, lender, loan officer, processor, insurance, HOA, payoff, and other contacts
- Checklist-style document tracking for PR, CPL, wire instructions, articles, operating agreement, deed of trust, settlement statement, plat map, tax certificate, and insurance invoice
- Foldered document uploads for Title, Closing, Loan, Payoffs, Property, Entity Docs, Recording, and Other; metadata persists after refresh
- Auto-generated checklist based on purchase/refinance/construction, entity type, lender, and construction status
- Title Commitment draft helper with summary generation and copy-to-clipboard support
- Closing cost calculator with transparent sample formulas
- Email generator for payoff, lender package, missing document, utility/assessment, HOA, and insurance invoice requests
- Template builder for email, document, title commitment, and checklist templates with merge fields and copyable previews
- Sample title/escrow file data included on both the frontend and backend so the UI remains useful while the API starts

## Project Structure

```text
backend/
  app.py              Flask API and sample transaction data
  requirements.txt   Python dependencies
frontend/
  src/App.jsx         React workspace application
  src/data.js         Sample files, folders, roles, and templates
  src/utils.js        Normalization, merge fields, checklist, email, and title helpers
  src/main.jsx        React entrypoint
  src/styles.css      Tailwind component styles
  package.json        Vite React dependencies and scripts
```

## Run the Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The Flask API runs at `http://localhost:5000/api`.

## Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite app runs at `http://localhost:5173`.

## API Endpoints

- `GET /api/transactions`
- `POST /api/transactions`
- `GET /api/transactions/<id>/checklist`
- `POST /api/costs/calculate`
- `POST /api/email/generate`
