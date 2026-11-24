'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Building2, Car, Droplets, FileText, Home, LogOut, Plus, RefreshCw, Loader2,
  CheckCircle, Clock, UserRound, Pencil, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store';
import { useKeyboardOpen } from '@/hooks/useKeyboardOpen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BTN_PRIMARY_CLASSES, CARD_CLASSES } from '@/lib/design-system';
import { formatPrice } from '@/lib/service-coverage';

/**
 * Espace entreprise (rôle COMPANY) — offre Socline Entreprises.
 * Le gestionnaire suit sa flotte : voitures et conducteurs, lavages du mois
 * (avec photos avant / après), quotas et factures mensuelles.
 */

type Tab = 'home' | 'vehicles' | 'washes' | 'invoices';

interface Summary {
  company: { name: string; sector: string | null };
  contract: {
    washesPerVehicle: number;
    pricePerVehicle: number;
    maxVehicles: number;
    service: { name: string; price: number };
  } | null;
  period: string;
  activeVehicles: number;
  invitedDrivers: number;
  washesDone: number;
  washesInProgress: number;
  washesIncluded: number;
  monthlyAmount: number;
  invoice: Invoice | null;
}

interface Vehicle {
  id: string;
  plateNumber: string;
  brand: string | null;
  model: string | null;
  color: string;
  driverName: string | null;
  driverPhone: string;
  isActive: boolean;
  driverStatus: 'ACTIVE' | 'INVITED';
  washesUsed: number;
  washesIncluded: number;
  washesRemaining: number;
}

interface CompanyOrder {
  id: string;
  orderNumber: string;
  status: string;
  basePrice: number;
  address: string;
  createdAt: string;
  completedAt: string | null;
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  service: { name: string };
  client: { name: string | null; phone: string };
  fleetVehicle: { id: string; plateNumber: string; brand: string | null; model: string | null } | null;
  washer: { user: { name: string | null } } | null;
  review: { rating: number; comment: string | null } | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  period: string;
  vehicleCount: number;
  washesIncluded: number;
  washesDone: number;
  pricePerVehicle: number;
  amount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  paidAt: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  EN_ROUTE: 'En route',
  ARRIVED: 'Laveur arrivé',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
};

const SAFE_TOP = 'pt-[calc(1rem+max(env(safe-area-inset-top),var(--safe-area-inset-top,0px)))]';
const SAFE_BOTTOM_PAD = 'pb-[calc(5rem+max(env(safe-area-inset-bottom),var(--safe-area-inset-bottom,0px)))]';

function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function thisPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      if (init?.method && init.method !== 'GET') toast.error(data?.error || 'Une erreur est survenue');
      return null;
    }
    return data as T;
  } catch {
    toast.error('Connexion impossible. Vérifiez votre réseau.');
    return null;
  }
}

export function CompanyApp() {
  const { user, logout } = useAuthStore();
  const keyboardOpen = useKeyboardOpen();
  const [tab, setTab] = useState<Tab>('home');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [s, v] = await Promise.all([
      getJson<Summary & { success: true }>('/api/company/summary'),
      getJson<{ vehicles: Vehicle[] }>('/api/company/vehicles'),
    ]);
    if (s) setSummary(s);
    if (v) setVehicles(v.vehicles);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial des données
    void refresh();
  }, [refresh]);

  return (
    <div className="h-full flex flex-col bg-app">
      {/* En-tête */}
      <header className={`bg-ink text-white px-4 ${SAFE_TOP} pb-4`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-detail text-white/70">Socline Entreprises</p>
              <h1 className="text-section font-bold truncate">{summary?.company.name || 'Mon entreprise'}</h1>
            </div>
          </div>
          <button
            onClick={() => void refresh()}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full active:bg-white/10"
            aria-label="Rafraîchir"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className={`flex-1 overflow-y-auto px-4 pt-4 ${SAFE_BOTTOM_PAD}`}>
        {tab === 'home' && (
          <HomeTab summary={summary} loading={loading} userName={user?.name || ''} onLogout={logout} onGo={setTab} />
        )}
        {tab === 'vehicles' && (
          <VehiclesTab vehicles={vehicles} summary={summary} loading={loading} onChanged={refresh} />
        )}
        {tab === 'washes' && <WashesTab vehicles={vehicles} />}
        {tab === 'invoices' && <InvoicesTab />}
      </main>

      <nav
        className={`fixed bottom-0 left-0 right-0 bg-surface border-t border-line flex justify-around items-stretch h-[calc(3.75rem+max(env(safe-area-inset-bottom),var(--safe-area-inset-bottom,0px)))] pb-[max(env(safe-area-inset-bottom),var(--safe-area-inset-bottom,0px))] z-50${keyboardOpen ? ' hidden' : ''}`}
        aria-label="Navigation de l'espace entreprise"
      >
        {([
          { id: 'home', icon: Home, label: 'Accueil' },
          { id: 'vehicles', icon: Car, label: 'Véhicules' },
          { id: 'washes', icon: Droplets, label: 'Lavages' },
          { id: 'invoices', icon: FileText, label: 'Factures' },
        ] as const).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:bg-app ${active ? 'text-brand-ink' : 'text-soft'}`}
            >
              <t.icon className="w-6 h-6" aria-hidden="true" />
              <span className="text-micro font-semibold">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Accueil                                                             */
/* ------------------------------------------------------------------ */

function HomeTab({
  summary, loading, userName, onLogout, onGo,
}: {
  summary: Summary | null;
  loading: boolean;
  userName: string;
  onLogout: () => void;
  onGo: (t: Tab) => void;
}) {
  if (loading && !summary) return <Spinner />;
  if (!summary) return <EmptyCard text="Impossible de charger votre espace. Touchez Rafraîchir." />;
  const { contract } = summary;
  const progress = summary.washesIncluded > 0 ? Math.min(100, Math.round((summary.washesDone / summary.washesIncluded) * 100)) : 0;

  return (
    <div className="space-y-4">
      <p className="text-body text-soft">Bonjour{userName ? ` ${userName.split(' ')[0]}` : ''} 👋</p>

      <section className={`p-4 ${CARD_CLASSES}`}>
        <div className="flex items-baseline justify-between">
          <h2 className="text-section text-ink">Lavages de {periodLabel(summary.period).toLowerCase()}</h2>
        </div>
        <p className="mt-2 text-display font-extrabold text-ink tabular-nums">
          {summary.washesDone}
          <span className="text-title font-semibold text-soft"> / {summary.washesIncluded}</span>
        </p>
        <div className="mt-3 h-2 rounded-full bg-app overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-brand rounded-full transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-detail text-soft">
          {summary.washesInProgress > 0
            ? `${summary.washesInProgress} lavage${summary.washesInProgress > 1 ? 's' : ''} en cours en ce moment.`
            : 'Aucun lavage en cours.'}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onGo('vehicles')} className={`p-4 text-left ${CARD_CLASSES} active:scale-[0.98] transition-transform`}>
          <Car className="w-5 h-5 text-brand-ink" aria-hidden="true" />
          <p className="mt-2 text-title font-bold text-ink tabular-nums">
            {summary.activeVehicles}
            {contract ? <span className="text-body font-normal text-soft"> / {contract.maxVehicles}</span> : null}
          </p>
          <p className="text-detail text-soft">Voitures suivies</p>
        </button>
        <button onClick={() => onGo('vehicles')} className={`p-4 text-left ${CARD_CLASSES} active:scale-[0.98] transition-transform`}>
          <UserRound className="w-5 h-5 text-brand-ink" aria-hidden="true" />
          <p className="mt-2 text-title font-bold text-ink tabular-nums">{summary.invitedDrivers}</p>
          <p className="text-detail text-soft">Conducteur{summary.invitedDrivers > 1 ? 's' : ''} sans compte</p>
        </button>
      </div>

      <section className={`p-4 ${CARD_CLASSES}`}>
        <h2 className="text-section text-ink">Votre contrat</h2>
        {contract ? (
          <dl className="mt-3 space-y-2 text-body">
            <Row label="Formule" value={contract.service.name} />
            <Row label="Lavages par voiture" value={`${contract.washesPerVehicle} par mois`} />
            <Row label="Prix par voiture" value={`${formatPrice(contract.pricePerVehicle)} / mois`} />
            <Row label="Montant du mois" value={formatPrice(summary.monthlyAmount)} strong />
          </dl>
        ) : (
          <p className="mt-2 text-body text-soft">Aucun contrat actif. Contactez Socline au +228 71 99 81 55.</p>
        )}
      </section>

      <section className={`p-4 ${CARD_CLASSES} space-y-2`}>
        <h2 className="text-section text-ink">Comment ça marche ?</h2>
        <ol className="list-decimal pl-5 space-y-1.5 text-body text-soft">
          <li>Ajoutez vos voitures avec le nom et le numéro de chaque conducteur.</li>
          <li>Le conducteur ouvre Socline avec ce numéro : la voiture apparaît dans son compte.</li>
          <li>Il commande un lavage quand il veut, sans rien payer, dans la limite du quota du mois.</li>
          <li>Vous suivez chaque lavage ici, avec les photos avant / après.</li>
        </ol>
      </section>

      <div className="flex flex-col items-center gap-1 pt-2">
        <a href="/confidentialite" className="text-detail text-soft underline underline-offset-2 min-h-[44px] flex items-center">
          Politique de confidentialité
        </a>
        <button
          onClick={onLogout}
          className="w-full h-12 border border-line bg-surface text-danger rounded-btn font-semibold text-body flex items-center justify-center gap-2 active:bg-danger/5"
        >
          <LogOut className="w-5 h-5" aria-hidden="true" />
          Déconnexion
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Véhicules                                                           */
/* ------------------------------------------------------------------ */

const EMPTY_FORM = { plateNumber: '', brand: '', model: '', color: '', driverName: '', driverPhone: '' };

function VehiclesTab({
  vehicles, summary, loading, onChanged,
}: {
  vehicles: Vehicle[];
  summary: Summary | null;
  loading: boolean;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const max = summary?.contract?.maxVehicles ?? 0;
  const activeCount = vehicles.filter((v) => v.isActive).length;

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };
  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({
      plateNumber: v.plateNumber,
      brand: v.brand || '',
      model: v.model || '',
      color: v.color,
      driverName: v.driverName || '',
      driverPhone: v.driverPhone,
    });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const res = await getJson('/api/company/vehicles', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? { vehicleId: editing.id, ...form } : form),
    });
    setSaving(false);
    if (res) {
      toast.success(editing ? 'Véhicule mis à jour' : 'Véhicule ajouté — le conducteur peut maintenant commander');
      setOpen(false);
      await onChanged();
    }
  };

  const toggleActive = async (v: Vehicle) => {
    if (v.isActive && !window.confirm(`Retirer ${v.plateNumber} du contrat ? Le conducteur ne pourra plus commander pour cette voiture.`)) return;
    const res = await getJson('/api/company/vehicles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleId: v.id, isActive: !v.isActive }),
    });
    if (res) {
      toast.success(v.isActive ? 'Véhicule retiré' : 'Véhicule réactivé');
      await onChanged();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-section text-ink">Vos voitures</h2>
          <p className="text-detail text-soft">{activeCount}{max ? ` / ${max}` : ''} voiture{activeCount > 1 ? 's' : ''} suivie{activeCount > 1 ? 's' : ''}</p>
        </div>
        <Button
          onClick={openAdd}
          disabled={!summary?.contract || (max > 0 && activeCount >= max)}
          className={`h-11 px-4 ${BTN_PRIMARY_CLASSES} font-semibold`}
        >
          <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Ajouter
        </Button>
      </div>

      {loading && vehicles.length === 0 ? <Spinner /> : null}
      {!loading && vehicles.length === 0 ? (
        <EmptyCard text="Aucune voiture pour l'instant. Ajoutez la première avec le numéro de son conducteur." />
      ) : null}

      {vehicles.map((v) => (
        <article key={v.id} className={`p-4 ${CARD_CLASSES} ${v.isActive ? '' : 'opacity-60'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-body font-bold text-ink">{v.plateNumber}</p>
              <p className="text-detail text-soft truncate">
                {[v.brand, v.model].filter(Boolean).join(' ') || 'Véhicule'} · {v.color}
              </p>
            </div>
            {v.isActive ? (
              <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-micro font-bold tabular-nums ${v.washesRemaining > 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                {v.washesUsed}/{v.washesIncluded} ce mois
              </span>
            ) : (
              <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-micro font-bold bg-app text-soft">Retirée</span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 text-detail">
            <UserRound className="w-4 h-4 text-soft flex-shrink-0" aria-hidden="true" />
            <span className="text-ink truncate">{v.driverName || 'Conducteur'} · {v.driverPhone}</span>
            {v.driverStatus === 'ACTIVE' ? (
              <span className="ml-auto inline-flex items-center gap-1 text-success font-semibold flex-shrink-0">
                <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" /> Compte actif
              </span>
            ) : (
              <span className="ml-auto inline-flex items-center gap-1 text-soft font-semibold flex-shrink-0">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" /> Invité
              </span>
            )}
          </div>
          {v.driverStatus === 'INVITED' && v.isActive && (
            <p className="mt-2 text-detail text-soft bg-app rounded-btn p-2.5">
              Demandez au conducteur d&apos;ouvrir socline.oquitogo.com et de créer son compte avec le {v.driverPhone} : la voiture apparaîtra automatiquement.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button onClick={() => openEdit(v)} className="flex-1 h-11 rounded-btn border border-line text-body font-semibold text-ink inline-flex items-center justify-center gap-1.5 active:bg-app">
              <Pencil className="w-4 h-4" aria-hidden="true" /> Modifier
            </button>
            <button onClick={() => void toggleActive(v)} className={`flex-1 h-11 rounded-btn border text-body font-semibold inline-flex items-center justify-center gap-1.5 ${v.isActive ? 'border-danger/30 text-danger active:bg-danger/5' : 'border-line text-ink active:bg-app'}`}>
              {v.isActive ? <><X className="w-4 h-4" aria-hidden="true" /> Retirer</> : 'Réactiver'}
            </button>
          </div>
        </article>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le véhicule' : 'Ajouter un véhicule'}</DialogTitle>
            <DialogDescription>
              Le conducteur retrouvera cette voiture dans son compte Socline, avec son numéro de téléphone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Field id="plate" label="Plaque *" value={form.plateNumber} onChange={(v) => setForm({ ...form, plateNumber: v })} placeholder="TG-1234-AB" />
            <div className="grid grid-cols-2 gap-3">
              <Field id="brand" label="Marque" value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} placeholder="Toyota" />
              <Field id="model" label="Modèle" value={form.model} onChange={(v) => setForm({ ...form, model: v })} placeholder="Corolla" />
            </div>
            <Field id="color" label="Couleur *" value={form.color} onChange={(v) => setForm({ ...form, color: v })} placeholder="Blanc" />
            <Field id="driverName" label="Nom du conducteur" value={form.driverName} onChange={(v) => setForm({ ...form, driverName: v })} placeholder="Kossi Mensah" />
            <Field id="driverPhone" label="Téléphone du conducteur *" value={form.driverPhone} onChange={(v) => setForm({ ...form, driverPhone: v.replace(/[^\d+ ]/g, '') })} placeholder="90 12 34 56" inputMode="tel" />
            {editing && editing.driverPhone !== form.driverPhone.replace(/\s/g, '') && (
              <p className="text-detail text-soft">La voiture quittera le compte de l&apos;ancien conducteur.</p>
            )}
          </div>
          <Button onClick={() => void save()} disabled={saving} className={`w-full h-12 ${BTN_PRIMARY_CLASSES} font-bold`}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : editing ? 'Enregistrer' : 'Ajouter le véhicule'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lavages                                                             */
/* ------------------------------------------------------------------ */

function WashesTab({ vehicles }: { vehicles: Vehicle[] }) {
  const [period, setPeriod] = useState(thisPeriod());
  const [vehicleId, setVehicleId] = useState('');
  const [orders, setOrders] = useState<CompanyOrder[] | null>(null);
  const [photo, setPhoto] = useState<{ url: string; label: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ period });
    if (vehicleId) params.set('vehicleId', vehicleId);
    getJson<{ orders: CompanyOrder[] }>(`/api/company/orders?${params}`).then((d) => {
      if (!cancelled) setOrders(d?.orders ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [period, vehicleId]);

  return (
    <div className="space-y-3">
      <h2 className="text-section text-ink">Lavages</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="period" className="text-detail text-soft">Mois</Label>
          <Input id="period" type="month" value={period} max={thisPeriod()} onChange={(e) => e.target.value && setPeriod(e.target.value)} className="h-11 mt-1" />
        </div>
        <div>
          <Label htmlFor="vehicle" className="text-detail text-soft">Voiture</Label>
          <select
            id="vehicle"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="mt-1 h-11 w-full rounded-md border border-input bg-surface px-3 text-body"
          >
            <option value="">Toutes</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.plateNumber}</option>
            ))}
          </select>
        </div>
      </div>

      {orders === null ? <Spinner /> : null}
      {orders?.length === 0 ? <EmptyCard text={`Aucun lavage en ${periodLabel(period).toLowerCase()}.`} /> : null}

      {orders?.map((o) => (
        <article key={o.id} className={`p-4 ${CARD_CLASSES}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-body font-bold text-ink">{o.fleetVehicle?.plateNumber || '—'}</p>
              <p className="text-detail text-soft">
                {o.service.name} · {new Date(o.completedAt || o.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-micro font-bold ${
              o.status === 'COMPLETED' ? 'bg-success/10 text-success' : o.status === 'CANCELLED' ? 'bg-app text-soft' : 'bg-brand-soft text-brand-ink'
            }`}>
              {STATUS_LABELS[o.status] || o.status}
            </span>
          </div>
          <p className="mt-2 text-detail text-soft">
            Conducteur : <span className="text-ink">{o.client.name || o.client.phone}</span>
            {o.washer?.user.name ? <> · Laveur : <span className="text-ink">{o.washer.user.name}</span></> : null}
          </p>
          {(o.beforePhotoUrl || o.afterPhotoUrl) && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[{ url: o.beforePhotoUrl, label: 'Avant' }, { url: o.afterPhotoUrl, label: 'Après' }].map((p) =>
                p.url ? (
                  <button key={p.label} onClick={() => setPhoto({ url: p.url!, label: `${p.label} — ${o.fleetVehicle?.plateNumber || ''}` })} className="relative rounded-btn overflow-hidden border border-line aspect-[4/3]">
                    <img src={p.url} alt={`Photo ${p.label.toLowerCase()} lavage`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 left-1 rounded-full bg-ink/80 text-white text-micro font-semibold px-2 py-0.5">{p.label}</span>
                  </button>
                ) : (
                  <div key={p.label} className="rounded-btn border border-dashed border-line aspect-[4/3] flex items-center justify-center text-detail text-soft">{p.label} : —</div>
                )
              )}
            </div>
          )}
          {o.review && (
            <p className="mt-2 text-detail text-soft">
              Note du conducteur : <span className="text-ink font-semibold">{o.review.rating}/5</span>
              {o.review.comment ? ` — « ${o.review.comment} »` : ''}
            </p>
          )}
        </article>
      ))}

      <Dialog open={!!photo} onOpenChange={(v) => !v && setPhoto(null)}>
        <DialogContent className="max-w-lg p-3">
          <DialogHeader>
            <DialogTitle className="text-body">{photo?.label}</DialogTitle>
            <DialogDescription className="sr-only">Photo du lavage en grand</DialogDescription>
          </DialogHeader>
          {photo && <img src={photo.url} alt={photo.label} className="w-full rounded-btn" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Factures                                                            */
/* ------------------------------------------------------------------ */

function InvoicesTab() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getJson<{ invoices: Invoice[] }>('/api/company/invoices').then((d) => {
      if (!cancelled) setInvoices(d?.invoices ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-3">
      <h2 className="text-section text-ink">Factures</h2>
      <p className="text-detail text-soft">
        Le forfait est facturé chaque mois : nombre de voitures suivies × prix par voiture. Paiement par Mobile Money ou virement au +228 71 99 81 55.
      </p>
      {invoices === null ? <Spinner /> : null}
      {invoices?.length === 0 ? <EmptyCard text="Aucune facture pour l'instant." /> : null}
      {invoices?.map((inv) => (
        <article key={inv.id} className={`p-4 ${CARD_CLASSES}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-body font-bold text-ink">{periodLabel(inv.period)}</p>
              <p className="text-detail text-soft font-mono">{inv.invoiceNumber}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-micro font-bold ${inv.status === 'PAID' ? 'bg-success/10 text-success' : 'bg-brand-soft text-brand-ink'}`}>
              {inv.status === 'PAID' ? 'Payée' : 'À payer'}
            </span>
          </div>
          <dl className="mt-3 space-y-1.5 text-body">
            <Row label="Voitures" value={`${inv.vehicleCount} × ${formatPrice(inv.pricePerVehicle)}`} />
            <Row label="Lavages réalisés" value={`${inv.washesDone} / ${inv.washesIncluded}`} />
            <Row label="Montant" value={formatPrice(inv.amount)} strong />
            {inv.paidAt && <Row label="Payée le" value={new Date(inv.paidAt).toLocaleDateString('fr-FR')} />}
          </dl>
        </article>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Petits composants                                                   */
/* ------------------------------------------------------------------ */

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-soft">{label}</dt>
      <dd className={`text-right ${strong ? 'font-extrabold text-ink' : 'text-ink'}`}>{value}</dd>
    </div>
  );
}

function Field({
  id, label, value, onChange, placeholder, inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'tel' | 'text';
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-detail text-ink">{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} className="h-11 mt-1" />
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <Loader2 className="w-6 h-6 animate-spin text-brand-ink" aria-label="Chargement" />
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return <div className={`p-6 text-center text-body text-soft ${CARD_CLASSES}`}>{text}</div>;
}
