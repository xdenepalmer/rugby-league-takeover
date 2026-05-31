import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';

const messageFrom = (error, fallback) =>
	error?.response?.data?.error || error?.data?.error || error?.message || fallback;

// Errors that mean "this entity/function hasn't been deployed to the Base44 app
// yet" are a transient platform-state issue, not something the user can act on.
// We silence them so a pending deploy never spams error toasts.
const isUndeployedSchemaError = (error) => /not found in app|schema .* not found/i.test(messageFrom(error, ''));

export const queryClientInstance = new QueryClient({
	queryCache: new QueryCache({
		onError: (error, query) => {
			if (query?.meta?.silent || isUndeployedSchemaError(error)) return;
			toast({ title: 'Unable to load data', description: messageFrom(error, 'Something went wrong loading data.') });
		},
	}),
	mutationCache: new MutationCache({
		onError: (error, _vars, _ctx, mutation) => {
			if (mutation?.meta?.silent) return;
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
			retry: 1,
		},
	},
});
