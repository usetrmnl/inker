import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../components/layout';
import { Button, Card, Input, LoadingSpinner } from '../../components/common';
import { useApi, useMutation } from '../../hooks/useApi';
import { deviceService } from '../../services/api';
import type { Device, DeviceFormData } from '../../types';

export function DeviceForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = id !== 'new' && !!id;

  const [formData, setFormData] = useState<DeviceFormData>({
    name: '',
    macAddress: '',
  });

  const { data: device, isLoading: isLoadingDevice } = useApi<Device>(
    () => deviceService.getById(id!),
    { showErrorNotification: false }
  );

  const { mutate: createDevice, isLoading: isCreating } = useMutation(
    (data: DeviceFormData) => deviceService.create(data),
    {
      successMessage: 'Device created successfully',
      onSuccess: (newDevice) => navigate(`/devices/${newDevice.id}`),
    }
  );

  const { mutate: updateDevice, isLoading: isUpdating } = useMutation(
    (data: Partial<DeviceFormData>) => deviceService.update(id!, data),
    {
      successMessage: 'Device updated successfully',
      onSuccess: () => navigate(`/devices/${id}`),
    }
  );

  // Populate form data when device is loaded
  // This is an intentional pattern for form initialization from server data
  useEffect(() => {
    if (device) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Form initialization from server data
      setFormData({
        name: device.name,
        macAddress: device.macAddress,
      });
    }
  }, [device]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditMode) {
      await updateDevice(formData);
    } else {
      await createDevice(formData);
    }
  };

  const handleChange = (field: keyof DeviceFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  if (isEditMode && isLoadingDevice) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  const isLoading = isCreating || isUpdating;

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
          <h1 className="text-3xl font-bold text-text-primary">
            {isEditMode ? 'Edit Device' : 'Add New Device'}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {isEditMode
              ? 'Update device information'
              : 'Register a new TRMNL device'}
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Device Name"
              value={formData.name}
              onChange={handleChange('name')}
              placeholder="Enter device name"
              required
            />

            <Input
              label="MAC Address"
              value={formData.macAddress}
              onChange={handleChange('macAddress')}
              placeholder="00:00:00:00:00:00"
              required
              disabled={isEditMode}
              helperText={
                isEditMode
                  ? 'MAC address cannot be changed'
                  : 'Enter the device MAC address'
              }
            />

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/devices')}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading}>
                {isEditMode ? 'Update Device' : 'Create Device'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </MainLayout>
  );
}
