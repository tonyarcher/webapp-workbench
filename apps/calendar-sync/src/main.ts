import './web-components/app-shell/app-shell';
import './styles/global.css';

const root = document.getElementById('app');
if (root) {
    root.appendChild(document.createElement('cal-app-shell'));
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    });
}
