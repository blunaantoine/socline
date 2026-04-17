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
import { MapPin, Calendar, Sparkles, Car, Clock, Shield, Phone, Mail, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import GoogleMap to avoid SSR issues
const GoogleMapPreview = dynamic(
  () => import('@/components/map/GoogleMap').then(mod => mod.GoogleMap),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-slate-700 rounded-2xl animate-pulse flex items-center justify-center">
        <div className="text-slate-500">Chargement de la carte...</div>
      </div>
    )
  }
);

export default function WashGoApp() {
  const { isAuthenticated, user, isLoading, setLoading } = useAuthStore();
  const { currentView, setView } = useAppStore();
  const [showAuth, setShowAuth] = useState(false);
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const defaultView = useMemo(() => {
    if (!user) return 'client';
    if (user.role === 'ADMIN') return 'admin';
    if (user.role === 'WASHER') return 'washer';
    return 'client';
  }, [user]);

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setLoading(false);
      setInitialized(true);
    };
    checkAuth();
  }, [setLoading]);

  useEffect(() => {
    if (initialized && isAuthenticated && user) {
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-slate-800">WashGo</h2>
          <p className="text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
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

function LandingPage({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">WashGo</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={onLogin}
                className="text-slate-300 hover:text-white transition-colors"
              >
                Connexion
              </button>
              <button
                onClick={onLogin}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Commencer
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                Service disponible 7j/7
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Votre lavage auto,<br />
                <span className="text-emerald-400">livré à votre porte</span>
              </h1>
              <p className="text-lg text-slate-400 mb-8 max-w-lg">
                Réservez un lavage professionnel en quelques clics. 
                Nos laveurs certifiés viennent à vous, où que vous soyez.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onLogin}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:shadow-lg hover:shadow-emerald-500/25"
                >
                  Réserver un lavage
                </button>
                <button className="flex items-center justify-center gap-2 text-slate-300 hover:text-white px-8 py-4 rounded-xl font-medium border border-slate-700 hover:border-slate-600 transition-colors">
                  <Phone className="w-5 h-5" />
                  Nous contacter
                </button>
              </div>
              <div className="flex items-center gap-8 mt-10 pt-10 border-t border-slate-800">
                <div>
                  <div className="text-3xl font-bold text-white">2000+</div>
                  <div className="text-slate-500">Clients satisfaits</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-white">30+</div>
                  <div className="text-slate-500">Laveurs certifiés</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-white">4.8</div>
                  <div className="text-slate-500">Note moyenne</div>
                </div>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-slate-900 rounded-3xl blur-3xl"></div>
              <div className="relative bg-slate-800 rounded-3xl overflow-hidden border border-slate-700">
                {/* Map Preview */}
                <div className="h-64 relative">
                  <GoogleMapPreview
                    center={{ lat: 6.1725, lng: 1.2314 }}
                    zoom={15}
                    markers={[
                      {
                        id: 'washer-1',
                        type: 'WASHER',
                        position: { lat: 6.1735, lng: 1.2324 },
                        label: 'Kofi Mensah',
                        data: { rating: 4.9, completedJobs: 156 }
                      },
                      {
                        id: 'washer-2',
                        type: 'WASHER',
                        position: { lat: 6.1715, lng: 1.2304 },
                        label: 'Yaw Adzimah',
                        data: { rating: 4.7, completedJobs: 120 }
                      },
                      {
                        id: 'station-1',
                        type: 'STATION',
                        position: { lat: 6.1745, lng: 1.2294 },
                        label: 'Auto Shine Lomé',
                        data: { rating: 4.8, totalRatings: 156 }
                      },
                    ]}
                    showUserLocation={true}
                    height="100%"
                    className="rounded-none"
                  />
                </div>
                {/* Order Card Overlay */}
                <div className="p-6 bg-slate-800">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                      <Car className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">Lavage en cours</div>
                      <div className="text-slate-500 text-sm">Arrivée dans 12 min</div>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-4">
                    <div className="h-full w-3/4 bg-emerald-500 rounded-full"></div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-medium">
                        KM
                      </div>
                      <div>
                        <div className="text-white font-medium">Kofi Mensah</div>
                        <div className="flex items-center gap-1 text-sm text-amber-400">
                          <Sparkles className="w-3 h-3 fill-current" />
                          4.9
                        </div>
                      </div>
                    </div>
                    <button className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-lg transition-colors">
                      <Phone className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Comment ça marche
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Trois étapes simples pour un véhicule impeccable
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: MapPin,
                title: 'Localisez',
                description: 'Trouvez des laveurs disponibles près de chez vous en temps réel.'
              },
              {
                step: '02',
                icon: Calendar,
                title: 'Réservez',
                description: 'Choisissez votre service et planifiez votre lavage à votre convenance.'
              },
              {
                step: '03',
                icon: Sparkles,
                title: 'Profitez',
                description: 'Suivez le laveur en temps réel et obtenez un résultat impeccable.'
              }
            ].map((feature, index) => (
              <div key={index} className="relative group">
                <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 hover:border-emerald-500/50 transition-colors h-full">
                  <div className="text-5xl font-bold text-slate-700 group-hover:text-emerald-500/30 transition-colors mb-4">
                    {feature.step}
                  </div>
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Nos Services
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Des formules adaptées à tous vos besoins
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Express', price: '5 000', duration: '20 min', description: 'Lavage extérieur rapide' },
              { name: 'Complet', price: '10 000', duration: '45 min', description: 'Intérieur + Extérieur' },
              { name: 'Premium', price: '15 000', duration: '60 min', description: 'Complet + Polish + Cire' },
              { name: 'Deluxe', price: '25 000', duration: '90 min', description: 'Service VIP complet' }
            ].map((service, index) => (
              <div key={index} className="group bg-slate-800 rounded-2xl p-6 border border-slate-700 hover:border-emerald-500/50 transition-all hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-slate-500 text-sm font-medium">{service.duration}</span>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">{service.name}</h3>
                <p className="text-slate-500 text-sm mb-4">{service.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-white">{service.price}</span>
                  <span className="text-slate-500 text-sm">FCFA</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Laveurs vérifiés</h3>
                <p className="text-slate-400">Tous nos laveurs sont certifiés et formés professionnellement.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Service rapide</h3>
                <p className="text-slate-400">Un laveur à votre porte en moins de 30 minutes.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Qualité garantie</h3>
                <p className="text-slate-400">Satisfaction garantie ou nous revenons gratuitement.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Prêt à commencer ?
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Rejoignez des milliers de clients satisfaits et prenez soin de votre véhicule.
          </p>
          <button
            onClick={onLogin}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:shadow-lg hover:shadow-emerald-500/25"
          >
            Créer un compte gratuit
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">WashGo</span>
              </div>
              <p className="text-slate-500 text-sm">
                Votre lavage auto, livré à votre porte.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Services</h4>
              <ul className="space-y-2 text-slate-500 text-sm">
                <li>Lavage Express</li>
                <li>Lavage Complet</li>
                <li>Lavage Premium</li>
                <li>Lavage Deluxe</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Entreprise</h4>
              <ul className="space-y-2 text-slate-500 text-sm">
                <li>À propos</li>
                <li>Carrières</li>
                <li>Blog</li>
                <li>Presse</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-slate-500 text-sm">
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  +228 90 12 34 56
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  contact@washgo.tg
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-slate-500 text-sm">
              2024 WashGo. Tous droits réservés.
            </p>
            <div className="flex items-center gap-6 mt-4 md:mt-0">
              <a href="#" className="text-slate-500 hover:text-white text-sm transition-colors">Confidentialité</a>
              <a href="#" className="text-slate-500 hover:text-white text-sm transition-colors">Conditions</a>
              <a href="#" className="text-slate-500 hover:text-white text-sm transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
