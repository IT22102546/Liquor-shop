"use client";

import { buildReceiptHtml, printReceipt, type SaleReceipt } from "../../lib/receipt";
import { IconCheck, IconPrinter } from "../../lib/icons";

type ReceiptModalProps = {
  receipt: SaleReceipt;
  title: string;
  subtitle: string;
  /** Green tick for a sale that just went through; plain header for a reprint. */
  success?: boolean;
  closeLabel: string;
  onClose: () => void;
};

/** On-screen receipt (exact 80mm paper strip) with Print, used after a sale and for reprints. */
export function ReceiptModal({ receipt, title, subtitle, success = false, closeLabel, onClose }: ReceiptModalProps) {
  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="pos-receipt-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={title}>
        <div className="pos-receipt-head">
          {success ? <span className="pos-receipt-check"><IconCheck size={22} /></span> : <span className="pos-receipt-check neutral"><IconPrinter size={20} /></span>}
          <div>
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </div>
        </div>
        <iframe className="pos-receipt-paper" title="Receipt preview" srcDoc={buildReceiptHtml(receipt)} />
        <div className="pos-receipt-actions">
          <button type="button" className="btn-outline" onClick={() => printReceipt(receipt)}><IconPrinter size={16} /> Print</button>
          <button type="button" className="btn-accent" autoFocus onClick={onClose}>{closeLabel}</button>
        </div>
      </div>
    </div>
  );
}
