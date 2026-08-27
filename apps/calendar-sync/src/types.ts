export interface TraktSettings {
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
    accessExpiresAt?: number;
    includeCalendar: boolean;
    includeHistory: boolean;
}

export interface GoogleSettings {
    clientId: string;
    accessToken?: string;
    accessExpiresAt?: number;
    calendarId?: string;
    writtenUids: string[];
}

export interface NetflixSettings {
    lastCount?: number;
    lastAt?: number;
}

export interface LastSync {
    at: number;
    count: number;
    failed: number;
    destination: 'ics' | 'google';
}

export interface AppSettings {
    version: 1;
    trakt: TraktSettings;
    google: GoogleSettings;
    netflix: NetflixSettings;
    lastSync?: LastSync;
}

export interface DeviceFlowView {
    userCode: string;
    verificationUrl: string;
}
