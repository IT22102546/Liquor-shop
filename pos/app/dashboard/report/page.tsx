"use client";

import React from "react";
import styles from "./report.module.css";

export default function ReportPage() {
  return (
    <div className={styles.wrapper}>
      <header className={styles.topbar}>
        <img src="/landing/lion-logo.png" alt="Bar Shop" className={styles.logo} />
      </header>

      <main className={styles.container}>
        <section className={styles.reportHeader}>
          <div>
            <h2 className={styles.reportTitle}>Sales Report: <span className={styles.reportId}>#0026</span></h2>
          </div>
          <div className={styles.reportMeta}>Date: <strong>28/03/2026</strong></div>
        </section>

        <section className={styles.range}> 
          <div className={styles.rangeLabel}>Report Range:</div>
          <div className={styles.rangeValue}>Apr. 15, 2026 to May. 1, 2026</div>
        </section>

        <div className={styles.dividerBar} />

        <table className={styles.reportTable}>
          <thead>
            <tr>
              <th className={styles.desc}>Description</th>
              <th>Debit / Expense</th>
              <th>Credit / Income</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={styles.desc}>Total Revenue</td>
              <td />
              <td className={styles.amount}>Rs. 1,000,000</td>
            </tr>
            <tr>
              <td className={styles.desc}>Taxes</td>
              <td className={styles.amount}>Rs. 200,000</td>
              <td />
            </tr>
            <tr>
              <td className={styles.desc}>Other Costs</td>
              <td className={styles.amount}>Rs. 200,000</td>
              <td />
            </tr>
          </tbody>
        </table>

        <div className={styles.rowTotal}>
          <div />
          <div className={styles.totalLabel}>Gross Profit</div>
          <div className={styles.totalAmount}>Rs. 600,000</div>
        </div>

        <section className={styles.accountsSection}>
          <h3 className={styles.sectionTitle}>Accounts Receivable: <span className={styles.reportId}>#0026</span></h3>

          <div className={styles.range}> 
            <div className={styles.rangeLabel}>Report Range:</div>
            <div className={styles.rangeValue}>Apr. 15, 2026 to May. 1, 2026</div>
          </div>

          <table className={styles.reportTable}>
            <tbody>
              <tr>
                <td className={styles.desc}>Cash Outstanding</td>
                <td className={styles.amount}>Rs. 200,000</td>
                <td />
              </tr>
            </tbody>
          </table>

          <div className={styles.rowTotal}>
            <div />
            <div className={styles.totalLabel}>Total Outstanding</div>
            <div className={styles.totalAmount}>Rs. 200,000</div>
          </div>
        </section>
      </main>
    </div>
  );
}
