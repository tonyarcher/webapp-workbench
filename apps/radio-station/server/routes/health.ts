import {migrate} from '../db.js';
import type {RouteHandler} from '../http.js';

export const healthHandler: RouteHandler = async (_ctx) => {
    await migrate();
    return {ok: true};
};
