'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Building2, Car, CheckCircle, Clock, FileText, Loader2, Pencil, Plus, RefreshCw, UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Admin — onglet « Entreprises » (offre Socline Entreprises).
 * Créer une entreprise et son contrat (forfait mensuel), gérer sa flotte,
 * suivre sa consommation et générer / encaisser ses factures mensuelles.
 */

interface ServiceOption { id: string; name: string; price: number }

interface CompanyRow {
  id: string;
  name: string;
  sector: string | null;
  managerPhone: string;
  manager: { name: string | null; phone: string } | null;
  isActive: boolean;
  contract: { washesPerVehicle: number; pricePerVehicle: number; maxVehicles: number; service: ServiceOption } | null;
  activeVehicles: number;
  washesThisMonth: number;
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
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  period: string;
  vehicleCount: number;
  washesDone: number;
  washesIncluded: number;
  amount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  paidAt: string | null;
  paymentReference: string | null;
}

interface CompanyDetail {
  company: { id: string; name: string; sector: string | null; address: string | null; contactName: string | null; email: string | null; taxId: string | null; managerPhone: string; isActive: boolean };
  contract: { serviceId: string; washesPerVehicle: number; pricePerVehicle: number; maxVehicles: number; endDate: string | null; notes: string | null; service: ServiceOption } | null;
  manager: { name: string | null; phone: string } | null;
  period: string;
  activeVehicles: number;
  washesDone: number;
  washesInProgress: number;
  washesIncluded: number;
  monthlyAmount: number;
  vehicles: Vehicle[];
  orders: { id: string; orderNumber: string; status: string; createdAt: string; fleetVehicle: { plateNumber: string } | null; client: { name: string | null; phone: string }; washer: { user: { name: string | null } } | null }[];
  invoices: Invoice[];
}

const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

async function api<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      toast.error(data?.error || 'Une erreur est survenue');
      return null;
    }
    return data as T;
  } catch {
    toast.error('Connexion impossible');
    return null;
  }
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function AdminCompanies() {
  const [companies, setCompanies] = useState<CompanyRow[] | null>(null);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    const d = await api<{ companies: CompanyRow[] }>('/api/admin/companies');
    setCompanies(d?.companies ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial
    void load();
    fetch('/api/services')
      .then((r) => r.json())
      .then((d) => d?.success && setServices(d.services))
      .catch(() => {});
  }, [load]);

  if (selectedId) {
    return (
      <CompanyDetailView
        id={selectedId}
        services={services}
        onBack={() => {
          setSelectedId(null);
          void load();
        }}
      />
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-lg text-[#212121]">Entreprises</h2>
          <p className="text-sm text-[#757575]">Flottes prises en charge au forfait mensuel</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-[#C2410C] hover:bg-[#9A3412] text-white h-11">
          <Plus className="w-4 h-4 mr-1" /> Nouvelle
        </Button>
      </div>

      {companies === null && <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#C2410C]" />}
      {companies?.length === 0 && (
        <div className="bg-white rounded-xl border border-[#E0E0E0] p-6 text-center text-sm text-[#757575]">
          Aucune entreprise. Créez la première avec son contrat et le numéro de son gestionnaire.
        </div>
      )}

      {companies?.map((c) => (
        <button
          key={c.id}
          onClick={() => setSelectedId(c.id)}
          className="w-full text-left bg-white rounded-xl border border-[#E0E0E0] p-4 hover:border-[#FF9800] active:scale-[0.99] transition-all"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#FFF3E0] flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-[#C2410C]" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[#212121] truncate">{c.name}</p>
                <p className="text-xs text-[#757575]">
                  {c.sector || 'Entreprise'} · gestionnaire {c.manager ? c.manager.name || c.manager.phone : `${c.managerPhone} (invité)`}
                </p>
              </div>
            </div>
            {!c.isActive && <span className="text-xs rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[#757575]">Inactive</span>}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Voitures" value={`${c.activeVehicles}${c.contract ? `/${c.contract.maxVehicles}` : ''}`} />
            <Stat label="Lavages du mois" value={String(c.washesThisMonth)} />
            <Stat label="Forfait" value={c.contract ? fmt(c.contract.pricePerVehicle * c.activeVehicles) : '—'} />
          </div>
        </button>
      ))}

      <CreateCompanyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        services={services}
        onCreated={(id) => {
          setCreateOpen(false);
          void load();
          setSelectedId(id);
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#FAFAFA] rounded-lg py-2">
      <p className="font-bold text-[#212121] text-sm tabular-nums">{value}</p>
      <p className="text-[11px] text-[#757575]">{label}</p>
    </div>
  );
}

function Field({ id, label, value, onChange, type = 'text', placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm">{label}</Label>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-11 mt-1" />
    </div>
  );
}

function ServiceSelect({ value, onChange, services }: { value: string; onChange: (v: string) => void; services: ServiceOption[] }) {
  return (
    <div>
      <Label htmlFor="serviceId" className="text-sm">Formule couverte *</Label>
      <select id="serviceId" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-input bg-white px-3 text-sm">
        <option value="">Choisir…</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>{s.name} — {fmt(s.price)}</option>
        ))}
      </select>
    </div>
  );
}

function CreateCompanyDialog({ open, onOpenChange, services, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; services: ServiceOption[]; onCreated: (id: string) => void;
}) {
  const [f, setF] = useState({
    name: '', sector: 'Entreprise', address: '', contactName: '', email: '', taxId: '', managerPhone: '',
    serviceId: '', washesPerVehicle: '4', pricePerVehicle: '', maxVehicles: '10',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const selected = services.find((s) => s.id === f.serviceId);
  const fullPrice = selected ? selected.price * (Number(f.washesPerVehicle) || 0) : 0;

  const submit = async () => {
    setSaving(true);
    const d = await api<{ company: { id: string } }>('/api/admin/companies', json('POST', {
      ...f,
      washesPerVehicle: Number(f.washesPerVehicle),
      pricePerVehicle: Number(f.pricePerVehicle),
      maxVehicles: Number(f.maxVehicles),
    }));
    setSaving(false);
    if (d) {
      toast.success('Entreprise créée');
      onCreated(d.company.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle entreprise</DialogTitle>
          <DialogDescription>Le gestionnaire accédera à l&apos;espace entreprise avec son numéro.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field id="c-name" label="Nom *" value={f.name} onChange={set('name')} placeholder="Hôtel du Golfe" />
          <div className="grid grid-cols-2 gap-3">
            <Field id="c-sector" label="Secteur" value={f.sector} onChange={set('sector')} placeholder="Hôtel" />
            <Field id="c-tax" label="NIF" value={f.taxId} onChange={set('taxId')} />
          </div>
          <Field id="c-address" label="Adresse" value={f.address} onChange={set('address')} />
          <div className="grid grid-cols-2 gap-3">
            <Field id="c-contact" label="Contact" value={f.contactName} onChange={set('contactName')} />
            <Field id="c-email" label="E-mail" value={f.email} onChange={set('email')} type="email" />
          </div>
          <Field id="c-manager" label="Téléphone du gestionnaire *" value={f.managerPhone} onChange={set('managerPhone')} placeholder="90 12 34 56" />
          <div className="h-px bg-[#EEEEEE]" />
          <p className="text-sm font-semibold text-[#212121]">Contrat (forfait mensuel)</p>
          <ServiceSelect value={f.serviceId} onChange={set('serviceId')} services={services} />
          <div className="grid grid-cols-3 gap-3">
            <Field id="c-washes" label="Lavages / voiture" value={f.washesPerVehicle} onChange={set('washesPerVehicle')} type="number" />
            <Field id="c-price" label="Prix / voiture" value={f.pricePerVehicle} onChange={set('pricePerVehicle')} type="number" />
            <Field id="c-max" label="Voitures max" value={f.maxVehicles} onChange={set('maxVehicles')} type="number" />
          </div>
          {selected && (
            <p className="text-xs text-[#757575]">
              Repère : {f.washesPerVehicle} × {selected.name} au prix public = {fmt(fullPrice)} par voiture et par mois.
            </p>
          )}
        </div>
        <Button onClick={() => void submit()} disabled={saving} className="w-full h-12 bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Créer l'entreprise"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

const EMPTY_VEHICLE = { plateNumber: '', brand: '', model: '', color: '', driverName: '', driverPhone: '' };

function CompanyDetailView({ id, services, onBack }: { id: string; services: ServiceOption[]; onBack: () => void }) {
  const [d, setD] = useState<CompanyDetail | null>(null);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vf, setVf] = useState(EMPTY_VEHICLE);
  const [contractOpen, setContractOpen] = useState(false);
  const [cf, setCf] = useState({ serviceId: '', washesPerVehicle: '', pricePerVehicle: '', maxVehicles: '', managerPhone: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api<CompanyDetail>(`/api/admin/companies/${id}`);
    if (r) setD(r);
  }, [id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial
    void load();
  }, [load]);

  if (!d) return <div className="p-6"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#C2410C]" /></div>;

  const saveVehicle = async () => {
    setBusy(true);
    const r = await api(`/api/admin/companies/${id}/vehicles`, json(editingVehicle ? 'PATCH' : 'POST', editingVehicle ? { vehicleId: editingVehicle.id, ...vf } : vf));
    setBusy(false);
    if (r) {
      toast.success(editingVehicle ? 'Véhicule mis à jour' : 'Véhicule ajouté');
      setVehicleOpen(false);
      void load();
    }
  };
  const toggleVehicle = async (v: Vehicle) => {
    const r = await api(`/api/admin/companies/${id}/vehicles`, json('PATCH', { vehicleId: v.id, isActive: !v.isActive }));
    if (r) void load();
  };
  const saveContract = async () => {
    setBusy(true);
    const r = await api(`/api/admin/companies/${id}`, json('PATCH', {
      managerPhone: cf.managerPhone,
      contract: {
        serviceId: cf.serviceId,
        washesPerVehicle: Number(cf.washesPerVehicle),
        pricePerVehicle: Number(cf.pricePerVehicle),
        maxVehicles: Number(cf.maxVehicles),
      },
    }));
    setBusy(false);
    if (r) {
      toast.success('Contrat mis à jour');
      setContractOpen(false);
      void load();
    }
  };
  const generateInvoice = async () => {
    const r = await api(`/api/admin/companies/${id}/invoices`, json('POST', { period: d.period }));
    if (r) {
      toast.success('Facture du mois générée');
      void load();
    }
  };
  const setInvoiceStatus = async (inv: Invoice, status: 'PAID' | 'PENDING') => {
    let paymentReference: string | undefined;
    if (status === 'PAID') {
      const ref = window.prompt('Référence du paiement (Mobile Money, virement…) — facultatif', inv.paymentReference || '');
      if (ref === null) return;
      paymentReference = ref;
    }
    const r = await api(`/api/admin/companies/${id}/invoices`, json('PATCH', { invoiceId: inv.id, status, paymentReference }));
    if (r) void load();
  };
  const toggleCompany = async () => {
    if (d.company.isActive && !window.confirm(`Suspendre ${d.company.name} ? Ses conducteurs ne pourront plus commander.`)) return;
    const r = await api(`/api/admin/companies/${id}`, json('PATCH', { isActive: !d.company.isActive }));
    if (r) void load();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-[#F5F5F5]" aria-label="Retour">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-lg text-[#212121] truncate">{d.company.name}</h2>
          <p className="text-xs text-[#757575]">
            Gestionnaire : {d.manager ? `${d.manager.name || ''} ${d.manager.phone}` : `${d.company.managerPhone} (invité, pas encore de compte)`}
          </p>
        </div>
        <button onClick={() => void load()} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-[#F5F5F5]" aria-label="Rafraîchir">
          <RefreshCw className="w-5 h-5 text-[#C2410C]" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Voitures" value={`${d.activeVehicles}${d.contract ? `/${d.contract.maxVehicles}` : ''}`} />
        <Stat label="Lavages du mois" value={`${d.washesDone}/${d.washesIncluded}`} />
        <Stat label="Forfait du mois" value={fmt(d.monthlyAmount)} />
      </div>

      {/* Contrat */}
      <section className="bg-white rounded-xl border border-[#E0E0E0] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[#212121]">Contrat</h3>
          <Button variant="outline" size="sm" className="h-9" onClick={() => {
            setCf({
              serviceId: d.contract?.serviceId || '',
              washesPerVehicle: String(d.contract?.washesPerVehicle ?? 4),
              pricePerVehicle: String(d.contract?.pricePerVehicle ?? ''),
              maxVehicles: String(d.contract?.maxVehicles ?? 10),
              managerPhone: d.company.managerPhone,
            });
            setContractOpen(true);
          }}>
            <Pencil className="w-4 h-4 mr-1" /> Modifier
          </Button>
        </div>
        {d.contract ? (
          <p className="text-sm text-[#616161]">
            {d.contract.service.name} · {d.contract.washesPerVehicle} lavages par voiture et par mois · {fmt(d.contract.pricePerVehicle)} par voiture · {d.contract.maxVehicles} voitures max
          </p>
        ) : (
          <p className="text-sm text-red-600">Aucun contrat actif : les conducteurs ne peuvent pas commander.</p>
        )}
        <button onClick={() => void toggleCompany()} className={`text-sm font-semibold ${d.company.isActive ? 'text-red-600' : 'text-[#2E7D32]'}`}>
          {d.company.isActive ? "Suspendre l'entreprise" : "Réactiver l'entreprise"}
        </button>
      </section>

      {/* Véhicules */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[#212121] flex items-center gap-2"><Car className="w-4 h-4" /> Véhicules</h3>
          <Button size="sm" className="h-9 bg-[#C2410C] hover:bg-[#9A3412] text-white" onClick={() => { setEditingVehicle(null); setVf(EMPTY_VEHICLE); setVehicleOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Ajouter
          </Button>
        </div>
        {d.vehicles.length === 0 && <p className="text-sm text-[#757575]">Aucun véhicule.</p>}
        {d.vehicles.map((v) => (
          <div key={v.id} className={`bg-white rounded-xl border border-[#E0E0E0] p-3 ${v.isActive ? '' : 'opacity-60'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-bold text-[#212121]">{v.plateNumber}</span>
              <span className="text-xs font-semibold text-[#616161] tabular-nums">{v.washesUsed}/{v.washesIncluded} ce mois</span>
            </div>
            <p className="text-xs text-[#757575]">{[v.brand, v.model].filter(Boolean).join(' ') || 'Véhicule'} · {v.color}</p>
            <p className="text-xs mt-1 flex items-center gap-1 text-[#424242]">
              <UserRound className="w-3.5 h-3.5" /> {v.driverName || 'Conducteur'} · {v.driverPhone}
              {v.driverStatus === 'ACTIVE'
                ? <span className="ml-auto inline-flex items-center gap-1 text-[#2E7D32]"><CheckCircle className="w-3.5 h-3.5" /> actif</span>
                : <span className="ml-auto inline-flex items-center gap-1 text-[#757575]"><Clock className="w-3.5 h-3.5" /> invité</span>}
            </p>
            <div className="flex gap-3 mt-2 text-sm">
              <button className="text-[#C2410C] font-semibold" onClick={() => {
                setEditingVehicle(v);
                setVf({ plateNumber: v.plateNumber, brand: v.brand || '', model: v.model || '', color: v.color, driverName: v.driverName || '', driverPhone: v.driverPhone });
                setVehicleOpen(true);
              }}>Modifier</button>
              <button className={v.isActive ? 'text-red-600 font-semibold' : 'text-[#2E7D32] font-semibold'} onClick={() => void toggleVehicle(v)}>
                {v.isActive ? 'Retirer' : 'Réactiver'}
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Factures */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[#212121] flex items-center gap-2"><FileText className="w-4 h-4" /> Factures</h3>
          <Button size="sm" variant="outline" className="h-9" onClick={() => void generateInvoice()} disabled={!d.contract}>
            Facturer le mois
          </Button>
        </div>
        {d.invoices.length === 0 && <p className="text-sm text-[#757575]">Aucune facture.</p>}
        {d.invoices.map((inv) => (
          <div key={inv.id} className="bg-white rounded-xl border border-[#E0E0E0] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[#212121]">{inv.period} · {fmt(inv.amount)}</span>
              <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${inv.status === 'PAID' ? 'bg-[#E8F5E9] text-[#2E7D32]' : inv.status === 'CANCELLED' ? 'bg-[#F5F5F5] text-[#757575]' : 'bg-[#FFF3E0] text-[#E65100]'}`}>
                {inv.status === 'PAID' ? 'Payée' : inv.status === 'CANCELLED' ? 'Annulée' : 'À payer'}
              </span>
            </div>
            <p className="text-xs text-[#757575] font-mono">{inv.invoiceNumber} · {inv.vehicleCount} voiture(s) · {inv.washesDone}/{inv.washesIncluded} lavages</p>
            {inv.paymentReference && <p className="text-xs text-[#757575]">Réf. : {inv.paymentReference}</p>}
            <div className="mt-2 text-sm">
              {inv.status === 'PAID' ? (
                <button className="text-[#757575] font-semibold" onClick={() => void setInvoiceStatus(inv, 'PENDING')}>Annuler le paiement</button>
              ) : (
                <button className="text-[#2E7D32] font-semibold" onClick={() => void setInvoiceStatus(inv, 'PAID')}>Marquer payée</button>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Derniers lavages */}
      <section className="space-y-2">
        <h3 className="font-semibold text-[#212121]">Derniers lavages</h3>
        {d.orders.length === 0 && <p className="text-sm text-[#757575]">Aucun lavage.</p>}
        {d.orders.map((o) => (
          <div key={o.id} className="bg-white rounded-xl border border-[#E0E0E0] p-3 text-sm flex justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono font-semibold text-[#212121]">{o.fleetVehicle?.plateNumber || '—'} <span className="font-sans font-normal text-[#757575]">#{o.orderNumber}</span></p>
              <p className="text-xs text-[#757575] truncate">{o.client.name || o.client.phone} · {o.washer?.user.name || 'sans laveur'}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-semibold text-[#424242]">{o.status}</p>
              <p className="text-xs text-[#757575]">{new Date(o.createdAt).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
        ))}
      </section>

      <Dialog open={vehicleOpen} onOpenChange={setVehicleOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVehicle ? 'Modifier le véhicule' : 'Ajouter un véhicule'}</DialogTitle>
            <DialogDescription>La voiture apparaîtra dans le compte du conducteur (son numéro).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field id="v-plate" label="Plaque *" value={vf.plateNumber} onChange={(v) => setVf({ ...vf, plateNumber: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Field id="v-brand" label="Marque" value={vf.brand} onChange={(v) => setVf({ ...vf, brand: v })} />
              <Field id="v-model" label="Modèle" value={vf.model} onChange={(v) => setVf({ ...vf, model: v })} />
            </div>
            <Field id="v-color" label="Couleur *" value={vf.color} onChange={(v) => setVf({ ...vf, color: v })} />
            <Field id="v-dname" label="Nom du conducteur" value={vf.driverName} onChange={(v) => setVf({ ...vf, driverName: v })} />
            <Field id="v-dphone" label="Téléphone du conducteur *" value={vf.driverPhone} onChange={(v) => setVf({ ...vf, driverPhone: v })} />
          </div>
          <Button onClick={() => void saveVehicle()} disabled={busy} className="w-full h-12 bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer'}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le contrat</DialogTitle>
            <DialogDescription>Les changements s&apos;appliquent aux prochaines commandes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <ServiceSelect value={cf.serviceId} onChange={(v) => setCf({ ...cf, serviceId: v })} services={services} />
            <div className="grid grid-cols-3 gap-3">
              <Field id="k-washes" label="Lavages / voiture" value={cf.washesPerVehicle} onChange={(v) => setCf({ ...cf, washesPerVehicle: v })} type="number" />
              <Field id="k-price" label="Prix / voiture" value={cf.pricePerVehicle} onChange={(v) => setCf({ ...cf, pricePerVehicle: v })} type="number" />
              <Field id="k-max" label="Voitures max" value={cf.maxVehicles} onChange={(v) => setCf({ ...cf, maxVehicles: v })} type="number" />
            </div>
            <Field id="k-manager" label="Téléphone du gestionnaire" value={cf.managerPhone} onChange={(v) => setCf({ ...cf, managerPhone: v })} />
          </div>
          <Button onClick={() => void saveContract()} disabled={busy} className="w-full h-12 bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
