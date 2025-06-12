import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Search, Plus, Star, Filter, Settings, Download, Upload, Save, X, Eye, Moon, Sun, Edit } from 'lucide-react';
import { Body, Observer, Equator, Horizon, MoonPhase } from "astronomy-engine";
import EventList from "./components/EventList";
import eventsData from "./data/events.json";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

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

// Types for observations and celestial objects
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
}

type EventType = {
  id: string;
  name: string;
  date: string;
  description: string;
  imageName: string;
};

const fetchBortleClass = async (lat: number, lon: number): Promise<string> => {
  try {
    const url = `https://www.lightpollutionmap.info/QueryRaster/?ql=wa_2015&x=${lon}&y=${lat}&z=8`;
    const res = await fetch(url);
    const data = await res.json();
    console.log("Bortle API response:", data); // <-- Add this line
    const sqm = data.value;
    if (typeof sqm !== "number") return "Unknown";
    if (sqm >= 21.99) return "Class 1: Excellent dark-sky site";
    if (sqm >= 21.89) return "Class 2: Typical truly dark site";
    if (sqm >= 21.69) return "Class 3: Rural sky";
    if (sqm >= 21.25) return "Class 4: Rural/suburban transition";
    if (sqm >= 20.49) return "Class 5: Suburban sky";
    if (sqm >= 19.50) return "Class 6: Bright suburban sky";
    if (sqm >= 18.94) return "Class 7: Suburban/urban transition";
    if (sqm >= 18.38) return "Class 8: City sky";
    return "Class 9: Inner-city sky";
  } catch {
    return "Unknown";
  }
};

const nominatimBase = 'https://nominatim.openstreetmap.org';

const uploadToImgur = async (file: File) => {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("https://api.imgur.com/3/image", {
    method: "POST",
    headers: {
      Authorization: "Client-ID 1279890457abbbf"
    },
    body: formData
  });

  const data = await response.json();
  if (data.success) {
    return data.data.link; // This is the public URL
  } else {
    throw new Error("Imgur upload failed");
  }
};

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
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedObservation, setSelectedObservation] = useState<Observation | null>(null);
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<number | null>(null);
  const [bortleClass, setBortleClass] = useState<string>('Loading...');
  const [showSkyChart, setShowSkyChart] = useState(false);
  const [redFilter, setRedFilter] = useState(false);
  const [moonInfo, setMoonInfo] = useState<{altitude: number, phase: number, illumination: number} | null>(null);
  const [visiblePlanets, setVisiblePlanets] = useState<CelestialObject[]>([]);
  const [visibleStars, setVisibleStars] = useState<CelestialObject[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [visibleObjectsNow, setVisibleObjectsNow] = useState<any[]>([]);
  const [searchText, setSearchText] = useState("");
  const [events, setEvents] = useState<EventType[]>([]);

  // Exemplo de exoplanetas famosos
  const exoplanets = [
    { name: "51 Pegasi b", type: "exoplanet", ra: 344.366, dec: 20.768 },
    { name: "HD 209458 b", type: "exoplanet", ra: 330.794, dec: 18.884 },
    // ...adicione mais se quiser
  ];

  // Exemplo de deep sky objects (Messier)
  const deepSkyObjects = [
    { name: "M31 (Andromeda Galaxy)", type: "galaxy", ra: 10.6847, dec: 41.2692 },
    { name: "M42 (Orion Nebula)", type: "nebula", ra: 83.8221, dec: -5.3911 },
    { name: "M13 (Hercules Cluster)", type: "cluster", ra: 250.423, dec: 36.461 },
    // ...adicione mais Messier/NGC
  ];

  // Sample celestial objects with visibility data
  // const celestialObjects: CelestialObject[] = [ ... ];
  // const [visibleObjects, setVisibleObjects] = useState<CelestialObject[]>([]);
  // const calculateVisibleObjects = () => { ... };
  // useEffect(() => { calculateVisibleObjects(); }, [currentTime, userLocation]);

  // Form state
  const [formData, setFormData] = useState<Omit<Observation, 'id' | 'dateAdded'>>({
    name: '',
    type: 'star',
    date: new Date().toISOString().split('T')[0],
    location: '',
    ra: '',
    dec: '',
    magnitude: '',
    distance: '',
    distanceUnit: 'ly',
    description: '',
    favorite: false,
    image: ''
  });

  // Update current time every minute
  // useEffect(() => {
  //   const timer = setInterval(() => {
  //     setCurrentTime(new Date());
  //   }, 60000);
  //   return () => clearInterval(timer);
  // }, []);

  // Calculate moon phase (simplified)
  useEffect(() => {
    const calculateMoonPhase = () => {
      const now = new Date(currentTime);
      const daysSinceNewMoon = ((now.getTime() - new Date('2024-01-11').getTime()) / (1000 * 60 * 60 * 24)) % 29.53;
      const phase = daysSinceNewMoon;
      let phaseName = '';
      if (phase < 1) phaseName = 'New Moon';
      else if (phase < 7.4) phaseName = 'Waxing Crescent';
      else if (phase < 8.4) phaseName = 'First Quarter';
      else if (phase < 14.8) phaseName = 'Waxing Gibbous';
      else if (phase < 15.8) phaseName = 'Full Moon';
      else if (phase < 22.1) phaseName = 'Waning Gibbous';
      else if (phase < 23.1) phaseName = 'Last Quarter';
      else phaseName = 'Waning Crescent';
      const illumination = Math.abs(Math.cos((phase / 29.53) * 2 * Math.PI)) * 100;
      setMoonPhase({ phase: phaseName, illumination: Math.round(illumination) });
    };
    calculateMoonPhase();
  }, [currentTime]);

  // Fetch Bortle class for user location
  useEffect(() => {
    fetchBortleClass(userLocation.lat, userLocation.lng).then(setBortleClass);
  }, [userLocation]);

  // Reverse geocode when userLocation changes
  useEffect(() => {
    fetch(`${nominatimBase}/reverse?lat=${userLocation.lat}&lon=${userLocation.lng}&format=json`)
      .then(res => res.json())
      .then(data => {
        if (data && data.display_name) setPlaceName(data.display_name);
      })
      .catch(() => setPlaceName('Unknown location'));
  }, [userLocation]);

  const getCurrentSeason = () => {
    const month = currentTime.getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  };

  // Handler for geolocation button
  const getLocationData = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Location access denied');
        }
      );
    }
  };

  // Geocode place name
  const handlePlaceInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaceInput(e.target.value);
    if (e.target.value.length > 2) {
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(e.target.value)}&format=json&limit=5`)
        .then(res => res.json())
        .then(data => setLocationSuggestions(data));
    } else {
      setLocationSuggestions([]);
    }
  };

  // Add or edit observation
  const handleAddObservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter an object name');
      return;
    }
    if (editObservationId !== null) {
      // Edit mode
      setObservations(obs =>
        obs.map(o =>
          o.id === editObservationId
            ? { ...o, ...formData }
            : o
        )
      );
      setEditObservationId(null);
    } else {
      // Add mode
      const newObservation: Observation = {
        id: Date.now(),
        ...formData,
        dateAdded: new Date().toISOString()
      };
      setObservations([...observations, newObservation]);
    }
    setFormData({
      name: '',
      type: 'star',
      date: new Date().toISOString().split('T')[0],
      location: '',
      ra: '',
      dec: '',
      magnitude: '',
      distance: '',
      distanceUnit: 'ly',
      description: '',
      favorite: false,
      image: ''
    });
    setShowAddForm(false);
    setShowSuccess(true);
    setActiveTab('objects'); // Switch to objects tab after add/edit
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      try {
        const imgurUrl = await uploadToImgur(file);
        setFormData({ ...formData, image: imgurUrl });
      } catch (err) {
        if (err instanceof Error) {
          alert("Image upload failed: " + err.message);
        } else {
          alert("Image upload failed.");
        }
      }
    }
  };

  const handleImageClick = (img: string) => {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Observation Image</title>
            <style>
              body { background: #000; margin: 0; display: flex; flex-direction: column; align-items: center; }
              .close-btn {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #222;
                color: #fff;
                border: none;
                border-radius: 8px;
                padding: 10px 20px;
                font-size: 18px;
                cursor: pointer;
                z-index: 1000;
                opacity: 0.8;
              }
              .close-btn:hover { opacity: 1; }
              img { max-width: 100vw; max-height: 100vh; display: block; margin: auto; }
            </style>
          </head>
          <body>
            <button class="close-btn" onclick="window.close()">Close ✕</button>
            <img src="${img}" alt="Observation" />
          </body>
        </html>
      `);
      win.document.title = "Observation Image";
    }
  };

  const navigateCalendar = (direction: string) => {
    const newDate = new Date(calendarDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCalendarDate(newDate);
    setCalendarSelectedDay(null);
  };

  // Fix: days array should be (number|null)[]
  const getDaysInMonth = (date: Date): (number | null)[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days: (number | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  };

  const exportObservations = () => {
    const dataStr = JSON.stringify(observations, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `astro-observations-${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Import observations from JSON file
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          if (Array.isArray(imported)) {
            setObservations(imported);
          } else {
            alert('Invalid file format.');
          }
        } catch {
          alert('Could not import file.');
        }
      };
      reader.readAsText(file);
    }
  };

  const filteredObservations = observations.filter((obs) => {
    const typeMatch = filterType === 'all' || obs.type === filterType;
    const favoriteMatch = !showFavorites || obs.favorite;
    return typeMatch && favoriteMatch;
  });

  // Calendar: get observations for a given day
  const getObservationsForDay = (date: Date, day: number) => {
    const yyyy = date.getFullYear();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = day.toString().padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    return observations.filter(obs => obs.date === dateStr);
  };

  // When editing, pre-fill the form
  useEffect(() => {
    if (editObservationId !== null) {
      const obs = observations.find(o => o.id === editObservationId);
      if (obs) {
        setFormData({ ...obs });
        setShowAddForm(true);
      }
    }
    // eslint-disable-next-line
  }, [editObservationId]);

  const planetNames = [
    "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"
  ];

  function getVisiblePlanets(lat: number, lon: number, date: Date): CelestialObject[] {
    const observer = new Observer(lat, lon, 0);
    return planetNames.map(name => {
      const body = Body[name as keyof typeof Body];
      const eq = Equator(body, date, observer, true, true);
      const hor = Horizon(date, observer, eq.ra, eq.dec, "normal");
      return {
        name,
        type: "planet",
        magnitude: 0,
        constellation: "",
        ra: eq.ra.toString(),
        dec: eq.dec.toString(),
        season: "",
        bestTime: ""
      };
    });
  }

  // Example bright stars (add more as needed)
  const brightStars = [
    { name: "Sirius", ra: 6.752, dec: -16.716 },
    { name: "Vega", ra: 18.615, dec: 38.783 },
    // ... more stars ...
  ];

  function getVisibleBrightStars(lat: number, lon: number, date: Date): CelestialObject[] {
    const observer = new Observer(lat, lon, 0);
    return brightStars.map(star => {
      const ra = star.ra * 15;
      const dec = star.dec;
      const hor = Horizon(date, observer, ra, dec, "normal");
      return {
        name: star.name,
        type: "star",
        magnitude: 0,
        constellation: "",
        ra: ra.toString(),
        dec: dec.toString(),
        season: "",
        bestTime: ""
      };
    });
  }

  useEffect(() => {
    if (userLocation.lat && userLocation.lng) {
      const now = new Date();
      setVisiblePlanets(getVisiblePlanets(userLocation.lat, userLocation.lng, now));
      setVisibleStars(getVisibleBrightStars(userLocation.lat, userLocation.lng, now));
    }
  }, [userLocation, currentTime]);

  function simbadUrl(name: string) {
    return `http://simbad.u-strasbg.fr/simbad/sim-basic?Ident=${encodeURIComponent(name)}`;
  }
  function wikipediaUrl(name: string) {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, "_"))}`;
  }
  function nasaExoplanetUrl(name: string) {
    return `https://exoplanetarchive.ipac.caltech.edu/cgi-bin/DisplayOverview/nph-DisplayOverview?objname=${encodeURIComponent(name)}`;
  }
  function jplSsdUrl(name: string) {
    return `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(name)}`;
  }

  // Adicionar Messier/NGC (deep sky) ao dropdown e à lista de objetos visíveis
  const visibleMessierObjects = deepSkyObjects
    .filter(obj => isObjectVisible(obj.ra, obj.dec, userLocation.lat, userLocation.lng, currentTime))
    .map(obj => ({
      name: obj.name,
      type: obj.type,
      magnitude: 0,
      constellation: '',
      ra: obj.ra.toString(),
      dec: obj.dec.toString(),
      season: '',
      bestTime: '',
      displayType: 'Messier'
    }));

  // Atualizar allObjects para incluir Messier
  const allObjects: CelestialObject[] = [
    ...visiblePlanets,
    ...visibleStars,
    ...visibleMessierObjects
  ];

  // Função para calcular objetos visíveis em um dado horário
  function getVisibleObjectsAtHour(lat: number, lon: number, baseDate: Date, hour: number) {
    const date = new Date(baseDate);
    date.setHours(hour, 0, 0, 0);
    const planets = getVisiblePlanets(lat, lon, date);
    const stars = getVisibleBrightStars(lat, lon, date);

    // Deep sky
    const deepSky = deepSkyObjects.filter(obj =>
      isObjectVisible(obj.ra, obj.dec, lat, lon, date)
    );

    // Exoplanetas
    const exos = exoplanets.filter(obj =>
      isObjectVisible(obj.ra, obj.dec, lat, lon, date)
    );

    return planets.length + stars.length + deepSky.length + exos.length;
  }

  function isObjectVisible(ra: number, dec: number, lat: number, lon: number, date: Date) {
    const observer = new Observer(lat, lon, 0);
    // RA em horas para graus: se necessário, divida por 15
    const hor = Horizon(date, observer, ra, dec, "normal");
    return hor.altitude > 0;
  }

  // Atualizar visibleObjectsNow para incluir Messier
  useEffect(() => {
    setVisibleObjectsNow(getAllVisibleObjects(userLocation.lat, userLocation.lng, currentTime));
  }, [userLocation, currentTime]);

  // Atualizar getAllVisibleObjects para incluir Messier
  function getAllVisibleObjects(lat: number, lon: number, date: Date) {
    // Planetas
    const planets = getVisiblePlanets(lat, lon, date).map(obj => ({
      ...obj,
      displayType: "Planet"
    }));

    // Estrelas brilhantes
    const stars = getVisibleBrightStars(lat, lon, date).map(obj => ({
      ...obj,
      displayType: "Star"
    }));

    // Messier/NGC (deep sky)
    const messier = deepSkyObjects
      .filter(obj => isObjectVisible(obj.ra, obj.dec, lat, lon, date))
      .map(obj => ({
        ...obj,
        displayType: "Messier"
      }));

    // Exoplanetas
    const exos = exoplanets
      .filter(obj => isObjectVisible(obj.ra, obj.dec, lat, lon, date))
      .map(obj => ({
        ...obj,
        displayType: "Exoplanet"
      }));

    // Sol
    const observer = new Observer(lat, lon, 0);
    const sunEq = Equator(Body.Sun, date, observer, true, true);
    const sunHor = Horizon(date, observer, sunEq.ra, sunEq.dec, "normal");
    const sunVisible = sunHor.altitude > 0;
    const sunObj = sunVisible
      ? [{ name: "Sun", type: "sun", ra: sunEq.ra.toString(), dec: sunEq.dec.toString(), displayType: "Sun" }]
      : [];

    // Lua
    const moonEq = Equator(Body.Moon, date, observer, true, true);
    const moonHor = Horizon(date, observer, moonEq.ra, moonEq.dec, "normal");
    const moonVisible = moonHor.altitude > 0;
    const moonObj = moonVisible
      ? [{ name: "Moon", type: "moon", ra: moonEq.ra.toString(), dec: moonEq.dec.toString(), displayType: "Moon" }]
      : [];

    // Junte tudo
    return [...sunObj, ...moonObj, ...planets, ...stars, ...messier, ...exos];
  }

  // Carregar ao iniciar
  useEffect(() => {
    const saved = localStorage.getItem("observations");
    if (saved) setObservations(JSON.parse(saved));
  }, []);

  // Salvar sempre que mudar
  useEffect(() => {
    localStorage.setItem("observations", JSON.stringify(observations));
  }, [observations]);

  useEffect(() => {
    setEvents(eventsData);
  }, []);

  const filteredEvents = events.filter(event =>
    event.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // Adicionar useEffect para detectar iOS
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) {
      document.body.classList.add('ios-device');
    }
  }, []);

  // --- UI rendering below ---
  return (
    <div style={{ position: 'relative' }}>
      {redFilter && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(255,0,0,0.25)', pointerEvents: 'none', zIndex: 9999
        }} />
      )}
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gray-800 p-4 shadow-lg" style={{ paddingLeft: '10px', paddingRight: '10px' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">🔭</div>
              <h1 className="text-2xl font-bold">AstroLog</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setRedFilter(r => !r)}
                className={`px-4 py-2 rounded ${redFilter ? 'bg-red-700 text-white' : 'bg-gray-700 text-red-300'} font-bold`}
                title="Toggle red filter for night vision"
              >
                {redFilter ? 'Red Filter: ON' : 'Red Filter: OFF'}
              </button>
              <button
                onClick={() => { setShowAddForm(true); setEditObservationId(null); }}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Plus size={20} />
                <span>Add</span>
              </button>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-gray-800 border-t border-gray-700" style={{ paddingLeft: '10px', paddingRight: '10px' }}>
          <div className="flex space-x-8">
            {[
              { id: 'home', label: 'Home', icon: '🏠' },
              { id: 'objects', label: 'Objects', icon: '🌟' },
              { id: 'resources', label: 'Resources', icon: '📚' },
              { id: 'links', label: 'Useful Links', icon: '🔗' },
              { id: 'calendar', label: 'Calendar', icon: '📅' },
              { id: 'settings', label: 'Settings', icon: '⚙️' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-300 hover:text-gray-200'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <main className="w-full p-0 m-0" style={{ paddingLeft: '10px', paddingRight: '10px' }}>
          {/* Home Tab */}
          {activeTab === 'home' && (
            <div className="space-y-6">
              {/* What can I observe now section */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center">
                  <Eye className="mr-2" size={24} />
                  What can I observe now?
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Celestial Object:</label>
                    <select
                      value={selectedObject ? selectedObject.name : ""}
                      onChange={e => {
                        const name = e.target.value;
                        const found = allObjects.find(obj => obj.name === name) || null;
                        setSelectedObject(found);
                      }}
                      className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                    >
                      <option value="">Select object...</option>
                      {allObjects.map((obj: CelestialObject) => (
                        <option key={obj.name} value={obj.name}>{obj.name}</option>
                      ))}
                    </select>
                    {selectedObject && (
                      <div className="space-x-2 mt-2">
                        {/* Planets (Solar System) */}
                        {selectedObject.type === "planet" && (
                          <>
                            <a href={wikipediaUrl(selectedObject.name)} target="_blank" rel="noopener noreferrer">Wikipedia</a>
                            <a href={jplSsdUrl(selectedObject.name)} target="_blank" rel="noopener noreferrer">JPL SSD</a>
                            <a href={simbadUrl(selectedObject.name)} target="_blank" rel="noopener noreferrer">SIMBAD</a>
                          </>
                        )}

                        {/* Messier/NGC/Deep Sky Objects */}
                        {(selectedObject.type === "galaxy" ||
                          selectedObject.type === "nebula" ||
                          selectedObject.type === "cluster" ||
                          selectedObject.type === "deep_sky") && (
                          <>
                            <a href={wikipediaUrl(selectedObject.name)} target="_blank" rel="noopener noreferrer">Wikipedia</a>
                            <a href={simbadUrl(selectedObject.name)} target="_blank" rel="noopener noreferrer">SIMBAD</a>
                          </>
                        )}

                        {/* Exoplanets */}
                        {selectedObject.type === "exoplanet" && (
                          <>
                            <a href={wikipediaUrl(selectedObject.name)} target="_blank" rel="noopener noreferrer">Wikipedia</a>
                            <a href={nasaExoplanetUrl(selectedObject.name)} target="_blank" rel="noopener noreferrer">NASA Exoplanet Archive</a>
                            <a href={simbadUrl(selectedObject.name)} target="_blank" rel="noopener noreferrer">SIMBAD</a>
                          </>
                        )}

                        {/* Stars */}
                        {selectedObject.type === "star" && (
                          <>
                            <a href={wikipediaUrl(selectedObject.name)} target="_blank" rel="noopener noreferrer">Wikipedia</a>
                            <a href={simbadUrl(selectedObject.name)} target="_blank" rel="noopener noreferrer">SIMBAD</a>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Date & Time:</label>
                    <DatePicker
                      selected={currentTime}
                      onChange={(date: Date | null) => date && setCurrentTime(date)}
                      showTimeSelect
                      dateFormat="Pp"
                      className="w-44 p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Location:</label>
                    <div className="flex space-x-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={placeInput}
                          onChange={handlePlaceInput}
                          placeholder="Enter location"
                          className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 ios-input"
                        />
                        {locationSuggestions.length > 0 && (
                          <ul className="absolute left-0 right-0 bg-white text-black z-10">
                            {locationSuggestions.map(suggestion => (
                              <li
                                key={suggestion.place_id}
                                onClick={() => {
                                  setUserLocation({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) });
                                  setPlaceInput(suggestion.display_name);
                                  setLocationSuggestions([]);
                                }}
                                className="cursor-pointer hover:bg-gray-200 px-2 py-1"
                              >
                                {suggestion.display_name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <button
                        onClick={getLocationData}
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded"
                        title="Get current location"
                        type="button"
                      >
                        <MapPin size={16} />
                      </button>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{placeName}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Coordinates:</label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        value={userLocation.lat.toFixed(2)}
                        onChange={(e) => setUserLocation({ ...userLocation, lat: parseFloat(e.target.value) })}
                        className="w-24 p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                        step="0.01"
                      />
                      <input
                        type="number"
                        value={userLocation.lng.toFixed(2)}
                        onChange={(e) => setUserLocation({ ...userLocation, lng: parseFloat(e.target.value) })}
                        className="w-24 p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-2">
                    <a
                      href={`https://lightpollutionmap.app/?lat=${userLocation.lat.toFixed(5)}&lng=${userLocation.lng.toFixed(5)}&zoom=6`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 underline font-bold"
                    >
                      View Light Pollution Map (Bortle Scale)
                    </a>
                  </div>
                  <div className="mb-2">
                    <span className="font-bold">Sky Chart:</span>{' '}
                    <a
                      href={`https://stellarium-web.org/?lat=${userLocation.lat}&lon=${userLocation.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 underline"
                    >
                      View in Stellarium Web
                    </a>
                  </div>
                </div>
                <button
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded flex items-center space-x-2 mt-4"
                  onClick={() => setShowSkyChart(!showSkyChart)}
                  type="button"
                >
                  <Sun size={16} />
                  <span>{showSkyChart ? 'Hide' : 'Show'} Simple Visibility Chart</span>
                </button>
                {showSkyChart && (
                  <div className="mt-4">
                    <div className="font-bold mb-2">Visibilidade (próximas 6 horas):</div>
                    <div className="flex space-x-2">
                      {Array.from({ length: 6 }).map((_, i) => {
                        const hour = (currentTime.getHours() + i) % 24;
                        const count = getVisibleObjectsAtHour(userLocation.lat, userLocation.lng, currentTime, hour);
                        return (
                          <div key={i} className="flex flex-col items-center">
                            <div className="text-xs text-gray-400">{hour}:00</div>
                            <button
                              className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-700 mt-1 hover:bg-green-600"
                              onClick={() => {
                                const newTime = new Date(currentTime);
                                newTime.setHours(hour, 0, 0, 0);
                                setCurrentTime(newTime);
                              }}
                            >
                              {count}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Número de objetos visíveis por hora (planetas, estrelas, deep sky, exoplanetas)</div>
                  </div>
                )}
              </div>

              {/* Currently Visible Objects */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-bold mb-4">🌠 Objects</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleObjectsNow.length === 0 && (
                    <div className="text-gray-400">No objects are currently visible.</div>
                  )}
                  {visibleObjectsNow.map(obj => (
                    <div key={obj.name} className="bg-gray-700 p-4 rounded-lg">
                      <h4 className="font-bold text-blue-400">{obj.name}</h4>
                      <p className="text-sm text-gray-300">Type: {obj.displayType}</p>
                      {obj.ra && obj.dec && (
                        <p className="text-sm text-gray-300">RA: {obj.ra} | Dec: {obj.dec}</p>
                      )}
                      {/* Links: personalize conforme o tipo */}
                      <div className="space-x-2 mt-2">
                        <a href={wikipediaUrl(obj.name)} target="_blank" rel="noopener noreferrer">Wikipedia</a>
                        <a href={simbadUrl(obj.name)} target="_blank" rel="noopener noreferrer">SIMBAD</a>
                        {obj.type === "planet" && (
                          <a href={jplSsdUrl(obj.name)} target="_blank" rel="noopener noreferrer">JPL SSD</a>
                        )}
                        {obj.type === "exoplanet" && (
                          <a href={nasaExoplanetUrl(obj.name)} target="_blank" rel="noopener noreferrer">NASA Exoplanet Archive</a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Moon Phase */}
              <div className="bg-gray-800 rounded-lg p-6" style={{ minHeight: '340px', overflow: 'visible' }}>
                <h3 className="text-lg font-bold mb-4 flex items-center">
                  <span className="mr-2">🌙</span>
                  Moon Today
                </h3>
                <iframe
                  title="Moon Giant Phase"
                  src="https://www.moongiant.com/phase/today/"
                  width="300"
                  height="450"
                  frameBorder="0"
                  scrolling="no"
                  style={{ background: "transparent" }}
                ></iframe>
                <div className="text-xs text-gray-400 mt-2">
                  Fonte: <a href="https://www.moongiant.com/phase/today/" target="_blank" rel="noopener">MoonGiant.com</a>
                </div>
              </div>
            </div>
          )}

          {/* Objects Tab */}
          {activeTab === 'objects' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">My Observations</h2>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setShowFavorites(!showFavorites)}
                    className={`px-4 py-2 rounded ${showFavorites ? 'bg-yellow-600' : 'bg-gray-600'}`}
                  >
                    <Star size={16} className="inline mr-2" />
                    Favorites
                  </button>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="p-2 bg-gray-700 rounded border border-gray-600"
                  >
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
                  <div
                    key={obs.id}
                    className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-blue-400"
                    onClick={() => { setSelectedObservation(obs); setShowDetailModal(true); }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-lg text-blue-400">{obs.name}</h3>
                      {obs.favorite && <Star className="text-yellow-400 fill-current" size={20} />}
                    </div>
                    {obs.image && (
                      <div className="mb-3">
                        <img
                          src={obs.image}
                          alt={obs.name}
                          className="w-full h-32 object-cover rounded-lg hover:opacity-80 cursor-pointer"
                          onClick={() => handleImageClick(obs.image)}
                        />
                      </div>
                    )}
                    <p className="text-sm text-gray-300 mb-1">Type: {obs.type}</p>
                    <p className="text-sm text-gray-300 mb-1">Date: {obs.date}</p>
                    <p className="text-sm text-gray-300 mb-1">Location: {obs.location}</p>
                    {obs.magnitude && <p className="text-sm text-gray-300 mb-1">Magnitude: {obs.magnitude}</p>}
                    {obs.ra && <p className="text-sm text-gray-300 mb-1">RA: {obs.ra} | Dec: {obs.dec}</p>}
                    {obs.distance && <p className="text-sm text-gray-300 mb-1">Distance: {obs.distance} {obs.distanceUnit}</p>}
                    {obs.description && <p className="text-sm text-gray-400 mt-2">{obs.description}</p>}
                    <div>
                      <a href={simbadUrl(obs.name)} target="_blank" rel="noopener noreferrer">SIMBAD</a> |{" "}
                      <a href={wikipediaUrl(obs.name)} target="_blank" rel="noopener noreferrer">Wikipedia</a>
                      {/* For exoplanets: */}
                      {obs.type === "exoplanet" && (
                        <> | <a href={nasaExoplanetUrl(obs.name)} target="_blank" rel="noopener noreferrer">NASA Exoplanet Archive</a></>
                      )}
                      {/* For solar system objects: */}
                      {obs.type === "planet" && (
                        <> | <a href={jplSsdUrl(obs.name)} target="_blank" rel="noopener noreferrer">JPL SSD</a></>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {filteredObservations.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔭</div>
                  <h3 className="text-xl font-bold mb-2">No observations yet</h3>
                  <p className="text-gray-400 mb-4">Start logging your astronomical observations!</p>
                  <button
                    onClick={() => { setShowAddForm(true); setEditObservationId(null); }}
                    className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg"
                  >
                    Add First Observation
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Resources Tab */}
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
                  </ul>
                </div>
              </div>
              <div className="meteoblue-widgets flex flex-wrap gap-4 mt-8">
                <div className="max-w-[480px] flex-shrink-0" style={{ width: 480 }}>
                  <iframe
                    title="Previsão do tempo meteoblue"
                    src="https://www.meteoblue.com/pt/tempo/widget/three?geoloc=detect&nocurrent=0&noforecast=0&days=4&tempunit=CELSIUS&windunit=KILOMETER_PER_HOUR&layout=image"
                    frameBorder="0" scrolling="no" allowTransparency={true}
                    sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
                    className="w-full"
                    style={{ height: 590 }}
                  ></iframe>
                  <div>
                    <a href="https://www.meteoblue.com/pt/tempo/semana/index?utm_source=three_widget&utm_medium=linkus&utm_content=three&utm_campaign=Weather%2BWidget"
                       target="_blank" rel="noopener">meteoblue</a>
                  </div>
                </div>
                <div className="max-w-[540px] flex-shrink-0" style={{ width: 540 }}>
                  <iframe
                    title="Observação meteoblue"
                    src="https://www.meteoblue.com/pt/tempo/widget/seeing?geoloc=detect&noground=0"
                    frameBorder="0" scrolling="no" allowTransparency={true}
                    sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
                    className="w-full"
                    style={{ height: 775 }}
                  ></iframe>
                  <div>
                    <a href="https://www.meteoblue.com/pt/tempo/previsao/seeing?utm_source=seeing_widget&utm_medium=linkus&utm_content=seeing&utm_campaign=Weather%2BWidget"
                       target="_blank" rel="noopener">meteoblue</a>
                  </div>
                </div>
                <div className="max-w-[520px] flex-shrink-0" style={{ width: 520 }}>
                  <iframe
                    title="Mapa meteoblue"
                    src="https://www.meteoblue.com/pt/tempo/mapas/widget?windAnimation=1&gust=1&satellite=1&cloudsAndPrecipitation=1&temperature=1&sunshine=1&extremeForecastIndex=1&geoloc=detect&tempunit=C&windunit=km%252Fh&lengthunit=metric&zoom=5&autowidth=manu"
                    frameBorder="0" scrolling="no" allowTransparency={true}
                    sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
                    className="w-full"
                    style={{ height: 720 }}
                  ></iframe>
                  <div>
                    <a href="https://www.meteoblue.com/pt/tempo/mapas/index?utm_source=map_widget&utm_medium=linkus&utm_content=map&utm_campaign=Weather%2BWidget"
                       target="_blank" rel="noopener">meteoblue</a>
                  </div>
                </div>
              </div>
              {/* Clear Outside widget */}
              <div className="mt-8">
                {userLocation && (
                  <div className="bg-gray-800 rounded-lg p-4">
                    <h3 className="text-lg font-bold mb-4">Clear Outside Forecast</h3>
                    <a 
                      href={`https://clearoutside.com/forecast/${userLocation.lat.toFixed(2)}/${userLocation.lng.toFixed(2)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img 
                        src={`https://clearoutside.com/forecast_image_large/${userLocation.lat.toFixed(2)}/${userLocation.lng.toFixed(2)}/forecast.png`}
                        alt="Clear Outside Forecast"
                        style={{ width: '100%', maxWidth: 800 }}
                      />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Links Tab */}
          {activeTab === 'links' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Useful Links</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">Space Agencies</h3>
                  <ul className="space-y-2">
                    <li><a href="https://www.nasa.gov" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">NASA</a></li>
                    <li><a href="https://www.esa.int" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">ESA</a></li>
                    <li><a href="https://www.seti.org" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">SETI</a></li>
                    <li><a href="https://www.cnsa.gov.cn" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">CNSA</a></li>
                    <li><a href="https://www.gov.br/aeb/pt-br" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">AEB</a></li>
                    <li><a href="https://ptspace.pt/pt/home/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">AEP (Portugal)</a></li>
                    <li><a href="https://www.asc-csa.gc.ca" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">CSA</a></li>
                    <li><a href="https://www.isro.gov.in" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">ISRO</a></li>
                  </ul>
                </div>
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">Commercial Space</h3>
                  <ul className="space-y-2">
                    <li><a href="https://www.spacex.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">SpaceX</a></li>
                    <li><a href="https://www.arianespace.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Ariane</a></li>
                    <li><a href="https://www.blueorigin.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Blue Origin</a></li>
                  </ul>
                </div>
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">Astronomical Societies</h3>
                  <ul className="space-y-2">
                    <li><a href="https://a4e.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Astronomers for Planet Earth</a></li>
                    <li><a href="https://astronomerswithoutborders.org/home" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Astronomers Without Borders</a></li>
                    <li><a href="https://www.iau.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">International Astronomical Union</a></li>
                    <li><a href="https://www.imo.net/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">International Meteor Organization</a></li>
                    <li><a href="https://www.planetary.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">The Planetary Society</a></li>
                    <li><a href="https://eas.unige.ch/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">European Astronomical Society</a></li>
                    <li><a href="https://www.eaae-astronomy.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">European Association for Astronomy Education</a></li>
                    <li><a href="https://en.wikipedia.org/wiki/List_of_astronomical_societies" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Wiki List of astronomical societies</a></li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Calendar Tab */}
          {activeTab === 'calendar' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Astronomical Calendar</h2>
              <div className="flex flex-col lg:flex-row gap-8 w-full">
                <div className="bg-gray-800 rounded-lg p-6 flex-1 min-w-[320px]" style={{ maxWidth: 500, width: '100%' }}>
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => navigateCalendar('prev')}
                      className="text-2xl hover:text-blue-400 p-2 rounded hover:bg-gray-700"
                    >
                      ←
                    </button>
                    <h3 className="text-xl font-bold">
                      {calendarDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button
                      onClick={() => navigateCalendar('next')}
                      className="text-2xl hover:text-blue-400 p-2 rounded hover:bg-gray-700"
                    >
                      →
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center font-bold p-2 text-gray-400">
                        {day}
                      </div>
                    ))}
                    {getDaysInMonth(calendarDate).map((day, index) => {
                      const isToday = day === new Date().getDate() &&
                        calendarDate.getMonth() === new Date().getMonth() &&
                        calendarDate.getFullYear() === new Date().getFullYear();
                      const hasObs = day && getObservationsForDay(calendarDate, day).length > 0;
                      return (
                        <div
                          key={index}
                          className={`text-center p-2 rounded cursor-pointer min-h-[40px] flex items-center justify-center ${
                            day ? 'hover:bg-gray-700' : ''
                          } ${
                            isToday ? 'bg-blue-600 text-white' : ''
                          } ${
                            hasObs ? 'ring-2 ring-green-400' : ''
                          } ${
                            calendarSelectedDay === day ? 'bg-green-700 text-white' : ''
                          }`}
                          onClick={() => day && setCalendarSelectedDay(day)}
                        >
                          {day || ''}
                        </div>
                      );
                    })}
                  </div>
                  {/* Show observations for selected day */}
                  {calendarSelectedDay && (
                    <div className="mt-6">
                      <h4 className="font-bold mb-2">Observations for {calendarDate.getFullYear()}-{(calendarDate.getMonth() + 1).toString().padStart(2, '0')}-{calendarSelectedDay.toString().padStart(2, '0')}</h4>
                      {getObservationsForDay(calendarDate, calendarSelectedDay).length === 0 ? (
                        <div className="text-gray-400">No observations for this day.</div>
                      ) : (
                        <ul className="space-y-2">
                          {getObservationsForDay(calendarDate, calendarSelectedDay).map(obs => (
                            <li
                              key={obs.id}
                              className="bg-gray-700 p-3 rounded cursor-pointer hover:ring-2 hover:ring-blue-400"
                              onClick={() => { setSelectedObservation(obs); setShowDetailModal(true); }}
                            >
                              <span className="font-bold text-blue-300">{obs.name}</span> ({obs.type})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <div className="w-full max-w-[500px] max-h-[700px] overflow-y-auto bg-[#181c23] rounded-xl p-4 flex-shrink-0">
                  <EventList events={filteredEvents} />
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Settings & Configuration</h2>
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-bold mb-4">Data Management</h3>
                <div className="space-y-4 flex flex-col md:flex-row md:space-y-0 md:space-x-4">
                  <button
                    onClick={exportObservations}
                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded flex items-center space-x-2"
                  >
                    <Download size={16} />
                    <span>Export Observations</span>
                  </button>
                  <label className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded flex items-center space-x-2 cursor-pointer">
                    <Upload size={16} />
                    <span>Import Observations</span>
                    <input
                      type="file"
                      accept="application/json"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>
                  <button className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded flex items-center space-x-2">
                    <Save size={16} />
                    <span>Download Backup</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Add Observation Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto relative ios-form" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">{editObservationId !== null ? 'Edit Observation' : 'Add Observation'}</h3>
                <button
                  onClick={() => { setShowAddForm(false); setEditObservationId(null); }}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddObservation} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Object Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Object name"
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 ios-input"
                    required
                    inputMode="text"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 ios-input"
                  >
                    <option value="star">Star</option>
                    <option value="galaxy">Galaxy</option>
                    <option value="cluster">Cluster</option>
                    <option value="nebula">Nebula</option>
                    <option value="planet">Planet</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Observation Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 ios-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Location"
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 ios-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">RA</label>
                    <input
                      type="text"
                      value={formData.ra}
                      onChange={(e) => setFormData({ ...formData, ra: e.target.value })}
                      placeholder="Right Ascension (e.g., 12h 34m 56s)"
                      className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 ios-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">DEC</label>
                    <input
                      type="text"
                      value={formData.dec}
                      onChange={(e) => setFormData({ ...formData, dec: e.target.value })}
                      placeholder="Declination (e.g., +45&deg; 30&apos; 00&apos;&apos;)"
                      className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 ios-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Magnitude</label>
                  <input
                    type="text"
                    value={formData.magnitude}
                    onChange={(e) => setFormData({ ...formData, magnitude: e.target.value })}
                    placeholder="Magnitude"
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 ios-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Distance</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={formData.distance}
                      onChange={(e) => setFormData({ ...formData, distance: e.target.value })}
                      placeholder="Distance"
                      className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 ios-input"
                    />
                    <select
                      value={formData.distanceUnit}
                      onChange={(e) => setFormData({ ...formData, distanceUnit: e.target.value })}
                      className="p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 ios-input"
                    >
                      <option value="ly">Light Years</option>
                      <option value="AU">AU</option>
                      <option value="km">km</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 ios-input"
                    rows={3}
                    placeholder="Notes about your observation..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Image URL</label>
                  <input
                    type="text"
                    value={formData.image}
                    onChange={e => setFormData({ ...formData, image: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 ios-input"
                    placeholder="Paste image link here (e.g., from iCloud, Imgur, etc.)"
                  />
                </div>

                {formData.image && (
                  <div className="mt-2">
                    <img
                      src={formData.image}
                      alt="Observation"
                      className="max-h-48 rounded border border-gray-600"
                      style={{ maxWidth: "100%" }}
                      onError={e => (e.currentTarget.style.display = "none")}
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="favorite"
                    checked={formData.favorite}
                    onChange={(e) => setFormData({ ...formData, favorite: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="favorite" className="text-sm">Mark as Favorite ⭐</label>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 ios-input"
                  />
                  {formData.image && (
                    <img src={formData.image} alt="Preview" className="mt-2 w-full h-32 object-cover rounded-lg" />
                  )}
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded flex items-center justify-center space-x-2"
                  >
                    <Save size={16} />
                    <span>Save</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Observation Detail Modal */}
        {showDetailModal && selectedObservation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto relative" style={{ WebkitOverflowScrolling: 'touch' }}>
              <button
                onClick={() => setShowDetailModal(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-white text-2xl"
                aria-label="Fechar"
              >
                &times;
              </button>
              <div className="space-y-2">
                <div className="font-bold text-lg text-blue-400">{selectedObservation.name}</div>
                {selectedObservation.image && (
                  <div className="mb-3">
                    <img
                      src={selectedObservation.image}
                      alt={selectedObservation.name}
                      className="w-full h-48 object-cover rounded-lg hover:opacity-80 cursor-pointer"
                      onClick={() => handleImageClick(selectedObservation.image)}
                    />
                  </div>
                )}
                <div className="text-sm text-gray-300">Type: {selectedObservation.type}</div>
                <div className="text-sm text-gray-300">Date: {selectedObservation.date}</div>
                <div className="text-sm text-gray-300">Location: {selectedObservation.location}</div>
                {selectedObservation.magnitude && <div className="text-sm text-gray-300">Magnitude: {selectedObservation.magnitude}</div>}
                {selectedObservation.ra && <div className="text-sm text-gray-300">RA: {selectedObservation.ra} | Dec: {selectedObservation.dec}</div>}
                {selectedObservation.distance && <div className="text-sm text-gray-300">Distance: {selectedObservation.distance} {selectedObservation.distanceUnit}</div>}
                {selectedObservation.description && <div className="text-sm text-gray-400 mt-2">{selectedObservation.description}</div>}
                {selectedObservation.favorite && <div className="text-yellow-400">⭐ Favorite</div>}
                <button
                  className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded flex items-center space-x-2"
                  onClick={() => { setEditObservationId(selectedObservation.id); setShowDetailModal(false); }}
                  type="button"
                >
                  <Edit size={16} />
                  <span>Edit</span>
                </button>
                <button
                  className="mt-4 bg-red-600 hover:bg-red-700 px-4 py-2 rounded flex items-center space-x-2"
                  onClick={() => {
                    if (window.confirm("Delete this observation?")) {
                      setObservations(obs => obs.filter(o => o.id !== selectedObservation.id));
                      setShowDetailModal(false);
                    }
                  }}
                  type="button"
                >
                  <X size={16} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success notification */}
        {showSuccess && (
          <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
            ✅ Observation added successfully
          </div>
        )}
      </div>
    </div>
  );
};

export default AstroObservationApp;
