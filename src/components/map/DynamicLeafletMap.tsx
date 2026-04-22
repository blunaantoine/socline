'use client';

import dynamic from 'next/dynamic';

// Dynamically import LeafletMap with SSR disabled to avoid window errors
export const DynamicLeafletMap = dynamic(
  () => import('./LeafletMap').then((mod) => mod.LeafletMap),
  { 
    ssr: false,
    loading: () => (
      <div 
        className="rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center"
        style={{ height: '100%', minHeight: '300px' }}
      >
        <div className="text-gray-400">Chargement de la carte...</div>
      </div>
    )
  }
);

export default DynamicLeafletMap;
