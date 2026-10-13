import { Database, Download, FileText, Info, Package, CreditCard, Truck, Recycle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';

const DATASETS = [
  {
    key: 'transactions',
    name: 'Lots_Transactions_Dataset.csv',
    desc: 'Street collection logs, conditions, and batch traceability',
    color: '#1d4ed8',
    icon: <Package size={16} color="#1d4ed8"/>,
  },
  {
    key: 'purchases',
    name: 'Hub_Purchases_Dataset.csv',
    desc: 'Hub weighbridge intake, agreed rates, and deductions',
    color: '#166534',
    icon: <Database size={16} color="#166534"/>,
  },
  {
    key: 'payments',
    name: 'Payments_Disbursement_Dataset.csv',
    desc: 'Cash & UPI collector payment settlement records',
    color: '#b45309',
    icon: <CreditCard size={16} color="#b45309"/>,
  },
  {
    key: 'shipments',
    name: 'Shipments_Form6_Dataset.csv',
    desc: 'Aggregated lots, SHA-256 hashes & discrepancy audit',
    color: '#7c3aed',
    icon: <Truck size={16} color="#7c3aed"/>,
  },
  {
    key: 'recyclers',
    name: 'Recyclers_Registry_Dataset.csv',
    desc: 'Authorized destination recycler registry',
    color: '#0e7490',
    icon: <Recycle size={16} color="#0e7490"/>,
  },
];

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function DataExportPage() {
  const lotCount        = useLiveQuery(() => db.lots.count());
  const recyclerCount   = useLiveQuery(() => db.recyclers.count());
  const hubPurchaseCount= useLiveQuery(() => db.hubPurchases.count());
  const paymentCount    = useLiveQuery(() => db.payments.count());
  const shipmentCount   = useLiveQuery(() => db.shipments.count());

  const exportHandlers: Record<string, () => Promise<void>> = {
    transactions: async () => {
      const lots = await db.lots.toArray();
      let csv = 'lot_id,collector_id,material,approx_weight_kg,actual_weight_kg,purchase_amount_inr,status,hub_id,shipment_id,timestamp\n';
      lots.forEach(lot => {
        csv += `${lot.id},${lot.collectorId||'KAB-7842'},${lot.material},${lot.weight},${lot.actualWeight||''},${lot.purchaseAmount||lot.estimate},${lot.status},${lot.hubId||''},${lot.shipmentId||''},${new Date(lot.timestamp).toISOString()}\n`;
      });
      downloadCSV('Lots_Transactions_Dataset.csv', csv);
    },
    purchases: async () => {
      const purchases = await db.hubPurchases.toArray();
      let csv = 'purchase_id,hub_id,lot_id,collector_id,material,estimated_weight_kg,actual_weight_kg,agreed_rate_inr,deductions_inr,net_amount_inr,status,weighed_at,confirmed_at\n';
      purchases.forEach(p => {
        csv += `${p.id},${p.hubId},${p.lotId},${p.collectorId},${p.material},${p.estimatedWeight},${p.actualWeight||''},${p.agreedRate||''},${p.deductions},${p.netAmount||''},${p.status},${new Date(p.updatedAt).toISOString()},${p.collectorConfirmedAt?new Date(p.collectorConfirmedAt).toISOString():''}\n`;
      });
      downloadCSV('Hub_Purchases_Dataset.csv', csv);
    },
    payments: async () => {
      const payments = await db.payments.toArray();
      let csv = 'payment_id,hub_id,purchase_id,lot_id,collector_id,amount_inr,payment_mode,reference_note,recorded_at\n';
      payments.forEach(p => {
        csv += `${p.id},${p.hubId},${p.purchaseId},${p.lotId},${p.collectorId},${p.amount},${p.method},${p.referenceNote||''},${new Date(p.recordedAt).toISOString()}\n`;
      });
      downloadCSV('Payments_Disbursement_Dataset.csv', csv);
    },
    shipments: async () => {
      const shipments = await db.shipments.toArray();
      let csv = 'shipment_id,hub_id,recycler_id,recycler_name,material,lot_count,planned_kg,dispatched_kg,received_kg,discrepancy_kg,handover_hash,status,created_at\n';
      shipments.forEach(s => {
        csv += `${s.id},${s.hubId},${s.recyclerId},"${s.recyclerName}",${s.material},${s.lotIds.length},${s.plannedQuantity},${s.dispatchedQuantity||''},${s.recyclerReceivedQuantity||''},${s.discrepancyQuantity||''},${s.handoverHash||''},${s.status},${new Date(s.createdAt).toISOString()}\n`;
      });
      downloadCSV('Shipments_Form6_Dataset.csv', csv);
    },
    recyclers: async () => {
      const recyclers = await db.recyclers.toArray();
      let csv = 'recycler_id,name,offered_rate_per_kg,distance_km,is_verified\n';
      recyclers.forEach(r => {
        csv += `${r.id},${r.name},${r.rate},${r.distance},${r.verified}\n`;
      });
      downloadCSV('Recyclers_Registry_Dataset.csv', csv);
    },
  };

  const generateEPRWorkflowSummary = async () => {
    const allLots = await db.lots.toArray();
    const verifiedLots = allLots.filter(l => ['COMPLETED','PAID','RECEIVED_BY_RECYCLER'].includes(l.status));
    const totalWeight = verifiedLots.reduce((acc, l) => acc + (l.actualWeight || parseFloat(l.weight) || 0), 0).toFixed(2);
    const shipments = await db.shipments.toArray();

    const certWindow = window.open('', '_blank');
    if (certWindow) {
      certWindow.document.write(`
        <html><head><title>EPR Traceability Workflow Summary — Kabadiwala Connect</title>
        <style>
          body{font-family:Inter,sans-serif;padding:40px;background:#f8fafc;color:#1f2937}
          .cert{background:#fff;padding:40px;border-radius:16px;max-width:820px;margin:auto;border:3px solid #166534;box-shadow:0 8px 24px rgba(0,0,0,.08)}
          .header{text-align:center;border-bottom:2px solid #e2e8f0;padding-bottom:20px;margin-bottom:24px}
          .title{font-size:24px;font-weight:800;color:#166534;margin:0}
          .sub{font-size:13px;color:#64748b;margin-top:4px}
          .notice{background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:12px;color:#92400e;margin:16px 0}
          .metric{background:#f0fdf4;padding:20px;border-radius:12px;text-align:center;margin:16px 0;border:1px solid #dcfce7}
          .metric-val{font-size:36px;font-weight:900;color:#166534}
          .metric-sub{font-size:13px;color:#64748b;margin-top:4px}
          table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
          th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left}
          th{background:#f0fdf4;font-weight:700;color:#166534}
          .footer{margin-top:32px;border-top:2px solid #e2e8f0;padding-top:20px;font-size:12px;color:#94a3b8;text-align:center}
        </style></head><body>
        <div class="cert">
          <div class="header">
            <h1 class="title">EPR Traceability Workflow Summary</h1>
            <p class="sub">Kabadiwala Connect Platform — E-Waste Supply Chain Audit Record</p>
          </div>
          <div class="notice">
            ⚠️ <strong>Demo Record:</strong> This is a platform-generated workflow summary for demonstration and traceability purposes.
            It is not an official CPCB-registered EPR certificate and has not been submitted to any regulatory authority.
          </div>
          <p><strong>Record ID:</strong> KAB-EPR-${crypto.randomUUID().split('-')[0].toUpperCase()}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <div class="metric">
            <div class="metric-val">${totalWeight} KG</div>
            <div class="metric-sub">Total verified material processed across ${verifiedLots.length} collector batches and ${shipments.length} bulk shipments</div>
          </div>
          <p><strong>Bulk Consignment Traceability:</strong></p>
          <table>
            <thead><tr><th>Shipment ID</th><th>Material</th><th>Dispatched (kg)</th><th>Received (kg)</th><th>Status</th></tr></thead>
            <tbody>${shipments.map(s=>`<tr><td><strong>${s.id}</strong></td><td>${s.material}</td><td>${s.dispatchedQuantity||s.plannedQuantity}</td><td>${s.recyclerReceivedQuantity||'Pending'}</td><td>${s.status}</td></tr>`).join('')}</tbody>
          </table>
          <div class="footer">Kabadiwala Connect · Offline-first e-waste supply chain platform · Generated by browser · Not an official regulatory document</div>
        </div>
        <script>setTimeout(()=>window.print(),600);</script>
        </body></html>`);
      certWindow.document.close();
    }
  };

  const metrics = [
    { label: 'Collector Batches', value: lotCount ?? 0, color: '#166534' },
    { label: 'Hub Purchases',     value: hubPurchaseCount ?? 0, color: '#1d4ed8' },
    { label: 'Disbursements',     value: paymentCount ?? 0, color: '#b45309' },
    { label: 'Bulk Shipments',    value: shipmentCount ?? 0, color: '#7c3aed' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-6 pb-28 sm:pb-12">
      <div>
        <h1 className="text-xl font-black text-[#1f2937]">Data Intelligence & EPR</h1>
        <p className="text-sm text-[#64748b] mt-0.5">Auditable datasets across the informal-to-formal collection chain.</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map(m => (
          <div key={m.label} className="stat-card">
            <p className="stat-card-value" style={{ color: m.color }}>{m.value}</p>
            <p className="stat-card-label">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Authorized recyclers inline */}
      <div className="kc-card p-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#1f2937]">Authorized Recyclers in Registry</span>
        <span className="badge badge-success text-sm">{recyclerCount ?? 0}</span>
      </div>

      {/* EPR Workflow Summary */}
      <div className="kc-card p-4 space-y-3">
        <h2 className="font-bold text-[#1f2937] flex items-center gap-2">
          <FileText size={16} color="#166534"/>EPR Traceability Record
        </h2>
        <button onClick={generateEPRWorkflowSummary}
          className="btn-primary w-full py-3 gap-2">
          <FileText size={16}/>Generate EPR Workflow Summary (Print)
        </button>
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <Info size={14} color="#b45309" className="flex-shrink-0 mt-0.5"/>
          <p className="text-xs text-amber-800">
            This generates a <strong>demonstration traceability document</strong> for workflow support purposes.
            It is not an officially submitted CPCB EPR certificate.
          </p>
        </div>
      </div>

      {/* Dataset Exports */}
      <div className="kc-card p-4 space-y-3">
        <h2 className="font-bold text-[#1f2937]">Export Traceability Datasets (CSV)</h2>
        <div className="space-y-2">
          {DATASETS.map(ds => (
            <div key={ds.key} className="flex items-center gap-3 p-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc]">
              <div className="flex-shrink-0">{ds.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[#1f2937] truncate">{ds.name}</p>
                <p className="text-xs text-[#64748b]">{ds.desc}</p>
              </div>
              <button
                onClick={exportHandlers[ds.key]}
                className="flex-shrink-0 p-2.5 rounded-xl transition hover:opacity-80"
                style={{ background: `${ds.color}18`, color: ds.color }}
                title={`Download ${ds.name}`}
              >
                <Download size={16}/>
              </button>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-[#94a3b8] font-mono pb-4">
        Offline-first persistence. Background cloud sync via Supabase when online.
      </p>
    </div>
  );
}
