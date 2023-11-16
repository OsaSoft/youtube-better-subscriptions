// eslint-disable-next-line import/no-mutable-exports
let brwsr: typeof browser;
try {
    brwsr = browser;
}
catch (error) {
    if (error instanceof ReferenceError) {
        brwsr = chrome as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    }
}

export default brwsr;
