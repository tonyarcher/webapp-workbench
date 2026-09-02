import {listStations} from '../playlists.js';
import type {RouteHandler} from '../http.js';

export const stationsHandler: RouteHandler = async () => listStations();
