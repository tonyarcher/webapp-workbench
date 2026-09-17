export interface ExecResult {
    columns: string[];
    values: unknown[][];
}

export function rowObject(columns: string[], values: unknown[]): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) row[columns[i] ?? ''] = values[i];
    return row;
}

export function rowsFromExec(exec: (sql: string) => ExecResult[], table: string): Record<string, unknown>[] {
    try {
        const result = exec(`SELECT * FROM "${table}"`);
        const first = result[0];
        if (!first) return [];
        return first.values.map((values) => rowObject(first.columns, values));
    } catch {
        return [];
    }
}
