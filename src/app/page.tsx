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
import { 
  MapPin, Calendar, Sparkles, Car, Clock, Shield, Phone, Mail, 
  ChevronRight, Star, Zap, Menu, X
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import GoogleMap to avoid SSR issues
const GoogleMapPreview = dynamic(
  () => import('@/components/map/GoogleMap').then(mod => mod.GoogleMap),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#F5F5F5] rounded-2xl animate-pulse flex items-center justify-center">
        <div className="text-[#9E9E9E]">Chargement de la carte...</div>
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
      <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 border-4 border-[#FFE0B2] rounded-full"></div>
            <div className="absolute inset-0 border-4 border-[#FF9800] rounded-full border-t-transparent animate-spin"></div>
          </div>
          <h2 className="text-xl font-bold text-[#212121]">WashGo</h2>
          <p className="text-[#757575]">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8F0]">
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FFF8F0]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#FFE0B2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#FF9800] rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-[#212121]">WashGo</span>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-6">
              <a href="#services" className="text-[#757575] hover:text-[#FF9800] transition-colors">Services</a>
              <a href="#how-it-works" className="text-[#757575] hover:text-[#FF9800] transition-colors">Comment ça marche</a>
              <a href="#contact" className="text-[#757575] hover:text-[#FF9800] transition-colors">Contact</a>
              <button
                onClick={onLogin}
                className="text-[#757575] hover:text-[#FF9800] transition-colors"
              >
                Connexion
              </button>
              <button
                onClick={onLogin}
                className="bg-[#FF9800] hover:bg-[#F57C00] text-white px-5 py-2 rounded-xl font-medium transition-colors"
              >
                Commencer
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-[#212121]" />
              ) : (
                <Menu className="w-6 h-6 text-[#212121]" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-[#FFE0B2] px-4 py-4 space-y-3">
            <a href="#services" className="block text-[#757575] hover:text-[#FF9800] transition-colors py-2">Services</a>
            <a href="#how-it-works" className="block text-[#757575] hover:text-[#FF9800] transition-colors py-2">Comment ça marche</a>
            <a href="#contact" className="block text-[#757575] hover:text-[#FF9800] transition-colors py-2">Contact</a>
            <button onClick={onLogin} className="block text-[#757575] hover:text-[#FF9800] transition-colors py-2 w-full text-left">Connexion</button>
            <button
              onClick={onLogin}
              className="w-full bg-[#FF9800] hover:bg-[#F57C00] text-white px-5 py-3 rounded-xl font-medium transition-colors"
            >
              Commencer
            </button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#FFF3E0] text-[#FF9800] px-4 py-2 rounded-full text-sm font-medium mb-6">
                <span className="w-2 h-2 bg-[#FF9800] rounded-full animate-pulse"></span>
                Service disponible 7j/7 à Lomé
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#212121] mb-6 leading-tight">
                Votre lavage auto,<br />
                <span className="text-[#FF9800]">livré à votre porte</span>
              </h1>
              <p className="text-lg text-[#757575] mb-8 max-w-lg">
                Réservez un lavage professionnel en quelques clics. 
                Nos laveurs certifiés viennent à vous, où que vous soyez.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onLogin}
                  className="bg-[#FF9800] hover:bg-[#F57C00] text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg shadow-[#FF9800]/25"
                >
                  Réserver un lavage
                </button>
                <button className="flex items-center justify-center gap-2 text-[#757575] hover:text-[#FF9800] px-8 py-4 rounded-xl font-medium border border-[#FFE0B2] hover:border-[#FF9800] transition-colors bg-white">
                  <Phone className="w-5 h-5" />
                  Nous contacter
                </button>
              </div>
              
              {/* Stats */}
              <div className="flex items-center gap-8 mt-10 pt-10 border-t border-[#FFE0B2]">
                <div>
                  <div className="text-3xl font-bold text-[#212121]">2000+</div>
                  <div className="text-[#757575] text-sm">Clients satisfaits</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-[#212121]">30+</div>
                  <div className="text-[#757575] text-sm">Laveurs certifiés</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-[#212121]">4.8</div>
                  <div className="text-[#757575] text-sm">Note moyenne</div>
                </div>
              </div>
            </div>
            
            {/* Hero Image / Map */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-r from-[#FF9800]/20 to-[#FFF8F0] rounded-3xl blur-3xl"></div>
              <div className="relative bg-white rounded-3xl overflow-hidden shadow-xl border border-[#FFE0B2]">
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
                <div className="p-4 bg-white">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 bg-[#FFF3E0] rounded-full flex items-center justify-center">
                      <Car className="w-6 h-6 text-[#FF9800]" />
                    </div>
                    <div>
                      <div className="text-[#212121] font-semibold">Lavage en cours</div>
                      <div className="text-[#757575] text-sm">Arrivée dans 12 min</div>
                    </div>
                  </div>
                  <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden mb-4">
                    <div className="h-full w-3/4 bg-[#FF9800] rounded-full"></div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#FFF8F0] rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#FF9800] rounded-full flex items-center justify-center text-white font-medium">
                        KM
                      </div>
                      <div>
                        <div className="text-[#212121] font-medium">Kofi Mensah</div>
                        <div className="flex items-center gap-1 text-sm text-[#FF9800]">
                          <Star className="w-3 h-3 fill-current" />
                          4.9
                        </div>
                      </div>
                    </div>
                    <button className="bg-[#FF9800] hover:bg-[#F57C00] text-white p-2 rounded-lg transition-colors">
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
      <section id="how-it-works" className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#212121] mb-4">
              Comment ça marche
            </h2>
            <p className="text-[#757575] text-lg max-w-2xl mx-auto">
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
                <div className="bg-[#FFF8F0] rounded-2xl p-8 border border-[#FFE0B2] hover:border-[#FF9800] transition-colors h-full">
                  <div className="text-5xl font-bold text-[#FFE0B2] group-hover:text-[#FF9800]/30 transition-colors mb-4">
                    {feature.step}
                  </div>
                  <div className="w-12 h-12 bg-[#FF9800]/10 rounded-xl flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-[#FF9800]" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#212121] mb-2">{feature.title}</h3>
                  <p className="text-[#757575]">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#212121] mb-4">
              Nos Services
            </h2>
            <p className="text-[#757575] text-lg max-w-2xl mx-auto">
              Des formules adaptées à tous vos besoins
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Express', price: '5 000', duration: '20 min', description: 'Lavage extérieur rapide', icon: Zap },
              { name: 'Complet', price: '10 000', duration: '45 min', description: 'Intérieur + Extérieur', icon: Car },
              { name: 'Premium', price: '15 000', duration: '60 min', description: 'Complet + Polish + Cire', icon: Sparkles },
              { name: 'Deluxe', price: '25 000', duration: '90 min', description: 'Service VIP complet', icon: Shield }
            ].map((service, index) => (
              <div key={index} className="group bg-white rounded-2xl p-6 border border-[#FFE0B2] hover:border-[#FF9800] transition-all hover:-translate-y-1 hover:shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[#757575] text-sm font-medium">{service.duration}</span>
                  <ChevronRight className="w-4 h-4 text-[#9E9E9E] group-hover:text-[#FF9800] transition-colors" />
                </div>
                <div className="w-12 h-12 bg-[#FFF3E0] rounded-xl flex items-center justify-center mb-4">
                  <service.icon className="w-6 h-6 text-[#FF9800]" />
                </div>
                <h3 className="text-lg font-semibold text-[#212121] mb-1">{service.name}</h3>
                <p className="text-[#757575] text-sm mb-4">{service.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-[#FF9800]">{service.price}</span>
                  <span className="text-[#757575] text-sm">FCFA</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#FFF3E0] rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-[#FF9800]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#212121] mb-2">Laveurs vérifiés</h3>
                <p className="text-[#757575]">Tous nos laveurs sont certifiés et formés professionnellement.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#FFF3E0] rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-[#FF9800]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#212121] mb-2">Service rapide</h3>
                <p className="text-[#757575]">Un laveur à votre porte en moins de 30 minutes.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#FFF3E0] rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-[#FF9800]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#212121] mb-2">Qualité garantie</h3>
                <p className="text-[#757575]">Satisfaction garantie ou nous revenons gratuitement.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-[#FF9800] to-[#F57C00] rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute right-0 top-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute left-0 bottom-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Prêt à commencer ?
              </h2>
              <p className="text-white/90 text-lg mb-8 max-w-2xl mx-auto">
                Rejoignez des milliers de clients satisfaits et prenez soin de votre véhicule.
              </p>
              <button
                onClick={onLogin}
                className="bg-white text-[#FF9800] hover:bg-white/90 px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg"
              >
                Créer un compte gratuit
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-white border-t border-[#FFE0B2] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-[#FF9800] rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-[#212121]">WashGo</span>
              </div>
              <p className="text-[#757575] text-sm">
                Votre lavage auto, livré à votre porte.
              </p>
            </div>
            <div>
              <h4 className="text-[#212121] font-semibold mb-4">Services</h4>
              <ul className="space-y-2 text-[#757575] text-sm">
                <li>Lavage Express</li>
                <li>Lavage Complet</li>
                <li>Lavage Premium</li>
                <li>Lavage Deluxe</li>
              </ul>
            </div>
            <div>
              <h4 className="text-[#212121] font-semibold mb-4">Entreprise</h4>
              <ul className="space-y-2 text-[#757575] text-sm">
                <li>À propos</li>
                <li>Carrières</li>
                <li>Blog</li>
                <li>Presse</li>
              </ul>
            </div>
            <div>
              <h4 className="text-[#212121] font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-[#757575] text-sm">
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#FF9800]" />
                  +228 90 12 34 56
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#FF9800]" />
                  contact@washgo.tg
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#FF9800]" />
                  Lomé, Togo
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[#FFE0B2] pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-[#757575] text-sm">
              2024 WashGo. Tous droits réservés.
            </p>
            <div className="flex items-center gap-6 mt-4 md:mt-0">
              <a href="#" className="text-[#757575] hover:text-[#FF9800] text-sm transition-colors">Confidentialité</a>
              <a href="#" className="text-[#757575] hover:text-[#FF9800] text-sm transition-colors">Conditions</a>
              <a href="#" className="text-[#757575] hover:text-[#FF9800] text-sm transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
