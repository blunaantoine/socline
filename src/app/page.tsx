'use client';

import { useState } from 'react';

export default function SoclineApp() {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FF9800', display: 'flex', flexDirection: 'column' }}>
      {/* Status Bar */}
      <div style={{ height: 24, backgroundColor: '#FF9800', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
        <span style={{ color: 'white', fontSize: 12, fontWeight: 500 }}>9:41</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
            <div style={{ width: 4, height: 4, backgroundColor: 'white', borderRadius: 2 }}></div>
            <div style={{ width: 4, height: 8, backgroundColor: 'white', borderRadius: 2 }}></div>
            <div style={{ width: 4, height: 12, backgroundColor: 'white', borderRadius: 2 }}></div>
            <div style={{ width: 4, height: 16, backgroundColor: 'white', borderRadius: 2 }}></div>
          </div>
          <div style={{ width: 20, height: 10, border: '2px solid white', borderRadius: 2, marginLeft: 4, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 2, backgroundColor: 'white', borderRadius: 2, width: '70%' }}></div>
          </div>
        </div>
      </div>

      {/* App Bar */}
      <div style={{ backgroundColor: '#FF9800', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
        <h1 style={{ color: 'white', fontSize: 24, fontWeight: 'bold', margin: 0 }}>Socline</h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, margin: '4px 0 0 0' }}>Votre lavage auto, livré à votre porte</p>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'white' }}>
        {/* Logo */}
        <div style={{ width: 96, height: 96, backgroundColor: '#FF9800', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: '0 4px 8px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
          <img src="/android-chrome-192x192.png" alt="Socline" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        {/* Info Card */}
        <div style={{ backgroundColor: '#FFF8F0', borderRadius: 12, padding: 24, textAlign: 'center', border: '1px solid #FFE0B2', width: '100%', maxWidth: 300 }}>
          <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>🚗</span>
          <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#212121', marginBottom: 4 }}>Lavage à domicile</h2>
          <p style={{ color: '#757575', fontSize: 14 }}>Votre voiture propre sans bouger</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 32, marginTop: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#FF9800' }}>2000+</div>
            <div style={{ fontSize: 12, color: '#757575' }}>Clients</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#FF9800' }}>30+</div>
            <div style={{ fontSize: 12, color: '#757575' }}>Laveurs</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#FF9800' }}>4.8</div>
            <div style={{ fontSize: 12, color: '#757575' }}>Note</div>
          </div>
        </div>
      </div>

      {/* Bottom Buttons */}
      <div style={{ padding: 16, backgroundColor: '#FAFAFA', borderTop: '1px solid #E0E0E0' }}>
        <button
          onClick={() => setShowAuth(true)}
          style={{ width: '100%', backgroundColor: '#FF9800', color: 'white', padding: '14px 0', borderRadius: 8, fontWeight: 600, fontSize: 16, border: 'none', marginBottom: 12, cursor: 'pointer' }}
        >
          Commencer
        </button>
        <button
          onClick={() => setShowAuth(true)}
          style={{ width: '100%', backgroundColor: 'transparent', color: '#FF9800', padding: '14px 0', borderRadius: 8, fontWeight: 600, fontSize: 16, border: '2px solid #FF9800', cursor: 'pointer' }}
        >
          Se connecter
        </button>
      </div>

      {/* Android Navigation Bar */}
      <div style={{ height: 48, backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 64 }}>
        <div style={{ width: 20, height: 20, border: '2px solid white', borderRadius: '50%' }}></div>
        <div style={{ width: 20, height: 20, border: '2px solid white', borderRadius: 4 }}></div>
        <div style={{ width: 16, height: 16, border: '2px solid white', transform: 'rotate(45deg)' }}></div>
      </div>

      {/* Auth Modal */}
      {showAuth && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 24, padding: 24, maxWidth: 400, width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
            <h2 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>Connexion</h2>
            <p style={{ textAlign: 'center', color: '#757575', marginBottom: 16 }}>Entrez vos informations</p>
            
            <input
              type="text"
              placeholder="Nom complet"
              style={{ width: '100%', padding: 12, border: '1px solid #E0E0E0', borderRadius: 8, marginBottom: 12, fontSize: 14 }}
            />
            <input
              type="tel"
              placeholder="Téléphone (+228)"
              style={{ width: '100%', padding: 12, border: '1px solid #E0E0E0', borderRadius: 8, marginBottom: 12, fontSize: 14 }}
            />
            <input
              type="password"
              placeholder="Code PIN (4 chiffres)"
              style={{ width: '100%', padding: 12, border: '1px solid #E0E0E0', borderRadius: 8, marginBottom: 16, fontSize: 14 }}
            />
            
            <button
              onClick={() => {
                alert('Bienvenue sur Socline! Connexion réussie.');
                setShowAuth(false);
              }}
              style={{ width: '100%', backgroundColor: '#FF9800', color: 'white', padding: 14, borderRadius: 8, fontWeight: 600, fontSize: 16, border: 'none', marginBottom: 8, cursor: 'pointer' }}
            >
              Se connecter
            </button>
            <button
              onClick={() => setShowAuth(false)}
              style={{ width: '100%', backgroundColor: 'transparent', color: '#757575', padding: 12, fontSize: 14, border: 'none', cursor: 'pointer' }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
