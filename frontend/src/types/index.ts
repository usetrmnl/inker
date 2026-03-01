// Auth types - simplified for PIN-based auth
export interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// GitHub token test result
export interface GitHubTokenTestResult {
  valid: boolean;
  message: string;
  rateLimit?: number;
  rateLimitRemaining?: number;
  username?: string;
}

// Device types
export interface Device {
  id: number;
  name: string;
  friendlyId?: string;
  macAddress: string;
  apiKey?: string;
  /** Computed status based on lastSeenAt */
  status: 'online' | 'offline';
  /** Computed boolean for online status */
  isOnline: boolean;
  /** Last time device connected */
  lastSeenAt: string;
  /** Battery level as percentage (0-100) */
  battery: number;
  /** WiFi signal strength in dBm (typically -30 to -90) */
  wifi: number;
  firmwareVersion?: string;
  modelId?: number;
  playlistId?: number;
  refreshRate?: number;
  isActive?: boolean;
  userId: number;
  createdAt: string;
  updatedAt: string;
  model?: {
    id: number;
    name: string;
    label: string;
    width: number;
    height: number;
  };
  playlist?: {
    id: number;
    name: string;
  };
}

// Device log entry
export interface DeviceLog {
  id: number;
  deviceId: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// Screen types
export interface Screen {
  id: string;
  name: string;
  description?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
  /** Indicates if this is the system default welcome screen */
  isDefault?: boolean;
}

// Playlist connected device (minimal info returned with playlist)
export interface PlaylistDevice {
  id: number;
  name: string;
  macAddress: string;
}

// Playlist types
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  screens: PlaylistScreenWithDetails[];
  isActive: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
  /** Devices currently assigned to this playlist */
  devices?: PlaylistDevice[];
  /** Backend count aggregation */
  _count?: {
    items: number;
  };
}

export interface PlaylistScreen {
  screenId: string;
  duration: number; // in seconds
  order: number;
}

export interface PlaylistScreenWithDetails extends PlaylistScreen {
  id: string | number;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
}

// Extension types
export interface Extension {
  id: string;
  name: string;
  description?: string;
  version: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Data Source types
export interface DataSource {
  id: number;
  name: string;
  description?: string;
  type: 'json' | 'rss';
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  refreshInterval: number;
  jsonPath?: string;
  isActive: boolean;
  lastFetchedAt?: string;
  lastData?: unknown;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    customWidgets: number;
  };
}

export interface DataSourceFormData {
  name: string;
  description?: string;
  type: 'json' | 'rss';
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  refreshInterval?: number;
  jsonPath?: string;
  isActive?: boolean;
}

export interface DataSourceTestResult {
  success: boolean;
  data?: unknown;
  fields?: FieldMeta[];
  error?: string;
  fetchedAt: string;
}

/**
 * Field metadata extracted from API response.
 * Used to show users what fields are available from a data source.
 */
export interface FieldMeta {
  path: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  sample: unknown;
  isImageUrl?: boolean;
  isLink?: boolean;
}

/**
 * Request body for testing a URL without saving
 */
export interface TestUrlRequest {
  url: string;
  type: 'json' | 'rss';
  method?: string;
  headers?: Record<string, string>;
}

/**
 * Field display types for custom widgets
 */
export type FieldDisplayType = 'text' | 'number' | 'image' | 'link' | 'date';

// Custom Widget types
export type CustomWidgetDisplayType = 'value' | 'list' | 'script' | 'grid';

// Grid cell configuration for grid display type
export type CellAlignment = 'left' | 'center' | 'right';
export type CellVerticalAlignment = 'top' | 'middle' | 'bottom';

export interface GridCellConfig {
  field: string;
  fieldType: FieldDisplayType;
  label?: string;
  prefix?: string;
  suffix?: string;
  useScript?: boolean;
  script?: string;
  align?: CellAlignment;
  verticalAlign?: CellVerticalAlignment;
}

// Grid configuration type
export interface GridConfig {
  rows: number;
  cols: number;
  cells: Record<string, GridCellConfig>; // Key format: "row-col" e.g., "0-1"
  gap?: number;
}

// Cell override settings for screen designer (per-cell font/image customization)
export interface GridCellOverride {
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontFamily?: string;
  align?: CellAlignment;
  verticalAlign?: CellVerticalAlignment;
  // Image-specific settings
  imageWidth?: number;
  imageHeight?: number;
  imageFit?: 'contain' | 'cover' | 'fill';
}

export interface CustomWidget {
  id: number;
  name: string;
  description?: string;
  dataSourceId: number;
  dataSource?: DataSource;
  displayType: CustomWidgetDisplayType;
  template?: string;
  config: Record<string, unknown>;
  minWidth: number;
  minHeight: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomWidgetFormData {
  name: string;
  description?: string;
  dataSourceId: number;
  displayType: CustomWidgetDisplayType;
  template?: string;
  config?: Record<string, unknown>;
  minWidth?: number;
  minHeight?: number;
}

export interface CustomWidgetPreview {
  widget: CustomWidget;
  data: unknown;
  renderedContent: string | string[] | Record<string, unknown>;
}

// Firmware types
export interface Firmware {
  id: string;
  version: string;
  filename: string;
  fileUrl: string;
  fileSize: number;
  checksum: string;
  releaseNotes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Model types
export interface Model {
  id: string;
  name: string;
  manufacturer: string;
  screenWidth: number;
  screenHeight: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Form types
export interface DeviceFormData {
  name: string;
  macAddress: string;
}

export interface ScreenFormData {
  name: string;
  description?: string;
  file: File;
}

export interface PlaylistFormData {
  name: string;
  description?: string;
  screens: PlaylistScreen[];
  isActive: boolean;
}

// Dashboard stats
export interface DashboardStats {
  totalDevices: number;
  onlineDevices: number;
  totalScreens: number;
  totalPlaylists: number;
  recentDevices: Device[];
  recentScreens: Screen[];
}

// Notification types
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

// Screen Designer types

// Widget Template - defines what widgets are available
export interface WidgetTemplate {
  id: number;
  name: string;
  label: string;
  description?: string;
  category: 'time' | 'weather' | 'content' | 'system' | 'layout' | 'custom';
  defaultConfig: Record<string, unknown>;
  minWidth: number;
  minHeight: number;
}

// Screen Widget instance - a widget placed on a screen design
export interface ScreenWidget {
  id: number;
  templateId: number;
  template?: WidgetTemplate;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // Rotation in degrees (0-359)
  config: Record<string, unknown>;
  zIndex: number;
}

// Screen Design - a designed screen with widgets
export interface ScreenDesign {
  id: number;
  name: string;
  description?: string;
  width: number;
  height: number;
  background: string;
  widgets: ScreenWidget[];
  isTemplate: boolean;
  userId?: number;
  createdAt: string;
  updatedAt: string;
  /** URL to browser capture with drawings (if exists) */
  captureUrl?: string | null;
}

// Widget config types for type safety

export interface ClockWidgetConfig {
  timezone: string;
  format: '12h' | '24h';
  showSeconds: boolean;
  showDate: boolean;
  dateFormat: string;
  fontFamily: string;
  fontSize: number;
}

export interface WeatherWidgetConfig {
  location: string;
  latitude: number;
  longitude: number;
  units: 'metric' | 'imperial';
  showIcon: boolean;
  showTemperature: boolean;
  showCondition: boolean;
  showHumidity: boolean;
  fontSize: number;
}

export interface TextWidgetConfig {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  textAlign: 'left' | 'center' | 'right';
  color: string;
}

export interface DateWidgetConfig {
  format: string;
  showDayOfWeek: boolean;
  fontSize: number;
  fontFamily: string;
}

export interface QRCodeWidgetConfig {
  content: string;
  size: number;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
}

export interface BatteryWidgetConfig {
  showPercentage: boolean;
  showIcon: boolean;
  fontSize: number;
}

export interface GitHubWidgetConfig {
  owner: string;
  repo: string;
  showIcon: boolean;
  showRepoName: boolean;
  fontSize: number;
  fontFamily: string;
}

// Screen Design Form Data
export interface ScreenDesignFormData {
  name: string;
  description?: string;
  width: number;
  height: number;
  background: string;
  isTemplate: boolean;
}
