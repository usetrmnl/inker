/**
 * WidgetSettingsPanel Component
 * Panel for configuring the selected widget's settings.
 */
import { useCallback, useState, useRef, useEffect } from 'react';
import type { ScreenWidget, WidgetTemplate, DataSource, FieldMeta, CustomWidget, GridCellOverride } from '../../types';
import { screenDesignerService, dataSourceService, customWidgetService } from '../../services/api';
import { config } from '../../config';
import { SearchableSelect } from '../common/SearchableSelect';

interface WidgetSettingsPanelProps {
  widget: ScreenWidget | null;
  template: WidgetTemplate | null;
  allWidgets?: ScreenWidget[];
  templates?: WidgetTemplate[];
  onUpdateWidget: (updates: Partial<ScreenWidget>) => void;
  onDeleteWidget: () => void;
  onSelectWidget?: (id: number) => void;
}

// Get the browser's detected timezone
const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Timezone data with city aliases for smart search
// Each timezone has: value (IANA), label (display), offset, region, and searchable city aliases
interface TimezoneData {
  value: string;
  label: string;
  offset: string;
  region: string;
  cities: string[]; // Searchable city names that map to this timezone
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

  // Add local option first
  result.push({ value: 'local', label: `Local (${browserTimezone})` });

  // Check if browser timezone is not in the list, add it
  const browserTzInList = timezoneData.some(tz => tz.value === browserTimezone);
  if (!browserTzInList) {
    result.push({ value: browserTimezone, label: browserTimezone });
  }

  // Group timezones by region
  for (const region of regionOrder) {
    const regionTimezones = timezoneData.filter(tz => tz.region === region);
    if (regionTimezones.length > 0) {
      // Add region header
      result.push({ value: region, label: region, isGroup: true });
      // Add timezones in this region
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

  // Check "local" option
  if ('local'.includes(q) || browserTimezone.toLowerCase().includes(q)) {
    matches.push({ value: 'local', label: `Local (${browserTimezone})`, score: 100 });
  }

  for (const tz of timezoneData) {
    let score = 0;
    let matchedCity: string | undefined;

    // Exact timezone value match
    if (tz.value.toLowerCase().includes(q)) {
      score = 90;
    }
    // Label match (timezone's main city name)
    else if (tz.label.toLowerCase().includes(q)) {
      score = 80;
    }
    // Offset match (e.g., "+1", "utc+1")
    else if (tz.offset.includes(q) || `utc${tz.offset}`.includes(q)) {
      score = 70;
    }
    // City alias match - find which city matched
    else {
      for (const city of tz.cities) {
        if (city.includes(q)) {
          // Prefer exact starts
          score = city.startsWith(q) ? 85 : 75;
          // Only show hint if not the main label city
          if (city.toLowerCase() !== tz.label.toLowerCase()) {
            // Capitalize first letter of each word
            matchedCity = city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          }
          break;
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

  return matches.map(({ value, label, hint }) => ({ value, label, hint }));
};

// Font family options - using system fonts for consistent local rendering
const fontFamilies = [
  { value: 'sans-serif', label: 'Sans-serif' },
  { value: 'monospace', label: 'Monospace' },
  { value: 'serif', label: 'Serif' },
];

// Font weight options
const fontWeights = [
  { value: 'normal', label: 'Normal' },
  { value: 'bold', label: 'Bold' },
];

// Text alignment options
const textAlignments = [
  { value: 'left', label: 'Left', icon: 'M4 6h16M4 12h10M4 18h14' },
  { value: 'center', label: 'Center', icon: 'M4 6h16M7 12h10M5 18h14' },
  { value: 'right', label: 'Right', icon: 'M4 6h16M10 12h10M6 18h14' },
];

// Unit options
const unitOptions = [
  { value: 'metric', label: 'Celsius' },
  { value: 'imperial', label: 'Fahrenheit' },
];

// Language/Locale options for date formatting
const localeOptions = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'pl-PL', label: 'Polish' },
  { value: 'de-DE', label: 'German' },
  { value: 'fr-FR', label: 'French' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'pt-PT', label: 'Portuguese' },
  { value: 'nl-NL', label: 'Dutch' },
  { value: 'ru-RU', label: 'Russian' },
  { value: 'uk-UA', label: 'Ukrainian' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
  { value: 'ko-KR', label: 'Korean' },
];

// Time format options
const timeFormats = [
  { value: '12h', label: '12 Hour' },
  { value: '24h', label: '24 Hour' },
];

// Setting section component
interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function SettingSection({ title, children, defaultExpanded = true }: SettingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-border-light last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-muted transition-colors"
      >
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{title}</span>
        <svg
          className={`w-4 h-4 text-text-placeholder transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

// Input field component
interface FieldProps {
  label: string;
  children: React.ReactNode;
  hint?: string;
}

function Field({ label, children, hint }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

// Styled input component
function StyledInput({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`
        w-full px-3 py-2 bg-bg-muted border border-border-light rounded-lg
        text-sm text-text-primary placeholder-text-placeholder
        focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent focus:bg-bg-card
        transition-all
        ${className}
      `}
      {...props}
    />
  );
}

// Number input that allows clearing the field while typing
function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  className = '',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const [localValue, setLocalValue] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setLocalValue(String(value));
  }, [value, isFocused]);

  const clamp = (n: number) => {
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  };

  return (
    <StyledInput
      type="number"
      value={localValue}
      min={min}
      max={max}
      step={step}
      className={className}
      onFocus={() => setIsFocused(true)}
      onChange={(e) => {
        setLocalValue(e.target.value);
        const parsed = parseFloat(e.target.value);
        if (!isNaN(parsed)) onChange(clamp(parsed));
      }}
      onBlur={() => {
        setIsFocused(false);
        const parsed = parseFloat(localValue);
        if (isNaN(parsed)) setLocalValue(String(value));
        else onChange(clamp(parsed));
      }}
    />
  );
}

// Styled select component
interface StyledSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
}

function StyledSelect({ options, className = '', ...props }: StyledSelectProps) {
  return (
    <select
      className={`
        w-full px-3 py-2 bg-bg-muted border border-border-light rounded-lg
        text-sm text-text-primary
        focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent focus:bg-bg-card
        transition-all appearance-none
        bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%239ca3af%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')]
        bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] bg-no-repeat
        pr-10
        ${className}
      `}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// Toggle switch component
interface ToggleSwitchProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitch({ id, label, checked, onChange }: ToggleSwitchProps) {
  return (
    <label htmlFor={id} className="flex items-center justify-between cursor-pointer py-1">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="relative">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-border-light peer-focus:ring-2 peer-focus:ring-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent transition-colors" />
      </div>
    </label>
  );
}

/**
 * DataSourceSelector - Allows selecting a data source and field for dynamic content
 *
 * This component enables widgets to pull data from external APIs.
 * Users can:
 * 1. Select a data source (API endpoint configured in Data Sources)
 * 2. Choose which field from that data source to display
 *
 * The selected dataSourceId and dataSourceField are stored in widget.config
 */
interface DataSourceSelectorProps {
  widget: ScreenWidget;
  updateConfig: (key: string, value: unknown) => void;
  fieldFilter?: (field: FieldMeta) => boolean;
  label?: string;
}

function DataSourceSelector({
  widget,
  updateConfig,
  fieldFilter,
  label = 'Data Source',
}: DataSourceSelectorProps) {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [fields, setFields] = useState<FieldMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);

  const selectedDataSourceId = widget.config.dataSourceId as number | undefined;
  const selectedField = widget.config.dataSourceField as string | undefined;

  // Load available data sources on mount
  useEffect(() => {
    const loadDataSources = async () => {
      try {
        const response = await dataSourceService.getAll();
        // Filter to only active data sources
        const activeDataSources = response.items.filter(ds => ds.isActive);
        setDataSources(activeDataSources);
      } catch (error) {
        console.error('Failed to load data sources:', error);
      } finally {
        setLoading(false);
      }
    };
    loadDataSources();
  }, []);

  // Load fields when a data source is selected
  useEffect(() => {
    if (!selectedDataSourceId) {
      setFields([]);
      return;
    }

    const loadFields = async () => {
      setLoadingFields(true);
      try {
        const dataSource = dataSources.find(ds => ds.id === selectedDataSourceId);
        if (!dataSource) return;

        // Test the URL to get available fields
        const result = await dataSourceService.testUrl({
          url: dataSource.url,
          type: dataSource.type,
          method: dataSource.method,
          headers: dataSource.headers,
        });

        if (result.success && result.fields) {
          // Apply filter if provided (e.g., only image URLs for image widget)
          const filteredFields = fieldFilter
            ? result.fields.filter(fieldFilter)
            : result.fields;
          setFields(filteredFields);
        }
      } catch (error) {
        console.error('Failed to load fields:', error);
      } finally {
        setLoadingFields(false);
      }
    };
    loadFields();
  }, [selectedDataSourceId, dataSources, fieldFilter]);

  // Handle data source change
  const handleDataSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '') {
      // Clear data source
      updateConfig('dataSourceId', undefined);
      updateConfig('dataSourceField', undefined);
    } else {
      updateConfig('dataSourceId', parseInt(value, 10));
      updateConfig('dataSourceField', undefined); // Reset field when source changes
    }
  };

  // Handle field selection
  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    updateConfig('dataSourceField', value || undefined);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-medium text-text-secondary">{label}</div>
        <div className="flex items-center gap-2 text-xs text-text-placeholder">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading data sources...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 bg-accent-light rounded-lg border border-border-light">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
        <span className="text-xs font-medium text-accent">{label}</span>
      </div>

      {dataSources.length === 0 ? (
        <p className="text-xs text-text-muted">
          No data sources configured.{' '}
          <a href="/data-sources/new" className="text-accent hover:underline">
            Create one
          </a>
        </p>
      ) : (
        <>
          <Field label="Select Source">
            <StyledSelect
              value={selectedDataSourceId?.toString() || ''}
              onChange={handleDataSourceChange}
              options={[
                { value: '', label: 'None (static content)' },
                ...dataSources.map(ds => ({
                  value: ds.id.toString(),
                  label: ds.name,
                })),
              ]}
            />
          </Field>

          {selectedDataSourceId && (
            <Field label="Select Field">
              {loadingFields ? (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-text-placeholder bg-bg-muted rounded-lg">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading fields...
                </div>
              ) : fields.length === 0 ? (
                <p className="text-xs text-text-muted px-3 py-2 bg-bg-muted rounded-lg">
                  No compatible fields found
                </p>
              ) : (
                <StyledSelect
                  value={selectedField || ''}
                  onChange={handleFieldChange}
                  options={[
                    { value: '', label: 'Select a field...' },
                    ...fields.map(field => ({
                      value: field.path,
                      label: `${field.path} (${field.type}${field.isImageUrl ? ', image' : ''})`,
                    })),
                  ]}
                />
              )}
            </Field>
          )}

          {selectedField && (
            <div className="text-xs text-accent bg-accent-light px-2 py-1.5 rounded flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Using dynamic data from: {selectedField}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function WidgetSettingsPanel({
  widget,
  template,
  allWidgets = [],
  templates = [],
  onUpdateWidget,
  onDeleteWidget,
  onSelectWidget,
}: WidgetSettingsPanelProps) {
  const [isWidgetListExpanded, setIsWidgetListExpanded] = useState(true);
  const [customWidgetData, setCustomWidgetData] = useState<CustomWidget | null>(null);
  const [selectedGridCell, setSelectedGridCell] = useState<string | null>(null);
  const [loadingCustomWidget, setLoadingCustomWidget] = useState(false);

  // Extract customWidgetId for dependency tracking
  const customWidgetId = widget?.config.customWidgetId as number | undefined;
  const templateName = template?.name;
  const isCustomWidget = templateName?.startsWith('custom-') ?? false;

  // Load custom widget data when template is a custom widget
  useEffect(() => {
    if (!isCustomWidget || !customWidgetId) {
      setCustomWidgetData(null);
      setSelectedGridCell(null);
      return;
    }

    const loadCustomWidget = async () => {
      setLoadingCustomWidget(true);
      try {
        const data = await customWidgetService.getById(customWidgetId);
        setCustomWidgetData(data);
      } catch (error) {
        console.error('Failed to load custom widget:', error);
        setCustomWidgetData(null);
      } finally {
        setLoadingCustomWidget(false);
      }
    };

    loadCustomWidget();
  }, [customWidgetId, isCustomWidget]);

  /**
   * Update a config property
   */
  const updateConfig = useCallback(
    (key: string, value: unknown) => {
      if (!widget) return;
      onUpdateWidget({
        config: {
          ...widget.config,
          [key]: value,
        },
      });
    },
    [widget, onUpdateWidget]
  );

  // Helper to update cell override settings
  const updateCellOverride = useCallback(
    (cellKey: string, overrideKey: keyof GridCellOverride, value: unknown) => {
      if (!widget) return;
      const cellOverrides = (widget.config.cellOverrides as Record<string, GridCellOverride>) || {};
      const cellOverride = cellOverrides[cellKey] || {};

      onUpdateWidget({
        config: {
          ...widget.config,
          cellOverrides: {
            ...cellOverrides,
            [cellKey]: {
              ...cellOverride,
              [overrideKey]: value,
            },
          },
        },
      });
    },
    [widget, onUpdateWidget]
  );

  // Helper to get cell override value with fallback to global config
  const getCellOverrideValue = useCallback(
    (cellKey: string, overrideKey: keyof GridCellOverride, defaultValue: unknown) => {
      if (!widget) return defaultValue;
      const cellOverrides = (widget.config.cellOverrides as Record<string, GridCellOverride>) || {};
      const cellOverride = cellOverrides[cellKey];
      if (cellOverride && cellOverride[overrideKey] !== undefined) {
        return cellOverride[overrideKey];
      }
      // Fall back to global config for font settings
      if (overrideKey === 'fontSize') return widget.config.fontSize || defaultValue;
      if (overrideKey === 'fontWeight') return widget.config.fontWeight || defaultValue;
      if (overrideKey === 'fontFamily') return widget.config.fontFamily || defaultValue;
      return defaultValue;
    },
    [widget]
  );

  // Helper to get template for a widget
  // For custom widgets (templateId >= 10000), always look up from templates array
  // to get the actual custom widget name, since w.template from DB is the base template
  const CUSTOM_WIDGET_TEMPLATE_OFFSET = 10000;
  const getTemplateForWidget = (w: ScreenWidget) => {
    // For custom widgets, prefer looking up from templates to get actual name
    if (w.templateId >= CUSTOM_WIDGET_TEMPLATE_OFFSET) {
      return templates.find(t => t.id === w.templateId) || w.template;
    }
    return w.template || templates.find(t => t.id === w.templateId);
  };

  // Widget list component - reusable for both states
  const WidgetList = () => (
    <div className="border-b border-border-light">
      <button
        onClick={() => setIsWidgetListExpanded(!isWidgetListExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-bg-muted transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-text-placeholder transition-transform ${isWidgetListExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-medium text-text-secondary">Active Widgets</span>
        </div>
        <span className="text-xs text-text-placeholder bg-bg-muted px-2 py-0.5 rounded-full">
          {allWidgets.length}
        </span>
      </button>
      {isWidgetListExpanded && (
        <div className="px-2 pb-2 max-h-64 overflow-y-auto">
          {allWidgets.length === 0 ? (
            <p className="text-xs text-text-placeholder text-center py-4">No widgets added yet</p>
          ) : (
            <div className="space-y-1">
              {allWidgets.map((w) => {
                const wTemplate = getTemplateForWidget(w);
                const isSelected = widget?.id === w.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => onSelectWidget?.(w.id)}
                    className={`
                      w-full px-3 py-2 rounded-lg text-left text-sm transition-colors
                      flex items-center gap-2
                      ${isSelected
                        ? 'bg-accent-light text-accent ring-1 ring-accent'
                        : 'hover:bg-bg-muted text-text-secondary'
                      }
                    `}
                  >
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-accent' : 'bg-border-default'}`} />
                    <span className="flex-1 truncate">
                      {wTemplate?.label || 'Unknown'}
                    </span>
                    {(w.rotation || 0) !== 0 && (
                      <span className="text-xs text-text-placeholder">{w.rotation}°</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (!widget || !template) {
    return (
      <div className="w-72 bg-bg-card border-l border-border-light flex flex-col h-full">
        {/* Widget list when nothing selected */}
        {allWidgets.length > 0 && <WidgetList />}

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="w-12 h-12 rounded-xl bg-bg-muted flex items-center justify-center mb-3">
            <svg
              className="w-6 h-6 text-text-placeholder"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-text-secondary mb-1">No Selection</p>
          <p className="text-xs text-text-placeholder text-center">
            Select a widget to edit its properties
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 bg-bg-card border-l border-border-light flex flex-col h-full">
      {/* Active Widgets List */}
      {allWidgets.length > 0 && <WidgetList />}

      {/* Header */}
      <div className="p-4 border-b border-border-light">
        <h2 className="text-sm font-semibold text-text-primary">{template.label}</h2>
        {template.description && (
          <p className="text-xs text-text-muted mt-0.5">{template.description}</p>
        )}
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto">
        {/* Position and Size */}
        <SettingSection title="Position & Size">
          <div className="grid grid-cols-2 gap-2">
            <Field label="X">
              <NumberInput
                value={widget.x}
                onChange={(v) => onUpdateWidget({ x: v })}
                min={0}
              />
            </Field>
            <Field label="Y">
              <NumberInput
                value={widget.y}
                onChange={(v) => onUpdateWidget({ y: v })}
                min={0}
              />
            </Field>
            <Field label="Width">
              <NumberInput
                value={widget.width}
                onChange={(v) => onUpdateWidget({ width: v })}
                min={10}
              />
            </Field>
            <Field label="Height">
              <NumberInput
                value={widget.height}
                onChange={(v) => onUpdateWidget({ height: v })}
                min={10}
              />
            </Field>
          </div>
          <Field label="Rotation">
            <div className="space-y-2">
              <p className="text-xs text-text-placeholder mb-1">
                Rotates widget and its content
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    // Rotate 90° clockwise: swap dimensions, adjust position, and update widget config
                    const centerX = widget.x + widget.width / 2;
                    const centerY = widget.y + widget.height / 2;
                    const newWidth = widget.height;
                    const newHeight = widget.width;

                    // Build updates including rotated config
                    const updates: Partial<ScreenWidget> = {
                      width: newWidth,
                      height: newHeight,
                      x: Math.round(centerX - newWidth / 2),
                      y: Math.round(centerY - newHeight / 2),
                    };

                    // Toggle orientation for dividers
                    if (template.name === 'divider') {
                      const currentOrientation = widget.config.orientation as string || 'horizontal';
                      updates.config = {
                        ...widget.config,
                        orientation: currentOrientation === 'horizontal' ? 'vertical' : 'horizontal',
                      };
                    }

                    // Update text alignment rotation for text widgets
                    if (template.name === 'text') {
                      // Could add vertical text support here in future
                      updates.config = {
                        ...widget.config,
                      };
                    }

                    onUpdateWidget(updates);
                  }}
                  className="flex-1 px-2 py-1.5 text-xs rounded transition-colors bg-bg-muted text-text-secondary hover:bg-border-light flex items-center justify-center gap-1"
                  title="Rotate 90° clockwise"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  90° CW
                </button>
                <button
                  onClick={() => {
                    // Rotate 90° counter-clockwise: swap dimensions, adjust position, and update widget config
                    const centerX = widget.x + widget.width / 2;
                    const centerY = widget.y + widget.height / 2;
                    const newWidth = widget.height;
                    const newHeight = widget.width;

                    // Build updates including rotated config
                    const updates: Partial<ScreenWidget> = {
                      width: newWidth,
                      height: newHeight,
                      x: Math.round(centerX - newWidth / 2),
                      y: Math.round(centerY - newHeight / 2),
                    };

                    // Toggle orientation for dividers
                    if (template.name === 'divider') {
                      const currentOrientation = widget.config.orientation as string || 'horizontal';
                      updates.config = {
                        ...widget.config,
                        orientation: currentOrientation === 'horizontal' ? 'vertical' : 'horizontal',
                      };
                    }

                    onUpdateWidget(updates);
                  }}
                  className="flex-1 px-2 py-1.5 text-xs rounded transition-colors bg-bg-muted text-text-secondary hover:bg-border-light flex items-center justify-center gap-1"
                  title="Rotate 90° counter-clockwise"
                >
                  <svg className="w-3.5 h-3.5 transform scale-x-[-1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  90° CCW
                </button>
              </div>
            </div>
          </Field>
        </SettingSection>

        {/* Widget-specific settings */}
        <SettingSection title="Settings">
          {/* Clock settings */}
          {template.name === 'clock' && (
            <div className="space-y-3">
              <Field label="Timezone">
                <SearchableSelect
                  value={(widget.config.timezone as string) || browserTimezone}
                  onChange={(value) => {
                    // If 'local' selected, store actual browser timezone (not 'local' string)
                    // This ensures the backend knows the exact timezone to use
                    const actualTimezone = value === 'local' ? browserTimezone : value;
                    updateConfig('timezone', actualTimezone);
                  }}
                  options={getTimezoneOptions()}
                  searchFn={searchTimezones}
                  placeholder="Search city or timezone..."
                />
              </Field>
              <Field label="Time Format">
                <StyledSelect
                  value={(widget.config.format as string) || '24h'}
                  onChange={(e) => updateConfig('format', e.target.value)}
                  options={timeFormats}
                />
              </Field>
              <Field label="Font Size">
                <NumberInput
                  value={(widget.config.fontSize as number) || 48}
                  onChange={(v) => updateConfig('fontSize', v)}
                  min={1}
                />
              </Field>
              <Field label="Font Family">
                <StyledSelect
                  value={(widget.config.fontFamily as string) || 'monospace'}
                  onChange={(e) => updateConfig('fontFamily', e.target.value)}
                  options={fontFamilies}
                />
              </Field>
              <Field label="Alignment">
                <div className="flex gap-1 p-1 bg-bg-muted rounded-lg">
                  {textAlignments.map((align) => (
                    <button
                      key={align.value}
                      onClick={() => updateConfig('textAlign', align.value)}
                      className={`
                        flex-1 p-2 rounded-md transition-colors
                        ${(widget.config.textAlign as string) === align.value || (!widget.config.textAlign && align.value === 'left')
                          ? 'bg-bg-card text-text-secondary shadow-sm'
                          : 'text-text-muted hover:text-text-secondary'
                        }
                      `}
                      title={align.label}
                    >
                      <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={align.icon} />
                      </svg>
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {/* Date settings */}
          {template.name === 'date' && (
            <div className="space-y-3">
              <Field label="Language">
                <StyledSelect
                  value={(widget.config.locale as string) || 'en-US'}
                  onChange={(e) => updateConfig('locale', e.target.value)}
                  options={localeOptions}
                />
              </Field>
              <Field label="Timezone">
                <SearchableSelect
                  value={(widget.config.timezone as string) || browserTimezone}
                  onChange={(value) => {
                    // If 'local' selected, store actual browser timezone (not 'local' string)
                    // This ensures the backend knows the exact timezone to use
                    const actualTimezone = value === 'local' ? browserTimezone : value;
                    updateConfig('timezone', actualTimezone);
                  }}
                  options={getTimezoneOptions()}
                  searchFn={searchTimezones}
                  placeholder="Search city or timezone..."
                />
              </Field>
              <div className="space-y-1 pt-1">
                <p className="text-xs font-medium text-text-muted mb-2">Display Options</p>
                <ToggleSwitch
                  id="showWeekday"
                  label="Show weekday"
                  checked={(widget.config.showWeekday as boolean) ?? (widget.config.showDayOfWeek as boolean) ?? false}
                  onChange={(checked) => updateConfig('showWeekday', checked)}
                />
                <ToggleSwitch
                  id="showDay"
                  label="Show day number"
                  checked={(widget.config.showDay as boolean) ?? true}
                  onChange={(checked) => updateConfig('showDay', checked)}
                />
                <ToggleSwitch
                  id="showMonth"
                  label="Show month"
                  checked={(widget.config.showMonth as boolean) ?? true}
                  onChange={(checked) => updateConfig('showMonth', checked)}
                />
                <ToggleSwitch
                  id="showYear"
                  label="Show year"
                  checked={(widget.config.showYear as boolean) ?? true}
                  onChange={(checked) => updateConfig('showYear', checked)}
                />
              </div>
              <Field label="Font Size">
                <NumberInput
                  value={(widget.config.fontSize as number) || 24}
                  onChange={(v) => updateConfig('fontSize', v)}
                  min={1}
                />
              </Field>
              <Field label="Font Family">
                <StyledSelect
                  value={(widget.config.fontFamily as string) || 'sans-serif'}
                  onChange={(e) => updateConfig('fontFamily', e.target.value)}
                  options={fontFamilies}
                />
              </Field>
              <Field label="Alignment">
                <div className="flex gap-1 p-1 bg-bg-muted rounded-lg">
                  {textAlignments.map((align) => (
                    <button
                      key={align.value}
                      onClick={() => updateConfig('textAlign', align.value)}
                      className={`
                        flex-1 p-2 rounded-md transition-colors
                        ${(widget.config.textAlign as string) === align.value || (!widget.config.textAlign && align.value === 'center')
                          ? 'bg-bg-card text-text-secondary shadow-sm'
                          : 'text-text-muted hover:text-text-secondary'
                        }
                      `}
                      title={align.label}
                    >
                      <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={align.icon} />
                      </svg>
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {/* Weather settings */}
          {template.name === 'weather' && (
            <WeatherWidgetSettings widget={widget} updateConfig={updateConfig} onUpdateWidget={onUpdateWidget} />
          )}

          {/* Text settings */}
          {template.name === 'text' && (
            <div className="space-y-3">
              {/* Data Source Selection */}
              <DataSourceSelector
                widget={widget}
                updateConfig={updateConfig}
                fieldFilter={(field) => field.type === 'string' || field.type === 'number'}
                label="Dynamic Text (Optional)"
              />

              {/* Static text - shown when no data source is selected */}
              {!widget.config.dataSourceId && (
                <Field label="Text Content">
                  <textarea
                    value={(widget.config.text as string) || ''}
                    onChange={(e) => updateConfig('text', e.target.value)}
                    className="w-full px-3 py-2 bg-bg-muted border border-border-light rounded-lg text-sm text-text-primary placeholder-text-placeholder focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent focus:bg-bg-card transition-all resize-none"
                    rows={3}
                    placeholder="Enter text..."
                  />
                </Field>
              )}
              <Field label="Font Size">
                <NumberInput
                  value={(widget.config.fontSize as number) || 24}
                  onChange={(v) => updateConfig('fontSize', v)}
                  min={1}
                />
              </Field>
              <Field label="Font Family">
                <StyledSelect
                  value={(widget.config.fontFamily as string) || 'sans-serif'}
                  onChange={(e) => updateConfig('fontFamily', e.target.value)}
                  options={fontFamilies}
                />
              </Field>
              <Field label="Font Weight">
                <StyledSelect
                  value={(widget.config.fontWeight as string) || 'normal'}
                  onChange={(e) => updateConfig('fontWeight', e.target.value)}
                  options={fontWeights}
                />
              </Field>
              <Field label="Alignment">
                <div className="flex gap-1 p-1 bg-bg-muted rounded-lg">
                  {textAlignments.map((align) => (
                    <button
                      key={align.value}
                      onClick={() => updateConfig('textAlign', align.value)}
                      className={`
                        flex-1 p-2 rounded-md transition-colors
                        ${(widget.config.textAlign as string) === align.value || (!widget.config.textAlign && align.value === 'left')
                          ? 'bg-bg-card text-text-secondary shadow-sm'
                          : 'text-text-muted hover:text-text-secondary'
                        }
                      `}
                      title={align.label}
                    >
                      <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={align.icon} />
                      </svg>
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {/* QR Code settings */}
          {template.name === 'qrcode' && (
            <div className="space-y-3">
              <Field label="Content">
                <StyledInput
                  type="text"
                  value={(widget.config.content as string) || ''}
                  onChange={(e) => updateConfig('content', e.target.value)}
                  placeholder="https://example.com"
                />
              </Field>
              <Field label="Size">
                <NumberInput
                  value={(widget.config.size as number) || 100}
                  onChange={(v) => updateConfig('size', v)}
                  min={50}
                  max={300}
                />
              </Field>
            </div>
          )}

          {/* Battery settings */}
          {template.name === 'battery' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <ToggleSwitch
                  id="showBatteryIcon"
                  label="Show icon"
                  checked={(widget.config.showIcon as boolean) !== false}
                  onChange={(checked) => updateConfig('showIcon', checked)}
                />
                <ToggleSwitch
                  id="showPercentage"
                  label="Show percentage"
                  checked={(widget.config.showPercentage as boolean) !== false}
                  onChange={(checked) => updateConfig('showPercentage', checked)}
                />
              </div>
              <Field label="Font Size">
                <NumberInput
                  value={(widget.config.fontSize as number) || 16}
                  onChange={(v) => updateConfig('fontSize', v)}
                  min={8}
                  max={48}
                />
              </Field>
            </div>
          )}

          {/* Days Until settings */}
          {template.name === 'daysuntil' && (
            <div className="space-y-3">
              <Field label="Target Date">
                <StyledInput
                  type="date"
                  value={(widget.config.targetDate as string) || '2025-12-25'}
                  onChange={(e) => updateConfig('targetDate', e.target.value)}
                />
              </Field>
              <Field label="Text Before Number" hint="e.g., 'Days till Christmas: ' or 'Dni do wakacji: '">
                <StyledInput
                  type="text"
                  value={(widget.config.labelPrefix as string) ?? 'Days till Christmas: '}
                  onChange={(e) => updateConfig('labelPrefix', e.target.value)}
                  placeholder="Days till Christmas: "
                />
              </Field>
              <Field label="Text After Number" hint="e.g., ' days' or ' dni' (leave empty for none)">
                <StyledInput
                  type="text"
                  value={(widget.config.labelSuffix as string) || ''}
                  onChange={(e) => updateConfig('labelSuffix', e.target.value)}
                  placeholder=" days"
                />
              </Field>
              <Field label="Font Size">
                <NumberInput
                  value={(widget.config.fontSize as number) || 32}
                  onChange={(v) => updateConfig('fontSize', v)}
                  min={1}
                />
              </Field>
              <Field label="Font Family">
                <StyledSelect
                  value={(widget.config.fontFamily as string) || 'sans-serif'}
                  onChange={(e) => updateConfig('fontFamily', e.target.value)}
                  options={fontFamilies}
                />
              </Field>
            </div>
          )}

          {/* Countdown settings */}
          {template.name === 'countdown' && (
            <div className="space-y-3">
              <Field label="Label">
                <StyledInput
                  type="text"
                  value={(widget.config.label as string) || ''}
                  onChange={(e) => updateConfig('label', e.target.value)}
                  placeholder="e.g., New Year Countdown"
                />
              </Field>
              <Field label="Target Date & Time">
                <StyledInput
                  type="datetime-local"
                  value={(widget.config.targetDate as string) || '2025-12-31T23:59'}
                  onChange={(e) => updateConfig('targetDate', e.target.value)}
                />
              </Field>
              <div className="space-y-1 pt-1">
                <ToggleSwitch
                  id="showDays"
                  label="Show days"
                  checked={(widget.config.showDays as boolean) !== false}
                  onChange={(checked) => updateConfig('showDays', checked)}
                />
                <ToggleSwitch
                  id="showHours"
                  label="Show hours"
                  checked={(widget.config.showHours as boolean) !== false}
                  onChange={(checked) => updateConfig('showHours', checked)}
                />
                <ToggleSwitch
                  id="showMinutes"
                  label="Show minutes"
                  checked={(widget.config.showMinutes as boolean) !== false}
                  onChange={(checked) => updateConfig('showMinutes', checked)}
                />
                <ToggleSwitch
                  id="showCountdownSeconds"
                  label="Show seconds"
                  checked={(widget.config.showSeconds as boolean) !== false}
                  onChange={(checked) => updateConfig('showSeconds', checked)}
                />
              </div>
              <Field label="Font Size">
                <NumberInput
                  value={(widget.config.fontSize as number) || 32}
                  onChange={(v) => updateConfig('fontSize', v)}
                  min={1}
                />
              </Field>
              <Field label="Font Family">
                <StyledSelect
                  value={(widget.config.fontFamily as string) || 'monospace'}
                  onChange={(e) => updateConfig('fontFamily', e.target.value)}
                  options={fontFamilies}
                />
              </Field>
            </div>
          )}

          {/* Image settings */}
          {template.name === 'image' && (
            <ImageWidgetSettings
              widget={widget}
              updateConfig={updateConfig}
            />
          )}

          {/* Divider settings */}
          {template.name === 'divider' && (
            <div className="space-y-3">
              <Field label="Orientation">
                <StyledSelect
                  value={(widget.config.orientation as string) || 'horizontal'}
                  onChange={(e) => updateConfig('orientation', e.target.value)}
                  options={[
                    { value: 'horizontal', label: 'Horizontal' },
                    { value: 'vertical', label: 'Vertical' },
                  ]}
                />
              </Field>
              <Field label="Thickness">
                <NumberInput
                  value={(widget.config.thickness as number) || 2}
                  onChange={(v) => updateConfig('thickness', v)}
                  min={1}
                  max={100}
                />
              </Field>
              <Field label="Style">
                <StyledSelect
                  value={(widget.config.style as string) || 'solid'}
                  onChange={(e) => updateConfig('style', e.target.value)}
                  options={[
                    { value: 'solid', label: 'Solid' },
                    { value: 'dashed', label: 'Dashed' },
                    { value: 'dotted', label: 'Dotted' },
                  ]}
                />
              </Field>
              <Field label="Color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={(widget.config.color as string) || '#000000'}
                    onChange={(e) => updateConfig('color', e.target.value)}
                    className="w-9 h-9 rounded-lg border border-border-light cursor-pointer p-0.5"
                  />
                  <StyledInput
                    type="text"
                    value={(widget.config.color as string) || '#000000'}
                    onChange={(e) => updateConfig('color', e.target.value)}
                    className="flex-1 font-mono text-xs"
                  />
                </div>
              </Field>
            </div>
          )}

          {/* Rectangle settings */}
          {template.name === 'rectangle' && (
            <div className="space-y-3">
              <Field label="Background Color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={(widget.config.backgroundColor as string) || '#000000'}
                    onChange={(e) => updateConfig('backgroundColor', e.target.value)}
                    className="w-9 h-9 rounded-lg border border-border-light cursor-pointer p-0.5"
                  />
                  <StyledInput
                    type="text"
                    value={(widget.config.backgroundColor as string) || '#000000'}
                    onChange={(e) => updateConfig('backgroundColor', e.target.value)}
                    className="flex-1 font-mono text-xs"
                  />
                </div>
              </Field>
              <Field label="Border Width">
                <NumberInput
                  value={(widget.config.borderWidth as number) || 0}
                  onChange={(v) => updateConfig('borderWidth', v)}
                  min={0}
                  max={20}
                />
              </Field>
              <Field label="Border Color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={(widget.config.borderColor as string) || '#000000'}
                    onChange={(e) => updateConfig('borderColor', e.target.value)}
                    className="w-9 h-9 rounded-lg border border-border-light cursor-pointer p-0.5"
                  />
                  <StyledInput
                    type="text"
                    value={(widget.config.borderColor as string) || '#000000'}
                    onChange={(e) => updateConfig('borderColor', e.target.value)}
                    className="flex-1 font-mono text-xs"
                  />
                </div>
              </Field>
            </div>
          )}

          {/* WiFi settings */}
          {template.name === 'wifi' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <ToggleSwitch
                  id="showWifiIcon"
                  label="Show icon"
                  checked={(widget.config.showIcon as boolean) !== false}
                  onChange={(checked) => updateConfig('showIcon', checked)}
                />
                <ToggleSwitch
                  id="showStrength"
                  label="Show signal strength"
                  checked={(widget.config.showStrength as boolean) !== false}
                  onChange={(checked) => updateConfig('showStrength', checked)}
                />
              </div>
              <Field label="Font Size">
                <NumberInput
                  value={(widget.config.fontSize as number) || 16}
                  onChange={(v) => updateConfig('fontSize', v)}
                  min={1}
                />
              </Field>
            </div>
          )}

          {/* Device Info settings */}
          {template.name === 'deviceinfo' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <ToggleSwitch
                  id="showDeviceName"
                  label="Show device name"
                  checked={(widget.config.showName as boolean) !== false}
                  onChange={(checked) => updateConfig('showName', checked)}
                />
                <ToggleSwitch
                  id="showFirmware"
                  label="Show firmware version"
                  checked={(widget.config.showFirmware as boolean) !== false}
                  onChange={(checked) => updateConfig('showFirmware', checked)}
                />
                <ToggleSwitch
                  id="showMac"
                  label="Show MAC address"
                  checked={(widget.config.showMac as boolean) || false}
                  onChange={(checked) => updateConfig('showMac', checked)}
                />
              </div>
              <Field label="Font Size">
                <NumberInput
                  value={(widget.config.fontSize as number) || 14}
                  onChange={(v) => updateConfig('fontSize', v)}
                  min={1}
                />
              </Field>
            </div>
          )}

          {/* GitHub Stars settings */}
          {template.name === 'github' && (
            <div className="space-y-3">
              <Field label="Repository Owner" hint="e.g., 'facebook' for github.com/facebook/react">
                <StyledInput
                  type="text"
                  value={(widget.config.owner as string) || ''}
                  onChange={(e) => updateConfig('owner', e.target.value)}
                  placeholder="facebook"
                />
              </Field>
              <Field label="Repository Name" hint="e.g., 'react'">
                <StyledInput
                  type="text"
                  value={(widget.config.repo as string) || ''}
                  onChange={(e) => updateConfig('repo', e.target.value)}
                  placeholder="react"
                />
              </Field>
              <div className="space-y-1">
                <ToggleSwitch
                  id="showGitHubIcon"
                  label="Show star icon"
                  checked={(widget.config.showIcon as boolean) !== false}
                  onChange={(checked) => updateConfig('showIcon', checked)}
                />
                <ToggleSwitch
                  id="showRepoName"
                  label="Show repository name"
                  checked={(widget.config.showRepoName as boolean) || false}
                  onChange={(checked) => updateConfig('showRepoName', checked)}
                />
              </div>
              <Field label="Font Size">
                <NumberInput
                  value={(widget.config.fontSize as number) || 32}
                  onChange={(v) => updateConfig('fontSize', v)}
                  min={8}
                  max={200}
                />
              </Field>
              <Field label="Font Family">
                <StyledSelect
                  value={(widget.config.fontFamily as string) || 'sans-serif'}
                  onChange={(e) => updateConfig('fontFamily', e.target.value)}
                  options={fontFamilies}
                />
              </Field>
              <p className="text-xs text-text-muted">
                Fetches star count from GitHub API. Configure GITHUB_TOKEN in backend for higher rate limits.
              </p>
            </div>
          )}

          {/* Custom Widget settings - matches custom-1, custom-2, etc. */}
          {template.name.startsWith('custom-') && (
            <div className="space-y-3">
              <div className="p-3 bg-accent-light rounded-lg border border-border-light">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-xs font-medium text-accent">Custom Widget</span>
                </div>
                <p className="text-xs text-accent">
                  {customWidgetData?.displayType === 'grid'
                    ? 'Grid widget. Click cells below to customize each one.'
                    : 'Configure the appearance below.'}
                </p>
              </div>

              {/* Default/Global Settings */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Default Settings</p>
                <Field label="Font Size">
                  <NumberInput
                    value={(widget.config.fontSize as number) || 24}
                    onChange={(v) => updateConfig('fontSize', v)}
                    min={8}
                    max={200}
                  />
                </Field>
                <Field label="Font Family">
                  <StyledSelect
                    value={(widget.config.fontFamily as string) || 'sans-serif'}
                    onChange={(e) => updateConfig('fontFamily', e.target.value)}
                    options={fontFamilies}
                  />
                </Field>
                <Field label="Font Weight">
                  <StyledSelect
                    value={(widget.config.fontWeight as string) || 'normal'}
                    onChange={(e) => updateConfig('fontWeight', e.target.value)}
                    options={fontWeights}
                  />
                </Field>

                {/* Alignment options for non-grid custom widgets */}
                {customWidgetData?.displayType !== 'grid' && (
                  <>
                    <Field label="Horizontal Alignment">
                      <div className="flex gap-1 p-1 bg-bg-muted rounded-lg">
                        {textAlignments.map((align) => {
                          const currentAlign = (widget.config.textAlign as string) || 'center';
                          return (
                            <button
                              key={align.value}
                              type="button"
                              onClick={() => updateConfig('textAlign', align.value)}
                              className={`
                                flex-1 p-1.5 rounded-md transition-colors
                                ${currentAlign === align.value
                                  ? 'bg-bg-card text-accent shadow-sm'
                                  : 'text-text-muted hover:text-text-secondary'
                                }
                              `}
                              title={align.label}
                            >
                              <svg className="w-3 h-3 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={align.icon} />
                              </svg>
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                    <Field label="Vertical Alignment">
                      <div className="flex gap-1 p-1 bg-bg-muted rounded-lg">
                        {([
                          { value: 'top', label: 'Top', icon: 'M5 15l7-7 7 7' },
                          { value: 'middle', label: 'Middle', icon: 'M4 12h16' },
                          { value: 'bottom', label: 'Bottom', icon: 'M19 9l-7 7-7-7' },
                        ] as const).map((vAlign) => {
                          const currentVAlign = (widget.config.verticalAlign as string) || 'middle';
                          return (
                            <button
                              key={vAlign.value}
                              type="button"
                              onClick={() => updateConfig('verticalAlign', vAlign.value)}
                              className={`
                                flex-1 p-1.5 rounded-md transition-colors
                                ${currentVAlign === vAlign.value
                                  ? 'bg-bg-card text-accent shadow-sm'
                                  : 'text-text-muted hover:text-text-secondary'
                                }
                              `}
                              title={vAlign.label}
                            >
                              <svg className="w-3 h-3 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={vAlign.icon} />
                              </svg>
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                  </>
                )}
              </div>

              {/* Grid Cell Settings - only for grid type custom widgets */}
              {customWidgetData?.displayType === 'grid' && (
                <div className="space-y-3 pt-3 border-t border-border-light">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Cell Settings</p>

                  {loadingCustomWidget ? (
                    <div className="flex items-center gap-2 text-xs text-text-placeholder py-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading grid...
                    </div>
                  ) : (
                    <>
                      {/* Grid cell selector */}
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-2">
                          Click a cell to customize
                        </label>
                        <div
                          className="grid gap-1 p-2 bg-bg-muted rounded-lg"
                          style={{
                            gridTemplateColumns: `repeat(${(customWidgetData.config as Record<string, unknown>)?.gridCols || 2}, 1fr)`,
                            gridTemplateRows: `repeat(${(customWidgetData.config as Record<string, unknown>)?.gridRows || 2}, minmax(32px, 1fr))`,
                          }}
                        >
                          {(() => {
                            const cwConfig = customWidgetData.config as Record<string, unknown>;
                            const gridCols = (cwConfig?.gridCols as number) || 2;
                            const gridRows = (cwConfig?.gridRows as number) || 2;
                            const gridCells = (cwConfig?.gridCells as Record<string, { field?: string; label?: string; fieldType?: string }>) || {};

                            return Array.from({ length: gridRows * gridCols }).map((_, index) => {
                              const row = Math.floor(index / gridCols);
                              const col = index % gridCols;
                              const cellKey = `${row}-${col}`;
                              const cellConfig = gridCells[cellKey];
                              const isConfigured = !!cellConfig?.field;
                              const isSelected = selectedGridCell === cellKey;
                              const hasOverride = !!(widget.config.cellOverrides as Record<string, unknown>)?.[cellKey];

                              return (
                                <button
                                  key={cellKey}
                                  type="button"
                                  onClick={() => setSelectedGridCell(isSelected ? null : cellKey)}
                                  disabled={!isConfigured}
                                  className={`
                                    rounded border-2 transition-all text-[10px] p-1 truncate
                                    ${isSelected
                                      ? 'border-accent bg-accent-light ring-1 ring-accent'
                                      : isConfigured
                                        ? hasOverride
                                          ? 'border-status-success-border bg-status-success-bg hover:border-accent'
                                          : 'border-border-default bg-bg-card hover:border-accent'
                                        : 'border-border-light bg-bg-muted text-text-placeholder cursor-not-allowed'
                                    }
                                  `}
                                  title={isConfigured ? (cellConfig?.label || cellConfig?.field || cellKey) : 'Empty cell'}
                                >
                                  {isConfigured ? (cellConfig?.label || cellConfig?.field || '...') : '-'}
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Selected cell settings */}
                      {selectedGridCell && (() => {
                        const cwConfig = customWidgetData.config as Record<string, unknown>;
                        const gridCells = (cwConfig?.gridCells as Record<string, { field?: string; label?: string; fieldType?: string }>) || {};
                        const cellConfig = gridCells[selectedGridCell];
                        const isImageCell = cellConfig?.fieldType === 'image';

                        return (
                          <div className="p-3 bg-bg-card rounded-lg border border-accent space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-medium text-text-primary">
                                {cellConfig?.label || cellConfig?.field || `Cell ${selectedGridCell}`}
                              </h4>
                              <button
                                type="button"
                                onClick={() => {
                                  // Clear this cell's overrides
                                  const cellOverrides = { ...((widget.config.cellOverrides as Record<string, GridCellOverride>) || {}) };
                                  delete cellOverrides[selectedGridCell];
                                  updateConfig('cellOverrides', cellOverrides);
                                }}
                                className="text-[10px] text-text-muted hover:text-status-error-text"
                              >
                                Reset
                              </button>
                            </div>

                            {isImageCell ? (
                              /* Image cell settings */
                              <>
                                <Field label="Image Fit">
                                  <StyledSelect
                                    value={getCellOverrideValue(selectedGridCell, 'imageFit', 'contain') as string}
                                    onChange={(e) => updateCellOverride(selectedGridCell, 'imageFit', e.target.value)}
                                    options={[
                                      { value: 'contain', label: 'Contain' },
                                      { value: 'cover', label: 'Cover' },
                                      { value: 'fill', label: 'Fill' },
                                    ]}
                                  />
                                </Field>
                              </>
                            ) : (
                              /* Text cell settings */
                              <>
                                <Field label="Font Size">
                                  <NumberInput
                                    value={getCellOverrideValue(selectedGridCell, 'fontSize', 24) as number}
                                    onChange={(v) => updateCellOverride(selectedGridCell, 'fontSize', v)}
                                    min={8}
                                    max={200}
                                  />
                                </Field>
                                <Field label="Font Weight">
                                  <StyledSelect
                                    value={getCellOverrideValue(selectedGridCell, 'fontWeight', 'normal') as string}
                                    onChange={(e) => updateCellOverride(selectedGridCell, 'fontWeight', e.target.value)}
                                    options={fontWeights}
                                  />
                                </Field>
                                <Field label="Font Family">
                                  <StyledSelect
                                    value={getCellOverrideValue(selectedGridCell, 'fontFamily', 'sans-serif') as string}
                                    onChange={(e) => updateCellOverride(selectedGridCell, 'fontFamily', e.target.value)}
                                    options={fontFamilies}
                                  />
                                </Field>
                                <Field label="Horizontal Alignment">
                                  <div className="flex gap-1 p-1 bg-bg-muted rounded-lg">
                                    {textAlignments.map((align) => {
                                      const currentAlign = getCellOverrideValue(selectedGridCell, 'align', 'center') as string;
                                      return (
                                        <button
                                          key={align.value}
                                          type="button"
                                          onClick={() => updateCellOverride(selectedGridCell, 'align', align.value)}
                                          className={`
                                            flex-1 p-1.5 rounded-md transition-colors
                                            ${currentAlign === align.value
                                              ? 'bg-bg-card text-accent shadow-sm'
                                              : 'text-text-muted hover:text-text-secondary'
                                            }
                                          `}
                                          title={align.label}
                                        >
                                          <svg className="w-3 h-3 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={align.icon} />
                                          </svg>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </Field>
                                <Field label="Vertical Alignment">
                                  <div className="flex gap-1 p-1 bg-bg-muted rounded-lg">
                                    {([
                                      { value: 'top', label: 'Top', icon: 'M5 15l7-7 7 7' },
                                      { value: 'middle', label: 'Middle', icon: 'M4 12h16' },
                                      { value: 'bottom', label: 'Bottom', icon: 'M19 9l-7 7-7-7' },
                                    ] as const).map((vAlign) => {
                                      const currentVAlign = getCellOverrideValue(selectedGridCell, 'verticalAlign', 'middle') as string;
                                      return (
                                        <button
                                          key={vAlign.value}
                                          type="button"
                                          onClick={() => updateCellOverride(selectedGridCell, 'verticalAlign', vAlign.value)}
                                          className={`
                                            flex-1 p-1.5 rounded-md transition-colors
                                            ${currentVAlign === vAlign.value
                                              ? 'bg-bg-card text-accent shadow-sm'
                                              : 'text-text-muted hover:text-text-secondary'
                                            }
                                          `}
                                          title={vAlign.label}
                                        >
                                          <svg className="w-3 h-3 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={vAlign.icon} />
                                          </svg>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </Field>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedGridCell(null)}
                              className="w-full px-2 py-1.5 text-xs bg-bg-muted text-text-secondary rounded hover:bg-border-light transition-colors"
                            >
                              Done
                            </button>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </SettingSection>

        {/* Layer ordering */}
        <SettingSection title="Layer" defaultExpanded={false}>
          <Field label="Z-Index">
            <NumberInput
              value={widget.zIndex}
              onChange={(v) => onUpdateWidget({ zIndex: v })}
              min={0}
              max={100}
            />
          </Field>
          <Field label="Opacity" hint="Grey level for e-ink display">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={(widget.config.opacity as number) ?? 100}
                onChange={(e) => updateConfig('opacity', parseInt(e.target.value))}
                className="flex-1 h-2 bg-bg-muted rounded-lg appearance-none cursor-pointer accent-accent"
              />
              <span className="text-sm text-text-muted w-10 text-right">
                {(widget.config.opacity as number) ?? 100}%
              </span>
            </div>
            {/* Preview of grey level */}
            <div className="mt-2 flex items-center gap-2">
              <div
                className="w-8 h-8 border border-border-light rounded"
                style={{
                  backgroundColor: `rgb(${255 - Math.round(((widget.config.opacity as number) ?? 100) / 100 * 255)}, ${255 - Math.round(((widget.config.opacity as number) ?? 100) / 100 * 255)}, ${255 - Math.round(((widget.config.opacity as number) ?? 100) / 100 * 255)})`
                }}
              />
              <span className="text-xs text-text-muted">
                {(widget.config.opacity as number) ?? 100}% = {Math.round(((widget.config.opacity as number) ?? 100) / 100 * 255)} grey
              </span>
            </div>
          </Field>
        </SettingSection>
      </div>

      {/* Footer with delete button */}
      <div className="p-4 border-t border-border-light">
        <button
          onClick={onDeleteWidget}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-status-error-text bg-status-error-bg rounded-lg hover:opacity-80 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Widget
        </button>
      </div>
    </div>
  );
}

/**
 * ImageWidgetSettings - Settings for the image widget with file upload
 * Now supports dynamic images from data sources!
 */
function ImageWidgetSettings({
  widget,
  updateConfig,
}: {
  widget: ScreenWidget;
  updateConfig: (key: string, value: unknown) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadInfo, setUploadInfo] = useState<{ size: number; compressed: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number | undefined) => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadInfo(null);

    try {
      const result = await screenDesignerService.uploadWidgetImage(file);
      // Use dynamic backend URL for the image
      const fullUrl = `${config.backendUrl}${result.url}`;
      updateConfig('url', fullUrl);
      setUploadInfo({
        size: result.size ?? file.size,
        compressed: result.compressed ?? false
      });
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const currentUrl = (widget.config.url as string) || '';
  const hasDataSource = Boolean(widget.config.dataSourceId);

  return (
    <div className="space-y-3">
      {/* Data Source Selection - filter to image URL fields */}
      <DataSourceSelector
        widget={widget}
        updateConfig={updateConfig}
        fieldFilter={(field) => field.isImageUrl === true || field.type === 'string'}
        label="Dynamic Image (Optional)"
      />

      {/* Static image options - only shown when no data source selected */}
      {!hasDataSource && (
        <>
          {/* File Upload */}
          <Field label="Upload Image">
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="hidden"
            id="widget-image-upload"
          />
          <label
            htmlFor="widget-image-upload"
            className={`
              flex items-center justify-center gap-2 w-full px-4 py-3
              border-2 border-dashed border-border-default rounded-lg cursor-pointer
              hover:border-accent hover:bg-accent-light transition-colors
              ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {isUploading ? (
              <>
                <svg className="w-5 h-5 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm text-text-secondary">Uploading...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-text-placeholder" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-sm text-text-secondary">Click to upload (max 25MB)</span>
              </>
            )}
          </label>
          {uploadError && (
            <p className="text-xs text-status-error-text">{uploadError}</p>
          )}
          {uploadInfo && (
            <p className="text-xs text-status-success-text">
              Uploaded: {formatFileSize(uploadInfo.size)}
              {uploadInfo.compressed && ' (auto-compressed for e-ink)'}
            </p>
          )}
        </div>
      </Field>

      {/* Or paste URL */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border-light" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-bg-card text-text-placeholder">or paste URL</span>
        </div>
      </div>

      <Field label="Image URL">
        <StyledInput
          type="text"
          value={currentUrl}
          onChange={(e) => updateConfig('url', e.target.value)}
          placeholder="https://example.com/image.png"
        />
      </Field>

      {/* Preview - shown as 1-bit e-ink display */}
      {currentUrl && (
        <Field label="Preview (1-bit e-ink)">
          <div className="w-full h-24 bg-bg-card rounded-lg overflow-hidden flex items-center justify-center border border-border-light">
            <img
              src={currentUrl}
              alt="Widget preview"
              className="max-w-full max-h-full object-contain"
              style={{
                filter: 'grayscale(100%) contrast(1.5)',
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </Field>
      )}
        </>
      )}

      <Field label="Fit Mode">
        <StyledSelect
          value={(widget.config.fit as string) || 'contain'}
          onChange={(e) => updateConfig('fit', e.target.value)}
          options={[
            { value: 'contain', label: 'Contain (fit inside)' },
            { value: 'cover', label: 'Cover (fill area)' },
            { value: 'fill', label: 'Fill (stretch)' },
          ]}
        />
      </Field>

      <p className="text-xs text-text-muted">
        Image is converted to 1-bit (black/white) with Floyd-Steinberg dithering, max 90KB.
      </p>
    </div>
  );
}

/**
 * WeatherWidgetSettings - Settings for the weather widget with location search
 */
function WeatherWidgetSettings({
  widget,
  updateConfig,
  onUpdateWidget,
}: {
  widget: ScreenWidget;
  updateConfig: (key: string, value: unknown) => void;
  onUpdateWidget: (updates: Partial<ScreenWidget>) => void;
}) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{
    name: string;
    country: string;
    latitude: number;
    longitude: number;
  }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Forecast day options
  const forecastDayOptions = [
    { value: '0', label: 'Today' },
    { value: '1', label: 'Tomorrow' },
    { value: '2', label: '+2 Days' },
    { value: '3', label: '+3 Days' },
    { value: '4', label: '+4 Days' },
    { value: '5', label: '+5 Days' },
    { value: '6', label: '+6 Days' },
    { value: '7', label: '+7 Days' },
  ];

  // Forecast time options
  const forecastTimeOptions = [
    { value: 'current', label: 'Current' },
    { value: 'morning', label: 'Morning (8:00)' },
    { value: 'noon', label: 'Noon (12:00)' },
    { value: 'afternoon', label: 'Afternoon (15:00)' },
    { value: 'evening', label: 'Evening (19:00)' },
    { value: 'night', label: 'Night (22:00)' },
  ];

  // Search for locations using Open-Meteo Geocoding API
  const searchLocations = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.results && Array.isArray(data.results)) {
        setSearchResults(data.results.map((r: { name: string; country?: string; latitude: number; longitude: number }) => ({
          name: r.name,
          country: r.country || '',
          latitude: r.latitude,
          longitude: r.longitude,
        })));
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Location search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Track if user is actively searching
  const [isEditing, setIsEditing] = useState(false);

  // Debounced search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsEditing(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(value);
    }, 300);
  };

  // Select a location from search results - batch all config updates
  const selectLocation = (result: typeof searchResults[0]) => {
    // Batch all location-related config changes into a single update
    onUpdateWidget({
      config: {
        ...widget.config,
        location: `${result.name}, ${result.country}`,
        latitude: result.latitude,
        longitude: result.longitude,
      },
    });
    setSearchQuery('');
    setSearchResults([]);
    setIsEditing(false);
  };

  // Handle blur - stop editing mode
  const handleBlur = () => {
    // Delay to allow click on search results
    setTimeout(() => {
      setIsEditing(false);
      setSearchQuery('');
      setSearchResults([]);
    }, 200);
  };

  return (
    <div className="space-y-3">
      {/* Location search */}
      <Field label="Location">
        <div className="relative">
          <StyledInput
            type="text"
            value={isEditing ? searchQuery : (widget.config.location as string) || ''}
            onChange={handleSearchChange}
            onFocus={() => { setIsEditing(true); setSearchQuery(''); }}
            onBlur={handleBlur}
            placeholder="Search for a city..."
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-bg-card border border-border-light rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => selectLocation(result)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent-light transition-colors border-b border-border-light last:border-b-0"
                >
                  <span className="font-medium">{result.name}</span>
                  <span className="text-text-muted ml-1">{result.country}</span>
                  <span className="text-xs text-text-placeholder ml-2">
                    ({result.latitude.toFixed(2)}, {result.longitude.toFixed(2)})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>

      {/* Coordinates (read-only display) */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Latitude">
          <NumberInput
            value={(widget.config.latitude as number) || 52.23}
            onChange={(v) => updateConfig('latitude', v)}
            step={0.0001}
          />
        </Field>
        <Field label="Longitude">
          <NumberInput
            value={(widget.config.longitude as number) || 21.01}
            onChange={(v) => updateConfig('longitude', v)}
            step={0.0001}
          />
        </Field>
      </div>

      {/* Forecast day selection */}
      <Field label="Forecast Day">
        <StyledSelect
          value={String((widget.config.forecastDay as number) || 0)}
          onChange={(e) => updateConfig('forecastDay', parseInt(e.target.value))}
          options={forecastDayOptions}
        />
      </Field>

      {/* Forecast time selection */}
      <Field label="Time of Day">
        <StyledSelect
          value={(widget.config.forecastTime as string) || 'current'}
          onChange={(e) => updateConfig('forecastTime', e.target.value)}
          options={forecastTimeOptions}
        />
      </Field>

      {/* Temperature units */}
      <Field label="Temperature Units">
        <StyledSelect
          value={(widget.config.units as string) || 'metric'}
          onChange={(e) => updateConfig('units', e.target.value)}
          options={unitOptions}
        />
      </Field>

      {/* Display toggles */}
      <div className="space-y-1 pt-1">
        <ToggleSwitch
          id="showIcon"
          label="Show weather icon"
          checked={(widget.config.showIcon as boolean) !== false}
          onChange={(checked) => updateConfig('showIcon', checked)}
        />
        <ToggleSwitch
          id="showTemperature"
          label="Show temperature"
          checked={(widget.config.showTemperature as boolean) !== false}
          onChange={(checked) => updateConfig('showTemperature', checked)}
        />
        <ToggleSwitch
          id="showCondition"
          label="Show condition text"
          checked={(widget.config.showCondition as boolean) !== false}
          onChange={(checked) => updateConfig('showCondition', checked)}
        />
        <ToggleSwitch
          id="showLocation"
          label="Show location name"
          checked={(widget.config.showLocation as boolean) !== false}
          onChange={(checked) => updateConfig('showLocation', checked)}
        />
        <ToggleSwitch
          id="showHumidity"
          label="Show humidity"
          checked={(widget.config.showHumidity as boolean) || false}
          onChange={(checked) => updateConfig('showHumidity', checked)}
        />
        <ToggleSwitch
          id="showWind"
          label="Show wind speed"
          checked={(widget.config.showWind as boolean) || false}
          onChange={(checked) => updateConfig('showWind', checked)}
        />
        <ToggleSwitch
          id="showDayName"
          label="Show day name (for forecast)"
          checked={(widget.config.showDayName as boolean) || false}
          onChange={(checked) => updateConfig('showDayName', checked)}
        />
      </div>

      {/* Font size */}
      <Field label="Font Size">
        <NumberInput
          value={(widget.config.fontSize as number) || 32}
          onChange={(v) => updateConfig('fontSize', v)}
          min={12}
          max={100}
        />
      </Field>
    </div>
  );
}
