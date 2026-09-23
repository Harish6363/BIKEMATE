import React from 'react';

function MapStub({ origin, destination }) {
  return (
    <div className="w-full h-64 bg-gray-200 rounded-lg border-2 border-dashed border-gray-400 flex flex-col items-center justify-center mt-4 text-gray-500">
      <svg className="w-12 h-12 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
      <p className="font-semibold">Google Maps Integration Area</p>
      <p className="text-sm">Origin: {origin || 'Not set'} | Dest: {destination || 'Not set'}</p>
    </div>
  );
}

export default MapStub;
