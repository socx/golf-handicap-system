import { env } from './config/env';
import { createApp } from './app';

export function startServer(): void {
	const app = createApp();
	app.listen(env.port, () => {
		console.log(`ghs-api listening on http://localhost:${env.port}`);
	});
}
