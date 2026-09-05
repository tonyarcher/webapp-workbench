import './web-components/app-shell/app-shell';
import './web-components/source-list/source-list';
import './web-components/article-list/article-list';
import './web-components/article-view/article-view';
import './web-components/brief-view/brief-view';
import './web-components/today-view/today-view';
import './web-components/today-menu/today-menu';
import './web-components/settings-dialog/settings-dialog';
import './web-components/feed-menu/feed-menu';
import './web-components/folder-menu/folder-menu';
import './styles/global.css';
import {initTheme} from './theme';
import {recomputeHotIfNeeded} from './db/db-query';

initTheme();
void recomputeHotIfNeeded();

// PWA install + offline support; registration in dev would fight HMR, so only
// the production bundle gets the service worker.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}
