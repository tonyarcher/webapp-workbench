import './web-components/app-shell/app-shell'
import './styles/global.css'

const root = document.getElementById('app')
if (root) {
    root.appendChild(document.createElement('cs-app-shell'))
}

// PWA: register the service worker in production builds only — the dev
// server must stay cache-free while iterating. BASE_URL keeps the
// registration working when the app is served from a subpath.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
    })
}