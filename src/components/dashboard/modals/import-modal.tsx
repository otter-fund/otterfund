"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, Check, ChevronDown } from "lucide-react";
import { gqlClient, gqlUpload, errMessage } from "@/lib/graphql/client";

const PARSE_STATEMENT = /* GraphQL */ `
  mutation ParseStatement($file: File!) {
    parseStatement(file: $file)
  }
`;

const CONFIRM_IMPORT = /* GraphQL */ `
  mutation ConfirmImport($input: ConfirmImportInput!) {
    confirmImport(input: $input)
  }
`;

type Step = "upload" | "mapping" | "processing" | "review" | "done";

interface ParsedTransaction {
  name: string;
  amount: number;
  date: string;
}

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

export function ImportModal({ open, onClose, onImported }: ImportModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [statementIds, setStatementIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  // CSV mapping
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState({ date: 0, name: 1, amount: 2 });

  // Parsed transactions
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [importCount, setImportCount] = useState(0);

  const reset = useCallback(() => {
    setStep("upload");
    setFiles([]);
    setStatementIds([]);
    setError("");
    setHeaders([]);
    setAllRows([]);
    setSampleRows([]);
    setTransactions([]);
    setImportCount(0);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.toLowerCase().endsWith(".csv") || f.name.toLowerCase().endsWith(".pdf")
    );
    if (dropped.length) setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setError("");
    setStep("processing");

    try {
      const allParsed: ParsedTransaction[] = [];
      const ids: string[] = [];
      let csvData: { headers: string[]; sampleRows: string[][]; allRows: string[][] } | null = null;

      for (const f of files) {
        const { parseStatement: data } = await gqlUpload(
          PARSE_STATEMENT,
          { file: null },
          [{ path: "variables.file", file: f }],
        );
        ids.push(data.statementId);

        if (data.fileType === "pdf") {
          allParsed.push(...data.transactions);
        } else if (!csvData) {
          // Use the first CSV for column mapping
          csvData = { headers: data.headers, sampleRows: data.sampleRows, allRows: data.allRows };
        } else {
          // Merge subsequent CSV rows
          csvData.allRows.push(...data.allRows);
        }
      }

      setStatementIds(ids);

      if (csvData) {
        setHeaders(csvData.headers);
        setSampleRows(csvData.sampleRows);
        setAllRows(csvData.allRows);

        const lowerHeaders = csvData.headers.map((h: string) => h.toLowerCase());
        const dateIdx = lowerHeaders.findIndex(
          (h: string) =>
            h.includes("date") || h.includes("time") || h.includes("posted")
        );
        const nameIdx = lowerHeaders.findIndex(
          (h: string) =>
            h.includes("desc") ||
            h.includes("name") ||
            h.includes("merchant") ||
            h.includes("memo")
        );
        const amountIdx = lowerHeaders.findIndex(
          (h: string) =>
            h.includes("amount") ||
            h.includes("total") ||
            h.includes("value")
        );

        setColumnMap({
          date: dateIdx >= 0 ? dateIdx : 0,
          name: nameIdx >= 0 ? nameIdx : 1,
          amount: amountIdx >= 0 ? amountIdx : 2,
        });

        // If we also had PDF transactions, pre-populate
        if (allParsed.length) setTransactions(allParsed);
        setStep("mapping");
      } else {
        setTransactions(allParsed);
        setStep("review");
      }
    } catch (e) {
      setError(errMessage(e));
      setStep("upload");
    }
  };

  const handleMapping = () => {
    const parsed: ParsedTransaction[] = allRows
      .map((row) => {
        const rawAmount = row[columnMap.amount]?.replace(/[$,]/g, "");
        const amount = parseFloat(rawAmount);
        if (isNaN(amount)) return null;

        return {
          date: row[columnMap.date] || new Date().toISOString().split("T")[0],
          name: row[columnMap.name] || "Unknown",
          amount,
        };
      })
      .filter((t): t is ParsedTransaction => t !== null);

    setTransactions(parsed);
    setStep("review");
  };

  const handleConfirm = async () => {
    setStep("processing");
    setError("");

    try {
      const { confirmImport: data } = await gqlClient.request(CONFIRM_IMPORT, {
        input: { statementId: statementIds[0], transactions },
      });
      setImportCount(data.imported);
      setStep("done");
      onImported?.();
    } catch (e) {
      setError(errMessage(e));
      setStep("review");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[560px] p-6 sm:p-9">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-[-0.02em] text-[var(--color-bk-ink)]">
            Import Transactions
          </DialogTitle>
        </DialogHeader>

        {/* Upload Step */}
        {step === "upload" && (
          <div className="mt-4 space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-[var(--color-bk-line)] rounded-2xl p-8 text-center cursor-pointer hover:border-[var(--color-primary)] transition-colors"
              onClick={() =>
                document.getElementById("file-input")?.click()
              }
            >
              <Upload className="w-8 h-8 mx-auto text-[var(--color-bk-muted)] mb-3" />
              <p className="text-sm font-medium text-[var(--color-bk-ink)]">
                {files.length
                  ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
                  : "Drop CSV or PDF files here"}
              </p>
              <p className="text-xs text-[var(--color-bk-muted)] mt-1">
                or click to browse (multiple files supported)
              </p>
              <input
                id="file-input"
                type="file"
                accept=".csv,.pdf"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            {files.length > 0 && (
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto bk-scroll">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-[oklch(98%_0.004_90)] border border-[var(--color-bk-line)]"
                  >
                    <FileText className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                    <span className="text-sm flex-1 truncate max-w-[280px] text-[var(--color-bk-ink)]">{f.name}</span>
                    <span className="text-xs text-[var(--color-bk-muted)] shrink-0">
                      {(f.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="text-xs text-[var(--color-bk-muted)] hover:text-[var(--color-bk-clay)] shrink-0 ml-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {error && (
              <p className="text-sm text-[var(--color-bk-clay)] font-medium">{error}</p>
            )}
            <Button size="sm" onClick={handleUpload} disabled={!files.length} className="w-full">
              Upload & Parse
            </Button>
          </div>
        )}

        {/* Column Mapping Step */}
        {step === "mapping" && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-[var(--color-bk-muted)]">
              Map the columns to the right fields:
            </p>
            {["date", "name", "amount"].map((field) => (
              <div key={field}>
                <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1.5">
                  {field === "name" ? "Description" : field}
                </label>
                <div className="relative">
                  <select
                    value={columnMap[field as keyof typeof columnMap]}
                    onChange={(e) =>
                      setColumnMap((m) => ({
                        ...m,
                        [field]: Number(e.target.value),
                      }))
                    }
                    className="bk-field-select"
                  >
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--color-bk-muted)]" />
                </div>
              </div>
            ))}

            {/* Preview */}
            <div className="overflow-x-auto">
              <p className="text-xs text-[var(--color-bk-muted)] mb-1.5">Preview (first 3 rows):</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--color-bk-muted)]">
                    <th className="text-left py-1">Date</th>
                    <th className="text-left py-1">Description</th>
                    <th className="text-right py-1">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-t border-[var(--color-bk-line)]">
                      <td className="py-1">{row[columnMap.date]}</td>
                      <td className="py-1">{row[columnMap.name]}</td>
                      <td className="py-1 text-right">
                        {row[columnMap.amount]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2.5">
              <Button variant="ghost" size="sm" onClick={() => setStep("upload")} className="flex-1">
                Back
              </Button>
              <Button size="sm" onClick={handleMapping} className="flex-[2]">
                Parse {allRows.length} Transactions
              </Button>
            </div>
          </div>
        )}

        {/* Processing Step */}
        {step === "processing" && (
          <div className="mt-4 flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin mb-4" />
            <p className="text-sm font-medium text-[var(--color-bk-ink)]">
              Processing your statement...
            </p>
            <p className="text-xs text-[var(--color-bk-muted)] mt-1">
              AI is categorizing your transactions
            </p>
          </div>
        )}

        {/* Review Step */}
        {step === "review" && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-[var(--color-bk-muted)]">
              Found {transactions.length} transactions. Review and confirm:
            </p>
            <div className="max-h-[300px] overflow-y-auto bk-scroll space-y-1">
              {transactions.map((tx, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-[oklch(98%_0.004_90)] border border-[var(--color-bk-line)]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-[var(--color-bk-ink)]">{tx.name}</p>
                    <p className="text-xs text-[var(--color-bk-muted)]">{tx.date}</p>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      tx.amount >= 0 ? "text-[var(--color-primary)]" : "text-[var(--color-bk-ink)]"
                    }`}
                  >
                    {tx.amount >= 0 ? "+" : "-"}$
                    {Math.abs(tx.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            {error && (
              <p className="text-sm text-[var(--color-bk-clay)] font-medium">{error}</p>
            )}
            <div className="flex gap-2.5">
              <Button variant="ghost" size="sm" onClick={() => setStep("upload")} className="flex-1">
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirm} className="flex-[2]">
                Import {transactions.length} Transactions
              </Button>
            </div>
          </div>
        )}

        {/* Done Step */}
        {step === "done" && (
          <div className="mt-4 flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full bg-[var(--color-primary)]/12 flex items-center justify-center mb-4">
              <Check className="w-6 h-6 text-[var(--color-primary)]" />
            </div>
            <p className="text-lg font-semibold tracking-[-0.02em] text-[var(--color-bk-ink)]">All done!</p>
            <p className="text-sm text-[var(--color-bk-muted)] mt-1">
              {importCount} transactions imported and categorized
            </p>
            <Button size="sm" onClick={handleClose} className="mt-6">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
