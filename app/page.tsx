// Redirect root to login (or dashboard if already signed in — middleware handles it)
import { redirect } from 'next/navigation';

export default function HomePage() {
    redirect('/auth/login');
}
