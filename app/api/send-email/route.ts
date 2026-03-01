import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        const data = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: email,
            subject: 'Welcome to VibeGrid Marketplace 🌿⚡',
            html: '<strong>You’re in.</strong>',
        });

        return Response.json(data);
    } catch (error) {
        return Response.json({ error });
    }
}