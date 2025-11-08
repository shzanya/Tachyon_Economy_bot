import { Elysia } from 'elysia'
import type { ShinoaBot } from '@/bot/shinoa.bot'

export class ApiModule {
	constructor(private bot: ShinoaBot) {}

	create() {
		return new Elysia()
			.decorate('bot', this.bot.getClient())

			
			.get('/', () => new Response(`
				<!DOCTYPE html>
				<html lang="ru">
				<head>
					<meta charset="UTF-8" />
					<title>Shinoa Bot API</title>
					<style>
						body {
							font-family: system-ui, sans-serif;
							background: #0f172a;
							color: #f1f5f9;
							text-align: center;
							padding: 50px;
						}
						h1 { color: #38bdf8; }
						a {
							display: inline-block;
							margin: 10px;
							padding: 12px 20px;
							background: #1e293b;
							border-radius: 10px;
							color: #38bdf8;
							text-decoration: none;
							transition: 0.2s;
						}
						a:hover { background: #334155; color: #a5f3fc; }
					</style>
				</head>
				<body>
					<h1>💠 Shinoa API</h1>
					<p>Добро пожаловать в API панели бота!</p>
					<div>
						<a href="/status">📊 Статус</a>
						<a href="/guilds">🏠 Гильдии</a>
						<a href="/health">💚 Проверка здоровья</a>
					</div>
				</body>
				</html>
			`, {
				headers: { 'Content-Type': 'text/html; charset=utf-8' }
			}))

			
			.get('/status', ({ bot }) => ({
				online: bot.isReady(),
				username: bot.user?.username,
				tag: bot.user?.tag,
				servers: bot.guilds.cache.size,
				users: bot.users.cache.size,
				ping: Math.round(bot.ws.ping),
				uptime: Math.floor(process.uptime())
			}))

			
			.get('/guilds', ({ bot }) => ({
				count: bot.guilds.cache.size,
				guilds: bot.guilds.cache.map(g => ({
					id: g.id,
					name: g.name,
					members: g.memberCount,
					icon: g.iconURL()
				}))
			}))

			
			.get('/health', () => ({
				status: 'healthy',
				timestamp: new Date().toISOString()
			}))

			
			.all('*', () =>
				new Response(JSON.stringify({ error: 'Route not found', code: 404 }), {
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				})
			)

			
			.onError(({ code, error }) => {
				console.error('API Error:', error)

				if (code === 'NOT_FOUND')
					return { error: 'Route not found', code: 404 }

				
				const message =
					error instanceof Error
						? error.message
						: typeof error === 'object' && error !== null && 'message' in error
						? String((error as any).message)
						: 'Unknown error'

				return { error: message, code }
			})
	}
}
