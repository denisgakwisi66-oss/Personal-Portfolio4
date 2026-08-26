// ============================================================
// Shared behavior — used by every page (index/about/skills/projects/contacts)
// Page-specific scripts (typing effect, form handling, filters, etc.)
// live inline in each page.
// ============================================================
(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', function() {

        // ===== Year =====
        const yearEl = document.getElementById('year');
        if (yearEl) yearEl.textContent = new Date().getFullYear();

        // ===== Loading Screen =====
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            setTimeout(function() { loadingScreen.classList.add('hide'); }, 800);
        }

        // ===== Theme =====
        const themeToggle = document.getElementById('themeToggle');
        const root = document.documentElement;
        function getTheme() { return localStorage.getItem('theme') || 'dark'; }
        function setTheme(theme) { root.setAttribute('data-theme', theme); localStorage.setItem('theme', theme); }
        setTheme(getTheme());
        if (themeToggle) {
            themeToggle.addEventListener('click', function() {
                const current = root.getAttribute('data-theme');
                setTheme(current === 'dark' ? 'light' : 'dark');
            });
        }

        // ===== Mobile Menu =====
        const mobileToggle = document.getElementById('mobileToggle');
        const mobileMenu = document.getElementById('mobileMenu');
        if (mobileToggle && mobileMenu) {
            mobileToggle.addEventListener('click', function() {
                this.classList.toggle('active');
                mobileMenu.classList.toggle('active');
            });
            mobileMenu.querySelectorAll('a').forEach(function(link) {
                link.addEventListener('click', function() {
                    mobileToggle.classList.remove('active');
                    mobileMenu.classList.remove('active');
                });
            });
        }

        // ===== Nav Scroll Effect =====
        const nav = document.getElementById('nav');
        if (nav) {
            window.addEventListener('scroll', function() {
                nav.classList.toggle('scrolled', window.scrollY > 50);
            });
        }

        // ===== Scroll Progress =====
        const progress = document.getElementById('scrollProgress');
        if (progress) {
            window.addEventListener('scroll', function() {
                const scrollTop = window.scrollY;
                const docHeight = document.documentElement.scrollHeight - window.innerHeight;
                progress.style.width = (docHeight > 0 ? (scrollTop / docHeight) * 100 : 0) + '%';
            });
        }

        // ===== Scroll to Top =====
        const scrollTopBtn = document.getElementById('scrollTop');
        if (scrollTopBtn) {
            window.addEventListener('scroll', function() {
                scrollTopBtn.classList.toggle('visible', window.scrollY > 500);
            });
            scrollTopBtn.addEventListener('click', function() {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        // ===== Generic Scroll Reveal =====
        // Pages opt in by adding [data-reveal] to elements they want animated in.
        const revealElements = document.querySelectorAll('[data-reveal]');
        if (revealElements.length) {
            const revealObserver = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }
                });
            }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
            revealElements.forEach(function(el) {
                el.style.opacity = '0';
                el.style.transform = 'translateY(30px)';
                el.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
                revealObserver.observe(el);
            });
        }
    });
})();
