import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../components/layout';
import { Button, Card, Input, LoadingSpinner } from '../../components/common';
import { useApi, useMutation } from '../../hooks/useApi';
import { screenService } from '../../services/api';
import type { Screen, ScreenFormData } from '../../types';

export function ScreenForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = id !== 'new' && !!id;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    file: null as File | null,
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: screen, isLoading: isLoadingScreen } = useApi<Screen>(
    () => screenService.getById(id!),
    { showErrorNotification: false }
  );

  const { mutate: createScreen, isLoading: isCreating } = useMutation(
    (data: ScreenFormData) => screenService.create(data),
    {
      successMessage: 'Screen created successfully',
      onSuccess: (newScreen) => navigate(`/screens/${newScreen.id}`),
    }
  );

  const { mutate: updateScreen, isLoading: isUpdating } = useMutation(
    (data: Partial<ScreenFormData>) => screenService.update(id!, data),
    {
      successMessage: 'Screen updated successfully',
      onSuccess: () => navigate(`/screens/${id}`),
    }
  );

  // Track which screen was used to populate form to avoid re-populating
  const populatedScreenIdRef = useRef<string | null>(null);

  // Populate form data when screen is loaded (only once per screen)
  // This is an intentional pattern for form initialization from server data
  useEffect(() => {
    if (screen && screen.id !== populatedScreenIdRef.current) {
      populatedScreenIdRef.current = screen.id;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Form initialization from server data
      setFormData({
        name: screen.name,
        description: screen.description || '',
        file: null,
      });
      setPreviewUrl(screen.imageUrl);
    }
  }, [screen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEditMode && !formData.file) {
      alert('Please select an image file');
      return;
    }

    const submitData: Partial<ScreenFormData> = {
      name: formData.name,
      description: formData.description,
    };

    if (formData.file) {
      submitData.file = formData.file;
    }

    if (isEditMode) {
      await updateScreen(submitData);
    } else {
      // For create, file is required (already validated above)
      await createScreen(submitData as ScreenFormData);
    }
  };

  const handleChange = (field: 'name' | 'description') => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        file,
      }));

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (isEditMode && isLoadingScreen) {
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
            onClick={() => navigate('/screens')}
            className="mb-4"
          >
            ← Back to Screens
          </Button>
          <h1 className="text-3xl font-bold text-text-primary">
            {isEditMode ? 'Edit Screen' : 'Upload New Screen'}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {isEditMode
              ? 'Update screen information and image'
              : 'Upload a new screen image for your devices'}
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Screen Name"
              value={formData.name}
              onChange={handleChange('name')}
              placeholder="Enter screen name"
              required
            />

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={handleChange('description')}
                placeholder="Enter screen description (optional)"
                className="w-full px-3 py-2 border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Image File {!isEditMode && <span className="text-status-error-text">*</span>}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                required={!isEditMode}
              />
              <p className="mt-1 text-sm text-text-muted">
                {isEditMode
                  ? 'Leave empty to keep current image'
                  : 'Upload PNG, JPG, or other image formats'}
              </p>
            </div>

            {previewUrl && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Preview
                </label>
                <div className="border rounded-lg overflow-hidden max-w-md">
                  <img
                    src={previewUrl}
                    alt="Screen preview"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/screens')}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading}>
                {isEditMode ? 'Update Screen' : 'Upload Screen'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </MainLayout>
  );
}
