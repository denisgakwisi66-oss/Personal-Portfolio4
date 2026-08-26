// ============================================================
// AI chat widget — floating assistant available on every page.
// Talks to the Netlify Function at /.netlify/functions/chat.
// Self-contained: injects its own markup + styles, no dependency
// on style.css / main.js.
// ============================================================
(function() {
    'use strict';

    const ENDPOINT = '/.netlify/functions/chat';
    const HISTORY_KEY = 'cb_history';
    const MAX_HISTORY_SENT = 12;
    const MAX_INPUT_LENGTH = 1500;

    const style = document.createElement('style');
    style.textContent = `
        .cb-launcher {
            position: fixed;
            bottom: 2rem;
            left: 2rem;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            border: none;
            cursor: pointer;
            background: linear-gradient(135deg, #2563EB, #7C3AED);
            color: #fff;
            box-shadow: 0 8px 24px rgba(37,99,235,0.35);
            font-size: 1.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9997;
            transition: transform 0.2s ease;
        }
        .cb-launcher:hover { transform: translateY(-3px); }
        .cb-launcher svg { width: 26px; height: 26px; }
        .cb-panel {
            position: fixed;
            bottom: calc(2rem + 68px);
            left: 2rem;
            width: 340px;
            max-width: calc(100vw - 2rem);
            height: 480px;
            max-height: calc(100vh - 8rem);
            background: var(--surface, #1E293B);
            color: var(--text, #F8FAFC);
            border: 1px solid var(--border, #334155);
            border-radius: 16px;
            box-shadow: 0 16px 64px rgba(0,0,0,0.35);
            display: none;
            flex-direction: column;
            overflow: hidden;
            z-index: 9998;
            font-family: 'Inter', sans-serif;
        }
        .cb-panel.open { display: flex; }
        .cb-header {
            padding: 0.9rem 1rem;
            background: linear-gradient(135deg, #2563EB, #7C3AED);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
        }
        .cb-header-title { font-weight: 700; font-size: 0.95rem; }
        .cb-header-sub { font-size: 0.7rem; opacity: 0.85; }
        .cb-close {
            background: none;
            border: none;
            color: #fff;
            font-size: 1.1rem;
            cursor: pointer;
            line-height: 1;
            padding: 0.25rem;
        }
        .cb-messages {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.6rem;
        }
        .cb-msg {
            max-width: 85%;
            padding: 0.55rem 0.8rem;
            border-radius: 12px;
            font-size: 0.85rem;
            line-height: 1.45;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .cb-msg.user {
            align-self: flex-end;
            background: linear-gradient(135deg, #2563EB, #7C3AED);
            color: #fff;
            border-bottom-right-radius: 2px;
        }
        .cb-msg.assistant {
            align-self: flex-start;
            background: rgba(148,163,184,0.15);
            border-bottom-left-radius: 2px;
        }
        .cb-msg.error {
            align-self: flex-start;
            background: rgba(239,68,68,0.15);
            color: #EF4444;
        }
        .cb-typing {
            align-self: flex-start;
            display: flex;
            gap: 4px;
            padding: 0.6rem 0.8rem;
        }
        .cb-typing span {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--text-secondary, #94A3B8);
            animation: cb-bounce 1.2s infinite ease-in-out;
        }
        .cb-typing span:nth-child(2) { animation-delay: 0.15s; }
        .cb-typing span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes cb-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
        .cb-form {
            display: flex;
            gap: 0.5rem;
            padding: 0.75rem;
            border-top: 1px solid var(--border, #334155);
            flex-shrink: 0;
        }
        .cb-input {
            flex: 1;
            resize: none;
            border-radius: 10px;
            border: 1px solid var(--border, #334155);
            background: var(--bg, #0F172A);
            color: var(--text, #F8FAFC);
            padding: 0.5rem 0.7rem;
            font-family: inherit;
            font-size: 0.85rem;
            max-height: 80px;
        }
        .cb-input:focus { outline: none; border-color: #2563EB; }
        .cb-send {
            border: none;
            border-radius: 10px;
            background: linear-gradient(135deg, #2563EB, #7C3AED);
            color: #fff;
            width: 42px;
            cursor: pointer;
            font-size: 1rem;
        }
        .cb-send:disabled { opacity: 0.5; cursor: not-allowed; }
        .cb-footnote {
            text-align: center;
            font-size: 0.65rem;
            color: var(--text-secondary, #94A3B8);
            padding: 0.35rem 0 0.6rem;
        }
    `;
    document.head.appendChild(style);

    const launcher = document.createElement('button');
    launcher.className = 'cb-launcher';
    launcher.setAttribute('aria-label', 'Open chat assistant');
    launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

    const panel = document.createElement('div');
    panel.className = 'cb-panel';
    panel.innerHTML = `
        <div class="cb-header">
            <div>
                <div class="cb-header-title">Chat Assistant</div>
                <div class="cb-header-sub">Powered by Gemini</div>
            </div>
            <button class="cb-close" aria-label="Close chat">&times;</button>
        </div>
        <div class="cb-messages" id="cbMessages"></div>
        <form class="cb-form" id="cbForm">
            <textarea class="cb-input" id="cbInput" rows="1" placeholder="Ask me anything..." maxlength="${MAX_INPUT_LENGTH}"></textarea>
            <button type="submit" class="cb-send" id="cbSend" aria-label="Send">&#10148;</button>
        </form>
        <div class="cb-footnote">AI can make mistakes. Verify important info.</div>
    `;

    document.addEventListener('DOMContentLoaded', function() {
        document.body.appendChild(launcher);
        document.body.appendChild(panel);

        const messagesEl = panel.querySelector('#cbMessages');
        const form = panel.querySelector('#cbForm');
        const input = panel.querySelector('#cbInput');
        const sendBtn = panel.querySelector('#cbSend');
        const closeBtn = panel.querySelector('.cb-close');

        function loadHistory() {
            try {
                return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
            } catch (e) {
                return [];
            }
        }
        function saveHistory(history) {
            try {
                sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-40)));
            } catch (e) { /* storage unavailable — conversation just won't persist */ }
        }

        let history = loadHistory();

        function renderMessage(role, text) {
            const el = document.createElement('div');
            el.className = 'cb-msg ' + role;
            el.textContent = text;
            messagesEl.appendChild(el);
            messagesEl.scrollTop = messagesEl.scrollHeight;
            return el;
        }

        function renderHistory() {
            messagesEl.innerHTML = '';
            if (history.length === 0) {
                renderMessage('assistant', "Hi! I'm an AI assistant here to help. Ask me anything.");
                return;
            }
            history.forEach(function(m) { renderMessage(m.role, m.content); });
        }
        renderHistory();

        function showTyping() {
            const el = document.createElement('div');
            el.className = 'cb-typing';
            el.id = 'cbTyping';
            el.innerHTML = '<span></span><span></span><span></span>';
            messagesEl.appendChild(el);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
        function hideTyping() {
            const el = document.getElementById('cbTyping');
            if (el) el.remove();
        }

        launcher.addEventListener('click', function() {
            panel.classList.add('open');
            input.focus();
        });
        closeBtn.addEventListener('click', function() {
            panel.classList.remove('open');
        });

        input.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 80) + 'px';
        });
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                form.requestSubmit();
            }
        });

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const text = input.value.trim();
            if (!text || sendBtn.disabled) return;

            renderMessage('user', text);
            history.push({ role: 'user', content: text });
            saveHistory(history);
            input.value = '';
            input.style.height = 'auto';

            sendBtn.disabled = true;
            input.disabled = true;
            showTyping();

            fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: history.slice(-MAX_HISTORY_SENT) })
            })
                .then(function(res) {
                    if (!res.ok) {
                        return res.json().catch(function() { return {}; }).then(function(body) {
                            throw new Error(body.error || ('Request failed (' + res.status + ')'));
                        });
                    }
                    return res.json();
                })
                .then(function(data) {
                    hideTyping();
                    const reply = data.reply || "Sorry, I didn't get a response. Please try again.";
                    renderMessage('assistant', reply);
                    history.push({ role: 'assistant', content: reply });
                    saveHistory(history);
                })
                .catch(function(err) {
                    hideTyping();
                    renderMessage('error', err.message || 'Something went wrong. Please try again in a moment.');
                })
                .finally(function() {
                    sendBtn.disabled = false;
                    input.disabled = false;
                    input.focus();
                });
        });
    });
})();
