import { html, render } from 'lit';
import './widgets/index';
import './index.css';
import './local-game/local-game.css';
import './local-game/app-shell';
import './register-sw';

const root = document.getElementById('root');
if (root) {
    render(html`<baseball-app></baseball-app>`, root);
}
