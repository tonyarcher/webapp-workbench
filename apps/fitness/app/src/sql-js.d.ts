declare module 'sql.js' {
    export interface QueryExecResult {
        columns: string[];
        values: unknown[][];
    }

    export class Database {
        constructor(data?: ArrayLike<number> | Buffer | null);
        exec(sql: string): QueryExecResult[];
        close(): void;
    }

    export interface SqlJsStatic {
        Database: typeof Database;
    }

    export default function initSqlJs(config?: {locateFile?: (file: string) => string}): Promise<SqlJsStatic>;
}

declare module 'sql.js/dist/sql-wasm.wasm?url' {
    const url: string;
    export default url;
}
