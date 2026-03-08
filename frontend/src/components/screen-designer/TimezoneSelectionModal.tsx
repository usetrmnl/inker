/**
 * TimezoneSelectionModal Component
 * Shows a timezone picker popup when placing clock or date widgets
 */
import { useState, useMemo, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { SearchableSelect } from '../common/SearchableSelect';

interface TimezoneSelectionModalProps {
  isOpen: boolean;
  onConfirm: (timezone: string) => void;
  onUseDefault: () => void;
  widgetType: 'clock' | 'date';
}

// Get the browser's detected timezone
const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Timezone data with city aliases for smart search
interface TimezoneData {
  value: string;
  label: string;
  offset: string;
  region: string;
  cities: string[];
}

const timezoneData: TimezoneData[] = [
  // UTC
  { value: 'UTC', label: 'UTC', offset: '±0:00', region: 'UTC', cities: ['utc', 'gmt', 'greenwich', 'coordinated universal time'] },

  // Americas (West to East)
  { value: 'Pacific/Honolulu', label: 'Hawaii', offset: '-10:00', region: 'Americas', cities: ['honolulu', 'hawaii', 'maui', 'oahu'] },
  { value: 'America/Anchorage', label: 'Alaska', offset: '-9:00', region: 'Americas', cities: ['anchorage', 'alaska', 'juneau', 'fairbanks'] },
  { value: 'America/Los_Angeles', label: 'Los Angeles', offset: '-8:00', region: 'Americas', cities: ['los angeles', 'la', 'san francisco', 'seattle', 'portland', 'san diego', 'las vegas', 'pacific', 'hollywood', 'sacramento', 'oakland'] },
  { value: 'America/Denver', label: 'Denver', offset: '-7:00', region: 'Americas', cities: ['denver', 'phoenix', 'salt lake', 'arizona', 'mountain', 'albuquerque', 'colorado', 'utah'] },
  { value: 'America/Chicago', label: 'Chicago', offset: '-6:00', region: 'Americas', cities: ['chicago', 'houston', 'dallas', 'austin', 'minneapolis', 'central', 'mexico city', 'guadalajara', 'san antonio', 'kansas city', 'milwaukee', 'oklahoma'] },
  { value: 'America/New_York', label: 'New York', offset: '-5:00', region: 'Americas', cities: ['new york', 'nyc', 'boston', 'miami', 'atlanta', 'philadelphia', 'washington', 'detroit', 'toronto', 'montreal', 'eastern', 'manhattan', 'brooklyn', 'baltimore', 'pittsburgh', 'charlotte', 'tampa', 'orlando', 'quebec'] },
  { value: 'America/Sao_Paulo', label: 'São Paulo', offset: '-3:00', region: 'Americas', cities: ['sao paulo', 'rio', 'rio de janeiro', 'brasilia', 'brazil', 'buenos aires', 'argentina', 'salvador', 'fortaleza', 'belo horizonte'] },

  // Western Europe
  { value: 'Europe/London', label: 'London', offset: '+0:00', region: 'Western Europe', cities: ['london', 'uk', 'united kingdom', 'britain', 'england', 'dublin', 'ireland', 'lisbon', 'portugal', 'edinburgh', 'manchester', 'birmingham', 'glasgow', 'liverpool', 'bristol', 'cardiff', 'belfast', 'leeds', 'sheffield', 'porto', 'cork'] },
  { value: 'Europe/Paris', label: 'Paris', offset: '+1:00', region: 'Western Europe', cities: ['paris', 'france', 'lyon', 'marseille', 'nice', 'monaco', 'toulouse', 'bordeaux', 'lille', 'nantes', 'strasbourg', 'montpellier'] },
  { value: 'Europe/Amsterdam', label: 'Amsterdam', offset: '+1:00', region: 'Western Europe', cities: ['amsterdam', 'netherlands', 'holland', 'rotterdam', 'hague', 'brussels', 'belgium', 'antwerp', 'utrecht', 'eindhoven', 'ghent', 'bruges', 'liege', 'luxembourg'] },
  { value: 'Europe/Madrid', label: 'Madrid', offset: '+1:00', region: 'Western Europe', cities: ['madrid', 'spain', 'barcelona', 'valencia', 'seville', 'malaga', 'bilbao', 'zaragoza', 'palma', 'canary islands', 'tenerife', 'mallorca', 'ibiza'] },

  // Central Europe
  { value: 'Europe/Berlin', label: 'Berlin', offset: '+1:00', region: 'Central Europe', cities: ['berlin', 'germany', 'munich', 'frankfurt', 'hamburg', 'cologne', 'dusseldorf', 'stuttgart', 'dortmund', 'essen', 'bremen', 'leipzig', 'dresden', 'hannover', 'nuremberg', 'bonn'] },
  { value: 'Europe/Rome', label: 'Rome', offset: '+1:00', region: 'Central Europe', cities: ['rome', 'italy', 'milan', 'florence', 'venice', 'naples', 'turin', 'vatican', 'bologna', 'genoa', 'palermo', 'verona', 'pisa', 'siena'] },
  { value: 'Europe/Vienna', label: 'Vienna', offset: '+1:00', region: 'Central Europe', cities: ['vienna', 'austria', 'salzburg', 'innsbruck', 'graz', 'linz'] },
  { value: 'Europe/Zurich', label: 'Zurich', offset: '+1:00', region: 'Central Europe', cities: ['zurich', 'zürich', 'switzerland', 'geneva', 'bern', 'basel', 'lausanne', 'lucerne', 'interlaken', 'davos'] },
  { value: 'Europe/Warsaw', label: 'Warsaw', offset: '+1:00', region: 'Central Europe', cities: ['warsaw', 'warszawa', 'poland', 'polska', 'krakow', 'kraków', 'cracow', 'lodz', 'łódź', 'wroclaw', 'wrocław', 'breslau', 'poznan', 'poznań', 'gdansk', 'gdańsk', 'danzig', 'szczecin', 'stettin', 'lublin', 'katowice', 'bialystok', 'białystok', 'czestochowa', 'częstochowa', 'radom', 'torun', 'toruń', 'kielce', 'rzeszow', 'rzeszów', 'olsztyn', 'bydgoszcz', 'gliwice', 'zabrze', 'bytom', 'opole', 'zielona gora', 'zielona góra', 'sopot', 'gdynia', 'zakopane', 'plock', 'płock', 'legnica', 'elblag', 'elbląg', 'tarnow', 'tarnów', 'gorzow', 'gorzów'] },
  { value: 'Europe/Prague', label: 'Prague', offset: '+1:00', region: 'Central Europe', cities: ['prague', 'praha', 'czech', 'czechia', 'brno', 'ostrava', 'bratislava', 'slovakia', 'kosice', 'pilsen', 'olomouc', 'liberec'] },
  { value: 'Europe/Budapest', label: 'Budapest', offset: '+1:00', region: 'Central Europe', cities: ['budapest', 'hungary', 'debrecen', 'szeged', 'pecs', 'gyor'] },

  // Northern Europe
  { value: 'Europe/Stockholm', label: 'Stockholm', offset: '+1:00', region: 'Northern Europe', cities: ['stockholm', 'sweden', 'gothenburg', 'malmo', 'goteborg', 'uppsala'] },
  { value: 'Europe/Oslo', label: 'Oslo', offset: '+1:00', region: 'Northern Europe', cities: ['oslo', 'norway', 'bergen', 'trondheim', 'stavanger', 'tromso'] },
  { value: 'Europe/Copenhagen', label: 'Copenhagen', offset: '+1:00', region: 'Northern Europe', cities: ['copenhagen', 'denmark', 'aarhus', 'odense', 'aalborg'] },
  { value: 'Europe/Helsinki', label: 'Helsinki', offset: '+2:00', region: 'Northern Europe', cities: ['helsinki', 'finland', 'tampere', 'turku', 'oulu', 'espoo', 'vantaa'] },

  // Eastern Europe
  { value: 'Europe/Athens', label: 'Athens', offset: '+2:00', region: 'Eastern Europe', cities: ['athens', 'greece', 'thessaloniki', 'santorini', 'crete', 'mykonos', 'rhodes', 'corfu', 'patras'] },
  { value: 'Europe/Bucharest', label: 'Bucharest', offset: '+2:00', region: 'Eastern Europe', cities: ['bucharest', 'romania', 'cluj', 'timisoara', 'iasi', 'constanta', 'brasov', 'sibiu'] },
  { value: 'Europe/Sofia', label: 'Sofia', offset: '+2:00', region: 'Eastern Europe', cities: ['sofia', 'bulgaria', 'plovdiv', 'varna', 'burgas'] },
  { value: 'Europe/Tallinn', label: 'Tallinn', offset: '+2:00', region: 'Eastern Europe', cities: ['tallinn', 'estonia', 'tartu'] },
  { value: 'Europe/Riga', label: 'Riga', offset: '+2:00', region: 'Eastern Europe', cities: ['riga', 'latvia', 'jurmala'] },
  { value: 'Europe/Vilnius', label: 'Vilnius', offset: '+2:00', region: 'Eastern Europe', cities: ['vilnius', 'lithuania', 'kaunas', 'klaipeda'] },
  { value: 'Europe/Kyiv', label: 'Kyiv', offset: '+2:00', region: 'Eastern Europe', cities: ['kyiv', 'kiev', 'ukraine', 'kharkiv', 'odessa', 'lviv', 'dnipro', 'donetsk', 'zaporizhzhia'] },
  { value: 'Europe/Istanbul', label: 'Istanbul', offset: '+3:00', region: 'Eastern Europe', cities: ['istanbul', 'turkey', 'ankara', 'izmir', 'antalya', 'bursa', 'adana', 'bodrum', 'cappadocia'] },
  { value: 'Europe/Moscow', label: 'Moscow', offset: '+3:00', region: 'Eastern Europe', cities: ['moscow', 'russia', 'st petersburg', 'saint petersburg', 'nizhny novgorod', 'yekaterinburg', 'novosibirsk', 'kazan', 'samara', 'sochi'] },

  // Middle East & Africa
  { value: 'Africa/Cairo', label: 'Cairo', offset: '+2:00', region: 'Middle East & Africa', cities: ['cairo', 'egypt', 'alexandria', 'giza', 'luxor', 'aswan', 'sharm el sheikh', 'hurghada'] },
  { value: 'Africa/Johannesburg', label: 'Johannesburg', offset: '+2:00', region: 'Middle East & Africa', cities: ['johannesburg', 'south africa', 'cape town', 'durban', 'pretoria', 'port elizabeth', 'soweto'] },
  { value: 'Asia/Jerusalem', label: 'Jerusalem', offset: '+2:00', region: 'Middle East & Africa', cities: ['jerusalem', 'israel', 'tel aviv', 'haifa', 'eilat', 'nazareth'] },
  { value: 'Asia/Dubai', label: 'Dubai', offset: '+4:00', region: 'Middle East & Africa', cities: ['dubai', 'uae', 'abu dhabi', 'sharjah', 'doha', 'qatar', 'bahrain', 'manama', 'muscat', 'oman', 'ajman'] },
  { value: 'Asia/Riyadh', label: 'Riyadh', offset: '+3:00', region: 'Middle East & Africa', cities: ['riyadh', 'saudi arabia', 'jeddah', 'mecca', 'medina', 'kuwait', 'dammam'] },

  // South Asia
  { value: 'Asia/Karachi', label: 'Karachi', offset: '+5:00', region: 'South Asia', cities: ['karachi', 'pakistan', 'lahore', 'islamabad', 'rawalpindi', 'faisalabad', 'peshawar'] },
  { value: 'Asia/Kolkata', label: 'Mumbai', offset: '+5:30', region: 'South Asia', cities: ['mumbai', 'bombay', 'india', 'new delhi', 'delhi', 'bangalore', 'bengaluru', 'chennai', 'hyderabad', 'kolkata', 'calcutta', 'pune', 'ahmedabad', 'jaipur', 'goa', 'lucknow', 'kanpur', 'agra', 'varanasi', 'surat'] },
  { value: 'Asia/Dhaka', label: 'Dhaka', offset: '+6:00', region: 'South Asia', cities: ['dhaka', 'bangladesh', 'chittagong', 'khulna', 'sylhet'] },

  // Southeast Asia
  { value: 'Asia/Bangkok', label: 'Bangkok', offset: '+7:00', region: 'Southeast Asia', cities: ['bangkok', 'thailand', 'phuket', 'chiang mai', 'pattaya', 'hanoi', 'vietnam', 'ho chi minh', 'saigon', 'da nang', 'krabi', 'koh samui', 'hoi an'] },
  { value: 'Asia/Jakarta', label: 'Jakarta', offset: '+7:00', region: 'Southeast Asia', cities: ['jakarta', 'indonesia', 'bali', 'surabaya', 'bandung', 'yogyakarta', 'medan', 'lombok'] },
  { value: 'Asia/Singapore', label: 'Singapore', offset: '+8:00', region: 'Southeast Asia', cities: ['singapore', 'kuala lumpur', 'malaysia', 'penang', 'johor bahru', 'langkawi', 'ipoh', 'malacca'] },
  { value: 'Asia/Manila', label: 'Manila', offset: '+8:00', region: 'Southeast Asia', cities: ['manila', 'philippines', 'cebu', 'davao', 'boracay', 'makati', 'palawan', 'baguio'] },

  // East Asia
  { value: 'Asia/Shanghai', label: 'Shanghai', offset: '+8:00', region: 'East Asia', cities: ['shanghai', 'china', 'beijing', 'peking', 'guangzhou', 'shenzhen', 'hong kong', 'macau', 'chengdu', 'hangzhou', 'nanjing', 'wuhan', 'xian', 'suzhou', 'tianjin', 'chongqing', 'qingdao', 'dalian', 'harbin', 'kunming', 'guilin'] },
  { value: 'Asia/Taipei', label: 'Taipei', offset: '+8:00', region: 'East Asia', cities: ['taipei', 'taiwan', 'kaohsiung', 'taichung', 'tainan'] },
  { value: 'Asia/Tokyo', label: 'Tokyo', offset: '+9:00', region: 'East Asia', cities: ['tokyo', 'japan', 'osaka', 'kyoto', 'yokohama', 'nagoya', 'sapporo', 'fukuoka', 'kobe', 'sendai', 'hiroshima', 'nara', 'okinawa', 'hokkaido', 'shibuya', 'shinjuku'] },
  { value: 'Asia/Seoul', label: 'Seoul', offset: '+9:00', region: 'East Asia', cities: ['seoul', 'korea', 'south korea', 'busan', 'incheon', 'daegu', 'daejeon', 'gangnam', 'jeju'] },

  // Oceania
  { value: 'Australia/Perth', label: 'Perth', offset: '+8:00', region: 'Oceania', cities: ['perth', 'western australia', 'fremantle'] },
  { value: 'Australia/Sydney', label: 'Sydney', offset: '+10:00', region: 'Oceania', cities: ['sydney', 'australia', 'melbourne', 'brisbane', 'gold coast', 'canberra', 'adelaide', 'hobart', 'cairns', 'darwin', 'tasmania', 'bondi', 'byron bay', 'great barrier reef'] },
  { value: 'Pacific/Auckland', label: 'Auckland', offset: '+12:00', region: 'Oceania', cities: ['auckland', 'new zealand', 'wellington', 'christchurch', 'queenstown', 'rotorua', 'dunedin', 'hamilton', 'tauranga'] },
];

// Define regions in display order
const regionOrder = [
  'UTC',
  'Americas',
  'Western Europe',
  'Central Europe',
  'Northern Europe',
  'Eastern Europe',
  'Middle East & Africa',
  'South Asia',
  'Southeast Asia',
  'East Asia',
  'Oceania',
];

// Build timezone options for display with region grouping
const getTimezoneOptions = (): { value: string; label: string; hint?: string; isGroup?: boolean }[] => {
  const result: { value: string; label: string; hint?: string; isGroup?: boolean }[] = [];

  // Check if browser timezone is not in the list, add it at the top
  const browserTzInList = timezoneData.some(tz => tz.value === browserTimezone);
  if (!browserTzInList) {
    result.push({ value: browserTimezone, label: `${browserTimezone} (detected)` });
  }

  // Group timezones by region
  for (const region of regionOrder) {
    const regionTimezones = timezoneData.filter(tz => tz.region === region);
    if (regionTimezones.length > 0) {
      result.push({ value: region, label: region, isGroup: true });
      for (const tz of regionTimezones) {
        result.push({
          value: tz.value,
          label: `${tz.label} (UTC${tz.offset})`,
        });
      }
    }
  }

  return result;
};

// Search function that matches cities to timezones with hints
const searchTimezones = (query: string): { value: string; label: string; hint?: string; isGroup?: boolean }[] => {
  const q = query.toLowerCase().trim();
  if (!q) return getTimezoneOptions();

  const matches: { value: string; label: string; hint?: string; score: number }[] = [];

  for (const tz of timezoneData) {
    let score = 0;
    let matchedCity: string | undefined;

    // Exact label match (highest priority)
    if (tz.label.toLowerCase() === q) {
      score = 100;
    }
    // Label starts with query
    else if (tz.label.toLowerCase().startsWith(q)) {
      score = 80;
    }
    // Label contains query
    else if (tz.label.toLowerCase().includes(q)) {
      score = 60;
    }
    // City exact match
    else {
      for (const city of tz.cities) {
        if (city === q) {
          score = 90;
          matchedCity = city;
          break;
        } else if (city.startsWith(q)) {
          if (score < 70) {
            score = 70;
            matchedCity = city;
          }
        } else if (city.includes(q)) {
          if (score < 50) {
            score = 50;
            matchedCity = city;
          }
        }
      }
    }

    if (score > 0) {
      matches.push({
        value: tz.value,
        label: `${tz.label} (UTC${tz.offset})`,
        hint: matchedCity,
        score,
      });
    }
  }

  // Sort by score (highest first)
  matches.sort((a, b) => b.score - a.score);

  return matches;
};

export function TimezoneSelectionModal({
  isOpen,
  onConfirm,
  onUseDefault,
  widgetType,
}: TimezoneSelectionModalProps) {
  const [selectedTimezone, setSelectedTimezone] = useState(browserTimezone);

  const options = useMemo(() => getTimezoneOptions(), []);

  const handleConfirm = useCallback(() => {
    onConfirm(selectedTimezone);
    setSelectedTimezone(browserTimezone); // Reset for next use
  }, [selectedTimezone, onConfirm]);

  const handleUseDefault = useCallback(() => {
    onUseDefault();
    setSelectedTimezone(browserTimezone); // Reset for next use
  }, [onUseDefault]);

  const widgetLabel = widgetType === 'clock' ? 'Live Clock' : 'Date Display';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleUseDefault}
      title={`Set Timezone for ${widgetLabel}`}
      size="sm"
      footer={
        <>
          <button
            onClick={handleUseDefault}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Use Local Time
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
          >
            Confirm
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Select the timezone for this {widgetType === 'clock' ? 'clock' : 'date'} widget.
          You can search by city name or region.
        </p>

        <SearchableSelect
          value={selectedTimezone}
          onChange={setSelectedTimezone}
          options={options}
          searchFn={searchTimezones}
          placeholder="Search city or timezone..."
        />

        <p className="text-xs text-text-muted">
          Tip: Type a city name like "Tokyo", "London", or "Warsaw" to quickly find the timezone.
        </p>
      </div>
    </Modal>
  );
}
