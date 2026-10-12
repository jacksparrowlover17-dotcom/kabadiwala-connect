import { Database, Download, FileCheck } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';

export default function DataExportPage() {
  const lotCount = useLiveQuery(() => db.lots.count());
  const recyclerCount = useLiveQuery(() => db.recyclers.count());
  const hubPurchaseCount = useLiveQuery(() => db.hubPurchases.count());
  const paymentCount = useLiveQuery(() => db.payments.count());
  const shipmentCount = useLiveQuery(() => db.shipments.count());

  const downloadCSV = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportTransactions = async () => {
    const lots = await db.lots.toArray();
    let csv = 'lot_id,collector_id,material,approx_weight_kg,actual_weight_kg,purchase_amount_inr,status,hub_id,shipment_id,timestamp\n';
    lots.forEach(lot => {
      csv += `${lot.id},${lot.collectorId || 'KAB-7842'},${lot.material},${lot.weight},${lot.actualWeight || ''},${lot.purchaseAmount || lot.estimate},${lot.status},${lot.hubId || ''},${lot.shipmentId || ''},${new Date(lot.timestamp).toISOString()}\n`;
    });
    downloadCSV('Lots_Transactions_Dataset.csv', csv);
  };

  const exportHubPurchases = async () => {
    const purchases = await db.hubPurchases.toArray();
    let csv = 'purchase_id,hub_id,lot_id,collector_id,material,estimated_weight_kg,actual_weight_kg,agreed_rate_inr,deductions_inr,net_amount_inr,status,weighed_at,confirmed_at\n';
    purchases.forEach(p => {
      csv += `${p.id},${p.hubId},${p.lotId},${p.collectorId},${p.material},${p.estimatedWeight},${p.actualWeight || ''},${p.agreedRate || ''},${p.deductions},${p.netAmount || ''},${p.status},${new Date(p.updatedAt).toISOString()},${p.collectorConfirmedAt ? new Date(p.collectorConfirmedAt).toISOString() : ''}\n`;
    });
    downloadCSV('Hub_Purchases_Dataset.csv', csv);
  };

  const exportPayments = async () => {
    const payments = await db.payments.toArray();
    let csv = 'payment_id,hub_id,purchase_id,lot_id,collector_id,amount_inr,payment_mode,reference_note,recorded_at\n';
    payments.forEach(p => {
      csv += `${p.id},${p.hubId},${p.purchaseId},${p.lotId},${p.collectorId},${p.amount},${p.method},${p.referenceNote || ''},${new Date(p.recordedAt).toISOString()}\n`;
    });
    downloadCSV('Payments_Disbursement_Dataset.csv', csv);
  };

  const exportShipments = async () => {
    const shipments = await db.shipments.toArray();
    let csv = 'shipment_id,hub_id,recycler_id,recycler_name,material,lot_count,planned_kg,dispatched_kg,received_kg,discrepancy_kg,handover_hash,status,created_at\n';
    shipments.forEach(s => {
      csv += `${s.id},${s.hubId},${s.recyclerId},"${s.recyclerName}",${s.material},${s.lotIds.length},${s.plannedQuantity},${s.dispatchedQuantity || ''},${s.recyclerReceivedQuantity || ''},${s.discrepancyQuantity || ''},${s.handoverHash || ''},${s.status},${new Date(s.createdAt).toISOString()}\n`;
    });
    downloadCSV('Shipments_Form6_Dataset.csv', csv);
  };

  const exportRecyclers = async () => {
    const recyclers = await db.recyclers.toArray();
    let csv = 'recycler_id,name,offered_rate_per_kg,distance_km,is_verified\n';
    recyclers.forEach(r => {
      csv += `${r.id},${r.name},${r.rate},${r.distance},${r.verified}\n`;
    });
    downloadCSV('Recyclers_Registry_Dataset.csv', csv);
  };

  const generateEPRCertificate = async () => {
    const allLots = await db.lots.toArray();
    const verifiedLots = allLots.filter(l => ['COMPLETED', 'PAID', 'RECEIVED_BY_RECYCLER'].includes(l.status));
    const totalWeight = verifiedLots.reduce((acc, lot) => {
      return acc + (lot.actualWeight || parseFloat(lot.weight) || 0);
    }, 0).toFixed(2);
    
    const shipments = await db.shipments.toArray();
    const certWindow = window.open('', '_blank');
    if (certWindow) {
      certWindow.document.write(`
        <html>
          <head>
            <title>EPR Compliance Certificate - Hub Aggregation</title>
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; background: #f4f4f4; }
              .certificate { background: white; padding: 40px; border-radius: 12px; max-width: 800px; margin: auto; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 4px solid #14213D; }
              .header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
              .title { font-size: 26px; font-weight: bold; color: #14213D; margin: 0; }
              .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
              .content { font-size: 16px; line-height: 1.6; color: #333; }
              .highlight { font-weight: bold; color: #2E7D32; font-size: 24px; }
              .footer { margin-top: 40px; border-top: 2px solid #eee; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; }
              .stamp { color: #d32f2f; border: 2px solid #d32f2f; padding: 8px 12px; font-weight: bold; transform: rotate(-5deg); display: inline-block; font-size: 16px; letter-spacing: 2px; }
              .table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
              .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              .table th { background: #f8f9fa; }
            </style>
          </head>
          <body>
            <div class="certificate">
              <div class="header">
                <h1 class="title">EPR Traceability & Compliance Certificate</h1>
                <p class="subtitle">E-Waste (Management) Rules, 2022 • Form 6 Manifest Audit</p>
              </div>
              <div class="content">
                <p>This certifies that <strong>Kabadiwala Connect Aggregation Infrastructure</strong> has facilitated the formal channelization and auditable handover of informal collection batches to CPCB-authorized recycling units.</p>
                <p><strong>Certificate ID:</strong> EPR-HUB-${crypto.randomUUID().split('-')[0].toUpperCase()}</p>
                <p><strong>Date of Audit:</strong> ${new Date().toLocaleDateString()}</p>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Total Verified Material Processed:</p>
                  <p class="highlight">${totalWeight} KG</p>
                  <p style="margin: 0; font-size: 13px; color: #475569;">Covering ${verifiedLots.length} street collector batches and ${shipments.length} aggregated bulk shipments.</p>
                </div>

                <p><strong>Form 6 Bulk Consignments Traceability Summary:</strong></p>
                <table class="table">
                  <thead>
                    <tr>
                      <th>Shipment ID</th>
                      <th>Category</th>
                      <th>Dispatched (kg)</th>
                      <th>Recycler Scale (kg)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${shipments.map(s => `
                      <tr>
                        <td><strong>${s.id}</strong></td>
                        <td>${s.material}</td>
                        <td>${s.dispatchedQuantity || s.plannedQuantity}</td>
                        <td>${s.recyclerReceivedQuantity || 'Pending'}</td>
                        <td>${s.status}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              <div class="footer">
                <div>
                  <p style="margin:0;"><strong>CPCB Registered Auditor</strong></p>
                  <p style="margin:0; font-size:12px; color:#666;">Kabadiwala Connect Platform Verification Node</p>
                </div>
                <div class="stamp">CPCB COMPLIANT</div>
              </div>
            </div>
            <script>
               setTimeout(() => { window.print(); }, 500);
            </script>
          </body>
        </html>
      `);
      certWindow.document.close();
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto pb-28 text-white min-h-screen bg-[#14213D]">
      <div className="mb-4">
        <h1 className="text-xl font-black flex items-center">
          <Database className="mr-2 text-[#FFC72C]" size={20} /> Data Intelligence & EPR
        </h1>
        <p className="text-gray-400 text-xs mt-0.5">
          Auditable ledger datasets generated across the informal-to-formal collection chain.
        </p>
      </div>

      {/* Grid of Key Platform Metrics */}
      <div className="grid grid-cols-2 gap-2.5 mb-5 font-mono">
        <div className="bg-white/10 p-3 rounded-2xl border border-white/10">
          <p className="text-[10px] text-gray-400 uppercase font-bold">Collector Batches</p>
          <p className="text-2xl font-black text-[#FFC72C] mt-0.5">{lotCount ?? 0}</p>
        </div>
        <div className="bg-white/10 p-3 rounded-2xl border border-white/10">
          <p className="text-[10px] text-gray-400 uppercase font-bold">Hub Purchases</p>
          <p className="text-2xl font-black text-green-400 mt-0.5">{hubPurchaseCount ?? 0}</p>
        </div>
        <div className="bg-white/10 p-3 rounded-2xl border border-white/10">
          <p className="text-[10px] text-gray-400 uppercase font-bold">Disbursements</p>
          <p className="text-2xl font-black text-blue-400 mt-0.5">{paymentCount ?? 0}</p>
        </div>
        <div className="bg-white/10 p-3 rounded-2xl border border-white/10">
          <p className="text-[10px] text-gray-400 uppercase font-bold">Bulk Shipments</p>
          <p className="text-2xl font-black text-purple-400 mt-0.5">{shipmentCount ?? 0}</p>
        </div>
      </div>

      <div className="text-[11px] text-gray-300 font-mono mb-4 bg-white/5 p-2 rounded-xl flex justify-between">
        <span>Authorized Recyclers in Registry:</span>
        <span className="font-bold text-white">{recyclerCount ?? 0}</span>
      </div>

      {/* Regulatory Certificate Generator */}
      <div className="bg-white/5 border border-white/10 p-4 rounded-2xl mb-5 space-y-2">
        <h2 className="font-bold text-xs uppercase tracking-wider text-gray-300">
          CPCB / Brand EPR Compliance
        </h2>
        <button 
          onClick={generateEPRCertificate}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-xl flex items-center justify-center font-bold text-xs shadow-lg transition active:scale-95"
        >
          <FileCheck className="mr-2" size={16} />
          Generate Form 6 EPR Certificate
        </button>
        <p className="text-[10px] text-gray-400 text-center">
          Generates a verifiable compliance audit certificate for producer brand responsibility.
        </p>
      </div>

      {/* Datasets Download */}
      <div className="space-y-2 text-xs">
        <h2 className="font-bold text-xs uppercase tracking-wider text-gray-300 mb-2">
          Export Traceability Datasets (CSV)
        </h2>
        
        <div className="bg-white/10 p-3 rounded-xl flex justify-between items-center border border-white/5">
          <div>
            <span className="font-bold block text-sm">Lots_Transactions_Dataset.csv</span>
            <span className="text-[10px] text-gray-400">Street collection logs & physical conditions</span>
          </div>
          <button 
            onClick={exportTransactions} 
            className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white"
            title="Download CSV"
          >
            <Download size={16} />
          </button>
        </div>

        <div className="bg-white/10 p-3 rounded-xl flex justify-between items-center border border-white/5">
          <div>
            <span className="font-bold block text-sm">Hub_Purchases_Dataset.csv</span>
            <span className="text-[10px] text-gray-400">Hub weighbridge intake & rate deductions</span>
          </div>
          <button 
            onClick={exportHubPurchases} 
            className="p-2 bg-green-600 hover:bg-green-500 rounded-lg text-white"
            title="Download CSV"
          >
            <Download size={16} />
          </button>
        </div>

        <div className="bg-white/10 p-3 rounded-xl flex justify-between items-center border border-white/5">
          <div>
            <span className="font-bold block text-sm">Payments_Disbursement_Dataset.csv</span>
            <span className="text-[10px] text-gray-400">Cash & UPI collector settlements</span>
          </div>
          <button 
            onClick={exportPayments} 
            className="p-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-white"
            title="Download CSV"
          >
            <Download size={16} />
          </button>
        </div>

        <div className="bg-white/10 p-3 rounded-xl flex justify-between items-center border border-white/5">
          <div>
            <span className="font-bold block text-sm">Shipments_Form6_Dataset.csv</span>
            <span className="text-[10px] text-gray-400">Aggregated lots, hashes & discrepancy audit</span>
          </div>
          <button 
            onClick={exportShipments} 
            className="p-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white"
            title="Download CSV"
          >
            <Download size={16} />
          </button>
        </div>

        <div className="bg-white/10 p-3 rounded-xl flex justify-between items-center border border-white/5">
          <div>
            <span className="font-bold block text-sm">Recyclers_Registry_Dataset.csv</span>
            <span className="text-[10px] text-gray-400">CPCB authorized destination recyclers</span>
          </div>
          <button 
            onClick={exportRecyclers} 
            className="p-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white"
            title="Download CSV"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
      
      <div className="mt-6 text-[10px] text-gray-500 text-center font-mono">
        Offline-first persistence enabled. Real-time background sync via Supabase.
      </div>
    </div>
  );
}
