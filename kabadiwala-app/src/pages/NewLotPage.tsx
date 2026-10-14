import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, type LotCondition, getCollectorProfile } from '../lib/db';
import { pushLotToCloud } from '../lib/supabase';
import { Camera, Weight, Calculator, RefreshCw, Trash2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

const CATEGORIES = [
  { id: 'PCB',   name: 'Circuit Boards (PCB)', rate: 250,  icon: '🟩' },
  { id: 'CABLE', name: 'Copper Cables',         rate: 450,  icon: '🔌' },
  { id: 'PHONE', name: 'Mobile Phones',          rate: 1200, icon: '📱' },
];

const CONDITIONS: { id: LotCondition; label: string; desc: string; icon: string }[] = [
  { id: 'Working / Intact',    label: 'Working / Intact',    desc: 'Functional electronics or complete devices', icon: '✅' },
  { id: 'Mixed Scrap',         label: 'Mixed Scrap',         desc: 'Standard collection, unsorted components',  icon: '📦' },
  { id: 'Damaged / Dismantled',label: 'Damaged / Dismantled',desc: 'Broken parts, scrap fragments, loose cables',icon: '⚠️' },
];

function compressImage(file: File, maxDimension = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please select a valid image (PNG, JPG, WebP).'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.onload = e => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxDimension || h > maxDimension) {
          if (w > h) { h = Math.round(h * maxDimension / w); w = maxDimension; }
          else       { w = Math.round(w * maxDimension / h); h = maxDimension; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(reader.result as string);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function NewLotPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [material, setMaterial] = useState(CATEGORIES[0]);
  const [condition, setCondition] = useState<LotCondition>('Mixed Scrap');
  const [weight, setWeight] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [collectorId, setCollectorId] = useState('KAB-7842');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getCollectorProfile().then(p => setCollectorId(p.collectorId));
  }, []);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingPhoto(true);
    try {
      setPhotoDataUrl(await compressImage(file));
    } catch (err: any) {
      setPhotoError(err.message || 'Error processing photo or camera access denied.');
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setWeightError(null);
    const parsedWeight = parseFloat(weight);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      setWeightError('Please enter a valid weight greater than 0 kg.');
      return;
    }
    if (parsedWeight > 5000) {
      setWeightError('Weight cannot exceed 5,000 kg per single collector load.');
      return;
    }

    if (isSaving) return;
    setIsSaving(true);
    try {
      const est = Math.round(parsedWeight * material.rate);
      const profile = await getCollectorProfile();
      const newLot = {
        id: crypto.randomUUID(),
        material: material.name,
        weight: parsedWeight.toFixed(1),
        estimate: est,
        condition,
        photo: photoDataUrl || undefined,
        collectorId: profile.collectorId || collectorId,
        collectorName: profile.name || 'Collector',
        status: 'PENDING' as const,
        timestamp: Date.now(),
      };
      await db.lots.add(newLot);
      pushLotToCloud(newLot).catch(() => {});
      navigate('/');
    } catch (err: any) {
      setWeightError(err.message || 'Failed to save lot locally.');
      setIsSaving(false);
    }
  };

  const estimate = (weight && !isNaN(parseFloat(weight)) && parseFloat(weight) > 0) 
    ? Math.round(parseFloat(weight) * material.rate) 
    : 0;

  return (
    <div className="max-w-xl mx-auto px-4 py-5 pb-24">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')}
          className="p-2 rounded-xl border border-[#e2e8f0] bg-white hover:bg-gray-50 transition">
          <ArrowLeft size={18} color="#64748b"/>
        </button>
        <div>
          <h1 className="text-xl font-black text-[#1f2937]">Log New Scrap Lot</h1>
          <p className="text-xs text-[#64748b] font-mono">Collector: {collectorId}</p>
        </div>
      </div>

      {/* Hidden camera input */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
        onChange={handlePhotoSelect} className="hidden"/>

      <div className="space-y-6">
        {/* 1. Photo */}
        <div>
          <label className="block text-sm font-bold text-[#1f2937] mb-2">
            Batch Photo <span className="text-[#94a3b8] font-normal text-xs">(Optional)</span>
          </label>
          {photoDataUrl ? (
            <div className="relative rounded-2xl overflow-hidden border-2 border-[#166534]">
              <img src={photoDataUrl} alt="Batch preview" className="w-full h-48 object-cover"/>
              <div className="absolute top-3 left-3">
                <span className="badge badge-success py-1 px-3 text-xs"><CheckCircle2 size={12}/>Photo Attached</span>
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 p-3 flex gap-2 justify-end">
                <button onClick={() => fileInputRef.current?.click()}
                  className="bg-white/90 text-gray-800 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-white transition">
                  <RefreshCw size={12}/>Retake
                </button>
                <button onClick={() => { setPhotoDataUrl(null); setPhotoError(null); }}
                  className="bg-red-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-red-600 transition">
                  <Trash2 size={12}/>Remove
                </button>
              </div>
            </div>
          ) : (
            <div onClick={() => !isProcessingPhoto && fileInputRef.current?.click()}
              className="h-36 rounded-2xl border-2 border-dashed border-[#e2e8f0] bg-[#f8fafc] flex flex-col items-center justify-center cursor-pointer hover:border-[#166534] hover:bg-[#f0fdf4] transition">
              {isProcessingPhoto ? (
                <div className="flex flex-col items-center gap-2 text-[#166534]">
                  <RefreshCw size={24} className="animate-spin"/>
                  <span className="text-sm font-semibold">Compressing image…</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-[#64748b]">
                  <div className="w-12 h-12 rounded-2xl bg-[#dcfce7] flex items-center justify-center">
                    <Camera size={24} color="#166534"/>
                  </div>
                  <p className="font-semibold text-sm text-[#1f2937]">Take Photo or Choose from Gallery</p>
                  <p className="text-xs text-[#94a3b8]">Camera capture & offline image storage supported</p>
                </div>
              )}
            </div>
          )}
          {photoError && (
            <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle size={14}/>{photoError}
            </div>
          )}
        </div>

        {/* 2. Material */}
        <div>
          <label className="block text-sm font-bold text-[#1f2937] mb-3">1. Select Material Category</label>
          <div className="grid grid-cols-3 gap-3">
            {CATEGORIES.map(cat => (
              <button key={cat.id} type="button" onClick={() => setMaterial(cat)}
                className={`p-3 rounded-xl flex flex-col items-center gap-1 border-2 transition ${
                  material.id === cat.id
                    ? 'border-[#166534] bg-[#f0fdf4]'
                    : 'border-[#e2e8f0] bg-white hover:border-[#166534]/40'
                }`}>
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-[11px] font-semibold text-center text-[#1f2937] leading-tight">{cat.name}</span>
                <span className="text-[10px] font-bold text-[#166534]">₹{cat.rate}/kg</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Condition */}
        <div>
          <label className="block text-sm font-bold text-[#1f2937] mb-3">2. Material Condition</label>
          <div className="space-y-2">
            {CONDITIONS.map(cond => (
              <div key={cond.id} onClick={() => setCondition(cond.id)}
                className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition ${
                  condition === cond.id
                    ? 'border-[#166534] bg-[#f0fdf4]'
                    : 'border-[#e2e8f0] bg-white hover:border-[#166534]/40'
                }`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{cond.icon}</span>
                  <div>
                    <p className="font-bold text-sm text-[#1f2937]">{cond.label}</p>
                    <p className="text-xs text-[#64748b]">{cond.desc}</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  condition === cond.id ? 'border-[#166534] bg-[#166534]' : 'border-[#e2e8f0]'
                }`}>
                  {condition === cond.id && <div className="w-2 h-2 bg-white rounded-full"/>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Weight */}
        <div>
          <label className="block text-sm font-bold text-[#1f2937] mb-2 flex items-center gap-2">
            <Weight size={15} color="#166534"/>3. Approximate Weight (kg)
          </label>
          <input
            type="number" value={weight} step="0.1" min="0.1" max="5000"
            onChange={e => {
              setWeight(e.target.value);
              if (weightError) setWeightError(null);
            }}
            placeholder="e.g. 5.5"
            className="kc-input text-2xl font-mono py-3"
          />
          {weightError && (
            <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle size={14}/>{weightError}
            </div>
          )}
        </div>

        {/* Estimate Card */}
        {weight && parseFloat(weight) > 0 && (
          <div className="bg-[#f0fdf4] border border-[#dcfce7] rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#166534]">
              <Calculator size={18}/>
              <span className="font-semibold text-sm">Estimated Value</span>
            </div>
            <p className="text-2xl font-black text-[#166534]">₹{estimate.toLocaleString('en-IN')}</p>
          </div>
        )}

        {/* Save Button */}
        <button type="button" onClick={handleSave} disabled={!weight || isSaving}
          className="btn-primary w-full py-4 text-base rounded-xl">
          {isSaving ? (
            <><RefreshCw size={18} className="animate-spin"/>Saving…</>
          ) : (
            <><CheckCircle2 size={18}/>Save to My Loads</>
          )}
        </button>
      </div>
    </div>
  );
}
