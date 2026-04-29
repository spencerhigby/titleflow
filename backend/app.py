from datetime import date
from typing import Dict, List

from flask import Flask, jsonify, request
from flask_cors import CORS


app = Flask(__name__)
CORS(app)


# In-memory sample data keeps the demo easy to run and inspect.
# Replace this with a database model when TitleFlow is ready for production.
TRANSACTIONS: List[Dict] = [
    {
        "id": 1,
        "file_number": "1-2026",
        "borrower": "Maya Bennett",
        "seller": "Jordan Ellis",
        "purchase_price": 0,
        "property": "1840 Willow Ridge Dr, Denver, CO",
        "property_type": "Single family",
        "county": "Denver",
        "loan_type": "Refinance",
        "loan_amount": 548000,
        "lender": "Summit Trust Bank",
        "entity_type": "Individual",
        "stage": "Clear to close",
        "progress": 82,
        "closing_date": "2026-05-08",
        "escrow_officer": "Avery Collins",
        "missing_docs": ["Updated payoff letter", "Final hazard binder"],
        "rules": ["refi", "lender_wire_review"],
        "documents": ["Title commitment", "Closing protection letter", "Preliminary settlement statement"],
        "contacts": [
            {
                "id": 101,
                "name": "Maya Bennett",
                "company": "Self",
                "role": "Buyer",
                "email": "maya@example.com",
                "phone": "(303) 555-0184",
                "notes": "Prefers email updates after 2 PM.",
            },
            {
                "id": 102,
                "name": "Theo Park",
                "company": "Summit Trust Bank",
                "role": "Loan officer",
                "email": "theo.park@summit.example",
                "phone": "(720) 555-0149",
                "notes": "Needs final CD one business day before signing.",
            },
        ],
        "costs": {
            "title_fee": 1125,
            "recording_fee": 255,
            "transfer_tax": 0,
            "settlement_fee": 695,
            "endorsements": 185,
        },
    },
    {
        "id": 2,
        "file_number": "2-2026",
        "borrower": "Northline Holdings LLC",
        "seller": "Rivergate Partners",
        "purchase_price": 875000,
        "property": "91 Harbor Walk, Tampa, FL",
        "property_type": "Mixed-use",
        "county": "Hillsborough",
        "loan_type": "Purchase",
        "loan_amount": 720000,
        "lender": "Civic Capital",
        "entity_type": "LLC",
        "stage": "Docs outstanding",
        "progress": 56,
        "closing_date": "2026-05-15",
        "escrow_officer": "Noor Patel",
        "missing_docs": ["Operating agreement", "Certificate of good standing"],
        "rules": ["llc", "lender_entity_review"],
        "documents": ["Purchase contract", "Tax certificate", "Entity resolution"],
        "contacts": [
            {
                "id": 201,
                "name": "Nora Li",
                "company": "Northline Holdings LLC",
                "role": "Buyer",
                "email": "nora@northline.example",
                "phone": "(813) 555-0198",
                "notes": "Authorized signer for closing documents.",
            },
            {
                "id": 202,
                "name": "Malik Stone",
                "company": "Civic Capital",
                "role": "Processor",
                "email": "malik.stone@civic.example",
                "phone": "(813) 555-0171",
                "notes": "Entity approval package due by Friday.",
            },
        ],
        "costs": {
            "title_fee": 1380,
            "recording_fee": 340,
            "transfer_tax": 1750,
            "settlement_fee": 775,
            "endorsements": 240,
        },
    },
    {
        "id": 3,
        "file_number": "3-2026",
        "borrower": "Elliot Harper",
        "seller": "Harper Family Trust",
        "purchase_price": 0,
        "property": "402 Mesa Verde Ln, Scottsdale, AZ",
        "property_type": "Townhome",
        "county": "Maricopa",
        "loan_type": "Refinance",
        "loan_amount": 398500,
        "lender": "Apex Home Lending",
        "entity_type": "Trust",
        "stage": "Title review",
        "progress": 34,
        "closing_date": "2026-05-21",
        "escrow_officer": "Sam Rivera",
        "missing_docs": ["Trust certification", "HOA demand"],
        "rules": ["refi", "trust", "hoa_demand"],
        "documents": ["Open order sheet", "Vesting deed", "HOA authorization"],
        "contacts": [
            {
                "id": 301,
                "name": "Elliot Harper",
                "company": "Self",
                "role": "Buyer",
                "email": "elliot@example.com",
                "phone": "(480) 555-0107",
                "notes": "Trust documents are with estate attorney.",
            },
            {
                "id": 302,
                "name": "Sofia Grant",
                "company": "Desert Vista HOA",
                "role": "HOA contact",
                "email": "sofia@desertvista.example",
                "phone": "(480) 555-0132",
                "notes": "Demand ordered, rush fee approved.",
            },
        ],
        "costs": {
            "title_fee": 925,
            "recording_fee": 210,
            "transfer_tax": 0,
            "settlement_fee": 625,
            "endorsements": 120,
        },
    },
]


CHECKLIST_RULES = {
    "refi": [
        "Order current payoff statement",
        "Confirm vesting matches existing deed of trust",
        "Verify release tracking for prior lien",
    ],
    "llc": [
        "Collect operating agreement",
        "Verify signer authority",
        "Request certificate of good standing",
    ],
    "trust": [
        "Collect trust certification",
        "Confirm trustee authority",
    ],
    "hoa_demand": ["Order HOA demand and resale package"],
    "lender_wire_review": ["Confirm lender wire instructions and funding cutoffs"],
    "lender_entity_review": ["Send entity package to lender for approval"],
}


def next_file_number() -> str:
    year = date.today().year
    sequences = []
    for item in TRANSACTIONS:
        parts = str(item.get("file_number", "")).split("-")
        if len(parts) == 2 and parts[1] == str(year) and parts[0].isdigit():
            sequences.append(int(parts[0]))
    return f"{(max(sequences) if sequences else 0) + 1}-{year}"


def build_checklist(transaction: Dict) -> List[Dict]:
    """Create a deduplicated checklist from transaction attributes and rules."""
    items = []
    seen = set()

    for rule in transaction.get("rules", []):
        for task in CHECKLIST_RULES.get(rule, []):
            if task not in seen:
                seen.add(task)
                items.append(
                    {
                        "task": task,
                        "status": "done" if transaction["progress"] > 75 else "open",
                        "source": rule.replace("_", " ").title(),
                    }
                )

    for doc in transaction.get("missing_docs", []):
        task = f"Collect missing document: {doc}"
        if task not in seen:
            items.append({"task": task, "status": "open", "source": "Missing Docs"})

    return items


def calculate_costs(payload: Dict) -> Dict:
    """Estimate closing costs with simple, transparent demo formulas."""
    loan_amount = float(payload.get("loan_amount", 0))
    state = str(payload.get("state", "")).upper()
    is_refi = payload.get("loan_type", "").lower() == "refinance"

    title_fee = max(650, round(loan_amount * 0.0019, 2))
    settlement_fee = 695 if is_refi else 795
    recording_fee = 225 if is_refi else 340
    endorsements = round(loan_amount * 0.00028, 2)
    transfer_tax = 0 if is_refi else round(loan_amount * (0.001 if state in {"CO", "AZ"} else 0.002), 2)

    total = title_fee + settlement_fee + recording_fee + endorsements + transfer_tax
    return {
        "title_fee": title_fee,
        "settlement_fee": settlement_fee,
        "recording_fee": recording_fee,
        "endorsements": endorsements,
        "transfer_tax": transfer_tax,
        "total": round(total, 2),
    }


@app.get("/api/transactions")
def list_transactions():
    return jsonify(TRANSACTIONS)


@app.post("/api/transactions")
def create_transaction():
    data = request.get_json(force=True)
    new_transaction = {
        "id": max(item["id"] for item in TRANSACTIONS) + 1,
        "file_number": next_file_number(),
        "borrower": data.get("borrower", "New Borrower"),
        "seller": data.get("seller", "Seller pending"),
        "purchase_price": float(data.get("purchasePrice", data.get("purchase_price", 0))),
        "property": data.get("property", "Property address pending"),
        "property_type": data.get("property_type", "Residential"),
        "county": data.get("county", "County pending"),
        "loan_type": data.get("loan_type", "Purchase"),
        "loan_amount": float(data.get("loan_amount", 0)),
        "lender": data.get("lender", "Lender pending"),
        "entity_type": data.get("entity_type", "Individual"),
        "stage": "Intake",
        "progress": 12,
        "closing_date": data.get("closing_date", date.today().isoformat()),
        "escrow_officer": data.get("escrow_officer", "Unassigned"),
        "missing_docs": data.get("missing_docs", []),
        "rules": data.get("rules", []),
        "documents": data.get("documents", ["Open order sheet", "Title commitment"]),
        "contacts": data.get(
            "contacts",
            [
                {
                    "id": int(f"{max(item['id'] for item in TRANSACTIONS) + 1}01"),
                    "name": data.get("borrower", "New Borrower"),
                    "company": "Self",
                    "role": "Buyer",
                    "email": "pending@example.com",
                    "phone": "Pending",
                    "notes": "Created from order intake.",
                }
            ],
        ),
        "costs": calculate_costs(data),
    }
    TRANSACTIONS.insert(0, new_transaction)
    return jsonify(new_transaction), 201


@app.get("/api/transactions/<int:transaction_id>/checklist")
def get_checklist(transaction_id: int):
    transaction = next((item for item in TRANSACTIONS if item["id"] == transaction_id), None)
    if transaction is None:
        return jsonify({"error": "Transaction not found"}), 404
    return jsonify(build_checklist(transaction))


@app.post("/api/costs/calculate")
def get_cost_estimate():
    return jsonify(calculate_costs(request.get_json(force=True)))


@app.post("/api/email/generate")
def generate_email():
    data = request.get_json(force=True)
    email_type = data.get("type", "missing_docs")
    borrower = data.get("borrower", "Borrower")
    property_address = data.get("property", "the subject property")
    lender = data.get("lender", "your lending team")
    missing_docs = data.get("missing_docs", [])

    templates = {
        "payoff": {
            "subject": f"Payoff Request - {borrower}",
            "body": (
                f"Hello,\n\nPlease provide an updated payoff statement for {borrower} "
                f"secured by {property_address}. Please include the good-through date, "
                "per diem, wire instructions, and any release tracking requirements.\n\nThank you,\nTitleFlow Team"
            ),
        },
        "lender_request": {
            "subject": f"Lender Requirements - {property_address}",
            "body": (
                f"Hello {lender},\n\nWe are preparing title and closing for {property_address}. "
                "Please confirm final closing instructions, funding cutoff times, and any lender-specific endorsements "
                "needed before docs are released.\n\nBest,\nTitleFlow Team"
            ),
        },
        "missing_docs": {
            "subject": f"Missing Documents - {borrower}",
            "body": (
                f"Hello {borrower},\n\nWe are finalizing the file for {property_address}. "
                f"Please send the following items: {', '.join(missing_docs) or 'the remaining requested documents'}.\n\n"
                "Thank you,\nTitleFlow Team"
            ),
        },
        "utility_assessment": {
            "subject": f"Utility and Assessment Request - {property_address}",
            "body": (
                f"Hello,\n\nPlease provide current utility, HOA, assessment, and municipal balance "
                f"information for {property_address}. Please include payoff instructions, statement "
                "expiration dates, and any transfer requirements.\n\nThank you,\nTitleFlow Team"
            ),
        },
        "hoa_request": {
            "subject": f"HOA Request - {property_address}",
            "body": (
                f"Hello,\n\nPlease provide HOA demand, resale package, transfer fees, assessment status, "
                f"and payment instructions for {property_address}.\n\nThank you,\nTitleFlow Team"
            ),
        },
        "insurance_invoice": {
            "subject": f"Insurance Invoice Request - {borrower}",
            "body": (
                f"Hello,\n\nPlease provide the current insurance invoice or binder for {borrower} "
                f"at {property_address}. Please include the mortgagee clause for {lender} and any "
                "premium due at closing.\n\nThank you,\nTitleFlow Team"
            ),
        },
    }
    return jsonify(templates.get(email_type, templates["missing_docs"]))


if __name__ == "__main__":
    app.run(debug=True, port=5000)
