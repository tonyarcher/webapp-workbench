import type { NotificationState } from '../../services/notifications';
import { formatMinute, parseTimeValue, type QuietHours } from '../../services/quiet-hours';
import { button, checkboxField, el, hint, section, setFocusKey, statusLine, timeField } from './settings-general-dom';

/** What the notifications section needs from the panel element. */
export interface SettingsGeneralNotificationsHost {
    notificationState: NotificationState;
    notificationStatus: string;
    notificationStatusError: boolean;
    quietHours: QuietHours;
    requestNotifications: () => void;
    sendTest: () => void;
    refreshNotificationState: () => void;
    setQuietHours: (next: QuietHours) => void;
}

/**
 * The state explanation doubles as the "visible re-explanation" the browser
 * permission rules expect before a second ask. The action button is the only
 * way to trigger a prompt; mounting the panel never asks.
 */
const STATE_HINT: Record<NotificationState, string> = {
    unsupported: 'This browser does not support notifications. Alerts stay in the app.',
    default:
        'Times Up can notify you about alerts and briefings. The browser asks only when you press Enable, never on its own.',
    granted:
        "Alerts and briefings can reach you away from this tab. To turn them off, remove this site's permission in your browser settings.",
    denied: "Notifications are blocked for this site. Allow them in your browser's site settings, then press Recheck.",
};

function actionFor(host: SettingsGeneralNotificationsHost): HTMLButtonElement | null {
    switch (host.notificationState) {
        case 'default':
            return button('btn primary', 'Enable notifications', host.requestNotifications);
        case 'granted':
            return button('btn', 'Send test notification', host.sendTest);
        case 'denied':
            return button('btn', 'Recheck permission', host.refreshNotificationState);
        default:
            return null;
    }
}

/**
 * The quiet-hours window is shared with F1 alerts and K4 briefings, so it sits
 * here rather than in each channel. Times are local to this device.
 */
function buildQuietHours(host: SettingsGeneralNotificationsHost): HTMLElement {
    const prefs = host.quietHours;
    const root = el('div', 'quiet-hours');
    root.append(checkboxField('Quiet hours', prefs.enabled, (enabled) => host.setQuietHours({ ...prefs, enabled })));
    if (prefs.enabled) {
        const times = el('div', 'view-defaults');
        times.append(
            timeField('From', formatMinute(prefs.startMinute), (value) => {
                const minute = parseTimeValue(value);
                if (minute !== null) host.setQuietHours({ ...prefs, startMinute: minute });
            }),
            timeField('To', formatMinute(prefs.endMinute), (value) => {
                const minute = parseTimeValue(value);
                if (minute !== null) host.setQuietHours({ ...prefs, endMinute: minute });
            }),
        );
        root.append(times);
    }
    root.append(hint("Quiet hours use this device's local time. Alerts and briefings wait until the window ends."));
    return root;
}

export function buildNotificationsSection(host: SettingsGeneralNotificationsHost): HTMLElement {
    const root = section('Notifications');
    root.setAttribute('data-setting', 'notifications');
    const action = actionFor(host);
    if (action) {
        // One stable key across the three states, so a repaint after the prompt
        // puts keyboard focus back on the same control instead of the body.
        setFocusKey(action, 'button:notifications');
        const actions = el('div', 'view-actions');
        actions.append(action);
        root.append(actions);
    }
    root.append(hint(STATE_HINT[host.notificationState]));
    if (host.notificationState !== 'unsupported') {
        root.append(
            hint(
                'Notification payloads carry a short label and a count. No article titles, bodies, or account details.',
            ),
        );
    }
    root.append(buildQuietHours(host));
    if (host.notificationStatus) root.append(statusLine(host.notificationStatus, host.notificationStatusError));
    return root;
}
