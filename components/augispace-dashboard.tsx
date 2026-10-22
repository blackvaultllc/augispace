"use client";

import { useCallback, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  FileJson,
  FileSpreadsheet,
  FileText,
  FolderUp,
  Gauge,
  LockKeyhole,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";

type MatrixRow = Record<string, unknown>;

type IntakeRecord = {
  id: string;
  name: string;
  size: number;
  status: "Parsed" | "Rejected";
  message: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".json", ".csv", ".txt"];

const initialStatuses = [
  { name: "Input validation", detail: "Waiting for source data", state: "Pending" },
  { name: "Data integrity", detail: "No dataset loaded", state: "Pending" },
  { name: "Compliance review", detail: "Review notices before operational use", state: "Review" },
  { name: "Optimization engine", detail: "Local preview only", state: "Standby" },
];

function parseCSV(source: string): MatrixRow[] {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error("CSV must contain a header row and at least one data row.");
  }

  function splitRow(line: string): string[] {
    const cells: string[] = [];
    let value = "";
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"' && quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        cells.push(value.trim());
        value = "";
      } else {
        value += char;
      }
    }

    if (quoted) throw new Error("CSV contains an unclosed quoted field.");
    cells.push(value.trim());
    return cells;
  }

  const headers = splitRow(lines[0]);

  if (headers.some((header) => !header)) {
    throw new Error("Every CSV column needs a header.");
  }

  if (new Set(headers).size !== headers.length) {
    throw new Error("CSV column headers must be unique.");
  }

  return lines.slice(1).map((line, index) => {
    const cells = splitRow(line);

    if (cells.length !== headers.length) {
      throw new Error(`Row ${index + 2} has ${cells.length} cells; expected ${headers.length}.`);
    }

    return Object.fromEntries(headers.map((header, i) => [header, cells[i]]));
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function safePreview(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function AugispaceDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [records, setRecords] = useState<IntakeRecord[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [notice, setNotice] = useState("Select a JSON or CSV file to begin.");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [region, setRegion] = useState("Unspecified region");

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setError("");
    setNotice("");
    setBusy(true);

    const incoming = Array.from(files);
    const nextRecords: IntakeRecord[] = [];
    const parsedRows: MatrixRow[] = [];
    const messages: string[] = [];

    for (const file of incoming) {
      const id = `${file.name}-${file.lastModified}-${file.size}`;
      const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

      if (!ACCEPTED_EXTENSIONS.includes(extension)) {
        nextRecords.push({
          id, name: file.name, size: file.size, status: "Rejected",
          message: "Unsupported type. Use JSON, CSV, or TXT.",
        });
        messages.push(`${file.name}: unsupported file type.`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        nextRecords.push({
          id, name: file.name, size: file.size, status: "Rejected",
          message: "File exceeds the 10 MB limit.",
        });
        messages.push(`${file.name}: file exceeds 10 MB.`);
        continue;
      }

      if (file.size === 0) {
        nextRecords.push({
          id, name: file.name, size: file.size, status: "Rejected",
          message: "File is empty.",
        });
        messages.push(`${file.name}: file is empty.`);
        continue;
      }

      try {
        const text = await file.text();
        let rows: MatrixRow[];

        if (extension === ".json") {
          const parsed: unknown = JSON.parse(text);
          const items = Array.isArray(parsed) ? parsed : [parsed];

          if (items.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
            throw new Error("JSON must contain an object or an array of objects.");
          }

          rows = items as MatrixRow[];
        } else if (extension === ".csv") {
          rows = parseCSV(text);
        } else {
          rows = text.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => ({
            line: index + 1,
            value: line,
          }));
        }

        parsedRows.push(...rows);
        nextRecords.push({
          id, name: file.name, size: file.size, status: "Parsed",
          message: `${rows.length} row(s) parsed locally.`,
        });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Could not parse this file.";
        nextRecords.push({ id, name: file.name, size: file.size, status: "Rejected", message });
        messages.push(`${file.name}: ${message}`);
      }
    }

    setRecords((previous) => [...previous, ...nextRecords]);
    if (parsedRows.length) {
      setMatrix((previous) => [...previous, ...parsedRows]);
      setNotice(`${parsedRows.length} row(s) added to the local data matrix.`);
    } else {
      setNotice("No new rows were added.");
    }
    if (messages.length) setError(messages.join(" "));
    setBusy(false);

    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const parsedCount = records.filter((record) => record.status === "Parsed").length;
  const rejectedCount = records.filter((record) => record.status === "Rejected").length;
  const columns = Array.from(new Set(matrix.flatMap((row) => Object.keys(row)))).slice(0, 8);
  const latestRows = matrix.slice(-8).reverse();

  const statuses = initialStatuses.map((item, index) => {
    if (index === 0 && matrix.length > 0) {
      return { ...item, detail: `${matrix.length} row(s) validated for preview`, state: "Ready" };
    }
    if (index === 1 && matrix.length > 0) {
      return { ...item, detail: `${columns.length} visible field(s) detected`, state: "Ready" };
    }
    return item;
  });

  return (
    <main className="min-h-screen bg-[#05090d] text-slate-200">
      <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-4 border-b border-teal-400/20 pb-5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-teal-300">
              <ShieldCheck size={16} /> AUGI / Operations
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Intelligence Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Local data intake · analytics preview · compliance monitoring
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-emerald-400/25 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300 sm:self-auto">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            LOCAL SESSION ACTIVE
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<FileText size={18} />} label="FILES PROCESSED" value={String(parsedCount)} detail="Successfully parsed" />
          <Metric icon={<Activity size={18} />} label="DATA ROWS" value={String(matrix.length)} detail="Current local matrix" />
          <Metric icon={<AlertTriangle size={18} />} label="REJECTED FILES" value={String(rejectedCount)} detail="Type, size, or parsing errors" />
          <Metric icon={<Gauge size={18} />} label="FIELD COVERAGE" value={matrix.length ? `${columns.length}` : "—"} detail="Distinct visible fields · max 8 shown" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="rounded-xl border border-teal-400/20 bg-[#081117] p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <SectionLabel>01 / DOCUMENT INTAKE</SectionLabel>
                <h2 className="mt-2 text-lg font-semibold text-white">Secure intake controls</h2>
                <p className="mt-1 text-sm text-slate-400">Validated local file selection and parsing</p>
              </div>
              <LockKeyhole className="text-teal-300" size={20} />
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
              onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
              onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                void processFiles(event.dataTransfer.files);
              }}
              className={`flex min-h-48 w-full flex-col items-center justify-center rounded-lg border border-dashed px-5 py-8 text-center transition ${
                dragActive
                  ? "border-teal-300 bg-teal-300/10"
                  : "border-slate-600 bg-[#050b10] hover:border-teal-400/60 hover:bg-teal-400/[0.03]"
              }`}
            >
              <span className="mb-3 rounded-xl border border-teal-400/25 bg-teal-400/10 p-3 text-teal-300">
                <FolderUp size={25} />
              </span>
              <span className="font-medium text-white">Drop files here or browse</span>
              <span className="mt-2 text-xs text-slate-400">JSON · CSV · TXT · Maximum 10 MB per file</span>
              <span className="mt-4 flex items-center gap-2 text-xs text-teal-300">
                <Upload size={14} /> Select documents
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".json,.csv,.txt,application/json,text/csv,text/plain"
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.length) void processFiles(event.target.files);
              }}
            />

            <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-400">
              <CircleHelp size={15} className="mt-0.5 shrink-0" />
              Files are read in your browser and are not sent to a server by this component.
              Avoid selecting sensitive documents on a shared device.
            </div>

            {busy && <p className="mt-3 text-sm text-teal-300">Processing files locally…</p>}
            {notice && <p role="status" className="mt-3 text-sm text-teal-200">{notice}</p>}
            {error && <p role="alert" className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-sm text-amber-200">{error}</p>}

            <div className="mt-5 space-y-2">
              {records.slice(-5).reverse().map((record) => (
                <div key={record.id} className="flex items-start gap-3 rounded-lg border border-white/5 bg-black/20 p-3">
                  {record.status === "Parsed"
                    ? <FileSpreadsheet className="mt-0.5 shrink-0 text-emerald-400" size={17} />
                    : <XCircle className="mt-0.5 shrink-0 text-rose-400" size={17} />}
                  <div className="min-w-0 flex-1">
                    <p className="break-all text-sm text-slate-200">{record.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatSize(record.size)} · {record.message}</p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider ${record.status === "Parsed" ? "text-emerald-300" : "text-rose-300"}`}>
                    {record.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-teal-400/20 bg-[#081117] p-5">
            <SectionLabel>02 / ANALYTICS</SectionLabel>
            <h2 className="mt-2 text-lg font-semibold text-white">Data overview</h2>
            <p className="mt-1 text-sm text-slate-400">Calculated from the current browser session</p>

            <div className="mt-5 rounded-lg border border-white/5 bg-[#050b10] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-300">Ingestion trend</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-500">Latest 8 rows</span>
              </div>
              {latestRows.length ? (
                <div className="mt-4 space-y-3">
                  {latestRows.map((row, index) => {
                    const width = Math.max(8, ((index + 1) / latestRows.length) * 100);
                    return (
                      <div key={`trend-${matrix.length - index}`} className="flex items-center gap-3">
                        <span className="w-12 shrink-0 text-[10px] text-slate-500">ROW {matrix.length - index}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-teal-400/80" style={{ width: `${width}%` }} />
                        </div>
                        <span className="w-10 text-right text-[10px] text-slate-500">{Object.keys(row).length} fields</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-32 flex-col items-center justify-center text-center text-sm text-slate-500">
                  <Activity size={22} className="mb-2 text-slate-600" />
                  Import structured data to populate the trend preview.
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/5 bg-[#050b10] p-4">
                <p className="text-xs text-slate-400">Parse acceptance</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {records.length ? `${Math.round((parsedCount / records.length) * 100)}%` : "—"}
                </p>
                <p className="mt-1 text-xs text-slate-500">{parsedCount} accepted / {records.length} attempted</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-[#050b10] p-4">
                <p className="text-xs text-slate-400">Schema visibility</p>
                <p className="mt-2 text-2xl font-semibold text-white">{matrix.length ? `${columns.length}` : "—"}</p>
                <p className="mt-1 text-xs text-slate-500">Distinct fields detected</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-teal-400/20 bg-[#081117] p-5">
            <SectionLabel>03 / LOCAL STATE MATRIX</SectionLabel>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Parsed parameters</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMatrix([]);
                    setRecords([]);
                    setError("");
                    setNotice("Local matrix cleared.");
                  }}
                  disabled={!matrix.length && !records.length}
                  className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-rose-400/50 hover:text-rose-300 disabled:opacity-40"
                >
                  <Trash2 size={13} /> Clear session
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(matrix, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = "augi-local-matrix.json";
                    anchor.click();
                    URL.revokeObjectURL(url);
                  }}
                  disabled={!matrix.length}
                  className="rounded-md border border-teal-400/30 px-3 py-2 text-xs text-teal-200 hover:bg-teal-400/10 disabled:opacity-40"
                >
                  Export JSON
                </button>
              </div>
            </div>

            {matrix.length && columns.length ? (
              <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead className="bg-white/[0.04] text-slate-400">
                    <tr>
                      {columns.map((column) => <th key={column} className="px-3 py-3 font-medium">{column}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {latestRows.map((row, index) => (
                      <tr key={`data-${matrix.length - index}`} className="border-t border-white/5">
                        {columns.map((column) => (
                          <td key={column} className="max-w-48 truncate px-3 py-3 text-slate-300" title={safePreview(row[column])}>
                            {safePreview(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-white/5 px-3 py-2 text-[10px] text-slate-500">
                  Showing up to 8 recent rows and 8 columns. Data remains in component state.
                </p>
              </div>
            ) : (
              <div className="mt-4 flex min-h-36 items-center justify-center rounded-lg border border-dashed border-slate-700 text-sm text-slate-500">
                Your parsed matrix will appear here.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-teal-400/20 bg-[#081117] p-5">
            <SectionLabel>04 / OPTIMIZATION & COMPLIANCE</SectionLabel>
            <h2 className="mt-2 text-lg font-semibold text-white">Operational status</h2>
            <div className="mt-4 space-y-3">
              {statuses.map((item) => {
                const ready = item.state === "Ready";
                const review = item.state === "Review";
                return (
                  <div key={item.name} className="flex items-start gap-3 rounded-lg border border-white/5 bg-[#050b10] p-3">
                    {ready
                      ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" />
                      : review
                        ? <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
                        : <Activity size={18} className="mt-0.5 shrink-0 text-slate-500" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200">{item.name}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider ${ready ? "text-emerald-300" : review ? "text-amber-300" : "text-slate-500"}`}>
                      {item.state}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 border-t border-white/10 pt-4">
              <label htmlFor="region" className="text-xs font-medium uppercase tracking-widest text-slate-400">
                Regulatory region
              </label>
              <select
                id="region"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-[#050b10] px-3 py-3 text-sm text-slate-200 outline-none focus:border-teal-400"
              >
                <option>Unspecified region</option>
                <option>United States — Federal</option>
                <option>Alabama, United States</option>
                <option>European Union</option>
                <option>United Kingdom</option>
                <option>Other / custom region</option>
              </select>
              <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-200">
                  <ClipboardCheck size={17} /> Compliance scope notice
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Selected scope: <span className="text-slate-200">{region}</span>. This panel is a placeholder, not a legal determination. Applicable rules, deadlines, and requirements must be verified against authoritative regulatory sources for the actual activity and jurisdiction.
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-col justify-between gap-2 border-t border-white/10 pt-4 text-[10px] uppercase tracking-wider text-slate-500 sm:flex-row">
          <span>AUGI / Modular dashboard</span>
          <span>Browser-local preview · No server upload configured</span>
          <a href="/workspace" className="inline-flex items-center gap-1 text-teal-300 hover:text-teal-200">
            Return to workspace <ChevronRight size={12} />
          </a>
        </footer>
      </div>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-teal-300">{children}</p>;
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-teal-400/20 bg-[#081117] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold tracking-[0.18em] text-slate-400">{label}</span>
        <span className="text-teal-300">{icon}</span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
