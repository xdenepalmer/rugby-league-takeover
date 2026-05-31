import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';

const messageFrom = (error, fallback) =>
	error?.response?.data?.error || error?.data?.error || error?.message || fallback;

export const queryClientInstance = new QueryClient({
	queryCache: new QueryCache({
		onError: (error) => {
			toast({ title: 'Unable to load data', description: messageFrom(error, 'Something went wrong loading data.') });
		},
	}),
	mutationCache: new MutationCache({
		onError: (error) => {
			toast({ title: 'Action failed', description: messageFrom(error, 'That action could not be completed.') });
		},
	}),
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});
