import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import {
    HEALTH_CONNECT_SQLITE_TABLES,
    parseHealthConnectSqliteTables,
    type ParseResult,
} from 'fitness-core';
import {rowsFromExec} from './sqlite-rows';

let sqlReady: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null;

function loadSql(): Promise<Awaited<ReturnType<typeof initSqlJs>>> {
    if (!sqlReady) sqlReady = initSqlJs({locateFile: () => wasmUrl});
    return sqlReady;
}

export async function parseHealthConnectSqliteFile(bytes: Uint8Array): Promise<ParseResult> {
    const SQL = await loadSql();
    const db = new SQL.Database(bytes);
    try {
        const tables: Record<string, Record<string, unknown>[]> = {};
        for (const table of HEALTH_CONNECT_SQLITE_TABLES) {
            tables[table] = rowsFromExec((sql) => db.exec(sql), table);
        }
        return parseHealthConnectSqliteTables(tables);
    } finally {
        db.close();
    }
}
