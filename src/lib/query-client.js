import { QueryClient, QueryCache, MutationCache, onlineManager } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { subscribeNativeNetwork } from './native/network.js';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';

const messageFrom = (error, fallback) => {
	const responseData = error?.response?.data;
	return (typeof responseData === 'string' ? responseData : null) || responseData?.error || responseData?.message || responseData?.detail || error?.data?.error || error?.data?.message || error?.message || fallback;
};

const isUndeployedSchemaError = (error) => /not found in app|schema .* not found/i.test(messageFrom(error, ''));

const isRateLimitError = (error) => {
	const message = messageFrom(error, '');
	return error?.response?.status === 429 || error?.status === 429 || /rate limit exceeded/i.test(message);
};

export const queryClientInstance = new QueryClient({
	queryCache: new QueryCache({
		onError: (error, query) => {
			if (query?.meta?.silent || isUndeployedSchemaError(error) || isRateLimitError(error)) return;
			toast({ title: 'Unable to load data', description: messageFrom(error, 'Something went wrong loading data.') });
		},
	}),
	mutationCache: new MutationCache({
		onError: (error, _vars, _ctx, mutation) => {
			if (mutation?.meta?.silent || isRateLimitError(error)) return;
			if (isUndeployedSchemaError(error)) {
				toast({ title: 'Not available yet', description: 'This feature needs the latest changes deployed to the app before it can be used.' });
				return;
			}
			toast({ title: 'Action failed', description: messageFrom(error, 'That action could not be completed.') });
		},
	}),
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnReconnect: true,
			staleTime: 1000 * 60 * 15,
			gcTime: 1000 * 60 * 60 * 24,
			retry: 1,
		},
	},
});

onlineManager.setEventListener((setOnline) => {
	const update = () => setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
	if (typeof window !== 'undefined') {
		window.addEventListener('online', update);
		window.addEventListener('offline', update);
	}
	
	const unsubscribeNative = subscribeNativeNetwork(setOnline);
	
	return () => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('online', update);
			window.removeEventListener('offline', update);
		}
		unsubscribeNative();
	};
});

if (typeof window !== 'undefined') {
	const localStoragePersister = createSyncStoragePersister({
		storage: window.localStorage,
	});

	persistQueryClient({
		queryClient: queryClientInstance,
		persister: localStoragePersister,
		maxAge: 1000 * 60 * 60 * 24,
	});
}
