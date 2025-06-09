import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Search, Plus, Star, Filter, Settings, Download, Upload, Save, X, Eye, Moon, Sun, Edit } from 'lucide-react';

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

const getBortleClass = async (lat: number, lng: number): Promise<string> => {
  // Placeholder: In a real app, fetch from a Bortle API if available.
  // For now, return a random class for demonstration.
  // You can replace this with a real API call if you find a public endpoint.
  const classes = [
    'Class 1: Excellent dark-sky site',
    'Class 2: Typical truly dark site',
    'Class 3: Rural sky',
    'Class 4: Rural/suburban transition',
    'Class 5: Suburban sky',
    'Class 6: Bright suburban sky',
    'Class 7: Suburban/urban transition',
    'Class 8: City sky',
    'Class 9: Inner-city sky'
  ];
  // Simulate API delay
  await new Promise(res => setTimeout(res, 300));
  // Return a class based on lat/lng for demo
  const idx = Math.abs(Math.floor((lat + lng) % 9));
  return classes[idx];
};

const nominatimBase = 'https://nominatim.openstreetmap.org';

const AstroObservationApp = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [observations, setObservations] = useState<Observation[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editObservationId, setEditObservationId] = useState<number | null>(null);
  const [selectedObject, setSelectedObject] = useState('');
  const [userLocation, setUserLocation] = useState({ lat: 38.7223, lng: -9.1393 });
  const [placeName, setPlaceName] = useState('Lisbon, Portugal');
  const [placeInput, setPlaceInput] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [moonPhase, setMoonPhase] = useState({ phase: 'New Moon', illumination: 0 });
  const [visibleObjects, setVisibleObjects] = useState<CelestialObject[]>([]);
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

  // Sample celestial objects with visibility data
  const celestialObjects: CelestialObject[] = [
    { name: 'M31 (Andromeda Galaxy)', type: 'galaxy', magnitude: 3.4, constellation: 'Andromeda', ra: '00h 42m', dec: "+41° 16'", season: 'autumn', bestTime: '22:00-02:00' },
    { name: 'M42 (Orion Nebula)', type: 'nebula', magnitude: 4.0, constellation: 'Orion', ra: '05h 35m', dec: "-05° 23'", season: 'winter', bestTime: '20:00-24:00' },
    { name: 'M13 (Hercules Cluster)', type: 'cluster', magnitude: 5.8, constellation: 'Hercules', ra: '16h 41m', dec: "+36° 28'", season: 'summer', bestTime: '21:00-01:00' },
    { name: 'Saturn', type: 'planet', magnitude: 0.5, constellation: 'Aquarius', ra: '22h 30m', dec: "-10° 15'", season: 'all', bestTime: '20:00-04:00' },
    { name: 'Jupiter', type: 'planet', magnitude: -2.5, constellation: 'Taurus', ra: '04h 15m', dec: "+20° 30'", season: 'all', bestTime: '19:00-03:00' },
    { name: 'M57 (Ring Nebula)', type: 'nebula', magnitude: 8.8, constellation: 'Lyra', ra: '18h 53m', dec: "+33° 02'", season: 'summer', bestTime: '21:00-02:00' },
    { name: 'Double Cluster', type: 'cluster', magnitude: 4.3, constellation: 'Perseus', ra: '02h 20m', dec: "+57° 08'", season: 'autumn', bestTime: '21:00-03:00' }
  ];

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
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

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

  // Calculate visible objects based on time and location
  useEffect(() => {
    const calculateVisibleObjects = () => {
      const currentSeason = getCurrentSeason();
      const currentHour = currentTime.getHours();
      const visible = celestialObjects.filter(obj => {
        const [startHour, endHour] = obj.bestTime.split('-').map(time => parseInt(time.split(':')[0]));
        const isTimeGood = currentHour >= startHour || currentHour <= endHour ||
          (startHour > endHour && (currentHour >= startHour || currentHour <= endHour));
        return (obj.season === 'all' || obj.season === currentSeason) &&
          (obj.magnitude <= 6 || obj.type === 'planet') && isTimeGood;
      });
      setVisibleObjects(visible);
    };
    calculateVisibleObjects();
    // eslint-disable-next-line
  }, [currentTime, userLocation]);

  // Fetch Bortle class for user location
  useEffect(() => {
    getBortleClass(userLocation.lat, userLocation.lng).then(setBortleClass);
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
  const handlePlaceSearch = () => {
    if (!placeInput.trim()) return;
    fetch(`${nominatimBase}/search?q=${encodeURIComponent(placeInput)}&format=json&limit=1`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setUserLocation({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
          setPlaceName(data[0].display_name);
        } else {
          alert('Location not found.');
        }
      })
      .catch(() => alert('Error fetching location.'));
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData({ ...formData, image: (event.target?.result as string) || '' });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageClick = (img: string) => {
    const win = window.open();
    if (win) {
      win.document.write(`<img src="${img}" style="width:100vw;max-width:100%;height:auto;display:block;margin:auto;background:#000;" />`);
      win.document.title = "Observation Image";
      win.document.body.style.background = "#000";
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
        <header className="bg-gray-800 p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
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
        <nav className="bg-gray-800 border-t border-gray-700">
          <div className="max-w-7xl mx-auto px-4">
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
          </div>
        </nav>

        <main className="max-w-7xl mx-auto p-4">
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
                      value={selectedObject}
                      onChange={(e) => setSelectedObject(e.target.value)}
                      className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                    >
                      <option value="">Select object...</option>
                      {visibleObjects.map(obj => (
                        <option key={obj.name} value={obj.name}>{obj.name}</option>
                      ))}
                    </select>
                    {selectedObject && (
                      <a
                        href={`http://simbad.u-strasbg.fr/simbad/sim-basic?Ident=${encodeURIComponent(selectedObject)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-2 text-blue-400 underline"
                      >
                        More Info on SIMBAD
                      </a>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Date & Time:</label>
                    <input
                      type="datetime-local"
                      value={currentTime.toISOString().slice(0, 16)}
                      onChange={(e) => setCurrentTime(new Date(e.target.value))}
                      className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Location:</label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={placeInput}
                        onChange={e => setPlaceInput(e.target.value)}
                        placeholder={placeName}
                        className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                      />
                      <button
                        onClick={handlePlaceSearch}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                        title="Search for place"
                        type="button"
                      >
                        <Search size={16} />
                      </button>
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
                        value={userLocation.lat}
                        onChange={(e) => setUserLocation({ ...userLocation, lat: parseFloat(e.target.value) })}
                        className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                        step="0.0001"
                      />
                      <input
                        type="number"
                        value={userLocation.lng}
                        onChange={(e) => setUserLocation({ ...userLocation, lng: parseFloat(e.target.value) })}
                        className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                        step="0.0001"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-2">
                    <span className="font-bold">Bortle Class:</span> {bortleClass} <span className="text-xs text-gray-400">(demo, not real-time)</span>
                  </div>
                  <div className="mb-2">
                    <span className="font-bold">Sky Chart:</span>{' '}
                    <a
                      href={`https://stellarium-web.org/skyscape.html?lat=${userLocation.lat}&lon=${userLocation.lng}`}
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
                    <div className="font-bold mb-2">Visibility (next 6 hours):</div>
                    <div className="flex space-x-2">
                      {Array.from({ length: 6 }).map((_, i) => {
                        const hour = (currentTime.getHours() + i) % 24;
                        const visible = celestialObjects.filter(obj => {
                          const [startHour, endHour] = obj.bestTime.split('-').map(time => parseInt(time.split(':')[0]));
                          const isTimeGood = hour >= startHour || hour <= endHour ||
                            (startHour > endHour && (hour >= startHour || hour <= endHour));
                          return (obj.season === 'all' || obj.season === getCurrentSeason()) &&
                            (obj.magnitude <= 6 || obj.type === 'planet') && isTimeGood;
                        });
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
                              {visible.length}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Number of visible objects per hour (click to view)</div>
                  </div>
                )}
              </div>

              {/* Currently Visible Objects */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-bold mb-4">🌠 Currently Visible Objects</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleObjects.map(obj => (
                    <div key={obj.name} className="bg-gray-700 p-4 rounded-lg">
                      <h4 className="font-bold text-blue-400">{obj.name}</h4>
                      <p className="text-sm text-gray-300">Type: {obj.type}</p>
                      <p className="text-sm text-gray-300">Magnitude: {obj.magnitude}</p>
                      <p className="text-sm text-gray-300">Constellation: {obj.constellation}</p>
                      <p className="text-sm text-gray-300">Best Time: {obj.bestTime}</p>
                      <p className="text-sm text-gray-300">RA: {obj.ra} | Dec: {obj.dec}</p>
                      <a
                        href={`http://simbad.u-strasbg.fr/simbad/sim-basic?Ident=${encodeURIComponent(obj.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-2 text-blue-400 underline"
                      >
                        More Info on SIMBAD
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Moon Phase */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center">
                  <Moon className="mr-2" size={20} />
                  Moon Today
                </h3>
                <div className="flex items-center space-x-4">
                  <div className="text-4xl">🌙</div>
                  <div>
                    <p className="text-lg font-semibold">{moonPhase.phase}</p>
                    <p className="text-gray-400">{moonPhase.illumination}% illuminated</p>
                  </div>
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
                          onClick={e => { e.stopPropagation(); handleImageClick(obs.image); }}
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
                    <li><a href="https://www.ngcicproject.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">IC Catalog</a></li>
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
                    <li><a href="https://www.nasa.gov" className="text-blue-400 hover:text-blue-300">NASA</a></li>
                    <li><a href="https://www.esa.int" className="text-blue-400 hover:text-blue-300">ESA</a></li>
                    <li><a href="https://www.seti.org" className="text-blue-400 hover:text-blue-300">SETI</a></li>
                    <li><a href="https://www.cnsa.gov.cn" className="text-blue-400 hover:text-blue-300">CNSA</a></li>
                    <li><a href="https://www.aeb.gov.br" className="text-blue-400 hover:text-blue-300">AEB</a></li>
                    <li><a href="https://www.asc-csa.gc.ca" className="text-blue-400 hover:text-blue-300">CSA</a></li>
                    <li><a href="https://www.isro.gov.in" className="text-blue-400 hover:text-blue-300">ISRO</a></li>
                  </ul>
                </div>
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">Commercial Space</h3>
                  <ul className="space-y-2">
                    <li><a href="https://www.spacex.com" className="text-blue-400 hover:text-blue-300">SpaceX</a></li>
                    <li><a href="https://www.arianespace.com" className="text-blue-400 hover:text-blue-300">Ariane</a></li>
                    <li><a href="https://www.blueorigin.com" className="text-blue-400 hover:text-blue-300">Blue Origin</a></li>
                  </ul>
                </div>
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">Astronomical Societies</h3>
                  <ul className="space-y-2">
                    <li><a href="https://www.aep.org.pt" className="text-blue-400 hover:text-blue-300">AEP (Portugal)</a></li>
                    <li><a href="https://www.iau.org" className="text-blue-400 hover:text-blue-300">IAU</a></li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Calendar Tab */}
          {activeTab === 'calendar' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Astronomical Calendar</h2>
              <div className="bg-gray-800 rounded-lg p-6">
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
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Settings & Configuration</h2>
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-bold mb-4">Data Management</h3>
                <div className="space-y-4">
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
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
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
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
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
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">RA</label>
                    <input
                      type="text"
                      placeholder="00h 00m 00s"
                      value={formData.ra}
                      onChange={(e) => setFormData({ ...formData, ra: e.target.value })}
                      className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">DEC</label>
                    <input
                      type="text"
                      placeholder="+00° 00' 00''"
                      value={formData.dec}
                      onChange={(e) => setFormData({ ...formData, dec: e.target.value })}
                      className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Magnitude</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.magnitude}
                    onChange={(e) => setFormData({ ...formData, magnitude: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Distance</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={formData.distance}
                      onChange={(e) => setFormData({ ...formData, distance: e.target.value })}
                      className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                    />
                    <select
                      value={formData.distanceUnit}
                      onChange={(e) => setFormData({ ...formData, distanceUnit: e.target.value })}
                      className="p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
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
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                    rows={3}
                    placeholder="Notes about your observation..."
                  />
                </div>

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
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
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
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Observation Details</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>
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