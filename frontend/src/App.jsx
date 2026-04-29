import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Calculator,
  CheckCircle2,
  Copy,
  FileText,
  Mail,
  PanelLeft,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  contactRoles,
  documentFolders,
  mergeFields,
  STORAGE_KEY,
  TEMPLATE_STORAGE_KEY,
  templateTypes,
  workspaceTabs,
} from "./data.js";
import {
  applyTemplate,
  buildChecklist,
  buildCommitmentSummary,
  buildEmailDraft,
  calculateClosingCosts,
  clampProgress,
  createDocumentList,
  emptyContact,
  emptyPayoff,
  emptyTemplate,
  fileToUploadedDocument,
  filterFiles,
  formatDateTime,
  formatFileSize,
  formatTime,
  fullAddress,
  getCurrentYear,
  getFileYears,
  getMissingItemCount,
  groupContactsByRole,
  loadFiles,
  loadTemplates,
  money,
  nextFileNumber,
  normalizeFile,
  normalizeTemplates,
} from "./utils.js";

function App() {
  const [files, setFiles] = useState(() => loadFiles(STORAGE_KEY));
  const [templates, setTemplates] = useState(() => loadTemplates(TEMPLATE_STORAGE_KEY));
  const [activeFileId, setActiveFileId] = useState(files[0]?.id || 1);
  const [activeView, setActiveView] = useState("dashboard");
  const [activeTab, setActiveTab] = useState("Overview");
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [autosavedAt, setAutosavedAt] = useState(null);
  const [isNewFileOpen, setNewFileOpen] = useState(false);
  const [newFileDraft, setNewFileDraft] = useState(emptyNewFileDraft());
  const [contactDraft, setContactDraft] = useState(emptyContact());
  const [editingContactId, setEditingContactId] = useState(null);
  const [contactSearch, setContactSearch] = useState("");
  const [calculatorDraft, setCalculatorDraft] = useState(null);
  const [templateDraft, setTemplateDraft] = useState(emptyTemplate());
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templatePreview, setTemplatePreview] = useState("");
  const [templatePicker, setTemplatePicker] = useState(null);

  const activeFile = files.find((file) => file.id === activeFileId) || files[0];
  const years = useMemo(() => getFileYears(files), [files]);
  const filteredFiles = useMemo(() => filterFiles(files, search, yearFilter), [files, search, yearFilter]);
  const checklist = useMemo(() => buildChecklist(activeFile), [activeFile]);
  const missingItems = getMissingItemCount(activeFile, checklist);
  const calculatorResult = calculateClosingCosts(calculatorDraft || activeFile);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
    setAutosavedAt(new Date());
  }, [files]);

  useEffect(() => {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    setCalculatorDraft(null);
    setContactDraft(emptyContact());
    setEditingContactId(null);
    setContactSearch("");
  }, [activeFileId]);

  function updateActiveFile(updater) {
    setFiles((current) =>
      current.map((file) => {
        if (file.id !== activeFile.id) return file;
        return normalizeFile(typeof updater === "function" ? updater(file) : { ...file, ...updater });
      }),
    );
  }

  function openFile(fileId, tab = "Overview") {
    setActiveFileId(fileId);
    setActiveView("workspace");
    setActiveTab(tab);
  }

  function createFile(event) {
    event.preventDefault();
    const year = getCurrentYear();
    const nextId = Math.max(0, ...files.map((file) => Number(file.id) || 0)) + 1;
    const newFile = normalizeFile({
      id: nextId,
      fileNumber: nextFileNumber(files, year),
      borrower: newFileDraft.borrower,
      seller: newFileDraft.seller,
      purchasePrice: Number(newFileDraft.purchasePrice),
      closingDate: newFileDraft.closingDate,
      status: "Intake",
      progress: 8,
      transactionType: newFileDraft.transactionType,
      entityType: "individual",
      isConstruction: newFileDraft.transactionType === "construction",
      property: {
        address: newFileDraft.propertyAddress,
        city: "",
        state: "",
        zip: "",
        county: newFileDraft.county,
        parcelId: "",
        legalDescription: "",
        vesting: "",
        occupancyType: "",
      },
      loan: {
        lender: newFileDraft.lender,
        loanNumber: "",
        loanAmount: Number(newFileDraft.loanAmount),
        loanType: newFileDraft.transactionType,
        mortgageeClause: "",
        loanOfficer: "",
        processor: "",
        closingDate: newFileDraft.closingDate,
      },
      payoff: emptyPayoff(),
      contacts: [],
      documents: createDocumentList([]),
      uploadedDocuments: [],
      checklistCompletions: {},
      emailDraft: null,
      titleCommitment: {},
      notes: "",
    });
    setFiles((current) => [newFile, ...current]);
    setActiveFileId(newFile.id);
    setYearFilter(String(year));
    setActiveView("workspace");
    setActiveTab("Overview");
    setNewFileDraft(emptyNewFileDraft());
    setNewFileOpen(false);
  }

  function saveContact(event) {
    event.preventDefault();
    const saved = { ...contactDraft, id: editingContactId || Date.now() };
    updateActiveFile((file) => ({
      ...file,
      contacts: editingContactId
        ? file.contacts.map((contact) => (contact.id === editingContactId ? saved : contact))
        : [saved, ...file.contacts],
    }));
    setEditingContactId(null);
    setContactDraft(emptyContact());
  }

  function editContact(contact) {
    setEditingContactId(contact.id);
    setContactDraft(contact);
  }

  function updateContactDraft(field, value) {
    const nextDraft = { ...contactDraft, [field]: value };
    setContactDraft(nextDraft);
    if (!editingContactId) return;
    updateActiveFile((file) => ({
      ...file,
      contacts: file.contacts.map((contact) => (contact.id === editingContactId ? nextDraft : contact)),
    }));
  }

  function deleteContact(contactId) {
    updateActiveFile((file) => ({ ...file, contacts: file.contacts.filter((contact) => contact.id !== contactId) }));
    if (editingContactId === contactId) {
      setEditingContactId(null);
      setContactDraft(emptyContact());
    }
  }

  function toggleDocument(documentId) {
    updateActiveFile((file) => ({
      ...file,
      documents: file.documents.map((document) =>
        document.id === documentId ? { ...document, complete: !document.complete } : document,
      ),
    }));
  }

  function updateDocumentNote(documentId, notes) {
    updateActiveFile((file) => ({
      ...file,
      documents: file.documents.map((document) => (document.id === documentId ? { ...document, notes } : document)),
    }));
  }

  async function uploadDocuments(folder, fileList) {
    const selected = Array.from(fileList || []);
    if (!selected.length) return;
    const uploaded = await Promise.all(selected.map((file) => fileToUploadedDocument(file, folder)));
    updateActiveFile((file) => ({ ...file, uploadedDocuments: [...uploaded, ...file.uploadedDocuments] }));
  }

  function removeUploadedDocument(documentId) {
    updateActiveFile((file) => ({
      ...file,
      uploadedDocuments: file.uploadedDocuments.filter((document) => document.id !== documentId),
    }));
  }

  function toggleChecklistItem(task) {
    updateActiveFile((file) => ({
      ...file,
      checklistCompletions: { ...file.checklistCompletions, [task]: !file.checklistCompletions[task] },
    }));
  }

  function generateEmail(type) {
    updateActiveFile((file) => ({ ...file, emailDraft: buildEmailDraft(file, type) }));
    if (activeView === "workspace") setActiveTab("Emails");
  }

  function updateEmailDraft(field, value) {
    updateActiveFile((file) => ({
      ...file,
      emailDraft: { type: "custom", subject: "", body: "", ...file.emailDraft, [field]: value },
    }));
  }

  function applyTemplateToFile(template) {
    const output = applyTemplate(template, activeFile);
    if (templatePicker === "email") {
      const [maybeSubject, ...body] = output.split("\n\n");
      updateActiveFile((file) => ({
        ...file,
        emailDraft: {
          type: "template",
          subject: maybeSubject.replace(/^Subject:\s*/i, "") || template.name,
          body: body.join("\n\n") || output,
        },
      }));
      setActiveTab("Emails");
    }
    if (templatePicker === "title") {
      updateActiveFile((file) => ({
        ...file,
        titleCommitment: { ...file.titleCommitment, generatedSummary: output },
      }));
      setActiveTab("Title Commitment");
    }
    setTemplatePreview(output);
  }

  function saveTemplate(event) {
    event.preventDefault();
    const saved = { ...templateDraft, id: editingTemplateId || Date.now() };
    setTemplates((current) =>
      editingTemplateId
        ? normalizeTemplates(current.map((template) => (template.id === editingTemplateId ? saved : template)))
        : normalizeTemplates([saved, ...current]),
    );
    setTemplateDraft(emptyTemplate());
    setEditingTemplateId(null);
  }

  function editTemplate(template) {
    setEditingTemplateId(template.id);
    setTemplateDraft(template);
    setTemplatePreview(applyTemplate(template, activeFile));
  }

  function deleteTemplate(templateId) {
    setTemplates((current) => current.filter((template) => template.id !== templateId));
    if (editingTemplateId === templateId) {
      setEditingTemplateId(null);
      setTemplateDraft(emptyTemplate());
    }
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: PanelLeft },
    { id: "workspace", label: "File Workspace", icon: FileText },
    { id: "calculator", label: "Calculator", icon: Calculator },
    { id: "email", label: "Email Desk", icon: Mail },
    { id: "templates", label: "Templates", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-72 bg-[#0d2238] px-5 py-6 text-white shadow-2xl lg:block">
        <div className="flex items-center gap-3 px-1">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#d7aa4b] text-[#0d2238]">
            <ShieldCheck size={23} />
          </div>
          <div>
            <p className="text-xl font-semibold">TitleFlow</p>
            <p className="text-sm text-slate-300">Escrow operations</p>
          </div>
        </div>

        <nav className="mt-8 space-y-1">
          {navItems.map((item) => (
            <SidebarButton
              key={item.id}
              item={item}
              active={activeView === item.id}
              onClick={() => setActiveView(item.id)}
            />
          ))}
        </nav>

        <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase text-slate-300">Active file</p>
          <p className="mt-2 font-semibold">{activeFile.fileNumber}</p>
          <p className="mt-1 text-sm text-slate-300">{activeFile.borrower}</p>
          <Progress value={activeFile.progress} />
        </div>
      </aside>

      <main className="lg:ml-72">
        <header className="sticky top-0 z-30 border-b border-[#1b3a58] bg-[#0d2238]/95 px-5 py-4 shadow-lg backdrop-blur lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-[#d7aa4b]">TitleFlow workspace</p>
              <h1 className="text-2xl font-semibold text-white md:text-3xl">
                {activeView === "dashboard" ? "Dashboard" : activeView === "templates" ? "Templates" : activeFile.fileNumber}
              </h1>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <SearchBox value={search} onChange={setSearch} />
              <button className="primary-button" onClick={() => setNewFileOpen(true)}>
                <Plus size={18} /> New file
              </button>
            </div>
          </div>
        </header>

        <div className="px-5 py-6 lg:px-8">
          {activeView === "dashboard" && (
            <Dashboard
              files={filteredFiles}
              allFiles={files}
              years={years}
              yearFilter={yearFilter}
              setYearFilter={setYearFilter}
              search={search}
              activeFileId={activeFile.id}
              onOpenFile={openFile}
            />
          )}

          {activeView === "workspace" && (
            <FileWorkspace
              file={activeFile}
              checklist={checklist}
              missingItems={missingItems}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              updateFile={updateActiveFile}
              contactDraft={contactDraft}
              updateContactDraft={updateContactDraft}
              editingContactId={editingContactId}
              saveContact={saveContact}
              editContact={editContact}
              deleteContact={deleteContact}
              clearContact={() => {
                setEditingContactId(null);
                setContactDraft(emptyContact());
              }}
              contactSearch={contactSearch}
              setContactSearch={setContactSearch}
              toggleDocument={toggleDocument}
              updateDocumentNote={updateDocumentNote}
              uploadDocuments={uploadDocuments}
              removeUploadedDocument={removeUploadedDocument}
              toggleChecklistItem={toggleChecklistItem}
              generateEmail={generateEmail}
              updateEmailDraft={updateEmailDraft}
              calculatorResult={calculatorResult}
              autosavedAt={autosavedAt}
              openTemplatePicker={setTemplatePicker}
            />
          )}

          {activeView === "calculator" && (
            <CalculatorView
              file={activeFile}
              draft={calculatorDraft || activeFile}
              setDraft={setCalculatorDraft}
              result={calculatorResult}
            />
          )}

          {activeView === "email" && (
            <Panel title="Email Desk" action={<Mail size={18} />}>
              <EmailTab
                file={activeFile}
                generateEmail={generateEmail}
                updateEmailDraft={updateEmailDraft}
                openTemplatePicker={setTemplatePicker}
              />
            </Panel>
          )}

          {activeView === "templates" && (
            <TemplatesView
              templates={templates}
              activeFile={activeFile}
              draft={templateDraft}
              setDraft={setTemplateDraft}
              editingTemplateId={editingTemplateId}
              saveTemplate={saveTemplate}
              editTemplate={editTemplate}
              deleteTemplate={deleteTemplate}
              preview={templatePreview}
              setPreview={setTemplatePreview}
            />
          )}
        </div>
      </main>

      {isNewFileOpen && (
        <NewFileModal
          draft={newFileDraft}
          setDraft={setNewFileDraft}
          onSubmit={createFile}
          onClose={() => setNewFileOpen(false)}
        />
      )}

      {templatePicker && (
        <TemplatePicker
          context={templatePicker}
          templates={templates}
          activeFile={activeFile}
          preview={templatePreview}
          setPreview={setTemplatePreview}
          onApply={applyTemplateToFile}
          onClose={() => setTemplatePicker(null)}
        />
      )}
    </div>
  );
}

function Dashboard({ files, allFiles, years, yearFilter, setYearFilter, search, activeFileId, onOpenFile }) {
  const totals = useMemo(() => {
    const pipeline = allFiles.reduce((sum, file) => sum + Number(file.loan.loanAmount || 0), 0);
    const missing = allFiles.reduce((sum, file) => sum + getMissingItemCount(file, buildChecklist(file)), 0);
    const avgProgress = allFiles.length
      ? Math.round(allFiles.reduce((sum, file) => sum + Number(file.progress || 0), 0) / allFiles.length)
      : 0;
    return { pipeline, missing, avgProgress };
  }, [allFiles]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={FileText} label="Open files" value={allFiles.length} accent="bg-[#2d8f86]" />
        <MetricCard icon={Banknote} label="Loan pipeline" value={money(totals.pipeline)} accent="bg-[#d7aa4b]" />
        <MetricCard icon={CheckCircle2} label="Average progress" value={`${totals.avgProgress}%`} accent="bg-[#385f8f]" />
        <MetricCard icon={AlertCircle} label="Missing items" value={totals.missing} accent="bg-[#ba6b46]" />
      </section>

      <Panel
        title="Files and orders"
        action={
          <div className="flex items-center gap-3">
            <select className="mini-select" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
              <option value="all">All years</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <span className="status-pill">{search ? "Filtered" : "Sorted by year"}</span>
          </div>
        }
      >
        <div className="space-y-3">
          {files.map((file) => (
            <FileRow key={file.id} file={file} active={file.id === activeFileId} onClick={() => onOpenFile(file.id)} />
          ))}
          {files.length === 0 && (
            <EmptyState title="No files found" body="Try a different file number, party name, contact, lender, county, property, or status." />
          )}
        </div>
      </Panel>
    </div>
  );
}

function FileWorkspace(props) {
  const {
    file,
    checklist,
    missingItems,
    activeTab,
    setActiveTab,
    updateFile,
    calculatorResult,
    autosavedAt,
  } = props;

  return (
    <div className="space-y-6">
      <FileHeader file={file} missingItems={missingItems} autosavedAt={autosavedAt} />
      <Panel title="File workspace" action={<span className="status-pill status-gold">{file.status}</span>}>
        <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="mt-6">
          {activeTab === "Overview" && <OverviewTab file={file} updateFile={updateFile} calculatorResult={calculatorResult} />}
          {activeTab === "Property" && <PropertyTab file={file} updateFile={updateFile} />}
          {activeTab === "Contacts" && <ContactsTab {...props} />}
          {activeTab === "Loan" && <LoanTab file={file} updateFile={updateFile} />}
          {activeTab === "Payoffs" && <PayoffsTab file={file} updateFile={updateFile} />}
          {activeTab === "Documents" && <DocumentsTab {...props} />}
          {activeTab === "Checklist" && <ChecklistTab checklist={checklist} toggleChecklistItem={props.toggleChecklistItem} />}
          {activeTab === "Emails" && (
            <EmailTab
              file={file}
              generateEmail={props.generateEmail}
              updateEmailDraft={props.updateEmailDraft}
              openTemplatePicker={props.openTemplatePicker}
            />
          )}
          {activeTab === "Notes" && <NotesTab file={file} updateFile={updateFile} />}
          {activeTab === "Title Commitment" && (
            <TitleCommitmentTab file={file} updateFile={updateFile} openTemplatePicker={props.openTemplatePicker} />
          )}
        </div>
      </Panel>
    </div>
  );
}

function FileHeader({ file, missingItems, autosavedAt }) {
  return (
    <section className="sticky top-[89px] z-20 rounded-lg border border-slate-200 bg-white/95 p-5 shadow-panel backdrop-blur">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="status-pill status-navy">{file.fileNumber}</span>
            <span className="status-pill">{file.transactionType}</span>
            <span className="status-pill">{file.entityType}</span>
            <span className="status-pill status-teal">Autosaved {formatTime(autosavedAt)}</span>
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-[#0d2238]">{file.borrower}</h2>
          <p className="mt-2 text-slate-600">{fullAddress(file.property)}</p>
          <p className="mt-1 text-sm text-slate-500">Lender: {file.loan.lender || "Pending"}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px] xl:grid-cols-3">
          <InfoTile label="Purchase price" value={money(file.purchasePrice)} />
          <InfoTile label="Loan amount" value={money(file.loan.loanAmount)} />
          <InfoTile label="Closing date" value={file.closingDate || "Pending"} />
          <InfoTile label="Status" value={file.status} />
          <InfoTile label="Missing items" value={missingItems} />
          <div className="rounded-lg border border-slate-200 bg-[#f7faf9] p-4">
            <p className="text-sm text-slate-500">Progress</p>
            <p className="mt-1 font-semibold">{file.progress}%</p>
            <Progress value={file.progress} />
          </div>
        </div>
      </div>
    </section>
  );
}

function OverviewTab({ file, updateFile, calculatorResult }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="File number" value={file.fileNumber} onChange={(value) => updateFile({ fileNumber: value })} />
        <Field label="Borrower" value={file.borrower} onChange={(value) => updateFile({ borrower: value })} />
        <Field label="Seller" value={file.seller} onChange={(value) => updateFile({ seller: value })} />
        <Field label="Status" value={file.status} onChange={(value) => updateFile({ status: value })} />
        <Field label="Purchase price" type="number" value={file.purchasePrice} onChange={(value) => updateFile({ purchasePrice: Number(value) })} />
        <Field
          label="Closing date"
          type="date"
          value={file.closingDate}
          onChange={(value) => updateFile((current) => ({ ...current, closingDate: value, loan: { ...current.loan, closingDate: value } }))}
        />
        <Select
          label="Transaction type"
          value={file.transactionType}
          options={["purchase", "refinance", "construction"]}
          onChange={(value) => updateFile({ transactionType: value, isConstruction: value === "construction" })}
        />
        <Select
          label="Entity ownership"
          value={file.entityType}
          options={["individual", "LLC", "trust", "corporation", "partnership"]}
          onChange={(value) => updateFile({ entityType: value })}
        />
        <Field label="Progress" type="number" value={file.progress} onChange={(value) => updateFile({ progress: clampProgress(value) })} />
        <label className="checkbox-panel self-end">
          <input type="checkbox" checked={file.isConstruction} onChange={(event) => updateFile({ isConstruction: event.target.checked })} />
          <span>Construction file</span>
        </label>
      </div>
      <div className="rounded-lg border border-slate-200 bg-[#f7faf9] p-4">
        <p className="font-semibold text-[#0d2238]">Cost snapshot</p>
        <CostBreakdown costs={calculatorResult} />
      </div>
    </div>
  );
}

function PropertyTab({ file, updateFile }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Property address" value={file.property.address} onChange={(value) => updateNested(updateFile, "property", "address", value)} />
      <Field label="City" value={file.property.city} onChange={(value) => updateNested(updateFile, "property", "city", value)} />
      <Field label="State" value={file.property.state} onChange={(value) => updateNested(updateFile, "property", "state", value)} />
      <Field label="ZIP" value={file.property.zip} onChange={(value) => updateNested(updateFile, "property", "zip", value)} />
      <Field label="County" value={file.property.county} onChange={(value) => updateNested(updateFile, "property", "county", value)} />
      <Field label="Parcel/tax ID" value={file.property.parcelId} onChange={(value) => updateNested(updateFile, "property", "parcelId", value)} />
      <Field label="Vesting" value={file.property.vesting} onChange={(value) => updateNested(updateFile, "property", "vesting", value)} />
      <Field label="Occupancy type" value={file.property.occupancyType} onChange={(value) => updateNested(updateFile, "property", "occupancyType", value)} />
      <TextArea className="md:col-span-2" label="Legal description" value={file.property.legalDescription} onChange={(value) => updateNested(updateFile, "property", "legalDescription", value)} />
    </div>
  );
}

function ContactsTab({
  file,
  contactDraft,
  updateContactDraft,
  editingContactId,
  saveContact,
  editContact,
  deleteContact,
  clearContact,
  contactSearch,
  setContactSearch,
}) {
  const filteredContacts = file.contacts.filter((contact) =>
    [contact.role, contact.name, contact.company, contact.email, contact.phone]
      .join(" ")
      .toLowerCase()
      .includes(contactSearch.toLowerCase()),
  );
  const grouped = groupContactsByRole(filteredContacts);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
      <div className="space-y-4">
        <SearchBox value={contactSearch} onChange={setContactSearch} compact placeholder="Search contacts in this file" />
        {contactRoles.map((role) =>
          grouped[role]?.length ? (
            <section key={role}>
              <h3 className="section-kicker">{role}</h3>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                {grouped[role].map((contact) => (
                  <article key={contact.id} className="contact-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#0d2238]">{contact.name || "Unnamed contact"}</p>
                        <p className="text-sm text-slate-500">{contact.company || "Company pending"}</p>
                      </div>
                      <span className="badge">{contact.role}</span>
                    </div>
                    <div className="mt-4 space-y-1 text-sm text-slate-600">
                      <p>{contact.email || "Email pending"}</p>
                      <p>{contact.phone || "Phone pending"}</p>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">{contact.notes || "No notes yet."}</p>
                    <div className="mt-4 flex gap-2">
                      <button className="icon-button" onClick={() => editContact(contact)} title="Edit contact">
                        <Pencil size={16} />
                      </button>
                      <button className="icon-button" onClick={() => deleteContact(contact.id)} title="Remove contact">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null,
        )}
        {!filteredContacts.length && <EmptyState title="No contacts found" body="Add a contact or adjust the contact search." />}
      </div>

      <form className="form-panel" onSubmit={saveContact}>
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold text-[#0d2238]">{editingContactId ? "Edit contact" : "Add contact"}</p>
          {editingContactId && (
            <button className="secondary-button min-h-9 px-3" type="button" onClick={clearContact}>
              Cancel
            </button>
          )}
        </div>
        <div className="grid gap-3">
          <Select label="Role" value={contactDraft.role} options={contactRoles} onChange={(value) => updateContactDraft("role", value)} />
          <Field label="Name" value={contactDraft.name} onChange={(value) => updateContactDraft("name", value)} />
          <Field label="Company" value={contactDraft.company} onChange={(value) => updateContactDraft("company", value)} />
          <Field label="Email" type="email" value={contactDraft.email} onChange={(value) => updateContactDraft("email", value)} />
          <Field label="Phone" value={contactDraft.phone} onChange={(value) => updateContactDraft("phone", value)} />
          <TextArea label="Notes" value={contactDraft.notes} onChange={(value) => updateContactDraft("notes", value)} />
          <button className="primary-button" type="submit">
            <Save size={18} /> {editingContactId ? "Save changes" : "Save contact"}
          </button>
        </div>
      </form>
    </div>
  );
}

function LoanTab({ file, updateFile }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Lender" value={file.loan.lender} onChange={(value) => updateNested(updateFile, "loan", "lender", value)} />
      <Field label="Loan number" value={file.loan.loanNumber} onChange={(value) => updateNested(updateFile, "loan", "loanNumber", value)} />
      <Field label="Loan amount" type="number" value={file.loan.loanAmount} onChange={(value) => updateNested(updateFile, "loan", "loanAmount", Number(value))} />
      <Field label="Loan type" value={file.loan.loanType} onChange={(value) => updateNested(updateFile, "loan", "loanType", value)} />
      <Field label="Loan officer" value={file.loan.loanOfficer} onChange={(value) => updateNested(updateFile, "loan", "loanOfficer", value)} />
      <Field label="Processor" value={file.loan.processor} onChange={(value) => updateNested(updateFile, "loan", "processor", value)} />
      <Field
        label="Closing date"
        type="date"
        value={file.closingDate}
        onChange={(value) => updateFile((current) => ({ ...current, closingDate: value, loan: { ...current.loan, closingDate: value } }))}
      />
      <TextArea className="md:col-span-2" label="Mortgagee clause" value={file.loan.mortgageeClause} onChange={(value) => updateNested(updateFile, "loan", "mortgageeClause", value)} />
    </div>
  );
}

function PayoffsTab({ file, updateFile }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Payoff lender" value={file.payoff.lender} onChange={(value) => updateNested(updateFile, "payoff", "lender", value)} />
      <Field label="Payoff phone" value={file.payoff.phone} onChange={(value) => updateNested(updateFile, "payoff", "phone", value)} />
      <Field label="Payoff email" type="email" value={file.payoff.email} onChange={(value) => updateNested(updateFile, "payoff", "email", value)} />
      <Field label="Loan/account number" value={file.payoff.accountNumber} onChange={(value) => updateNested(updateFile, "payoff", "accountNumber", value)} />
      <Select label="Payoff ordered status" value={file.payoff.orderedStatus} options={["not ordered", "ordered", "received", "updated requested"]} onChange={(value) => updateNested(updateFile, "payoff", "orderedStatus", value)} />
      <Field label="Good-through date" type="date" value={file.payoff.goodThroughDate} onChange={(value) => updateNested(updateFile, "payoff", "goodThroughDate", value)} />
      <Field label="Payoff amount" type="number" value={file.payoff.amount} onChange={(value) => updateNested(updateFile, "payoff", "amount", Number(value))} />
      <TextArea label="Notes" value={file.payoff.notes} onChange={(value) => updateNested(updateFile, "payoff", "notes", value)} />
    </div>
  );
}

function DocumentsTab({ file, toggleDocument, updateDocumentNote, uploadDocuments, removeUploadedDocument, openTemplatePicker }) {
  const [dragFolder, setDragFolder] = useState("");
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#0d2238]">Document management</h3>
          <p className="text-sm text-slate-500">Upload, track, and organize file documents by operational folder.</p>
        </div>
        <button className="secondary-button" onClick={() => openTemplatePicker("document")}>
          <Sparkles size={18} /> Use Template
        </button>
      </div>

      <section>
        <h3 className="section-kicker">Required document checklist</h3>
        <div className="mt-3 space-y-3">
          {file.documents.map((document) => (
            <div key={document.id} className="document-row">
              <label className="flex min-w-56 items-center gap-3">
                <input type="checkbox" checked={document.complete} onChange={() => toggleDocument(document.id)} />
                <span className={document.complete ? "font-semibold text-slate-400 line-through" : "font-semibold"}>{document.name}</span>
              </label>
              <input className="input mt-0" value={document.notes} onChange={(event) => updateDocumentNote(document.id, event.target.value)} placeholder="Document notes" />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {documentFolders.map((folder) => {
          const folderDocuments = file.uploadedDocuments.filter((document) => document.folder === folder);
          return (
            <div
              key={folder}
              className={`document-folder ${dragFolder === folder ? "document-folder-active" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragFolder(folder);
              }}
              onDragLeave={() => setDragFolder("")}
              onDrop={(event) => {
                event.preventDefault();
                uploadDocuments(folder, event.dataTransfer.files);
                setDragFolder("");
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#0d2238]">{folder}</p>
                  <p className="text-sm text-slate-500">{folderDocuments.length} uploaded</p>
                </div>
                <label className="secondary-button cursor-pointer">
                  <Upload size={17} /> Upload
                  <input type="file" multiple className="hidden" onChange={(event) => uploadDocuments(folder, event.target.files)} />
                </label>
              </div>
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500">
                Drop documents here or use Upload.
              </div>
              <div className="mt-4 space-y-2">
                {folderDocuments.map((document) => (
                  <div key={document.id} className="uploaded-document-row">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#0d2238]">{document.name}</p>
                      <p className="text-sm text-slate-500">
                        {document.type || "Unknown type"} - {formatFileSize(document.size)} - {formatDateTime(document.uploadDate)}
                      </p>
                    </div>
                    <button className="icon-button" onClick={() => removeUploadedDocument(document.id)} title="Remove document">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {!folderDocuments.length && <p className="rounded-lg bg-white p-4 text-sm text-slate-500">No uploads in this folder yet.</p>}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function ChecklistTab({ checklist, toggleChecklistItem }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-[#f7faf9] p-4">
        <p className="font-semibold text-[#0d2238]">{checklist.filter((item) => !item.complete).length} open checklist items</p>
        <p className="text-sm text-slate-500">Generated from transaction type, lender, entity, payoff, and construction status.</p>
      </div>
      {checklist.map((item) => (
        <label key={item.task} className="checklist-row">
          <input type="checkbox" checked={item.complete} onChange={() => toggleChecklistItem(item.task)} />
          <div>
            <p className={item.complete ? "font-semibold text-slate-400 line-through" : "font-semibold text-[#0d2238]"}>{item.task}</p>
            <p className="text-sm text-slate-500">{item.source}</p>
          </div>
        </label>
      ))}
    </div>
  );
}

function EmailTab({ file, generateEmail, updateEmailDraft, openTemplatePicker }) {
  const [copyStatus, setCopyStatus] = useState("");
  const draft = file.emailDraft || {
    subject: "No draft generated yet",
    body: "Choose a draft type or template to generate a file-specific email.",
  };

  async function copyDraft() {
    await copyText(`${draft.subject}\n\n${draft.body}`, setCopyStatus);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="form-panel">
        <p className="font-semibold text-[#0d2238]">Generate draft</p>
        <div className="mt-4 grid gap-2">
          <button className="chip-button" onClick={() => generateEmail("payoff")}>Payoff request</button>
          <button className="chip-button" onClick={() => generateEmail("lender_package")}>Lender package request</button>
          <button className="chip-button" onClick={() => generateEmail("missing_documents")}>Missing documents request</button>
          <button className="chip-button" onClick={() => generateEmail("utility_assessment")}>Utility/assessment request</button>
          <button className="chip-button" onClick={() => generateEmail("hoa_request")}>HOA request</button>
          <button className="chip-button" onClick={() => generateEmail("insurance_invoice")}>Insurance invoice request</button>
          <button className="secondary-button" onClick={() => openTemplatePicker("email")}>
            <Sparkles size={18} /> Use Template
          </button>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-[#0d2238]">Draft editor</p>
          <button className="secondary-button" onClick={copyDraft}>
            <Copy size={18} /> Copy to Clipboard
          </button>
        </div>
        {copyStatus && <p className="text-sm font-semibold text-[#2d8f86]">{copyStatus}</p>}
        <Field label="Subject" value={draft.subject} onChange={(value) => updateEmailDraft("subject", value)} />
        <TextArea label="Email body" value={draft.body} onChange={(value) => updateEmailDraft("body", value)} rows={15} />
      </div>
    </div>
  );
}

function NotesTab({ file, updateFile }) {
  return <TextArea label="Internal file notes" value={file.notes} onChange={(value) => updateFile({ notes: value })} rows={16} />;
}

function TitleCommitmentTab({ file, updateFile, openTemplatePicker }) {
  const [copyStatus, setCopyStatus] = useState("");
  const commitment = file.titleCommitment;

  function updateCommitment(field, value) {
    updateFile((current) => ({ ...current, titleCommitment: { ...current.titleCommitment, [field]: value } }));
  }

  function generateSummary() {
    updateCommitment("generatedSummary", buildCommitmentSummary(file));
    setCopyStatus("Summary generated");
  }

  function resetDraft() {
    updateFile((current) => ({ ...current, titleCommitment: normalizeFile({ ...current, titleCommitment: {} }).titleCommitment }));
    setCopyStatus("Draft reset");
  }

  async function copySummary() {
    await copyText(commitment.generatedSummary || buildCommitmentSummary(file), setCopyStatus);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_430px]">
      <div className="space-y-5">
        <CommitmentSection title="Schedule A">
          <Field label="Commitment effective date" type="date" value={commitment.effectiveDate} onChange={(value) => updateCommitment("effectiveDate", value)} />
          <Field label="Tax Parcel" value={commitment.taxParcelNumber} onChange={(value) => updateCommitment("taxParcelNumber", value)} />
        </CommitmentSection>
        <CommitmentSection title="Proposed Insured">
          <Field label="Proposed insured" value={commitment.proposedInsured} onChange={(value) => updateCommitment("proposedInsured", value)} />
          <Field label="Policy Amount" type="number" value={commitment.policyAmount} onChange={(value) => updateCommitment("policyAmount", Number(value))} />
        </CommitmentSection>
        <CommitmentSection title="Vesting">
          <Field label="Vesting / owner" value={commitment.vestingOwner} onChange={(value) => updateCommitment("vestingOwner", value)} />
        </CommitmentSection>
        <CommitmentSection title="Legal Description">
          <TextArea label="Legal description" value={commitment.legalDescription} onChange={(value) => updateCommitment("legalDescription", value)} />
        </CommitmentSection>
        <CommitmentSection title="Requirements">
          <TextArea label="Requirements" value={commitment.requirements} onChange={(value) => updateCommitment("requirements", value)} rows={7} />
        </CommitmentSection>
        <CommitmentSection title="Exceptions">
          <TextArea label="Exceptions" value={commitment.exceptions} onChange={(value) => updateCommitment("exceptions", value)} rows={7} />
        </CommitmentSection>
        <CommitmentSection title="Notes">
          <TextArea label="Notes" value={commitment.notes} onChange={(value) => updateCommitment("notes", value)} />
        </CommitmentSection>
      </div>

      <div className="form-panel">
        <div className="flex flex-wrap gap-2">
          <button className="primary-button" onClick={generateSummary}>
            <FileText size={18} /> Generate Commitment Summary
          </button>
          <button className="secondary-button" onClick={copySummary}>
            <Copy size={18} /> Copy to Clipboard
          </button>
          <button className="secondary-button" onClick={resetDraft}>Reset Draft</button>
          <button className="secondary-button" onClick={() => openTemplatePicker("title")}>
            <Sparkles size={18} /> Use Template
          </button>
        </div>
        {copyStatus && <p className="mt-3 text-sm font-semibold text-[#2d8f86]">{copyStatus}</p>}
        <pre className="mt-4 max-h-[680px] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 font-sans text-sm leading-6 text-slate-700">
          {commitment.generatedSummary || buildCommitmentSummary(file)}
        </pre>
      </div>
    </div>
  );
}

function CalculatorView({ file, draft, setDraft, result }) {
  const source = draft || file;
  return (
    <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
      <Panel title="Calculator inputs" action={<Calculator size={18} />}>
        <div className="grid gap-4">
          <Field label="Purchase price" type="number" value={source.purchasePrice} onChange={(value) => setDraft(normalizeFile({ ...source, purchasePrice: Number(value) }))} />
          <Field label="Loan amount" type="number" value={source.loan.loanAmount} onChange={(value) => setDraft(normalizeFile({ ...source, loan: { ...source.loan, loanAmount: Number(value) } }))} />
          <Select label="Transaction type" value={source.transactionType} options={["purchase", "refinance", "construction"]} onChange={(value) => setDraft(normalizeFile({ ...source, transactionType: value, isConstruction: value === "construction" }))} />
          <Field label="State" value={source.property.state} onChange={(value) => setDraft(normalizeFile({ ...source, property: { ...source.property, state: value } }))} />
          <button className="secondary-button" onClick={() => setDraft(null)}>Use active file data</button>
        </div>
      </Panel>
      <Panel title={`Closing cost estimate for ${file.fileNumber}`}>
        <CostBreakdown costs={result} />
      </Panel>
    </div>
  );
}

function TemplatesView({ templates, activeFile, draft, setDraft, editingTemplateId, saveTemplate, editTemplate, deleteTemplate, preview, setPreview }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const visibleTemplates = templates.filter((template) => typeFilter === "all" || template.type === typeFilter);

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Panel title={editingTemplateId ? "Edit template" : "Create template"} action={<Sparkles size={18} />}>
        <form className="grid gap-4" onSubmit={saveTemplate}>
          <Field label="Template name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
          <Select label="Template type" value={draft.type} options={templateTypes} onChange={(value) => setDraft({ ...draft, type: value })} />
          <TextArea label="Description" value={draft.description} onChange={(value) => setDraft({ ...draft, description: value })} />
          <TextArea label="Template body/content" value={draft.body} onChange={(value) => setDraft({ ...draft, body: value })} rows={12} />
          <div className="rounded-lg border border-slate-200 bg-[#f7faf9] p-3">
            <p className="text-sm font-semibold text-[#0d2238]">Available merge fields</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {mergeFields.map((field) => (
                <button key={field} type="button" className="merge-chip" onClick={() => setDraft({ ...draft, body: `${draft.body}${draft.body ? "\n" : ""}${field}` })}>
                  {field}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="primary-button" type="submit">
              <Save size={18} /> Save template
            </button>
            {editingTemplateId && (
              <button className="secondary-button" type="button" onClick={() => setDraft(emptyTemplate())}>
                Clear
              </button>
            )}
          </div>
        </form>
      </Panel>

      <div className="space-y-6">
        <Panel
          title="Template library"
          action={
            <select className="mini-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">All types</option>
              {templateTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            {visibleTemplates.map((template) => (
              <article key={template.id} className="template-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#0d2238]">{template.name}</p>
                    <p className="text-sm text-slate-500">{template.type}</p>
                  </div>
                  <span className="badge">{template.type.replace(" Template", "")}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{template.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="secondary-button min-h-9 px-3" onClick={() => setPreview(applyTemplate(template, activeFile))}>Preview</button>
                  <button className="icon-button" onClick={() => editTemplate(template)} title="Edit template"><Pencil size={16} /></button>
                  <button className="icon-button" onClick={() => deleteTemplate(template.id)} title="Delete template"><Trash2 size={16} /></button>
                </div>
              </article>
            ))}
          </div>
        </Panel>
        <Panel title="Merged preview" action={<button className="secondary-button" onClick={() => copyText(preview, () => {})}><Copy size={18} /> Copy</button>}>
          <pre className="min-h-64 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 font-sans text-sm leading-6 text-slate-700">
            {preview || "Select Preview on a template to merge it with the active file."}
          </pre>
        </Panel>
      </div>
    </div>
  );
}

function TemplatePicker({ context, templates, activeFile, preview, setPreview, onApply, onClose }) {
  const [copyStatus, setCopyStatus] = useState("");
  const allowedTypes =
    context === "email"
      ? ["Email Template"]
      : context === "title"
        ? ["Title Commitment Template", "Document Template"]
        : ["Document Template", "Email Template", "Title Commitment Template"];
  const visible = templates.filter((template) => allowedTypes.includes(template.type));

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-5xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <p className="text-sm font-semibold uppercase text-[#2d8f86]">Use Template</p>
            <h2 className="text-xl font-semibold text-[#0d2238]">Apply a saved template</h2>
          </div>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-[360px_1fr]">
          <div className="space-y-3">
            {visible.map((template) => (
              <button key={template.id} className="template-list-button" onClick={() => setPreview(applyTemplate(template, activeFile))}>
                <span className="font-semibold">{template.name}</span>
                <span className="text-sm text-slate-500">{template.type}</span>
                <span className="mt-3 text-left text-xs text-slate-500">{template.description}</span>
                <span className="mt-3 inline-flex text-sm font-semibold text-[#2d8f86]" onClick={(event) => { event.stopPropagation(); onApply(template); }}>
                  Apply to file
                </span>
              </button>
            ))}
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-semibold text-[#0d2238]">Preview</p>
              <button className="secondary-button" onClick={() => copyText(preview, setCopyStatus)}>
                <Copy size={18} /> Copy to Clipboard
              </button>
            </div>
            {copyStatus && <p className="mb-3 text-sm font-semibold text-[#2d8f86]">{copyStatus}</p>}
            <pre className="min-h-[420px] whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-sans text-sm leading-6 text-slate-700">
              {preview || "Select a template to preview merged content."}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewFileModal({ draft, setDraft, onSubmit, onClose }) {
  return (
    <div className="modal-backdrop">
      <form className="modal-panel max-w-3xl" onSubmit={onSubmit}>
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <p className="text-sm font-semibold uppercase text-[#2d8f86]">New File</p>
            <h2 className="text-xl font-semibold text-[#0d2238]">Open a title/escrow file</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Borrower" value={draft.borrower} onChange={(value) => setDraft({ ...draft, borrower: value })} required />
          <Field label="Seller" value={draft.seller} onChange={(value) => setDraft({ ...draft, seller: value })} required />
          <Field label="Property address" value={draft.propertyAddress} onChange={(value) => setDraft({ ...draft, propertyAddress: value })} required />
          <Field label="County" value={draft.county} onChange={(value) => setDraft({ ...draft, county: value })} required />
          <Select label="Transaction type" value={draft.transactionType} options={["purchase", "refinance", "construction"]} onChange={(value) => setDraft({ ...draft, transactionType: value })} />
          <Field label="Purchase price" type="number" value={draft.purchasePrice} onChange={(value) => setDraft({ ...draft, purchasePrice: value })} required />
          <Field label="Loan amount" type="number" value={draft.loanAmount} onChange={(value) => setDraft({ ...draft, loanAmount: value })} required />
          <Field label="Lender" value={draft.lender} onChange={(value) => setDraft({ ...draft, lender: value })} required />
          <Field label="Closing date" type="date" value={draft.closingDate} onChange={(value) => setDraft({ ...draft, closingDate: value })} required />
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit"><Plus size={18} /> Open file</button>
        </div>
      </form>
    </div>
  );
}

function SidebarButton({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button onClick={onClick} className={`nav-item ${active ? "nav-item-active" : ""}`}>
      <Icon size={18} />
      <span>{item.label}</span>
    </button>
  );
}

function FileRow({ file, active, onClick }) {
  const missingItems = getMissingItemCount(file, buildChecklist(file));
  return (
    <button onClick={onClick} className={`file-row ${active ? "file-row-active" : ""}`}>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-[#0d2238]">{file.fileNumber}</p>
          <span className="badge">{file.status}</span>
          <span className="badge">{file.transactionType}</span>
        </div>
        <p className="mt-2 truncate text-sm font-medium text-slate-700">{file.borrower}</p>
        <p className="truncate text-sm text-slate-500">{fullAddress(file.property)}</p>
        <Progress value={file.progress} />
      </div>
      <div className="text-right">
        <p className="font-semibold text-[#0d2238]">{file.loan.lender || "Lender pending"}</p>
        <p className="text-sm text-slate-500">Price {money(file.purchasePrice)}</p>
        <p className="text-sm text-slate-500">Loan {money(file.loan.loanAmount)}</p>
        <p className="mt-2 text-xs font-semibold text-[#ba6b46]">{missingItems} missing</p>
      </div>
    </button>
  );
}

function SearchBox({ value, onChange, compact = false, placeholder = "Search file number, borrower, seller, lender, property, county, status, contacts" }) {
  return (
    <label className={`search-box ${compact ? "w-full" : "md:w-[520px]"}`}>
      <Search size={18} className="text-slate-400" />
      <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder={placeholder} />
    </label>
  );
}

function TabBar({ activeTab, setActiveTab }) {
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
      {workspaceTabs.map((tab) => (
        <button key={tab} onClick={() => setActiveTab(tab)} className={`tab-button ${activeTab === tab ? "tab-button-active" : ""}`}>
          {tab}
        </button>
      ))}
    </div>
  );
}

function CommitmentSection({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="section-kicker">{title}</h3>
      <div className="mt-3 grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`grid h-10 w-10 place-items-center rounded-lg ${accent} text-white`}>
        <Icon size={20} />
      </div>
      <p className="mt-4 text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#0d2238]">{value}</p>
    </div>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-[#0d2238]">{title}</h2>
        {action && <div className="shrink-0 text-slate-500">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-[#0d2238]">{value || "Pending"}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <input className="input" type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <select className="input" value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange, className = "", rows = 4 }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <textarea className="input min-h-24 pt-3" rows={rows} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Progress({ value }) {
  return (
    <div className="mt-3 h-2 rounded-full bg-slate-200/80">
      <div className="h-2 rounded-full bg-[#2d8f86]" style={{ width: `${clampProgress(value)}%` }} />
    </div>
  );
}

function CostBreakdown({ costs = {} }) {
  const rows = [
    ["Title fee", costs.titleFee],
    ["Settlement fee", costs.settlementFee],
    ["Recording fee", costs.recordingFee],
    ["Endorsements", costs.endorsements],
    ["Transfer tax", costs.transferTax],
    ["Wire / courier", costs.wireCourier],
  ];
  return (
    <div className="mt-4 max-w-xl space-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <span className="text-slate-500">{label}</span>
          <span className="font-medium text-[#0d2238]">{money(value)}</span>
        </div>
      ))}
      <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 font-semibold">
        <span>Total</span>
        <span>{money(costs.total)}</span>
      </div>
    </div>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <p className="font-semibold text-[#0d2238]">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{body}</p>
    </div>
  );
}

function updateNested(updateFile, section, field, value) {
  updateFile((file) => ({ ...file, [section]: { ...file[section], [field]: value } }));
}

function emptyNewFileDraft() {
  return {
    borrower: "",
    seller: "",
    propertyAddress: "",
    county: "",
    transactionType: "purchase",
    purchasePrice: "",
    loanAmount: "",
    lender: "",
    closingDate: "",
  };
}

async function copyText(text, setStatus) {
  try {
    await navigator.clipboard.writeText(text || "");
    setStatus("Copied");
  } catch {
    setStatus("Copy unavailable");
  }
}

export default App;
