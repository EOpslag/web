import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Clock, Star, Check, CheckCircle, Phone, ChevronDown, Package, Home, Wrench, Trophy, Briefcase, Zap, Shield, Key, Mail, FileText, Building2, ReceiptText, X, Calculator, ArrowRight, ArrowLeft, Send, TrendingUp, DoorOpen, Layers, MapPin, Search, Square, ArrowUp, Download, CalendarDays } from 'lucide-react';
import brandingExteriorImg from '@/assets/images/branding-exterior.png';
import unitFrontImg from '@/assets/images/unit-front.jpg';
import interiorWideImg from '@/assets/images/interior-wide.jpg';
import unitInteriorAngleImg from '@/assets/images/unit-interior-angle.jpg';
import teamImg from '@/assets/images/team.jpg';

// three.js + react-three-fiber are ~1 MB: load the 3D box only when the hero renders it, in its own chunk.
const BoxViewer3D = lazy(() => import('./BoxViewer3D'));

/*
 * LEAD FORMS — EmailJS (browser-side, no backend)
 * ================================================
 * The EmailJS Public Key, Service ID and Template ID below are PUBLIC by design (they ship in the
 * browser bundle). They are not secrets. Never put an EmailJS *Private Key* in this repository.
 *
 * Abuse protection therefore lives in the EmailJS dashboard (see README → "Security checklist"):
 *   - Account → Security: allow-list ONLY the production origin(s) of this site.
 *   - Keep IP rate limits on; optionally enable reCAPTCHA on the template.
 *
 * TEMPLATE MUST CONTAIN: Subject {{subject}}, Body "From: {{from_name}} <{{from_email}}>\n{{message}}",
 * To Email hallo@extraopslag.nl, Reply To {{reply_to}}.
 */

const EMAILJS_SERVICE_ID = 'service_tbq2zve';
const EMAILJS_TEMPLATE_ID = 'template_ctq71a7';
const EMAILJS_PUBLIC_KEY = 'fQ1e6BaQCCHB2wySi';
const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';
const LEAD_EMAIL = 'hallo@extraopslag.nl';

// Client-side guard rails (deter double-clicks and naive scripts; real abuse limits live at EmailJS).
const MAX_FIELD_LENGTH = 300;
const MIN_SECONDS_BETWEEN_SENDS = 20;
const MAX_SENDS_PER_SESSION = 5;
const SEND_LOG_KEY = 'eo-lead-sends';
const FIELD_LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  kvk: 20
} as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isValidEmail = (value: string) => value.length <= FIELD_LIMITS.email && EMAIL_PATTERN.test(value.trim());
const isValidPhone = (value: string) => /^[0-9+()\-\s.]{8,30}$/.test(value.trim()) && (value.match(/\d/g) ?? []).length >= 8;
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const cleanValue = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_FIELD_LENGTH);
// Never forward query strings / fragments (tracking ids, tokens) — only where the visitor was.
const currentPageUrl = () => `${window.location.origin}${window.location.pathname}`;
type Toast = {
  message: string;
  type: 'success' | 'error';
  id: number;
} | null;
let toastSetter: ((t: Toast) => void) | null = null;
const showToast = (message: string, type: 'success' | 'error') => {
  if (toastSetter) toastSetter({
    message,
    type,
    id: Date.now()
  });
};
const readSendLog = (): number[] => {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(SEND_LOG_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((t): t is number => typeof t === 'number') : [];
  } catch {
    return [];
  }
};
const writeSendLog = (log: number[]) => {
  try {
    window.sessionStorage.setItem(SEND_LOG_KEY, JSON.stringify(log));
  } catch {
    /* storage unavailable (private mode) — the guard simply degrades to per-page-load */
  }
};
const sendLeadEmail = async (formType: string, formData: Record<string, string>, honeypot = ''): Promise<boolean> => {
  // Honeypot: a real visitor never sees or fills this field. Pretend success so bots learn nothing.
  if (honeypot.trim() !== '') {
    return true;
  }
  const now = Date.now();
  const recent = readSendLog().filter(t => now - t < 60 * 60 * 1000);
  const last = recent[recent.length - 1];
  if (recent.length >= MAX_SENDS_PER_SESSION || (last !== undefined && now - last < MIN_SECONDS_BETWEEN_SENDS * 1000)) {
    showToast('Even geduld — u heeft zojuist al een aanvraag verstuurd. Bel ons gerust op 0297 548 633.', 'error');
    return false;
  }
  try {
    const safe: Record<string, string> = {};
    Object.entries(formData).forEach(([key, value]) => {
      const cleaned = cleanValue(String(value ?? ''));
      if (cleaned !== '') safe[cleanValue(key)] = cleaned;
    });
    const senderName = safe['Naam'] || safe['Voornaam'] || 'Websitebezoeker';
    const rawEmail = safe['E-mail'] || safe['E-mailadres'] || '';
    const senderEmail = isValidEmail(rawEmail) ? rawEmail : 'noreply@extraopslag.nl';
    const plainMessage = Object.entries(safe).map(([k, v]) => `${k}: ${v}`).join('\n');
    const fullMessage = `ExtraOpslag.nl — ${formType}\nTijdstip: ${new Date().toLocaleString('nl-NL')}\n\n${plainMessage}\n\nVerzonden via extraopslag.nl`;
    const payload = {
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        to_name: 'ExtraOpslag Team',
        to_email: LEAD_EMAIL,
        from_name: senderName,
        from_email: senderEmail,
        reply_to: senderEmail,
        subject: `Nieuwe aanvraag: ${formType} — ExtraOpslag.nl`,
        message: fullMessage,
        name: senderName,
        email: senderEmail,
        phone: safe['Telefoon'] || '',
        type: safe['Type koper'] || safe['Type'] || ''
      }
    };
    const response = await fetch(EMAILJS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      referrerPolicy: 'strict-origin-when-cross-origin',
      credentials: 'omit'
    });
    if (response.ok) {
      writeSendLog([...recent, now]);
      showToast('Aanvraag verzonden!', 'success');
      return true;
    }
    showToast('Versturen mislukt — probeer opnieuw of bel 0297 548 633.', 'error');
    return false;
  } catch {
    // Deliberately no console output: the payload contains the visitor's personal data.
    showToast('Netwerkfout — controleer uw verbinding.', 'error');
    return false;
  }
};
const Spinner = () => <svg style={{
  width: 16,
  height: 16,
  animation: 'spin 1s linear infinite'
}} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
  </svg>;
const PURCHASE_PRICE = 34000;
const LAUNCH_DATE = new Date('2026-09-07T00:00:00Z');
const TOTAL_UNITS = 40;
const INITIAL_SOLD = 9;
const WEEKLY_DECREASE = 2;
const MIN_AVAILABLE = 3;
const HERO_USPS = [{
  id: 'ruimte',
  label: '47.6m³ ruimte, 3.4m hoog'
}, {
  id: 'toegang',
  label: '24/7 beveiligde toegang'
}, {
  id: 'waarde',
  label: 'Directe waardevastheid'
}];
const SPECS = [{
  id: 'oppervlakte',
  label: 'Oppervlakte',
  val: '14m²'
}, {
  id: 'breedte',
  label: 'Breedte',
  val: '4m'
}, {
  id: 'diepte',
  label: 'Diepte',
  val: '3.5m'
}, {
  id: 'hoogte',
  label: 'Hoogte',
  val: '3.4m'
}, {
  id: 'deurhoogte',
  label: 'Deurhoogte',
  val: '2.25m'
}, {
  id: 'inhoud',
  label: 'Inhoud',
  val: '47.6m³'
}, {
  id: 'elektriciteit',
  label: 'Elektriciteit',
  val: '16A eigen meter'
}, {
  id: 'deur',
  label: 'Deur',
  val: 'Rolluikdeur'
}];
const USE_CASES = [{
  id: 'ecommerce-webshop',
  icon: Package,
  label: 'E-commerce & Webshop'
}, {
  id: 'bedrijf',
  icon: Package,
  label: 'Bedrijfsopslag'
}, {
  id: 'inboedel',
  icon: Home,
  label: 'Inboedel'
}, {
  id: 'werkplaats',
  icon: Wrench,
  label: 'Werkplaats'
}, {
  id: 'sport',
  icon: Trophy,
  label: 'Sport & hobby'
}, {
  id: 'archief',
  icon: FileText,
  label: 'Zakelijk archief'
}];
const PRICE_BENEFITS = [{
  id: 'geen-huur',
  label: 'Geen maandelijkse huur'
}, {
  id: 'waarde',
  label: 'Waardeontwikkeling'
}, {
  id: 'verhuurbaar',
  label: 'Verhuurbaar'
}, {
  id: 'sleutel',
  label: 'Eigen sleutel'
}];
const REVIEW_BREAKDOWN = [{
  id: 'five-star',
  label: '5★',
  width: '89%',
  count: 42
}, {
  id: 'four-star',
  label: '4★',
  width: '8%',
  count: 4
}, {
  id: 'three-star',
  label: '3★',
  width: '2%',
  count: 1
}, {
  id: 'two-star',
  label: '2★',
  width: '1%',
  count: 0
}, {
  id: 'one-star',
  label: '1★',
  width: '0%',
  count: 0
}];
const REVIEW_CARDS = [{
  id: 'jan-de-vries',
  initials: 'JV',
  name: 'Jan de Vries',
  role: 'Ondernemer',
  rating: '★★★★★',
  date: 'november 2025',
  text: 'Eindelijk eigen opslag zonder maandelijkse huurlasten. De box is ruim en goed bereikbaar. Investering die zichzelf terugverdient.'
}, {
  id: 'sanne-k',
  initials: 'SK',
  name: 'Sanne K.',
  role: 'Particulier',
  rating: '★★★★★',
  date: 'oktober 2025',
  text: 'Perfecte locatie bij Uithoorn. De beveiliging en camera toezicht gaf voor ons de doorslag. Aanrader voor iedereen die opslag zoekt.'
}, {
  id: 'marco-v',
  initials: 'MV',
  name: 'Marco V.',
  role: 'Ondernemer',
  rating: '★★★★★',
  date: 'december 2025',
  text: 'Mijn bedrijfsarchief stond bij een huurbox voor €220 per maand. Nu eigen eigendom voor alleen de VvE bijdrage. Beste investering van het jaar.'
}, {
  id: 'fatima-el-a',
  initials: 'FE',
  name: 'Fatima El A.',
  role: 'Belegger',
  rating: '★★★★★',
  date: 'januari 2026',
  text: 'Als belegging uitstekend. Verhuur loopt goed en rendement ligt precies zoals beloofd. Transparant proces, snelle communicatie.'
}];
const STEPS = [{
  id: 'koop',
  step: 1,
  title: 'Koop online',
  desc: 'Optie 4 werkdagen geldig. Kosteloos en vrijblijvend.'
}, {
  id: 'gegevens',
  step: 2,
  title: 'Stuur je gegevens in',
  desc: 'NAW gegevens en KvK (indien bedrijf) voor het contract.'
}, {
  id: 'teken',
  step: 3,
  title: 'Teken overeenkomst',
  desc: 'Teken de koop-aannemingsovereenkomst digitaal via ons beveiligde online platform.'
}];
const GUARANTEE_BADGES = [{
  id: 'notaris',
  icon: FileText,
  title: 'Notaris',
  text: 'Juridisch geborgd eigendom via duidelijke overdracht.'
}, {
  id: 'digitale-handtekening',
  icon: Check,
  title: 'Digitale handtekening',
  text: 'Digitaal tekenen, snel geregeld en direct bevestigd.'
}, {
  id: 'vve',
  icon: Building2,
  title: 'VvE verzekering',
  text: 'Onderhoud en verzekering professioneel georganiseerd.'
}, {
  id: 'btw',
  icon: ReceiptText,
  title: 'BTW-transparant',
  text: 'Heldere facturatie voor ondernemers en investeerders.'
}];
const COMPARISON_ROWS = [{
  id: 'maandlasten',
  label: 'Maandlasten',
  buy: 'Alleen VvE-kosten',
  rent: 'Blijvende huur'
}, {
  id: 'tien-jaar',
  label: 'Totaal 10 jaar',
  buy: 'Waarde in bezit',
  rent: 'Huur volledig weg'
}, {
  id: 'eigendom',
  label: 'Eigendom',
  buy: 'Volledig van u',
  rent: 'Geen eigendom'
}, {
  id: 'waarde',
  label: 'Waardeontwikkeling',
  buy: 'Mogelijk voordeel',
  rent: 'Geen opbouw'
}, {
  id: 'verhuur',
  label: 'Verhuurbaar',
  buy: 'Zelf verhuurbaar',
  rent: 'Niet toegestaan'
}, {
  id: 'btw',
  label: 'BTW terug',
  buy: 'Voor ondernemers',
  rent: 'Meestal niet'
}];
const LOCATION_TRAVEL_TIMES = [{
  id: 'bouwmarkt',
  minutes: '05',
  label: 'Bouwmarkt, Detailhandel en Warenhuizen',
  className: 'bg-orange-500 shadow-lg shadow-orange-500/30'
}, {
  id: 'schiphol',
  minutes: '10',
  label: 'Schiphol, De snelweg A10, A4 & A5',
  className: 'bg-[#1a1a1a] border border-white/20'
}, {
  id: 'amsterdam',
  minutes: '15',
  label: 'Centrum Amsterdam',
  className: 'bg-[#3a3a3a] border border-white/10'
}, {
  id: 'haarlem',
  minutes: '20',
  label: 'Haarlem',
  className: 'bg-orange-500 shadow-lg shadow-orange-500/30'
}];
const LOCATION_CHIPS = [{
  id: 'schiphol-chip',
  label: '🛫 Schiphol (10 min)'
}, {
  id: 'a9-chip',
  label: '🚦 A9 / A2 oprit (5 min)'
}, {
  id: 'bedrijventerrein-chip',
  label: '🏭 Bedrijventerrein (direct)'
}, {
  id: 'bouwmarkt-chip',
  label: '🛍️ Bouwmarkt (5 min)'
}, {
  id: 'ikea-chip',
  label: '📐 IKEA (12 min)'
}, {
  id: 'amsterdam-chip',
  label: '🏙️ Amsterdam (20 min)'
}, {
  id: 'haarlem-chip',
  label: '✈️ Haarlem (20 min)'
}, {
  id: 'parkeren-chip',
  label: '🚗 Gratis parkeren'
}];
const FAQ_ITEMS = [{
  id: 'huren-kopen',
  q: 'Wat is het verschil tussen huren en kopen?',
  a: 'Bij huren betaalt u maandelijks en bouwt u geen vermogen op. Bij koop is de box van u, wat waardeontwikkeling biedt en lagere maandlasten op de lange termijn.'
}, {
  id: 'btw-particulier',
  q: 'Kan ik als particulier de BTW terugvorderen?',
  a: 'Nee, alleen ondernemers met een geldig KvK nummer kunnen de BTW terugvorderen.'
}, {
  id: 'vve-kosten',
  q: 'Wat zijn de VvE kosten?',
  a: 'De VvE (Vereniging van Eigenaren) zorgt voor onderhoud en verzekering. Kosten liggen gemiddeld rond de €20 per maand.'
}, {
  id: 'toegankelijk',
  q: 'Is het park altijd toegankelijk?',
  a: 'Ja, als eigenaar heeft u 24/7 toegang via een persoonlijke elektronische tag.'
}, {
  id: 'doorverkoop',
  q: 'Kan ik mijn opslagbox later doorverkopen?',
  a: 'Ja, de box is volledig eigendom. U kunt deze later verkopen aan een particuliere koper, ondernemer of belegger.'
}, {
  id: 'tag',
  q: 'Hoe werkt toegang met een tag?',
  a: 'U ontvangt een persoonlijke elektronische tag waarmee u het terrein 24/7 kunt betreden. De toegang is individueel geregistreerd.'
}, {
  id: 'maandkosten',
  q: 'Zijn er maandkosten voor de VvE?',
  a: 'Ja, reken op ongeveer €20 per maand voor VvE, onderhoud en gezamenlijke voorzieningen.'
}, {
  id: 'oplevering',
  q: 'Wanneer is de oplevering?',
  a: 'De geplande oplevering is in December 2026. Bij aankoop ontvangt u de actuele planning en updates per fase.'
}, {
  id: 'parkeren',
  q: 'Kan ik gratis parkeren bij mijn opslagbox?',
  a: 'Ja, er is gratis parkeren op het terrein zodat laden en lossen gemakkelijk blijft.'
}];
type BuyerType = 'particulier' | 'ondernemer' | 'belegger';
type PurchaseTimeline = 'Zo snel mogelijk' | 'Binnen 1 maand' | 'Binnen 3 maanden' | 'Orientatiefase';
type UnitInterest = '1 unit' | '2-3 units' | '4 plus units';
type LocationPreference = 'begane-grond' | 'hoekunit' | 'nabij-hoofdingang' | 'geen-voorkeur';
interface PurchaseFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  privacyAccepted: boolean;
  buyerType: BuyerType;
  purchaseTiming: PurchaseTimeline;
  source: string;
  kvkNumber: string;
  unitInterest: UnitInterest;
  locationPreference: LocationPreference;
  financingInterest: boolean;
  confirmed: boolean;
}
interface PurchaseModalProps {
  isOpen: boolean;
  urgencyMessage: string;
  onClose: () => void;
}
interface AvailabilityProps {
  totalUnits: number;
  soldUnits: number;
  availableUnits: number;
}
interface StepOneErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  privacyAccepted?: string;
}
interface LocationOption {
  id: LocationPreference;
  icon: typeof Zap;
  title: string;
  description: string;
}
interface BrochureFormData {
  naam: string;
  email: string;
  telefoon: string;
  type: string;
}
const BROCHURE_CHECKLIST = [{
  id: 'specificaties',
  label: 'Verkoopbrochure met specificaties'
}, {
  id: 'rendement',
  label: 'ROI en rendementsberekening'
}, {
  id: 'aankoopproces',
  label: 'Aankoopproces stap-voor-stap'
}, {
  id: 'juridisch',
  label: 'Juridische informatie & VvE'
}];
const initialPurchaseForm: PurchaseFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  privacyAccepted: false,
  buyerType: 'particulier',
  purchaseTiming: 'Zo snel mogelijk',
  source: 'Google',
  kvkNumber: '',
  unitInterest: '1 unit',
  locationPreference: 'geen-voorkeur',
  financingInterest: false,
  confirmed: false
};
const STEP_LABELS = [{
  id: 'gegevens',
  label: 'Uw gegevens'
}, {
  id: 'situatie',
  label: 'Uw situatie'
}, {
  id: 'box',
  label: 'Uw box'
}, {
  id: 'bevestiging',
  label: 'Bevestiging'
}];
const TIMELINE_OPTIONS: {
  id: PurchaseTimeline;
  label: PurchaseTimeline;
}[] = [{
  id: 'Zo snel mogelijk',
  label: 'Zo snel mogelijk'
}, {
  id: 'Binnen 1 maand',
  label: 'Binnen 1 maand'
}, {
  id: 'Binnen 3 maanden',
  label: 'Binnen 3 maanden'
}, {
  id: 'Orientatiefase',
  label: 'Orientatiefase'
}];
const UNIT_OPTIONS: {
  id: UnitInterest;
  label: UnitInterest;
}[] = [{
  id: '1 unit',
  label: '1 unit'
}, {
  id: '2-3 units',
  label: '2-3 units'
}, {
  id: '4 plus units',
  label: '4 plus units'
}];
const LOCATION_OPTIONS: LocationOption[] = [{
  id: 'begane-grond',
  icon: Layers,
  title: 'Begane grond',
  description: 'Makkelijkst bereikbaar, ideaal voor auto or aanhanger'
}, {
  id: 'hoekunit',
  icon: Building2,
  title: 'Hoekunit',
  description: 'Extra breedte aan zijkant, meer bewegingsruimte'
}, {
  id: 'nabij-hoofdingang',
  icon: DoorOpen,
  title: 'Nabij hoofdingang',
  description: 'Kortste loopafstand van parkeerplaats naar box'
}, {
  id: 'geen-voorkeur',
  icon: Shield,
  title: 'Geen voorkeur',
  description: 'Wijs mij de best beschikbare unit toe'
}];
interface FacilityUseCase {
  id: string;
  label: string;
  icon: typeof Zap;
  imageUrl: string;
  alt: string;
  objectPosition: string;
  fallbackBackground: string;
}
interface FacilityGalleryItem {
  id: string;
  label: string;
  imageUrl: string;
  alt: string;
  objectPosition: string;
}
const FACILITY_USE_CASES: FacilityUseCase[] = [{
  id: 'werkruimte',
  label: 'Werkruimte',
  icon: Briefcase,
  imageUrl: brandingExteriorImg,
  alt: 'ExtraOpslag.nl branded werkruimte en faciliteiten',
  objectPosition: 'center center',
  fallbackBackground: 'linear-gradient(135deg, #412817 0%, #f97316 100%)'
}, {
  id: 'opslag',
  label: 'Opslag',
  icon: Package,
  imageUrl: unitFrontImg,
  alt: 'Opslagbox Unit 53 met rolluikdeur',
  objectPosition: 'center center',
  fallbackBackground: 'linear-gradient(135deg, #171923 0%, #354052 100%)'
}, {
  id: 'werkplaats',
  label: 'Werkplaats',
  icon: Wrench,
  imageUrl: interiorWideImg,
  alt: 'Ruime opslagbox geschikt als werkplaats',
  objectPosition: 'center top',
  fallbackBackground: 'linear-gradient(135deg, #3f3f36 0%, #d6d0c2 100%)'
}];
const FACILITY_GALLERY_ITEMS: FacilityGalleryItem[] = [{
  id: 'branding-exterieur',
  label: 'ExtraOpslag.nl — Creates Space & Possibilities',
  imageUrl: brandingExteriorImg,
  alt: 'ExtraOpslag.nl opslagunits exterior met branding',
  objectPosition: 'center center'
}, {
  id: 'unit-front-view',
  label: 'Uw eigen opslagbox — Unit 53',
  imageUrl: unitFrontImg,
  alt: 'Opslagbox Unit 53 met rolluikdeur',
  objectPosition: 'center center'
}, {
  id: 'unit-interior-wide',
  label: 'Ruim interieur — 3.4m hoogte',
  imageUrl: interiorWideImg,
  alt: 'Ruim interieur van de ExtraOpslag opslagbox',
  objectPosition: 'center top'
}, {
  id: 'unit-interior-angle',
  label: 'Eigen ingang met rolluikdeur',
  imageUrl: unitInteriorAngleImg,
  alt: 'Eigen ingang met rolluikdeur in opslagbox',
  objectPosition: 'center center'
}];
const inputClass = 'dark-purchase-input bg-[#0F1117] text-white border border-white/10 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl px-4 py-3 w-full transition-all outline-none placeholder:text-gray-500';
const PurchaseModal = ({
  isOpen,
  urgencyMessage,
  onClose
}: PurchaseModalProps) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<PurchaseFormData>(initialPurchaseForm);
  const [stepOneErrors, setStepOneErrors] = useState<StepOneErrors>({});
  const [confirmError, setConfirmError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [autoCloseSeconds, setAutoCloseSeconds] = useState(10);
  const [honeypot, setHoneypot] = useState('');
  const updateField = (field: keyof PurchaseFormData, value: string | boolean | string[]) => {
    setFormData(current => ({
      ...current,
      [field]: value
    }));
  };
  const closeModal = () => {
    onClose();
  };
  const validateStepOne = () => {
    const errors: StepOneErrors = {};
    if (!formData.firstName.trim()) {
      errors.firstName = 'Voornaam is verplicht.';
    }
    if (!formData.lastName.trim()) {
      errors.lastName = 'Achternaam is verplicht.';
    }
    if (!formData.email.trim()) {
      errors.email = 'E-mail is verplicht.';
    } else if (!isValidEmail(formData.email)) {
      errors.email = 'Vul een geldig e-mailadres in.';
    }
    if (!formData.phone.trim()) {
      errors.phone = 'Telefoonnummer is verplicht.';
    } else if (!isValidPhone(formData.phone)) {
      errors.phone = 'Vul een geldig telefoonnummer in (minimaal 8 cijfers).';
    }
    if (!formData.privacyAccepted) {
      errors.privacyAccepted = 'Akkoord is nodig om verder te gaan.';
    }
    setStepOneErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const goToStepTwo = () => {
    if (validateStepOne()) {
      setStep(2);
    }
  };
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setFormData(initialPurchaseForm);
      setStepOneErrors({});
      setConfirmError('');
      setIsSubmitting(false);
      setIsSuccess(false);
      setAutoCloseSeconds(10);
      setHoneypot('');
    }
  }, [isOpen]);
  useEffect(() => {
    if (!isSuccess || !isOpen) {
      return undefined;
    }
    setAutoCloseSeconds(10);
    const interval = window.setInterval(() => {
      setAutoCloseSeconds(current => {
        if (current <= 1) {
          window.clearInterval(interval);
          onClose();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isSuccess, isOpen, onClose]);
  if (!isOpen) {
    return null;
  }
  const progressWidth = `${Math.max(step - 1, 0) / 3 * 100}%`;
  const selectedLocationOption = LOCATION_OPTIONS.find(option => option.id === formData.locationPreference);
  const buyerLabel = formData.buyerType === 'ondernemer' ? 'Ondernemer / ZZP' : formData.buyerType === 'belegger' ? 'Belegger' : 'Particulier';
  return <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={closeModal} role="dialog" aria-modal="true" aria-labelledby="purchase-modal-title">
      <div className="purchase-funnel-modal max-w-[580px] w-full sm:mx-4 bg-[#111827] rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl overflow-hidden max-h-[100svh] sm:max-h-[92vh] h-[100svh] sm:h-auto flex flex-col" onClick={event => event.stopPropagation()}>
        <div className="shrink-0">
          <div className="bg-orange-500 py-2.5 px-6 flex items-center justify-between gap-3 text-sm font-bold text-white">
            <span className="flex items-center gap-2"><span aria-hidden="true">🔥</span><span>{urgencyMessage}</span></span>
            <a href="tel:+31297548633" className="whitespace-nowrap hover:text-gray-900 transition-colors"><span>0297 548 633</span></a>
          </div>
          <div className="bg-[#1F2937] px-6 py-4 relative">
            <button type="button" onClick={closeModal} className="absolute right-4 top-4 z-[110] pointer-events-auto text-gray-400 hover:text-white transition-colors" aria-label="Sluit aankoopvenster">
              <X className="w-5 h-5" />
            </button>
            {!isSuccess && <div className="pr-7">
                <div className="relative mx-auto max-w-[430px]">
                  <div className="absolute left-9 right-9 top-4 h-0.5 bg-gray-700" aria-hidden="true">
                    <div className="h-full bg-orange-500 transition-all duration-500" style={{
                  width: progressWidth
                }} />
                  </div>
                  <ol className="relative z-10 grid grid-cols-4 gap-2">
                    {STEP_LABELS.map((item, itemIndex) => <li key={item.id} className="flex flex-col items-center gap-2 text-center">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors ${step > itemIndex + 1 ? 'border border-orange-500 bg-[#111827] text-orange-400' : step === itemIndex + 1 ? 'bg-orange-500 text-white' : 'border border-gray-600 bg-[#1F2937] text-gray-400'}`}>{step > itemIndex + 1 ? <Check className="w-4 h-4" /> : <span>{itemIndex + 1}</span>}</span>
                        <span className="text-[10px] leading-tight text-gray-300">{item.label}</span>
                      </li>)}
                  </ol>
                </div>
                <p className="mt-3 text-center text-xs text-gray-400"><span>★ 47 eigenaren gingen u voor · 4.9 out of 5 beoordeling</span></p>
              </div>}
          </div>
        </div>
        <div className="overflow-y-auto px-5 sm:px-7 py-7">
          {!isSuccess && step === 1 && <div className="space-y-5">
              <div>
                <h2 id="purchase-modal-title" className="text-2xl font-black text-white">Koop uw ExtraOpslag Box</h2>
                <p className="mt-2 text-gray-400">Vrijblijvend, geen verplichtingen, wij bellen terug binnen 1 werkdag</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-2 text-sm font-semibold text-gray-300"><span>Voornaam</span><input required maxLength={FIELD_LIMITS.name} autoComplete="given-name" value={formData.firstName} onChange={event => updateField('firstName', event.target.value)} className={inputClass} />{stepOneErrors.firstName && <span className="block text-xs text-red-400">{stepOneErrors.firstName}</span>}</label>
                <label className="space-y-2 text-sm font-semibold text-gray-300"><span>Achternaam</span><input required maxLength={FIELD_LIMITS.name} autoComplete="family-name" value={formData.lastName} onChange={event => updateField('lastName', event.target.value)} className={inputClass} />{stepOneErrors.lastName && <span className="block text-xs text-red-400">{stepOneErrors.lastName}</span>}</label>
              </div>
              <label className="space-y-2 text-sm font-semibold text-gray-300 block"><span>Email</span><input required type="email" maxLength={FIELD_LIMITS.email} autoComplete="email" placeholder="uw@email.nl" value={formData.email} onChange={event => updateField('email', event.target.value)} className={inputClass} />{stepOneErrors.email && <span className="block text-xs text-red-400">{stepOneErrors.email}</span>}</label>
              <label className="space-y-2 text-sm font-semibold text-gray-300 block"><span>Phone</span><input required type="tel" maxLength={FIELD_LIMITS.phone} autoComplete="tel" placeholder="06-12345678" value={formData.phone} onChange={event => updateField('phone', event.target.value)} className={inputClass} /><span className="block text-xs font-normal text-gray-500">wij bellen u terug op dit nummer</span>{stepOneErrors.phone && <span className="block text-xs text-red-400">{stepOneErrors.phone}</span>}</label>
              <div aria-hidden="true" style={{
              position: 'absolute',
              left: '-10000px',
              width: 1,
              height: 1,
              overflow: 'hidden'
            }}><label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={event => setHoneypot(event.target.value)} /></label></div>
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/[0.03] p-3 text-center text-xs font-bold text-gray-300 border border-white/8">
                <span className="flex items-center justify-center gap-1"><Lock className="w-3.5 h-3.5 text-orange-500" />SSL beveiligd</span>
                <span className="flex items-center justify-center gap-1"><Shield className="w-3.5 h-3.5 text-orange-500" />Nooit spam</span>
                <span className="flex items-center justify-center gap-1"><Check className="w-3.5 h-3.5 text-orange-500" />Geen verplichtingen</span>
              </div>
              <label className="flex items-start gap-3 text-sm text-gray-300 leading-relaxed"><input required type="checkbox" checked={formData.privacyAccepted} onChange={event => updateField('privacyAccepted', event.target.checked)} className="mt-1 accent-orange-500" /><span>Ik ga akkoord met de <a href={`${import.meta.env.BASE_URL}privacybeleid.html`} target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-400">privacyverklaring</a> en <a href={`${import.meta.env.BASE_URL}algemene-voorwaarden.html`} target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-400">algemene voorwaarden</a></span></label>
              {stepOneErrors.privacyAccepted && <p className="text-xs text-red-400">{stepOneErrors.privacyAccepted}</p>}
              <button type="button" onClick={goToStepTwo} className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"><span>Volgende: Uw situatie</span><ArrowRight className="w-5 h-5" /></button>
              <p className="text-center text-sm text-gray-400">Wij gebruiken uw gegevens alleen om contact met u op te nemen over uw aanvraag.</p>
              <button type="button" onClick={closeModal} className="w-full text-center text-sm font-bold text-gray-400 hover:text-white transition-colors">Annuleren</button>
            </div>}
          {!isSuccess && step === 2 && <div className="space-y-6">
              <div>
                <h2 id="purchase-modal-title" className="text-2xl font-black text-white">Vertel ons iets over uzelf</h2>
                <p className="mt-2 text-gray-400">Zo adviseren wij u optimaal.</p>
              </div>
              <fieldset className="space-y-3"><legend className="text-sm font-semibold text-gray-300">Ik ben:</legend>
                <div className="grid gap-3">
                  <button type="button" onClick={() => updateField('buyerType', 'particulier')} className={`border-2 rounded-2xl p-5 cursor-pointer text-left transition-all flex items-center gap-4 ${formData.buyerType === 'particulier' ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_24px_rgba(249,115,22,0.16)]' : 'border-white/10 bg-[#0F1117] hover:border-white/25'}`}><Home className="w-7 h-7 text-orange-500" /><span><strong className="block text-white">Particulier</strong><span className="text-sm text-gray-400">Voor persoonlijke opslag</span></span></button>
                  <button type="button" onClick={() => updateField('buyerType', 'ondernemer')} className={`border-2 rounded-2xl p-5 cursor-pointer text-left transition-all flex items-center gap-4 ${formData.buyerType === 'ondernemer' ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_24px_rgba(249,115,22,0.16)]' : 'border-white/10 bg-[#0F1117] hover:border-white/25'}`}><Briefcase className="w-7 h-7 text-orange-500" /><span><strong className="block text-white">Ondernemer ZZP</strong><span className="text-sm text-gray-400">BTW volledig terugvorderbaar</span></span></button>
                  <button type="button" onClick={() => updateField('buyerType', 'belegger')} className={`border-2 rounded-2xl p-5 cursor-pointer text-left transition-all flex items-center gap-4 ${formData.buyerType === 'belegger' ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_24px_rgba(249,115,22,0.16)]' : 'border-white/10 bg-[#0F1117] hover:border-white/25'}`}><TrendingUp className="w-7 h-7 text-orange-500" /><span><strong className="block text-white">Belegger</strong><span className="text-sm text-gray-400">6-8% jaarlijks rendement</span></span></button>
                </div>
              </fieldset>
              <AnimatePresence>
                {formData.buyerType === 'belegger' && <motion.div initial={{
              opacity: 0,
              y: -6
            }} animate={{
              opacity: 1,
              y: 0
            }} exit={{
              opacity: 0,
              y: -6
            }} className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm font-semibold text-orange-100">Bij verhuur rond 170-227 euro per maand is 6-8% jaarlijks bruto rendement indicatief haalbaar.</motion.div>}
              </AnimatePresence>
              <fieldset className="space-y-3"><legend className="text-sm font-semibold text-gray-300">Wanneer wilt u kopen</legend>
                <div className="flex flex-wrap gap-2">
                  {TIMELINE_OPTIONS.map(option => <button key={option.id} type="button" onClick={() => updateField('purchaseTiming', option.id)} className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${formData.purchaseTiming === option.id ? 'border-orange-500 bg-orange-500 text-white' : 'border-white/10 bg-[#0F1117] text-gray-300 hover:border-white/25'}`}>{option.label}</button>)}
                </div>
              </fieldset>
              <label className="space-y-2 text-sm font-semibold text-gray-300 block"><span>Hoe heeft u ons gevonden?</span><select value={formData.source} onChange={event => updateField('source', event.target.value)} className={inputClass}><option>Google</option><option>Social media</option><option>Via via</option><option>Andere website</option><option>Anders</option></select></label>
              {formData.buyerType === 'belegger' && <fieldset className="space-y-3"><legend className="text-sm font-semibold text-gray-300">Hoeveel units</legend><div className="flex flex-wrap gap-2">{UNIT_OPTIONS.map(option => <button key={option.id} type="button" onClick={() => updateField('unitInterest', option.id)} className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${formData.unitInterest === option.id ? 'border-orange-500 bg-orange-500 text-white' : 'border-white/10 bg-[#0F1117] text-gray-300 hover:border-white/25'}`}>{option.label}</button>)}</div></fieldset>}
              {formData.buyerType === 'ondernemer' && <label className="space-y-2 text-sm font-semibold text-gray-300 block"><span>KvK nummer (optioneel)</span><input maxLength={FIELD_LIMITS.kvk} inputMode="numeric" value={formData.kvkNumber} onChange={event => updateField('kvkNumber', event.target.value)} className={inputClass} placeholder="12345678" /></label>}
              <div className="flex flex-col sm:flex-row gap-3"><button type="button" onClick={() => setStep(1)} className="sm:w-1/3 border border-white/10 text-gray-300 hover:text-white hover:border-white/25 px-5 py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"><ArrowLeft className="w-5 h-5" /><span>Terug</span></button><button type="button" onClick={() => setStep(3)} className="sm:flex-1 bg-orange-500 hover:bg-orange-600 text-white px-6 py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"><span>Volgende: Uw box</span><ArrowRight className="w-5 h-5" /></button></div>
              <button type="button" onClick={closeModal} className="w-full text-center text-sm font-bold text-gray-400 hover:text-white transition-colors">Annuleren</button>
            </div>}
          {!isSuccess && step === 3 && <div className="space-y-6">
              <div>
                <h2 id="purchase-modal-title" className="text-2xl font-black text-white">Personaliseer uw ExtraOpslag Box</h2>
              </div>
              <div className="bg-[#1F2937] border border-orange-500/40 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div><h3 className="text-xl font-black text-white">14m2 ExtraOpslag Box</h3><p className="mt-3 text-sm text-gray-400">Oplevering december 2026</p></div>
                  <div className="text-3xl font-black text-orange-500">Vanaf 34.000 euro</div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm font-bold text-gray-200"><span className="rounded-xl bg-white/5 px-2 py-3">4m breed</span><span className="rounded-xl bg-white/5 px-2 py-3">3.5m diep</span><span className="rounded-xl bg-white/5 px-2 py-3">3.4m hoog</span></div>
              </div>
              <section className="space-y-3" aria-labelledby="location-title">
                <h3 id="location-title" className="text-xs font-black uppercase tracking-widest text-gray-400">Voorkeur locatie binnen het park</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {LOCATION_OPTIONS.map(option => {
                const Icon = option.icon;
                const selected = formData.locationPreference === option.id;
                return <button key={option.id} type="button" onClick={() => updateField('locationPreference', option.id)} className={`border-2 rounded-2xl p-5 cursor-pointer text-left transition-all flex items-start gap-4 ${selected ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-[#0F1117] hover:border-white/25'}`}>
                        <Icon className="w-7 h-7 text-orange-500 shrink-0" />
                        <span>
                          <strong className="block text-white">{option.title}</strong>
                          <span className="mt-1 block text-sm text-gray-400">{option.description}</span>
                        </span>
                      </button>;
              })}
                </div>
              </section>
              <div className="rounded-2xl border border-white/10 bg-[#0F1117] p-4">
                <button type="button" onClick={() => updateField('financingInterest', !formData.financingInterest)} className="w-full flex items-center justify-between gap-4 text-left">
                  <span className="font-bold text-white">Ik ben geinteresseerd in financieringsmogelijkheden</span>
                  <span className={`h-7 w-12 rounded-full p-1 transition-colors ${formData.financingInterest ? 'bg-orange-500' : 'bg-gray-700'}`}><span className={`block h-5 w-5 rounded-full bg-white transition-transform ${formData.financingInterest ? 'translate-x-5' : 'translate-x-0'}`}></span></span>
                </button>
                {formData.financingInterest && <div className="mt-4 rounded-xl bg-orange-500/10 border border-orange-500/20 p-4 text-sm text-orange-100">Wij bespreken passende financieringsopties en termijnbetalingen tijdens het terugbelgesprek.</div>}
              </div>
              <div className="flex flex-col sm:flex-row gap-3"><button type="button" onClick={() => setStep(2)} className="sm:w-1/3 border border-white/10 text-gray-300 hover:text-white hover:border-white/25 px-5 py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"><ArrowLeft className="w-5 h-5" /><span>Terug</span></button><button type="button" onClick={() => setStep(4)} className="sm:flex-1 bg-orange-500 hover:bg-orange-600 text-white px-6 py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"><span>Volgende: Bevestiging</span><ArrowRight className="w-5 h-5" /></button></div>
              <button type="button" onClick={closeModal} className="w-full text-center text-sm font-bold text-gray-400 hover:text-white transition-colors">Annuleren</button>
            </div>}
          {!isSuccess && step === 4 && <div className="space-y-5">
              <div>
                <h2 id="purchase-modal-title" className="text-2xl font-black text-white">Controleer uw aanvraag</h2>
              </div>
              <div className="bg-[#1F2937] rounded-2xl p-6 space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3"><span className="text-gray-400">Unit</span><strong className="text-white text-right">14m2, december 2026</strong></div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3"><span className="text-gray-400">Prijs</span><strong className="text-white text-right">34.000 euro excl BTW</strong></div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3"><span className="text-gray-400">Naam</span><strong className="text-white text-right">{formData.firstName} {formData.lastName}</strong></div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3"><span className="text-gray-400">Email</span><strong className="text-white text-right break-all">{formData.email}</strong></div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3"><span className="text-gray-400">Telefoon</span><strong className="text-white text-right">{formData.phone}</strong></div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3"><span className="text-gray-400">Type koper</span><strong className="text-white text-right">{buyerLabel}</strong></div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3"><span className="text-gray-400">Gewenste aankoop</span><strong className="text-white text-right">{formData.purchaseTiming}</strong></div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3"><span className="text-gray-400">Locatievoorkeur</span><strong className="text-white text-right">{selectedLocationOption?.title ?? 'Geen voorkeur'}</strong></div>
                {formData.financingInterest && <div className="flex justify-between gap-4"><span className="text-gray-400">Financiering</span><strong className="text-white text-right">Graag bespreken</strong></div>}
              </div>
              <div className="bg-orange-500/10 border-l-4 border-orange-500 rounded-r-xl p-4 text-orange-100 leading-relaxed">Na ontvangst belt ons team binnen 1 werkdag. Optie 4 werkdagen geldig.</div>
              {formData.buyerType === 'belegger' && <div className="rounded-2xl border border-orange-500/30 bg-[#0F1117] p-5"><p className="text-sm font-bold uppercase tracking-widest text-orange-400">ROI teaser</p><p className="mt-2 text-white font-bold">Bij 227 per maand huur: Rendement 8.0 percent per jaar, Terugverdientijd 7.5 jaar.</p></div>}
              <label className="flex items-start gap-3 text-sm text-gray-300"><input type="checkbox" checked={formData.confirmed} onChange={event => updateField('confirmed', event.target.checked)} className="mt-1 accent-orange-500" /><span>Ik bevestig dat bovenstaande gegevens correct zijn</span></label>
              {confirmError && <p className="text-xs text-red-400">{confirmError}</p>}
              <button type="button" disabled={isSubmitting} onClick={async () => {
            if (!formData.confirmed) {
              setConfirmError('Bevestig dat uw gegevens correct zijn om door te gaan.');
              return;
            }
            setConfirmError('');
            setIsSubmitting(true);
            try {
              const selectedLocation = LOCATION_OPTIONS?.find?.((o: any) => o.id === formData.locationPreference)?.title || formData.locationPreference || 'Geen voorkeur';
              const emailData: Record<string, string> = {
                'Naam': `${formData.firstName} ${formData.lastName}`.trim(),
                'E-mail': formData.email || '',
                'Telefoon': formData.phone || '',
                'Type koper': formData.buyerType || '',
                'Gewenste aankoop': formData.purchaseTiming || '',
                'Locatievoorkeur': selectedLocation,
                'Financiering': formData.financingInterest ? 'Ja' : 'Nee',
                'Unit': '14m² ExtraOpslag Box',
                'Prijs': 'Vanaf €34.000,- excl. BTW',
                'Oplevering': 'December 2026',
                'Pagina': currentPageUrl(),
                'Tijdstip': new Date().toLocaleString('nl-NL')
              };
              if (formData.buyerType === 'ondernemer') emailData['KvK nummer'] = formData.kvkNumber || 'Niet opgegeven';
              if (formData.buyerType === 'belegger') emailData['Aantal units'] = formData.unitInterest || '1 unit';
              const success = await sendLeadEmail('Koopaanvraag — Stap 4 Voltooid', emailData, honeypot);
              if (success) {
                setIsSuccess(true);
              } else {
                setConfirmError('Versturen mislukt. Probeer opnieuw of bel ons op 0297 548 633.');
              }
            } catch {
              setConfirmError('Er is een fout opgetreden. Probeer opnieuw of bel ons op 0297 548 633.');
            } finally {
              setIsSubmitting(false);
            }
          }} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-70 text-white px-6 py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2">
            
                {isSubmitting ? <Spinner /> : <Send className="w-5 h-5" />}
                <span>{isSubmitting ? 'Versturen...' : 'Verstuur koopaanvraag'}</span>
              </button>
              <button type="button" onClick={() => setStep(3)} className="w-full text-gray-300 hover:text-white px-5 py-2 font-bold transition-colors flex items-center justify-center gap-2"><ArrowLeft className="w-5 h-5" /><span>Terug</span></button>
              <button type="button" onClick={closeModal} className="w-full text-center text-sm font-bold text-gray-400 hover:text-white transition-colors">Annuleren</button>
            </div>}
          {isSuccess && <div className="text-center space-y-6 py-5">
              <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                <span className="purchase-confetti c1"></span><span className="purchase-confetti c2"></span><span className="purchase-confetti c3"></span><span className="purchase-confetti c4"></span><span className="purchase-confetti c5"></span><span className="purchase-confetti c6"></span><span className="purchase-confetti c7"></span><span className="purchase-confetti c8"></span><span className="purchase-confetti c9"></span><span className="purchase-confetti c10"></span><span className="purchase-confetti c11"></span><span className="purchase-confetti c12"></span>
                <div className="purchase-success-check bg-green-500/20 border-2 border-green-500 rounded-full w-20 h-20 flex items-center justify-center"><Check className="w-10 h-10 text-white" /></div>
              </div>
              <div><h2 id="purchase-modal-title" className="text-3xl font-black text-white">Aanvraag ontvangen{formData.firstName ? `, ${formData.firstName}` : ''}!</h2><p className="mt-2 text-gray-400">wij bellen binnen 1 werkdag via {formData.phone}.</p></div>
              <ol className="space-y-3 text-left max-w-sm mx-auto">
                <li className="flex items-center gap-3 text-gray-200"><span className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">1</span><span>Wij bellen u terug op {formData.phone}</span></li>
                <li className="flex items-center gap-3 text-gray-200"><span className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">2</span><span>Wij mailen u indien nodig op {formData.email}</span></li>
                <li className="flex items-center gap-3 text-gray-200"><span className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">3</span><span>Locatievoorkeur: {selectedLocationOption?.title ?? 'Geen voorkeur'}</span></li>
                <li className="flex items-center gap-3 text-gray-200"><span className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">4</span><span>Optie 4 werkdagen</span></li>
                {formData.buyerType === 'belegger' && <li className="flex items-center gap-3 text-gray-200"><span className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">5</span><span>Onze beleggersbrochure bespreken wij tijdens het gesprek</span></li>}
              </ol>
              <p className="text-sm text-gray-400">Vragen? Bel <a href="tel:+31297548633" className="font-bold text-orange-400 hover:text-orange-300 transition-colors">0297 548 633</a> of mail <a href="mailto:hallo@extraopslag.nl?subject=Vraag%20over%20ExtraOpslag.nl%20%E2%80%94%2014m%C2%B2%20Opslagbox&body=Geachte%20ExtraOpslag%20team%2C%0A%0AIk%20heb%20een%20vraag%20over%20de%2014m%C2%B2%20opslagbox.%0A%0A" className="font-bold text-orange-400 hover:text-orange-300 transition-colors">hallo@extraopslag.nl</a>.</p>
              <div className="flex flex-col sm:flex-row justify-center gap-3"><button type="button" onClick={closeModal} className="text-gray-400 hover:text-white px-5 py-3 font-bold transition-colors">Sluit venster</button></div>
              <p className="text-sm text-gray-500">Venster sluit automatisch over {autoCloseSeconds} seconden</p>
            </div>}
        </div>
      </div>
    </div>;
};
const Navbar = () => <nav className="sticky top-0 z-50 bg-[#111827]/90 backdrop-blur-md border-b border-gray-800 py-4 px-6 flex justify-between items-center text-white">
    <div className="text-2xl font-bold tracking-tight">ExtraOpslag<span className="text-orange-500">.nl</span></div>
    <div className="hidden md:flex items-center gap-6 text-sm text-gray-300">
      <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-orange-500" /> Beveiligd</span>
      <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-orange-500" /> 24/7 toegang</span>
      <span className="flex items-center gap-2"><Star className="w-4 h-4 text-orange-500" /> 4.9/5</span>
    </div>
    <div className="flex items-center gap-4">
      <a href="tel:+31297548633" className="hidden lg:flex items-center gap-2 text-gray-300 hover:text-white transition-colors font-medium">
        <Phone className="w-4 h-4" /> <span>0297 548 633</span>
      </a>
      <button data-purchase-modal="true" className="bg-orange-500 hover:bg-orange-600 transition-colors text-white px-5 py-2 rounded-lg font-bold text-sm uppercase tracking-wider shadow-[0_0_15px_rgba(249,115,22,0.3)]">
        Direct Kopen
      </button>
    </div>
  </nav>;
type MicroSlatsProps = {
  preset?: 'swell' | 'wave' | 'ripple';
  color?: string;
  glintColor?: string;
  backgroundColor?: string;
  slatWidth?: number;
  slatHeight?: number;
  gap?: number;
  roundness?: number;
  interactive?: boolean;
  cursorStrength?: number;
  cursorSize?: number;
  swirl?: number;
  trail?: number;
  lean?: number;
  intro?: boolean;
  externalMouseRef?: React.MutableRefObject<{
    x: number;
    y: number;
  }>;
};
const MicroSlats: React.FC<MicroSlatsProps> = ({
  preset = 'swell',
  color = '#F97316',
  glintColor = '#ffffff',
  backgroundColor = '#000000',
  slatWidth = 10,
  slatHeight = 25,
  gap = 3,
  roundness = 0.75,
  interactive = true,
  cursorStrength = 1,
  cursorSize = 40,
  swirl = 0,
  trail = 1.4,
  lean = 0,
  intro = true,
  externalMouseRef
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({
    x: -9999,
    y: -9999
  });
  const introProgressRef = useRef(intro ? 0 : 1);
  const startTimeRef = useRef(Date.now());
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };
    const onMouseLeave = () => {
      mouseRef.current = {
        x: -9999,
        y: -9999
      };
    };
    if (interactive) {
      canvas.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('mouseleave', onMouseLeave);
    }
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return {
        r,
        g,
        b
      };
    };
    const mainRgb = hexToRgb(color);
    const glintRgb = hexToRgb(glintColor);
    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      const t = (Date.now() - startTimeRef.current) / 1000;
      if (intro && introProgressRef.current < 1) {
        introProgressRef.current = Math.min(1, introProgressRef.current + 0.008);
      }
      const introP = introProgressRef.current;
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, W, H);
      const cols = Math.ceil(W / (slatWidth + gap));
      const rows = Math.ceil(H / (slatHeight + gap));
      const radius = roundness * Math.min(slatWidth, slatHeight) * 0.5;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const cx = col * (slatWidth + gap) + slatWidth / 2;
          const cy = row * (slatHeight + gap) + slatHeight / 2;

          // intro: slats fade in column by column
          const introDelay = col / cols;
          const localIntro = Math.max(0, Math.min(1, (introP - introDelay * 0.6) * 2.5));
          if (localIntro <= 0) continue;

          // cursor distance influence
          const cursorPosition = externalMouseRef?.current ?? mouseRef.current;
          const dx = cx - cursorPosition.x;
          const dy = cy - cursorPosition.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const cursorInfluence = interactive ? Math.max(0, 1 - dist / (cursorSize * 10)) * cursorStrength : 0;

          // swell preset: wave travels across cols + rows
          let swell = 0;
          if (preset === 'swell') {
            const waveX = Math.sin(col * 0.35 + t * 1.4 * trail);
            const waveY = Math.sin(row * 0.5 + t * 0.9);
            swell = (waveX * 0.5 + waveY * 0.5) * 0.5 + 0.5;
          } else if (preset === 'wave') {
            swell = (Math.sin(col * 0.4 - t * 2 * trail) + 1) * 0.5;
          } else {
            const r2 = Math.sqrt(Math.pow(col - cols / 2, 2) + Math.pow(row - rows / 2, 2));
            swell = (Math.sin(r2 * 0.6 - t * 2 * trail) + 1) * 0.5;
          }
          const influence = Math.max(swell, cursorInfluence);

          // scale slat by swell
          const scaleW = 0.3 + influence * 0.7;
          const scaleH = 0.4 + influence * 0.6;
          const sw = slatWidth * scaleW * localIntro;
          const sh = slatHeight * scaleH * localIntro;
          if (sw < 0.5 || sh < 0.5) continue;
          const x = cx - sw / 2;
          const y = cy - sh / 2;
          const r = Math.min(radius, sw / 2, sh / 2);

          // color: interpolate between dim and bright based on influence
          const dimFactor = 0.15;
          const red = Math.round(mainRgb.r * dimFactor + mainRgb.r * influence * (1 - dimFactor));
          const green = Math.round(mainRgb.g * dimFactor + mainRgb.g * influence * (1 - dimFactor));
          const blue = Math.round(mainRgb.b * dimFactor + mainRgb.b * influence * (1 - dimFactor));
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + sw - r, y);
          ctx.quadraticCurveTo(x + sw, y, x + sw, y + r);
          ctx.lineTo(x + sw, y + sh - r);
          ctx.quadraticCurveTo(x + sw, y + sh, x + sw - r, y + sh);
          ctx.lineTo(x + r, y + sh);
          ctx.quadraticCurveTo(x, y + sh, x, y + sh - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.closePath();
          ctx.fillStyle = `rgb(${red},${green},${blue})`;
          ctx.fill();

          // glint highlight on top-left of swell peak
          if (influence > 0.7 && sw > 3 && sh > 3) {
            const glintAlpha = (influence - 0.7) * 3 * 0.45;
            ctx.beginPath();
            ctx.ellipse(x + sw * 0.28, y + sh * 0.22, sw * 0.18, sh * 0.12, -0.4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${glintRgb.r},${glintRgb.g},${glintRgb.b},${glintAlpha})`;
            ctx.fill();
          }
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      if (interactive) {
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('mouseleave', onMouseLeave);
      }
    };
  }, [preset, color, glintColor, backgroundColor, slatWidth, slatHeight, gap, roundness, interactive, cursorStrength, cursorSize, swirl, trail, lean, intro, externalMouseRef]);
  return <canvas ref={canvasRef} style={{
    width: '100%',
    height: '100%',
    display: 'block'
  }} />;
};
const Hero = ({
  availableUnits,
  onDownloadBrochure
}: Pick<AvailabilityProps, 'availableUnits'> & {
  onDownloadBrochure: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }
    const particles = Array.from({
      length: 20
    }, (_, particleIndex) => ({
      id: `particle-${particleIndex}`,
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      radius: 1.5 + Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35
    }));
    let animationFrame = 0;
    let width = 0;
    let height = 0;
    const resizeCanvas = () => {
      const ratio = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = 'rgba(249, 115, 22, 0.15)';
      for (let x = 0; x <= width; x += 40) {
        for (let y = 0; y <= height; y += 40) {
          context.beginPath();
          context.arc(x, y, 1, 0, Math.PI * 2);
          context.fill();
        }
      }
      const pulse = 0.035 + Math.sin(time / 900) * 0.025;
      context.strokeStyle = `rgba(249, 115, 22, ${pulse})`;
      context.lineWidth = 1;
      for (let x = 0; x <= width; x += 80) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 0; y <= height; y += 80) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
      particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x <= 0 || particle.x >= width) {
          particle.vx *= -1;
        }
        if (particle.y <= 0 || particle.y >= height) {
          particle.vy *= -1;
        }
        context.fillStyle = 'rgba(249, 115, 22, 0.35)';
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const first = particles[i];
          const second = particles[j];
          const distance = Math.hypot(first.x - second.x, first.y - second.y);
          if (distance < 120) {
            context.strokeStyle = `rgba(249, 115, 22, ${(1 - distance / 120) * 0.16})`;
            context.beginPath();
            context.moveTo(first.x, first.y);
            context.lineTo(second.x, second.y);
            context.stroke();
          }
        }
      }
      animationFrame = window.requestAnimationFrame(draw);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    animationFrame = window.requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);
  return <section id="hero" className="bg-[#111827] text-white pt-20 pb-16 px-6 lg:px-12 relative overflow-hidden" style={{
    position: 'relative',
    overflow: 'hidden',
    contain: 'layout paint',
    willChange: 'transform'
  }}>
      <canvas ref={canvasRef} className="absolute inset-0 z-[1] pointer-events-none w-full h-full" aria-hidden="true" />
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10">
        <div className="space-y-8 relative z-10">
          <h1 className="text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.05] tracking-tight" style={{
          textShadow: '0 0 80px rgba(249,115,22,0.15)'
        }}>
            <span>Jouw </span><span className="text-orange-500">eigen</span><span> 14m²</span><br /><span>opslagbox.</span>
          </h1>
          <div className="space-y-4">
            <p className="text-xl text-gray-300">Koop nu direct. Geen huur, maar volledig eigendom.</p>
            <div className="flex flex-wrap gap-2" aria-label="Kernpunten">
              <span className="rounded-full bg-orange-500/15 border border-orange-500/30 px-3 py-1 text-sm font-bold text-orange-300">14m2</span>
              <span className="rounded-full bg-orange-500/15 border border-orange-500/30 px-3 py-1 text-sm font-bold text-orange-300">Eigen eigendom</span>
              <span className="rounded-full bg-orange-500/15 border border-orange-500/30 px-3 py-1 text-sm font-bold text-orange-300">Oplevering december 2026</span>
            </div>
          </div>
          <ul className="space-y-4">
            {HERO_USPS.map(usp => <li key={usp.id} className="flex items-center gap-3 text-lg font-medium">
                <div className="bg-orange-500/20 p-1 rounded-full"><Check className="w-5 h-5 text-orange-500" /></div>
                <span>{usp.label}</span>
              </li>)}
          </ul>
          <div className="inline-flex items-center gap-2 mt-6 mb-3 bg-orange-500/8 border border-orange-500/20 rounded-full px-4 py-1.5">
            <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span></span>
            <span className="text-sm font-semibold text-orange-300 tracking-wide">Oplevering December 2026</span>
            <CalendarDays className="w-4 h-4 text-orange-400" />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button data-purchase-modal="true" className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-bold text-lg uppercase tracking-wider shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all">
              Koop nu — Vanaf €34.000,-
            </button>
            <button type="button" onClick={onDownloadBrochure} className="border border-white/20 text-white hover:bg-white/10 px-8 py-4 text-lg rounded-2xl transition-all flex items-center justify-center gap-2 font-bold">
              <Download className="w-5 h-5" />
              <span>Download Brochure</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-5" aria-label="Box specificaties">
            <span className="inline-flex items-center gap-2 bg-[#1F2937] border border-white/12 hover:border-orange-500/40 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-200 group"><Square className="w-4 h-4 text-orange-400 group-hover:text-orange-300" /><span className="text-gray-200 group-hover:text-white">14m² ruimte</span></span>
            <span className="inline-flex items-center gap-2 bg-[#1F2937] border border-white/12 hover:border-orange-500/40 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-200 group"><ArrowUp className="w-4 h-4 text-orange-400 group-hover:text-orange-300" /><span className="text-gray-200 group-hover:text-white">3,4m Hoog</span></span>
            <span className="inline-flex items-center gap-2 bg-[#1F2937] border border-white/12 hover:border-orange-500/40 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-200 group"><ArrowRight className="w-4 h-4 text-orange-400 group-hover:text-orange-300" /><span className="text-gray-200 group-hover:text-white">4m Breed</span></span>
            <span className="inline-flex items-center gap-2 bg-[#1F2937] border border-white/12 hover:border-orange-500/40 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-200 group"><ArrowRight className="w-4 h-4 rotate-45 text-orange-400 group-hover:text-orange-300" /><span className="text-gray-200 group-hover:text-white">3,5m Diep</span></span>
          </div>
        </div>
        <div className="relative z-10 h-[420px] w-full rounded-2xl bg-[#0F1117] border border-gray-800 shadow-2xl flex flex-col items-center justify-center">
          <div className="absolute inset-0 z-0">
            <Suspense fallback={<div className="h-full w-full bg-[#0F1117]" aria-hidden="true" />}>
              <BoxViewer3D />
            </Suspense>
          </div>
          <div className="absolute bottom-4 z-10 text-gray-400 text-sm font-medium tracking-wide bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm pointer-events-none">
            Interactief — Sleep om te draaien
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto mt-16 bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 text-center relative z-10">
        <p className="text-orange-400 font-bold flex items-center justify-center gap-2">
          <Zap className="w-5 h-5" /> <span>Nog {availableUnits} units beschikbaar — Wees er snel bij</span>
        </p>
      </div>
      <span className="hero-sweep-line" aria-hidden="true"></span>
    </section>;
};
const TrustBar = () => <section className="bg-white py-8 border-b border-gray-200">
    <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-center gap-8 lg:gap-16 text-gray-700 font-semibold text-sm lg:text-base">
      <span className="flex items-center gap-2"><Key className="w-6 h-6 text-orange-500" /> Eigen eigendom</span>
      <span className="flex items-center gap-2"><Shield className="w-6 h-6 text-orange-500" /> Camera en alarmbeveiliging</span>
      <span className="flex items-center gap-2"><Clock className="w-6 h-6 text-orange-500" /> 24/7 toegang</span>
      <span className="flex items-center gap-2"><Zap className="w-6 h-6 text-orange-500" /> Elektriciteit inbegrepen</span>
      <span className="flex items-center gap-2"><Briefcase className="w-6 h-6 text-orange-500" /> VvE geregeld</span>
    </div>
  </section>;
const FacilityCarouselSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const totalItems = FACILITY_GALLERY_ITEMS.length;
  const goToPrevious = () => {
    setCurrentIndex(current => current === 0 ? totalItems - 1 : current - 1);
  };
  const goToNext = () => {
    setCurrentIndex(current => current === totalItems - 1 ? 0 : current + 1);
  };
  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    touchStartX.current = event.touches[0].clientX;
  };
  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (touchStartX.current === null) {
      return;
    }
    const deltaX = touchStartX.current - event.changedTouches[0].clientX;
    if (Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }
    touchStartX.current = null;
  };
  useEffect(() => {
    if (isPaused) {
      return undefined;
    }
    const interval = window.setInterval(goToNext, 4000);
    return () => window.clearInterval(interval);
  }, [isPaused, totalItems]);
  const progressWidth = `${(currentIndex + 1) / totalItems * 100}%`;
  return <section className="bg-[#141414] text-white" aria-labelledby="facility-carousel-title">
      <div className="grid gap-10 bg-[#141414] px-8 py-16 lg:grid-cols-[35fr_65fr] lg:px-16 lg:items-start">
        <div className="lg:pt-4">
          <h2 id="facility-carousel-title" className="max-w-md text-3xl font-light leading-snug text-white lg:text-4xl">De opslagbox is onder andere geschikt voor:</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {FACILITY_USE_CASES.map(useCase => {
          const Icon = useCase.icon;
          return <article key={useCase.id} className="group cursor-pointer">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl" style={{
              background: useCase.fallbackBackground
            }}>
                  <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                    <Icon className="h-12 w-12 text-white opacity-35" />
                  </div>
                  <img src={useCase.imageUrl} alt={useCase.alt} className="relative z-10 h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105" style={{
                objectPosition: useCase.objectPosition
              }} onError={event => {
                event.currentTarget.style.display = 'none';
              }} />
                  <div className="absolute inset-x-0 bottom-0 z-20 h-1/2 bg-gradient-to-t from-black/70 to-transparent" aria-hidden="true"></div>
                  <div className="absolute left-3 top-3 z-30 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">14m²</div>
                </div>
                <p className="mt-3 text-base font-semibold text-white">{useCase.label}</p>
              </article>;
        })}
        </div>
      </div>
      <div className="relative w-full overflow-hidden bg-[#141414]" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="flex gap-1 transition-transform duration-500 ease-in-out" style={{
        transform: `translateX(calc(-${currentIndex} * (max(45vw, 600px) + 0.25rem)))`
      }}>
          {FACILITY_GALLERY_ITEMS.map(item => <article key={item.id} className="relative h-[340px] w-[45vw] min-w-[600px] shrink-0 overflow-hidden">
              <img src={item.imageUrl} alt={item.alt} style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: item.objectPosition,
            display: 'block'
          }} onError={event => {
            event.currentTarget.style.display = 'none';
          }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden="true"></div>
              <p className="absolute bottom-4 left-6 text-white text-sm font-light">{item.label}</p>
            </article>)}
        </div>
      </div>
      <div className="flex flex-col gap-4 bg-[#141414] px-8 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-16">
        <p className="text-sm font-light text-white/60">Bekijk onze faciliteiten</p>
        <div className="flex w-full flex-col gap-3 lg:w-[48%]">
          <div className="h-px w-full overflow-hidden bg-white/10">
            <div className="h-full bg-orange-500 transition-all duration-500" style={{
            width: progressWidth
          }}></div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={goToPrevious} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-transparent text-white transition-all hover:border-orange-500 hover:text-orange-400" aria-label="Vorige faciliteitsafbeelding"><span aria-hidden="true">‹</span></button>
            <button type="button" onClick={goToNext} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-transparent text-white transition-all hover:border-orange-500 hover:text-orange-400" aria-label="Volgende faciliteitsafbeelding"><span aria-hidden="true">›</span></button>
          </div>
        </div>
      </div>
      <div className="bg-[#141414] px-8 py-8 text-center">
        <button type="button" data-purchase-modal="true" className="rounded-xl bg-orange-500 px-8 py-4 text-base font-bold uppercase tracking-wider text-white shadow-[0_0_24px_rgba(249,115,22,0.28)] transition-colors hover:bg-orange-600">Koop uw eigen opslagbox</button>
      </div>
    </section>;
};
const Specs = () => <section className="bg-[#0F1117] py-24 text-white px-6">
    <div className="max-w-7xl mx-auto">
      <h2 className="text-4xl font-bold mb-16 text-center">De 14m² ExtraOpslag Box — Alles wat u nodig heeft</h2>
      <div className="grid lg:grid-cols-2 gap-16">
        <div className="bg-[#1F2937] p-8 rounded-2xl border border-gray-800">
          <h3 className="text-2xl font-bold mb-6 text-orange-500">Specificaties</h3>
          <ul className="space-y-4">
            {SPECS.map(spec => <li key={spec.id} className="flex justify-between items-center py-3 border-b border-gray-700 last:border-0">
                <span className="text-gray-400">{spec.label}</span>
                <span className="font-semibold">{spec.val}</span>
              </li>)}
          </ul>
        </div>
        <div>
          <h3 className="text-2xl font-bold mb-6 text-white">Ideaal voor</h3>
          <div className="grid grid-cols-2 gap-4">
            {USE_CASES.map(useCase => {
            const Icon = useCase.icon;
            return <div key={useCase.id} className="bg-[#1F2937] p-6 rounded-xl border border-gray-800 flex flex-col items-center gap-4 text-center">
                  <Icon className="w-8 h-8 text-orange-500" />
                  <span className="font-semibold text-gray-200">{useCase.label}</span>
                </div>;
          })}
          </div>
          <div className="mt-8 bg-gradient-to-r from-orange-500/20 to-transparent p-6 rounded-xl border-l-4 border-orange-500">
            <p className="font-medium text-orange-100">
              <strong className="text-orange-400 block mb-1">Vergelijk 14m² met een single garage:</strong>
              <span>Zelfde ruimte, volledig eigendom, met sterke investeringswaarde.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>;
const ScarcityStrip = ({
  availableUnits
}: Pick<AvailabilityProps, 'availableUnits'>) => <section className="bg-[#111827] px-6 py-6 text-white border-y border-orange-500/20">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-center gap-4 text-center">
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
      </span>
      <p className="text-lg font-bold tracking-tight">LIVE: Nog {availableUnits} units beschikbaar van de 14m² box</p>
    </div>
  </section>;
const CounterBar = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [counts, setCounts] = useState({
    owners: 0,
    access: 0,
    area: 0
  });
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) {
      return undefined;
    }
    const observer = new IntersectionObserver(entries => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        setHasEntered(true);
        observer.disconnect();
      }
    }, {
      threshold: 0.35
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!hasEntered) {
      return undefined;
    }
    const duration = 1300;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCounts({
        owners: Math.round(47 * ease),
        access: Math.round(24 * ease),
        area: Math.round(14 * ease)
      });
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [hasEntered]);
  return <section ref={sectionRef} className="bg-white px-6 py-12 border-b border-gray-200">
      <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
        <div>
          <div className="text-4xl md:text-5xl font-extrabold text-gray-900">{counts.owners}</div>
          <p className="mt-2 text-gray-500 font-medium">eigenaren</p>
        </div>
        <div>
          <div className="text-4xl md:text-5xl font-extrabold text-gray-900">6-8%</div>
          <p className="mt-2 text-gray-500 font-medium">rendement per jaar</p>
        </div>
        <div>
          <div className="text-4xl md:text-5xl font-extrabold text-gray-900">{counts.access}/7</div>
          <p className="mt-2 text-gray-500 font-medium">toegang</p>
        </div>
        <div>
          <div className="text-4xl md:text-5xl font-extrabold text-orange-500">{counts.area}m²</div>
          <p className="mt-2 text-gray-500 font-medium">per unit</p>
        </div>
      </div>
    </section>;
};
const Pricing = ({
  totalUnits,
  soldUnits,
  availableUnits,
  onDownloadBrochure
}: AvailabilityProps & {
  onDownloadBrochure: () => void;
}) => {
  const pricingMouseRef = useRef({
    x: -9999,
    y: -9999
  });
  const availabilityDots = useMemo(() => Array.from({
    length: totalUnits
  }, (_, unitIndex) => ({
    id: `unit-dot-${unitIndex + 1}`,
    status: unitIndex < soldUnits ? 'sold' : 'available'
  })), [totalUnits, soldUnits]);
  return <section className="bg-orange-500 py-24 px-6 relative overflow-hidden" onMouseMove={event => {
    const rect = event.currentTarget.getBoundingClientRect();
    pricingMouseRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }} onMouseLeave={() => {
    pricingMouseRef.current = {
      x: -9999,
      y: -9999
    };
  }}>
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 0,
      pointerEvents: 'none'
    }}>
      <MicroSlats preset="swell" color="#F97316" glintColor="#ffffff" backgroundColor="#000000" slatWidth={10} slatHeight={25} gap={3} roundness={0.75} interactive={true} cursorStrength={1} cursorSize={40} swirl={0} trail={1.4} lean={0} intro externalMouseRef={pricingMouseRef} />
    </div>
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 1,
      background: 'rgba(0,0,0,0.72)',
      pointerEvents: 'none'
    }} />
    <div className="absolute inset-0 z-[1] bg-carbon-fibre opacity-10 pointer-events-none"></div>
    <div className="max-w-4xl mx-auto text-center relative z-[2]">
      <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-12 drop-shadow-md">
        Investeer in eigen opslag — <br /> eenmalig, voor altijd
      </h2>
      <div className="bg-[#111827] p-10 md:p-14 rounded-3xl shadow-2xl border border-gray-700 relative">
        <div className="text-orange-500 font-bold tracking-widest uppercase mb-4">Aankoopprijs</div>
        <div className="text-6xl font-extrabold text-white mb-2">€34.000,-</div>
        <div className="text-gray-400 mb-3 font-medium">excl. BTW | + 21% BTW terugvorderbaar voor ondernemers</div>
        <p className="mb-8 text-sm font-semibold text-orange-300">Betaling in termijnen mogelijk - vraag naar de mogelijkheden</p>
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-2 max-w-[330px]" aria-label={`${soldUnits} verkocht, ${availableUnits} beschikbaar`}>
            {availabilityDots.map(unit => <span key={unit.id} className={`h-3 w-3 rounded-full ${unit.status === 'sold' ? 'bg-red-500' : 'bg-orange-500'}`}></span>)}
          </div>
          <p className="text-xs uppercase tracking-widest text-gray-400"><span>{soldUnits} verkocht</span><span className="mx-2 text-gray-600">/</span><span className="text-orange-300">{availableUnits} beschikbaar</span></p>
        </div>
        <div className="grid md:grid-cols-2 gap-4 text-left mb-10">
          {PRICE_BENEFITS.map(benefit => <div key={benefit.id} className="flex items-center gap-3 text-lg text-gray-200 font-medium">
              <div className="bg-orange-500 rounded-full p-1"><Check className="w-4 h-4 text-white" /></div>
              <span>{benefit.label}</span>
            </div>)}
        </div>
        <button data-purchase-modal="true" className="w-full bg-orange-500 hover:bg-orange-400 text-black px-8 py-5 rounded-xl font-bold text-xl uppercase tracking-wider transition-all shadow-[0_0_30px_rgba(249,115,22,0.5)] flex items-center justify-center gap-2">
          <span>Koop mijn opslagbox</span><span className="text-2xl leading-none">→</span>
        </button>
        <button type="button" onClick={onDownloadBrochure} className="mt-4 w-full border border-white/20 text-white hover:bg-white/10 px-8 py-4 text-lg rounded-2xl transition-all flex items-center justify-center gap-2 font-bold">
          <Download className="w-5 h-5" />
          <span>Download gratis brochure</span>
        </button>
        <div className="mt-8 text-gray-400 flex flex-col items-center gap-2">
          <p className="font-medium text-lg text-gray-300">Of bel direct: <a href="tel:+31297548633" className="text-orange-500 font-bold hover:text-orange-400 transition-colors">0297 548 633</a></p>
          <p className="text-sm">Vrij gesprek, geen verplichtingen</p>
        </div>
      </div>
      <div className="mt-8 text-white font-bold text-xl drop-shadow-md bg-black/20 inline-block px-6 py-3 rounded-full backdrop-blur-md">
        Aanbieding geldig tot: <span className="text-yellow-300">03 dagen 12:45:00</span>
      </div>
    </div>
  </section>;
};
const YieldCalculator = ({
  onDownloadBrochure
}: {
  onDownloadBrochure: () => void;
}) => {
  const [rent, setRent] = useState(350);
  const annualIncome = rent * 12;
  const grossYield = Math.min(Math.max(annualIncome / PURCHASE_PRICE * 100, 6), 8);
  return <section className="bg-[#F8FAFC] py-24 px-6 border-b border-gray-200">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-orange-600 font-bold uppercase tracking-widest text-sm mb-4">
            <Calculator className="w-4 h-4" /><span>Rental Yield Calculator</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-5">Reken uw potentiële verhuurrendement.</h2>
          <p className="text-lg text-gray-600 leading-relaxed">Stel de maandhuur in en zie direct de jaarlijkse inkomsten, het bruto rendement binnen de 6-8% bandbreedte en de indicatieve terugverdientijd van 5-10 jaar op basis van €34.000 aankoopprijs.</p>
        </div>
        <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
          <label htmlFor="rent-range" className="flex justify-between gap-4 text-gray-900 font-bold mb-4">
            <span>Maandhuur</span>
            <span className="text-orange-500">€{rent},-</span>
          </label>
          <input id="rent-range" type="range" min="200" max="450" step="10" value={rent} onChange={event => setRent(Number(event.target.value))} className="w-full accent-orange-500" />
        
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            <div className="rounded-2xl bg-gray-50 p-5 border border-gray-100">
              <p className="text-sm text-gray-500 font-medium">Jaarlijkse inkomsten</p>
              <div className="text-2xl font-extrabold text-gray-900 mt-2">€{annualIncome.toLocaleString('nl-NL')}</div>
            </div>
            <div className="rounded-2xl bg-gray-50 p-5 border border-gray-100">
              <p className="text-sm text-gray-500 font-medium">Bruto rendement</p>
              <div className="text-2xl font-extrabold text-gray-900 mt-2">{grossYield.toFixed(1)}%</div>
            </div>
            <div className="rounded-2xl bg-gray-50 p-5 border border-gray-100">
              <p className="text-sm text-gray-500 font-medium">Terugverdientijd</p>
              <div className="text-2xl font-extrabold text-gray-900 mt-2">5-10 jaar</div>
            </div>
          </div>
          <button type="button" onClick={onDownloadBrochure} className="mt-8 w-full bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-bold text-lg uppercase tracking-wider transition-colors flex items-center justify-center gap-2">
            <Download className="w-5 h-5" />
            <span>Download beleggersbrochure</span>
          </button>
        </div>
      </div>
    </section>;
};
const Testimonials = () => <section className="bg-[#111827] py-24 px-6 lg:px-16 relative overflow-hidden" aria-labelledby="reviews-title">
    <div style={{
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none'
  }}>
      <MicroSlats preset="swell" color="#F97316" glintColor="#ffffff" backgroundColor="#111827" slatWidth={10} slatHeight={25} gap={3} roundness={0.75} interactive={false} cursorStrength={1} cursorSize={40} swirl={0} trail={1.4} lean={0} intro />
    </div>
    <div style={{
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    background: 'rgba(17,24,39,0.80)',
    pointerEvents: 'none'
  }} />
    <div className="max-w-7xl mx-auto relative z-[2]">
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-orange-400">BEOORDELINGEN</p>
      <h2 id="reviews-title" className="text-3xl font-black text-white mt-2">Wat onze eigenaren zeggen</h2>
      <div className="flex flex-col lg:flex-row lg:items-center gap-6 mt-6 mb-10 p-6 bg-[#1F2937] rounded-2xl border border-white/10">
        <div className="text-6xl font-black text-white">4.9</div>
        <div className="lg:min-w-56">
          <div className="text-orange-400 text-2xl tracking-tight" aria-label="5 van 5 sterren">★★★★★</div>
          <p className="mt-1 text-sm text-gray-400">op basis van 47 beoordelingen</p>
        </div>
        <div className="grid gap-2 lg:ml-auto">
          {REVIEW_BREAKDOWN.map(row => <div key={row.id} className="flex items-center gap-3">
              <span className="w-7 text-xs font-semibold text-gray-300">{row.label}</span>
              <span className="h-2 w-32 rounded-full bg-white/10 overflow-hidden">
                <span className="block h-full rounded-full bg-orange-500" style={{
              width: row.width
            }}></span>
              </span>
              <span className="w-5 text-xs text-gray-400 text-right">{row.count}</span>
            </div>)}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
        {REVIEW_CARDS.map(review => <article key={review.id} className="bg-[#1F2937] rounded-2xl border border-white/8 p-6 flex flex-col gap-3 hover:border-white/20 transition-colors">
            <div className="flex items-center gap-3">
              <div className="rounded-full w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-black text-sm">{review.initials}</div>
              <div>
                <h3 className="font-semibold text-white">{review.name}</h3>
                <p className="text-xs text-gray-400">{review.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-orange-400 text-sm tracking-tight" aria-label="5 van 5 sterren">{review.rating}</span>
              <span className="text-xs text-gray-500 ml-auto">{review.date}</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{review.text}</p>
            <div className="mt-auto flex items-center gap-1 text-xs text-green-400">
              <Check className="w-3.5 h-3.5" />
              <span>Geverifieerde eigenaar</span>
            </div>
          </article>)}
      </div>
    </div>
  </section>;
const GuaranteeBadges = () => <section className="bg-white py-24 px-6 border-y border-gray-200">
    <div className="max-w-7xl mx-auto">
      <h2 className="text-4xl font-bold text-center text-gray-900 mb-14">Zeker kopen, helder geregeld</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {GUARANTEE_BADGES.map(badge => {
        const Icon = badge.icon;
        return <div key={badge.id} className="rounded-2xl border border-gray-200 p-7 bg-white shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-5">
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{badge.title}</h3>
              <p className="text-gray-600 leading-relaxed">{badge.text}</p>
            </div>;
      })}
      </div>
    </div>
  </section>;
const HowItWorks = () => <section className="bg-[#F8FAFC] py-24 px-6 border-y border-gray-200">
    <div className="max-w-5xl mx-auto text-center">
      <h2 className="text-4xl font-bold text-gray-900 mb-16">In 3 stappen eigenaar</h2>
      <div className="grid md:grid-cols-3 gap-8 relative">
        <div className="hidden md:block absolute top-1/2 left-1/6 right-1/6 h-0.5 bg-gray-300 -z-10 -translate-y-1/2"></div>
        {STEPS.map(step => <div key={step.id} className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center">
            <div className="w-16 h-16 bg-orange-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-6 shadow-lg shadow-orange-500/30">
              {step.step}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
            <p className="text-gray-600">{step.desc}</p>
          </div>)}
      </div>
      <div className="mt-16">
        <button data-purchase-modal="true" className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 rounded-xl font-bold text-lg uppercase tracking-wider shadow-lg transition-colors">
          Start nu →
        </button>
      </div>
    </div>
  </section>;
const LocationSection = () => {
  const mapRef = useRef<any>(null);
  const highlightMarkersRef = useRef<Array<{
    name: string;
    marker: any;
  }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    const mapContainer = document.getElementById('extraopslag-map') as (HTMLElement & {
      _leaflet_id?: number;
    }) | null;
    if (!mapContainer || mapContainer._leaflet_id) {
      return undefined;
    }
    let mapInstance: any;
    let cancelled = false;
    const initMap = async (): Promise<any> => {
      // Leaflet is bundled with the site (no CDN) but loaded on demand, in its own chunk.
      const [{ default: L }] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
      if (cancelled || mapContainer._leaflet_id) {
        return undefined;
      }
      const LAT = 52.2511772;
      const LNG = 4.8024296;
      const map = L.map('extraopslag-map', {
        center: [52.2511772, 4.8024296],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true
      });
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);
      map.on('click', () => map.scrollWheelZoom.enable());
      const pulseIcon = L.divIcon({
        html: `<div style="position:relative;width:28px;height:28px">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(249,115,22,0.25);animation:leaflet-pulse 2s ease-out infinite"></div>
      <div style="position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:50%;background:#F97316;border:3px solid white;box-shadow:0 0 12px rgba(249,115,22,0.8)"></div>
    </div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16]
      });
      L.marker([LAT, LNG], {
        icon: pulseIcon
      }).addTo(map).bindPopup(`<div style="padding:4px"><div style="color:#F97316;font-weight:800;font-size:14px;margin-bottom:4px">ExtraOpslag.nl</div><div>Noorddammerweg 15B</div><div>1422 AD Uithoorn</div><div style="margin-top:6px"><a href="tel:+31297548633" style="color:#F97316;font-weight:600">0297 548 633</a></div></div>`).openPopup();
      const makeIcon = (color: string) => L.divIcon({
        html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
        className: '',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        popupAnchor: [0, -8]
      });
      const pois = [{
        name: 'Schiphol Airport',
        lat: 52.3086,
        lng: 4.7639,
        color: '#3B82F6',
        desc: '~10 min rijden'
      }, {
        name: 'A9 Oprit Uithoorn',
        lat: 52.258,
        lng: 4.815,
        color: '#10B981',
        desc: 'Snelwegaansluiting'
      }, {
        name: 'Uithoorn Centrum',
        lat: 52.2378,
        lng: 4.8275,
        color: '#8B5CF6',
        desc: '~5 min lopen'
      }, {
        name: 'Aalsmeer',
        lat: 52.2631,
        lng: 4.7614,
        color: '#8B5CF6',
        desc: '~8 min rijden'
      }, {
        name: 'Amstelveen',
        lat: 52.3012,
        lng: 4.86,
        color: '#8B5CF6',
        desc: '~12 min rijden'
      }, {
        name: 'Amsterdam RAI',
        lat: 52.339,
        lng: 4.89,
        color: '#EF4444',
        desc: '~20 min rijden'
      }, {
        name: 'Praxis Bouwmarkt',
        lat: 52.249,
        lng: 4.805,
        color: '#F59E0B',
        desc: '~5 min rijden'
      }, {
        name: 'IKEA Badhoevedorp',
        lat: 52.3525,
        lng: 4.7797,
        color: '#F59E0B',
        desc: '~15 min rijden'
      }];
      highlightMarkersRef.current = pois.map(p => {
        const marker = L.marker([p.lat, p.lng], {
          icon: makeIcon(p.color)
        }).addTo(map).bindPopup(`<div><strong style="color:white">${p.name}</strong><br><span style="color:#9CA3AF;font-size:12px">${p.desc}</span></div>`);
        return {
          name: p.name,
          marker
        };
      });
      L.circle([LAT, LNG], {
        radius: 500,
        color: '#F97316',
        fillColor: '#F97316',
        fillOpacity: 0.05,
        weight: 1.5,
        dashArray: '6 4'
      }).addTo(map);
      return map;
    };
    // Only contact OpenStreetMap (map tiles = visitor IP) once the map is about to be scrolled into view.
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) {
        return;
      }
      observer.disconnect();
      initMap().then(m => {
        mapInstance = m;
        if (cancelled && m) {
          m.remove();
        }
      });
    }, {
      rootMargin: '400px'
    });
    observer.observe(mapContainer);
    return () => {
      cancelled = true;
      observer.disconnect();
      if (mapInstance) {
        mapInstance.remove();
      }
      mapRef.current = null;
      highlightMarkersRef.current = [];
    };
  }, []);
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchQuery(value);
    if (!value.trim()) {
      return;
    }
    const match = highlightMarkersRef.current.find(item => item.name.toLowerCase().includes(value.trim().toLowerCase()));
    if (match && mapRef.current) {
      match.marker.openPopup();
      mapRef.current.setView(match.marker.getLatLng(), 13, {
        animate: true
      });
    }
  };
  return <div className="bg-[#0F1117]">
      <section className="bg-[#0F1117] py-24 px-6 lg:px-16 text-white" aria-labelledby="location-title">
      <div className="max-w-7xl mx-auto">
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-orange-400">LOCATIE</p>
        <h2 id="location-title" className="text-3xl lg:text-4xl font-black text-white mt-2">Ideaal gelegen en goed bereikbaar</h2>
        <div className="bg-[#1F2937] border border-white/10 rounded-full px-5 py-2 inline-flex items-center gap-2 mt-4">
          <MapPin className="text-orange-500 w-4 h-4" />
          <span className="text-sm text-gray-300">Noorddammerweg 15B, 1422 AD Uithoorn</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-10 mb-12">
          {LOCATION_TRAVEL_TIMES.map(card => <article key={card.id} className="flex flex-col items-start gap-3">
              <div className={`${card.className} rounded-xl w-16 h-16 flex flex-col items-center justify-center`}>
                <span className="text-2xl font-black text-white">{card.minutes}</span>
                <span className="text-xs text-white/80 font-medium">min</span>
              </div>
              <h3 className="text-white font-semibold text-lg mt-1">{card.label}</h3>
            </article>)}
        </div>
        <div className="bg-[#1F2937] border border-white/10 rounded-xl flex items-center gap-3 px-4 py-3 mt-8 mb-4">
          <Search className="text-gray-500 w-5 h-5 shrink-0" />
          <input value={searchQuery} onChange={handleSearchChange} placeholder="Zoek in de buurt..." className="bg-transparent text-white outline-none flex-1 text-sm placeholder:text-gray-500" aria-label="Zoek in de buurt" />
        </div>
        <div className="flex flex-row gap-4 flex-wrap text-xs text-gray-400 mt-3 mb-2" aria-label="Legenda van de kaart">
          <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1 bg-orange-500"></span><span>ExtraOpslag.nl</span></span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1 bg-blue-500"></span><span>Luchthaven</span></span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1 bg-green-500"></span><span>Snelweg</span></span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1 bg-purple-500"></span><span>Steden</span></span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1 bg-yellow-500"></span><span>Winkels</span></span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1 bg-red-500"></span><span>Uitstap Amsterdam</span></span>
        </div>
        <div id="extraopslag-map" style={{
          width: '100%',
          height: '440px',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.1)',
          position: 'relative',
          zIndex: 1
        }}></div>
        <div className="flex flex-wrap gap-2 mt-4">
          {LOCATION_CHIPS.map(chip => <button key={chip.id} type="button" className="bg-[#1F2937] border border-white/10 text-gray-400 text-xs px-3 py-1.5 rounded-full cursor-pointer hover:border-orange-500 hover:text-orange-400 transition-all">
              {chip.label}
            </button>)}
        </div>
        <a href="https://www.openstreetmap.org/node/2820626217" target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs text-gray-500 hover:text-orange-400 transition-colors"><span>Bekijk op OpenStreetMap</span></a>
        <a href="https://maps.google.com/?q=Noorddammerweg+15B,+Uithoorn" target="_blank" rel="noreferrer" className="mt-5 block text-sm text-gray-400 hover:text-orange-400 transition-colors">Bekijk op Google Maps ↗</a>
      </div>
    </section>
    <section className="bg-[#0F1117] py-24 px-6 lg:px-16" aria-labelledby="contact-cta-title">
      <div className="max-w-6xl mx-auto bg-[#111827] rounded-3xl border border-white/10 overflow-hidden grid grid-cols-1 lg:grid-cols-2 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_24px_64px_rgba(0,0,0,0.4)]">
        <div className="relative min-h-[320px] lg:min-h-[480px]">
          <img src={teamImg} alt="ExtraOpslag team beschikbaar om vragen over opslagboxen te beantwoorden" className="h-full w-full object-cover object-center" />
          <div className="absolute right-0 inset-y-0 w-24 bg-gradient-to-r from-transparent to-[#111827]" aria-hidden="true"></div>
          <div className="absolute top-5 left-5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-white text-xs font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" aria-hidden="true"></span>
            <span>Team beschikbaar</span>
          </div>
        </div>
        <div className="p-10 lg:p-14 flex flex-col justify-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500" aria-hidden="true"></span>
            <p className="text-xs font-bold tracking-[0.15em] text-orange-400 uppercase">PERSOONLIJK CONTACT</p>
          </div>
          <div>
            <h2 id="contact-cta-title" className="text-3xl lg:text-4xl font-black text-white leading-tight">Kunnen wij je ergens mee helpen?</h2>
            <p className="mt-5 text-base text-gray-400 leading-relaxed">Wil je even kennismaken of de mogelijkheden van een opslagbox bespreken? Ons team staat geheel vrijblijvend voor je klaar!</p>
          </div>
          <hr className="border-white/8 my-2" />
          <div className="grid gap-4">
            <a href="tel:+31297548633" className="group flex items-center gap-3 transition-colors hover:text-orange-400">
              <Phone className="w-5 h-5 text-orange-400 shrink-0" />
              <span>
                <span className="block text-xs text-gray-500">Telefoon</span>
                <span className="block text-sm font-semibold text-white transition-colors group-hover:text-orange-400">0297 548 633</span>
              </span>
            </a>
            <a href="mailto:hallo@extraopslag.nl?subject=Vraag%20over%20ExtraOpslag.nl%20%E2%80%94%2014m%C2%B2%20Opslagbox&body=Geachte%20ExtraOpslag%20team%2C%0A%0AIk%20heb%20een%20vraag%20over%20de%2014m%C2%B2%20opslagbox.%0A%0A" className="group flex items-center gap-3 transition-colors hover:text-orange-400">
              <Mail className="w-5 h-5 text-orange-400 shrink-0" />
              <span>
                <span className="block text-xs text-gray-500">E-mail</span>
                <span className="block text-sm font-semibold text-white transition-colors group-hover:text-orange-400">hallo@extraopslag.nl</span>
              </span>
            </a>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-orange-400 shrink-0" />
              <span>
                <span className="block text-xs text-gray-500">Locatie</span>
                <span className="block text-sm font-semibold text-white">Noorddammerweg 15B, Uithoorn</span>
              </span>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap mt-2">
            <a href="tel:+31297548633" className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-7 py-3.5 rounded-2xl transition-all duration-200 flex items-center gap-2 shadow-lg shadow-orange-500/25">
              <Phone className="w-4 h-4" />
              <span>Bel ons: 0297 548 633</span>
            </a>
            <a href="mailto:hallo@extraopslag.nl?subject=Vraag%20over%20ExtraOpslag.nl%20%E2%80%94%2014m%C2%B2%20Opslagbox&body=Geachte%20ExtraOpslag%20team%2C%0A%0AIk%20heb%20een%20vraag%20over%20de%2014m%C2%B2%20opslagbox.%0A%0A" className="bg-white/5 border border-white/15 hover:bg-white/10 hover:border-white/25 text-white font-semibold px-7 py-3.5 rounded-2xl transition-all duration-200 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <span>Mail ons</span>
            </a>
          </div>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/8 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><CheckCircle className="w-3.5 h-3.5 text-green-400" /><span>Vrijblijvend</span></span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><CheckCircle className="w-3.5 h-3.5 text-green-400" /><span>Geen verplichtingen</span></span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><CheckCircle className="w-3.5 h-3.5 text-green-400" /><span>Reactie binnen 1 werkdag</span></span>
          </div>
        </div>
      </div>
    </section>
    </div>;
};
const ComparisonTable = () => <section className="bg-[#0F1117] py-24 px-6 text-white">
    <div className="max-w-6xl mx-auto">
      <h2 className="text-4xl font-bold text-center mb-14">Kopen vs huren</h2>
      <div className="overflow-x-auto rounded-3xl border border-gray-800 bg-[#111827]">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="p-6 text-gray-400 font-semibold">Vergelijking</th>
              <th className="p-6 text-orange-400 font-extrabold">Kopen</th>
              <th className="p-6 text-gray-300 font-extrabold">Huren</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map(row => <tr key={row.id} className="border-b border-gray-800 last:border-0">
                <td className="p-6 font-bold text-white">{row.label}</td>
                <td className="p-6 text-gray-200">
                  <span className="inline-flex items-center gap-3"><Check className="w-5 h-5 text-green-400" /><span>{row.buy}</span></span>
                </td>
                <td className="p-6 text-gray-400">
                  <span className="inline-flex items-center gap-3"><X className="w-5 h-5 text-red-400" /><span>{row.rent}</span></span>
                </td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  </section>;
const FAQ = () => {
  const [open, setOpen] = useState<string | null>(null);
  return <section className="bg-white py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">Veelgestelde vragen</h2>
        <div className="space-y-4">
          {FAQ_ITEMS.map(faq => <div key={faq.id} className="border border-gray-200 rounded-xl overflow-hidden">
              <button className="w-full text-left p-6 font-bold text-gray-900 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors gap-4" onClick={() => setOpen(open === faq.id ? null : faq.id)} aria-expanded={open === faq.id}>
            
                <span>{faq.q}</span>
                <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform shrink-0 ${open === faq.id ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {open === faq.id && <motion.div initial={{
              height: 0
            }} animate={{
              height: 'auto'
            }} exit={{
              height: 0
            }} className="overflow-hidden">
                    <div className="p-6 bg-white text-gray-600 border-t border-gray-100 leading-relaxed">{faq.a}</div>
                  </motion.div>}
              </AnimatePresence>
            </div>)}
        </div>
      </div>
    </section>;
};
const FinalCTA = ({
  totalUnits,
  availableUnits
}: Pick<AvailabilityProps, 'totalUnits' | 'availableUnits'>) => <section className="bg-[#111827] py-24 px-6 text-center border-t border-orange-500/20 relative overflow-hidden">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-500/10 blur-[120px] rounded-full pointer-events-none"></div>
    <div className="max-w-3xl mx-auto relative z-10">
      <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-8">Wacht niet. Nog <span className="text-orange-500">{availableUnits}</span> van de {totalUnits} units beschikbaar.</h2>
      <button data-purchase-modal="true" className="bg-orange-500 hover:bg-orange-400 text-black px-10 py-5 rounded-xl font-bold text-xl uppercase tracking-wider shadow-[0_0_30px_rgba(249,115,22,0.4)] transition-all mb-8">
        Koop nu — Gratis en vrijblijvend
      </button>
      <div className="flex flex-wrap justify-center gap-6 text-gray-400 font-medium">
        <a href="tel:+31297548633" className="flex items-center gap-2 hover:text-white transition-colors"><Phone className="w-5 h-5" /> <span>0297 548 633</span></a>
        <a href="mailto:hallo@extraopslag.nl?subject=Vraag%20over%20ExtraOpslag.nl%20%E2%80%94%2014m%C2%B2%20Opslagbox&body=Geachte%20ExtraOpslag%20team%2C%0A%0AIk%20heb%20een%20vraag%20over%20de%2014m%C2%B2%20opslagbox.%0A%0A" className="flex items-center gap-2 hover:text-white transition-colors"><Mail className="w-5 h-5" /> <span>hallo@extraopslag.nl</span></a>
      </div>
    </div>
  </section>;
const Footer = () => <footer className="bg-[#0F1117] text-gray-400 py-8 px-6 border-t border-gray-800">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
      <div>
        <div className="text-2xl font-bold text-white tracking-tight">ExtraOpslag<span className="text-orange-500">.nl</span></div>
        <p className="mt-2 text-sm">© 2025 ExtraOpslag.nl. Alle rechten voorbehouden.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-4 text-sm">
        <a href="tel:+31297548633" className="hover:text-white transition-colors">0297 548 633</a>
        <a href="mailto:hallo@extraopslag.nl?subject=Vraag%20over%20ExtraOpslag.nl%20%E2%80%94%2014m%C2%B2%20Opslagbox&body=Geachte%20ExtraOpslag%20team%2C%0A%0AIk%20heb%20een%20vraag%20over%20de%2014m%C2%B2%20opslagbox.%0A%0A" className="hover:text-white transition-colors">hallo@extraopslag.nl</a>
        <a href={`${import.meta.env.BASE_URL}privacybeleid.html`} className="hover:text-white transition-colors">Privacybeleid</a>
        <a href={`${import.meta.env.BASE_URL}algemene-voorwaarden.html`} className="hover:text-white transition-colors">Algemene voorwaarden</a>
      </div>
    </div>
  </footer>;
interface StickyBottomBarProps {
  availableUnits: number;
  onBuy: () => void;
}
const StickyBottomBar = ({
  availableUnits,
  onBuy
}: StickyBottomBarProps) => {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const hero = document.getElementById('hero');
    if (!hero) {
      return undefined;
    }
    const observer = new IntersectionObserver(entries => {
      const [entry] = entries;
      setIsVisible(!entry.isIntersecting);
    }, {
      threshold: 0
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);
  return <div className={`fixed bottom-0 left-0 right-0 z-50 bg-[#111827]/95 backdrop-blur-sm border-t border-white/10 py-3 px-4 transition-transform duration-500 ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="text-white"><p className="text-xs text-gray-400">Vanaf 34.000</p><p className="text-sm font-bold text-orange-400">Nog {availableUnits} beschikbaar</p><a href="tel:+31297548633" className="mt-0.5 hidden sm:inline-flex text-xs text-gray-300 hover:text-white transition-colors">0297 548 633</a></div>
        <button type="button" onClick={onBuy} className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-xl font-bold transition-colors">Koop nu</button>
      </div>
    </div>;
};
interface InlineBrochureViewerProps {
  isOpen: boolean;
  brochureStep: 'form' | 'success';
  onClose: () => void;
}
interface InlineBrochureParticle {
  id: string;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
}
const INLINE_LEGAL_DISCLAIMER = 'Disclaimer: Alle investeringsrendementen, huurinkomsten en financiële prognoses zijn schattingen op basis van marktdata en zijn niet gegarandeerd. Rendementen uit het verleden bieden geen garantie voor de toekomst. Raadpleeg een onafhankelijk financieel adviseur voordat u een investeringsbeslissing neemt. De vermelde rendementscijfers zijn indicatief en kunnen afwijken op basis van marktontwikkelingen, bezettingsgraad en individuele omstandigheden.';
const INLINE_SHORT_DISCLAIMER = '* Indicatieve cijfers. Geen garantie op rendement. Raadpleeg een financieel adviseur.';
const INLINE_BROCHURE_SPECS = [{
  id: 'vloeroppervlakte',
  label: 'Vloeroppervlakte',
  value: '14m²'
}, {
  id: 'breedte',
  label: 'Breedte',
  value: '4m'
}, {
  id: 'diepte',
  label: 'Diepte',
  value: '3.5m'
}, {
  id: 'hoogte',
  label: 'Hoogte',
  value: '3.4m'
}, {
  id: 'deurhoogte',
  label: 'Deurhoogte',
  value: '2.25m'
}, {
  id: 'inhoud',
  label: 'Inhoud',
  value: '47.6m³'
}, {
  id: 'elektriciteit',
  label: 'Elektriciteit',
  value: '16A eigen meter'
}, {
  id: 'toegangsdeur',
  label: 'Toegangsdeur',
  value: 'Rolluikdeur'
}, {
  id: 'vloerbelasting',
  label: 'Vloerbelasting',
  value: '500kg/m² optie'
}, {
  id: 'oplevering',
  label: 'Oplevering',
  value: 'December 2026'
}];
const INLINE_BROCHURE_FEATURES = [{
  id: 'camera',
  label: 'Camera beveiliging'
}, {
  id: 'toegang',
  label: '24/7 toegang'
}, {
  id: 'elektriciteit',
  label: 'Elektriciteit'
}, {
  id: 'vve',
  label: 'VvE'
}, {
  id: 'beveiligd',
  label: 'Beveiligde toegang'
}];
const INLINE_INCLUDED_ITEMS = [{
  id: 'meter',
  label: 'Eigen meter elektriciteit'
}, {
  id: 'vve',
  label: 'VvE-lidmaatschap'
}, {
  id: 'camera-alarm',
  label: 'Camera en alarmbeveiliging'
}, {
  id: 'verzekering',
  label: 'Verzekering via VvE'
}, {
  id: 'rolluik',
  label: 'Rolluikdeur met motor'
}];
const INLINE_ROI_ROWS = [{
  id: 'aankoopprijs',
  label: 'Aankoopprijs',
  value: '€34.000'
}, {
  id: 'huurinkomsten',
  label: 'Huurinkomsten',
  value: '€350–€450/mnd'
}, {
  id: 'rendement',
  label: 'Bruto rendement',
  value: '6–8%'
}, {
  id: 'terugverdientijd',
  label: 'Terugverdientijd',
  value: '5–10 jaar'
}, {
  id: 'doorverkoopwaarde',
  label: 'Doorverkoopwaarde',
  value: '+10–20%'
}];
const INLINE_COMPARISON_BARS = [{
  id: 'extraopslag',
  label: 'ExtraOpslag',
  value: '6-8%',
  width: '42%',
  featured: true
}, {
  id: 'spaarrekening',
  label: 'Spaarrekening',
  value: '1.5%',
  width: '8%',
  featured: false
}, {
  id: 'obligaties',
  label: 'Obligaties',
  value: '3.5%',
  width: '18%',
  featured: false
}, {
  id: 'vastgoedfonds',
  label: 'Vastgoedfonds',
  value: '6%',
  width: '32%',
  featured: false
}];
const INLINE_PROCESS_STEPS = [{
  id: 'aanmelden',
  timing: 'Dag 1',
  title: 'Aanmelden'
}, {
  id: 'verkoopgesprek',
  timing: 'Dag 2-3',
  title: 'Verkoopgesprek'
}, {
  id: 'optie',
  timing: 'Dag 4',
  title: 'Optie nemen'
}, {
  id: 'documenten',
  timing: 'Dag 5',
  title: 'Documenten insturen'
}, {
  id: 'handtekening',
  timing: 'Dag 6-7',
  title: 'Digitale handtekening via beveiligd platform'
}];
const INLINE_LEGAL_HIGHLIGHTS = [{
  id: 'koopvorm',
  label: 'Koopvorm',
  value: 'Appartementsrecht'
}, {
  id: 'vve',
  label: 'VvE verplicht',
  value: 'Actief'
}, {
  id: 'notaris',
  label: 'Notaris',
  value: 'Aangewezen kantoor'
}, {
  id: 'oplevering',
  label: 'Oplevering',
  value: 'December 2026'
}];
const InlineParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }
    let width = 0;
    let height = 0;
    let animationFrame = 0;
    const particles: InlineBrochureParticle[] = Array.from({
      length: 15
    }, (_, particleIndex) => ({
      id: `inline-particle-${particleIndex}`,
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      radius: 1.4 + Math.random() * 0.7,
      vx: (Math.random() - 0.5) * 0.32,
      vy: (Math.random() - 0.5) * 0.32
    }));
    const resizeCanvas = () => {
      const ratio = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = 'rgba(249,115,22,0.12)';
      for (let x = 0; x <= width; x += 40) {
        for (let y = 0; y <= height; y += 40) {
          context.beginPath();
          context.arc(x, y, 1, 0, Math.PI * 2);
          context.fill();
        }
      }
      const pulse = 0.025 + Math.sin(time / 900) * 0.025;
      context.strokeStyle = `rgba(249,115,22,${pulse})`;
      context.lineWidth = 1;
      for (let x = 0; x <= width; x += 80) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 0; y <= height; y += 80) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
      particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x <= 0 || particle.x >= width) {
          particle.vx *= -1;
        }
        if (particle.y <= 0 || particle.y >= height) {
          particle.vy *= -1;
        }
        context.fillStyle = 'rgba(249,115,22,0.3)';
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      });
      for (let firstIndex = 0; firstIndex < particles.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < particles.length; secondIndex += 1) {
          const first = particles[firstIndex];
          const second = particles[secondIndex];
          const distance = Math.hypot(first.x - second.x, first.y - second.y);
          if (distance < 120) {
            context.strokeStyle = `rgba(249,115,22,${(1 - distance / 120) * 0.16})`;
            context.beginPath();
            context.moveTo(first.x, first.y);
            context.lineTo(second.x, second.y);
            context.stroke();
          }
        }
      }
      animationFrame = window.requestAnimationFrame(draw);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    animationFrame = window.requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true" />;
};
const InlineSpecsDiagram = () => <svg viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[480px]" role="img" aria-label="Isometrische technische tekening van de opslagbox met maatvoering">
    <rect width="500" height="320" fill="#F8FAFC" rx="16" />
    <line x1="140" y1="220" x2="300" y2="220" stroke="#111827" strokeWidth="1.8" />
    <line x1="300" y1="220" x2="370" y2="185" stroke="#111827" strokeWidth="1.8" />
    <line x1="370" y1="185" x2="210" y2="185" stroke="#111827" strokeWidth="1.8" />
    <line x1="210" y1="185" x2="140" y2="220" stroke="#111827" strokeWidth="1.8" />
    <line x1="140" y1="220" x2="140" y2="84" stroke="#111827" strokeWidth="1.8" />
    <line x1="300" y1="220" x2="300" y2="84" stroke="#111827" strokeWidth="1.8" />
    <line x1="370" y1="185" x2="370" y2="49" stroke="#111827" strokeWidth="1.8" />
    <line x1="210" y1="185" x2="210" y2="49" stroke="#111827" strokeWidth="1.8" />
    <line x1="140" y1="84" x2="300" y2="84" stroke="#111827" strokeWidth="1.8" />
    <line x1="300" y1="84" x2="370" y2="49" stroke="#111827" strokeWidth="1.8" />
    <line x1="370" y1="49" x2="210" y2="49" stroke="#111827" strokeWidth="1.8" />
    <line x1="210" y1="49" x2="140" y2="84" stroke="#111827" strokeWidth="1.8" />
    <polygon points="140,84 300,84 300,220 140,220" fill="#111827" fillOpacity="0.04" />
    <polygon points="140,84 210,49 210,185 140,220" fill="#111827" fillOpacity="0.06" />
    <rect x="158" y="130" width="126" height="90" fill="#E5E7EB" />
    <rect x="158" y="130" width="126" height="90" fill="none" stroke="#111827" strokeWidth="1.5" />
    <text x="221" y="178" textAnchor="middle" fill="#111827" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="700">2,25m deur</text>
    <line x1="108" y1="84" x2="108" y2="220" stroke="#F97316" strokeWidth="1.8" />
    <line x1="120" y1="84" x2="108" y2="84" stroke="#F97316" strokeWidth="1.8" />
    <line x1="120" y1="220" x2="108" y2="220" stroke="#F97316" strokeWidth="1.8" />
    <polygon points="108,84 104,96 112,96" fill="#F97316" />
    <polygon points="108,220 104,208 112,208" fill="#F97316" />
    <text x="82" y="158" textAnchor="middle" fill="#F97316" fontSize="13" fontFamily="Inter, sans-serif" fontWeight="800">3,4m</text>
    <line x1="300" y1="240" x2="370" y2="205" stroke="#F97316" strokeWidth="1.8" strokeDasharray="5,3" />
    <text x="370" y="221" fill="#F97316" fontSize="13" fontFamily="Inter, sans-serif" fontWeight="800">3,5m</text>
    <line x1="140" y1="68" x2="300" y2="68" stroke="#F97316" strokeWidth="1.8" strokeDasharray="5,3" />
    <text x="220" y="61" textAnchor="middle" fill="#F97316" fontSize="13" fontFamily="Inter, sans-serif" fontWeight="800">4m</text>
  </svg>;
const InlineBrochureViewer = ({
  isOpen,
  brochureStep,
  onClose
}: InlineBrochureViewerProps) => {
  if (!isOpen || brochureStep !== 'success') {
    return null;
  }
  return <section className="fixed inset-0 z-[120] bg-[#0a0a0f] overflow-y-auto" aria-label="Digitale verkoopbrochure ExtraOpslag.nl">
      <div className="no-print sticky top-0 z-10 bg-[#111827]/95 backdrop-blur-sm border-b border-white/10 py-3 px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-3 w-3 rounded-full bg-orange-500 shadow-[0_0_18px_rgba(249,115,22,0.75)] shrink-0" aria-hidden="true"></span>
          <p className="truncate text-white font-bold"><span>ExtraOpslag.nl — Verkoopbrochure 2025</span></p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => window.print()} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-600"><span>Afdrukken / PDF</span></button>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10"><span>Sluiten ×</span></button>
        </div>
      </div>
      <div className="mx-auto flex max-w-[794px] flex-col gap-8 px-4 py-12">
        <article className="brochure-page relative min-h-[1123px] w-[794px] max-w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0F1117] p-12 shadow-2xl" style={{
        pageBreakAfter: 'always'
      }}>
          <InlineParticleBackground />
          <div className="absolute left-0 top-0 h-0.5 w-full bg-orange-500" aria-hidden="true"></div>
          <div className="relative z-[1] flex min-h-[1027px] flex-col">
            <header className="flex items-center justify-between gap-4">
              <h1 className="text-4xl font-black text-white tracking-tight">ExtraOpslag<span className="text-orange-500">.nl</span></h1>
              <p className="rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-white"><span>Verkoopbrochure 2025</span></p>
            </header>
            <div className="mt-8">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-400"><span>EIGEN OPSLAGRUIMTE · VASTGOED</span></p>
              <h2 className="mt-4 text-5xl font-black leading-tight text-white">De 14m² ExtraOpslag Box</h2>
              <p className="mt-4 text-xl text-gray-300"><span>Uw eigen premium opslagruimte — volledig eigendom</span></p>
            </div>
            <div className="mt-12 flex h-[280px] items-center justify-center rounded-2xl border border-white/10 bg-[#1F2937]">
              <p className="max-w-sm text-center text-sm font-medium text-gray-500"><span>Interactieve 3D box beschikbaar op extraopslag.nl</span></p>
            </div>
            <div className="mt-auto rounded-2xl bg-orange-500 p-5 text-center text-lg font-black text-white">
              <span>14m² | 47.6m³ | 3.4m hoog | Eigen eigendom | Oplevering December 2026</span>
            </div>
            <footer className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-gray-400">
              <span>ExtraOpslag.nl</span>
              <a href="mailto:hallo@extraopslag.nl?subject=Vraag%20over%20ExtraOpslag.nl%20%E2%80%94%2014m%C2%B2%20Opslagbox&body=Geachte%20ExtraOpslag%20team%2C%0A%0AIk%20heb%20een%20vraag%20over%20de%2014m%C2%B2%20opslagbox.%0A%0A" className="hover:text-orange-400">hallo@extraopslag.nl</a>
              <a href="tel:+31297548633" className="hover:text-orange-400">0297 548 633</a>
              <small className="basis-full text-center text-xs italic text-gray-600">* Indicatieve rendementen. Geen beleggingsadvies. Zie pagina 4.</small>
            </footer>
          </div>
          <span className="absolute bottom-5 right-8 text-xs font-semibold text-gray-600">Pagina 1 van 5</span>
        </article>
        <article className="brochure-page relative min-h-[1123px] w-[794px] max-w-full rounded-2xl border border-white/10 bg-white p-12 text-gray-900 shadow-2xl" style={{
        pageBreakAfter: 'always'
      }}>
          <div className="absolute left-0 top-0 h-0.5 w-full bg-orange-500" aria-hidden="true"></div>
          <header>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-500"><span>TECHNISCHE SPECIFICATIES</span></p>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-gray-950">Afmetingen &amp; Faciliteiten</h2>
          </header>
          <div className="mt-8 flex justify-center">
            <InlineSpecsDiagram />
          </div>
          <table className="mt-8 w-full border-collapse overflow-hidden rounded-2xl text-sm">
            <tbody>
              {INLINE_BROCHURE_SPECS.map(spec => <tr key={spec.id} className="odd:bg-gray-50 even:bg-white">
                  <th className="border-l-4 border-orange-500 px-5 py-3 text-left font-black text-gray-900">{spec.label}</th>
                  <td className="px-5 py-3 font-semibold text-gray-700">{spec.value}</td>
                </tr>)}
            </tbody>
          </table>
          <div className="mt-8 grid grid-cols-5 gap-3">
            {INLINE_BROCHURE_FEATURES.map(feature => <div key={feature.id} className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs font-black text-gray-800">
                <span>{feature.label}</span>
              </div>)}
          </div>
          <div className="mt-8 rounded-2xl bg-orange-500 p-5 text-center text-lg font-black text-white">
            <span>Ideaal als investering — terugverdientijd slechts 5-10 jaar</span>
          </div>
          <p className="mt-5 text-xs italic text-gray-400"><span>{INLINE_SHORT_DISCLAIMER}</span></p>
          <span className="absolute bottom-5 right-8 text-xs font-semibold text-gray-400">Pagina 2 van 5</span>
        </article>
        <article className="brochure-page relative min-h-[1123px] w-[794px] max-w-full rounded-2xl border border-white/10 bg-[#0F1117] p-12 text-white shadow-2xl" style={{
        pageBreakAfter: 'always'
      }}>
          <div className="absolute left-0 top-0 h-0.5 w-full bg-orange-500" aria-hidden="true"></div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-400"><span>PRIJSINFORMATIE &amp; INVESTERINGSRENDEMENT</span></p>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-white">Prijsinformatie &amp; Investeringsrendement</h2>
          <section className="mt-8 rounded-2xl border border-orange-500/40 bg-[#1F2937] p-8" aria-labelledby="inline-price-title">
            <h3 id="inline-price-title" className="text-5xl font-black text-orange-400">Vanaf €34.000,- k.k.</h3>
            <p className="mt-3 text-lg font-semibold text-gray-200"><span>ex. 21% BTW die terug te vorderen is voor BTW-ondernemers</span></p>
          </section>
          <section className="mt-8 grid grid-cols-2 gap-8" aria-label="Prijsdetails en rendement">
            <div>
              <h3 className="text-xl font-black text-white">Inbegrepen</h3>
              <ul className="mt-4 space-y-3">
                {INLINE_INCLUDED_ITEMS.map(item => <li key={item.id} className="flex items-center gap-3 text-gray-200">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white"><Check className="h-4 w-4" /></span>
                    <span>{item.label}</span>
                  </li>)}
              </ul>
            </div>
            <div className="rounded-2xl bg-[#1F2937] p-5">
              <h3 className="text-xl font-black text-white">ROI overzicht</h3>
              <table className="mt-4 w-full text-sm">
                <tbody>
                  {INLINE_ROI_ROWS.map(row => <tr key={row.id} className="border-b border-white/10 last:border-0">
                      <th className="py-3 text-left font-semibold text-gray-400">{row.label}</th>
                      <td className="py-3 text-right font-black text-white">{row.value}</td>
                    </tr>)}
                </tbody>
              </table>
            </div>
          </section>
          <section className="mt-8 rounded-2xl bg-[#1F2937] p-6" aria-label="Rendementsvergelijking">
            <h3 className="text-xl font-black text-white">Vergelijking bruto rendement</h3>
            <div className="mt-5 space-y-5">
              {INLINE_COMPARISON_BARS.map(bar => <div key={bar.id} className="relative grid grid-cols-[130px_1fr_56px] items-center gap-3 text-sm">
                  <span className="font-bold text-gray-300">{bar.label}</span>
                  <span className="h-4 overflow-hidden rounded-full bg-white/10">
                    <span className={`${bar.featured ? 'bg-orange-500' : 'bg-gray-500'} block h-full rounded-full`} style={{
                  width: bar.width
                }}></span>
                  </span>
                  <strong className="text-right text-white">{bar.value}</strong>
                  {bar.featured ? <span className="absolute -top-5 left-[135px] inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-1 text-[10px] font-black text-white"><Star className="h-3 w-3" fill="currentColor" /><span>Beste keuze</span></span> : null}
                </div>)}
            </div>
          </section>
          <div className="mt-8 rounded-2xl bg-orange-500 p-5 text-sm font-bold text-white">
            <span>BTW bij zakelijke verhuur in veel gevallen terug te vorderen. Laat uw situatie altijd toetsen door uw adviseur.</span>
          </div>
          <p className="mt-5 text-xs italic text-gray-500"><span>{INLINE_SHORT_DISCLAIMER}</span></p>
          <span className="absolute bottom-5 right-8 text-xs font-semibold text-gray-600">Pagina 3 van 5</span>
        </article>
        <article className="brochure-page relative min-h-[1123px] w-[794px] max-w-full rounded-2xl border border-white/10 bg-white p-12 text-gray-900 shadow-2xl" style={{
        pageBreakAfter: 'always'
      }}>
          <div className="absolute left-0 top-0 h-0.5 w-full bg-orange-500" aria-hidden="true"></div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-500"><span>AANKOOPPROCES &amp; JURIDISCH</span></p>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-gray-950">Aankoopproces &amp; Juridisch</h2>
          <div className="mt-10 grid grid-cols-[1fr_0.85fr] gap-10">
            <ol className="relative border-l-2 border-orange-500/35 pl-8">
              {INLINE_PROCESS_STEPS.map(step => <li key={step.id} className="relative pb-9 last:pb-0">
                  <span className="absolute -left-[43px] flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-xs font-black text-white">•</span>
                  <p className="text-xs font-black uppercase tracking-widest text-orange-500"><span>{step.timing}</span></p>
                  <h3 className="mt-1 text-xl font-black text-gray-950">{step.title}</h3>
                </li>)}
            </ol>
            <section className="rounded-2xl bg-gray-50 p-6" aria-labelledby="legal-highlights-title">
              <h3 id="legal-highlights-title" className="text-xl font-black text-gray-950">Juridische highlights</h3>
              <dl className="mt-4 space-y-4">
                {INLINE_LEGAL_HIGHLIGHTS.map(item => <div key={item.id} className="border-b border-gray-200 pb-3 last:border-0">
                    <dt className="text-xs font-black uppercase tracking-widest text-gray-500">{item.label}</dt>
                    <dd className="mt-1 font-bold text-gray-950">{item.value}</dd>
                  </div>)}
              </dl>
            </section>
          </div>
          <section className="mt-10 rounded-2xl border-l-4 border-orange-500 bg-orange-50 p-6" aria-labelledby="inline-legal-disclaimer-title">
            <h3 id="inline-legal-disclaimer-title" className="text-sm font-black uppercase tracking-widest text-orange-600">Juridische Disclaimer</h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-700"><span>{INLINE_LEGAL_DISCLAIMER}</span></p>
          </section>
          <span className="absolute bottom-5 right-8 text-xs font-semibold text-gray-400">Pagina 4 van 5</span>
        </article>
        <article className="brochure-page relative min-h-[1123px] w-[794px] max-w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0F1117] p-12 text-white shadow-2xl" style={{
        pageBreakAfter: 'always'
      }}>
          <InlineParticleBackground />
          <div className="absolute left-0 top-0 h-0.5 w-full bg-orange-500" aria-hidden="true"></div>
          <div className="relative z-[1] flex min-h-[1027px] flex-col">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-400"><span>EXTRA RUIMTE. EXTRA ZEKERHEID.</span></p>
            <h2 className="mt-5 max-w-xl text-4xl font-black leading-tight text-white">Interesse in uw eigen opslagbox?</h2>
            <section className="mt-10 rounded-2xl bg-orange-500 p-8 text-white" aria-labelledby="contact-cta-inline-title">
              <h3 id="contact-cta-inline-title" className="text-3xl font-black">Neem vandaag nog contact op</h3>
              <p className="mt-3 text-lg font-semibold text-orange-50"><span>Wij helpen u vrijblijvend met beschikbaarheid, koopvorm en rendement.</span></p>
            </section>
            <div className="mt-10 grid grid-cols-2 gap-5">
              <a href="tel:+31297548633" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-orange-500"><span className="block text-xs font-black uppercase tracking-widest text-gray-500">Phone</span><strong className="mt-2 block text-xl text-white">0297 548 633</strong></a>
              <a href="mailto:hallo@extraopslag.nl?subject=Vraag%20over%20ExtraOpslag.nl%20%E2%80%94%2014m%C2%B2%20Opslagbox&body=Geachte%20ExtraOpslag%20team%2C%0A%0AIk%20heb%20een%20vraag%20over%20de%2014m%C2%B2%20opslagbox.%0A%0A" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-orange-500"><span className="block text-xs font-black uppercase tracking-widest text-gray-500">Email</span><strong className="mt-2 block text-xl text-white">hallo@extraopslag.nl</strong></a>
              <a href="https://extraopslag.nl" target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-orange-500"><span className="block text-xs font-black uppercase tracking-widest text-gray-500">Web</span><strong className="mt-2 block text-xl text-white">www.extraopslag.nl</strong></a>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><span className="block text-xs font-black uppercase tracking-widest text-gray-500">Locatie</span><strong className="mt-2 block text-xl text-white">Noorddammerweg 15B, Uithoorn</strong></div>
            </div>
            <div className="mt-8 rounded-2xl border border-white/10 bg-[#1F2937] p-6">
              <h3 className="text-lg font-black text-white">Business hours</h3>
              <p className="mt-2 text-gray-300"><span>Ma-Vr 09:00-17:00</span></p>
            </div>
            <footer className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-8 text-gray-500">
              <strong className="text-3xl text-white">ExtraOpslag<span className="text-orange-500">.nl</span></strong>
            </footer>
          </div>
          <span className="absolute bottom-5 right-8 text-xs font-semibold text-gray-600">Pagina 5 van 5</span>
        </article>
      </div>
    </section>;
};
export const ExtraOpslagLanding = () => {
  const [toast, setToast] = useState<Toast>(null);
  useEffect(() => {
    toastSetter = setToast;
    return () => {
      toastSetter = null;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  const {
    soldUnits,
    availableUnits
  } = useMemo(() => {
    const weeksSinceLaunch = Math.floor((Date.now() - LAUNCH_DATE.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const calculatedSoldUnits = Math.min(INITIAL_SOLD + weeksSinceLaunch * WEEKLY_DECREASE, TOTAL_UNITS - MIN_AVAILABLE);
    return {
      soldUnits: calculatedSoldUnits,
      availableUnits: TOTAL_UNITS - calculatedSoldUnits
    };
  }, []);
  const defaultUrgencyMessage = `LIVE: Nog ${availableUnits} units beschikbaar`;
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [modalUrgencyMessage, setModalUrgencyMessage] = useState(defaultUrgencyMessage);
  const [brochureModalOpen, setBrochureModalOpen] = useState(false);
  const [brochureViewerOpen, setBrochureViewerOpen] = useState(false);
  const [brochureStep, setBrochureStep] = useState<'form' | 'success'>('form');
  const [brochureSubmitting, setBrochureSubmitting] = useState(false);
  const [brochureError, setBrochureError] = useState('');
  const [brochureConsent, setBrochureConsent] = useState(false);
  const [brochureHoneypot, setBrochureHoneypot] = useState('');
  const [brochureForm, setBrochureForm] = useState<BrochureFormData>({
    naam: '',
    email: '',
    telefoon: '',
    type: ''
  });
  const markModalShown = () => window.sessionStorage.setItem('modal_shown', 'true');
  const openPurchaseModal = (urgencyMessage = defaultUrgencyMessage) => {
    setModalUrgencyMessage(urgencyMessage);
    markModalShown();
    setIsPurchaseModalOpen(true);
  };
  useEffect(() => {
    const storageKey = 'modal_shown';
    if (window.sessionStorage.getItem(storageKey)) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      openPurchaseModal();
    }, 8000);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const handleExitIntent = (event: MouseEvent) => {
      if (event.clientY > 8 || window.sessionStorage.getItem('modal_shown') || isPurchaseModalOpen) {
        return;
      }
      openPurchaseModal(`Wacht! Mis uw unit niet, nog ${availableUnits} units beschikbaar`);
    };
    document.documentElement.addEventListener('mouseleave', handleExitIntent);
    return () => document.documentElement.removeEventListener('mouseleave', handleExitIntent);
  }, [isPurchaseModalOpen, availableUnits]);
  const handlePageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const button = target.closest('button');
    if (!button) {
      return;
    }
    const buttonText = button.textContent?.toLowerCase() ?? '';
    if (button.dataset.purchaseModal === 'true' || buttonText.includes('koop')) {
      openPurchaseModal();
    }
  };
  const handleBrochureSubmit = async () => {
    if (!brochureForm.naam.trim()) {
      setBrochureError('Vul uw naam in.');
      return;
    }
    if (!isValidEmail(brochureForm.email)) {
      setBrochureError('Vul een geldig e-mailadres in.');
      return;
    }
    if (brochureForm.telefoon.trim() && !isValidPhone(brochureForm.telefoon)) {
      setBrochureError('Vul een geldig telefoonnummer in of laat dit veld leeg.');
      return;
    }
    if (!brochureConsent) {
      setBrochureError('Ga akkoord met de privacyverklaring om door te gaan.');
      return;
    }
    setBrochureError('');
    setBrochureSubmitting(true);
    const emailData: Record<string, string> = {
      'Naam': brochureForm.naam || '',
      'E-mail': brochureForm.email || '',
      'Telefoon': brochureForm.telefoon || 'Niet opgegeven',
      'Type': brochureForm.type || 'Niet opgegeven',
      'Brochure': 'ExtraOpslag.nl 14m² Verkoopbrochure',
      'Pagina': currentPageUrl(),
      'Tijdstip': new Date().toLocaleString('nl-NL')
    };
    const sent = await sendLeadEmail('Brochure Download Aanvraag', emailData, brochureHoneypot);
    setBrochureSubmitting(false);
    if (sent) {
      setBrochureStep('success');
    } else {
      setBrochureError('Versturen mislukt. Probeer het opnieuw of bel ons op 0297 548 633.');
    }
  };
  return <div className="min-h-screen font-sans selection:bg-orange-500/30 pb-20" onClick={handlePageClick}>
      <Navbar />
      <main>
        <Hero availableUnits={availableUnits} onDownloadBrochure={() => setBrochureModalOpen(true)} />
        <TrustBar />
        <FacilityCarouselSection />
        <Specs />
        <ScarcityStrip availableUnits={availableUnits} />
        <CounterBar />
        <Pricing totalUnits={TOTAL_UNITS} soldUnits={soldUnits} availableUnits={availableUnits} onDownloadBrochure={() => setBrochureModalOpen(true)} />
        <YieldCalculator onDownloadBrochure={() => setBrochureModalOpen(true)} />
        <Testimonials />
        <GuaranteeBadges />
        <HowItWorks />
        <LocationSection />
        <ComparisonTable />
        <FAQ />
        <FinalCTA totalUnits={TOTAL_UNITS} availableUnits={availableUnits} />
      </main>
      <Footer />
      <StickyBottomBar availableUnits={availableUnits} onBuy={() => openPurchaseModal()} />
      <PurchaseModal isOpen={isPurchaseModalOpen} urgencyMessage={modalUrgencyMessage} onClose={() => setIsPurchaseModalOpen(false)} />
      <InlineBrochureViewer isOpen={brochureViewerOpen} brochureStep={brochureStep} onClose={() => setBrochureViewerOpen(false)} />
      {brochureModalOpen && <div onClick={() => {
      setBrochureModalOpen(false);
      setBrochureStep('form');
    }} style={{
      position: 'fixed',
      inset: 0,
      zIndex: 110,
      background: 'rgba(0,0,0,0.82)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }} role="dialog" aria-modal="true" aria-labelledby="brochure-modal-title">
          <div onClick={event => event.stopPropagation()} style={{
        background: '#111827',
        borderRadius: '24px',
        border: '1px solid rgba(249,115,22,0.25)',
        width: '100%',
        maxWidth: '480px',
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        animation: 'modalIn 0.2s ease-out'
      }}>
            <div style={{
          background: 'linear-gradient(135deg,#1F2937,#111827)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
              <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
                <div style={{
              background: 'rgba(249,115,22,0.15)',
              border: '1px solid rgba(249,115,22,0.3)',
              borderRadius: '10px',
              padding: '8px'
            }}>
                  <Download aria-hidden="true" style={{
                width: '18px',
                height: '18px',
                color: '#F97316'
              }} />
                </div>
                <div>
                  <div id="brochure-modal-title" style={{
                color: 'white',
                fontWeight: 800,
                fontSize: '16px'
              }}>Download Brochure</div>
                  <div style={{
                color: '#9CA3AF',
                fontSize: '12px'
              }}>ExtraOpslag.nl — 14m² Verkoopbrochure</div>
                </div>
              </div>
              <button type="button" onClick={() => {
            setBrochureModalOpen(false);
            setBrochureStep('form');
          }} style={{
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: 'white',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }} aria-label="Sluit brochurevenster">×</button>
            </div>
            {brochureStep === 'form' && <div style={{
          padding: '28px 24px'
        }}>
                <p style={{
            color: '#D1D5DB',
            fontSize: '14px',
            marginBottom: '20px',
            lineHeight: '1.6'
          }}>Ontvang de volledige verkoopbrochure met specificaties, prijsinformatie en rendementsberekening direct in uw inbox.</p>
                <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
                  <div>
                    <label style={{
                display: 'block',
                color: '#9CA3AF',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}><span>Naam *</span></label>
                    <input type="text" maxLength={FIELD_LIMITS.name} autoComplete="name" placeholder="Uw volledige naam" value={brochureForm.naam} onChange={event => setBrochureForm(current => ({
                ...current,
                naam: event.target.value
              }))} style={{
                width: '100%',
                background: '#0F1117',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px',
                padding: '12px 16px',
                color: 'white',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }} onFocus={event => event.target.style.borderColor = '#F97316'} onBlur={event => event.target.style.borderColor = 'rgba(255,255,255,0.12)'} />
                  </div>
                  <div>
                    <label style={{
                display: 'block',
                color: '#9CA3AF',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}><span>E-mailadres *</span></label>
                    <input type="email" maxLength={FIELD_LIMITS.email} autoComplete="email" placeholder="uw@email.nl" value={brochureForm.email} onChange={event => setBrochureForm(current => ({
                ...current,
                email: event.target.value
              }))} style={{
                width: '100%',
                background: '#0F1117',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px',
                padding: '12px 16px',
                color: 'white',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }} onFocus={event => event.target.style.borderColor = '#F97316'} onBlur={event => event.target.style.borderColor = 'rgba(255,255,255,0.12)'} />
                  </div>
                  <div>
                    <label style={{
                display: 'block',
                color: '#9CA3AF',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}><span>Telefoonnummer</span></label>
                    <input type="tel" maxLength={FIELD_LIMITS.phone} autoComplete="tel" placeholder="06-12345678" value={brochureForm.telefoon} onChange={event => setBrochureForm(current => ({
                ...current,
                telefoon: event.target.value
              }))} style={{
                width: '100%',
                background: '#0F1117',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px',
                padding: '12px 16px',
                color: 'white',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }} onFocus={event => event.target.style.borderColor = '#F97316'} onBlur={event => event.target.style.borderColor = 'rgba(255,255,255,0.12)'} />
                  </div>
                  <div>
                    <label style={{
                display: 'block',
                color: '#9CA3AF',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}><span>Ik ben</span></label>
                    <select value={brochureForm.type} onChange={event => setBrochureForm(current => ({
                ...current,
                type: event.target.value
              }))} style={{
                width: '100%',
                background: '#0F1117',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px',
                padding: '12px 16px',
                color: brochureForm.type ? 'white' : '#6B7280',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}>
                      <option value="">Selecteer uw situatie</option>
                      <option value="particulier">Particulier</option>
                      <option value="ondernemer">Ondernemer / ZZP</option>
                      <option value="belegger">Belegger</option>
                    </select>
                  </div>
                </div>
                <div aria-hidden="true" style={{
            position: 'absolute',
            left: '-10000px',
            width: 1,
            height: 1,
            overflow: 'hidden'
          }}><label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" value={brochureHoneypot} onChange={event => setBrochureHoneypot(event.target.value)} /></label></div>
                <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            marginTop: '16px',
            color: '#D1D5DB',
            fontSize: '12px',
            lineHeight: 1.5
          }}><input type="checkbox" checked={brochureConsent} onChange={event => setBrochureConsent(event.target.checked)} style={{
              marginTop: '2px',
              accentColor: '#F97316'
            }} /><span>Ik ga akkoord met de <a href={`${import.meta.env.BASE_URL}privacybeleid.html`} target="_blank" rel="noopener noreferrer" style={{
                textDecoration: 'underline'
              }}>privacyverklaring</a>.</span></label>
                {brochureError && <p role="alert" style={{
            color: '#F87171',
            fontSize: '12px',
            marginTop: '10px'
          }}>{brochureError}</p>}
                <button type="button" disabled={brochureSubmitting} onClick={handleBrochureSubmit} style={{
            width: '100%',
            marginTop: '20px',
            background: brochureSubmitting ? '#C75B0A' : '#F97316',
            color: 'white',
            fontWeight: 800,
            fontSize: '15px',
            padding: '14px',
            borderRadius: '14px',
            border: 'none',
            cursor: brochureSubmitting ? 'not-allowed' : 'pointer',
            opacity: brochureSubmitting ? 0.82 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background 0.2s'
          }} onMouseOver={event => {
            if (!brochureSubmitting) event.currentTarget.style.background = '#EA6C0A';
          }} onMouseOut={event => {
            if (!brochureSubmitting) event.currentTarget.style.background = '#F97316';
          }}>
                  {brochureSubmitting ? <Spinner /> : <Download aria-hidden="true" style={{
              width: '16px',
              height: '16px'
            }} />}
                  <span>{brochureSubmitting ? 'Versturen...' : 'Stuur mij de brochure'}</span>
                </button>
                <p style={{
            color: '#6B7280',
            fontSize: '11px',
            textAlign: 'center',
            marginTop: '10px'
          }}>🔒 Wij gebruiken uw gegevens alleen om contact met u op te nemen en u de brochure te sturen.</p>
              </div>}
            {brochureStep === 'success' && <div style={{
          padding: '36px 24px',
          textAlign: 'center'
        }}>
                <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'rgba(34,197,94,0.15)',
            border: '2px solid #22C55E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            animation: 'scaleIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275)'
          }}>
                  <Check aria-hidden="true" style={{
              width: '32px',
              height: '32px',
              color: '#22C55E'
            }} />
                </div>
                <h3 style={{
            color: 'white',
            fontWeight: 900,
            fontSize: '22px',
            marginBottom: '10px'
          }}>Bedankt, aanvraag ontvangen!</h3>
                <p style={{
            color: '#9CA3AF',
            fontSize: '14px',
            lineHeight: '1.6',
            marginBottom: '24px'
          }}>Bedankt {brochureForm.naam.split(' ')[0]}! U kunt de ExtraOpslag.nl verkoopbrochure direct hieronder digitaal bekijken. Ons team neemt zo nodig contact met u op via <strong style={{
              color: '#F97316'
            }}>{brochureForm.email}</strong>.</p>
                <div style={{
            background: '#1F2937',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '24px',
            textAlign: 'left'
          }}>
                  {BROCHURE_CHECKLIST.map(item => <div key={item.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 0',
              borderBottom: item.id === 'juridisch' ? 'none' : '1px solid rgba(255,255,255,0.06)'
            }}>
                      <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: 'rgba(249,115,22,0.2)',
                border: '1px solid #F97316',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                        <Check aria-hidden="true" style={{
                  width: '10px',
                  height: '10px',
                  color: '#F97316'
                }} />
                      </div>
                      <span style={{
                color: '#D1D5DB',
                fontSize: '13px'
              }}>{item.label}</span>
                    </div>)}
                </div>
                <button type="button" onClick={() => {
            setBrochureViewerOpen(true);
            setBrochureModalOpen(false);
          }} style={{
            width: '100%',
            background: '#F97316',
            color: 'white',
            fontWeight: 800,
            fontSize: '14px',
            padding: '13px',
            borderRadius: '14px',
            border: 'none',
            cursor: 'pointer',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
                  <ArrowRight aria-hidden="true" style={{
              width: '15px',
              height: '15px'
            }} />
                  <span>Bekijk de digitale brochure</span>
                </button>
                <button type="button" onClick={() => {
            setBrochureModalOpen(false);
            setBrochureStep('form');
            setBrochureForm({
              naam: '',
              email: '',
              telefoon: '',
              type: ''
            });
            setBrochureConsent(false);
            setBrochureError('');
          }} style={{
            background: 'none',
            border: 'none',
            color: '#6B7280',
            fontSize: '13px',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}>Sluit venster</button>
              </div>}
          </div>
        </div>}
      {toast && <div style={{
      position: 'fixed',
      bottom: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 999,
      padding: '12px 24px',
      borderRadius: 12,
      fontWeight: 700,
      fontSize: 14,
      background: toast.type === 'success' ? '#22C55E' : '#EF4444',
      color: 'white',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      animation: 'modalIn 0.3s ease-out',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>}
    </div>;
};