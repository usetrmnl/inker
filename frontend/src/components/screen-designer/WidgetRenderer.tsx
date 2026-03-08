/**
 * WidgetRenderer Component
 * Renders a single widget based on its template type and configuration.
 */
import { useState, useEffect, useCallback } from 'react';
import type { ScreenWidget, WidgetTemplate } from '../../types';
import { generateQRCodeDataUrl } from '../../utils/qrcode';
import { customWidgetService, dataSourceService, screenDesignerService } from '../../services/api';
import { EInkImage } from '../common';

/**
 * Map generic CSS font families to specific loaded font names
 * Matches backend screen-renderer.service.ts for consistent rendering
 */
function mapFontFamily(fontFamily: string): string {
  switch (fontFamily) {
    case 'sans-serif':
      return "'Inter', sans-serif";
    case 'monospace':
      return "'Roboto Mono', monospace";
    case 'serif':
      return "'Merriweather', serif";
    default:
      // If already a specific font or unknown, return with fallback
      return fontFamily.includes(',') ? fontFamily : `${fontFamily}, sans-serif`;
  }
}

/**
 * Custom hook to fetch data from a data source
 *
 * This hook handles:
 * - Fetching cached data from a data source by ID
 * - Extracting a specific field using dot notation path
 * - Loading and error states
 *
 * @param dataSourceId - The ID of the data source to fetch from
 * @param fieldPath - The dot notation path to extract (e.g., "url" or "user.name")
 */
function useDataSourceField(
  dataSourceId: number | undefined,
  fieldPath: string | undefined
): { value: unknown; loading: boolean; error: string | null } {
  const [value, setValue] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract value from nested object using dot notation path
  const extractValue = useCallback((data: unknown, path: string): unknown => {
    if (!data || !path) return undefined;

    const parts = path.split('.');
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;

      // Handle array notation like "items[0]" or just "[0]"
      const arrayMatch = part.match(/^(.+?)?\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        if (key) {
          current = (current as Record<string, unknown>)[key];
        }
        if (Array.isArray(current)) {
          current = current[parseInt(index, 10)];
        } else {
          return undefined;
        }
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }

    return current;
  }, []);

  useEffect(() => {
    if (!dataSourceId || !fieldPath) {
      setValue(undefined);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await dataSourceService.getCachedData(dataSourceId);
        if (isMounted) {
          const extracted = extractValue(data, fieldPath);
          setValue(extracted);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch data');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [dataSourceId, fieldPath, extractValue]);

  return { value, loading, error };
}

interface WidgetRendererProps {
  widget: ScreenWidget;
  template: WidgetTemplate;
}

export function WidgetRenderer({ widget, template }: WidgetRendererProps) {
  const config = widget.config;

  // Render based on template type
  switch (template.name) {
    case 'clock':
      return <ClockWidget config={config} />;
    case 'date':
      return <DateWidget config={config} />;
    case 'weather':
      return <WeatherWidget config={config} />;
    case 'text':
      return <TextWidget config={config} />;
    case 'qrcode':
      return <QRCodeWidget config={config} />;
    case 'battery':
      return <BatteryWidget config={config} />;
    case 'daysuntil':
      return <DaysUntilWidget config={config} />;
    case 'countdown':
      return <CountdownWidget config={config} />;
    case 'image':
      return <ImageWidget config={config} />;
    case 'divider':
      return <DividerWidget config={config} />;
    case 'rectangle':
      return <RectangleWidget config={config} />;
    case 'wifi':
      return <WifiWidget config={config} />;
    case 'deviceinfo':
      return <DeviceInfoWidget config={config} />;
    case 'github':
      return <GitHubWidget config={config} />;
    default:
      // Check if this is a custom widget (name starts with "custom-")
      if (template.name.startsWith('custom-')) {
        return <CustomWidgetRenderer config={config} />;
      }
      return (
        <div className="flex items-center justify-center h-full text-text-placeholder text-sm">
          Unknown widget: {template.name}
        </div>
      );
  }
}

/**
 * ClockWidget - Displays current time with live updates
 *
 * Updates every second for reliability. The display format determines
 * whether seconds are shown.
 */
function ClockWidget({ config }: { config: Record<string, unknown> }) {
  const [time, setTime] = useState(() => new Date());
  const format = (config.format as string) || '24h';
  const showSeconds = config.showSeconds as boolean;
  const fontSize = (config.fontSize as number) || 48;
  const fontFamily = mapFontFamily((config.fontFamily as string) || 'monospace');
  const textAlign = (config.textAlign as string) || 'left';
  // Get configured timezone - 'local' or '' means use browser's local timezone
  const configuredTimezone = (config.timezone as string) || 'local';
  const useLocalTimezone = configuredTimezone === 'local' || configuredTimezone === '';

  // Get the browser's timezone for display when 'local' is selected
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    // Update every second for reliable time display
    const intervalId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, []); // Empty deps - interval runs for component lifetime

  const formatTime = () => {
    // Use Intl.DateTimeFormat to properly handle timezone conversion
    // When timezone is 'local', explicitly use the browser's detected timezone
    // This ensures consistent behavior and the preview shows the user's actual local time
    const effectiveTimezone = useLocalTimezone ? browserTimezone : configuredTimezone;

    const options: Intl.DateTimeFormatOptions = {
      timeZone: effectiveTimezone,
      hour: '2-digit',
      minute: '2-digit',
      second: showSeconds ? '2-digit' : undefined,
      hour12: format === '12h',
    };

    return time.toLocaleTimeString('en-US', options);
  };

  // Map textAlign to flexbox justify-content
  const justifyClass = textAlign === 'left' ? 'justify-start' : textAlign === 'right' ? 'justify-end' : 'justify-center';

  return (
    <div
      className={`flex items-center ${justifyClass} w-full h-full px-2`}
      style={{ fontSize: `${fontSize}px`, fontFamily, whiteSpace: 'nowrap' }}
    >
      {formatTime()}
    </div>
  );
}

/**
 * DateWidget - Displays current date
 *
 * Supports configurable display of: weekday, day, month, year
 * Matches backend rendering exactly for 1:1 WYSIWYG preview.
 */
function DateWidget({ config }: { config: Record<string, unknown> }) {
  const [date, setDate] = useState(new Date());
  const fontSize = (config.fontSize as number) || 24;
  const fontFamily = mapFontFamily((config.fontFamily as string) || 'sans-serif');
  const textAlign = (config.textAlign as string) || 'center';
  const locale = (config.locale as string) || 'en-US';

  // Configurable date parts (match backend defaults)
  const showWeekday = (config.showWeekday as boolean) ?? (config.showDayOfWeek as boolean) ?? false;
  const showDay = (config.showDay as boolean) ?? true;
  const showMonth = (config.showMonth as boolean) ?? true;
  const showYear = (config.showYear as boolean) ?? true;

  // Get configured timezone - 'local' or '' means use browser's local timezone
  const configuredTimezone = (config.timezone as string) || '';
  const useLocalTimezone = configuredTimezone === 'local' || configuredTimezone === '';

  // Get the browser's timezone for display when 'local' is selected
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    // Update date at midnight in the configured timezone
    const effectiveTimezone = useLocalTimezone ? browserTimezone : configuredTimezone;

    // Calculate midnight in the target timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: effectiveTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Get current time in target timezone
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
    const hours = parseInt(getPart('hour'), 10);
    const minutes = parseInt(getPart('minute'), 10);
    const seconds = parseInt(getPart('second'), 10);

    // Calculate seconds until midnight in target timezone
    const secondsUntilMidnight = (24 - hours - 1) * 3600 + (60 - minutes - 1) * 60 + (60 - seconds);
    const msUntilMidnight = secondsUntilMidnight * 1000;

    const timeout = setTimeout(() => {
      setDate(new Date());
    }, msUntilMidnight + 1000); // Add 1 second buffer to ensure we're past midnight

    return () => clearTimeout(timeout);
  }, [date, useLocalTimezone, browserTimezone, configuredTimezone]);

  const formatDate = () => {
    // Use explicit timezone (matches backend exactly)
    const effectiveTimezone = useLocalTimezone ? browserTimezone : configuredTimezone;

    // Build format options based on what should be shown (matches backend exactly)
    const options: Intl.DateTimeFormatOptions = {
      timeZone: effectiveTimezone,
    };

    if (showWeekday) {
      options.weekday = 'long';
    }
    if (showDay) {
      options.day = 'numeric';
    }
    if (showMonth) {
      options.month = 'long';
    }
    if (showYear) {
      options.year = 'numeric';
    }

    // Fallback if nothing is selected
    if (!showWeekday && !showDay && !showMonth && !showYear) {
      options.day = 'numeric';
      options.month = 'long';
      options.year = 'numeric';
    }

    return date.toLocaleDateString(locale, options);
  };

  // Match backend SVG rendering exactly:
  // - lineHeight = fontSize * 1.2
  // - Text centered both horizontally and vertically
  const lineHeight = fontSize * 1.2;

  // Map textAlign to flexbox justify-content
  const justifyContent = textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center';

  return (
    <div
      className="flex items-center w-full h-full px-2"
      style={{
        fontSize: `${fontSize}px`,
        fontFamily,
        lineHeight: `${lineHeight}px`,
        whiteSpace: 'nowrap',
        justifyContent,
      }}
    >
      {formatDate()}
    </div>
  );
}

/**
 * Weather code to condition mapping (WMO codes)
 */
const weatherConditions: Record<number, { text: string; icon: 'sun' | 'cloud' | 'cloud-sun' | 'rain' | 'snow' | 'thunder' | 'fog' }> = {
  0: { text: 'Clear', icon: 'sun' },
  1: { text: 'Mostly Clear', icon: 'sun' },
  2: { text: 'Partly Cloudy', icon: 'cloud-sun' },
  3: { text: 'Cloudy', icon: 'cloud' },
  45: { text: 'Foggy', icon: 'fog' },
  48: { text: 'Icy Fog', icon: 'fog' },
  51: { text: 'Light Drizzle', icon: 'rain' },
  53: { text: 'Drizzle', icon: 'rain' },
  55: { text: 'Heavy Drizzle', icon: 'rain' },
  61: { text: 'Light Rain', icon: 'rain' },
  63: { text: 'Rain', icon: 'rain' },
  65: { text: 'Heavy Rain', icon: 'rain' },
  71: { text: 'Light Snow', icon: 'snow' },
  73: { text: 'Snow', icon: 'snow' },
  75: { text: 'Heavy Snow', icon: 'snow' },
  80: { text: 'Light Showers', icon: 'rain' },
  81: { text: 'Showers', icon: 'rain' },
  82: { text: 'Heavy Showers', icon: 'rain' },
  95: { text: 'Thunderstorm', icon: 'thunder' },
  96: { text: 'Thunderstorm', icon: 'thunder' },
  99: { text: 'Heavy Storm', icon: 'thunder' },
};

/**
 * Weather icon components
 */
function WeatherIcon({ icon, size = 48 }: { icon: string; size?: number }) {
  const iconClass = `text-text-primary`;

  switch (icon) {
    case 'sun':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
          <circle cx="12" cy="12" r="5" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 12 + Math.cos(rad) * 7;
            const y1 = 12 + Math.sin(rad) * 7;
            const x2 = 12 + Math.cos(rad) * 10;
            const y2 = 12 + Math.sin(rad) * 10;
            return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="2" />;
          })}
        </svg>
      );
    case 'cloud':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
          <ellipse cx="9" cy="15" rx="5" ry="4" />
          <ellipse cx="15" cy="15" rx="4" ry="3" />
          <ellipse cx="12" cy="11" rx="6" ry="5" />
        </svg>
      );
    case 'cloud-sun':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
          <circle cx="16" cy="6" r="3" />
          {[0, 60, 120, 180, 240, 300].map(angle => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 16 + Math.cos(rad) * 4.5;
            const y1 = 6 + Math.sin(rad) * 4.5;
            const x2 = 16 + Math.cos(rad) * 6;
            const y2 = 6 + Math.sin(rad) * 6;
            return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" />;
          })}
          <ellipse cx="8" cy="17" rx="4" ry="3" />
          <ellipse cx="14" cy="17" rx="3.5" ry="2.5" />
          <ellipse cx="11" cy="13" rx="5" ry="4" />
        </svg>
      );
    case 'rain':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
          <ellipse cx="8" cy="8" rx="4" ry="3" />
          <ellipse cx="14" cy="8" rx="3.5" ry="2.5" />
          <ellipse cx="11" cy="5" rx="5" ry="4" />
          <line x1="6" y1="14" x2="4" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="11" y1="14" x2="9" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="14" x2="14" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'snow':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
          <ellipse cx="8" cy="8" rx="4" ry="3" />
          <ellipse cx="14" cy="8" rx="3.5" ry="2.5" />
          <ellipse cx="11" cy="5" rx="5" ry="4" />
          <text x="5" y="18" fontSize="8">*</text>
          <text x="10" y="20" fontSize="8">*</text>
          <text x="15" y="17" fontSize="8">*</text>
        </svg>
      );
    case 'thunder':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
          <ellipse cx="8" cy="6" rx="4" ry="3" />
          <ellipse cx="14" cy="6" rx="3.5" ry="2.5" />
          <ellipse cx="11" cy="3" rx="5" ry="4" />
          <path d="M10 11 L14 11 L11 16 L15 16 L9 24 L11 17 L7 17 Z" />
        </svg>
      );
    case 'fog':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={iconClass}>
          <line x1="4" y1="8" x2="20" y2="8" />
          <line x1="6" y1="12" x2="18" y2="12" />
          <line x1="4" y1="16" x2="20" y2="16" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
  }
}

/**
 * WeatherWidget - Displays weather preview with real data from Open-Meteo API
 */
function WeatherWidget({ config }: { config: Record<string, unknown> }) {
  const [weatherData, setWeatherData] = useState<{
    temperature: number;
    weatherCode: number;
    humidity: number;
    windSpeed: number;
    dayName: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const location = (config.location as string) || 'Unknown';
  const latitude = (config.latitude as number) || 52.2297;
  const longitude = (config.longitude as number) || 21.0122;
  const units = (config.units as string) || 'metric';
  const forecastDay = (config.forecastDay as number) || 0;
  const forecastTime = (config.forecastTime as string) || 'current';
  const showIcon = config.showIcon !== false;
  const showTemperature = config.showTemperature !== false;
  const showCondition = config.showCondition !== false;
  const showLocation = config.showLocation !== false;
  const showHumidity = config.showHumidity as boolean;
  const showWind = config.showWind as boolean;
  const showDayName = config.showDayName as boolean;
  const fontSize = (config.fontSize as number) || 32;

  // Fetch weather data
  useEffect(() => {
    let isMounted = true;

    const fetchWeather = async () => {
      setLoading(true);
      try {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', latitude.toString());
        url.searchParams.set('longitude', longitude.toString());
        url.searchParams.set('current', 'temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m');
        url.searchParams.set('hourly', 'temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m');
        url.searchParams.set('forecast_days', Math.max(forecastDay + 1, 1).toString());
        url.searchParams.set('timezone', 'auto');

        const response = await fetch(url.toString());
        const data = await response.json();

        if (!isMounted) return;

        const now = new Date();
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + forecastDay);

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let dayName = dayNames[targetDate.getDay()];
        if (forecastDay === 0) dayName = 'Today';
        else if (forecastDay === 1) dayName = 'Tomorrow';

        if (forecastDay === 0 && forecastTime === 'current') {
          setWeatherData({
            temperature: Math.round(data.current.temperature_2m),
            weatherCode: data.current.weather_code,
            humidity: data.current.relative_humidity_2m,
            windSpeed: Math.round(data.current.wind_speed_10m),
            dayName,
          });
        } else {
          const hourMap: Record<string, number> = {
            'current': now.getHours(),
            'morning': 8,
            'noon': 12,
            'afternoon': 15,
            'evening': 19,
            'night': 22,
          };
          const targetHour = hourMap[forecastTime] ?? 12;

          const year = targetDate.getFullYear();
          const month = String(targetDate.getMonth() + 1).padStart(2, '0');
          const day = String(targetDate.getDate()).padStart(2, '0');
          const hour = String(targetHour).padStart(2, '0');
          const targetTimeStr = `${year}-${month}-${day}T${hour}:00`;

          const hourlyTimes = data.hourly?.time || [];
          const index = hourlyTimes.findIndex((t: string) => t === targetTimeStr);

          if (index >= 0 && data.hourly) {
            setWeatherData({
              temperature: Math.round(data.hourly.temperature_2m[index]),
              weatherCode: data.hourly.weather_code[index],
              humidity: data.hourly.relative_humidity_2m[index],
              windSpeed: Math.round(data.hourly.wind_speed_10m[index]),
              dayName,
            });
          } else {
            setWeatherData({
              temperature: Math.round(data.current.temperature_2m),
              weatherCode: data.current.weather_code,
              humidity: data.current.relative_humidity_2m,
              windSpeed: Math.round(data.current.wind_speed_10m),
              dayName,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch weather:', error);
        if (isMounted) setWeatherData(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchWeather();

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, forecastDay, forecastTime]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-placeholder">
        <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!weatherData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm">
        <span>{location}</span>
        <span>Weather unavailable</span>
      </div>
    );
  }

  const condition = weatherConditions[weatherData.weatherCode] || { text: 'Unknown', icon: 'cloud' as const };
  const displayTemp = units === 'imperial'
    ? Math.round((weatherData.temperature * 9/5) + 32)
    : weatherData.temperature;
  const tempUnit = units === 'imperial' ? '°F' : '°C';
  const windUnit = units === 'imperial' ? 'mph' : 'km/h';
  const displayWind = units === 'imperial' ? Math.round(weatherData.windSpeed * 0.621) : weatherData.windSpeed;

  const iconSize = Math.min(fontSize * 1.5, 48);
  const smallFontSize = Math.max(10, fontSize * 0.4);

  return (
    <div className="flex flex-col items-center justify-center h-full p-2">
      {showDayName && forecastDay > 0 && (
        <div className="text-text-secondary mb-1" style={{ fontSize: `${smallFontSize}px` }}>
          {weatherData.dayName}
        </div>
      )}
      <div className="flex items-center gap-2">
        {showIcon && <WeatherIcon icon={condition.icon} size={iconSize} />}
        <div className="flex flex-col">
          {showTemperature && (
            <div className="font-bold" style={{ fontSize: `${fontSize}px` }}>
              {displayTemp}{tempUnit}
            </div>
          )}
          {showCondition && (
            <div className="text-text-secondary" style={{ fontSize: `${smallFontSize}px` }}>
              {condition.text}
            </div>
          )}
        </div>
      </div>
      {showHumidity && (
        <div className="text-text-muted mt-1" style={{ fontSize: `${smallFontSize}px` }}>
          Humidity: {weatherData.humidity}%
        </div>
      )}
      {showWind && (
        <div className="text-text-muted" style={{ fontSize: `${smallFontSize}px` }}>
          Wind: {displayWind} {windUnit}
        </div>
      )}
      {showLocation && (
        <div className="text-text-placeholder mt-1" style={{ fontSize: `${smallFontSize * 0.9}px` }}>
          {location}
        </div>
      )}
    </div>
  );
}

/**
 * TextWidget - Displays custom text or dynamic text from a data source
 *
 * Supports two modes:
 * 1. Static text: Uses config.text directly
 * 2. Dynamic text: Fetches from data source using config.dataSourceId and config.dataSourceField
 *
 * Text rendering matches the backend SVG renderer behavior:
 * - Word wrapping based on container width
 * - Overflow hidden to show exactly what device will display
 */
function TextWidget({ config }: { config: Record<string, unknown> }) {
  const staticText = (config.text as string) || 'Text';
  const fontSize = (config.fontSize as number) || 24;
  const fontFamily = mapFontFamily((config.fontFamily as string) || 'sans-serif');
  const fontWeight = (config.fontWeight as string) || 'normal';
  const textAlign = (config.textAlign as string) || 'left';
  const color = (config.color as string) || '#000000';

  // Data source configuration
  const dataSourceId = config.dataSourceId as number | undefined;
  const dataSourceField = config.dataSourceField as string | undefined;

  // Fetch data from data source if configured
  const { value: dynamicValue, loading, error } = useDataSourceField(dataSourceId, dataSourceField);

  // Use dynamic value if available, otherwise fall back to static text
  const displayText = dataSourceId && dataSourceField
    ? (loading ? 'Loading...' : error ? 'Error' : String(dynamicValue ?? staticText))
    : staticText;

  return (
    <div
      className="flex items-center h-full w-full"
      style={{
        fontSize: `${fontSize}px`,
        fontFamily,
        fontWeight,
        textAlign: textAlign as React.CSSProperties['textAlign'],
        color,
        padding: '10px',
        lineHeight: 1.2,
      }}
    >
      <div className="w-full" style={{ textAlign: textAlign as React.CSSProperties['textAlign'] }}>
        {displayText}
      </div>
    </div>
  );
}

/**
 * QRCodeWidget - Displays a QR code generated locally (no external API)
 */
function QRCodeWidget({ config }: { config: Record<string, unknown> }) {
  const content = (config.content as string) || 'https://example.com';
  const size = (config.size as number) || 100;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // Generate QR code locally as data URL
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImageError(false);
    generateQRCodeDataUrl(content, size)
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setImageError(true);
      });
    return () => { cancelled = true; };
  }, [content, size]);

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div
        className="bg-white flex items-center justify-center overflow-hidden"
        style={{ width: size, height: size }}
      >
        {!imageError && qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR code for: ${content}`}
            className="w-full h-full object-contain"
            onError={() => setImageError(true)}
          />
        ) : imageError ? (
          // Fallback SVG if generation fails
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-3/4 h-3/4 text-text-primary"
          >
            <rect x="2" y="2" width="6" height="6" />
            <rect x="16" y="2" width="6" height="6" />
            <rect x="2" y="16" width="6" height="6" />
            <rect x="10" y="10" width="4" height="4" />
          </svg>
        ) : null}
      </div>
      <div className="text-xs text-text-muted mt-1 max-w-full truncate px-2" title={content}>
        {content.length > 30 ? `${content.substring(0, 30)}...` : content}
      </div>
    </div>
  );
}

/**
 * BatteryWidget - Displays battery level preview
 */
function BatteryWidget({ config }: { config: Record<string, unknown> }) {
  const showPercentage = config.showPercentage as boolean;
  const showIcon = config.showIcon as boolean;
  const fontSize = (config.fontSize as number) || 16;

  // Preview value
  const batteryLevel = 85;

  return (
    <div
      className="flex items-center justify-center h-full gap-2"
      style={{ fontSize: `${fontSize}px` }}
    >
      {showIcon && (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <rect x="1" y="6" width="18" height="12" rx="2" strokeWidth="2" />
          <rect x="19" y="9" width="4" height="6" rx="1" strokeWidth="2" />
          <rect
            x="3"
            y="8"
            width={`${(batteryLevel / 100) * 14}`}
            height="8"
            fill="currentColor"
            rx="1"
          />
        </svg>
      )}
      {showPercentage && <span>{batteryLevel}%</span>}
    </div>
  );
}

/**
 * DaysUntilWidget - Displays days remaining until an event
 * Updates once per day at midnight.
 * Fully customizable with prefix/suffix text.
 */
function DaysUntilWidget({ config }: { config: Record<string, unknown> }) {
  const [now, setNow] = useState(new Date());
  const targetDateStr = (config.targetDate as string) || '2025-12-25';
  const fontSize = (config.fontSize as number) || 32;
  const fontFamily = mapFontFamily((config.fontFamily as string) || 'sans-serif');
  const color = (config.color as string) || '#000000';

  // New customizable prefix/suffix format
  const labelPrefix = (config.labelPrefix as string) ?? 'Days till Christmas: ';
  const labelSuffix = (config.labelSuffix as string) || '';

  useEffect(() => {
    // Update at midnight
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    const timeout = setTimeout(() => {
      setNow(new Date());
    }, msUntilMidnight);

    return () => clearTimeout(timeout);
  }, [now]);

  // Calculate days until target date
  const targetDate = new Date(targetDateStr);
  targetDate.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Format the display text using prefix + number + suffix
  const formatText = () => {
    const days = diffDays < 0 ? Math.abs(diffDays) : diffDays;
    return `${labelPrefix}${days}${labelSuffix}`;
  };

  return (
    <div
      className="flex items-center w-full h-full px-2"
      style={{
        fontSize: `${fontSize}px`,
        fontFamily,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {formatText()}
    </div>
  );
}

/**
 * CountdownWidget - Displays countdown timer to a specific date/time
 */
function CountdownWidget({ config }: { config: Record<string, unknown> }) {
  const [now, setNow] = useState(new Date());
  const targetDateStr = (config.targetDate as string) || '2025-12-31T23:59:59';
  const label = (config.label as string) || '';
  const fontSize = (config.fontSize as number) || 32;
  const fontFamily = mapFontFamily((config.fontFamily as string) || 'monospace');
  const showDays = config.showDays !== false;
  const showHours = config.showHours !== false;
  const showMinutes = config.showMinutes !== false;
  const showSeconds = config.showSeconds !== false;

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const targetDate = new Date(targetDateStr);
  const diffMs = targetDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return (
      <div
        className="flex items-center w-full h-full px-2"
        style={{ fontSize: `${fontSize}px`, fontFamily, whiteSpace: 'nowrap' }}
      >
        {label || 'Time\'s up!'}
      </div>
    );
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  const parts: string[] = [];
  if (showDays && days > 0) parts.push(`${days}d`);
  if (showHours) parts.push(`${hours.toString().padStart(2, '0')}h`);
  if (showMinutes) parts.push(`${minutes.toString().padStart(2, '0')}m`);
  if (showSeconds) parts.push(`${seconds.toString().padStart(2, '0')}s`);

  return (
    <div
      className="flex flex-col justify-center w-full h-full px-2"
      style={{ fontSize: `${fontSize}px`, fontFamily, whiteSpace: 'nowrap' }}
    >
      {label && <div className="text-sm mb-1" style={{ fontSize: `${fontSize * 0.5}px` }}>{label}</div>}
      <div className="font-bold">{parts.join(' ')}</div>
    </div>
  );
}

/**
 * ImageWidget - Displays a static image from URL or dynamic image from data source
 *
 * Supports two modes:
 * 1. Static URL: Uses config.url directly
 * 2. Dynamic URL: Fetches URL from data source using config.dataSourceId and config.dataSourceField
 *
 * Shows image in grayscale to simulate e-ink display appearance
 */
function ImageWidget({ config }: { config: Record<string, unknown> }) {
  const staticUrl = (config.url as string) || (config.imageUrl as string) || '';
  const fit = (config.fit as string) || 'contain';

  // Data source configuration
  const dataSourceId = config.dataSourceId as number | undefined;
  const dataSourceField = config.dataSourceField as string | undefined;

  // Fetch data from data source if configured
  const { value: dynamicValue, loading, error } = useDataSourceField(dataSourceId, dataSourceField);

  // Use dynamic URL if available, otherwise fall back to static URL
  const url = dataSourceId && dataSourceField
    ? (String(dynamicValue || '') || staticUrl)
    : staticUrl;

  // Show loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-bg-muted text-text-placeholder">
        <svg className="w-8 h-8 animate-spin mb-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-xs">Loading...</span>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-status-error-bg text-status-error-text">
        <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-xs">Error loading</span>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-bg-muted text-text-placeholder">
        <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-xs">No image URL</span>
      </div>
    );
  }

  // Use EInkImage component for proper e-ink rendering and GIF freezing
  return (
    <div className="w-full h-full flex items-center justify-center bg-white">
      <EInkImage
        src={url}
        alt="Widget image"
        fit={fit as 'contain' | 'cover' | 'fill'}
      />
    </div>
  );
}

/**
 * DividerWidget - Displays a horizontal or vertical divider line
 */
function DividerWidget({ config }: { config: Record<string, unknown> }) {
  const orientation = (config.orientation as string) || 'horizontal';
  const thickness = (config.thickness as number) || 2;
  const color = (config.color as string) || '#000000';
  const style = (config.style as string) || 'solid';

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div
        style={{
          backgroundColor: style === 'solid' ? color : 'transparent',
          borderStyle: style === 'solid' ? 'none' : style,
          borderColor: color,
          borderWidth: style !== 'solid' ? thickness : 0,
          ...(orientation === 'horizontal'
            ? { width: '100%', height: thickness }
            : { width: thickness, height: '100%' }),
        }}
      />
    </div>
  );
}

/**
 * RectangleWidget - Displays a rectangle shape
 */
function RectangleWidget({ config }: { config: Record<string, unknown> }) {
  const backgroundColor = (config.backgroundColor as string) || '#000000';
  const borderColor = (config.borderColor as string) || '#000000';
  const borderWidth = (config.borderWidth as number) || 0;

  return (
    <div
      className="w-full h-full"
      style={{
        backgroundColor,
        border: borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : 'none',
      }}
    />
  );
}

/**
 * WifiWidget - Displays WiFi signal strength
 */
function WifiWidget({ config }: { config: Record<string, unknown> }) {
  const showStrength = config.showStrength !== false;
  const showIcon = config.showIcon !== false;
  const fontSize = (config.fontSize as number) || 16;

  // Preview value (actual value comes from device at render time)
  const signalStrength = -55; // dBm

  return (
    <div
      className="flex items-center justify-center h-full gap-2"
      style={{ fontSize: `${fontSize}px` }}
    >
      {showIcon && (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
      )}
      {showStrength && <span>{signalStrength} dBm</span>}
    </div>
  );
}

/**
 * DeviceInfoWidget - Displays device information
 */
function DeviceInfoWidget({ config }: { config: Record<string, unknown> }) {
  const showName = config.showName !== false;
  const showFirmware = config.showFirmware !== false;
  const showMac = config.showMac as boolean;
  const fontSize = (config.fontSize as number) || 14;

  // Preview values
  const deviceName = 'TRMNL Device';
  const firmware = 'v1.0.0';
  const mac = 'AA:BB:CC:DD:EE:FF';

  return (
    <div
      className="flex flex-col items-center justify-center h-full text-center gap-1"
      style={{ fontSize: `${fontSize}px` }}
    >
      {showName && <div className="font-bold">{deviceName}</div>}
      {showFirmware && <div className="text-text-secondary">Firmware: {firmware}</div>}
      {showMac && <div className="text-text-muted text-xs">{mac}</div>}
    </div>
  );
}

/**
 * GitHubWidget - Displays GitHub repository star count
 * Uses backend proxy to fetch data (which has the configured token)
 */
function GitHubWidget({ config }: { config: Record<string, unknown> }) {
  const [stars, setStars] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const owner = (config.owner as string) || 'facebook';
  const repo = (config.repo as string) || 'react';
  const showIcon = config.showIcon !== false;
  const showRepoName = config.showRepoName as boolean;
  const fontSize = (config.fontSize as number) || 32;
  const fontFamily = mapFontFamily((config.fontFamily as string) || 'sans-serif');

  useEffect(() => {
    let isMounted = true;

    const fetchStars = async () => {
      if (!owner || !repo) {
        setError('Missing repo info');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Use backend proxy which has the GitHub token configured
        const result = await screenDesignerService.getGitHubStars(owner, repo);

        if (isMounted) {
          if (result) {
            setStars(result.stars);
          } else {
            setError('Failed to fetch');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchStars();

    return () => {
      isMounted = false;
    };
  }, [owner, repo]);

  // Format star count (e.g., 1.2k, 15.3k)
  const formatStars = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return String(count);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-placeholder">
        <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm">
        <span>{owner}/{repo}</span>
        <span className="text-status-error-text text-xs">Rate limited - try later</span>
      </div>
    );
  }

  const iconSize = Math.min(fontSize * 1.2, 48);
  const smallFontSize = Math.max(12, fontSize * 0.4);

  return (
    <div
      className="flex flex-col items-center justify-center h-full"
      style={{ fontFamily }}
    >
      <div className="flex items-center gap-2">
        {showIcon && (
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="currentColor"
            className="text-text-primary"
          >
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
        )}
        <span
          className="font-bold"
          style={{ fontSize: `${fontSize}px` }}
        >
          {formatStars(stars || 0)}
        </span>
      </div>
      {showRepoName && (
        <div
          className="text-text-muted mt-1"
          style={{ fontSize: `${smallFontSize}px` }}
        >
          {owner}/{repo}
        </div>
      )}
    </div>
  );
}

/**
 * GridContentRenderer - Renders grid content for custom widgets
 * Displays multiple values in a CSS grid layout
 */
interface GridCell {
  row: number;
  col: number;
  field: string;
  fieldType: string;
  label?: string;
  prefix?: string;
  suffix?: string;
  value: unknown;
  formattedValue: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
}

interface GridContent {
  type: 'grid';
  gridCols: number;
  gridRows: number;
  gridGap: number;
  cells: GridCell[];
}

interface GridCellOverride {
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  imageFit?: 'contain' | 'cover' | 'fill';
}

function GridContentRenderer({
  content,
  fontSize,
  fontFamily: rawFontFamily = 'sans-serif',
  cellOverrides = {},
}: {
  content: GridContent;
  fontSize: number;
  fontFamily?: string;
  cellOverrides?: Record<string, GridCellOverride>;
}) {
  const fontFamily = mapFontFamily(rawFontFamily);
  const { gridCols, gridRows, gridGap, cells } = content;

  // Create a map of cells by position for quick lookup
  const cellMap = new Map<string, GridCell>();
  for (const cell of cells) {
    cellMap.set(`${cell.row}-${cell.col}`, cell);
  }

  return (
    <div
      className="grid w-full h-full"
      style={{
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        gridTemplateRows: `repeat(${gridRows}, 1fr)`,
        gap: `${gridGap}px`,
      }}
    >
      {Array.from({ length: gridRows * gridCols }).map((_, index) => {
        const row = Math.floor(index / gridCols);
        const col = index % gridCols;
        const cellKey = `${row}-${col}`;
        const cell = cellMap.get(cellKey);

        if (!cell) {
          return <div key={cellKey} />;
        }

        // Get cell-specific overrides
        const override = cellOverrides[cellKey] || {};
        const baseCellFontSize = fontSize * 0.7;
        const cellFontSize = override.fontSize || baseCellFontSize;
        const cellFontWeight = override.fontWeight || 'bold';
        // Apply font mapping to override or use already-mapped parent fontFamily
        const cellFontFamily = override.fontFamily ? mapFontFamily(override.fontFamily) : fontFamily;
        const cellAlign = override.align || cell.align || 'center';
        const cellVerticalAlign = override.verticalAlign || cell.verticalAlign || 'middle';
        const imageFit = override.imageFit || 'contain';

        // Horizontal alignment (affects text-align and flex items alignment)
        const alignItems = cellAlign === 'left' ? 'items-start' : cellAlign === 'right' ? 'items-end' : 'items-center';
        const textAlignClass = cellAlign === 'left' ? 'text-left' : cellAlign === 'right' ? 'text-right' : 'text-center';
        const justifyContent = cellAlign === 'left' ? 'justify-start' : cellAlign === 'right' ? 'justify-end' : 'justify-center';

        // Vertical alignment (affects justify-content in flex column)
        const verticalJustify = cellVerticalAlign === 'top' ? 'justify-start' : cellVerticalAlign === 'bottom' ? 'justify-end' : 'justify-center';

        return (
          <div
            key={cellKey}
            className={`flex flex-col ${alignItems} ${verticalJustify} ${textAlignClass} overflow-hidden`}
          >
            {cell.label && (
              <div
                className="text-text-muted truncate w-full"
                style={{ fontSize: `${cellFontSize * 0.6}px`, textAlign: cellAlign }}
              >
                {cell.label}
              </div>
            )}
            <div className={`flex ${alignItems} ${justifyContent} gap-0.5 truncate`}>
              {cell.fieldType === 'image' && cell.value ? (
                <EInkImage
                  src={String(cell.value)}
                  alt={cell.label || 'Grid cell image'}
                  fit={imageFit}
                />
              ) : (
                <span
                  style={{
                    fontSize: `${cellFontSize}px`,
                    fontWeight: cellFontWeight,
                    fontFamily: cellFontFamily,
                  }}
                >
                  {cell.formattedValue}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * CustomWidgetRenderer - Renders a custom widget with data from its data source
 * Fetches preview data from the API and displays based on display type
 *
 * Supports multiple display types:
 * - 'value': Single value display (text or image based on fieldType)
 * - 'title-value': Title with value (value can be image based on valueFieldType)
 * - 'list': List of items
 * - 'template': Custom template string interpolation
 * - 'grid': Multiple values in a grid layout
 *
 * Font settings (fontSize, fontFamily, fontWeight, textAlign, color) are
 * configured in the screen designer and passed via config.
 */
function CustomWidgetRenderer({ config }: { config: Record<string, unknown> }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderedContent, setRenderedContent] = useState<string | string[] | Record<string, unknown> | null>(null);
  const [widgetConfig, setWidgetConfig] = useState<Record<string, unknown>>({});

  const customWidgetId = config.customWidgetId as number;

  // Font settings from screen designer config
  const fontSize = (config.fontSize as number) || 24;
  const fontFamily = mapFontFamily((config.fontFamily as string) || 'sans-serif');
  const fontWeight = (config.fontWeight as string) || 'normal';
  const textAlign = (config.textAlign as string) || 'center';
  const verticalAlign = (config.verticalAlign as string) || 'middle';
  const color = (config.color as string) || '#000000';

  // Per-cell overrides from screen designer
  const cellOverrides = (config.cellOverrides as Record<string, GridCellOverride>) || {};

  // Compute alignment classes
  const horizontalAlignClass = textAlign === 'left' ? 'items-start' : textAlign === 'right' ? 'items-end' : 'items-center';
  const verticalAlignClass = verticalAlign === 'top' ? 'justify-start' : verticalAlign === 'bottom' ? 'justify-end' : 'justify-center';

  useEffect(() => {
    let isMounted = true;

    if (!customWidgetId) {
      setError('No widget ID');
      setLoading(false);
      return;
    }

    const fetchPreview = async () => {
      try {
        setLoading(true);
        const preview = await customWidgetService.getPreview(customWidgetId);
        if (!isMounted) return;
        setRenderedContent(preview.renderedContent);
        // Store the widget's config so we know fieldType, valueFieldType, etc.
        setWidgetConfig((preview.widget?.config as Record<string, unknown>) || {});
        setError(null);
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPreview();

    return () => {
      isMounted = false;
    };
  }, [customWidgetId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-text-placeholder">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-status-error-text text-sm">
        {error}
      </div>
    );
  }

  if (!renderedContent) {
    return (
      <div className="flex items-center justify-center h-full text-text-placeholder text-sm">
        No data
      </div>
    );
  }

  // Check if field should be rendered as image
  const fieldType = widgetConfig.fieldType as string | undefined;
  const valueFieldType = widgetConfig.valueFieldType as string | undefined;

  // Render based on content type and field configuration
  // Uses EInkImage component for proper e-ink rendering and GIF freezing
  // Font settings are applied from config for consistent appearance
  const baseStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    fontFamily,
    fontWeight,
    textAlign: textAlign as React.CSSProperties['textAlign'],
    color,
    lineHeight: 1.2,
  };

  return (
    <div
      className={`flex flex-col ${horizontalAlignClass} ${verticalAlignClass} h-full p-2 w-full`}
      style={baseStyle}
    >
      {typeof renderedContent === 'string' ? (
        // Single value - check if it should be rendered as image
        fieldType === 'image' ? (
          <EInkImage
            src={renderedContent}
            alt="Custom widget image"
            fit="contain"
          />
        ) : (
          <div className="w-full" style={{ textAlign: textAlign as React.CSSProperties['textAlign'] }}>
            {renderedContent}
          </div>
        )
      ) : Array.isArray(renderedContent) ? (
        // List display - items already have prefix (•, -, 1.) from renderList(), so no list-style needed
        <ul
          className="w-full"
          style={{
            listStyle: 'none',
            textAlign: textAlign as React.CSSProperties['textAlign'],
            margin: 0,
            padding: 0,
          }}
        >
          {renderedContent.map((item, i) => (
            <li key={i} style={{ fontSize: `${fontSize}px`, lineHeight: 1.2, marginBottom: '4px' }}>
              {item}
            </li>
          ))}
        </ul>
      ) : typeof renderedContent === 'object' && renderedContent !== null ? (
        // Object display - could be grid, title-value, or other
        'type' in renderedContent && renderedContent.type === 'grid' ? (
          // Grid display
          <GridContentRenderer
            content={renderedContent as unknown as GridContent}
            fontSize={fontSize}
            fontFamily={fontFamily}
            cellOverrides={cellOverrides}
          />
        ) : (('title' in renderedContent || 'label' in renderedContent) && 'value' in renderedContent) ? (
          // Title-value display
          <div className="w-full" style={{ textAlign: textAlign as React.CSSProperties['textAlign'] }}>
            <div style={{ fontSize: `${fontSize * 0.6}px`, opacity: 0.6 }}>
              {String('title' in renderedContent ? renderedContent.title : renderedContent.label)}
            </div>
            {valueFieldType === 'image' ? (
              <div className="mt-2" style={{ maxHeight: '80%' }}>
                <EInkImage
                  src={String(renderedContent.value)}
                  alt="Custom widget image"
                  fit="contain"
                />
              </div>
            ) : (
              <div style={{ fontWeight: 'bold' }}>{String(renderedContent.value)}</div>
            )}
          </div>
        ) : (
          <pre style={{ fontSize: '12px', textAlign: 'left' }}>
            {JSON.stringify(renderedContent, null, 2)}
          </pre>
        )
      ) : (
        <span style={{ opacity: 0.5 }}>Invalid content</span>
      )}
    </div>
  );
}
