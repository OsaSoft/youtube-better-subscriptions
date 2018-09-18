let debug = false;
let date = false;

function log(text) {
    if (debug) {
        let logHeader = "[YT-Better-Subs] ";
        if (date) logHeader += new Date().toUTCString() + ": ";
        console.log(logHeader + text);
    }
}
