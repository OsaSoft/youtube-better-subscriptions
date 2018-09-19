const LOG_HEADER = "[YT-Better-Subs] ";

let debug = true;
let printDate = false;

function log(text) {
    if (debug) {
        console.log(prepareMessage(text));
    }
}

function logError(error) {
    console.error(prepareMessage("ERROR! "), error.message);
    console.error(error.stack.substring(0, 1000));
}

function prepareMessage(text = null) {
    let message = LOG_HEADER;
    if (printDate) message += new Date().toUTCString() + ": ";
    if (text != null) message += text;

    return message;
}
