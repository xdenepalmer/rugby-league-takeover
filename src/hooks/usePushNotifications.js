import { useState, useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export const usePushNotifications = () => {
  const [fcmToken, setFcmToken] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const registerListeners = async () => {
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
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, []);

  const requestPermissions = async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications are only available on native platforms.');
      return false;
    }

    try {
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
