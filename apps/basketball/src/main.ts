import './web-components/app-shell/app-shell';
import './styles/global.css';
import './register-sw';

const root = document.getElementById('app');
if (root) root.appendChild(document.createElement('bball-app-shell'));
