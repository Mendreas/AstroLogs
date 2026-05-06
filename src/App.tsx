import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Plus, Star, Download, Upload, Save, X, Eye, Sun, Edit, Search, BarChart2, BookmarkPlus, Radio, Trash2 } from 'lucide-react';
import { Body, Observer, Equator, Horizon, MoonPhase } from "astronomy-engine";
import EventList from "./components/EventList";
import { EventType } from "./components/EventCard";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// ─── Helpers ────────────────────────────────────────────────────────────────

function moonPhaseName(phase: number) {
  if (phase < 0.03 || phase > 0.97) return "New Moon";
  if (phase < 0.22) return "Waxing Crescent";
  if (phase < 0.28) return "First Quarter";
  if (phase < 0.47) return "Waxing Gibbous";
  if (phase < 0.53) return "Full Moon";
  if (phase < 0.72) return "Waning Gibbous";
  if (phase < 0.78) return "Last Quarter";
  return "Waning Crescent";
}

function seeingLabel(v: string) {
  const n = parseInt(v);
  if (!n) return '';
  const labels = ['', 'Very Poor', 'Poor', 'Fair', 'Good', 'Excellent'];
  return labels[n] || '';
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function transparencyLabel(v: string) {
  const n = parseInt(v);
  if (!n) return '';
  const labels = ['', 'Overcast', 'Mostly Cloudy', 'Partly Clear', 'Mostly Clear', 'Crystal Clear'];
  return labels[n] || '';
}

function starsDisplay(val: string, max = 5) {
  const n = parseInt(val) || 0;
  return '★'.repeat(n) + '☆'.repeat(max - n);
}

// Image compression: resize to max 900px and convert to JPEG
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 900;
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const fetchBortleClass = async (lat: number, lon: number): Promise<string> => {
  try {
    const url = `https://www.lightpollutionmap.info/QueryRaster/?ql=wa_2015&x=${lon}&y=${lat}&z=8`;
    const res = await fetch(url);
    const data = await res.json();
    const sqm = data.value;
    if (typeof sqm !== "number") return "Unknown";
    if (sqm >= 21.99) return "Class 1 — Excellent dark-sky site";
    if (sqm >= 21.89) return "Class 2 — Typical truly dark site";
    if (sqm >= 21.69) return "Class 3 — Rural sky";
    if (sqm >= 21.25) return "Class 4 — Rural/suburban transition";
    if (sqm >= 20.49) return "Class 5 — Suburban sky";
    if (sqm >= 19.50) return "Class 6 — Bright suburban sky";
    if (sqm >= 18.94) return "Class 7 — Suburban/urban transition";
    if (sqm >= 18.38) return "Class 8 — City sky";
    return "Class 9 — Inner-city sky";
  } catch {
    return "Unknown";
  }
};

const nominatimBase = 'https://nominatim.openstreetmap.org';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Observation {
  id: number;
  name: string;
  type: string;
  date: string;
  location: string;
  ra: string;
  dec: string;
  magnitude: string;
  distance: string;
  distanceUnit: string;
  description: string;
  favorite: boolean;
  image: string;
  dateAdded: string;
  equipment: string;
  eyepiece: string;
  seeing: string;
  transparency: string;
}

interface WishlistItem {
  id: number;
  name: string;
  type: string;
  priority: 'high' | 'medium' | 'low';
  notes: string;
  dateAdded: string;
}

interface CelestialObject {
  name: string;
  type: string;
  magnitude: number;
  constellation: string;
  ra: string;
  dec: string;
  season: string;
  bestTime: string;
  altitude: number;
}

interface VisibleObject extends CelestialObject {
  displayType: string;
}

interface LocationSuggestion {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
}

interface ISSData {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: string;
  footprint: number;
  timestamp: number;
}

// ─── Catalogs ────────────────────────────────────────────────────────────────

const brightStars = [
  { name: "Sirius",       ra: 6.7525,  dec: -16.7161, magnitude: -1.46 },
  { name: "Canopus",      ra: 6.3992,  dec: -52.6957, magnitude: -0.74 },
  { name: "Arcturus",     ra: 14.2610, dec:  19.1822,  magnitude: -0.05 },
  { name: "Vega",         ra: 18.6157, dec:  38.7836,  magnitude:  0.03 },
  { name: "Capella",      ra: 5.2783,  dec:  45.9980,  magnitude:  0.08 },
  { name: "Rigel",        ra: 5.2423,  dec:  -8.2017,  magnitude:  0.13 },
  { name: "Procyon",      ra: 7.6553,  dec:   5.2250,  magnitude:  0.34 },
  { name: "Betelgeuse",   ra: 5.9195,  dec:   7.4071,  magnitude:  0.42 },
  { name: "Altair",       ra: 19.8463, dec:   8.8683,  magnitude:  0.77 },
  { name: "Aldebaran",    ra: 4.5988,  dec:  16.5093,  magnitude:  0.85 },
  { name: "Antares",      ra: 16.4901, dec: -26.4320,  magnitude:  0.96 },
  { name: "Spica",        ra: 13.4199, dec: -11.1613,  magnitude:  0.98 },
  { name: "Pollux",       ra: 7.7553,  dec:  28.0262,  magnitude:  1.14 },
  { name: "Fomalhaut",    ra: 22.9608, dec: -29.6223,  magnitude:  1.16 },
  { name: "Deneb",        ra: 20.6905, dec:  45.2803,  magnitude:  1.25 },
  { name: "Regulus",      ra: 10.1395, dec:  11.9672,  magnitude:  1.35 },
  { name: "Castor",       ra: 7.5769,  dec:  31.8883,  magnitude:  1.58 },
  { name: "Bellatrix",    ra: 5.4188,  dec:   6.3497,  magnitude:  1.64 },
  { name: "Elnath",       ra: 5.4382,  dec:  28.6075,  magnitude:  1.65 },
  { name: "Alnilam",      ra: 5.6035,  dec:  -1.2019,  magnitude:  1.69 },
  { name: "Alnitak",      ra: 5.6793,  dec:  -1.9425,  magnitude:  1.74 },
  { name: "Mintaka",      ra: 5.5332,  dec:  -0.2991,  magnitude:  2.23 },
  { name: "Dubhe",        ra: 11.0621, dec:  61.7511,  magnitude:  1.79 },
  { name: "Mirfak",       ra: 3.4054,  dec:  49.8612,  magnitude:  1.79 },
  { name: "Adhara",       ra: 6.9771,  dec: -28.9722,  magnitude:  1.50 },
  { name: "Hamal",        ra: 2.1196,  dec:  23.4624,  magnitude:  2.00 },
  { name: "Mizar",        ra: 13.3988, dec:  54.9254,  magnitude:  2.23 },
  { name: "Alkaid",       ra: 13.7923, dec:  49.3133,  magnitude:  1.86 },
  { name: "Merak",        ra: 11.0307, dec:  56.3824,  magnitude:  2.37 },
  { name: "Phecda",       ra: 11.8976, dec:  53.6948,  magnitude:  2.44 },
];

const deepSkyObjects = [
  // Galaxies
  { name: "M31 (Andromeda Galaxy)",   type: "galaxy",  ra: 10.6847,   dec:  41.2692 },
  { name: "M33 (Triangulum Galaxy)",  type: "galaxy",  ra: 23.4620,   dec:  30.6602 },
  { name: "M51 (Whirlpool Galaxy)",   type: "galaxy",  ra: 202.4696,  dec:  47.1952 },
  { name: "M63 (Sunflower Galaxy)",   type: "galaxy",  ra: 198.9556,  dec:  42.0294 },
  { name: "M81 (Bode's Galaxy)",      type: "galaxy",  ra: 148.8882,  dec:  69.0653 },
  { name: "M82 (Cigar Galaxy)",       type: "galaxy",  ra: 148.9696,  dec:  69.6797 },
  { name: "M87 (Virgo A)",            type: "galaxy",  ra: 187.7059,  dec:  12.3911 },
  { name: "M101 (Pinwheel Galaxy)",   type: "galaxy",  ra: 210.8023,  dec:  54.3489 },
  { name: "M104 (Sombrero Galaxy)",   type: "galaxy",  ra: 189.9976,  dec: -11.6231 },
  { name: "M64 (Black Eye Galaxy)",   type: "galaxy",  ra: 194.1821,  dec:  21.6830 },
  { name: "M77",                      type: "galaxy",  ra: 40.6696,   dec:  -0.0133 },
  { name: "M74",                      type: "galaxy",  ra: 24.1739,   dec:  15.7836 },
  // Nebulae
  { name: "M1 (Crab Nebula)",         type: "nebula",  ra: 83.6331,   dec:  22.0145 },
  { name: "M8 (Lagoon Nebula)",       type: "nebula",  ra: 270.9208,  dec: -24.3833 },
  { name: "M17 (Omega Nebula)",       type: "nebula",  ra: 275.1958,  dec: -16.1750 },
  { name: "M20 (Trifid Nebula)",      type: "nebula",  ra: 270.6208,  dec: -23.0333 },
  { name: "M27 (Dumbbell Nebula)",    type: "nebula",  ra: 299.9013,  dec:  22.7214 },
  { name: "M42 (Orion Nebula)",       type: "nebula",  ra: 83.8221,   dec:  -5.3911 },
  { name: "M43",                      type: "nebula",  ra: 83.8854,   dec:  -5.2675 },
  { name: "M57 (Ring Nebula)",        type: "nebula",  ra: 283.3962,  dec:  33.0289 },
  { name: "M76 (Little Dumbbell)",    type: "nebula",  ra: 25.5800,   dec:  51.5756 },
  { name: "M97 (Owl Nebula)",         type: "nebula",  ra: 168.6996,  dec:  55.0190 },
  { name: "M78",                      type: "nebula",  ra: 86.6754,   dec:   0.0681 },
  // Clusters
  { name: "M3",                       type: "cluster", ra: 205.5483,  dec:  28.3775 },
  { name: "M5",                       type: "cluster", ra: 229.6383,  dec:   2.0817 },
  { name: "M6 (Butterfly Cluster)",   type: "cluster", ra: 265.0833,  dec: -32.2167 },
  { name: "M7",                       type: "cluster", ra: 268.4600,  dec: -34.8417 },
  { name: "M11 (Wild Duck Cluster)",  type: "cluster", ra: 282.7667,  dec:  -6.2717 },
  { name: "M13 (Hercules Cluster)",   type: "cluster", ra: 250.4230,  dec:  36.4610 },
  { name: "M22",                      type: "cluster", ra: 279.1000,  dec: -23.9039 },
  { name: "M35",                      type: "cluster", ra: 92.2667,   dec:  24.3333 },
  { name: "M44 (Beehive Cluster)",    type: "cluster", ra: 130.0250,  dec:  19.9822 },
  { name: "M45 (Pleiades)",           type: "cluster", ra: 56.8750,   dec:  24.1167 },
  { name: "M47",                      type: "cluster", ra: 114.1500,  dec: -14.4833 },
  { name: "M92",                      type: "cluster", ra: 259.2800,  dec:  43.1358 },
  { name: "M15",                      type: "cluster", ra: 322.4930,  dec:  12.1670 },
];

const exoplanets = [
  { name: "51 Pegasi b",    type: "exoplanet", ra: 344.366, dec:  20.768 },
  { name: "HD 209458 b",    type: "exoplanet", ra: 330.794, dec:  18.884 },
  { name: "55 Cancri e",    type: "exoplanet", ra: 133.149, dec:  28.330 },
  { name: "WASP-12 b",      type: "exoplanet", ra: 97.637,  dec:  29.673 },
  { name: "Kepler-452 b",   type: "exoplanet", ra: 292.167, dec:  44.322 },
];

// ─── Main Component ──────────────────────────────────────────────────────────

const AstroObservationApp = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [observations, setObservations] = useState<Observation[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editObservationId, setEditObservationId] = useState<number | null>(null);
  const [selectedObject, setSelectedObject] = useState<CelestialObject | null>(null);
  const [userLocation, setUserLocation] = useState({ lat: 38.7223, lng: -9.1393 });
  const [placeName, setPlaceName] = useState('Lisbon, Portugal');
  const [placeInput, setPlaceInput] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [moonPhase, setMoonPhase] = useState({ phase: 'New Moon', illumination: 0 });
  const [filterType, setFilterType] = useState('all');
  const [showFavorites, setShowFavorites] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showSuccess, setShowSuccess] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedObservation, setSelectedObservation] = useState<Observation | null>(null);
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<number | null>(null);
  const [bortleClass, setBortleClass] = useState<string>('Loading...');
  const [showSkyChart, setShowSkyChart] = useState(false);
  const [redFilter, setRedFilter] = useState(false);
  const [visiblePlanets, setVisiblePlanets] = useState<CelestialObject[]>([]);
  const [visibleStars, setVisibleStars] = useState<CelestialObject[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [visibleObjectsNow, setVisibleObjectsNow] = useState<VisibleObject[]>([]);
  const [events, setEvents] = useState<EventType[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isIphone, setIsIphone] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Wishlist
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [showWishlistForm, setShowWishlistForm] = useState(false);
  const [wishlistForm, setWishlistForm] = useState<Omit<WishlistItem, 'id' | 'dateAdded'>>({
    name: '', type: 'star', priority: 'medium', notes: ''
  });
  const [wishlistFilter, setWishlistFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  // ISS
  const [issData, setIssData] = useState<ISSData | null>(null);
  const [issLoading, setIssLoading] = useState(false);
  const [issAboveHorizon, setIssAboveHorizon] = useState(false);
  const [issHistory, setIssHistory] = useState<{lat: number, lng: number}[]>([]);
  const [tiangongData, setTiangongData] = useState<ISSData | null>(null);
  const [tiangongHistory, setTiangongHistory] = useState<{lat: number, lng: number}[]>([]);
  // PWA install prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [pwaInstalled, setPwaInstalled] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const emptyForm: Omit<Observation, 'id' | 'dateAdded'> = {
    name: '', type: 'star',
    date: new Date().toISOString().split('T')[0],
    location: '', ra: '', dec: '',
    magnitude: '', distance: '', distanceUnit: 'ly',
    description: '', favorite: false, image: '',
    equipment: '', eyepiece: '', seeing: '', transparency: ''
  };
  const [formData, setFormData] = useState<Omit<Observation, 'id' | 'dateAdded'>>(emptyForm);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Detect mobile viewport
  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setIsIphone(/iphone|ipad|ipod|android/i.test(navigator.userAgent));
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Register service worker for PWA (offline + installable)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/AstroLogs/sw.js').catch(() => {});
      });
    }
    // Listen for browser install prompt
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    // Detect if already installed
    window.addEventListener('appinstalled', () => { setPwaInstalled(true); setDeferredPrompt(null); });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const angle = MoonPhase(currentTime);
    const fraction = angle / 360;
    const illumination = Math.round((1 - Math.cos((angle * Math.PI) / 180)) / 2 * 100);
    setMoonPhase({ phase: moonPhaseName(fraction), illumination });
  }, [currentTime]);

  useEffect(() => {
    fetchBortleClass(userLocation.lat, userLocation.lng).then(setBortleClass);
  }, [userLocation]);

  useEffect(() => {
    fetch(`${nominatimBase}/reverse?lat=${userLocation.lat}&lon=${userLocation.lng}&format=json`)
      .then(res => res.json())
      .then(data => { if (data?.display_name) setPlaceName(data.display_name); })
      .catch(() => setPlaceName('Unknown location'));
  }, [userLocation]);

  useEffect(() => {
    const saved = localStorage.getItem("observations");
    if (saved) setObservations(JSON.parse(saved));
    const savedWl = localStorage.getItem("wishlist");
    if (savedWl) setWishlist(JSON.parse(savedWl));
  }, []);

  useEffect(() => {
    localStorage.setItem("observations", JSON.stringify(observations));
  }, [observations]);

  useEffect(() => {
    localStorage.setItem("wishlist", JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    if (editObservationId !== null) {
      const obs = observations.find(o => o.id === editObservationId);
      if (obs) { setFormData({ ...emptyForm, ...obs }); setShowAddForm(true); }
    }
    // eslint-disable-next-line
  }, [editObservationId]);

  useEffect(() => {
    if (userLocation.lat && userLocation.lng) {
      const now = new Date();
      setVisiblePlanets(getVisiblePlanets(userLocation.lat, userLocation.lng, now));
      setVisibleStars(getVisibleBrightStars(userLocation.lat, userLocation.lng, now));
    }
    // eslint-disable-next-line
  }, [userLocation, currentTime]);

  useEffect(() => {
    setVisibleObjectsNow(getAllVisibleObjects(userLocation.lat, userLocation.lng, currentTime));
    // eslint-disable-next-line
  }, [userLocation, currentTime]);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) document.body.classList.add('ios-device');
    setIsIphone(/iPhone/.test(navigator.userAgent));
  }, []);

  // ISS polling every 10 seconds when on ISS tab
  useEffect(() => {
    if (activeTab !== 'iss') return;
    const fetchISS = async () => {
      setIssLoading(true);
      try {
        const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
        if (!res.ok) throw new Error('primary API failed');
        const data: ISSData = await res.json();
        setIssData(data);
        const latDiff = Math.abs(data.latitude - userLocation.lat);
        const lonDiff = Math.abs(data.longitude - userLocation.lng);
        setIssAboveHorizon(latDiff < 20 && lonDiff < 30);
        setIssHistory(prev => [...prev.slice(-50), {lat: data.latitude, lng: data.longitude}]);
      } catch {
        try {
          const res2 = await fetch('https://api.open-notify.org/iss-now.json');
          const d2 = await res2.json();
          if (d2.iss_position) {
            setIssData({ latitude: parseFloat(d2.iss_position.latitude), longitude: parseFloat(d2.iss_position.longitude), altitude: 408, velocity: 27600, visibility: 'unknown', footprint: 0, timestamp: d2.timestamp });
          }
        } catch { /* both APIs failed */ }
      }
      // Tiangong (CSS) — NORAD 48274
      try {
        const tRes = await fetch('https://api.wheretheiss.at/v1/satellites/48274');
        if (tRes.ok) {
          const tData: ISSData = await tRes.json();
          setTiangongData(tData);
          setTiangongHistory(prev => [...prev.slice(-50), {lat: tData.latitude, lng: tData.longitude}]);
        }
      } catch { /* Tiangong API failed */ }
      setIssLoading(false);
    };
    fetchISS();
    const interval = setInterval(fetchISS, 10000);
    return () => clearInterval(interval);
  }, [activeTab, userLocation]);

  // Elfsight widget cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      const el = document.querySelector('.fixed-translate-widget');
      if (el) {
        el.setAttribute('style', 'position:fixed !important; top:16px !important; right:24px !important; left:auto !important; z-index:10010 !important; background:transparent !important; margin:0 !important; width:auto !important;');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Astronomy helpers ─────────────────────────────────────────────────────

  const planetNames = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];

  function getVisiblePlanets(lat: number, lon: number, date: Date): CelestialObject[] {
    const observer = new Observer(lat, lon, 0);
    return planetNames.map(name => {
      const body = Body[name as keyof typeof Body];
      const eq = Equator(body, date, observer, true, true);
      const hor = Horizon(date, observer, eq.ra, eq.dec, "normal");
      return { name, type: "planet", magnitude: 0, constellation: "", ra: eq.ra.toFixed(2), dec: eq.dec.toFixed(2), season: "", bestTime: "", altitude: hor.altitude };
    }).filter(obj => obj.altitude > 0);
  }

  function getVisibleBrightStars(lat: number, lon: number, date: Date): CelestialObject[] {
    const observer = new Observer(lat, lon, 0);
    return brightStars.map(star => {
      const ra = star.ra * 15;
      const hor = Horizon(date, observer, ra, star.dec, "normal");
      return { name: star.name, type: "star", magnitude: star.magnitude, constellation: "", ra: ra.toFixed(2), dec: star.dec.toFixed(2), season: "", bestTime: "", altitude: hor.altitude };
    }).filter(obj => obj.altitude > 0);
  }

  function isObjectVisible(ra: number, dec: number, lat: number, lon: number, date: Date) {
    const observer = new Observer(lat, lon, 0);
    const hor = Horizon(date, observer, ra, dec, "normal");
    return hor.altitude > 0;
  }

  function getAllVisibleObjects(lat: number, lon: number, date: Date): VisibleObject[] {
    const observer = new Observer(lat, lon, 0);
    const planets = getVisiblePlanets(lat, lon, date).map(o => ({ ...o, displayType: "Planet" }));
    const stars = getVisibleBrightStars(lat, lon, date).map(o => ({ ...o, displayType: "Star" }));
    const messier: VisibleObject[] = deepSkyObjects
      .filter(o => isObjectVisible(o.ra, o.dec, lat, lon, date))
      .map(o => ({ name: o.name, type: o.type, magnitude: 0, constellation: '', ra: o.ra.toFixed(2), dec: o.dec.toFixed(2), season: '', bestTime: '', altitude: 0, displayType: "Deep Sky" }));
    const exos: VisibleObject[] = exoplanets
      .filter(o => isObjectVisible(o.ra, o.dec, lat, lon, date))
      .map(o => ({ name: o.name, type: o.type, magnitude: 0, constellation: '', ra: o.ra.toFixed(2), dec: o.dec.toFixed(2), season: '', bestTime: '', altitude: 0, displayType: "Exoplanet" }));
    const sunEq = Equator(Body.Sun, date, observer, true, true);
    const sunHor = Horizon(date, observer, sunEq.ra, sunEq.dec, "normal");
    const sunObj: VisibleObject[] = sunHor.altitude > 0 ? [{ name: "Sun", type: "sun", ra: sunEq.ra.toFixed(2), dec: sunEq.dec.toFixed(2), displayType: "Sun", magnitude: 0, constellation: '', season: '', bestTime: '', altitude: sunHor.altitude }] : [];
    const moonEq = Equator(Body.Moon, date, observer, true, true);
    const moonHor = Horizon(date, observer, moonEq.ra, moonEq.dec, "normal");
    const moonObj: VisibleObject[] = moonHor.altitude > 0 ? [{ name: "Moon", type: "moon", ra: moonEq.ra.toFixed(2), dec: moonEq.dec.toFixed(2), displayType: "Moon", magnitude: 0, constellation: '', season: '', bestTime: '', altitude: moonHor.altitude }] : [];
    return [...sunObj, ...moonObj, ...planets, ...stars, ...messier, ...exos];
  }

  function getVisibleObjectsAtHour(lat: number, lon: number, baseDate: Date, hour: number) {
    const date = new Date(baseDate);
    date.setHours(hour, 0, 0, 0);
    return getAllVisibleObjects(lat, lon, date).length;
  }

  // ── Event parsing ─────────────────────────────────────────────────────────

  const parseEvents = useCallback(async (currentTime: Date) => {
    const [astroEventsText, eventsListText] = await Promise.all([
      fetch(`${process.env.PUBLIC_URL}/AstroEvents.txt`).then(r => r.text()),
      fetch(`${process.env.PUBLIC_URL}/events-list.txt`).then(r => r.text())
    ]);
    const eventDescMap: Record<string, string> = {};
    const lines = eventsListText.split(/\r?\n/);
    let currentTitle = '';
    let currentDesc: string[] = [];
    for (const line of lines) {
      if (line.trim() === '') continue;
      if (/^[A-Za-z0-9\- ]+$/.test(line.trim())) {
        if (currentTitle) eventDescMap[currentTitle.toLowerCase()] = currentDesc.join('\n').trim();
        currentTitle = line.trim();
        currentDesc = [];
      } else {
        currentDesc.push(line);
      }
    }
    if (currentTitle) eventDescMap[currentTitle.toLowerCase()] = currentDesc.join('\n').trim();
    const eventList: EventType[] = [];
    let currentYear = '';
    const monthMap: Record<string, string> = { January:'01', February:'02', March:'03', April:'04', May:'05', June:'06', July:'07', August:'08', September:'09', October:'10', November:'11', December:'12' };
    const astroLines = astroEventsText.split(/\r?\n/);
    for (let i = 0; i < astroLines.length; i++) {
      const line = astroLines[i].trim();
      if (/^\d{4}/.test(line)) { currentYear = line.match(/\d{4}/)?.[0] || ''; continue; }
      if (Object.keys(monthMap).includes(line)) continue;
      if (/^(January|February|March|April|May|June|July|August|September|October|November|December)/.test(line)) {
        const match = line.match(/^(\w+)\s+(\d{1,2}(?:–\d{1,2})?)(?:,?\s*([\d: UTC-]+))?\s*[–-]\s*(.+)$/);
        if (match) {
          const [, month, day, , nameRaw] = match;
          const name = nameRaw.split(':')[0].trim();
          const dateStr = `${currentYear}-${monthMap[month]}-${day.split('–')[0].padStart(2, '0')}`;
          let imageName = '';
          const moonMatch = name.match(/Full Moon \(([^)]+)\)/i);
          if (moonMatch) imageName = `${moonMatch[1].toLowerCase().replace(/ /g, '-')}.jpg`;
          else if (/Full Moon/i.test(name)) imageName = 'full-moon.jpg';
          else imageName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') + '.jpg';
          const descKey = name.toLowerCase().replace(/\(.+\)/, '').trim();
          const description = eventDescMap[descKey] || 'No data available.';
          eventList.push({ id: `${currentYear}-${monthMap[month]}-${day.split('–')[0].padStart(2,'0')}-${name}`.replace(/[^a-zA-Z0-9]/g,'-').toLowerCase(), name, date: dateStr, description: description.split('\n')[0], imageName, fullDescription: description });
        }
      }
    }
    eventList.sort((a, b) => a.date.localeCompare(b.date));
    return eventList;
  }, []);

  useEffect(() => {
    setEventsLoading(true);
    parseEvents(currentTime).then(allEvents => {
      const now = currentTime;
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      let filtered = month === 12
        ? allEvents.filter(ev => { const y = parseInt(ev.date.split('-')[0]); return y === year || y === year + 1; })
        : allEvents.filter(ev => parseInt(ev.date.split('-')[0]) === year);
      filtered = filtered.filter(ev => new Date(ev.date) >= now);
      setEvents(filtered);
      setEventsLoading(false);
    });
  }, [currentTime, parseEvents]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const getLocationData = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log('Location access denied')
      );
    }
  };

  const handlePlaceInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaceInput(e.target.value);
    if (e.target.value.length > 2) {
      fetch(`${nominatimBase}/search?q=${encodeURIComponent(e.target.value)}&format=json&limit=5`)
        .then(res => res.json())
        .then(data => setLocationSuggestions(data));
    } else {
      setLocationSuggestions([]);
    }
  };

  const handleAddObservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { showNotification('Please enter an object name'); return; }
    if (editObservationId !== null) {
      setObservations(obs => obs.map(o => o.id === editObservationId ? { ...o, ...formData } : o));
      setEditObservationId(null);
    } else {
      setObservations([...observations, { id: Date.now(), ...formData, dateAdded: new Date().toISOString() }]);
    }
    setFormData(emptyForm);
    setShowAddForm(false);
    setShowSuccess(true);
    setActiveTab('objects');
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { showNotification('Image too large. Please use an image under 8MB.'); return; }
    try {
      const compressed = await compressImage(file);
      setFormData(prev => ({ ...prev, image: compressed }));
    } catch {
      showNotification('Error processing image. Please try another file.');
    }
  };

const lookupObjectData = async () => {
    const name = formData.name.trim();
    if (!name) { showNotification('Please enter an object name first'); return; }
    setIsLookingUp(true);
    try {
      // Wikipedia — descrição
      const wikiRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`
      );
      const wiki = wikiRes.ok ? await wikiRes.json() : null;
      const description = wiki?.extract
        ? wiki.extract.split('. ').slice(0, 3).join('. ') + '.'
        : '';
      const wikiImage = wiki?.thumbnail?.source || '';

      // SIMBAD — RA, DEC, Magnitude, Distância
      const query = `SELECT b.ra,b.dec,allfluxes.V,b.plx_value FROM basic b JOIN ident i ON i.oidref=b.oid LEFT JOIN allfluxes ON allfluxes.oidref=b.oid WHERE i.id='${name}' LIMIT 1`;
      const simbadUrl = `https://simbad.cds.unistra.fr/simbad/sim-tap/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=json&QUERY=${encodeURIComponent(query)}`;
      const simbadRes = await fetch(simbadUrl);
      const simbad = simbadRes.ok ? await simbadRes.json() : null;

      let ra = '', dec = '', magnitude = '', distance = '', distanceUnit = 'ly';
      if (simbad?.data?.[0]) {
        const [raVal, decVal, vMag, plx] = simbad.data[0];
        if (raVal !== null) {
          const h = Math.floor(raVal / 15);
          const m = Math.floor((raVal / 15 - h) * 60);
          const s = ((raVal / 15 - h) * 60 - m) * 60;
          ra = `${h.toString().padStart(2,'0')}h${m.toString().padStart(2,'0')}m${s.toFixed(1).padStart(4,'0')}s`;
        }
        if (decVal !== null) {
          const sign = decVal < 0 ? '-' : '+';
          const absDec = Math.abs(decVal);
          const d = Math.floor(absDec);
          const dm = Math.floor((absDec - d) * 60);
          const ds = ((absDec - d) * 60 - dm) * 60;
          dec = `${sign}${d.toString().padStart(2,'0')}°${dm.toString().padStart(2,'0')}'${ds.toFixed(0).padStart(2,'0')}"`;
        }
        if (vMag !== null) magnitude = vMag.toFixed(1);
        if (plx && plx > 0) {
          const distPc = 1000 / plx;
          const distLy = distPc * 3.26156;
          if (distLy < 1000000) {
            distance = distLy.toFixed(0);
            distanceUnit = 'ly';
          } else {
            distance = (distLy / 1000000).toFixed(1);
            distanceUnit = 'Mly';
          }
        }
      }

      setFormData(prev => ({
        ...prev,
        ra: ra || prev.ra,
        dec: dec || prev.dec,
        magnitude: magnitude || prev.magnitude,
        distance: distance || prev.distance,
        distanceUnit: distance ? distanceUnit : prev.distanceUnit,
        description: description || prev.description,
        image: wikiImage || prev.image,
      }));

      if (!ra && !description) {
        showNotification('Not found. Try official name e.g. "M 42", "NGC 224", "Sirius"');
      } else {
        showNotification('✅ Data loaded! Review and adjust as needed.');
      }
    } catch (e) {
      showNotification('Could not fetch data. Check your connection.');
    } finally {
      setIsLookingUp(false);
    }
  };
  
  const handleImageClick = (img: string) => {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`<html><head><title>Observation Image</title><style>body{background:#000;margin:0;display:flex;flex-direction:column;align-items:center}.close-btn{position:fixed;top:20px;right:20px;background:#222;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:18px;cursor:pointer;z-index:1000}img{max-width:100vw;max-height:100vh;display:block;margin:auto}</style></head><body><button class="close-btn" onclick="window.close()">Close ✕</button><img src="${img}" alt="Observation"/></body></html>`);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) setObservations(imported);
        else showNotification('Invalid file format.');
      } catch { showNotification('Could not import file.'); }
    };
    reader.readAsText(file);
  };

  const exportObservations = () => {
    const dataStr = JSON.stringify(observations, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const a = document.createElement('a');
    a.setAttribute('href', dataUri);
    a.setAttribute('download', `astro-observations-${new Date().toISOString().split('T')[0]}.json`);
    a.click();
  };

  const navigateCalendar = (direction: string) => {
    const newDate = new Date(calendarDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
    setCalendarDate(newDate);
    setCalendarSelectedDay(null);
  };

  const getDaysInMonth = (date: Date): (number | null)[] => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const days: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= lastDay; d++) days.push(d);
    return days;
  };

  const getObservationsForDay = (date: Date, day: number) => {
    const dateStr = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
    return observations.filter(obs => obs.date === dateStr);
  };

  const getEventsForDay = (date: Date, day: number) => {
    const dateStr = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
    return events.filter(ev => ev.date === dateStr);
  };

  // URL helpers
  const simbadUrl = (name: string) => `http://simbad.u-strasbg.fr/simbad/sim-basic?Ident=${encodeURIComponent(name)}`;
  const wikipediaUrl = (name: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, "_"))}`;
  const nasaExoplanetUrl = (name: string) => `https://exoplanetarchive.ipac.caltech.edu/cgi-bin/DisplayOverview/nph-DisplayOverview?objname=${encodeURIComponent(name)}`;
  const jplSsdUrl = (name: string) => `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(name)}`;

  // Derived
  const allObjects: CelestialObject[] = [...visiblePlanets, ...visibleStars];

  const filteredObservations = observations.filter(obs => {
    const typeMatch = filterType === 'all' || obs.type === filterType;
    const favoriteMatch = !showFavorites || obs.favorite;
    const searchMatch = !searchQuery || obs.name.toLowerCase().includes(searchQuery.toLowerCase()) || obs.location.toLowerCase().includes(searchQuery.toLowerCase()) || obs.description.toLowerCase().includes(searchQuery.toLowerCase());
    return typeMatch && favoriteMatch && searchMatch;
  });

  // ── Statistics ────────────────────────────────────────────────────────────

  const typeStats = ['star','galaxy','nebula','cluster','planet','other'].map(type => ({
    type, count: observations.filter(o => o.type === type).length
  })).filter(s => s.count > 0).sort((a,b) => b.count - a.count);

  const monthStats = (() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      const count = observations.filter(o => {
        const od = new Date(o.date);
        return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
      }).length;
      return { label, count };
    });
  })();

  const maxTypeCount = Math.max(...typeStats.map(s => s.count), 1);
  const maxMonthCount = Math.max(...monthStats.map(s => s.count), 1);

  // ── Wishlist helpers ──────────────────────────────────────────────────────

  const handleAddWishlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wishlistForm.name.trim()) { showNotification('Please enter an object name'); return; }
    setWishlist([...wishlist, { id: Date.now(), ...wishlistForm, dateAdded: new Date().toISOString() }]);
    setWishlistForm({ name: '', type: 'star', priority: 'medium', notes: '' });
    setShowWishlistForm(false);
  };

  const moveWishlistToObservation = (item: WishlistItem) => {
    setFormData({ ...emptyForm, name: item.name, type: item.type, description: item.notes });
    setWishlist(wl => wl.filter(w => w.id !== item.id));
    setEditObservationId(null);
    setShowAddForm(true);
    setActiveTab('home');
  };

  const priorityColor = (p: 'high' | 'medium' | 'low') =>
    p === 'high' ? 'bg-red-600' : p === 'medium' ? 'bg-yellow-600' : 'bg-green-700';

  const filteredWishlist = wishlistFilter === 'all' ? wishlist : wishlist.filter(w => w.priority === wishlistFilter);

  // ── Render ────────────────────────────────────────────────────────────────

  const tabs = [
    { id: 'home',     label: 'Home',        icon: '🏠' },
    { id: 'objects',  label: 'Objects',     icon: '🌟' },
    { id: 'stats',    label: 'Stats',       icon: '📊' },
    { id: 'wishlist', label: 'Wishlist',    icon: '📋' },
    { id: 'iss',      label: 'ISS',         icon: '🛸' },
    { id: 'resources',label: 'Resources',   icon: '📚' },
    { id: 'links',    label: 'Links',       icon: '🔗' },
    { id: 'calendar', label: 'Calendar',    icon: '📅' },
    { id: 'solar',    label: 'Solar',       icon: '🪐' },
    { id: 'settings', label: 'Settings',    icon: '⚙️' },
  ];
  // Mobile bottom nav: 4 primary + "More" button
  const primaryTabs = ['home', 'objects', 'iss', 'calendar'];
  const moreTabs = tabs.filter(t => !primaryTabs.includes(t.id));

  return (
    <div style={{ position: 'relative' }}>
      <div className="fixed-translate-widget" style={{ position: 'fixed', top: 16, right: 24, zIndex: 10010, background: 'transparent' }}>
        <div className="elfsight-app-eb167c9f-6a9a-40e5-b4dc-45e2558d4129" data-elfsight-app-lazy></div>
      </div>
      {redFilter && <div className="red-filter-overlay" />}

      <div className={`min-h-screen ${redFilter ? 'red-filter-text bg-[#1a0000]' : 'text-white bg-gray-900'}`}>
        <div className={`w-full mx-auto rounded-b-2xl shadow-lg ${redFilter ? 'red-filter-header' : 'bg-gray-800'}`} style={{ maxWidth: 1600 }}>

          {/* Header */}
          <header className="p-4" style={{ paddingLeft: 10, paddingRight: 10, borderBottom: 'none' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🔭</span>
                <h1 className="text-2xl font-bold">AstroLog</h1>
              </div>
              <div className="flex-1 flex justify-center">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setRedFilter(r => !r)}
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors duration-200 ${redFilter ? 'red-filter-btn' : 'bg-blue-600 hover:bg-blue-700'}`}
                    title="Toggle red filter for night vision"
                  >
                    <span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: '50%', background: 'red', border: '2px solid #fff' }}></span>
                  </button>
                  <button
                    onClick={() => { setShowAddForm(true); setEditObservationId(null); setFormData(emptyForm); }}
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors duration-200 ${redFilter ? 'red-filter-btn' : 'bg-blue-600 hover:bg-blue-700'}`}
                    title="Add Observation"
                  >
                    <Plus size={22} />
                  </button>
                  {/* PWA install button — only shown when browser supports it */}
                  {deferredPrompt && !pwaInstalled && (
                    <button
                      onClick={async () => {
                        if (!deferredPrompt) return;
                        deferredPrompt.prompt();
                        const { outcome } = await deferredPrompt.userChoice;
                        if (outcome === 'accepted') setPwaInstalled(true);
                        setDeferredPrompt(null);
                      }}
                      className="flex items-center gap-1 px-3 py-2 rounded-full bg-green-600 hover:bg-green-700 text-white text-xs font-bold"
                      title="Instalar app no dispositivo"
                    >
                      📲 Instalar App
                    </button>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Nav — desktop: horizontal scroll | mobile: hidden (bottom bar below) */}
          {!isMobile && (
            <nav style={{ paddingLeft: 10, paddingRight: 10, overflowX: 'auto' }} className="border-t border-gray-700">
              <div className="flex" style={{ minWidth: 'max-content' }}>
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === tab.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-300 hover:text-gray-200'}`}
                  >
                    <span className="mr-1">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </nav>
          )}

          {/* Main content — extra bottom padding on mobile to clear the bottom nav */}
          <main className="w-full px-4 py-6" style={{ maxWidth: 1600, margin: '0 auto', paddingBottom: isMobile ? 80 : 24 }}>

            {/* ── HOME ────────────────────────────────────────────────── */}
            {activeTab === 'home' && (
              <div className="space-y-6">
                {/* Location / time / object selector */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold mb-4 flex items-center">
                    <Eye className="mr-2" size={24} />
                    What can I observe now?
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {/* Object picker */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Celestial Object:</label>
                      <select
                        value={selectedObject ? selectedObject.name : ""}
                        onChange={e => setSelectedObject(allObjects.find(o => o.name === e.target.value) || null)}
                        className="w-full p-2 bg-gray-700 rounded border border-gray-600"
                      >
                        <option value="">Select object...</option>
                        {allObjects.map(obj => <option key={obj.name} value={obj.name}>{obj.name} ({(obj as VisibleObject).displayType || obj.type})</option>)}
                      </select>
                      {selectedObject && (
                        <div className="flex flex-wrap gap-2 mt-2 text-sm">
                          <a href={wikipediaUrl(selectedObject.name)} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Wikipedia</a>
                          <a href={simbadUrl(selectedObject.name)} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">SIMBAD</a>
                          {selectedObject.type === "planet" && <a href={jplSsdUrl(selectedObject.name)} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">JPL</a>}
                          {selectedObject.type === "exoplanet" && <a href={nasaExoplanetUrl(selectedObject.name)} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">NASA</a>}
                        </div>
                      )}
                    </div>
                    {/* Date/time */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Date & Time:</label>
                      <DatePicker selected={currentTime} onChange={(d: Date | null) => d && setCurrentTime(d)} showTimeSelect dateFormat="Pp" className="w-44 p-2 bg-gray-700 rounded border border-gray-600" />
                    </div>
                    {/* Location */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Location:</label>
                      <div className="flex space-x-2">
                        <div className="relative flex-1">
                          <input type="text" value={placeInput} onChange={handlePlaceInput} placeholder="Enter location" className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input" />
                          {locationSuggestions.length > 0 && (
                            <ul className="absolute left-0 right-0 bg-white text-black z-10 rounded shadow">
                              {locationSuggestions.map(s => (
                                <li key={s.place_id} onClick={() => { setUserLocation({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) }); setPlaceInput(s.display_name); setLocationSuggestions([]); }} className="cursor-pointer hover:bg-gray-200 px-2 py-1 text-sm">{s.display_name}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <button onClick={getLocationData} className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded" title="Get current location"><MapPin size={16} /></button>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{placeName}</div>
                    </div>
                    {/* Coordinates */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Coordinates:</label>
                      <div className="flex space-x-2">
                        <input type="number" value={userLocation.lat.toFixed(2)} onChange={e => setUserLocation({ ...userLocation, lat: parseFloat(e.target.value) })} className="w-24 p-2 bg-gray-700 rounded border border-gray-600" step="0.01" />
                        <input type="number" value={userLocation.lng.toFixed(2)} onChange={e => setUserLocation({ ...userLocation, lng: parseFloat(e.target.value) })} className="w-24 p-2 bg-gray-700 rounded border border-gray-600" step="0.01" />
                      </div>
                    </div>
                  </div>

                  {/* Bortle + sky chart link */}
                  <div className="mt-4 space-y-1">
                    <div>
                      <span className="font-bold text-gray-300">Light pollution: </span>
                      <span className="text-yellow-300">{bortleClass}</span>
                      {' · '}
                      <a href={`https://lightpollutionmap.app/?lat=${userLocation.lat.toFixed(5)}&lng=${userLocation.lng.toFixed(5)}&zoom=6`} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">View map</a>
                    </div>
                    <div>
                      <span className="font-bold">Sky Chart: </span>
                      <a href={`https://stellarium-web.org/?lat=${userLocation.lat}&lon=${userLocation.lng}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">View in Stellarium Web</a>
                    </div>
                  </div>

                  <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded flex items-center space-x-2 mt-4" onClick={() => setShowSkyChart(!showSkyChart)}>
                    <Sun size={16} /><span>{showSkyChart ? 'Hide' : 'Show'} Visibility by Hour</span>
                  </button>
                  {showSkyChart && (
                    <div className="mt-4">
                      <div className="font-bold mb-2">Objects visible — next 12 hours:</div>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: 12 }).map((_, i) => {
                          const hour = (currentTime.getHours() + i) % 24;
                          const count = getVisibleObjectsAtHour(userLocation.lat, userLocation.lng, currentTime, hour);
                          return (
                            <div key={i} className="flex flex-col items-center">
                              <div className="text-xs text-gray-400">{hour}:00</div>
                              <button
                                className={`w-10 h-10 rounded-full flex items-center justify-center mt-1 font-bold text-sm ${count > 20 ? 'bg-green-600' : count > 10 ? 'bg-blue-600' : 'bg-gray-700'}`}
                                onClick={() => { const t = new Date(currentTime); t.setHours(hour,0,0,0); setCurrentTime(t); }}
                              >{count}</button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Number of objects visible per hour (click to set time)</div>
                    </div>
                  )}
                </div>

                {/* Visible objects grid */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">🌠 Currently Visible ({visibleObjectsNow.length} objects)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {visibleObjectsNow.length === 0 && <div className="text-gray-400">No objects currently visible.</div>}
                    {visibleObjectsNow.map(obj => (
                      <div key={obj.name} className="bg-gray-700 p-3 rounded-lg">
                        <h4 className="font-bold text-blue-400 text-sm">{obj.name}</h4>
                        <p className="text-xs text-gray-400">{obj.displayType}</p>
                        {obj.altitude > 0 && <p className="text-xs text-gray-400">Alt: {obj.altitude.toFixed(1)}°</p>}
                        <div className="flex flex-wrap gap-1 mt-1">
                          <a href={wikipediaUrl(obj.name)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">Wiki</a>
                          <span className="text-gray-600">·</span>
                          <a href={simbadUrl(obj.name)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">SIMBAD</a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Moon */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">🌙 Moon Today</h3>
                  <div className="mb-4 flex items-center space-x-4">
                    <span className="text-lg font-semibold text-blue-300">{moonPhase.phase}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-300">{moonPhase.illumination}% illuminated</span>
                  </div>
                  <iframe title="Moon Giant Phase" src="https://www.moongiant.com/phase/today/" width="300" height="450" frameBorder="0" scrolling="no" style={{ background: "transparent" }}></iframe>
                  <div className="text-xs text-gray-400 mt-2">Source: <a href="https://www.moongiant.com/phase/today/" target="_blank" rel="noopener noreferrer" className="text-blue-400">MoonGiant.com</a></div>
                </div>
              </div>
            )}

            {/* ── OBJECTS ─────────────────────────────────────────────── */}
            {activeTab === 'objects' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold">My Observations ({observations.length})</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search */}
                    <div className="relative">
                      <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-7 pr-3 py-2 bg-gray-700 rounded border border-gray-600 text-sm ios-input"
                      />
                    </div>
                    <button onClick={() => setShowFavorites(!showFavorites)} className={`px-3 py-2 rounded text-sm ${showFavorites ? 'bg-yellow-600' : 'bg-gray-600'}`}>
                      <Star size={14} className="inline mr-1" />Favorites
                    </button>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)} className="p-2 bg-gray-700 rounded border border-gray-600 text-sm">
                      <option value="all">All Types</option>
                      <option value="star">Stars</option>
                      <option value="galaxy">Galaxies</option>
                      <option value="cluster">Clusters</option>
                      <option value="nebula">Nebulae</option>
                      <option value="planet">Planets</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredObservations.map(obs => (
                    <div key={obs.id} className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-blue-400 border border-gray-700" onClick={() => { setSelectedObservation(obs); setShowDetailModal(true); }}>
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-bold text-lg text-blue-400">{obs.name}</h3>
                        {obs.favorite && <Star className="text-yellow-400 fill-current flex-shrink-0" size={18} />}
                      </div>
                      {obs.image && (
                        <div className="mb-3">
                          <img src={obs.image} alt={obs.name} className="w-full h-32 object-cover rounded-lg hover:opacity-80" onClick={e => { e.stopPropagation(); handleImageClick(obs.image); }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        </div>
                      )}
                      <p className="text-sm text-gray-300">Type: <span className="capitalize">{obs.type}</span></p>
                      <p className="text-sm text-gray-300">Date: {obs.date}</p>
                      {obs.location && <p className="text-sm text-gray-300 truncate">📍 {obs.location}</p>}
                      {obs.equipment && <p className="text-sm text-gray-400 truncate">🔭 {obs.equipment}</p>}
                      {obs.seeing && <p className="text-sm text-yellow-400">Seeing: {starsDisplay(obs.seeing)}</p>}
                      {obs.magnitude && <p className="text-sm text-gray-300">Mag: {obs.magnitude}</p>}
                      {obs.description && <p className="text-sm text-gray-400 mt-1 line-clamp-2">{obs.description}</p>}
                    </div>
                  ))}
                </div>

                {filteredObservations.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🔭</div>
                    <h3 className="text-xl font-bold mb-2">{searchQuery ? 'No results found' : 'No observations yet'}</h3>
                    <p className="text-gray-400 mb-4">{searchQuery ? 'Try a different search term.' : 'Start logging your astronomical observations!'}</p>
                    {!searchQuery && <button onClick={() => { setShowAddForm(true); setEditObservationId(null); setFormData(emptyForm); }} className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg">Add First Observation</button>}
                  </div>
                )}
              </div>
            )}

            {/* ── STATS ───────────────────────────────────────────────── */}
            {activeTab === 'stats' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold flex items-center gap-2"><BarChart2 size={24} /> Statistics</h2>

                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Observations', value: observations.length, icon: '🔭' },
                    { label: 'Favorites', value: observations.filter(o => o.favorite).length, icon: '⭐' },
                    { label: 'Types Observed', value: new Set(observations.map(o => o.type)).size, icon: '🌠' },
                    { label: 'Wishlist Items', value: wishlist.length, icon: '📋' },
                  ].map(card => (
                    <div key={card.label} className="bg-gray-800 rounded-lg p-4 text-center">
                      <div className="text-3xl mb-1">{card.icon}</div>
                      <div className="text-3xl font-bold text-blue-400">{card.value}</div>
                      <div className="text-sm text-gray-400 mt-1">{card.label}</div>
                    </div>
                  ))}
                </div>

                {observations.length === 0 ? (
                  <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">Add observations to see statistics here.</div>
                ) : (
                  <>
                    {/* By type */}
                    <div className="bg-gray-800 rounded-lg p-6">
                      <h3 className="text-lg font-bold mb-4">By Object Type</h3>
                      <div className="space-y-2">
                        {typeStats.map(({ type, count }) => (
                          <div key={type} className="flex items-center gap-3">
                            <div className="w-20 text-sm text-gray-300 capitalize">{type}</div>
                            <div className="flex-1 bg-gray-700 rounded h-5 overflow-hidden">
                              <div className="bg-blue-500 h-5 rounded transition-all" style={{ width: `${(count / maxTypeCount) * 100}%` }} />
                            </div>
                            <div className="text-sm text-white w-6 text-right">{count}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* By month */}
                    <div className="bg-gray-800 rounded-lg p-6">
                      <h3 className="text-lg font-bold mb-4">Observations — Last 12 Months</h3>
                      <div className="flex items-end gap-1" style={{ height: 120 }}>
                        {monthStats.map(({ label, count }) => (
                          <div key={label} className="flex flex-col items-center flex-1">
                            <div className="w-full bg-blue-500 rounded-t transition-all" style={{ height: `${maxMonthCount > 0 ? (count / maxMonthCount) * 90 : 0}px`, minHeight: count > 0 ? 4 : 0 }} title={`${count} observations`} />
                            <div className="text-xs text-gray-500 mt-1 rotate-45 origin-top-left translate-y-2" style={{ fontSize: 9, whiteSpace: 'nowrap' }}>{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Most used equipment */}
                    {observations.some(o => o.equipment) && (
                      <div className="bg-gray-800 rounded-lg p-6">
                        <h3 className="text-lg font-bold mb-4">🔭 Equipment Used</h3>
                        <div className="space-y-1">
                          {Array.from(new Set(observations.filter(o => o.equipment).map(o => o.equipment))).map(eq => (
                            <div key={eq} className="flex justify-between text-sm">
                              <span className="text-gray-300">{eq}</span>
                              <span className="text-blue-400 font-bold">{observations.filter(o => o.equipment === eq).length}×</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top locations */}
                    {observations.some(o => o.location) && (
                      <div className="bg-gray-800 rounded-lg p-6">
                        <h3 className="text-lg font-bold mb-4">📍 Top Locations</h3>
                        <div className="space-y-1">
                          {Array.from(new Set(observations.filter(o => o.location).map(o => o.location))).slice(0, 8).map(loc => (
                            <div key={loc} className="flex justify-between text-sm">
                              <span className="text-gray-300 truncate flex-1">{loc}</span>
                              <span className="text-blue-400 font-bold ml-2">{observations.filter(o => o.location === loc).length}×</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── WISHLIST ─────────────────────────────────────────────── */}
            {activeTab === 'wishlist' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold flex items-center gap-2"><BookmarkPlus size={24} /> Observation Wishlist ({wishlist.length})</h2>
                  <div className="flex gap-2">
                    {(['all','high','medium','low'] as const).map(p => (
                      <button key={p} onClick={() => setWishlistFilter(p)} className={`px-3 py-1 rounded text-sm capitalize ${wishlistFilter === p ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>{p}</button>
                    ))}
                    <button onClick={() => setShowWishlistForm(true)} className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm flex items-center gap-1"><Plus size={14} /> Add</button>
                  </div>
                </div>

                {filteredWishlist.length === 0 ? (
                  <div className="bg-gray-800 rounded-lg p-8 text-center">
                    <div className="text-5xl mb-3">📋</div>
                    <p className="text-gray-400">Your wishlist is empty. Add objects you want to observe!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredWishlist.map(item => (
                      <div key={item.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-bold text-blue-400">{item.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full text-white capitalize ml-2 ${priorityColor(item.priority)}`}>{item.priority}</span>
                        </div>
                        <p className="text-sm text-gray-400 capitalize mb-1">{item.type}</p>
                        {item.notes && <p className="text-sm text-gray-300 mb-3">{item.notes}</p>}
                        <p className="text-xs text-gray-500 mb-3">Added: {item.dateAdded.split('T')[0]}</p>
                        <div className="flex gap-2">
                          <button onClick={() => moveWishlistToObservation(item)} className="flex-1 bg-blue-600 hover:bg-blue-700 px-2 py-1.5 rounded text-xs flex items-center justify-center gap-1">
                            <Plus size={12} /> Mark Observed
                          </button>
                          <button onClick={() => setWishlist(wl => wl.filter(w => w.id !== item.id))} className="bg-red-700 hover:bg-red-600 px-2 py-1.5 rounded text-xs">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Wishlist form modal */}
                {showWishlistForm && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold">Add to Wishlist</h3>
                        <button onClick={() => setShowWishlistForm(false)} className="text-gray-400 hover:text-white"><X size={22} /></button>
                      </div>
                      <form onSubmit={handleAddWishlist} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Object Name</label>
                          <input type="text" value={wishlistForm.name} onChange={e => setWishlistForm({ ...wishlistForm, name: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Type</label>
                            <select value={wishlistForm.type} onChange={e => setWishlistForm({ ...wishlistForm, type: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input">
                              <option value="star">Star</option>
                              <option value="galaxy">Galaxy</option>
                              <option value="cluster">Cluster</option>
                              <option value="nebula">Nebula</option>
                              <option value="planet">Planet</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Priority</label>
                            <select value={wishlistForm.priority} onChange={e => setWishlistForm({ ...wishlistForm, priority: e.target.value as any })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input">
                              <option value="high">🔴 High</option>
                              <option value="medium">🟡 Medium</option>
                              <option value="low">🟢 Low</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Notes</label>
                          <textarea value={wishlistForm.notes} onChange={e => setWishlistForm({ ...wishlistForm, notes: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input" rows={2} placeholder="Why do you want to observe this?" />
                        </div>
                        <div className="flex gap-3 pt-2">
                          <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded flex items-center justify-center gap-2"><Save size={16} /> Save</button>
                          <button type="button" onClick={() => setShowWishlistForm(false)} className="flex-1 bg-gray-600 hover:bg-gray-700 py-2 rounded">Cancel</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ISS ─────────────────────────────────────────────────── */}
            {activeTab === 'iss' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold flex items-center gap-2"><Radio size={24} /> ISS Tracker</h2>

                {issLoading && !issData && <div className="text-gray-400 animate-pulse">📡 Fetching ISS position...</div>}
                {!issLoading && !issData && <div className="bg-yellow-900 text-yellow-200 rounded p-3 text-sm">⚠️ Could not reach ISS tracking API. Check your connection and try again.</div>}

                {issData && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-800 rounded-lg p-6">
                      <h3 className="text-lg font-bold mb-4">🛸 Current ISS Position</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Latitude</span>
                          <span className="font-mono text-green-400">{issData.latitude.toFixed(4)}°</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Longitude</span>
                          <span className="font-mono text-green-400">{issData.longitude.toFixed(4)}°</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Altitude</span>
                          <span className="font-mono text-blue-400">{issData.altitude.toFixed(1)} km</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Speed</span>
                          <span className="font-mono text-blue-400">{(issData.velocity).toFixed(0)} km/h</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Daylight</span>
                          <span className={`font-bold ${issData.visibility === 'daylight' ? 'text-yellow-400' : 'text-indigo-400'}`}>{issData.visibility === 'daylight' ? '☀️ Daylight' : '🌑 Eclipsed'}</span>
                        </div>
                        <div className="flex justify-between border-t border-gray-700 pt-3">
                          <span className="text-gray-400">Visible from {placeName.split(',')[0]}</span>
                          <span className={`font-bold ${issAboveHorizon ? 'text-green-400' : 'text-red-400'}`}>{issAboveHorizon ? '✅ Above horizon' : '❌ Below horizon'}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-4">Updates every 10 seconds · Source: wheretheiss.at</p>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-6">
                      <h3 className="text-lg font-bold mb-4">📅 Pass Predictions</h3>
                      <p className="text-gray-300 text-sm mb-4">See when the ISS will pass over your location and how bright it will be:</p>
                      <div className="space-y-3">
                        <a href={`https://heavens-above.com/PassSummary.aspx?satid=25544&lat=${userLocation.lat}&lng=${userLocation.lng}&loc=MyLocation&alt=0&tz=UCT`} target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded-lg font-medium">
                          🔍 Heavens Above — Pass times
                        </a>
                        <a href={`https://spotthestation.nasa.gov/`} target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 px-4 py-3 rounded-lg font-medium">
                          🚀 NASA Spot the Station
                        </a>
                        <a href={`https://www.n2yo.com/satellite/?s=25544`} target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-gray-600 hover:bg-gray-500 px-4 py-3 rounded-lg font-medium">
                          🗺️ N2YO Live Map
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tiangong info panel */}
                {tiangongData && (
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-bold mb-4">🐉 Tiangong (CSS) — Estação Espacial Chinesa</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400 block">Latitude</span>
                        <span className="font-mono text-orange-400">{tiangongData.latitude.toFixed(4)}°</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Longitude</span>
                        <span className="font-mono text-orange-400">{tiangongData.longitude.toFixed(4)}°</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Altitude</span>
                        <span className="font-mono text-blue-400">{tiangongData.altitude.toFixed(1)} km</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Velocidade</span>
                        <span className="font-mono text-blue-400">{tiangongData.velocity.toFixed(0)} km/h</span>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-3 flex-wrap">
                      <a href={`https://heavens-above.com/PassSummary.aspx?satid=48274&lat=${userLocation.lat}&lng=${userLocation.lng}&loc=MyLocation&alt=0&tz=UCT`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:underline">📅 Passagens da Tiangong (Heavens Above)</a>
                      <a href="https://www.n2yo.com/satellite/?s=48274" target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:underline">🗺️ N2YO — Tiangong</a>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">NORAD ID 48274 · Atualiza a cada 10s</p>
                  </div>
                )}

                {/* Live map — built-in SVG, no external dependencies */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">🗺️ Live Space Station Map — ISS & Tiangong</h3>
                  {/* Distance & approach info */}
                  {issData && issHistory.length >= 2 && (() => {
                    const distNow = haversineKm(userLocation.lat, userLocation.lng, issData.latitude, issData.longitude);
                    const prev = issHistory[issHistory.length - 2];
                    const distPrev = haversineKm(userLocation.lat, userLocation.lng, prev.lat, prev.lng);
                    const approaching = distNow < distPrev;
                    const speedKmMin = Math.abs(distPrev - distNow) * 6;
                    return (
                      <div className="mb-3 flex flex-wrap gap-4 text-sm">
                        <span className="text-gray-300">📏 Distance: <strong className="text-blue-300">{Math.round(distNow).toLocaleString()} km</strong></span>
                        <span className={approaching ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                          {approaching ? '▲ Approaching' : '▼ Receding'} ({speedKmMin.toFixed(0)} km/min)
                        </span>
                      </div>
                    );
                  })()}
                  <div style={{ position: 'relative', width: '100%' }}>
                    <svg viewBox="0 0 360 180" style={{ width: '100%', borderRadius: 8, border: '1px solid #2a4a6a', display: 'block' }}>
                      {/* World map background — NASA Blue Marble, equirectangular projection */}
                      <image
                        href="https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Whole_world_-_land_and_oceans_12000.jpg/1280px-Whole_world_-_land_and_oceans_12000.jpg"
                        x="0" y="0" width="360" height="180"
                        preserveAspectRatio="none"
                        opacity="0.75"
                      />
                      {/* Dark overlay to keep text readable */}
                      <rect width="360" height="180" fill="#000820" opacity="0.35" />
                      {/* Grid lines */}
                      {[-60,-30,0,30,60].map(lat => (
                        <line key={lat} x1="0" y1={90-lat} x2="360" y2={90-lat} stroke="#ffffff" strokeWidth={lat===0 ? 0.8 : 0.3} strokeOpacity="0.2" />
                      ))}
                      {[-120,-60,0,60,120].map(lon => (
                        <line key={lon} x1={lon+180} y1="0" x2={lon+180} y2="180" stroke="#ffffff" strokeWidth="0.3" strokeOpacity="0.2" />
                      ))}
                      <text x="3" y="93" fill="white" fontSize="6" opacity="0.5">0°</text>
                      <text x="3" y="33" fill="white" fontSize="5" opacity="0.5">60°N</text>
                      <text x="3" y="153" fill="white" fontSize="5" opacity="0.5">60°S</text>
                      <text x="177" y="10" fill="white" fontSize="5" opacity="0.5">0°</text>
                      <rect x="0" y={90-51.6} width="360" height={103.2} fill="#00ff88" opacity="0.04" />
                      {issHistory.length > 1 && (() => {
                        const pts = issHistory.map(p => `${(p.lng + 180).toFixed(1)},${(90 - p.lat).toFixed(1)}`);
                        return <polyline points={pts.join(' ')} fill="none" stroke="#00ff88" strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round" strokeLinejoin="round" />;
                      })()}
                      {issHistory.length >= 2 && (() => {
                        const last = issHistory[issHistory.length - 1];
                        const prev = issHistory[issHistory.length - 2];
                        const dLat = last.lat - prev.lat;
                        const dLng = last.lng - prev.lng;
                        const predicted = Array.from({length: 30}, (_, i) => ({
                          lat: last.lat + dLat * (i + 1),
                          lng: last.lng + dLng * (i + 1)
                        }));
                        const pts = predicted.map(p => `${(p.lng + 180).toFixed(1)},${(90 - p.lat).toFixed(1)}`);
                        return <polyline points={pts.join(' ')} fill="none" stroke="#00ff88" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="3,3" />;
                      })()}
                      {issHistory.length >= 2 && (() => {
                        const last = issHistory[issHistory.length - 1];
                        const prev = issHistory[issHistory.length - 2];
                        const x = (last.lng + 180);
                        const y = 90 - last.lat;
                        const px = (prev.lng + 180);
                        const py = 90 - prev.lat;
                        const angle = Math.atan2(y - py, x - px) * 180 / Math.PI;
                        return <polygon points="-5,-3 5,0 -5,3" fill="#00ff88" opacity="0.9" transform={`translate(${x},${y}) rotate(${angle})`} />;
                      })()}
                      {userLocation && (
                        <g>
                          <circle cx={userLocation.lng+180} cy={90-userLocation.lat} r="4" fill="#ff4444" stroke="white" strokeWidth="1.2" />
                          <text x={userLocation.lng+186} y={90-userLocation.lat+4} fill="#ffaaaa" fontSize="5">You</text>
                        </g>
                      )}
                      {issData && (
                        <g>
                          <circle cx={issData.longitude + 180} cy={90-issData.latitude} r="14" fill="none" stroke="#00ff8835" strokeWidth="1" strokeDasharray="3,2" />
                          <circle cx={issData.longitude + 180} cy={90-issData.latitude} r="5" fill="#00ff88" stroke="white" strokeWidth="1.5">
                            <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                          </circle>
                          <text x={issData.longitude + 180 + 8} y={90-issData.latitude+3} fill="#00ff88" fontSize="6" fontWeight="bold">ISS</text>
                        </g>
                      )}
                      {/* Tiangong trail */}
                      {tiangongHistory.length > 1 && (() => {
                        const pts = tiangongHistory.map(p => `${(p.lng + 180).toFixed(1)},${(90 - p.lat).toFixed(1)}`);
                        return <polyline points={pts.join(' ')} fill="none" stroke="#ff6633" strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round" strokeLinejoin="round" />;
                      })()}
                      {/* Tiangong direction arrow */}
                      {tiangongHistory.length >= 2 && (() => {
                        const last = tiangongHistory[tiangongHistory.length - 1];
                        const prev = tiangongHistory[tiangongHistory.length - 2];
                        const x = (last.lng + 180);
                        const y = 90 - last.lat;
                        const px = (prev.lng + 180);
                        const py = 90 - prev.lat;
                        const angle = Math.atan2(y - py, x - px) * 180 / Math.PI;
                        return <polygon points="-5,-3 5,0 -5,3" fill="#ff6633" opacity="0.9" transform={`translate(${x},${y}) rotate(${angle})`} />;
                      })()}
                      {/* Tiangong dot */}
                      {tiangongData && (
                        <g>
                          <circle cx={tiangongData.longitude + 180} cy={90-tiangongData.latitude} r="14" fill="none" stroke="#ff663335" strokeWidth="1" strokeDasharray="3,2" />
                          <circle cx={tiangongData.longitude + 180} cy={90-tiangongData.latitude} r="5" fill="#ff6633" stroke="white" strokeWidth="1.5">
                            <animate attributeName="opacity" values="1;0.5;1" dur="2.5s" repeatCount="indefinite" />
                          </circle>
                          <text x={tiangongData.longitude + 180 + 8} y={90-tiangongData.latitude+3} fill="#ff6633" fontSize="6" fontWeight="bold">Tiangong</text>
                        </g>
                      )}
                    </svg>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                      <span><span className="text-green-400">●</span> ISS</span>
                      <span><span style={{color:'#ff6633'}}>●</span> Tiangong</span>
                      <span><span className="text-red-400">●</span> Tu</span>
                      <span><span className="text-green-600">──</span> ISS Trail</span>
                      <span><span style={{color:'#ff6633'}}>──</span> Tiangong Trail</span>
                      <span>▶ Direction</span>
                    </div>
                    {issData && (
                      <p className="text-xs text-gray-500 mt-1">
                        {issData.latitude.toFixed(2)}°, {issData.longitude.toFixed(2)}° · Alt: {issData.altitude.toFixed(0)} km · {issData.velocity.toFixed(0)} km/h
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3 mt-3 flex-wrap">
                    <a href={`https://heavens-above.com/PassSummary.aspx?satid=25544&lat=${userLocation.lat}&lng=${userLocation.lng}&loc=MyLocation&alt=0&tz=UCT`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">📅 Pass times (Heavens Above)</a>
                    <span className="text-gray-600">·</span>
                    <a href="https://www.n2yo.com/satellite/?s=25544" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">🗺️ Full 3D Tracker (N2YO)</a>
                  </div>
                </div>
              </div>
            )}

            {/* ── RESOURCES ────────────────────────────────────────────── */}
            {activeTab === 'resources' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Astronomical Resources</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-bold mb-4">Catalogs</h3>
                    <ul className="space-y-2">
                      <li><a href="https://hubblesite.org/contents/media/images?Type=2&page=1&filterUUID=2e1a4b24-07ab-4d85-aa47-5af4747b21e2" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Messier Catalog (NASA/Hubble)</a></li>
                      <li><a href="https://www.ngcicproject.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">NGC Catalog</a></li>
                      <li><a href="https://in-the-sky.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">In the Sky</a></li>
                    </ul>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-bold mb-4">Tools</h3>
                    <ul className="space-y-2">
                      <li><a href="https://www.timeanddate.com/moon/phases/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Moon Phases</a></li>
                      <li><a href="https://stellarium-web.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Stellarium Web</a></li>
                      <li><a href="https://www.heavens-above.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Heavens Above</a></li>
                      <li><a href="https://clearoutside.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Clear Outside</a></li>
                    </ul>
                  </div>
                </div>
                <div className="meteoblue-widgets flex flex-wrap gap-4 mt-8">
                  <div className="flex-shrink-0" style={{ width: 480 }}>
                    <iframe title="Meteoblue Forecast" src="https://www.meteoblue.com/pt/tempo/widget/three?geoloc=detect&nocurrent=0&noforecast=0&days=4&tempunit=CELSIUS&windunit=KILOMETER_PER_HOUR&layout=image" frameBorder="0" scrolling="no" allowTransparency={true} sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox" className="w-full" style={{ height: 590 }}></iframe>
                    <div><a href="https://www.meteoblue.com" target="_blank" rel="noopener noreferrer">meteoblue</a></div>
                  </div>
                  <div className="flex-shrink-0" style={{ width: 540 }}>
                    <iframe title="Meteoblue Seeing" src="https://www.meteoblue.com/pt/tempo/widget/seeing?geoloc=detect&noground=0" frameBorder="0" scrolling="no" allowTransparency={true} sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox" className="w-full" style={{ height: 775 }}></iframe>
                    <div><a href="https://www.meteoblue.com" target="_blank" rel="noopener noreferrer">meteoblue</a></div>
                  </div>
                  <div className="flex-shrink-0" style={{ width: 520 }}>
                    <iframe title="Meteoblue Map" src="https://www.meteoblue.com/pt/tempo/mapas/widget?windAnimation=1&gust=1&satellite=1&cloudsAndPrecipitation=1&temperature=1&sunshine=1&extremeForecastIndex=1&geoloc=detect&tempunit=C&windunit=km%252Fh&lengthunit=metric&zoom=5&autowidth=manu" frameBorder="0" scrolling="no" allowTransparency={true} sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox" className="w-full" style={{ height: 720 }}></iframe>
                    <div><a href="https://www.meteoblue.com" target="_blank" rel="noopener noreferrer">meteoblue</a></div>
                  </div>
                </div>
                {userLocation && (
                  <div className="bg-gray-800 rounded-lg p-4">
                    <h3 className="text-lg font-bold mb-4">Clear Outside Forecast</h3>
                    <a href={`https://clearoutside.com/forecast/${userLocation.lat.toFixed(2)}/${userLocation.lng.toFixed(2)}`} target="_blank" rel="noopener noreferrer">
                      <img src={`https://clearoutside.com/forecast_image_large/${userLocation.lat.toFixed(2)}/${userLocation.lng.toFixed(2)}/forecast.png`} alt="Clear Outside" style={{ width: '100%', maxWidth: 800 }} />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* ── LINKS ────────────────────────────────────────────────── */}
            {activeTab === 'links' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Useful Links</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-bold mb-4">Space Agencies</h3>
                    <ul className="space-y-2">
                      {[['NASA','https://www.nasa.gov'],['ESA','https://www.esa.int'],['SETI','https://www.seti.org'],['CNSA','https://www.cnsa.gov.cn'],['AEB','https://www.gov.br/aeb/pt-br'],['AEP (Portugal)','https://ptspace.pt/pt/home/'],['CSA','https://www.asc-csa.gc.ca'],['ISRO','https://www.isro.gov.in']].map(([l,u])=>(
                        <li key={l}><a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">{l}</a></li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-bold mb-4">Commercial Space</h3>
                    <ul className="space-y-2">
                      {[['SpaceX','https://www.spacex.com'],['Ariane','https://www.arianespace.com'],['Blue Origin','https://www.blueorigin.com'],['Rocket Lab','https://www.rocketlabusa.com'],['Virgin Galactic','https://www.virgingalactic.com']].map(([l,u])=>(
                        <li key={l}><a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">{l}</a></li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-bold mb-4">Astronomical Societies</h3>
                    <ul className="space-y-2">
                      {[['Astronomers for Planet Earth','https://a4e.org/'],['Astronomers Without Borders','https://astronomerswithoutborders.org/home'],['International Astronomical Union','https://www.iau.org/'],['International Meteor Organization','https://www.imo.net/'],['The Planetary Society','https://www.planetary.org/'],['European Astronomical Society','https://eas.unige.ch/']].map(([l,u])=>(
                        <li key={l}><a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">{l}</a></li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* ── CALENDAR ─────────────────────────────────────────────── */}
            {activeTab === 'calendar' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Observations & Events</h2>
                <div className="flex flex-col lg:flex-row gap-8 w-full">
                  <div className="bg-gray-800 rounded-lg p-6 flex-1 min-w-[320px]" style={{ maxWidth: 500 }}>
                    <div className="flex items-center justify-between mb-4">
                      <button onClick={() => navigateCalendar('prev')} className="text-2xl hover:text-blue-400 p-2 rounded hover:bg-gray-700">←</button>
                      <h3 className="text-xl font-bold">{calendarDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</h3>
                      <button onClick={() => navigateCalendar('next')} className="text-2xl hover:text-blue-400 p-2 rounded hover:bg-gray-700">→</button>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                        <div key={d} className="text-center font-bold p-1 text-gray-400 text-xs">{d}</div>
                      ))}
                      {getDaysInMonth(calendarDate).map((day, idx) => {
                        const isToday = day === new Date().getDate() && calendarDate.getMonth() === new Date().getMonth() && calendarDate.getFullYear() === new Date().getFullYear();
                        const hasObs = day ? getObservationsForDay(calendarDate, day).length > 0 : false;
                        const hasEvent = day ? getEventsForDay(calendarDate, day).length > 0 : false;
                        return (
                          <div key={idx} onClick={() => day && setCalendarSelectedDay(day)}
                            className={`text-center p-1 rounded cursor-pointer min-h-[36px] flex flex-col items-center justify-center text-sm ${day ? 'hover:bg-gray-700' : ''} ${isToday ? 'bg-blue-600 text-white' : ''} ${calendarSelectedDay === day ? 'bg-green-700 text-white' : ''}`}>
                            {day || ''}
                            <div className="flex gap-0.5 mt-0.5">
                              {hasObs && <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" title="Has observations" />}
                              {hasEvent && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" title="Has events" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-4 mt-3 text-xs text-gray-400">
                      <span><span className="w-2 h-2 rounded-full bg-green-400 inline-block mr-1" />Observations</span>
                      <span><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block mr-1" />Astro events</span>
                    </div>

                    {calendarSelectedDay && (() => {
                      const obs = getObservationsForDay(calendarDate, calendarSelectedDay);
                      const evs = getEventsForDay(calendarDate, calendarSelectedDay);
                      return (
                        <div className="mt-4">
                          <h4 className="font-bold mb-2 text-sm">
                            {calendarDate.getFullYear()}-{(calendarDate.getMonth()+1).toString().padStart(2,'0')}-{calendarSelectedDay.toString().padStart(2,'0')}
                          </h4>
                          {evs.length > 0 && (
                            <div className="mb-3">
                              <div className="text-xs text-yellow-400 font-bold mb-1">🌠 Astro Events</div>
                              {evs.map(ev => <div key={ev.id} className="text-sm text-yellow-200 bg-gray-700 p-2 rounded mb-1">{ev.name}</div>)}
                            </div>
                          )}
                          {obs.length === 0 ? <div className="text-gray-400 text-sm">No observations for this day.</div> : (
                            <ul className="space-y-1">
                              {obs.map(o => (
                                <li key={o.id} className="bg-gray-700 p-2 rounded cursor-pointer hover:ring-2 hover:ring-blue-400 text-sm" onClick={() => { setSelectedObservation(o); setShowDetailModal(true); }}>
                                  <span className="font-bold text-blue-300">{o.name}</span> <span className="text-gray-400">({o.type})</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="w-full max-w-[500px] max-h-[700px] overflow-y-auto bg-[#181c23] rounded-xl p-4 flex-shrink-0">
                    {eventsLoading ? <div className="text-gray-400">Loading events...</div> : <EventList events={events} />}
                  </div>
                </div>
              </div>
            )}

            {/* ── SOLAR ────────────────────────────────────────────────── */}
            {activeTab === 'solar' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">🪐 Solar System</h2>
                {isMobile ? (
                  /* Mobile: iframe not supported on iOS — show cards + link */
                  <div className="space-y-4">
                    <div className="bg-gray-800 rounded-lg p-6 text-center space-y-4">
                      <div className="text-6xl">🪐</div>
                      <p className="text-gray-300">O simulador 3D do Sistema Solar não funciona em iframe no iPhone/Android.</p>
                      <a href="https://www.solarsystemscope.com" target="_blank" rel="noopener noreferrer"
                        className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl text-lg">
                        🌍 Abrir Solar System Scope no browser
                      </a>
                      <a href="https://eyes.nasa.gov/apps/solar-system/" target="_blank" rel="noopener noreferrer"
                        className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl text-lg">
                        🚀 NASA Eyes on the Solar System
                      </a>
                      <a href="https://stellarium-web.org" target="_blank" rel="noopener noreferrer"
                        className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-xl text-lg">
                        ✨ Stellarium Web (Planetário)
                      </a>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { name: 'Mercúrio', icon: '⚫', dist: '0.39 UA', period: '88 dias', info: 'O mais próximo do Sol' },
                        { name: 'Vénus', icon: '🟡', dist: '0.72 UA', period: '225 dias', info: 'O mais quente (462°C)' },
                        { name: 'Terra', icon: '🔵', dist: '1.00 UA', period: '365 dias', info: 'O nosso planeta' },
                        { name: 'Marte', icon: '🔴', dist: '1.52 UA', period: '687 dias', info: 'O Planeta Vermelho' },
                        { name: 'Júpiter', icon: '🟠', dist: '5.20 UA', period: '12 anos', info: 'O maior planeta' },
                        { name: 'Saturno', icon: '🪐', dist: '9.58 UA', period: '29 anos', info: 'Com os seus anéis' },
                        { name: 'Urano', icon: '🩵', dist: '19.2 UA', period: '84 anos', info: 'Rodando de lado' },
                        { name: 'Neptuno', icon: '💙', dist: '30.1 UA', period: '165 anos', info: 'O mais ventoso' },
                      ].map(planet => (
                        <div key={planet.name} className="bg-gray-800 rounded-lg p-3 text-center">
                          <div className="text-3xl mb-1">{planet.icon}</div>
                          <div className="font-bold text-sm">{planet.name}</div>
                          <div className="text-xs text-gray-400">{planet.dist}</div>
                          <div className="text-xs text-blue-400">{planet.period}</div>
                          <div className="text-xs text-gray-500 mt-1">{planet.info}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Desktop: iframe works fine */
                  <div className="bg-gray-800 rounded-lg p-6">
                    <iframe src="https://www.solarsystemscope.com/iframe" width="100%" height="600" style={{ minWidth: 300, minHeight: 400, border: "2px solid #0f5c6e", borderRadius: 8 }} title="Solar System Scope" frameBorder="0" allowFullScreen={true} />
                    <div className="text-xs text-gray-400 mt-2">Source: <a href="https://www.solarsystemscope.com" target="_blank" rel="noopener noreferrer" className="text-blue-400">Solar System Scope</a></div>
                  </div>
                )}
              </div>
            )}

            {/* ── SETTINGS ─────────────────────────────────────────────── */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Settings & Configuration</h2>
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">Data Management</h3>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={exportObservations} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded flex items-center gap-2">
                      <Download size={16} /> Export Observations (JSON)
                    </button>
                    <label className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded flex items-center gap-2 cursor-pointer">
                      <Upload size={16} /> Import Observations
                      <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
                    </label>
                    <button onClick={() => { if (window.confirm('Delete ALL observations? This cannot be undone.')) { setObservations([]); } }} className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded flex items-center gap-2">
                      <Trash2 size={16} /> Clear All Observations
                    </button>
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">Image Storage</h3>
                  <p className="text-gray-300 text-sm mb-2">Images are stored locally in your browser (no external service needed). Each image is compressed to under 900px before saving.</p>
                  <p className="text-gray-400 text-sm">Observations with images: <span className="text-blue-400 font-bold">{observations.filter(o => o.image).length}</span></p>
                </div>
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">About AstroLog</h3>
                  <p className="text-gray-400 text-sm">AstroLog — Personal Astronomy Observation Journal</p>
                  <p className="text-gray-400 text-sm mt-1">Catalog: {brightStars.length} stars · {deepSkyObjects.length} deep sky objects · {exoplanets.length} exoplanets · 7 planets</p>
                </div>
              </div>
            )}

          </main>
        </div>

        {/* ── Add/Edit Observation Modal ───────────────────────────────── */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto relative" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">{editObservationId !== null ? 'Edit Observation' : 'Add Observation'}</h3>
                <button onClick={() => { setShowAddForm(false); setEditObservationId(null); }} className="text-gray-400 hover:text-white"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddObservation} className="space-y-4">
{/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-1">Object Name *</label>
                  <div className="flex gap-2">
                    <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. M42, Sirius, Saturn" className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 ios-input" required />
                    <button type="button" onClick={lookupObjectData} disabled={isLookingUp} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm whitespace-nowrap">
                      {isLookingUp ? '⏳' : '🔍 Auto-fill'}
                    </button>
                  </div>
                </div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input">
                      <option value="star">Star</option>
                      <option value="galaxy">Galaxy</option>
                      <option value="cluster">Cluster</option>
                      <option value="nebula">Nebula</option>
                      <option value="planet">Planet</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Date</label>
                    <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input" />
                  </div>
                </div>
                {/* Location */}
                <div>
                  <label className="block text-sm font-medium mb-1">Location</label>
                  <input type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="e.g. Dark site, Sintra" className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input" />
                </div>
                {/* Equipment */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">🔭 Telescope / Binoculars</label>
                    <input type="text" value={formData.equipment} onChange={e => setFormData({ ...formData, equipment: e.target.value })} placeholder="e.g. Dobson 8 inch, 10x50" className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">🔍 Eyepiece</label>
                    <input type="text" value={formData.eyepiece} onChange={e => setFormData({ ...formData, eyepiece: e.target.value })} placeholder="e.g. 25mm, 10mm" className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input" />
                  </div>
                </div>
                {/* Seeing + Transparency */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Seeing (1–5)</label>
                    <select value={formData.seeing} onChange={e => setFormData({ ...formData, seeing: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input">
                      <option value="">— Select —</option>
                      <option value="1">1 — Very Poor</option>
                      <option value="2">2 — Poor</option>
                      <option value="3">3 — Fair</option>
                      <option value="4">4 — Good</option>
                      <option value="5">5 — Excellent</option>
                    </select>
                    {formData.seeing && <p className="text-xs text-yellow-400 mt-0.5">{starsDisplay(formData.seeing)}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Transparency (1–5)</label>
                    <select value={formData.transparency} onChange={e => setFormData({ ...formData, transparency: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input">
                      <option value="">— Select —</option>
                      <option value="1">1 — Overcast</option>
                      <option value="2">2 — Mostly Cloudy</option>
                      <option value="3">3 — Partly Clear</option>
                      <option value="4">4 — Mostly Clear</option>
                      <option value="5">5 — Crystal Clear</option>
                    </select>
                    {formData.transparency && <p className="text-xs text-blue-400 mt-0.5">{starsDisplay(formData.transparency)}</p>}
                  </div>
                </div>
                {/* RA / Dec / Magnitude */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">RA</label>
                    <input type="text" value={formData.ra} onChange={e => setFormData({ ...formData, ra: e.target.value })} placeholder="Right Asc." className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">DEC</label>
                    <input type="text" value={formData.dec} onChange={e => setFormData({ ...formData, dec: e.target.value })} placeholder="Declination" className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Magnitude</label>
                    <input type="text" value={formData.magnitude} onChange={e => setFormData({ ...formData, magnitude: e.target.value })} placeholder="e.g. 5.6" className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input" />
                  </div>
                </div>
                {/* Distance */}
                <div>
                  <label className="block text-sm font-medium mb-1">Distance</label>
                  <div className="flex gap-2">
                    <input type="text" value={formData.distance} onChange={e => setFormData({ ...formData, distance: e.target.value })} placeholder="Distance value" className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 ios-input" />
                    <select value={formData.distanceUnit} onChange={e => setFormData({ ...formData, distanceUnit: e.target.value })} className="p-2 bg-gray-700 rounded border border-gray-600 ios-input">
                      <option value="ly">Light Years</option>
                      <option value="Mly">Million ly</option>
                      <option value="pc">Parsecs</option>
                      <option value="AU">AU</option>
                      <option value="km">km</option>
                    </select>
                  </div>
                </div>
                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-1">Notes / Description</label>
                  <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input" rows={3} placeholder="What did you see? Colors, detail, conditions..." />
                </div>
                {/* Image URL */}
                <div>
                  <label className="block text-sm font-medium mb-1">Image URL (optional)</label>
                  <input type="text" value={formData.image.startsWith('data:') ? '' : formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input" placeholder="Paste a URL from iCloud, Dropbox, etc." />
                </div>
                {/* Upload */}
                <div>
                  <label className="block text-sm font-medium mb-1">Upload Image (stored locally, no account needed)</label>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full p-2 bg-gray-700 rounded border border-gray-600 ios-input" />
                </div>
                {formData.image && (
                  <div className="relative">
                    <img src={formData.image} alt="Preview" className="w-full h-32 object-cover rounded" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    <button type="button" onClick={() => setFormData({ ...formData, image: '' })} className="absolute top-1 right-1 bg-red-700 rounded-full p-0.5"><X size={14} /></button>
                  </div>
                )}
                {/* Favorite */}
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="fav" checked={formData.favorite} onChange={e => setFormData({ ...formData, favorite: e.target.checked })} className="rounded" />
                  <label htmlFor="fav" className="text-sm">Mark as Favorite ⭐</label>
                </div>
                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded flex items-center justify-center gap-2"><Save size={16} /> Save</button>
                  <button type="button" onClick={() => { setShowAddForm(false); setEditObservationId(null); }} className="flex-1 bg-gray-600 hover:bg-gray-700 py-2 rounded">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Detail Modal ─────────────────────────────────────────────── */}
        {showDetailModal && selectedObservation && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative">
              <button onClick={() => setShowDetailModal(false)} className="absolute top-3 right-3 text-gray-400 hover:text-white"><X size={22} /></button>
              <div className="space-y-2 pr-6">
                <h2 className="font-bold text-xl text-blue-400">{selectedObservation.name}</h2>
                {selectedObservation.image && (
                  <img src={selectedObservation.image} alt={selectedObservation.name} className="w-full h-48 object-cover rounded cursor-pointer hover:opacity-80" onClick={() => handleImageClick(selectedObservation.image)} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                )}
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-gray-400">Type:</span><span className="capitalize">{selectedObservation.type}</span>
                  <span className="text-gray-400">Date:</span><span>{selectedObservation.date}</span>
                  {selectedObservation.location && <><span className="text-gray-400">Location:</span><span>{selectedObservation.location}</span></>}
                  {selectedObservation.equipment && <><span className="text-gray-400">Telescope:</span><span>{selectedObservation.equipment}</span></>}
                  {selectedObservation.eyepiece && <><span className="text-gray-400">Eyepiece:</span><span>{selectedObservation.eyepiece}</span></>}
                  {selectedObservation.seeing && <><span className="text-gray-400">Seeing:</span><span className="text-yellow-400">{starsDisplay(selectedObservation.seeing)} ({seeingLabel(selectedObservation.seeing)})</span></>}
                  {selectedObservation.transparency && <><span className="text-gray-400">Transparency:</span><span className="text-blue-400">{starsDisplay(selectedObservation.transparency)} ({transparencyLabel(selectedObservation.transparency)})</span></>}
                  {selectedObservation.magnitude && <><span className="text-gray-400">Magnitude:</span><span>{selectedObservation.magnitude}</span></>}
                  {selectedObservation.ra && <><span className="text-gray-400">RA / Dec:</span><span>{selectedObservation.ra} / {selectedObservation.dec}</span></>}
                  {selectedObservation.distance && <><span className="text-gray-400">Distance:</span><span>{selectedObservation.distance} {selectedObservation.distanceUnit}</span></>}
                </div>
                {selectedObservation.description && <p className="text-sm text-gray-300 border-t border-gray-700 pt-2 mt-2">{selectedObservation.description}</p>}
                {selectedObservation.favorite && <p className="text-yellow-400">⭐ Favorite</p>}
                <div className="flex gap-2 flex-wrap mt-3">
                  <a href={simbadUrl(selectedObservation.name)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">SIMBAD</a>
                  <span className="text-gray-600">·</span>
                  <a href={wikipediaUrl(selectedObservation.name)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">Wikipedia</a>
                </div>
                <div className="flex gap-2 pt-2">
                  <button className="flex-1 bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded flex items-center justify-center gap-1 text-sm" onClick={() => { setEditObservationId(selectedObservation.id); setShowDetailModal(false); }}><Edit size={14} /> Edit</button>
                  <button className="flex-1 bg-red-700 hover:bg-red-600 px-3 py-2 rounded flex items-center justify-center gap-1 text-sm" onClick={() => { if (window.confirm('Delete this observation?')) { setObservations(obs => obs.filter(o => o.id !== selectedObservation.id)); setShowDetailModal(false); } }}><Trash2 size={14} /> Delete</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Notifications ────────────────────────────────────────────── */}
        {showSuccess && (
          <div className={`fixed right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 ${isMobile ? 'bottom-20' : 'bottom-4'}`}>
            ✅ Observation saved successfully
          </div>
        )}
        {notification && (
          <div className={`fixed right-4 px-4 py-2 rounded-lg shadow-lg text-white z-50 ${isMobile ? 'bottom-24' : 'bottom-16'} ${notification.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
            {notification.type === 'error' ? '⚠️' : '✅'} {notification.message}
          </div>
        )}

        {/* ── Mobile Bottom Navigation Bar ──────────────────────────────── */}
        {isMobile && (
          <>
            {/* "More" overlay menu */}
            {showMoreMenu && (
              <div
                className="fixed inset-0 z-40"
                style={{ background: 'rgba(0,0,0,0.6)' }}
                onClick={() => setShowMoreMenu(false)}
              >
                <div
                  className="absolute bottom-16 left-0 right-0 bg-gray-800 border-t border-gray-600 p-4"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="grid grid-cols-3 gap-3">
                    {moreTabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setShowMoreMenu(false); }}
                        className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-center transition-colors ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                      >
                        <span className="text-2xl">{tab.icon}</span>
                        <span className="text-xs font-medium">{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom tab bar */}
            <nav
              className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-700"
              style={{ background: '#1a1a2e', paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex justify-around items-center">
                {tabs.filter(t => primaryTabs.includes(t.id)).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setShowMoreMenu(false); }}
                    className={`flex flex-col items-center gap-0.5 py-2 px-3 min-w-0 flex-1 transition-colors ${activeTab === tab.id ? 'text-blue-400' : 'text-gray-400'}`}
                  >
                    <span className="text-xl">{tab.icon}</span>
                    <span className="text-xs truncate w-full text-center">{tab.label}</span>
                  </button>
                ))}
                {/* "More" button */}
                <button
                  onClick={() => setShowMoreMenu(m => !m)}
                  className={`flex flex-col items-center gap-0.5 py-2 px-3 min-w-0 flex-1 transition-colors ${moreTabs.some(t => t.id === activeTab) ? 'text-blue-400' : 'text-gray-400'}`}
                >
                  <span className="text-xl">
                    {moreTabs.find(t => t.id === activeTab)?.icon ?? '⋯'}
                  </span>
                  <span className="text-xs">
                    {moreTabs.find(t => t.id === activeTab)?.label ?? 'More'}
                  </span>
                </button>
              </div>
            </nav>

            {/* Spacer so content isn't hidden behind bottom nav */}
            <div style={{ height: 64 }} />
          </>
        )}
      </div>
    </div>
  );
};

export default AstroObservationApp;
