// Create (or promote) a gallery admin.
//
//   npm run admin:create -- you@example.com "a-strong-password"
//
// Uses SUPABASE_SERVICE_ROLE_KEY from .env. Runs locally only — the service
// role key is never bundled into the website.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const [email, password] = process.argv.slice(2);
const url = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email) {
	console.error('Usage: npm run admin:create -- <email> [password]');
	process.exit(1);
}
if (!url || !serviceKey) {
	console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
	process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser(target) {
	for (let page = 1; page < 50; page++) {
		const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
		if (error) throw error;
		const hit = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
		if (hit) return hit;
		if (data.users.length < 1000) return null;
	}
	return null;
}

let user = await findUser(email);

if (user) {
	console.log(`• Found existing user ${email}`);
	if (password) {
		const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
		if (error) throw error;
		console.log('• Password updated');
	}
} else {
	if (!password) {
		console.error(`No user with email ${email}. Pass a password to create one.`);
		process.exit(1);
	}
	const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
	if (error) throw error;
	user = data.user;
	console.log(`• Created user ${email}`);
}

const { error } = await supabase.from('gallery_admins').upsert({ user_id: user.id });
if (error) {
	console.error('Could not add to gallery_admins:', error.message);
	console.error('Did you run supabase/schema.sql in the SQL Editor first?');
	process.exit(1);
}

console.log(`✓ ${email} is now a gallery admin. Sign in at /login`);
