import './web-components/app-shell/app-shell'
import './styles/global.css'

const root = document.getElementById('app')
if (root) {
    root.appendChild(document.createElement('lvs-app-shell'))
}

// PWA: register the service worker in production builds only — the dev
// server must stay cache-free while iterating.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
}
