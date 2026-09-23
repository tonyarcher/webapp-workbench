import { InfiniteQueryObserver, QueryObserver } from '@tanstack/query-core';
import type {
    InfiniteData,
    InfiniteQueryObserverOptions,
    InfiniteQueryObserverResult,
    QueryKey,
    QueryObserverOptions,
    QueryObserverResult,
} from '@tanstack/query-core';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { queryClient } from './query-client';

// ---- reactive query controllers ----

/**
 * Lit reactive controller subscribing to the module QueryClient.
 * Rebuilds the observer whenever the factory's queryKey changes.
 */
export class QueryController<TFnData, TData = TFnData, TError = Error> implements ReactiveController {
    protected observer: QueryObserver<TFnData, TError, TData, TData, QueryKey> | null = null;
    private result: QueryObserverResult<TData, TError> | null = null;
    private lastKey = '';
    private readonly host: ReactiveControllerHost;
    private readonly factory: () => QueryObserverOptions<TFnData, TError, TData, TData, QueryKey>;

    constructor(
        host: ReactiveControllerHost,
        factory: () => QueryObserverOptions<TFnData, TError, TData, TData, QueryKey>,
    ) {
        this.host = host;
        this.factory = factory;
        host.addController(this);
    }

    protected makeObserver(
        opts: QueryObserverOptions<TFnData, TError, TData, TData, QueryKey>,
    ): QueryObserver<TFnData, TError, TData, TData, QueryKey> {
        return new QueryObserver<TFnData, TError, TData, TData, QueryKey>(queryClient, opts);
    }

    hostConnected(): void {
        this.sync();
    }

    hostUpdate(): void {
        this.sync();
    }

    hostDisconnected(): void {
        this.observer?.destroy();
        this.observer = null;
    }

    private sync(): void {
        const opts = this.factory();
        const key = JSON.stringify(opts.queryKey);
        if (this.observer) {
            if (key !== this.lastKey) {
                this.observer.setOptions(opts);
                this.lastKey = key;
            }
            return;
        }
        this.lastKey = key;
        const observer = this.makeObserver(opts);
        this.observer = observer;
        observer.subscribe((result) => {
            this.result = result;
            this.host.requestUpdate();
        });
        this.result = observer.getCurrentResult();
    }

    get value(): QueryObserverResult<TData, TError> {
        if (!this.result) this.sync();
        return this.result as QueryObserverResult<TData, TError>;
    }

    refetch(): void {
        void this.observer?.refetch();
    }
}

export class InfiniteQueryController<TFnData, TError = Error> extends QueryController<
    TFnData,
    InfiniteData<TFnData, number>,
    TError
> {
    constructor(
        host: ReactiveControllerHost,
        factory: () => InfiniteQueryObserverOptions<TFnData, TError, InfiniteData<TFnData, number>, QueryKey, number>,
    ) {
        super(
            host,
            factory as () => QueryObserverOptions<
                TFnData,
                TError,
                InfiniteData<TFnData, number>,
                InfiniteData<TFnData, number>,
                QueryKey
            >,
        );
    }

    protected override makeObserver(
        opts: QueryObserverOptions<
            TFnData,
            TError,
            InfiniteData<TFnData, number>,
            InfiniteData<TFnData, number>,
            QueryKey
        >,
    ): QueryObserver<TFnData, TError, InfiniteData<TFnData, number>, InfiniteData<TFnData, number>, QueryKey> {
        return new InfiniteQueryObserver<TFnData, TError, InfiniteData<TFnData, number>, QueryKey, number>(
            queryClient,
            opts as InfiniteQueryObserverOptions<TFnData, TError, InfiniteData<TFnData, number>, QueryKey, number>,
        );
    }

    fetchNextPage(): void {
        const observer = this.observer as InfiniteQueryObserver<
            TFnData,
            TError,
            InfiniteData<TFnData, number>,
            QueryKey,
            number
        > | null;
        void observer?.fetchNextPage();
    }

    get hasNextPage(): boolean {
        const result = this.value as unknown as InfiniteQueryObserverResult<InfiniteData<TFnData, number>, TError>;
        return !!result.hasNextPage;
    }

    get isFetchingNextPage(): boolean {
        const result = this.value as unknown as InfiniteQueryObserverResult<InfiniteData<TFnData, number>, TError>;
        return !!result.isFetchingNextPage;
    }
}
