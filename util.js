var debug = true;

function log(text) {
    if (debug) {
        text = "[YT-Better-Subs] " + new Date().toUTCString() + ": " + text;
        console.log(text);
    }
}
