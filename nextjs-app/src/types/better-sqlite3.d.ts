declare module 'better-sqlite3' {
  interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  interface Statement<BindParameters extends any[] = any[]> {
    bind(...params: BindParameters): this;
    run(...params: BindParameters): RunResult;
    get(...params: BindParameters): any;
    all(...params: BindParameters): any[];
  }

  interface Database {
    pragma(pragma: string, options?: any): any;
    exec(source: string): this;
    prepare<BindParameters extends any[] = any[]>(
      source: string
    ): Statement<BindParameters>;
    transaction<F extends (...args: any[]) => any>(fn: F): F;
    close(): this;
  }

  interface DatabaseConstructor {
    new (filename?: string, options?: any): Database;
    (filename?: string, options?: any): Database;
  }

  const Database: DatabaseConstructor;
  export = Database;
}
