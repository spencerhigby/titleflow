import {
  contactRoles,
  documentFolders,
  documentTemplate,
  sampleFiles,
  sampleTemplates,
} from "./data.js";

export function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    Number(value || 0),
  );
}

export function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function fullAddress(property) {
  return [property.address, property.city, property.state, property.zip].filter(Boolean).join(", ");
}

export function emptyContact() {
  return { id: null, role: "Buyer", name: "", company: "", email: "", phone: "", notes: "" };
}

export function emptyPayoff() {
  return {
    lender: "",
    phone: "",
    email: "",
    accountNumber: "",
    orderedStatus: "not ordered",
    goodThroughDate: "",
    amount: 0,
    notes: "",
  };
}

export function parseFileNumber(fileNumber) {
  const match = String(fileNumber || "").match(/^(\d+)-(\d{4})$/);
  if (!match) return null;
  return { sequence: Number(match[1]), year: Number(match[2]) };
}

export function getCurrentYear() {
  return new Date().getFullYear();
}

export function getFileYear(fileNumber) {
  return parseFileNumber(fileNumber)?.year || getCurrentYear();
}

export function nextFileNumber(files, year = getCurrentYear()) {
  const maxSequence = files.reduce((max, file) => {
    const parsed = parseFileNumber(file.fileNumber);
    if (!parsed || parsed.year !== year) return max;
    return Math.max(max, parsed.sequence);
  }, 0);
  return `${maxSequence + 1}-${year}`;
}

export function sortFiles(files) {
  return [...files].sort((a, b) => {
    const parsedA = parseFileNumber(a.fileNumber) || { sequence: 0, year: 0 };
    const parsedB = parseFileNumber(b.fileNumber) || { sequence: 0, year: 0 };
    if (parsedA.year !== parsedB.year) return parsedB.year - parsedA.year;
    return parsedB.sequence - parsedA.sequence;
  });
}

export function getFileYears(files) {
  return [...new Set(files.map((file) => getFileYear(file.fileNumber)))].sort((a, b) => b - a);
}

export function clampProgress(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

export function normalizeFile(file) {
  const closingDate = file.closingDate || file.closing_date || file.loan?.closingDate || file.loan?.closing_date || "";
  const loanAmount = Number(file.loan?.loanAmount || file.loan_amount || 0);
  const normalized = {
    id: file.id || Date.now(),
    fileNumber: file.fileNumber || file.file_number || `${file.id || 0}-${getCurrentYear()}`,
    borrower: file.borrower || "Borrower pending",
    seller: file.seller || "Seller pending",
    purchasePrice: Number(file.purchasePrice || file.purchase_price || 0),
    closingDate,
    status: file.status || file.stage || "Intake",
    progress: clampProgress(file.progress || 0),
    transactionType: file.transactionType || lowerLoanType(file.loan_type) || "purchase",
    entityType: file.entityType || file.entity_type || "individual",
    isConstruction: Boolean(file.isConstruction),
    property: normalizeProperty(file),
    loan: {
      lender: file.loan?.lender || file.lender || "",
      loanNumber: file.loan?.loanNumber || "",
      loanAmount,
      loanType: file.loan?.loanType || file.loan_type || "Conventional purchase",
      mortgageeClause: file.loan?.mortgageeClause || "",
      loanOfficer: file.loan?.loanOfficer || "",
      processor: file.loan?.processor || "",
      closingDate,
    },
    payoff: { ...emptyPayoff(), ...(file.payoff || {}) },
    contacts: (file.contacts || []).map(normalizeContact),
    documents: normalizeDocuments(file.documents),
    uploadedDocuments: normalizeUploadedDocuments(file.uploadedDocuments),
    checklistCompletions: file.checklistCompletions || {},
    emailDraft: file.emailDraft || null,
    titleCommitment: {},
    notes: file.notes || "",
  };
  normalized.isConstruction = normalized.isConstruction || normalized.transactionType === "construction";
  normalized.titleCommitment = {
    ...emptyTitleCommitment(normalized),
    ...(file.titleCommitment || {}),
  };
  return normalized;
}

export function normalizeFiles(files) {
  return sortFiles(migrateFileNumbers(files.map(normalizeFile)));
}

export function normalizeTemplates(templates) {
  return templates.map((template) => ({
    id: template.id || Date.now() + Math.random(),
    name: template.name || "Untitled template",
    type: template.type || "Email Template",
    description: template.description || "",
    body: template.body || "",
  }));
}

export function normalizeDocuments(documents = []) {
  const input = documents.map((document) =>
    typeof document === "string"
      ? { id: slug(document), name: document, complete: false, notes: "" }
      : { id: document.id || slug(document.name), name: document.name, complete: Boolean(document.complete), notes: document.notes || "" },
  );
  const byId = Object.fromEntries(input.map((document) => [document.id, document]));
  return documentTemplate.map((name) => byId[slug(name)] || { id: slug(name), name, complete: false, notes: "" });
}

export function createDocumentList(completedNames = []) {
  const completed = new Set(completedNames.map((name) => slug(name)));
  return documentTemplate.map((name) => ({ id: slug(name), name, complete: completed.has(slug(name)), notes: "" }));
}

export function normalizeUploadedDocuments(uploadedDocuments = []) {
  return uploadedDocuments.map((document) => ({
    id: document.id || Date.now() + Math.random(),
    name: document.name || "Uploaded document",
    folder: documentFolders.includes(document.folder) ? document.folder : "Other",
    uploadDate: document.uploadDate || new Date().toISOString(),
    size: Number(document.size || 0),
    type: document.type || "",
    contentBase64: document.contentBase64 || "",
  }));
}

export function buildChecklist(file) {
  const base = [
    ["Confirm vesting and borrower identity", "File opening"],
    ["Review title commitment requirements", "Title"],
    ["Verify lender closing instructions", "Lender"],
  ];

  if (file.transactionType === "purchase") {
    base.push(["Open escrow and confirm purchase contract terms", "Purchase"]);
    base.push(["Collect seller payoff or no-lien confirmation", "Purchase"]);
  }
  if (file.transactionType === "refinance") {
    base.push(["Order current payoff statement", "Refinance"]);
    base.push(["Confirm existing lien release requirements", "Refinance"]);
  }
  if (file.isConstruction || file.transactionType === "construction") {
    base.push(["Review construction draw and funding requirements", "Construction"]);
    base.push(["Confirm mechanic lien and endorsement requirements", "Construction"]);
  }
  if (["llc", "corporation", "partnership"].includes(String(file.entityType).toLowerCase())) {
    base.push(["Collect entity formation and authority documents", "Entity"]);
    base.push(["Verify signer authority", "Entity"]);
    base.push(["Request certificate of good standing", "Entity"]);
  }
  if (String(file.entityType).toLowerCase() === "trust") {
    base.push(["Collect trust certification", "Entity"]);
    base.push(["Confirm trustee authority", "Entity"]);
  }
  if (file.loan.lender) {
    base.push([`Confirm mortgagee clause for ${file.loan.lender}`, "Lender"]);
    base.push(["Send lender package request", "Lender"]);
  }
  if (file.payoff.lender || file.transactionType === "refinance") {
    base.push(["Confirm payoff good-through date and per diem", "Payoff"]);
    base.push(["Track release requirements for paid lien", "Payoff"]);
  }

  return base.map(([task, source]) => ({
    task,
    source,
    complete: Boolean(file.checklistCompletions?.[task]),
  }));
}

export function getMissingItemCount(file, checklist) {
  const missingDocuments = file.documents.filter((document) => !document.complete).length;
  const missingChecklist = checklist.filter((item) => !item.complete).length;
  return missingDocuments + missingChecklist;
}

export function calculateClosingCosts(file) {
  const loanAmount = Number(file.loan.loanAmount || 0);
  const transferBase = Number(file.purchasePrice || loanAmount);
  const isRefi = file.transactionType === "refinance";
  const isConstruction = file.transactionType === "construction" || file.isConstruction;
  const titleFee = Math.max(650, loanAmount * 0.0019);
  const settlementFee = isRefi ? 695 : 795;
  const recordingFee = isRefi ? 225 : 340;
  const endorsements = loanAmount * (isConstruction ? 0.00042 : 0.00028);
  const transferTax = isRefi ? 0 : transferBase * (["CO", "AZ"].includes(String(file.property.state).toUpperCase()) ? 0.001 : 0.002);
  const wireCourier = 85;
  const total = titleFee + settlementFee + recordingFee + endorsements + transferTax + wireCourier;
  return { titleFee, settlementFee, recordingFee, endorsements, transferTax, wireCourier, total };
}

export function buildEmailDraft(file, type) {
  const address = fullAddress(file.property);
  const missingDocs = file.documents.filter((document) => !document.complete).map((document) => document.name);
  const templates = {
    payoff: {
      subject: `Payoff request - ${file.fileNumber} - ${file.borrower}`,
      body: `Hello,\n\nPlease provide an updated payoff statement for ${file.borrower} on account ${file.payoff.accountNumber || "TBD"} secured by ${address}. Please include the good-through date, per diem, wire instructions, release requirements, and any fees needed for closing.\n\nFile: ${file.fileNumber}\nClosing date: ${file.closingDate || "Pending"}\n\nThank you,\nTitleFlow Team`,
    },
    lender_package: {
      subject: `Lender package request - ${file.fileNumber}`,
      body: `Hello,\n\nWe are preparing ${file.fileNumber} for ${file.borrower}. Please send final lender closing instructions, mortgagee clause confirmation, funding conditions, and any required title endorsements for ${address}.\n\nLoan number: ${file.loan.loanNumber || "Pending"}\nLoan amount: ${money(file.loan.loanAmount)}\nClosing date: ${file.closingDate || "Pending"}\n\nBest,\nTitleFlow Team`,
    },
    missing_documents: {
      subject: `Missing documents - ${file.fileNumber}`,
      body: `Hello,\n\nWe are finalizing ${file.fileNumber} for ${address}. Please send the following open items:\n\n${missingDocs.map((doc) => `- ${doc}`).join("\n") || "- No document items are currently marked missing"}\n\nThank you,\nTitleFlow Team`,
    },
    utility_assessment: {
      subject: `Utility and assessment request - ${file.fileNumber}`,
      body: `Hello,\n\nPlease provide current utility, municipal balance, assessment, and transfer information for ${address}. We are preparing settlement for ${file.borrower} with an expected closing date of ${file.closingDate || "TBD"}.\n\nThank you,\nTitleFlow Team`,
    },
    hoa_request: {
      subject: `HOA request - ${file.fileNumber}`,
      body: `Hello,\n\nPlease provide HOA demand, resale package, transfer fees, assessment status, and payment instructions for ${address} in ${file.property.county || "the"} County.\n\nFile: ${file.fileNumber}\nClosing date: ${file.closingDate || "Pending"}\n\nThank you,\nTitleFlow Team`,
    },
    insurance_invoice: {
      subject: `Insurance invoice request - ${file.fileNumber}`,
      body: `Hello,\n\nPlease provide the current insurance invoice or binder for ${file.borrower} at ${address}. Please include the mortgagee clause for ${file.loan.lender || "the lender"} and any premium due at closing.\n\nThank you,\nTitleFlow Team`,
    },
  };
  return { type, ...(templates[type] || templates.missing_documents) };
}

export function buildCommitmentSummary(file) {
  const commitment = file.titleCommitment;
  return [
    "TITLEFLOW TITLE COMMITMENT SUMMARY",
    "",
    "SCHEDULE A",
    `File Number: ${file.fileNumber}`,
    `Commitment Effective Date: ${commitment.effectiveDate || "Pending"}`,
    `Property Address: ${fullAddress(file.property)}`,
    `County: ${file.property.county || "Pending"}`,
    `Purchase Price: ${money(file.purchasePrice)}`,
    `Loan Amount: ${money(file.loan.loanAmount)}`,
    "",
    "PROPOSED INSURED",
    commitment.proposedInsured || file.loan.lender || "Pending",
    "",
    "POLICY AMOUNT",
    money(commitment.policyAmount),
    "",
    "VESTING",
    commitment.vestingOwner || file.property.vesting || "Pending",
    "",
    "LEGAL DESCRIPTION",
    commitment.legalDescription || file.property.legalDescription || "Pending",
    "",
    "TAX PARCEL",
    commitment.taxParcelNumber || file.property.parcelId || "Pending",
    "",
    "REQUIREMENTS",
    commitment.requirements || "No requirements entered",
    "",
    "EXCEPTIONS",
    commitment.exceptions || "No exceptions entered",
    "",
    "NOTES",
    commitment.notes || "No notes entered",
  ].join("\n");
}

export function applyTemplate(template, file) {
  const data = buildMergeData(file);
  return Object.entries(data).reduce((body, [key, value]) => body.replaceAll(`{{${key}}}`, value), template.body || "");
}

export function buildMergeData(file) {
  return {
    fileNumber: file.fileNumber,
    borrower: file.borrower,
    seller: file.seller,
    propertyAddress: fullAddress(file.property),
    county: file.property.county || "",
    purchasePrice: money(file.purchasePrice),
    loanAmount: money(file.loan.loanAmount),
    lender: file.loan.lender || "",
    closingDate: file.closingDate || "",
    loanNumber: file.loan.loanNumber || "",
    vesting: file.property.vesting || "",
    legalDescription: file.property.legalDescription || "",
    taxParcel: file.property.parcelId || "",
    todayDate: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date()),
  };
}

export async function fileToUploadedDocument(file, folder) {
  const contentBase64 = file.size <= 1500000 ? await readFileAsDataUrl(file) : "";
  return {
    id: Date.now() + Math.random(),
    name: file.name,
    folder,
    uploadDate: new Date().toISOString(),
    size: file.size,
    type: file.type || "Unknown type",
    contentBase64,
  };
}

export function formatFileSize(size) {
  const bytes = Number(size || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateTime(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatTime(value) {
  if (!value) return "now";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(value);
}

export function groupContactsByRole(contacts) {
  const groups = {};
  contactRoles.forEach((role) => {
    groups[role] = [];
  });
  contacts.forEach((contact) => {
    const role = contactRoles.includes(contact.role) ? contact.role : "Other";
    groups[role].push(contact);
  });
  return groups;
}

export function filterFiles(files, search, yearFilter) {
  const value = search.trim().toLowerCase();
  return sortFiles(files).filter((file) => {
    const matchesYear = yearFilter === "all" || String(getFileYear(file.fileNumber)) === String(yearFilter);
    if (!matchesYear) return false;
    if (!value) return true;
    return [
      file.fileNumber,
      file.borrower,
      file.seller,
      file.loan.lender,
      file.property.address,
      file.property.city,
      file.property.state,
      file.property.county,
      file.status,
      ...file.contacts.map((contact) => contact.name),
    ]
      .join(" ")
      .toLowerCase()
      .includes(value);
  });
}

export function loadFiles(storageKey) {
  try {
    const stored = localStorage.getItem(storageKey) || localStorage.getItem("titleflow.files.v2");
    if (!stored) return normalizeFiles(sampleFiles);
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length ? normalizeFiles(parsed) : normalizeFiles(sampleFiles);
  } catch {
    return normalizeFiles(sampleFiles);
  }
}

export function loadTemplates(storageKey) {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return normalizeTemplates(sampleTemplates);
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length ? normalizeTemplates(parsed) : normalizeTemplates(sampleTemplates);
  } catch {
    return normalizeTemplates(sampleTemplates);
  }
}

export function emptyTemplate() {
  return {
    id: null,
    name: "",
    type: "Email Template",
    description: "",
    body: "",
  };
}

function normalizeProperty(file) {
  if (typeof file.property === "string") {
    return {
      address: file.property,
      city: "",
      state: "",
      zip: "",
      county: file.county || "",
      parcelId: "",
      legalDescription: "",
      vesting: "",
      occupancyType: "",
    };
  }
  return {
    address: file.property?.address || "Property address pending",
    city: file.property?.city || "",
    state: file.property?.state || "",
    zip: file.property?.zip || "",
    county: file.property?.county || file.county || "",
    parcelId: file.property?.parcelId || "",
    legalDescription: file.property?.legalDescription || "",
    vesting: file.property?.vesting || "",
    occupancyType: file.property?.occupancyType || "",
  };
}

function normalizeContact(contact) {
  const role = contactRoles.includes(contact.role) ? contact.role : titleCaseRole(contact.role);
  return {
    ...emptyContact(),
    ...contact,
    id: contact.id || Date.now() + Math.random(),
    role: contactRoles.includes(role) ? role : "Other",
  };
}

function emptyTitleCommitment(file) {
  return {
    effectiveDate: "",
    proposedInsured: file.loan?.lender || "",
    policyAmount: Number(file.loan?.loanAmount || file.purchasePrice || 0),
    vestingOwner: file.property?.vesting || file.borrower || "",
    legalDescription: file.property?.legalDescription || "",
    taxParcelNumber: file.property?.parcelId || "",
    existingLiens: file.payoff?.lender ? `${file.payoff.lender} - ${file.payoff.accountNumber || "account pending"}` : "",
    requirements: defaultCommitmentRequirements(file),
    exceptions: "Taxes and assessments not yet due and payable.\nEasements, covenants, conditions, and restrictions of record.",
    notes: "",
    generatedSummary: "",
  };
}

function defaultCommitmentRequirements(file) {
  const requirements = [
    "Satisfactory closing instructions and settlement authorization.",
    "Executed deed and recordable closing documents.",
    "Payment of all taxes, assessments, and closing charges.",
  ];
  if (["llc", "corporation", "partnership"].includes(String(file.entityType).toLowerCase())) {
    requirements.push("Evidence of entity authority and good standing.");
  }
  if (file.transactionType === "refinance") {
    requirements.push("Current payoff statement and release tracking for existing deed of trust.");
  }
  if (file.isConstruction || file.transactionType === "construction") {
    requirements.push("Construction loan requirements, draw instructions, and lien coverage approval.");
  }
  return requirements.join("\n");
}

function migrateFileNumbers(files) {
  const currentYear = getCurrentYear();
  const counters = {};
  files.forEach((file) => {
    const parsed = parseFileNumber(file.fileNumber);
    if (!parsed) return;
    counters[parsed.year] = Math.max(counters[parsed.year] || 0, parsed.sequence);
  });
  return files.map((file) => {
    if (parseFileNumber(file.fileNumber)) return file;
    counters[currentYear] = (counters[currentYear] || 0) + 1;
    return { ...file, fileNumber: `${counters[currentYear]}-${currentYear}` };
  });
}

function lowerLoanType(value) {
  if (!value) return "";
  const lower = String(value).toLowerCase();
  if (lower.includes("refi")) return "refinance";
  if (lower.includes("construction")) return "construction";
  return "purchase";
}

function titleCaseRole(role) {
  return String(role || "")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}
