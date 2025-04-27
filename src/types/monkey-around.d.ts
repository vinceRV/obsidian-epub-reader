declare module "monkey-around" {
    type MethodAdvice = (
        old: (...args: unknown[]) => unknown,
    ) => (...args: unknown[]) => unknown;

    function around<T extends object>(
        target: T,
        methods: Record<string, MethodAdvice>
    ): () => void;

    export { around };
}
