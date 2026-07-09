import React, { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export const REVIEW_PROMPT_EVENT = 'app_store_review_prompt';
export const STORAGE_KEY = 'rlt_app_store_review_prompted';

export const triggerAppStoreReview = () => {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(STORAGE_KEY)) return;
  window.dispatchEvent(new Event(REVIEW_PROMPT_EVENT));
};

export default function AppStoreReviewPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleEvent = () => {
      if (localStorage.getItem(STORAGE_KEY)) return;
      setTimeout(() => setOpen(true), 1500);
    };

    window.addEventListener(REVIEW_PROMPT_EVENT, handleEvent);
    return () => window.removeEventListener(REVIEW_PROMPT_EVENT, handleEvent);
  }, []);

  const handleReview = async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setOpen(false);
    
    const APP_STORE_ID = 'id123456789';
    const itmsUrl = itms-apps://itunes.apple.com/app/?action=write-review;
    const webUrl = https://apps.apple.com/app/;
    
    if (Capacitor.isNativePlatform()) {
      try {
         await Browser.open({ url: itmsUrl });
      } catch (e) {
         window.open(webUrl, '_blank');
      }
    } else {
      window.open(webUrl, '_blank');
    }
  };

  const handleCancel = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-w-md w-[90vw] rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Enjoying Rugby League Takeover?</AlertDialogTitle>
          <AlertDialogDescription>
            If you're having fun, we'd love it if you could rate us in the App Store! It really helps us out.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <AlertDialogCancel onClick={handleCancel} className="mt-0 w-full sm:w-auto">Not Now</AlertDialogCancel>
          <AlertDialogAction onClick={handleReview} className="w-full sm:w-auto">Rate App</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
