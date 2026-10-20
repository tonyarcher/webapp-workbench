import './web-components/app-shell/app-shell';
import './styles/global.css';

/** Mount the shell when the document has its root element. */
export function mountApp(root: HTMLElement | null): void {
    if (!root) return;
    root.appendChild(document.createElement('cw-app-shell'));
}

mountApp(document.getElementById('app'));
