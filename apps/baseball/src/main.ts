import '@baseball/web-components/dist/web-components.js';
import { html, render } from 'lit';
import './index.css';
import './local-game/local-game.css';
import './local-game/app-shell';

const root = document.getElementById('root');
if (root) {
  render(html`<baseball-app></baseball-app>`, root);
}
