import { useState, useEffect } from 'react';
import { isNativeApp } from '@/lib/native/native-env.js';

export const usePushNotifications = () => {
  const [fcmToken, setFcmToken] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) {
      return undefined;
    }

    let cancelled = false;
    let pushPlugin = null;

    const registerListeners = async () => {
      // Lazy-load so the web build never pulls in @capacitor/push-notifications.
      const { PushNotifications } = await import('@capacitor/push-notifications');
      if (cancelled) return;
      pushPlugin = PushNotifications;

      await PushNotifications.addListener('registration', (token) => {
        console.info('Registration token: ', token.value);
        setFcmToken(token.value);
      });

      await PushNotifications.addListener('registrationError', (err) => {
        console.error('Registration error: ', err.error);
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received: ', notification);
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push notification action performed: ', notification.actionId, notification.inputValue);
      });
    };

    registerListeners();

    return () => {
      cancelled = true;
      if (pushPlugin) pushPlugin.removeAllListeners();
    };
  }, []);

  const requestPermissions = async () => {
    if (!isNativeApp()) {
      console.log('Push notifications are only available on native platforms.');
      return false;
    }

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('User denied push notification permissions');
        setPermissionsGranted(false);
        return false;
      }

      setPermissionsGranted(true);
      await PushNotifications.register();
      return true;
    } catch (error) {
      console.error('Error requesting push notification permissions:', error);
      return false;
    }
  };

  return {
    fcmToken,
    permissionsGranted,
    requestPermissions,
  };
};
