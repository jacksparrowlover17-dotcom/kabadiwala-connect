import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, type LotCondition, getCollectorProfile } from '../lib/db';
import { Camera, Weight, Calculator, RefreshCw, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

const CATEGORIES = [
  { id: 'PCB', name: 'Circuit Boards (PCB)', rate: 250, icon: '🟩' },
  { id: 'CABLE', name: 'Copper Cables', rate: 450, icon: '🔌' },
  { id: 'PHONE', name: 'Mobile Phones', rate: 1200, icon: '📱' },
];

const CONDITIONS: { id: LotCondition; label: string; desc: string; icon: string }[] = [
  { id: 'Working / Intact', label: 'Working / Intact', desc: 'Functional electronics or complete devices', icon: '✨' },
  { id: 'Mixed Scrap', label: 'Mixed Scrap', desc: 'Standard collection, unsorted components', icon: '📦' },
  { id: 'Damaged / Dismantled', label: 'Damaged / Dismantled', desc: 'Broken parts, scrap fragments, loose cables', icon: '⚠️' },
];

/**
 * Resizes and compresses an image file using client-side HTML5 canvas.
 * Reduces 5MB-10MB camera uploads to ~30-80KB to keep IndexedDB fast and offline-resilient.
 */
function compressImage(file: File, maxDimension = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Please select a valid image file (PNG, JPG, WebP).'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file from device storage.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image data.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(reader.result as string);
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
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
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [collectorId, setCollectorId] = useState<string>('KAB-7842');

  useEffect(() => {
    // Load current persistent profile on mount
    getCollectorProfile().then(profile => {
      setCollectorId(profile.collectorId);
    });
  }, []);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsProcessingPhoto(true);

    try {
      const compressed = await compressImage(file);
      setPhotoDataUrl(compressed);
    } catch (err: any) {
      setPhotoError(err.message || 'Error processing photo. Please try again.');
    } finally {
      setIsProcessingPhoto(false);
      // Reset input value so same photo can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setPhotoDataUrl(null);
    setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!weight) return;
    const est = Math.round(parseFloat(weight) * material.rate);
    
    // Ensure profile is up to date
    const profile = await getCollectorProfile();

    await db.lots.add({
      id: crypto.randomUUID(),
      material: material.name,
      weight: weight,
      estimate: est,
      condition: condition,
      photo: photoDataUrl || undefined,
      collectorId: profile.collectorId || collectorId,
      status: 'PENDING',
      timestamp: Date.now()
    });
    
    navigate('/');
  };

  return (
    <div className="p-6 pb-28">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#14213D]">New Load</h1>
          <p className="text-xs text-gray-500 font-mono">Collector ID: {collectorId}</p>
        </div>
      </div>
      
      {/* Hidden file & camera input */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*" 
        capture="environment" 
        onChange={handlePhotoSelect} 
        className="hidden" 
      />

      {/* Photo Capture & Preview Area */}
      <div className="mb-6">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          Batch Photo <span className="text-gray-400 font-normal text-xs">(Optional)</span>
        </label>

        {photoDataUrl ? (
          /* Preview State */
          <div className="relative rounded-2xl overflow-hidden border-2 border-green-500 bg-gray-900 shadow-sm">
            <img 
              src={photoDataUrl} 
              alt="Batch scrap preview" 
              className="w-full h-48 object-cover opacity-95" 
            />
            
            {/* Top Overlay Badge */}
            <div className="absolute top-3 left-3 bg-green-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center shadow">
              <CheckCircle2 size={13} className="mr-1" /> Photo Attached
            </div>

            {/* Bottom Overlay Controls */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 flex justify-between items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/90 hover:bg-white text-gray-800 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center shadow active:scale-95 transition"
              >
                <RefreshCw size={12} className="mr-1.5 text-blue-600" /> Retake / Replace
              </button>
              
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="bg-red-500/90 hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center shadow active:scale-95 transition"
              >
                <Trash2 size={12} className="mr-1" /> Remove
              </button>
            </div>
          </div>
        ) : (
          /* Upload / Capture Placeholder */
          <div 
            onClick={() => !isProcessingPhoto && fileInputRef.current?.click()}
            className="bg-gray-100 hover:bg-gray-200/80 active:scale-[0.99] h-36 rounded-2xl flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-300 cursor-pointer transition"
          >
            {isProcessingPhoto ? (
              <div className="flex flex-col items-center text-blue-600">
                <RefreshCw size={28} className="animate-spin mb-1" />
                <span className="text-xs font-bold">Compressing image...</span>
              </div>
            ) : (
              <>
                <div className="p-3 bg-white rounded-full shadow-sm mb-2 text-blue-600">
                  <Camera size={26} />
                </div>
                <span className="font-bold text-sm text-[#14213D]">Take Photo or Choose from Gallery</span>
                <span className="text-[11px] text-gray-400 mt-0.5">Camera capture & offline image storage supported</span>
              </>
            )}
          </div>
        )}

        {photoError && (
          <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center text-xs text-red-700">
            <AlertCircle size={14} className="mr-1.5 flex-shrink-0" />
            <span>{photoError}</span>
          </div>
        )}
      </div>

      {/* 1. Category Selection */}
      <h2 className="font-bold mb-3 text-sm text-gray-700">1. Select Material</h2>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {CATEGORIES.map(cat => (
          <button 
            key={cat.id}
            type="button"
            onClick={() => setMaterial(cat)}
            className={`p-3 rounded-xl flex flex-col items-center text-center border-2 transition-all ${
              material.id === cat.id 
                ? 'border-blue-600 bg-blue-50 shadow-sm' 
                : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
          >
            <span className="text-2xl mb-1">{cat.icon}</span>
            <span className="text-xs font-semibold">{cat.name}</span>
          </button>
        ))}
      </div>

      {/* 2. Condition Selection */}
      <h2 className="font-bold mb-3 text-sm text-gray-700">2. Material Condition</h2>
      <div className="space-y-2 mb-6">
        {CONDITIONS.map(cond => (
          <div
            key={cond.id}
            onClick={() => setCondition(cond.id)}
            className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition ${
              condition === cond.id
                ? 'border-blue-600 bg-blue-50 shadow-sm'
                : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
          >
            <div className="flex items-center">
              <span className="text-xl mr-3">{cond.icon}</span>
              <div>
                <p className="font-bold text-xs text-[#14213D]">{cond.label}</p>
                <p className="text-[11px] text-gray-500">{cond.desc}</p>
              </div>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              condition === cond.id ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
            }`}>
              {condition === cond.id && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
            </div>
          </div>
        ))}
      </div>

      {/* 3. Weight Input */}
      <h2 className="font-bold mb-3 flex items-center text-sm text-gray-700">
        <Weight size={16} className="mr-2" /> 3. Enter Approx Weight (kg)
      </h2>
      <input 
        type="number" 
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        placeholder="e.g. 5.5"
        step="0.1"
        className="w-full text-2xl p-4 rounded-xl border border-gray-300 mb-6 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-mono"
      />

      {/* Estimate Card */}
      <div className="bg-yellow-50 p-4 rounded-xl mb-6 flex justify-between items-center border border-yellow-200">
        <div className="flex items-center text-yellow-800">
          <Calculator size={20} className="mr-2" />
          <span className="font-semibold text-sm">Estimated Value</span>
        </div>
        <div className="text-2xl font-black text-yellow-900">
          ₹ {weight ? (parseFloat(weight) * material.rate).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}
        </div>
      </div>

      <button 
        type="button"
        onClick={handleSave}
        disabled={!weight}
        className="w-full bg-[#14213D] hover:bg-blue-900 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 active:scale-[0.98] transition shadow-lg"
      >
        Save to My Load
      </button>
    </div>
  );
}
