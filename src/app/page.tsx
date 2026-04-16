'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuthStore, useAppStore } from '@/store';
import { ClientApp } from '@/components/client/ClientApp';
import { WasherApp } from '@/components/washer/WasherApp';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { AuthModal } from '@/components/washgo/AuthModal';
import { RoleSelector } from '@/components/washgo/RoleSelector';
import { Header } from '@/components/washgo/Header';
import { Toaster } from '@/components/ui/sonner';

export default function WashGoApp() {
  const { isAuthenticated, user, isLoading, setLoading } = useAuthStore();
  const { currentView, setView } = useAppStore();
  const [showAuth, setShowAuth] = useState(false);
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Derive the default view based on user role
  const defaultView = useMemo(() => {
    if (!user) return 'client';
    if (user.role === 'ADMIN') return 'admin';
    if (user.role === 'WASHER') return 'washer';
    return 'client';
  }, [user]);

  useEffect(() => {
    // Simulate checking auth status
    const checkAuth = async () => {
      setLoading(true);
      // In a real app, this would verify the token with the backend
      await new Promise((resolve) => setTimeout(resolve, 500));
      setLoading(false);
      setInitialized(true);
    };
    checkAuth();
  }, [setLoading]);

  // Set default view when user authenticates
  useEffect(() => {
    if (initialized && isAuthenticated && user) {
      // Use setTimeout to defer state updates
      const timer = setTimeout(() => {
        setShowRoleSelector(true);
        setView(defaultView);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialized, isAuthenticated, user, defaultView, setView]);

  const handleRoleSelect = (view: 'client' | 'washer' | 'admin') => {
    setView(view);
    setShowRoleSelector(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4">
            <svg className="animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25 text-blue-500" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800">WashGo</h2>
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {!isAuthenticated ? (
        <>
          <LandingPage onLogin={() => setShowAuth(true)} />
          {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        </>
      ) : (
        <>
          <Header />
          <main className="pt-16">
            {currentView === 'client' && <ClientApp />}
            {currentView === 'washer' && <WasherApp />}
            {currentView === 'admin' && <AdminPanel />}
          </main>
          {showRoleSelector && user && user.role === 'ADMIN' && (
            <RoleSelector onSelect={handleRoleSelect} />
          )}
        </>
      )}
      <Toaster />
    </div>
  );
}

// Landing Page Component
function LandingPage({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-500 to-green-500">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                <svg className="w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              WashGo
            </h1>
            <p className="text-xl sm:text-2xl text-white/90 mb-4">
              Votre lavage auto, livré à votre porte
            </p>
            <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
              Réservez un lavage professionnel en quelques clics. 
              Nos laveurs certifiés viennent à vous, où que vous soyez.
            </p>
            <button
              onClick={onLogin}
              className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
            >
              Commencer
            </button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Comment ça marche
            </h2>
            <p className="text-gray-600 text-lg">
              Simple, rapide et efficace
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '📍',
                title: 'Localisez',
                description: 'Trouvez des laveurs disponibles près de chez vous en temps réel.'
              },
              {
                icon: '🚿',
                title: 'Réservez',
                description: 'Choisissez votre service et planifiez votre lavage.'
              },
              {
                icon: '✨',
                title: 'Profitez',
                description: 'Suivez le laveur en temps réel et obtenez un résultat impeccable.'
              }
            ].map((feature, index) => (
              <div key={index} className="bg-gray-50 rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
                <div className="text-5xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Services Preview */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Nos Services
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Lavage Express', price: '5 000', duration: '20 min', icon: '🚗' },
              { name: 'Lavage Complet', price: '10 000', duration: '45 min', icon: '🧽' },
              { name: 'Lavage Premium', price: '15 000', duration: '60 min', icon: '✨' },
              { name: 'Lavage Deluxe', price: '25 000', duration: '90 min', icon: '💎' }
            ].map((service, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-4xl mb-3">{service.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{service.name}</h3>
                <p className="text-sm text-gray-500 mb-2">{service.duration}</p>
                <p className="text-xl font-bold text-blue-600">{service.price} FCFA</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-600 to-green-500 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Prêt à commencer ?
          </h2>
          <p className="text-white/90 text-lg mb-8">
            Rejoignez des milliers de clients satisfaits
          </p>
          <button
            onClick={onLogin}
            className="bg-white text-blue-600 px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-shadow"
          >
            Créer un compte
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <span className="text-xl font-bold">WashGo</span>
            </div>
            <p className="text-gray-400 text-sm">
              © 2024 WashGo. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
