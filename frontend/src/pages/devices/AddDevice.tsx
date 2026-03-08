import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../components/layout';
import { Card, Button, Input } from '../../components/common';
import { useServerStatus } from '../../hooks/useServerStatus';
import { useMutation } from '../../hooks/useApi';
import { deviceService } from '../../services/api';
import type { DeviceFormData, Device } from '../../types';

/**
 * Add Device page — setup instructions for TRMNL devices
 * and alternative connection form for BYOD devices
 */
export function AddDevice() {
  const navigate = useNavigate();
  const { status } = useServerStatus();

  const [copied, setCopied] = useState(false);

  // Alternative Connection form state
  const [altDeviceName, setAltDeviceName] = useState('');
  const [altMacAddress, setAltMacAddress] = useState('');
  const [altWidth, setAltWidth] = useState('800');
  const [altHeight, setAltHeight] = useState('480');
  const [createdDevice, setCreatedDevice] = useState<Device | null>(null);

  const { mutate: createDevice, isLoading: isCreatingDevice } = useMutation(
    (data: DeviceFormData) => deviceService.create(data),
    {
      successMessage: 'Device registered successfully',
      onSuccess: (newDevice) => {
        setCreatedDevice(newDevice);
        setAltDeviceName('');
        setAltMacAddress('');
        setAltWidth('800');
        setAltHeight('480');
      },
    }
  );

  const handleAltSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatedDevice(null);
    await createDevice({
      name: altDeviceName,
      macAddress: altMacAddress,
      width: parseInt(altWidth, 10) || 800,
      height: parseInt(altHeight, 10) || 480,
    });
  };

  // Build the full API URL that devices should use
  const browserPort = typeof window !== 'undefined' ? window.location.port : '';
  const deviceApiUrl = browserPort && browserPort !== '80'
    ? `http://${status.localIp}:${browserPort}`
    : `http://${status.localIp}`;

  const handleCopyUrl = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(deviceApiUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = deviceApiUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/devices')}
            className="mb-4"
          >
            ← Back to Devices
          </Button>
          <h1 className="text-3xl font-bold text-text-primary">Add Device</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Connect a TRMNL device via WiFi setup or register a device manually.
          </p>
        </div>

        {/* TRMNL Setup Instructions */}
        <Card>
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            Connect Your Device
          </h2>

          <div className="space-y-5">
            {/* API URL Display */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Server URL for your device
              </label>
              <div className="flex items-center space-x-2">
                <code className="flex-1 text-sm bg-bg-muted px-4 py-3 rounded-lg border border-border-default font-mono">
                  {deviceApiUrl}
                </code>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-semibold text-white rounded-xl transition-all duration-200"
                  style={{ backgroundColor: copied ? '#22c55e' : '#3b82f6' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = copied ? '#16a34a' : '#2563eb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = copied ? '#22c55e' : '#3b82f6'; }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Status Warning */}
            {!status.isOnline && (
              <div className="p-4 bg-status-warning-bg border border-status-warning-border rounded-lg">
                <p className="text-sm text-status-warning-text">
                  <strong>Warning:</strong> The server appears to be offline.
                  Devices will not be able to connect until it is running.
                </p>
              </div>
            )}

            {/* Step-by-step Instructions */}
            <div>
              <h3 className="text-md font-semibold text-text-primary mb-3">
                Setup Steps
              </h3>
              <ol className="space-y-3 list-decimal list-inside text-sm text-text-secondary">
                <li>
                  <strong>Power on your TRMNL device</strong>
                  <p className="ml-6 mt-1 text-text-muted">
                    Hold the button until the screen activates. On first boot the device enters WiFi setup mode automatically.
                  </p>
                </li>
                <li>
                  <strong>Connect to the device's WiFi</strong>
                  <p className="ml-6 mt-1 text-text-muted">
                    On your phone or computer, join the network named <strong>TRMNL</strong> (or similar).
                  </p>
                </li>
                <li>
                  <strong>Open the captive portal</strong>
                  <p className="ml-6 mt-1 text-text-muted">
                    A setup page should open automatically. If not, open{' '}
                    <code className="bg-bg-muted px-1 rounded">192.168.4.1</code> in your browser.
                  </p>
                </li>
                <li>
                  <strong>Enter the server URL</strong>
                  <p className="ml-6 mt-1 text-text-muted">
                    Paste: <code className="bg-bg-muted px-1 rounded">{deviceApiUrl}</code>
                  </p>
                </li>
                <li>
                  <strong>Enter your WiFi credentials</strong>
                  <p className="ml-6 mt-1 text-text-muted">
                    Select your home/office WiFi and enter the password.
                  </p>
                </li>
                <li>
                  <strong>Done!</strong>
                  <p className="ml-6 mt-1 text-text-muted">
                    The device will restart, connect to WiFi, and register with this server.
                    It will appear on the <strong>Devices</strong> page within a minute.
                  </p>
                </li>
              </ol>
            </div>

            <div className="p-3 bg-status-info-bg border border-status-info-border rounded-lg">
              <p className="text-sm text-status-info-text">
                <strong>Next step:</strong> Once the device appears, assign it to a playlist
                so it starts displaying your screens.
              </p>
            </div>
          </div>
        </Card>

        {/* Alternative Connection */}
        <Card>
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            Alternative Connection
          </h2>
          <p className="text-sm text-text-muted mb-4">
            For devices that don't use the TRMNL WiFi setup flow (e.g., trmnl-android, custom ESP32 hardware).
            Register a device by entering its name and MAC address.
          </p>

          {createdDevice ? (
            <div className="p-4 bg-status-success-bg border border-status-success-border rounded-lg">
              <p className="text-sm text-status-success-text mb-2">
                <strong>Device registered!</strong> "{createdDevice.name}" has been added.
              </p>
              <div className="flex items-center gap-3">
                <Link
                  to={`/devices/${createdDevice.id}`}
                  className="text-sm font-medium underline"
                  style={{ color: '#3b82f6' }}
                >
                  View device
                </Link>
                <button
                  type="button"
                  onClick={() => setCreatedDevice(null)}
                  className="text-sm text-text-muted hover:text-text-secondary"
                >
                  Add another
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAltSubmit} className="space-y-4">
              <Input
                label="Device Name"
                value={altDeviceName}
                onChange={(e) => setAltDeviceName(e.target.value)}
                placeholder="My Android Display"
                required
              />
              <Input
                label="MAC Address"
                value={altMacAddress}
                onChange={(e) => setAltMacAddress(e.target.value)}
                placeholder="AA:BB:CC:DD:EE:FF"
                required
              />

              {/* Screen Resolution */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Screen Resolution
                </label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      label="Width (px)"
                      type="number"
                      value={altWidth}
                      onChange={(e) => setAltWidth(e.target.value)}
                      placeholder="800"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      label="Height (px)"
                      type="number"
                      value={altHeight}
                      onChange={(e) => setAltHeight(e.target.value)}
                      placeholder="480"
                      required
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  Default is 800x480 (TRMNL Original). Enter your device's screen resolution in pixels.
                </p>
              </div>

              <Button type="submit" isLoading={isCreatingDevice}>
                Add Device
              </Button>
            </form>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
