const { getStore } = require('@netlify/blobs');

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent';
const MAX_TOKENS = 700;
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 1500;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 30;

const PORTFOLIO_FAQ = `
Q: Who is Denis?
A: GAKWISI Shimo Denis is a Full-Stack Developer and UI/UX Designer based in Rwanda, with 3+ years of experience, 50+ projects completed, and 30+ happy clients (98% satisfaction rate).

Q: What technologies/skills does he know?
A: Frontend: HTML5, CSS3/Sass, JavaScript (ES6+), React, Tailwind CSS. Backend: Node.js, Express.js, Python, PHP. Databases: MongoDB, MySQL, PostgreSQL, Firebase. UI/UX: Figma, Adobe XD, prototyping, user research. DevOps/Tools: Git & GitHub, Docker, AWS, CI/CD.

Q: What services does he offer?
A: Website development, UI/UX design, business websites, landing pages, portfolio development, responsive design, website maintenance, SEO optimization, API integration, database design, and technical consulting.

Q: What is his work experience?
A: Full-Stack Developer (Freelance, 2024-Present); UI/UX Designer at a Design Studio (2023-2024); Junior Developer at a Tech Startup (2022-2023); Bachelor's in Computer Science, University of Rwanda (2021-2024).

Q: Is he available for freelance work / hire?
A: Yes — he's open to freelance projects and collaborations. The best way to reach him is the contact form on the Contact page, or directly by email/WhatsApp.

Q: How can I contact him?
A: Email: denisgakwisi66@gmail.com. WhatsApp: +250 780 321 523. Instagram: @g.s.d58. He's based in Rwanda, East Africa, and typically replies within 24 hours.

Q: Where can I see his work / projects?
A: The Projects page showcases his work, including an E-Commerce Platform, a Mobile Banking App UI/UX design, an Analytics Dashboard, a RESTful API Gateway, a Fitness Tracker App, and DEN Photography (a live photography portfolio site).

Q: Can I download his resume?
A: Yes, there's a "Download Resume" button on the homepage.
`.trim();

const SYSTEM_PROMPT =
    "You are a helpful, friendly AI assistant embedded as a chat widget on GAKWISI Shimo Denis's " +
    'personal portfolio website. You can help visitors with general questions of any kind, and you ' +
    "have accurate background info about Denis below for questions about him, his skills, or his services " +
    '— use it verbatim rather than guessing, and say you\'re not sure rather than inventing details that ' +
    "aren't listed. Keep replies concise and conversational (a few sentences unless more detail is clearly " +
    "needed). If asked who built you or whose site this is, mention you're the assistant on Denis's portfolio.\n\n" +
    'Reference information about Denis (frequently asked questions):\n' + PORTFOLIO_FAQ;

function jsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function getClientIp(event) {
    return (
        event.headers['x-nf-client-connection-ip'] ||
        (event.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        'unknown'
    );
}

async function checkRateLimit(ip) {
    if (ip === 'unknown') return true; // fail open rather than blocking everyone if IP is missing

    let store;
    try {
        store = getStore('chat-rate-limits');
    } catch (e) {
        return true; // Blobs unavailable (e.g. local dev without `netlify dev`) — fail open
    }

    const now = Date.now();
    const key = ip.replace(/[^a-zA-Z0-9:.]/g, '_');
    let record;
    try {
        record = await store.get(key, { type: 'json' });
    } catch (e) {
        return true;
    }

    if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
        record = { windowStart: now, count: 0 };
    }

    if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
        return false;
    }

    record.count += 1;
    try {
        await store.setJSON(key, record);
    } catch (e) {
        // If we can't persist, allow the request rather than failing the user's chat.
    }
    return true;
}

exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('Missing GEMINI_API_KEY — chat assistant cannot authenticate.');
        return jsonResponse(500, { error: 'Chat assistant is not configured correctly.' });
    }

    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch (e) {
        return jsonResponse(400, { error: 'Invalid JSON body' });
    }

    const incoming = Array.isArray(payload.messages) ? payload.messages : null;
    if (!incoming || incoming.length === 0) {
        return jsonResponse(400, { error: 'messages array is required' });
    }

    const messages = incoming.slice(-MAX_MESSAGES).filter(function (m) {
        return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0;
    }).map(function (m) {
        return { role: m.role, content: m.content.trim().slice(0, MAX_MESSAGE_LENGTH) };
    });

    if (messages.length === 0) {
        return jsonResponse(400, { error: 'No valid messages provided' });
    }
    if (messages[messages.length - 1].role !== 'user') {
        return jsonResponse(400, { error: 'Last message must be from the user' });
    }

    const ip = getClientIp(event);
    const allowed = await checkRateLimit(ip);
    if (!allowed) {
        return jsonResponse(429, { error: "You've sent a lot of messages. Please try again later." });
    }

    // Gemini uses "user"/"model" roles instead of "user"/"assistant".
    const contents = messages.map(function (m) {
        return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
    });

    try {
        const geminiRes = await fetch(GEMINI_URL + '?key=' + encodeURIComponent(apiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                generationConfig: { maxOutputTokens: MAX_TOKENS },
            }),
        });

        const data = await geminiRes.json();

        if (!geminiRes.ok) {
            console.error('Gemini API error:', geminiRes.status, JSON.stringify(data));
            if (geminiRes.status === 429) {
                return jsonResponse(429, { error: 'The assistant is receiving a lot of requests right now. Please try again shortly.' });
            }
            if (geminiRes.status === 400 || geminiRes.status === 403) {
                return jsonResponse(500, { error: 'Chat assistant is not configured correctly.' });
            }
            return jsonResponse(502, { error: 'The assistant is temporarily unavailable. Please try again.' });
        }

        const candidate = data.candidates && data.candidates[0];
        const parts = candidate && candidate.content && candidate.content.parts;
        const reply = parts ? parts.map(function (p) { return p.text || ''; }).join('') : '';

        if (!reply) {
            return jsonResponse(200, { reply: "Sorry, I couldn't generate a response. Please try again." });
        }

        return jsonResponse(200, { reply: reply });
    } catch (err) {
        console.error('Gemini request failed:', err);
        return jsonResponse(502, { error: 'The assistant is temporarily unavailable. Please try again.' });
    }
};
