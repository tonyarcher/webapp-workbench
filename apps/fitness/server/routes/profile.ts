import {getPool} from '../db.js';
import {LOCAL_USER_ID} from '../env.js';
import {HttpError, readJsonBody, type RouteHandler} from '../http.js';

export interface ProfileRow {
    sex: string | null;
    birth_year: number | null;
    height_m: number | null;
    display_unit: string;
    tm_squat_kg: number | null;
    tm_bench_kg: number | null;
    tm_deadlift_kg: number | null;
    tm_press_kg: number | null;
}

const EMPTY_PROFILE: ProfileRow = {
    sex: null,
    birth_year: null,
    height_m: null,
    display_unit: 'kg',
    tm_squat_kg: null,
    tm_bench_kg: null,
    tm_deadlift_kg: null,
    tm_press_kg: null,
};

function toProfile(row: ProfileRow | undefined) {
    const r = row ?? EMPTY_PROFILE;
    return {
        sex: r.sex,
        birthYear: r.birth_year,
        heightM: r.height_m,
        displayUnit: r.display_unit === 'lb' ? 'lb' : 'kg',
        tm: {
            squat: r.tm_squat_kg,
            bench: r.tm_bench_kg,
            deadlift: r.tm_deadlift_kg,
            press: r.tm_press_kg,
        },
    };
}

export const getProfileHandler: RouteHandler = async (_ctx) => {
    const {rows} = await getPool().query<ProfileRow>('SELECT * FROM profile WHERE user_id = $1', [LOCAL_USER_ID]);
    return toProfile(rows[0]);
};

function parseProfile(body: Record<string, unknown>): ProfileRow {
    const tm = body.tm && typeof body.tm === 'object' ? (body.tm as Record<string, unknown>) : {};
    const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
    return {
        sex: body.sex === 'male' || body.sex === 'female' ? body.sex : null,
        birth_year: num(body.birthYear),
        height_m: num(body.heightM),
        display_unit: body.displayUnit === 'lb' ? 'lb' : 'kg',
        tm_squat_kg: num(tm.squat),
        tm_bench_kg: num(tm.bench),
        tm_deadlift_kg: num(tm.deadlift),
        tm_press_kg: num(tm.press),
    };
}

export const putProfileHandler: RouteHandler = async ({req}) => {
    const body = (await readJsonBody(req)) as Record<string, unknown> | null;
    if (!body) throw new HttpError(400, 'missing body');
    const row = parseProfile(body);
    await getPool().query(
        `INSERT INTO profile (user_id, sex, birth_year, height_m, display_unit, tm_squat_kg, tm_bench_kg, tm_deadlift_kg, tm_press_kg, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
         ON CONFLICT (user_id) DO UPDATE SET
            sex = EXCLUDED.sex,
            birth_year = EXCLUDED.birth_year,
            height_m = EXCLUDED.height_m,
            display_unit = EXCLUDED.display_unit,
            tm_squat_kg = EXCLUDED.tm_squat_kg,
            tm_bench_kg = EXCLUDED.tm_bench_kg,
            tm_deadlift_kg = EXCLUDED.tm_deadlift_kg,
            tm_press_kg = EXCLUDED.tm_press_kg,
            updated_at = now()`,
        [LOCAL_USER_ID, row.sex, row.birth_year, row.height_m, row.display_unit, row.tm_squat_kg, row.tm_bench_kg, row.tm_deadlift_kg, row.tm_press_kg],
    );
    return toProfile(row);
};
