let brwsr: typeof browser;
try {
    brwsr = browser;
}
catch (error) {
    if (error instanceof ReferenceError) {
        brwsr = chrome;
    }
}

export default brwsr;
