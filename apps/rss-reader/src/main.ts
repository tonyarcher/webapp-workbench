import './web-components/app-shell/app-shell';
import './web-components/source-list/source-list';
import './web-components/article-list/article-list';
import './web-components/article-view/article-view';
import './web-components/brief-view/brief-view';
import './web-components/settings-dialog/settings-dialog';
import './web-components/feed-menu/feed-menu';
import './web-components/folder-menu/folder-menu';
import './styles/global.css';
import { initTheme } from './theme';
import { recomputeHotIfNeeded, reconcileUnreadCounts } from './db/db';

initTheme();
void recomputeHotIfNeeded().then(() => reconcileUnreadCounts());
