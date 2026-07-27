import { useState } from 'react';
import { isNativeApp } from '@/lib/native/native-env.js';

export function useNativeCamera() {
  const [isNativeCameraOpen, setIsNativeCameraOpen] = useState(false);
  const isNative = isNativeApp();

  const pickMedia = async (options = {}) => {
    try {
      setIsNativeCameraOpen(true);
      // Lazy-load the plugin so the web build never pulls in @capacitor/camera.
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        quality: 90,
        ...options,
      });

      if (!photo.webPath) {
        throw new Error('No webPath returned from camera');
      }

      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      
      const ext = photo.format || 'jpeg';
      const file = new File([blob], `photo_${Date.now()}.${ext}`, {
        type: `image/${ext}`
      });

      setIsNativeCameraOpen(false);
      return file;
    } catch (err) {
      setIsNativeCameraOpen(false);
      console.error('Camera error', err);
      return null;
    }
  };

  return { pickMedia, isNativeCameraOpen, isNative };
}
