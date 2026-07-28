import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';

/**
 * Sign out and, on failure, tell the user instead of failing silently.
 *
 * A swallowed sign-out is worse than a visible one: the UI navigates away as
 * if the user were logged out while the Supabase session is still live (a real
 * problem on shared devices). On error we stay put and surface the reason.
 *
 * Never rejects — safe to use directly as an onClick handler.
 */
export async function signOut(redirectUrl = '/') {
  try {
    await base44.auth.logout(redirectUrl);
    return true;
  } catch (error) {
    console.error('Sign out failed:', error);
    toast({
      title: "Couldn't sign out",
      description: error?.message || 'Please check your connection and try again.',
      variant: 'destructive',
    });
    return false;
  }
}
