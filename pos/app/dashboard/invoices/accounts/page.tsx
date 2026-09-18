"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdmin } from "../../../components/AdminContext";
import { API_URL } from "../../../lib/constants";
import { IconInvoice } from "../../../lib/icons";
import { readApiData } from "../../../lib/api";
import TablePagination, { paginateRows } from "../../../components/TablePagination";

type InvoiceAccount = {
  id: number;
  accountHolder: string;
  accountNumber: string;
  bankName: string;
  branchName?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type InvoiceAccountInput = {
  accountHolder: string;
  accountNumber: string;
  bankName: string;
  branchName?: string;
  sortOrder?: number;
  isActive: boolean;
};

const INVOICE_ACCOUNTS_QUERY_KEY = ["pos", "invoice-accounts"] as const;

export default function InvoiceAccountsPage() {
  const { token } = useAdmin();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [newAccountHolder, setNewAccountHolder] = useState("");
  const [newAccountNumber, setNewAccountNumber] = useState("");
  const [newBankName, setNewBankName] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("");
  const [newIsActive, setNewIsActive] = useState(true);

  const [editId, setEditId] = useState<number | null>(null);
  const [editAccountHolder, setEditAccountHolder] = useState("");
  const [editAccountNumber, setEditAccountNumber] = useState("");
  const [editBankName, setEditBankName] = useState("");
  const [editBranchName, setEditBranchName] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const base = `${API_URL}/api/pos/user-management`;
  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const queryClient = useQueryClient();

  const accountsQueryKey = useMemo(() => [...INVOICE_ACCOUNTS_QUERY_KEY, token] as const, [token]);
  const refreshInvoiceAccountQueries = () =>
    queryClient.invalidateQueries({ queryKey: INVOICE_ACCOUNTS_QUERY_KEY, refetchType: "all" });

  const accountsQuery = useQuery({
    queryKey: accountsQueryKey,
    enabled: Boolean(token),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<InvoiceAccount[]> => {
      const response = await fetch(`${base}/invoice-accounts`, { headers: auth, cache: "no-store" });
      const payload = await readApiData<{ accounts?: InvoiceAccount[] }>(response, "Failed to load invoice accounts");
      return payload.accounts ?? [];
    },
  });
  const filteredAccounts = useMemo(() => {
    const accounts = accountsQuery.data ?? [];
    const needle = search.trim().toLowerCase();
    return needle ? accounts.filter((account) => [account.accountNumber, account.accountHolder, account.bankName, account.branchName].some((value) => value?.toLowerCase().includes(needle))) : accounts;
  }, [accountsQuery.data, search]);
  const pagedAccounts = useMemo(() => paginateRows(filteredAccounts, page, pageSize), [filteredAccounts, page, pageSize]);
  useEffect(() => { setPage(1); }, [search, pageSize]);

  const createAccountMutation = useMutation({
    mutationFn: async (input: InvoiceAccountInput) => {
      const response = await fetch(`${base}/invoice-accounts`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to add account");
    },
    onSuccess: async () => {
      resetCreateForm();
      setSuccess("Account added");
      await refreshInvoiceAccountQueries();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to add account");
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async (input: InvoiceAccountInput & { id: number }) => {
      const response = await fetch(`${base}/invoice-accounts/${input.id}`, {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          accountHolder: input.accountHolder,
          accountNumber: input.accountNumber,
          bankName: input.bankName,
          branchName: input.branchName ?? "",
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        }),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to update account");
    },
    onSuccess: async () => {
      stopEdit();
      setSuccess("Account updated");
      await refreshInvoiceAccountQueries();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to update account");
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (accountId: number) => {
      const response = await fetch(`${base}/invoice-accounts/${accountId}`, {
        method: "DELETE",
        headers: auth,
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to delete account");
    },
    onSuccess: async (_, accountId) => {
      if (editId === accountId) stopEdit();
      setSuccess("Account deleted");
      await refreshInvoiceAccountQueries();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to delete account");
    },
  });

  const loading = accountsQuery.isPending;
  const saving = createAccountMutation.isPending || updateAccountMutation.isPending || deleteAccountMutation.isPending;
  const queryError = accountsQuery.error instanceof Error ? accountsQuery.error.message : null;
  const visibleError = error ?? queryError;

  const resetCreateForm = () => {
    setNewAccountHolder("");
    setNewAccountNumber("");
    setNewBankName("");
    setNewBranchName("");
    setNewSortOrder("");
    setNewIsActive(true);
  };

  const startEdit = (account: InvoiceAccount) => {
    setEditId(account.id);
    setEditAccountHolder(account.accountHolder);
    setEditAccountNumber(account.accountNumber);
    setEditBankName(account.bankName);
    setEditBranchName(account.branchName ?? "");
    setEditSortOrder(String(account.sortOrder));
    setEditIsActive(account.isActive);
  };

  const stopEdit = () => {
    setEditId(null);
    setEditAccountHolder("");
    setEditAccountNumber("");
    setEditBankName("");
    setEditBranchName("");
    setEditSortOrder("");
    setEditIsActive(true);
  };

  const buildAccountInput = (source: {
    accountHolder: string;
    accountNumber: string;
    bankName: string;
    branchName: string;
    sortOrder: string;
    isActive: boolean;
  }): InvoiceAccountInput | null => {
    const accountHolder = source.accountHolder.trim();
    const accountNumber = source.accountNumber.trim();
    const bankName = source.bankName.trim();
    const branchName = source.branchName.trim();
    const sortOrderValue = source.sortOrder.trim();

    if (!accountHolder) {
      setError("Account holder is required");
      return null;
    }
    if (!accountNumber) {
      setError("Account number is required");
      return null;
    }
    if (!bankName) {
      setError("Bank name is required");
      return null;
    }

    const sortOrder = sortOrderValue ? Number(sortOrderValue) : undefined;
    if (
      sortOrder !== undefined &&
      (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 9999)
    ) {
      setError("Sort order must be a whole number from 1 to 9999");
      return null;
    }

    return {
      accountHolder,
      accountNumber,
      bankName,
      branchName,
      sortOrder,
      isActive: source.isActive,
    };
  };

  const handleCreate = async () => {
    const input = buildAccountInput({
      accountHolder: newAccountHolder,
      accountNumber: newAccountNumber,
      bankName: newBankName,
      branchName: newBranchName,
      sortOrder: newSortOrder,
      isActive: newIsActive,
    });
    if (!input) return;

    setError(null);
    setSuccess(null);
    createAccountMutation.mutate(input);
  };

  const handleUpdate = async () => {
    if (!editId) return;
    const input = buildAccountInput({
      accountHolder: editAccountHolder,
      accountNumber: editAccountNumber,
      bankName: editBankName,
      branchName: editBranchName,
      sortOrder: editSortOrder,
      isActive: editIsActive,
    });
    if (!input) return;

    setError(null);
    setSuccess(null);
    updateAccountMutation.mutate({ id: editId, ...input });
  };

  const handleDelete = async (accountId: number) => {
    const confirmed = window.confirm("Delete this invoice account?");
    if (!confirmed) return;

    setError(null);
    setSuccess(null);
    deleteAccountMutation.mutate(accountId);
  };

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconInvoice /></div>
          <div>
            <h2 className="page-title">Invoice Account Details</h2>
            <p className="page-subtitle">Manage bank account details shown on generated invoices.</p>
          </div>
        </div>
      </div>

      {visibleError && <div className="bm-alert bm-alert-error">{visibleError}</div>}
      {success && <div className="bm-alert bm-alert-success">{success}</div>}

      <div className="bm-table-card" style={{ marginBottom: "1rem" }}>
        <div style={{ padding: "1rem", display: "grid", gap: "0.75rem" }}>
          <h3 className="users-section-title" style={{ margin: 0 }}>Add New Account</h3>
          <div className="invoice-account-grid">
            <input
              className="bm-input"
              placeholder="Account holder"
              value={newAccountHolder}
              onChange={(e) => setNewAccountHolder(e.target.value)}
            />
            <input
              className="bm-input"
              placeholder="Account number"
              value={newAccountNumber}
              onChange={(e) => setNewAccountNumber(e.target.value)}
            />
            <input
              className="bm-input"
              placeholder="Bank name"
              value={newBankName}
              onChange={(e) => setNewBankName(e.target.value)}
            />
            <input
              className="bm-input"
              placeholder="Branch name (optional)"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
            />
            <input
              className="bm-input"
              type="number"
              min={1}
              max={9999}
              placeholder="Sort order (optional)"
              value={newSortOrder}
              onChange={(e) => setNewSortOrder(e.target.value)}
            />
            <label className="invoice-terms-checkbox">
              <input
                type="checkbox"
                checked={newIsActive}
                onChange={(e) => setNewIsActive(e.target.checked)}
              />
              <span>Active</span>
            </label>
          </div>
          <div>
            <button type="button" className="btn-accent" onClick={() => void handleCreate()} disabled={saving}>
              {saving ? "Saving..." : "Add Account"}
            </button>
          </div>
        </div>
      </div>

      <div className="bm-table-card">
        <div style={{ padding: "1rem", borderBottom: "1px solid var(--panel-border)" }}><input className="bm-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search account, holder, bank or branch" /></div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Order</th>
                <th>Account Number</th>
                <th>Account Holder</th>
                <th>Bank</th>
                <th>Branch</th>
                <th style={{ width: 120 }}>Status</th>
                <th style={{ width: 220 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="bm-table-empty">Loading accounts...</td></tr>
              )}
              {!loading && (accountsQuery.data ?? []).length === 0 && (
                <tr><td colSpan={7} className="bm-table-empty">No accounts found.</td></tr>
              )}
              {!loading && pagedAccounts.map((account) => {
                const isEditing = editId === account.id;
                return (
                  <tr key={account.id}>
                    <td>
                      {isEditing ? (
                        <input
                          className="bm-input"
                          type="number"
                          min={1}
                          max={9999}
                          value={editSortOrder}
                          onChange={(e) => setEditSortOrder(e.target.value)}
                        />
                      ) : account.sortOrder}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="bm-input"
                          value={editAccountNumber}
                          onChange={(e) => setEditAccountNumber(e.target.value)}
                        />
                      ) : account.accountNumber}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="bm-input"
                          value={editAccountHolder}
                          onChange={(e) => setEditAccountHolder(e.target.value)}
                        />
                      ) : account.accountHolder}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="bm-input"
                          value={editBankName}
                          onChange={(e) => setEditBankName(e.target.value)}
                        />
                      ) : account.bankName}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="bm-input"
                          value={editBranchName}
                          onChange={(e) => setEditBranchName(e.target.value)}
                        />
                      ) : account.branchName || "-"}
                    </td>
                    <td>
                      {isEditing ? (
                        <label className="invoice-terms-checkbox">
                          <input
                            type="checkbox"
                            checked={editIsActive}
                            onChange={(e) => setEditIsActive(e.target.checked)}
                          />
                          <span>{editIsActive ? "Active" : "Inactive"}</span>
                        </label>
                      ) : (
                        <span className={account.isActive ? "users-status sold" : "users-status not-sold"}>
                          {account.isActive ? "Active" : "Inactive"}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="invoice-terms-actions">
                        {isEditing ? (
                          <>
                            <button type="button" className="btn-accent" onClick={() => void handleUpdate()} disabled={saving}>Save</button>
                            <button type="button" className="btn-outline" onClick={stopEdit} disabled={saving}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="btn-outline" onClick={() => startEdit(account)} disabled={saving}>Update</button>
                            <button type="button" className="btn-outline invoice-terms-delete-btn" onClick={() => void handleDelete(account.id)} disabled={saving}>Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} pageSize={pageSize} total={filteredAccounts.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  );
}
